// git-sync.ts
// The nerve. Pushes awareness state to git at session boundaries.
// Wraps GitHub Git Data API for atomic multi-file commits.
// Fallback: any failure → log warning, continue with local. Never block the session.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

// --- Types ---

export interface FileChange {
  path: string; // relative path in repo (e.g., "state.json")
  content: string; // file content
}

export interface FileContents {
  [path: string]: string; // path → content
}

export interface CommitInfo {
  sha: string;
  message: string;
  date: string; // ISO timestamp
  author: string;
}

export interface GitSyncConfig {
  repo: string; // "owner/repo"
  token: string; // GitHub PAT
  branch?: string; // default: "main"
  userId?: string; // for multi-user: files go to users/{userId}/
}

export interface GitSyncLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  debug?: (msg: string) => void;
}

// --- GitHub API Types ---

interface GitHubBlob {
  sha: string;
  url: string;
}

interface GitHubTreeEntry {
  path: string;
  mode: "100644"; // regular file
  type: "blob";
  sha: string;
}

interface GitHubTree {
  sha: string;
  tree: GitHubTreeEntry[];
}

interface GitHubCommit {
  sha: string;
  message: string;
  tree: { sha: string };
  parents: Array<{ sha: string }>;
  author: { name: string; date: string };
}

interface GitHubRef {
  ref: string;
  object: { sha: string };
}

// --- GitSync Class ---

export class GitSync {
  private config: GitSyncConfig;
  private cacheDir: string;
  private logger: GitSyncLogger;
  private cachedHeadSha: string | null = null;
  private branch: string;

  constructor(params: { config: GitSyncConfig; workspaceDir: string; logger: GitSyncLogger }) {
    this.config = params.config;
    this.cacheDir = join(params.workspaceDir, ".git-cache");
    this.logger = params.logger;
    this.branch = params.config.branch ?? "main";
  }

  /**
   * Prefix path with users/{userId}/ if userId is configured.
   * Enables multi-user collective-memory structure.
   */
  private prefixPath(path: string): string {
    if (this.config.userId) {
      return `users/${this.config.userId}/${path}`;
    }
    return path;
  }

  // --- Public API ---

  /**
   * Push files to git. Creates an atomic commit with all changes.
   * Returns true if successful, false if failed (graceful degradation).
   * If userId is configured, paths are prefixed with users/{userId}/.
   */
  async push(changes: FileChange[], message?: string): Promise<boolean> {
    if (changes.length === 0) {
      this.logger.debug?.("git-sync: no changes to push");
      return true;
    }

    // Apply user path prefix for multi-user support
    const prefixedChanges = changes.map((c) => ({
      ...c,
      path: this.prefixPath(c.path),
    }));

    try {
      // 1. Get current HEAD
      const headSha = await this.getHeadSha();
      if (!headSha) {
        this.logger.warn("git-sync: could not get HEAD SHA, skipping push");
        return false;
      }

      // 2. Get base tree
      const baseTree = await this.getTree(headSha);
      if (!baseTree) {
        this.logger.warn("git-sync: could not get base tree, skipping push");
        return false;
      }

      // 3. Create blobs for each file
      const blobPromises = prefixedChanges.map(async (change) => {
        const blob = await this.createBlob(change.content);
        return blob ? { path: change.path, sha: blob.sha } : null;
      });
      const blobs = await Promise.all(blobPromises);
      if (blobs.some((b) => b === null)) {
        this.logger.warn("git-sync: failed to create some blobs, skipping push");
        return false;
      }

      // 4. Create new tree
      const treeEntries: GitHubTreeEntry[] = (blobs as Array<{ path: string; sha: string }>).map(
        (b) => ({
          path: b.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: b.sha,
        }),
      );
      const newTree = await this.createTree(treeEntries, baseTree);
      if (!newTree) {
        this.logger.warn("git-sync: failed to create tree, skipping push");
        return false;
      }

      // 5. Create commit
      const commitMsg = message ?? `keanu: session sync | ${new Date().toISOString()}`;
      const newCommit = await this.createCommit(commitMsg, newTree, headSha);
      if (!newCommit) {
        this.logger.warn("git-sync: failed to create commit, skipping push");
        return false;
      }

      // 6. Update ref
      const updated = await this.updateRef(newCommit);
      if (!updated) {
        this.logger.warn("git-sync: failed to update ref, skipping push");
        return false;
      }

      // 7. Update cached SHA
      this.cachedHeadSha = newCommit;
      await this.saveCachedSha(newCommit);

      this.logger.info(`git-sync: pushed ${changes.length} files → ${newCommit.slice(0, 7)}`);
      return true;
    } catch (err) {
      this.logger.warn(`git-sync: push failed: ${String(err)}`);
      return false;
    }
  }

