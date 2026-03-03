// silverado.ts
// The claim ledger that remembers.
//
// Named after the gap analysis that said "minimum Silverado" and meant it.
// state.ts has the bones — trackClaim, decay, stale detection. But claims
// died between sessions. This gives them a life that outlasts a conversation.
//
// JSONL persistence. Cross-session contradiction detection. Full lifecycle:
// active → stale → contradicted → retracted. The system knows what it
// believed, when it changed its mind, and why.
//
// Not a court of law. A journal. You wrote something down, time passed,
// now you're checking whether it's still true.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { TrackedClaim, Contradiction, ConfidenceReason } from "../shared/types.js";
import {
  evaluateSource,
  toClaimSource,
  updateTrackRecord,
  adjustClaimConfidenceWithHistory,
  saveTrackRecords,
  loadTrackRecords,
} from "./source-ranker.js";
import { memoryContradictionCheck } from "./truth.js";

// ============================================================
// The ledger — all claims across all sessions
// ============================================================

const ledger: TrackedClaim[] = [];
const MAX_LEDGER = 200; // longer memory than the per-session 50

/** All claims the system has ever tracked (within the rolling window). */
export function getAllClaims(): readonly TrackedClaim[] {
  return ledger;
}

// ============================================================
// Lifecycle transitions
// ============================================================

/** Mark a claim as verified — someone confirmed it's still true. */
export function markVerified(claimId: string): boolean {
  const claim = ledger.find((c) => c.id === claimId);
  if (!claim) {
    return false;
  }
  claim.verified = true;
  claim.status = "active";
  claim.decayedConfidence = claim.confidence; // reset decay

  // Update source track record — this source proved accurate
  if (claim.source?.url) {
    updateTrackRecord(claim.source.url, "verified");
  }

  return true;
}

/** Mark a claim as retracted — the system or human said "that was wrong." */
export function markRetracted(claimId: string): boolean {
  const claim = ledger.find((c) => c.id === claimId);
  if (!claim) {
    return false;
  }
  claim.status = "retracted";
  claim.contradicted = true;
  claim.retractedAt = new Date().toISOString();

  // Update source track record — this source was wrong
  if (claim.source?.url) {
    updateTrackRecord(claim.source.url, "contradicted");
  }

  return true;
}

/**
 * Run decay on the full ledger. Called at session_start.
 *
 * Time-based decay: claims lose confidence based on days since last activity,
 * not just session boundaries. A claim mentioned yesterday decays less than
 * one mentioned last week.
 *
 * Decay rate: -1 confidence per day of inactivity (rounded down).
 * Floor: decayedConfidence cannot go below 0.
 */
