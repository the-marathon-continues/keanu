// belief-updater.ts
// Active belief revision — the layer that makes everything else trustworthy.
//
// silverado.ts tracks claims. This module tracks *changes* to those claims.
// When confidence decays, when contradictions surface, when you change your
// mind — this is where the record lives.
//
// Not a court. A journal that asks: "You wrote this. Still believe it?"

import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getAllClaims, staleClaims, decayAll } from "../layer-3-causal/silverado.js";
import type { TrackedClaim } from "../shared/types.js";

// ============================================================
// Types
// ============================================================

export type RevisionReason =
  | "decay" // confidence dropped from time
  | "evidence" // new evidence changed the picture
  | "contradiction" // conflicted with another claim
  | "retraction" // explicitly took it back
  | "verification"; // confirmed still true

export interface BeliefRevision {
  id: string;
  claimId: string;
  claimText: string;
  oldConfidence: number;
  newConfidence: number;
  reason: RevisionReason;
  evidence?: string; // what caused the change
  timestamp: string;
  session: string;
}

export interface BeliefReviewRequest {
  claimId: string;
  claimText: string;
  originalConfidence: number;
  currentConfidence: number;
  daysSinceCreated: number;
  daysSinceMentioned: number;
  question: string; // "still true?" formatted
}

// ============================================================
// State
// ============================================================

const _revisions: BeliefRevision[] = [];
const _reviewQueue: BeliefReviewRequest[] = [];
const MAX_REVISIONS = 100;
let _currentSession = "";
let _lastDecaySnapshot: Map<string, number> = new Map(); // claimId -> confidence before decay

// ============================================================
// Core API
// ============================================================

/**
 * Record a belief revision. Called when confidence changes for any reason.
 */
export function recordRevision(
  claimId: string,
  claimText: string,
  oldConfidence: number,
  newConfidence: number,
  reason: RevisionReason,
  evidence?: string,
): BeliefRevision {
  const revision: BeliefRevision = {
    id: randomUUID(),
    claimId,
    claimText,
    oldConfidence,
    newConfidence,
    reason,
    evidence,
    timestamp: new Date().toISOString(),
    session: _currentSession,
  };

  _revisions.push(revision);

  // Rolling window
  if (_revisions.length > MAX_REVISIONS) {
    _revisions.splice(0, _revisions.length - MAX_REVISIONS);
  }

  return revision;
}

/**
 * Get revision history, optionally filtered by claim.
 */
export function getRevisionHistory(claimId?: string): BeliefRevision[] {
  if (claimId) {
    return _revisions.filter((r) => r.claimId === claimId);
  }
  return [..._revisions];
}

/**
 * Get revisions from a specific session.
 */
export function getRevisionsInSession(sessionId: string): BeliefRevision[] {
  return _revisions.filter((r) => r.session === sessionId);
}

/**
 * Get recent revisions (last N).
 */
export function getRecentRevisions(limit = 5): BeliefRevision[] {
  return _revisions.slice(-limit);
}

// ============================================================
// Active Review
// ============================================================

/**
 * Generate review requests for claims that need attention.
 * These are stale claims that haven't been reviewed recently.
 */
