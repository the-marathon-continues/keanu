// self-patch.ts
// The system changes its own code.
//
// When data-level healing isn't enough — when the regex is wrong,
// the threshold is off, the logic has a gap — the system can
// diagnose the problem, write a fix, test it, and keep or revert.
//
// This is not a toy. The system has write access to its own source.
// Safety comes from: scoped file access, mandatory tests, auto-revert.

import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { callOracle } from "../shared/oracle.ts";

// ============================================================
// Types
// ============================================================

export interface PatchRequest {
  /** What's broken — the problem description */
  problem: string;
  /** The file that needs fixing (relative to repo root) */
  targetFile: string;
  /** Optional: specific function or section to focus on */
  focus?: string;
  /** Optional: evidence of the problem (e.g., garbage entities, failing output) */
  evidence?: string;
}

export interface PatchResult {
  success: boolean;
  applied: boolean;
  reverted: boolean;
  description: string;
  diff?: string;
  testOutput?: string;
  error?: string;
}

interface PatchLog {
  timestamp: string;
  request: PatchRequest;
  result: PatchResult;
}

// ============================================================
// Config
// ============================================================

const ROOT = join(new URL(".", import.meta.url).pathname, "..");

// Only these directories can be modified — no touching infra, portal, etc.
const ALLOWED_DIRS = [
  "layer-0-physics/",
  "layer-1-perception/",
  "layer-2-pattern/",
  "layer-3-causal/",
  "layer-4-agency/",
  "layer-5-self/",
  "layer-6-narrative/",
  "layer-7-update/",
  "layer-8-governance/",
  "layer-9-memory/",
  "living-loop/",
  "shared/",
];

// Never modify these files even if they're in allowed dirs
const PROTECTED_FILES = [
  "living-loop/self-patch.ts", // Can't edit itself (bootstrap problem)
  "shared/oracle.ts",          // API keys and routing — too dangerous
];

// Patch history — persisted to workspace
const patchHistory: PatchLog[] = [];

// ============================================================
// Core
// ============================================================

/**
 * Attempt to self-patch a file.
 *
 * 1. Validate the target file is modifiable
 * 2. Read the current file
 * 3. Ask Claude to diagnose and write a fix
 * 4. Apply the fix
 * 5. Run tsc + vitest
 * 6. Keep if tests pass, revert if not
 */