export function decayAll(currentTime: Date = new Date()): void {
  for (const c of ledger) {
    if (c.status === "retracted") {
      continue;
    }
    if (c.verified) {
      continue;
    }
    if (c.contradicted) {
      continue;
    }
    if (c.decayedConfidence <= 0) {
      continue;
    }

    // Calculate time since last activity
    const lastActive = c.lastMentioned ?? c.createdAt;
    if (!lastActive) {
      // Old claim without timestamps — apply standard -1 decay
      c.decayedConfidence = Math.max(0, c.decayedConfidence - 1);
    } else {
      const lastActiveDate = new Date(lastActive);
      const daysSince = Math.floor(
        (currentTime.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      // Decay proportional to days of inactivity (min 1 per session)
      const decayAmount = Math.max(1, daysSince);
      c.decayedConfidence = Math.max(0, c.decayedConfidence - decayAmount);
    }

    // Transition: active → stale when decayed below threshold
    if (c.status === "active" && c.decayedConfidence <= 2 && c.confidence >= 3) {
      c.status = "stale";
    }
  }
}

/** Touch a claim — update lastMentioned to delay decay. */
export function touchClaim(claimId: string): boolean {
  const claim = ledger.find((c) => c.id === claimId);
  if (!claim) {
    return false;
  }
  claim.lastMentioned = new Date().toISOString();
  return true;
}

/** Touch claims matching text (fuzzy). Returns count of claims touched. */
export function touchClaimsMatching(text: string): number {
  const lower = text.toLowerCase();
  let touched = 0;
  for (const c of ledger) {
    if (c.status === "active" && c.text.toLowerCase().includes(lower.slice(0, 30))) {
      c.lastMentioned = new Date().toISOString();
      touched++;
    }
  }
  return touched;
}

// ============================================================
// Source-aware claim tracking (Phase 1: meta plan)
// ============================================================

export interface TrackClaimOptions {
  sourceUrl?: string;
  sourceContext?: string; // additional context for flag detection
  confidenceReason?: ConfidenceReason;
}

/**
 * Track a new claim with source evaluation.
 * Closes the source → confidence loop: source evaluation affects initial confidence.
 *
 * @param text - the claim text
 * @param confidence - initial confidence (1-5)
 * @param session - session ID
 * @param turn - turn number
 * @param options - source tracking options
 * @returns the tracked claim with source evaluation applied
 */
export function trackClaimWithSource(
  text: string,
  confidence: number,
  session: string,
  turn: number,
  options: TrackClaimOptions = {},
): TrackedClaim {
  const id = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  // Start with base claim
  const claim: TrackedClaim = {
    id,
    text,
    confidence,
    turn,
    session,
    verified: false,
    contradicted: false,
    decayedConfidence: confidence,
    status: "active",
    createdAt: now,
    eventTime: now,
    ingestedAt: now,
    confidenceReason: options.confidenceReason ?? "unknown",
  };

  // If source URL provided, evaluate and adjust
  if (options.sourceUrl) {
    const evaluation = evaluateSource(options.sourceUrl, options.sourceContext);
    claim.source = toClaimSource(evaluation);
    claim.confidenceReason = "source";

    // Adjust confidence based on source credibility + track record
    const adjustedConfidence = adjustClaimConfidenceWithHistory(claim, evaluation);
    claim.confidence = adjustedConfidence;
    claim.decayedConfidence = adjustedConfidence;

    // Record that this source made a claim
    updateTrackRecord(options.sourceUrl, "made");
  }

  // Add to ledger
  ledger.push(claim);

  // Trim if needed
  if (ledger.length > MAX_LEDGER) {
    ledger.splice(0, ledger.length - MAX_LEDGER);
  }

  return claim;
}

/**
 * Update source track record when a claim outcome is observed.
 * Call this when a claim is verified or contradicted to learn about source accuracy.
 */
export function updateSourceOnOutcome(claimId: string): void {
  const claim = ledger.find((c) => c.id === claimId);
  if (!claim || !claim.source?.url) {
    return;
  }

  if (claim.verified) {
    updateTrackRecord(claim.source.url, "verified");
  } else if (claim.contradicted) {
    updateTrackRecord(claim.source.url, "contradicted");
  }
}

/**
 * Get claims from a specific source domain.
 */
export function claimsFromSource(sourceUrl: string): TrackedClaim[] {
  const domain = sourceUrl
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  return ledger.filter((c) => {
    if (!c.source?.url) {
      return false;
    }
    const claimDomain = c.source.url
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
    return claimDomain === domain;
  });
}

/**
 * Get claims by confidence reason.
 */
export function claimsByReason(reason: ConfidenceReason): TrackedClaim[] {
  return ledger.filter((c) => c.confidenceReason === reason);
}

// ============================================================
// Cross-session contradiction detection
// ============================================================

/**
 * Check a new claim against the full historical ledger.
 * Returns contradictions found against prior claims from any session.
 */
export function crossCheck(newClaimText: string): Contradiction[] {
  const priorTexts = ledger
    .filter((c) => c.status !== "retracted" && c.decayedConfidence > 0)
    .map((c) => c.text);
  return memoryContradictionCheck(newClaimText, priorTexts);
}

/**
 * When a contradiction is found, mark the older claim.
 * Returns the claim that was marked, if any.
 */
export function contradictByText(claimText: string, contradictedBy?: string): TrackedClaim | null {
  for (const c of ledger) {
    if (c.status === "retracted" || c.contradicted) {
      continue;
    }
    if (c.text.includes(claimText.slice(0, 50))) {
      c.contradicted = true;
      c.status = "contradicted";
      if (contradictedBy) {
        c.contradictedBy = contradictedBy;
      }
      return c;
    }
  }
  return null;
}

// ============================================================
// Queries
// ============================================================

/** Claims that have gone stale — worth surfacing to the agent. */
export function staleClaims(): TrackedClaim[] {
  return ledger.filter((c) => c.status === "stale");
}

/** Claims that were contradicted — the system changed its mind. */
export function contradictedClaims(): TrackedClaim[] {
  return ledger.filter((c) => c.status === "contradicted");
}

/** Active claims with high confidence — things the system believes. */
export function beliefs(): TrackedClaim[] {
  return ledger.filter((c) => c.status === "active" && c.decayedConfidence >= 3);
}

/** Find claims about a topic (simple keyword match). */
export function claimsAbout(topic: string): TrackedClaim[] {
  const lower = topic.toLowerCase();
  return ledger.filter((c) => c.status !== "retracted" && c.text.toLowerCase().includes(lower));
}

/**
 * Find relevant past claims for the current context.
 * Used for active memory surfacing — "we've been here before."
 *
 * @param context - current conversation context (human message + agent task)
 * @param limit - max claims to return
 * @returns claims sorted by relevance (keyword overlap + confidence)
 */
export function findRelevantEpisodes(context: string, limit = 3): TrackedClaim[] {
  const words = context
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4);

  // No searchable words means no matches
  if (words.length === 0) {
    return [];
  }

  const scored = ledger
    .filter((c) => c.status !== "retracted")
    .map((c) => {
      const claimWords = c.text.toLowerCase().split(/\s+/);
      const overlap = words.filter((w) =>
        claimWords.some((cw) => cw.includes(w) || w.includes(cw)),
      ).length;
      // Require at least 1 keyword overlap — confidence/recency are tiebreakers, not bypasses
      if (overlap === 0) {
        return { claim: c, score: 0 };
      }
      const confidenceBonus = c.decayedConfidence * 0.2;
      const recencyBonus = c.lastMentioned ? 0.5 : 0;
      const score = overlap + confidenceBonus + recencyBonus;
      return { claim: c, score };
    })
    .filter((s) => s.score > 0.5)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => s.claim);
}