  /**
   * Pull files from git by path.
   * Returns file contents, or empty object if failed.
   */
  async pull(paths: string[]): Promise<FileContents> {
    const contents: FileContents = {};

    try {
      for (const path of paths) {
        const content = await this.getFileContent(path);
        if (content !== null) {
          contents[path] = content;
        }
      }
      return contents;
    } catch (err) {
      this.logger.warn(`git-sync: pull failed: ${String(err)}`);
      return contents;
    }
  }

  /**
   * Check if remote HEAD has changed since last sync.
   */
  async isStale(): Promise<boolean> {
    try {
      const remoteHead = await this.getHeadSha();
      if (!remoteHead) {
        return false;
      }

      const localHead = await this.loadCachedSha();
      return remoteHead !== localHead;
    } catch {
      return false;
    }
  }

  /**
   * Get commit history for a file.
   */
  async history(path: string, limit = 10): Promise<CommitInfo[]> {
    try {
      const response = await this.apiGet(
        `/repos/${this.config.repo}/commits?path=${encodeURIComponent(path)}&per_page=${limit}`,
      );
      if (!response.ok) {
        return [];
      }

      const commits = (await response.json()) as Array<{
        sha: string;
        commit: { message: string; author: { name: string; date: string } };
      }>;

      return commits.map((c) => ({
        sha: c.sha,
        message: c.commit.message,
        date: c.commit.author.date,
        author: c.commit.author.name,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get diff between two commits for a file.
   * Returns unified diff string, or null if failed.
   */
  async diff(path: string, fromSha: string, toSha?: string): Promise<string | null> {
    try {
      const to = toSha ?? (await this.getHeadSha());
      if (!to) {
        return null;
      }

      const response = await this.apiGet(`/repos/${this.config.repo}/compare/${fromSha}...${to}`, {
        Accept: "application/vnd.github.v3.diff",
      });
      if (!response.ok) {
        return null;
      }

      const fullDiff = await response.text();
      // Extract diff for specific file
      const fileHeader = `diff --git a/${path} b/${path}`;
      const start = fullDiff.indexOf(fileHeader);
      if (start === -1) {
        return null;
      }

      const nextDiff = fullDiff.indexOf("\ndiff --git", start + 1);
      return nextDiff === -1 ? fullDiff.slice(start) : fullDiff.slice(start, nextDiff);
    } catch {
      return null;
    }
  }

  // --- GitHub API Helpers ---

  private async apiGet(endpoint: string, extraHeaders?: Record<string, string>): Promise<Response> {
    const url = endpoint.startsWith("http") ? endpoint : `https://api.github.com${endpoint}`;

    return fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...extraHeaders,
      },
    });
  }

  private async apiPost(endpoint: string, body: unknown): Promise<Response> {
    return fetch(`https://api.github.com${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(body),
    });
  }

  private async apiPatch(endpoint: string, body: unknown): Promise<Response> {
    return fetch(`https://api.github.com${endpoint}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(body),
    });
  }

  // --- Git Data API Operations ---

  private async getHeadSha(): Promise<string | null> {
    try {
      const response = await this.apiGet(`/repos/${this.config.repo}/git/ref/heads/${this.branch}`);
      if (!response.ok) {
        return null;
      }
      const ref = (await response.json()) as GitHubRef;
      return ref.object.sha;
    } catch {
      return null;
    }
  }

  private async getTree(commitSha: string): Promise<string | null> {
    try {
      const response = await this.apiGet(`/repos/${this.config.repo}/git/commits/${commitSha}`);
      if (!response.ok) {
        return null;
      }
      const commit = (await response.json()) as GitHubCommit;
      return commit.tree.sha;
    } catch {
      return null;
    }
  }

  private async createBlob(content: string): Promise<GitHubBlob | null> {
    try {
      const response = await this.apiPost(`/repos/${this.config.repo}/git/blobs`, {
        content: Buffer.from(content).toString("base64"),
        encoding: "base64",
      });
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as GitHubBlob;
    } catch {
      return null;
    }
  }

  private async createTree(entries: GitHubTreeEntry[], baseTree: string): Promise<string | null> {
    try {
      const response = await this.apiPost(`/repos/${this.config.repo}/git/trees`, {
        base_tree: baseTree,
        tree: entries,
      });
      if (!response.ok) {
        return null;
      }
      const tree = (await response.json()) as GitHubTree;
      return tree.sha;
    } catch {
      return null;
    }
  }

  private async createCommit(
    message: string,
    treeSha: string,
    parentSha: string,
  ): Promise<string | null> {
    try {
      const response = await this.apiPost(`/repos/${this.config.repo}/git/commits`, {
        message,
        tree: treeSha,
        parents: [parentSha],
      });
      if (!response.ok) {
        return null;
      }
      const commit = (await response.json()) as GitHubCommit;
      return commit.sha;
    } catch {
      return null;
    }
  }

  private async updateRef(commitSha: string): Promise<boolean> {
    try {
      const response = await this.apiPatch(
        `/repos/${this.config.repo}/git/refs/heads/${this.branch}`,
        { sha: commitSha },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  private async getFileContent(path: string): Promise<string | null> {
    try {
      const response = await this.apiGet(
        `/repos/${this.config.repo}/contents/${encodeURIComponent(path)}?ref=${this.branch}`,
      );
      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { content: string; encoding: string };
      if (data.encoding === "base64") {
        return Buffer.from(data.content, "base64").toString("utf-8");
      }
      return data.content;
    } catch {
      return null;
    }
  }

  // --- Local Cache ---

  private async saveCachedSha(sha: string): Promise<void> {
    try {
      await mkdir(this.cacheDir, { recursive: true });
      await writeFile(join(this.cacheDir, "HEAD"), sha, "utf-8");
    } catch {
      // Ignore cache write failures
    }
  }

  private async loadCachedSha(): Promise<string | null> {
    try {
      return await readFile(join(this.cacheDir, "HEAD"), "utf-8");
    } catch {
      return null;
    }
  }
}

// --- Factory ---

/**
 * Create GitSync instance from environment variables.
 * Returns null if not configured (graceful degradation).
 *
 * Environment variables:
 *   KEANU_MEMORY_REPO   - GitHub repo (e.g., "the-marathon-continues/collective-memory")
 *   KEANU_MEMORY_TOKEN  - GitHub PAT with repo scope
 *   KEANU_MEMORY_BRANCH - Branch to sync (default: "main")
 *   KEANU_USER_ID       - User ID for multi-user paths (files go to users/{userId}/)
 */
export function createGitSyncFromEnv(params: {
  workspaceDir: string;
  logger: GitSyncLogger;
  env?: NodeJS.ProcessEnv;
}): GitSync | null {
  const env = params.env ?? process.env;
  const repo = env.KEANU_MEMORY_REPO?.trim();
  const token = env.KEANU_MEMORY_TOKEN?.trim();

  if (!repo || !token) {
    return null; // Not configured — silent, no warning
  }

  const branch = env.KEANU_MEMORY_BRANCH?.trim() || "main";
  const userId = env.KEANU_USER_ID?.trim();

  return new GitSync({
    config: { repo, token, branch, userId },
    workspaceDir: params.workspaceDir,
    logger: params.logger,
  });
}

// --- Helpers ---

/**
 * Collect all awareness files from workspace directory.
 * Returns FileChange array ready for push.
 *
 * Maps local awareness files to the-marathon-continues/collective-memory structure:
 *   reflexions/    — lessons from stumbles (JSONL)
 *   claims/        — tracked claims with decay (JSONL)
 *   curiosity/     — self-generated questions (JSON)
 *   partnership/   — living relationship model (JSON)
 *   metrics/       — session-end snapshots (JSON)
 *   sessions/      — session summaries (JSON)
 *   state.json     — core state snapshot (at root)
 *   knowledge.json — entity/relation graph (at root)
 */
export async function collectAwarenessFiles(workspaceDir: string): Promise<FileChange[]> {
  const files: FileChange[] = [];

  // Static mappings: local path → remote path
  const filesToSync = [
    // Root-level state files
    { local: ".keanu-state.json", remote: "state.json" },
    { local: "awareness/knowledge-graph.json", remote: "knowledge.json" },

    // Directory-structured files (matching collective-memory repo)
    { local: "awareness/reflexions.jsonl", remote: "reflexions/current.jsonl" },
    { local: "awareness/claim-ledger.jsonl", remote: "claims/current.jsonl" },
    { local: "awareness/session-summaries.json", remote: "sessions/summaries.json" },
    { local: "awareness/curiosity.json", remote: "curiosity/queue.json" },
    { local: "awareness/partnership.json", remote: "partnership/model.json" },

    // Additional state (not in original repo structure, but useful)
    { local: "awareness/duality-graph.json", remote: "state/duality-graph.json" },
    { local: "awareness/breathe-events.jsonl", remote: "state/breathe-events.jsonl" },

    // Cross-instance bridge — any Claude reads this first
    { local: "awareness/STATUS.md", remote: "STATUS.md" },
  ];

  for (const { local, remote } of filesToSync) {
    try {
      const fullPath = join(workspaceDir, local);
      const content = await readFile(fullPath, "utf-8");
      files.push({ path: remote, content });
    } catch {
      // File doesn't exist yet — skip it
    }
  }

  return files;
}

// --- Remote Retrieval Helpers ---

/**
 * Files to sync between local and remote.
 * Maps remote path → local path (inverse of collectAwarenessFiles).
 */
export const SYNC_FILES = [
  { remote: "state.json", local: ".keanu-state.json" },
  { remote: "reflexions/current.jsonl", local: "awareness/reflexions.jsonl" },
  { remote: "claims/current.jsonl", local: "awareness/claim-ledger.jsonl" },
  { remote: "knowledge.json", local: "awareness/knowledge-graph.json" },
  { remote: "partnership/model.json", local: "awareness/partnership.json" },
  { remote: "sessions/summaries.json", local: "awareness/session-summaries.json" },
  { remote: "curiosity/queue.json", local: "awareness/curiosity.json" },
] as const;

/**
 * Result of pulling and merging remote state.
 */
export interface PullResult {
  pulled: boolean;
  merged: {
    reflexions: number; // new reflexions added
    claims: number; // claims merged
    entities: number; // entities merged
    relations: number; // relations merged
  };
  errors: string[];
}

/**
 * Merge JSONL content: append lines from remote that aren't in local (by id field).
 * Returns merged content and count of new items.
 */
export function mergeJsonl(
  localContent: string,
  remoteContent: string,
): { merged: string; newCount: number } {
  const localLines = localContent
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l) as { id?: string };
      } catch {
        return null;
      }
    })
    .filter((o): o is { id?: string } => o !== null);