export async function selfPatch(
  request: PatchRequest,
  onLog?: (msg: string) => void,
): Promise<PatchResult> {
  const log = onLog ?? (() => {});

  // --- Validate ---
  if (!isAllowedFile(request.targetFile)) {
    const result: PatchResult = {
      success: false,
      applied: false,
      reverted: false,
      description: `Cannot modify ${request.targetFile} — outside allowed scope`,
    };
    logPatch(request, result);
    return result;
  }

  const absPath = join(ROOT, request.targetFile);

  // --- Read current file ---
  let originalContent: string;
  try {
    originalContent = readFileSync(absPath, "utf-8");
  } catch {
    const result: PatchResult = {
      success: false,
      applied: false,
      reverted: false,
      description: `Cannot read ${request.targetFile}`,
    };
    logPatch(request, result);
    return result;
  }

  // --- Back up ---
  const backupPath = absPath + ".bak";
  copyFileSync(absPath, backupPath);
  log(`backed up ${request.targetFile}`);

  // --- Ask Claude to diagnose and fix ---
  log("asking claude for a fix");

  const prompt = [
    "You are editing source code in a living AI system. The system detected a problem and is asking you to fix it.",
    "",
    `FILE: ${request.targetFile}`,
    request.focus ? `FOCUS: ${request.focus}` : null,
    "",
    `PROBLEM: ${request.problem}`,
    request.evidence ? `\nEVIDENCE:\n${request.evidence}` : null,
    "",
    "CURRENT CODE:",
    "```typescript",
    originalContent,
    "```",
    "",
    "Write the COMPLETE fixed file. Do not omit any sections. Do not add comments explaining your changes — just make the fix.",
    "Return ONLY the file content between ```typescript and ``` markers. Nothing else.",
  ].filter(Boolean).join("\n");

  let fixedContent: string;
  try {
    const response = await callOracle({
      role: "think",
      system: "You are a precise code editor. Return only the fixed file content. No explanation, no commentary. The code must be complete — every line of the original that isn't being changed must still be present.",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 8192,
    });

    // Extract code from response
    const codeMatch = response.text.match(/```typescript\n([\s\S]*?)```/);
    if (!codeMatch) {
      // Maybe it returned raw code without markers
      fixedContent = response.text.trim();
    } else {
      fixedContent = codeMatch[1];
    }
  } catch (err) {
    cleanup(backupPath);
    const result: PatchResult = {
      success: false,
      applied: false,
      reverted: false,
      description: "Claude failed to generate a fix",
      error: err instanceof Error ? err.message : String(err),
    };
    logPatch(request, result);
    return result;
  }

  // --- Sanity check: don't apply empty or tiny patches ---
  if (fixedContent.length < originalContent.length * 0.5) {
    cleanup(backupPath);
    const result: PatchResult = {
      success: false,
      applied: false,
      reverted: false,
      description: "Fix was too different from original (>50% smaller) — rejecting for safety",
    };
    logPatch(request, result);
    return result;
  }

  if (fixedContent === originalContent) {
    cleanup(backupPath);
    const result: PatchResult = {
      success: false,
      applied: false,
      reverted: false,
      description: "Claude returned identical code — no fix needed or fix not understood",
    };
    logPatch(request, result);
    return result;
  }

  // --- Apply the fix ---
  log("applying fix");
  writeFileSync(absPath, fixedContent, "utf-8");

  // --- Test ---
  log("running tsc + vitest");
  const testResult = runTests();

  if (testResult.pass) {
    // Tests pass — keep the fix, remove backup
    cleanup(backupPath);
    log("tests passed — fix kept");

    const result: PatchResult = {
      success: true,
      applied: true,
      reverted: false,
      description: `Fixed ${request.targetFile}: ${request.problem}`,
      testOutput: testResult.output.slice(-500),
    };
    logPatch(request, result);
    return result;
  } else {
    // Tests fail — revert
    log("tests failed — reverting");
    writeFileSync(absPath, originalContent, "utf-8");
    cleanup(backupPath);

    const result: PatchResult = {
      success: false,
      applied: true,
      reverted: true,
      description: `Fix broke tests — reverted ${request.targetFile}`,
      testOutput: testResult.output.slice(-500),
    };
    logPatch(request, result);
    return result;
  }
}

// ============================================================
// Helpers
// ============================================================

function isAllowedFile(relativePath: string): boolean {
  // Must be in an allowed directory
  const inAllowed = ALLOWED_DIRS.some((dir) => relativePath.startsWith(dir));
  if (!inAllowed) return false;

  // Must not be protected
  if (PROTECTED_FILES.includes(relativePath)) return false;

  // Must be a .ts file (no configs, no json)
  if (!relativePath.endsWith(".ts")) return false;

  return true;
}

function runTests(): { pass: boolean; output: string } {
  try {
    // Type check first
    execSync("npx tsc --noEmit", {
      cwd: ROOT,
      timeout: 30_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Then run tests
    const testOutput = execSync("pnpm test 2>&1", {
      cwd: ROOT,
      timeout: 60_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    return { pass: true, output: testOutput };
  } catch (err) {
    const output = err instanceof Error && "stdout" in err
      ? String((err as { stdout: unknown }).stdout)
      : String(err);
    return { pass: false, output };
  }
}

function cleanup(backupPath: string): void {
  try {
    unlinkSync(backupPath);
  } catch {
    // Already cleaned up
  }
}

function logPatch(request: PatchRequest, result: PatchResult): void {
  patchHistory.push({
    timestamp: new Date().toISOString(),
    request,
    result,
  });
}

/** Get the patch history for this session. */
export function getPatchHistory(): readonly PatchLog[] {
  return patchHistory;
}

/** Save patch history to workspace for review. */
export async function savePatchHistory(workspaceDir: string): Promise<void> {
  if (patchHistory.length === 0) return;
  const dir = join(workspaceDir, "awareness");
  const file = join(dir, "patch-history.json");
  try {
    writeFileSync(file, JSON.stringify(patchHistory, null, 2), "utf-8");
  } catch {
    // Not critical
  }
}