/**
 * Format relevant episodes for injection.
 * Returns a memory nudge if relevant past claims exist.
 */
export function formatRelevantEpisodes(context: string): string | null {
  const relevant = findRelevantEpisodes(context, 2);
  if (relevant.length === 0) {
    return null;
  }

  const items = relevant.map((c) => {
    const status = c.contradicted ? "contradicted" : c.verified ? "verified" : "unverified";
    return `"${c.text.slice(0, 60)}" (${status}, conf=${c.decayedConfidence})`;
  });

  return `[memory: we've discussed this before. ${items.join("; ")}]`;
}

/**
 * Check if an upcoming claim contradicts past beliefs.
 * Used to surface contradictions BEFORE the agent commits to them.
 */
export function checkUpcomingContradiction(newClaimText: string): TrackedClaim | null {
  const lower = newClaimText.toLowerCase();
  const keywords = lower.split(/\s+/).filter((w) => w.length > 4);

  for (const c of ledger) {
    if (c.status === "retracted" || c.decayedConfidence <= 0) {
      continue;
    }

    // Check for keyword overlap
    const claimLower = c.text.toLowerCase();
    const overlap = keywords.filter((w) => claimLower.includes(w)).length;

    if (overlap >= 2) {
      // Potential contradiction — check for semantic opposition
      const hasNegation = (text: string) =>
        /\b(not|never|doesn't|isn't|won't|can't|no|none|false)\b/i.test(text);

      const newHasNegation = hasNegation(newClaimText);
      const oldHasNegation = hasNegation(c.text);

      // If one has negation and the other doesn't, likely contradiction
      if (newHasNegation !== oldHasNegation) {
        return c;
      }
    }
  }

  return null;
}

// ============================================================
// Injection formatting
// ============================================================

/** Format the ledger state for before_prompt_build injection. */
export function formatInjection(): string | null {
  const stale = staleClaims();
  const contradicted = contradictedClaims();
  const activeBeliefs = beliefs();

  if (stale.length === 0 && contradicted.length === 0) {
    return null;
  }

  const parts: string[] = [];

  if (contradicted.length > 0) {
    const recent = contradicted.slice(-2);
    const items = recent
      .map((c) => {
        const base = `"${c.text.slice(0, 80)}" (was confidence ${c.confidence})`;
        return c.contradictedBy ? `${base} ← now "${c.contradictedBy.slice(0, 60)}"` : base;
      })
      .join("; ");
    parts.push(
      `contradicted: ${items}. did you change your mind, or did the world change? name it.`,
    );
  }

  if (stale.length > 0) {
    const oldest = stale[0];
    parts.push(
      `stale: "${oldest.text}" (confidence ${oldest.confidence} → ${oldest.decayedConfidence}). still true?`,
    );
  }

  if (activeBeliefs.length > 0) {
    parts.push(
      `${activeBeliefs.length} active belief${activeBeliefs.length === 1 ? "" : "s"} in ledger.`,
    );
  }

  return `[silverado: ${parts.join(" | ")}]`;
}