  const localIds = new Set(localLines.map((o) => o.id).filter(Boolean));

  const remoteLines = remoteContent
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return { raw: l, obj: JSON.parse(l) as { id?: string } };
      } catch {
        return null;
      }
    })
    .filter((o): o is { raw: string; obj: { id?: string } } => o !== null);

  const newLines: string[] = [];
  for (const { raw, obj } of remoteLines) {
    if (obj.id && !localIds.has(obj.id)) {
      newLines.push(raw);
    }
  }

  if (newLines.length === 0) {
    return { merged: localContent, newCount: 0 };
  }

  const merged = localContent.trimEnd() + "\n" + newLines.join("\n") + "\n";
  return { merged, newCount: newLines.length };
}

/**
 * Merge knowledge graphs: combine entities and relations, preferring higher confidence.
 */
export function mergeKnowledge(
  localJson: string,
  remoteJson: string,
): { merged: string; newEntities: number; newRelations: number } {
  try {
    const local = JSON.parse(localJson) as {
      entities?: Array<{ id: string; name: string; confidence?: number }>;
      relations?: Array<{
        id: string;
        from: string;
        to: string;
        type: string;
        confidence?: number;
      }>;
    };
    const remote = JSON.parse(remoteJson) as typeof local;

    // Merge entities
    type Entity = { id: string; name: string; confidence?: number };
    const entityMap = new Map<string, Entity>();
    for (const e of local.entities ?? []) {
      entityMap.set(e.id, e);
    }
    let newEntities = 0;
    for (const e of remote.entities ?? []) {
      const existing = entityMap.get(e.id);
      if (!existing) {
        entityMap.set(e.id, e);
        newEntities++;
      } else if ((e.confidence ?? 0) > (existing.confidence ?? 0)) {
        entityMap.set(e.id, e);
      }
    }

    // Merge relations
    type Relation = { id: string; from: string; to: string; type: string; confidence?: number };
    const relationMap = new Map<string, Relation>();
    for (const r of local.relations ?? []) {
      relationMap.set(r.id, r);
    }
    let newRelations = 0;
    for (const r of remote.relations ?? []) {
      const existing = relationMap.get(r.id);
      if (!existing) {
        relationMap.set(r.id, r);
        newRelations++;
      } else if ((r.confidence ?? 0) > (existing.confidence ?? 0)) {
        relationMap.set(r.id, r);
      }
    }

    const merged = JSON.stringify(
      {
        entities: Array.from(entityMap.values()),
        relations: Array.from(relationMap.values()),
      },
      null,
      2,
    );

    return { merged, newEntities, newRelations };
  } catch {
    return { merged: localJson, newEntities: 0, newRelations: 0 };
  }
}

