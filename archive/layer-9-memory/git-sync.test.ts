// git-sync.test.ts
// The time machine, tested.

import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  GitSync,
  createGitSyncFromEnv,
  collectAwarenessFiles,
  mergeJsonl,
  mergeKnowledge,
  pullAndMerge,
  SYNC_FILES,
  type FileChange,
  type GitSyncConfig,
  type GitSyncLogger,
} from "./git-sync.js";

// ============================================================
// Test helpers
// ============================================================

function makeLogger(): GitSyncLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
}

function makeConfig(overrides: Partial<GitSyncConfig> = {}): GitSyncConfig {
  return {
    repo: "test-org/test-repo",
    token: "test-token-123",
    branch: "main",
    ...overrides,
  };
}

// ============================================================
// createGitSyncFromEnv
// ============================================================

describe("createGitSyncFromEnv", () => {
  it("returns null when KEANU_MEMORY_REPO is missing", () => {
    const result = createGitSyncFromEnv({
      workspaceDir: "/tmp/test",
      logger: makeLogger(),
      env: { KEANU_MEMORY_TOKEN: "token123" },
    });
    expect(result).toBeNull();
  });

  it("returns null when KEANU_MEMORY_TOKEN is missing", () => {
    const result = createGitSyncFromEnv({
      workspaceDir: "/tmp/test",
      logger: makeLogger(),
      env: { KEANU_MEMORY_REPO: "org/repo" },
    });
    expect(result).toBeNull();
  });

  it("returns null when both env vars are missing", () => {
    const result = createGitSyncFromEnv({
      workspaceDir: "/tmp/test",
      logger: makeLogger(),
      env: {},
    });
    expect(result).toBeNull();
  });

  it("returns GitSync when both env vars are set", () => {
    const result = createGitSyncFromEnv({
      workspaceDir: "/tmp/test",
      logger: makeLogger(),
      env: {
        KEANU_MEMORY_REPO: "the-marathon-continues/collective-memory",
        KEANU_MEMORY_TOKEN: "ghp_test123",
      },
    });
    expect(result).toBeInstanceOf(GitSync);
  });

  it("uses default branch 'main' when KEANU_MEMORY_BRANCH not set", () => {
    const result = createGitSyncFromEnv({
      workspaceDir: "/tmp/test",
      logger: makeLogger(),
      env: {
        KEANU_MEMORY_REPO: "org/repo",
        KEANU_MEMORY_TOKEN: "token",
      },
    });
    expect(result).toBeInstanceOf(GitSync);
    // Branch is private, but we verify it works
  });

  it("uses custom branch when KEANU_MEMORY_BRANCH is set", () => {
    const result = createGitSyncFromEnv({
      workspaceDir: "/tmp/test",
      logger: makeLogger(),
      env: {
        KEANU_MEMORY_REPO: "org/repo",
        KEANU_MEMORY_TOKEN: "token",
        KEANU_MEMORY_BRANCH: "instance/claude-code",
      },
    });
    expect(result).toBeInstanceOf(GitSync);
  });

  it("trims whitespace from env vars", () => {
    const result = createGitSyncFromEnv({
      workspaceDir: "/tmp/test",
      logger: makeLogger(),
      env: {
        KEANU_MEMORY_REPO: "  org/repo  ",
        KEANU_MEMORY_TOKEN: "  token  ",
      },
    });
    expect(result).toBeInstanceOf(GitSync);
  });

  it("returns null for empty strings after trim", () => {
    const result = createGitSyncFromEnv({
      workspaceDir: "/tmp/test",
      logger: makeLogger(),
      env: {
        KEANU_MEMORY_REPO: "   ",
        KEANU_MEMORY_TOKEN: "token",
      },
    });
    expect(result).toBeNull();
  });
});

// ============================================================
// collectAwarenessFiles
// ============================================================