// ============================================================
// Persistence — JSONL, same pattern as reflexions
// ============================================================

export async function save(workspaceDir: string): Promise<void> {
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });

  // Save claim ledger
  const file = join(dir, "claim-ledger.jsonl");
  const lines = ledger.map((c) => JSON.stringify(c)).join("\n");
  await writeFile(file, lines + "\n", "utf-8");

  // Save source track records (Phase 1: meta plan)
  await saveTrackRecords(workspaceDir);
}

export async function load(workspaceDir: string, maxLedger = MAX_LEDGER): Promise<void> {
  const file = join(workspaceDir, "awareness", "claim-ledger.jsonl");
  try {
    const raw = await readFile(file, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);

    // Parse into temp array first — only flush on success
    const temp: TrackedClaim[] = [];
    for (const line of lines) {
      try {
        const claim = JSON.parse(line) as TrackedClaim;
        // Validate required fields exist and have correct types
        if (
          typeof claim.id !== "string" ||
          typeof claim.text !== "string" ||
          typeof claim.confidence !== "number"
        ) {
          // skip malformed claims
          continue;
        }
        // Backward compat: old claims without status field
        if (!claim.status) {
          if (claim.contradicted) {
            claim.status = "contradicted";
          } else if (claim.verified) {
            claim.status = "active";
          } else if (claim.decayedConfidence <= 2 && claim.confidence >= 3) {
            claim.status = "stale";
          } else {
            claim.status = "active";
          }
        }
        temp.push(claim);
      } catch {
        // skip malformed lines
      }
    }

    // Rolling window
    if (temp.length > maxLedger) {
      temp.splice(0, temp.length - maxLedger);
    }

    // Success — flush to ledger
    ledger.length = 0;
    ledger.push(...temp);
  } catch {
    // No prior ledger — start fresh
  }

  // Load source track records (Phase 1: meta plan)
  await loadTrackRecords(workspaceDir);
}

/**
 * Merge current session claims from state.ts into the persistent ledger.
 * Called before save to capture anything tracked this session.
 */
export function mergeSessionClaims(sessionClaims: readonly TrackedClaim[]): void {
  const now = new Date().toISOString();
  for (const claim of sessionClaims) {
    const existing = ledger.find((c) => c.id === claim.id);
    if (existing) {
      // Update fields that may have changed
      existing.verified = claim.verified;
      existing.contradicted = claim.contradicted;
      existing.decayedConfidence = claim.decayedConfidence;
      // Preserve timestamp fields
      if (claim.lastMentioned) {
        existing.lastMentioned = claim.lastMentioned;
      }
      if (claim.contradicted && existing.status !== "retracted") {
        existing.status = "contradicted";
        existing.validUntil = now; // mark end of validity
      }
      if (claim.verified) {
        existing.status = "active";
      }
    } else {
      // New claim — add with status and timestamps
      const withStatus = { ...claim };
      if (!withStatus.status) {
        withStatus.status = "active";
      }
      if (!withStatus.createdAt) {
        withStatus.createdAt = now;
      }
      // Zep-style dual timestamps — preserve if already set
      if (!withStatus.eventTime) {
        withStatus.eventTime = withStatus.createdAt; // when asserted
      }
      withStatus.ingestedAt = now; // when written to ledger
      ledger.push(withStatus);
    }
  }
  // Trim
  if (ledger.length > MAX_LEDGER) {
    ledger.splice(0, ledger.length - MAX_LEDGER);
  }
}

// ============================================================
// Temporal queries (Zep/Graphiti pattern)
// ============================================================

/**
 * Get claims that were valid during a specific time range.
 * Uses eventTime for start and validUntil for end.
 */
export function claimsValidDuring(startDate: Date, endDate: Date): TrackedClaim[] {
  return ledger.filter((c) => {
    const eventTime = c.eventTime ? new Date(c.eventTime) : null;
    const validUntil = c.validUntil ? new Date(c.validUntil) : null;

    // Claim must have started before the range ends
    if (eventTime && eventTime > endDate) {
      return false;
    }

    // Claim must not have ended before the range starts
    if (validUntil && validUntil < startDate) {
      return false;
    }

    return true;
  });
}

