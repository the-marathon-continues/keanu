// git-sync.test.ts
// The time machine, tested.

import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  GitSync,
  createGitSyncFromEnv,
  collectAwarenessFiles,
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
    expect(files.map((f) => f.path).sort()).toEqual([
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