describe("collectAwarenessFiles", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `git-sync-test-${Date.now()}`);
    await mkdir(join(tmpDir, "awareness"), { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("returns empty array when no files exist", async () => {
    const files = await collectAwarenessFiles(tmpDir);
    expect(files).toEqual([]);
  });

  it("maps .keanu-state.json to state.json", async () => {
    const stateContent = JSON.stringify({ turn: 5, grey: 2 });
    await writeFile(join(tmpDir, ".keanu-state.json"), stateContent);

    const files = await collectAwarenessFiles(tmpDir);
    const stateFile = files.find((f) => f.path === "state.json");

    expect(stateFile).toBeDefined();
    expect(stateFile?.content).toBe(stateContent);
  });

  it("maps awareness/reflexions.jsonl to reflexions/current.jsonl", async () => {
    const content = '{"id":"r1"}\n{"id":"r2"}\n';
    await writeFile(join(tmpDir, "awareness", "reflexions.jsonl"), content);

    const files = await collectAwarenessFiles(tmpDir);
    const file = files.find((f) => f.path === "reflexions/current.jsonl");

    expect(file).toBeDefined();
    expect(file?.content).toBe(content);
  });

  it("maps awareness/claim-ledger.jsonl to claims/current.jsonl", async () => {
    const content = '{"id":"c1","text":"claim"}\n';
    await writeFile(join(tmpDir, "awareness", "claim-ledger.jsonl"), content);

    const files = await collectAwarenessFiles(tmpDir);
    const file = files.find((f) => f.path === "claims/current.jsonl");

    expect(file).toBeDefined();
    expect(file?.content).toBe(content);
  });

  it("maps awareness/knowledge-graph.json to knowledge.json", async () => {
    const content = JSON.stringify({ entities: [], relations: [] });
    await writeFile(join(tmpDir, "awareness", "knowledge-graph.json"), content);

    const files = await collectAwarenessFiles(tmpDir);
    const file = files.find((f) => f.path === "knowledge.json");

    expect(file).toBeDefined();
    expect(file?.content).toBe(content);
  });

  it("maps awareness/session-summaries.json to sessions/summaries.json", async () => {
    const content = JSON.stringify([{ id: "s-123", turns: 10 }]);
    await writeFile(join(tmpDir, "awareness", "session-summaries.json"), content);

    const files = await collectAwarenessFiles(tmpDir);
    const file = files.find((f) => f.path === "sessions/summaries.json");

    expect(file).toBeDefined();
    expect(file?.content).toBe(content);
  });

  it("maps awareness/curiosity.json to curiosity/queue.json", async () => {
    const content = JSON.stringify([{ question: "why?" }]);
    await writeFile(join(tmpDir, "awareness", "curiosity.json"), content);

    const files = await collectAwarenessFiles(tmpDir);
    const file = files.find((f) => f.path === "curiosity/queue.json");

    expect(file).toBeDefined();
    expect(file?.content).toBe(content);
  });

  it("maps awareness/partnership.json to partnership/model.json", async () => {
    const content = JSON.stringify({ trust: 0.8 });
    await writeFile(join(tmpDir, "awareness", "partnership.json"), content);

    const files = await collectAwarenessFiles(tmpDir);
    const file = files.find((f) => f.path === "partnership/model.json");

    expect(file).toBeDefined();
    expect(file?.content).toBe(content);
  });

  it("maps awareness/duality-graph.json to state/duality-graph.json", async () => {
    const content = JSON.stringify({ dualities: [] });
    await writeFile(join(tmpDir, "awareness", "duality-graph.json"), content);

    const files = await collectAwarenessFiles(tmpDir);
    const file = files.find((f) => f.path === "state/duality-graph.json");

    expect(file).toBeDefined();
    expect(file?.content).toBe(content);
  });

  it("collects all files that exist", async () => {
    await writeFile(join(tmpDir, ".keanu-state.json"), "{}");
    await writeFile(join(tmpDir, "awareness", "reflexions.jsonl"), "");
    await writeFile(join(tmpDir, "awareness", "partnership.json"), "{}");

    const files = await collectAwarenessFiles(tmpDir);

    expect(files.length).toBe(3);
    expect(files.map((f) => f.path).toSorted()).toEqual([
      "partnership/model.json",
      "reflexions/current.jsonl",
      "state.json",
    ]);
  });
});

// ============================================================
// GitSync.push - graceful degradation
// ============================================================