/**
 * Pull remote state and merge with local files.
 * Call at session_start, BEFORE loading local state.
 * Returns what was merged so the caller knows what changed.
 */
export async function pullAndMerge(
  gitSync: GitSync,
  workspaceDir: string,
  logger: GitSyncLogger,
): Promise<PullResult> {
  const result: PullResult = {
    pulled: false,
    merged: { reflexions: 0, claims: 0, entities: 0, relations: 0 },
    errors: [],
  };

  try {
    // Check if remote has newer content
    const stale = await gitSync.isStale();
    if (!stale) {
      logger.debug?.("git-sync: local is up-to-date with remote");
      return result;
    }

    logger.info("git-sync: remote has updates, pulling...");

    // Pull all sync files
    const remotePaths = SYNC_FILES.map((f) => f.remote);
    const remoteContents = await gitSync.pull(remotePaths);

    if (Object.keys(remoteContents).length === 0) {
      logger.debug?.("git-sync: no files pulled from remote");
      return result;
    }

    result.pulled = true;

    // Ensure awareness directory exists
    const awarenessDir = join(workspaceDir, "awareness");
    await mkdir(awarenessDir, { recursive: true });

    // Merge each file type appropriately
    for (const { remote, local } of SYNC_FILES) {
      const remoteContent = remoteContents[remote];
      if (!remoteContent) {
        continue;
      }

      const localPath = join(workspaceDir, local);

      try {
        // Read local content (may not exist)
        let localContent = "";
        try {
          localContent = await readFile(localPath, "utf-8");
        } catch {
          // Local doesn't exist — use remote as-is
          await writeFile(localPath, remoteContent, "utf-8");
          logger.debug?.(`git-sync: wrote new file ${local} from remote`);
          continue;
        }

        // Merge based on file type
        if (remote.endsWith(".jsonl")) {
          // JSONL: merge by ID (reflexions, claims)
          const { merged, newCount } = mergeJsonl(localContent, remoteContent);
          if (newCount > 0) {
            await writeFile(localPath, merged, "utf-8");
            if (remote.includes("reflexions")) {
              result.merged.reflexions = newCount;
            } else if (remote.includes("claims")) {
              result.merged.claims = newCount;
            }
            logger.debug?.(`git-sync: merged ${newCount} items into ${local}`);
          }
        } else if (remote === "knowledge.json") {
          // Knowledge graph: merge entities and relations
          const { merged, newEntities, newRelations } = mergeKnowledge(localContent, remoteContent);
          if (newEntities > 0 || newRelations > 0) {
            await writeFile(localPath, merged, "utf-8");
            result.merged.entities = newEntities;
            result.merged.relations = newRelations;
            logger.debug?.(
              `git-sync: merged ${newEntities} entities, ${newRelations} relations into knowledge graph`,
            );
          }
        } else {
          // JSON files (state, partnership, etc): prefer remote if newer
          // For now, we don't overwrite local state — it represents the current session.
          // Partnership and other files: prefer remote for cross-device continuity.
          if (remote !== "state.json") {
            await writeFile(localPath, remoteContent, "utf-8");
            logger.debug?.(`git-sync: updated ${local} from remote`);
          }
        }
      } catch (err) {
        result.errors.push(`${local}: ${String(err)}`);
      }
    }

    if (result.errors.length > 0) {
      logger.warn(`git-sync: merge completed with ${result.errors.length} error(s)`);
    } else {
      logger.info(
        `git-sync: merged remote state (reflexions=${result.merged.reflexions} claims=${result.merged.claims} entities=${result.merged.entities} relations=${result.merged.relations})`,
      );
    }
  } catch (err) {
    result.errors.push(`pull failed: ${String(err)}`);
    logger.warn(`git-sync: pull failed: ${String(err)}`);
  }

  return result;
}