export function generateReviewRequests(limit = 3): BeliefReviewRequest[] {
  const stale = staleClaims();
  const now = new Date();

  const requests: BeliefReviewRequest[] = stale.slice(0, limit).map((claim) => {
    const created = claim.createdAt ? new Date(claim.createdAt) : now;
    const mentioned = claim.lastMentioned ? new Date(claim.lastMentioned) : created;

    const daysSinceCreated = Math.floor(
      (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysSinceMentioned = Math.floor(
      (now.getTime() - mentioned.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      claimId: claim.id,
      claimText: claim.text,
      originalConfidence: claim.confidence,
      currentConfidence: claim.decayedConfidence,
      daysSinceCreated,
      daysSinceMentioned,
      question: formatReviewQuestion(claim, daysSinceMentioned),
    };
  });

  // Update queue
  _reviewQueue.length = 0;
  _reviewQueue.push(...requests);

  return requests;
}

function formatReviewQuestion(claim: TrackedClaim, daysSince: number): string {
  const timePhrase =
    daysSince === 0 ? "today" : daysSince === 1 ? "yesterday" : `${daysSince} days ago`;

  return (
    `"${claim.text.slice(0, 60)}${claim.text.length > 60 ? "..." : ""}" ` +
    `(conf ${claim.confidence}→${claim.decayedConfidence}, last touched ${timePhrase}). ` +
    `still true?`
  );
}

/**
 * Get pending review requests.
 */
export function getPendingReviews(): BeliefReviewRequest[] {
  return [..._reviewQueue];
}

// ============================================================
// Injection Formatting
// ============================================================

/**
 * Format for before_prompt_build injection.
 * Returns null if nothing to surface.
 */
export function formatInjection(): string | null {
  const parts: string[] = [];

  // Recent revisions (things that changed)
  const recent = getRevisionsInSession(_currentSession);
  if (recent.length > 0) {
    const last = recent[recent.length - 1];
    parts.push(
      `revised: "${last.claimText.slice(0, 50)}" ` +
        `(${last.oldConfidence}→${last.newConfidence}, ${last.reason})`,
    );
  }

  // Pending review (stale beliefs)
  const reviews = _reviewQueue.slice(0, 1);
  if (reviews.length > 0) {
    const r = reviews[0];
    parts.push(r.question);
  }

  if (parts.length === 0) {
    return null;
  }

  return `[belief-review: ${parts.join(" | ")}]`;
}

// ============================================================
// Hooks Integration
// ============================================================

/**
 * Called at session_start.
 * Loads history, runs decay, identifies claims that decayed, generates reviews.
 */
export function onSessionStart(sessionId: string): void {
  _currentSession = sessionId;

  // Snapshot confidence before decay
  _lastDecaySnapshot.clear();
  for (const claim of getAllClaims()) {
    _lastDecaySnapshot.set(claim.id, claim.decayedConfidence);
  }

  // Run decay
  decayAll();

  // Record revisions for claims that decayed significantly
  for (const claim of getAllClaims()) {
    const oldConf = _lastDecaySnapshot.get(claim.id);
    if (oldConf !== undefined && oldConf !== claim.decayedConfidence) {
      // Only record if decay was meaningful (more than 1 point)
      if (oldConf - claim.decayedConfidence >= 1) {
        recordRevision(claim.id, claim.text, oldConf, claim.decayedConfidence, "decay");
      }
    }
  }

  // Generate review requests for stale claims
  generateReviewRequests();
}

/**
 * Called at before_prompt_build.
 * Returns injection string if there's something to surface.
 */
export function onBeforePromptBuild(): string | null {
  return formatInjection();
}

/**
 * Called at session_end.
 * Persists revision history.
 */
export async function onSessionEnd(workspaceDir: string): Promise<void> {
  await save(workspaceDir);
}

// ============================================================
// Persistence
// ============================================================

export async function save(workspaceDir: string): Promise<void> {
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });
  const file = join(dir, "belief-revisions.jsonl");
  const lines = _revisions.map((r) => JSON.stringify(r)).join("\n");
  await writeFile(file, lines + "\n", "utf-8");
}

export async function load(workspaceDir: string): Promise<void> {
  const file = join(workspaceDir, "awareness", "belief-revisions.jsonl");
  try {
    const raw = await readFile(file, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    _revisions.length = 0;
    for (const line of lines) {
      try {
        const revision = JSON.parse(line) as BeliefRevision;
        _revisions.push(revision);
      } catch {
        // skip malformed
      }
    }
    // Rolling window
    if (_revisions.length > MAX_REVISIONS) {
      _revisions.splice(0, _revisions.length - MAX_REVISIONS);
    }
  } catch {
    // No prior file — start fresh
  }
}

/**
 * Reset for testing.
 */
export function reset(): void {
  _revisions.length = 0;
  _reviewQueue.length = 0;
  _lastDecaySnapshot.clear();
  _currentSession = "";
}

// ============================================================
// Utilities
// ============================================================

/**
 * Record that a claim was verified (still true).
 * This is the agent saying "yes, I still believe this."
 */
export function recordVerification(
  claimId: string,
  claimText: string,
  confidence: number,
): BeliefRevision {
  return recordRevision(
    claimId,
    claimText,
    confidence,
    confidence,
    "verification",
    "agent confirmed",
  );
}

/**
 * Record that a claim was contradicted.
 */
export function recordContradiction(
  claimId: string,
  claimText: string,
  oldConfidence: number,
  contradictingEvidence: string,
): BeliefRevision {
  return recordRevision(
    claimId,
    claimText,
    oldConfidence,
    0,
    "contradiction",
    contradictingEvidence,
  );
}

/**
 * Record that a claim was retracted.
 */
export function recordRetraction(
  claimId: string,
  claimText: string,
  oldConfidence: number,
  reason?: string,
): BeliefRevision {
  return recordRevision(claimId, claimText, oldConfidence, 0, "retraction", reason);
}

/**
 * Get summary stats for dashboard.
 */
export function getStats(): {
  totalRevisions: number;
  thisSession: number;
  byReason: Record<RevisionReason, number>;
  pendingReviews: number;
} {
  const byReason: Record<RevisionReason, number> = {
    decay: 0,
    evidence: 0,
    contradiction: 0,
    retraction: 0,
    verification: 0,
  };

  for (const r of _revisions) {
    byReason[r.reason]++;
  }

  return {
    totalRevisions: _revisions.length,
    thisSession: getRevisionsInSession(_currentSession).length,
    byReason,
    pendingReviews: _reviewQueue.length,
  };
}