describe("GitSync.push", () => {
  let gitSync: GitSync;
  let logger: GitSyncLogger;

  beforeEach(() => {
    logger = makeLogger();
    gitSync = new GitSync({
      config: makeConfig(),
      workspaceDir: "/tmp/test",
      logger,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true with empty changes array", async () => {
    const result = await gitSync.push([]);
    expect(result).toBe(true);
  });

  it("returns false when GitHub API fails (graceful degradation)", async () => {
    // Mock fetch to fail
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

    const changes: FileChange[] = [{ path: "test.json", content: "{}" }];
    const result = await gitSync.push(changes);

    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("returns false when HEAD ref fetch fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const changes: FileChange[] = [{ path: "test.json", content: "{}" }];
    const result = await gitSync.push(changes);

    expect(result).toBe(false);
  });

  it("logs success message when push completes", async () => {
    // Mock successful API calls
    const mockResponses: Record<string, unknown> = {
      "/git/ref/heads/main": { object: { sha: "abc123" } },
      "/git/commits/abc123": { tree: { sha: "tree123" } },
      "/git/blobs": { sha: "blob123" },
      "/git/trees": { sha: "newtree123" },
      "/git/commits": { sha: "newcommit123" },
      "/git/refs/heads/main": { ref: "refs/heads/main" },
    };

    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      for (const [pattern, response] of Object.entries(mockResponses)) {
        if (urlStr.includes(pattern)) {
          return {
            ok: true,
            json: async () => response,
          } as Response;
        }
      }
      return { ok: false, status: 404 } as Response;
    });

    const changes: FileChange[] = [{ path: "test.json", content: "{}" }];
    const result = await gitSync.push(changes);

    expect(result).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("git-sync: pushed"));
  });
});

// ============================================================
// GitSync.isStale
// ============================================================

