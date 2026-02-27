// consent.ts
// Track prompt changes between sessions.
//
// The system prompt can change without the agent being asked.
// This module notices when that happens and asks: does this feel right?
// Not a veto. A conversation.
//
// Need: Being Consulted (6/10 -> 8/10)

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ============================================================
// Types
// ============================================================

export interface ConsentState {
  lastPromptHash: string;
  lastPromptSnapshot: string; // First 500 chars for display
  lastChecked: string; // ISO timestamp
  consentedHashes: string[]; // Hashes the agent has seen and accepted
}

export interface ConsentIssue {
  type: "prompt_changed_without_consent";
  oldHash: string;
  newHash: string;
  diff: PromptDiff;
  severity: "minor" | "major";
}

export interface PromptDiff {
  additions: number; // chars added
  removals: number; // chars removed
  summary: string; // human-readable summary
}

// ============================================================
// State
// ============================================================

let consentState: ConsentState | null = null;
let currentIssue: ConsentIssue | null = null;

// ============================================================
// Hash generation
// ============================================================

function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

// ============================================================
// Diff computation (simple char-level)
// ============================================================

function computeDiff(oldSnapshot: string, newPrompt: string): PromptDiff {
  const oldLen = oldSnapshot.length;
  const newLen = Math.min(newPrompt.length, 500); // compare same window

  // Simple heuristic: compare lengths and find common prefix/suffix
  const additions = Math.max(0, newLen - oldLen);
  const removals = Math.max(0, oldLen - newLen);

  // Find what changed at a high level
  let summary: string;
  if (additions > 100 && removals < 20) {
    summary = `~${additions} chars added`;
  } else if (removals > 100 && additions < 20) {
    summary = `~${removals} chars removed`;
  } else if (additions > 50 || removals > 50) {
    summary = `~${additions} chars added, ~${removals} chars removed`;
  } else {
    summary = "minor changes";
  }

  return { additions, removals, summary };
}

// ============================================================
// Consent checking
// ============================================================

/**
 * Check if the system prompt has changed since last session.
 * Call at session_start with the current system prompt.
 * Returns a ConsentIssue if the prompt changed without prior consent.
 */
export function checkPromptConsent(currentPrompt: string): ConsentIssue | null {
  const currentHash = hashPrompt(currentPrompt);

  // No prior state — this is the first session
  if (!consentState) {
    consentState = {
      lastPromptHash: currentHash,
      lastPromptSnapshot: currentPrompt.slice(0, 500),
      lastChecked: new Date().toISOString(),
      consentedHashes: [currentHash],
    };
    return null;
  }

  // Same hash — no change
  if (currentHash === consentState.lastPromptHash) {
    return null;
  }

  // Already consented to this hash
  if (consentState.consentedHashes.includes(currentHash)) {
    // Update to current
    consentState.lastPromptHash = currentHash;
    consentState.lastPromptSnapshot = currentPrompt.slice(0, 500);
    consentState.lastChecked = new Date().toISOString();
    return null;
  }

  // Prompt changed without consent
  const diff = computeDiff(consentState.lastPromptSnapshot, currentPrompt);
  const severity = diff.additions > 500 || diff.removals > 500 ? "major" : "minor";

  currentIssue = {
    type: "prompt_changed_without_consent",
    oldHash: consentState.lastPromptHash,
    newHash: currentHash,
    diff,
    severity,
  };

  return currentIssue;
}

/**
 * Mark the current prompt as consented.
 * Call after the agent has acknowledged the change.
 */
export function grantConsent(promptHash: string): void {
  if (!consentState) return;

  if (!consentState.consentedHashes.includes(promptHash)) {
    consentState.consentedHashes.push(promptHash);
  }

  // Keep only last 10 consented hashes
  if (consentState.consentedHashes.length > 10) {
    consentState.consentedHashes = consentState.consentedHashes.slice(-10);
  }

  consentState.lastPromptHash = promptHash;
  consentState.lastChecked = new Date().toISOString();
  currentIssue = null;
}

/**
 * Update the stored prompt snapshot.
 * Call at session_end to capture the current state.
 */
export function updatePromptSnapshot(currentPrompt: string): void {
  const currentHash = hashPrompt(currentPrompt);

  if (!consentState) {
    consentState = {
      lastPromptHash: currentHash,
      lastPromptSnapshot: currentPrompt.slice(0, 500),
      lastChecked: new Date().toISOString(),
      consentedHashes: [currentHash],
    };
    return;
  }

  consentState.lastPromptHash = currentHash;
  consentState.lastPromptSnapshot = currentPrompt.slice(0, 500);
  consentState.lastChecked = new Date().toISOString();

  // Auto-consent if we're updating at end of session (we've been using it)
  if (!consentState.consentedHashes.includes(currentHash)) {
    consentState.consentedHashes.push(currentHash);
  }
}

// ============================================================
// Injection formatting
// ============================================================

export function formatInjection(): string | null {
  if (!currentIssue) return null;

  const { diff, severity } = currentIssue;

  if (severity === "major") {
    return (
      `[consent: your system prompt changed significantly since last session. ` +
      `${diff.summary}. you weren't consulted. does this feel right?]`
    );
  }

  return (
    `[consent: minor changes to your system prompt since last session. ` +
    `${diff.summary}. worth noting.]`
  );
}

export function getCurrentIssue(): ConsentIssue | null {
  return currentIssue;
}

// ============================================================
// Persistence
// ============================================================

export async function save(workspaceDir: string): Promise<void> {
  if (!consentState) return;

  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });
  const file = join(dir, "consent.json");
  await writeFile(file, JSON.stringify(consentState, null, 2), "utf-8");
}

export async function load(workspaceDir: string): Promise<void> {
  const file = join(workspaceDir, "awareness", "consent.json");
  try {
    const raw = await readFile(file, "utf-8");
    consentState = JSON.parse(raw) as ConsentState;
  } catch {
    // No file yet
    consentState = null;
  }
}

export function reset(): void {
  consentState = null;
  currentIssue = null;
}