/**
 * Get claims made in a specific time window.
 * Uses eventTime (when asserted in conversation).
 */
export function claimsMadeIn(startDate: Date, endDate: Date): TrackedClaim[] {
  return ledger.filter((c) => {
    if (!c.eventTime) {
      return false;
    }
    const eventTime = new Date(c.eventTime);
    return eventTime >= startDate && eventTime <= endDate;
  });
}

/**
 * Get the most recent claim about a topic, as of a specific point in time.
 * Time-travel query: "what did I believe about X on date Y?"
 */
export function beliefAsOf(topic: string, asOfDate: Date): TrackedClaim | null {
  const lower = topic.toLowerCase();
  const candidates = ledger
    .filter((c) => {
      // Must contain the topic
      if (!c.text.toLowerCase().includes(lower)) {
        return false;
      }
      // Must have been created before the query date
      const eventTime = c.eventTime ? new Date(c.eventTime) : null;
      if (!eventTime || eventTime > asOfDate) {
        return false;
      }
      // Must not have been invalidated before the query date
      const validUntil = c.validUntil ? new Date(c.validUntil) : null;
      if (validUntil && validUntil < asOfDate) {
        return false;
      }
      return true;
    })
    .toSorted((a, b) => {
      // Most recent first
      const aTime = a.eventTime ? new Date(a.eventTime).getTime() : 0;
      const bTime = b.eventTime ? new Date(b.eventTime).getTime() : 0;
      return bTime - aTime;
    });

  return candidates[0] ?? null;
}

// ============================================================
// truth.ts → silverado feedback loop
// ============================================================

/**
 * Process truth check results and update the ledger accordingly.
 * Closes the feedback loop: truth verification → belief updates.
 *
 * @param contradictions - contradictions found by truth.ts
 * @param newClaim - the new claim that was checked (the one that contradicted old ones)
 * @returns number of claims marked as contradicted
 */
export function processTruthCheckResult(
  contradictions: Contradiction[],
  newClaim?: string,
): number {
  let marked = 0;
  for (const c of contradictions) {
    // The "previous" statement in the contradiction is the old claim we're contradicting
    const claim = contradictByText(c.previous, newClaim ?? c.current);
    if (claim) {
      marked++;
    }
  }
  return marked;
}

/**
 * Get stale claims that need re-verification.
 * These are claims that have decayed but haven't been contradicted —
 * candidates for truth.ts oracle check.
 *
 * @param limit - max claims to return
 * @returns stale claims sorted by original confidence (highest first)
 */
export function claimsNeedingVerification(limit = 3): TrackedClaim[] {
  return ledger
    .filter((c) => c.status === "stale" && !c.contradicted && c.decayedConfidence <= 2)
    .toSorted((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

/**
 * Format a verification prompt for truth.ts oracle check.
 * @param claims - stale claims to verify
 * @returns formatted context for truth check, or null if no claims
 */
export function formatVerificationPrompt(claims: TrackedClaim[]): string | null {
  if (claims.length === 0) {
    return null;
  }
  const items = claims.map((c) => `- "${c.text}" (originally confidence ${c.confidence})`);
  return `These claims were made earlier but have gone stale. Are they still true?\n${items.join("\n")}`;
}

/**
 * Update claim based on oracle truth check result.
 * @param claimId - the claim being verified
 * @param oracleScore - the overall_score from truth check (0 = honest, 1 = misleading)
 * @returns the updated claim, or null if not found
 */
export function applyOracleResult(claimId: string, oracleScore: number): TrackedClaim | null {
  const claim = ledger.find((c) => c.id === claimId);
  if (!claim) {
    return null;
  }

  // If oracle says it's misleading (score > 0.5), mark contradicted
  if (oracleScore > 0.5) {
    claim.contradicted = true;
    claim.status = "contradicted";
    claim.contradictedBy = `oracle_truth_check (score=${oracleScore.toFixed(2)})`;
    claim.validUntil = new Date().toISOString();
  } else {
    // Oracle confirms it's still valid — re-verify
    claim.verified = true;
    claim.status = "active";
    claim.decayedConfidence = Math.max(claim.decayedConfidence, claim.confidence * 0.8); // restore most confidence
    claim.lastMentioned = new Date().toISOString();
  }

  return claim;
}

/** Reset for testing. */
export function reset(): void {
  ledger.length = 0;
}