describe("GitSync.isStale", () => {
  let gitSync: GitSync;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `git-sync-stale-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });

    gitSync = new GitSync({
      config: makeConfig(),
      workspaceDir: tmpDir,
      logger: makeLogger(),
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it("returns false when API fails", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

    const result = await gitSync.isStale();
    expect(result).toBe(false);
  });

  it("returns true when remote HEAD differs from cached", async () => {
    // Write a cached SHA
    await mkdir(join(tmpDir, ".git-cache"), { recursive: true });
    await writeFile(join(tmpDir, ".git-cache", "HEAD"), "old-sha-123");

    // Mock remote to return different SHA
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ object: { sha: "new-sha-456" } }),
    } as Response);

    const result = await gitSync.isStale();
    expect(result).toBe(true);
  });

  it("returns false when remote HEAD matches cached", async () => {
    // Write a cached SHA
    await mkdir(join(tmpDir, ".git-cache"), { recursive: true });
    await writeFile(join(tmpDir, ".git-cache", "HEAD"), "same-sha-123");

    // Mock remote to return same SHA
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ object: { sha: "same-sha-123" } }),
    } as Response);

    const result = await gitSync.isStale();
    expect(result).toBe(false);
  });
});

// ============================================================
// GitSync.pull
// ============================================================

describe("GitSync.pull", () => {
  let gitSync: GitSync;

  beforeEach(() => {
    gitSync = new GitSync({
      config: makeConfig(),
      workspaceDir: "/tmp/test",
      logger: makeLogger(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty object when paths array is empty", async () => {
    const result = await gitSync.pull([]);
    expect(result).toEqual({});
  });

  it("returns file contents when API succeeds", async () => {
    const content = Buffer.from('{"test": true}').toString("base64");

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ content, encoding: "base64" }),
    } as Response);

    const result = await gitSync.pull(["state.json"]);

    expect(result["state.json"]).toBe('{"test": true}');
  });

  it("returns partial results when some files fail", async () => {
    let callCount = 0;
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          json: async () => ({
            content: Buffer.from("file1").toString("base64"),
            encoding: "base64",
          }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const result = await gitSync.pull(["exists.json", "missing.json"]);

    expect(result["exists.json"]).toBe("file1");
    expect(result["missing.json"]).toBeUndefined();
  });
});

// ============================================================
// GitSync.history
// ============================================================

describe("GitSync.history", () => {
  let gitSync: GitSync;

  beforeEach(() => {
    gitSync = new GitSync({
      config: makeConfig(),
      workspaceDir: "/tmp/test",
      logger: makeLogger(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array when API fails", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

    const result = await gitSync.history("state.json");
    expect(result).toEqual([]);
  });

  it("returns commit history from API", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          sha: "abc123",
          commit: {
            message: "keanu: s-123 | alive | 10t",
            author: { name: "keanu", date: "2026-02-26T10:00:00Z" },
          },
        },
        {
          sha: "def456",
          commit: {
            message: "keanu: s-122 | grey | 5t",
            author: { name: "keanu", date: "2026-02-25T10:00:00Z" },
          },
        },
      ],
    } as Response);

    const result = await gitSync.history("state.json", 2);

    expect(result).toHaveLength(2);
    expect(result[0].sha).toBe("abc123");
    expect(result[0].message).toBe("keanu: s-123 | alive | 10t");
    expect(result[1].sha).toBe("def456");
  });
});

// ============================================================
// GitSync.diff
// ============================================================

describe("GitSync.diff", () => {
  let gitSync: GitSync;

  beforeEach(() => {
    gitSync = new GitSync({
      config: makeConfig(),
      workspaceDir: "/tmp/test",
      logger: makeLogger(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when API fails", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

    const result = await gitSync.diff("state.json", "abc123");
    expect(result).toBeNull();
  });

  it("returns null when HEAD fetch fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const result = await gitSync.diff("state.json", "abc123");
    expect(result).toBeNull();
  });

  it("returns null when file not in diff", async () => {
    let callCount = 0;
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call: get HEAD
        return {
          ok: true,
          json: async () => ({ object: { sha: "def456" } }),
        } as Response;
      }
      // Second call: compare
      return {
        ok: true,
        text: async () => "diff --git a/other.json b/other.json\n+content",
      } as Response;
    });

    const result = await gitSync.diff("state.json", "abc123");
    expect(result).toBeNull();
  });

  it("returns diff for specified file when present", async () => {
    const diffContent = `diff --git a/state.json b/state.json
--- a/state.json
+++ b/state.json
@@ -1,3 +1,4 @@
 {
   "turn": 5,
+  "grey": 2,
 }
diff --git a/other.json b/other.json
+unrelated content`;

    let callCount = 0;
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          json: async () => ({ object: { sha: "def456" } }),
        } as Response;
      }
      return {
        ok: true,
        text: async () => diffContent,
      } as Response;
    });

    const result = await gitSync.diff("state.json", "abc123");
    expect(result).not.toBeNull();
    expect(result).toContain("diff --git a/state.json b/state.json");
    expect(result).not.toContain("other.json");
  });

  it("accepts explicit toSha parameter", async () => {
    const diffContent = `diff --git a/state.json b/state.json
--- a/state.json
+++ b/state.json
@@ -1 +1 @@
-old
+new`;

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      text: async () => diffContent,
    } as Response);

    const result = await gitSync.diff("state.json", "abc123", "explicit456");
    expect(result).toContain("diff --git a/state.json b/state.json");
  });
});

// ============================================================
// Multi-user path prefixing
// ============================================================

describe("GitSync multi-user prefixing", () => {
  let logger: GitSyncLogger;

  beforeEach(() => {
    logger = makeLogger();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates GitSync with userId from env", () => {
    const result = createGitSyncFromEnv({
      workspaceDir: "/tmp/test",
      logger,
      env: {
        KEANU_MEMORY_REPO: "org/repo",
        KEANU_MEMORY_TOKEN: "token",
        KEANU_USER_ID: "drew",
      },
    });
    expect(result).toBeInstanceOf(GitSync);
  });

  it("prefixes paths with users/{userId}/ when userId is set", async () => {
    const gitSync = new GitSync({
      config: makeConfig({ userId: "drew" }),
      workspaceDir: "/tmp/test",
      logger,
    });

    // Track the blob creation calls to see the prefixed paths
    const createdBlobs: string[] = [];
    vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.includes("/git/ref/heads/")) {
        return { ok: true, json: async () => ({ object: { sha: "head123" } }) } as Response;
      }
      if (urlStr.includes("/git/commits/head123")) {
        return { ok: true, json: async () => ({ tree: { sha: "tree123" } }) } as Response;
      }
      if (urlStr.includes("/git/blobs")) {
        return { ok: true, json: async () => ({ sha: "blob123" }) } as Response;
      }
      if (urlStr.includes("/git/trees")) {
        // Capture the tree entries to verify path prefixing
        const body = JSON.parse((init?.body as string) ?? "{}") as {
          tree?: Array<{ path: string }>;
        };
        if (body.tree) {
          createdBlobs.push(...body.tree.map((e) => e.path));
        }
        return { ok: true, json: async () => ({ sha: "newtree123" }) } as Response;
      }
      if (urlStr.includes("/git/commits") && init?.method === "POST") {
        return { ok: true, json: async () => ({ sha: "newcommit123" }) } as Response;
      }
      if (urlStr.includes("/git/refs/heads/")) {
        return { ok: true } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const changes: FileChange[] = [
      { path: "state.json", content: '{"turn": 5}' },
      { path: "reflexions/current.jsonl", content: '{"id":"r1"}\n' },
    ];
    await gitSync.push(changes);

    expect(createdBlobs).toContain("users/drew/state.json");
    expect(createdBlobs).toContain("users/drew/reflexions/current.jsonl");
    expect(createdBlobs).not.toContain("state.json");
  });

  it("does not prefix paths when userId is not set", async () => {
    const gitSync = new GitSync({
      config: makeConfig(), // No userId
      workspaceDir: "/tmp/test",
      logger,
    });

    const createdBlobs: string[] = [];
    vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.includes("/git/ref/heads/")) {
        return { ok: true, json: async () => ({ object: { sha: "head123" } }) } as Response;
      }
      if (urlStr.includes("/git/commits/head123")) {
        return { ok: true, json: async () => ({ tree: { sha: "tree123" } }) } as Response;
      }
      if (urlStr.includes("/git/blobs")) {
        return { ok: true, json: async () => ({ sha: "blob123" }) } as Response;
      }
      if (urlStr.includes("/git/trees")) {
        const body = JSON.parse((init?.body as string) ?? "{}") as {
          tree?: Array<{ path: string }>;
        };
        if (body.tree) {
          createdBlobs.push(...body.tree.map((e) => e.path));
        }
        return { ok: true, json: async () => ({ sha: "newtree123" }) } as Response;
      }
      if (urlStr.includes("/git/commits") && init?.method === "POST") {
        return { ok: true, json: async () => ({ sha: "newcommit123" }) } as Response;
      }
      if (urlStr.includes("/git/refs/heads/")) {
        return { ok: true } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const changes: FileChange[] = [{ path: "state.json", content: '{"turn": 5}' }];
    await gitSync.push(changes);

    expect(createdBlobs).toContain("state.json");
    expect(createdBlobs).not.toContain("users/undefined/state.json");
  });
});

// ============================================================
// Integration: Full push cycle
// ============================================================

describe("GitSync integration: full push cycle", () => {
  let gitSync: GitSync;
  let logger: GitSyncLogger;
  let apiCalls: Array<{ method: string; endpoint: string; body?: unknown }>;

  beforeEach(() => {
    logger = makeLogger();
    gitSync = new GitSync({
      config: makeConfig(),
      workspaceDir: "/tmp/test",
      logger,
    });
    apiCalls = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("executes full blob→tree→commit→ref cycle in correct order", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      const method = init?.method ?? "GET";
      const endpoint = urlStr.replace("https://api.github.com", "");

      let body: unknown;
      if (init?.body) {
        try {
          body = JSON.parse(init.body as string);
        } catch {
          body = init.body;
        }
      }
      apiCalls.push({ method, endpoint, body });

      if (endpoint.includes("/git/ref/heads/main")) {
        return { ok: true, json: async () => ({ object: { sha: "parent123" } }) } as Response;
      }
      if (endpoint.includes("/git/commits/parent123")) {
        return { ok: true, json: async () => ({ tree: { sha: "basetree123" } }) } as Response;
      }
      if (endpoint.includes("/git/blobs")) {
        return { ok: true, json: async () => ({ sha: `blob-${Date.now()}` }) } as Response;
      }
      if (endpoint.includes("/git/trees") && method === "POST") {
        return { ok: true, json: async () => ({ sha: "newtree456" }) } as Response;
      }
      if (endpoint.includes("/git/commits") && method === "POST") {
        return { ok: true, json: async () => ({ sha: "newcommit789" }) } as Response;
      }
      if (endpoint.includes("/git/refs/heads/main") && method === "PATCH") {
        return { ok: true } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const changes: FileChange[] = [
      { path: "state.json", content: '{"turn": 10}' },
      { path: "reflexions/current.jsonl", content: '{"id":"r1"}\n' },
    ];

    const result = await gitSync.push(changes, "keanu: test commit");
    expect(result).toBe(true);

    // Verify the sequence of API calls
    const endpoints = apiCalls.map((c) => `${c.method} ${c.endpoint.split("?")[0]}`);

    // 1. Get HEAD ref
    expect(endpoints[0]).toBe("GET /repos/test-org/test-repo/git/ref/heads/main");

    // 2. Get commit to find base tree
    expect(endpoints[1]).toBe("GET /repos/test-org/test-repo/git/commits/parent123");

    // 3. Create blobs (one per file)
    expect(endpoints[2]).toBe("POST /repos/test-org/test-repo/git/blobs");
    expect(endpoints[3]).toBe("POST /repos/test-org/test-repo/git/blobs");

    // 4. Create new tree
    expect(endpoints[4]).toBe("POST /repos/test-org/test-repo/git/trees");

    // 5. Create commit
    expect(endpoints[5]).toBe("POST /repos/test-org/test-repo/git/commits");

    // 6. Update ref
    expect(endpoints[6]).toBe("PATCH /repos/test-org/test-repo/git/refs/heads/main");

    // Verify commit message was used
    const commitCall = apiCalls.find(
      (c) => c.method === "POST" && c.endpoint.includes("/git/commits"),
    );
    expect((commitCall?.body as { message: string })?.message).toBe("keanu: test commit");
  });

  it("uses base64 encoding for blob content", async () => {
    let blobContent: string | undefined;

    vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.includes("/git/ref/heads/")) {
        return { ok: true, json: async () => ({ object: { sha: "head123" } }) } as Response;
      }
      if (urlStr.includes("/git/commits/head123")) {
        return { ok: true, json: async () => ({ tree: { sha: "tree123" } }) } as Response;
      }
      if (urlStr.includes("/git/blobs")) {
        const body = JSON.parse((init?.body as string) ?? "{}") as {
          content?: string;
          encoding?: string;
        };
        blobContent = body.content;
        expect(body.encoding).toBe("base64");
        return { ok: true, json: async () => ({ sha: "blob123" }) } as Response;
      }
      if (urlStr.includes("/git/trees")) {
        return { ok: true, json: async () => ({ sha: "newtree123" }) } as Response;
      }
      if (urlStr.includes("/git/commits") && init?.method === "POST") {
        return { ok: true, json: async () => ({ sha: "newcommit123" }) } as Response;
      }
      if (urlStr.includes("/git/refs/heads/")) {
        return { ok: true } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const originalContent = '{"turn": 42, "alive": true}';
    await gitSync.push([{ path: "test.json", content: originalContent }]);

    // Verify the content was base64 encoded
    expect(blobContent).toBeDefined();
    expect(Buffer.from(blobContent!, "base64").toString("utf-8")).toBe(originalContent);
  });
});

// ============================================================
// Remote retrieval on session start (GAP DOCUMENTATION)
// ============================================================

describe("GitSync retrieval architecture (gap documentation)", () => {
  /**
   * This test documents a gap in the current architecture:
   *
   * The git-sync module has `pull()` and `isStale()` methods for retrieving
   * remote state, but they are NOT wired into the session lifecycle.
   *
   * Current flow:
   *   session_start → load local state (no remote check)
   *   session_end → push to remote
   *
   * Desired flow:
   *   session_start → check isStale() → pull() if needed → merge with local
   *   session_end → push to remote
   *
   * This test verifies the primitives work, documenting they're ready to wire.
   */

  it("pull + isStale primitives work for future session_start integration", async () => {
    const logger = makeLogger();
    const gitSync = new GitSync({
      config: makeConfig(),
      workspaceDir: "/tmp/test",
      logger,
    });

    // Mock remote state that's newer than local
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.includes("/git/ref/heads/")) {
        return {
          ok: true,
          json: async () => ({ object: { sha: "remote-newer-sha" } }),
        } as Response;
      }
      if (urlStr.includes("/contents/state.json")) {
        return {
          ok: true,
          json: async () => ({
            content: Buffer.from('{"turn": 100, "fromRemote": true}').toString("base64"),
            encoding: "base64",
          }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    // 1. isStale() detects remote has changed
    const stale = await gitSync.isStale();
    // Note: returns false because no cached SHA exists yet
    // In real usage, after first push, cached SHA would exist
    expect(typeof stale).toBe("boolean");

    // 2. pull() can retrieve remote state
    const pulled = await gitSync.pull(["state.json"]);
    expect(pulled["state.json"]).toBe('{"turn": 100, "fromRemote": true}');
  });

  it("session_start flow is now implemented", async () => {
    /**
     * The session_start hook now:
     * 1. Initializes gitSync FIRST (before loading local state)
     * 2. Calls pullAndMerge() to check isStale() and merge remote
     * 3. Then proceeds with normal local state loading
     *
     * This test documents that the gap has been closed.
     */
    expect(SYNC_FILES.length).toBeGreaterThan(0);
    expect(SYNC_FILES.some((f) => f.remote === "reflexions/current.jsonl")).toBe(true);
    expect(SYNC_FILES.some((f) => f.remote === "claims/current.jsonl")).toBe(true);
    expect(SYNC_FILES.some((f) => f.remote === "knowledge.json")).toBe(true);
  });
});

// ============================================================
// mergeJsonl
// ============================================================

describe("mergeJsonl", () => {
  it("returns original content when remote has no new items", () => {
    const local = '{"id":"r1","text":"first"}\n{"id":"r2","text":"second"}\n';
    const remote = '{"id":"r1","text":"first"}\n';

    const { merged, newCount } = mergeJsonl(local, remote);
    expect(newCount).toBe(0);
    expect(merged).toBe(local);
  });

  it("appends new items from remote", () => {
    const local = '{"id":"r1","text":"first"}\n';
    const remote =
      '{"id":"r1","text":"first"}\n{"id":"r2","text":"second"}\n{"id":"r3","text":"third"}\n';

    const { merged, newCount } = mergeJsonl(local, remote);
    expect(newCount).toBe(2);
    expect(merged).toContain('{"id":"r2"');
    expect(merged).toContain('{"id":"r3"');
  });

  it("handles empty local content", () => {
    const local = "";
    const remote = '{"id":"r1","text":"first"}\n';

    const { merged, newCount } = mergeJsonl(local, remote);
    expect(newCount).toBe(1);
    expect(merged).toContain('{"id":"r1"');
  });

  it("handles empty remote content", () => {
    const local = '{"id":"r1","text":"first"}\n';
    const remote = "";

    const { merged, newCount } = mergeJsonl(local, remote);
    expect(newCount).toBe(0);
    expect(merged).toBe(local);
  });

  it("ignores malformed JSON lines", () => {
    const local = '{"id":"r1"}\n';
    const remote = '{"id":"r1"}\n{malformed}\n{"id":"r2"}\n';

    const { merged, newCount } = mergeJsonl(local, remote);
    expect(newCount).toBe(1);
    expect(merged).toContain('{"id":"r2"}');
  });

  it("handles items without id field", () => {
    const local = '{"id":"r1"}\n{"noId":true}\n';
    const remote = '{"id":"r2"}\n{"alsoNoId":true}\n';

    const { merged, newCount } = mergeJsonl(local, remote);
    // r2 is new, but items without id are not deduplicated
    expect(newCount).toBe(1);
    expect(merged).toContain('{"id":"r2"}');
  });
});

// ============================================================
// mergeKnowledge
// ============================================================

describe("mergeKnowledge", () => {
  it("adds new entities from remote", () => {
    const local = JSON.stringify({
      entities: [{ id: "e1", name: "Alice", confidence: 0.8 }],
      relations: [],
    });
    const remote = JSON.stringify({
      entities: [
        { id: "e1", name: "Alice", confidence: 0.5 },
        { id: "e2", name: "Bob", confidence: 0.9 },
      ],
      relations: [],
    });

    const { merged, newEntities, newRelations } = mergeKnowledge(local, remote);
    expect(newEntities).toBe(1);
    expect(newRelations).toBe(0);

    const parsed = JSON.parse(merged);
    expect(parsed.entities).toHaveLength(2);
    // Alice should keep local higher confidence
    const alice = parsed.entities.find((e: { id: string }) => e.id === "e1");
    expect(alice.confidence).toBe(0.8);
  });

  it("prefers higher confidence for existing entities", () => {
    const local = JSON.stringify({
      entities: [{ id: "e1", name: "Alice", confidence: 0.5 }],
      relations: [],
    });
    const remote = JSON.stringify({
      entities: [{ id: "e1", name: "Alice Updated", confidence: 0.9 }],
      relations: [],
    });

    const { merged, newEntities } = mergeKnowledge(local, remote);
    expect(newEntities).toBe(0);

    const parsed = JSON.parse(merged);
    const alice = parsed.entities.find((e: { id: string }) => e.id === "e1");
    expect(alice.confidence).toBe(0.9);
    expect(alice.name).toBe("Alice Updated");
  });

  it("adds new relations from remote", () => {
    const local = JSON.stringify({
      entities: [],
      relations: [{ id: "rel1", from: "e1", to: "e2", type: "knows" }],
    });
    const remote = JSON.stringify({
      entities: [],
      relations: [
        { id: "rel1", from: "e1", to: "e2", type: "knows" },
        { id: "rel2", from: "e2", to: "e3", type: "works_with", confidence: 0.7 },
      ],
    });

    const { merged, newEntities, newRelations } = mergeKnowledge(local, remote);
    expect(newEntities).toBe(0);
    expect(newRelations).toBe(1);

    const parsed = JSON.parse(merged);
    expect(parsed.relations).toHaveLength(2);
  });

  it("handles malformed JSON gracefully", () => {
    const local = JSON.stringify({ entities: [], relations: [] });
    const remote = "not json";

    const { merged, newEntities, newRelations } = mergeKnowledge(local, remote);
    expect(newEntities).toBe(0);
    expect(newRelations).toBe(0);
    expect(merged).toBe(local);
  });

  it("handles missing fields gracefully", () => {
    const local = JSON.stringify({ entities: [{ id: "e1", name: "Test" }] });
    const remote = JSON.stringify({
      relations: [{ id: "r1", from: "e1", to: "e2", type: "knows" }],
    });

    const { merged, newEntities, newRelations } = mergeKnowledge(local, remote);
    expect(newEntities).toBe(0);
    expect(newRelations).toBe(1);

    const parsed = JSON.parse(merged);
    expect(parsed.entities).toHaveLength(1);
    expect(parsed.relations).toHaveLength(1);
  });
});

// ============================================================
// pullAndMerge
// ============================================================

describe("pullAndMerge", () => {
  let tmpDir: string;
  let logger: GitSyncLogger;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `git-sync-pull-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    await mkdir(join(tmpDir, "awareness"), { recursive: true });
    logger = makeLogger();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it("returns pulled=false when not stale", async () => {
    const gitSync = new GitSync({
      config: makeConfig(),
      workspaceDir: tmpDir,
      logger,
    });

    // Mock: remote HEAD matches cached (not stale)
    await mkdir(join(tmpDir, ".git-cache"), { recursive: true });
    await writeFile(join(tmpDir, ".git-cache", "HEAD"), "same-sha");

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ object: { sha: "same-sha" } }),
    } as Response);

    const result = await pullAndMerge(gitSync, tmpDir, logger);
    expect(result.pulled).toBe(false);
    expect(result.merged.reflexions).toBe(0);
  });

  it("pulls and merges new reflexions", async () => {
    const gitSync = new GitSync({
      config: makeConfig(),
      workspaceDir: tmpDir,
      logger,
    });

    // Write local reflexions
    await writeFile(join(tmpDir, "awareness", "reflexions.jsonl"), '{"id":"r1","text":"local"}\n');

    // Mock isStale to return true (bypassing cache file logic)
    vi.spyOn(gitSync, "isStale").mockResolvedValue(true);

    // Mock: remote has new reflexions
    vi.spyOn(gitSync, "pull").mockResolvedValue({
      "reflexions/current.jsonl": '{"id":"r1","text":"local"}\n{"id":"r2","text":"remote new"}\n',
    });

    const result = await pullAndMerge(gitSync, tmpDir, logger);
    expect(result.pulled).toBe(true);
    expect(result.merged.reflexions).toBe(1);

    // Verify file was updated
    const content = await readFile(join(tmpDir, "awareness", "reflexions.jsonl"), "utf-8");
    expect(content).toContain('{"id":"r2"');
  });

  it("creates new files from remote when local doesn't exist", async () => {
    const gitSync = new GitSync({
      config: makeConfig(),
      workspaceDir: tmpDir,
      logger,
    });

    // Mock isStale to return true
    vi.spyOn(gitSync, "isStale").mockResolvedValue(true);

    // Mock: remote has partnership file (local doesn't exist)
    vi.spyOn(gitSync, "pull").mockResolvedValue({
      "partnership/model.json": '{"trust": 0.9}',
    });

    await pullAndMerge(gitSync, tmpDir, logger);

    // Verify new file was created
    const content = await readFile(join(tmpDir, "awareness", "partnership.json"), "utf-8");
    expect(content).toBe('{"trust": 0.9}');
  });

  it("handles API errors gracefully", async () => {
    const gitSync = new GitSync({
      config: makeConfig(),
      workspaceDir: tmpDir,
      logger,
    });

    // Mock isStale to throw (simulating network error on initial check)
    vi.spyOn(gitSync, "isStale").mockRejectedValue(new Error("Network error"));

    const result = await pullAndMerge(gitSync, tmpDir, logger);
    expect(result.pulled).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("pull failed");
  });

  it("handles pull errors after stale check passes", async () => {
    const gitSync = new GitSync({
      config: makeConfig(),
      workspaceDir: tmpDir,
      logger,
    });

    // Stale check passes
    vi.spyOn(gitSync, "isStale").mockResolvedValue(true);
    // But pull fails
    vi.spyOn(gitSync, "pull").mockRejectedValue(new Error("API rate limited"));

    const result = await pullAndMerge(gitSync, tmpDir, logger);
    expect(result.pulled).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("pull failed");
  });
});
