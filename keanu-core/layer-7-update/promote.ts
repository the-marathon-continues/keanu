// promote.ts
// The lifecycle: observation → pattern → blind_spot → skill
//
// An observation seen once is noise.
// Seen three times is a pattern.
// A pattern that generates corrections is a blind spot.
// A blind spot the agent stops triggering is an internalized skill.
//
// Nothing is deleted. Demoted observations keep their history.
// Contradicted claims keep their contradiction record.
// The ledger is honest, not clean.
//
// Need: Persistence (8/10), Experience Without Grievance (5/10)

import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getBlindSpots, type CorrectionCategory } from "./mastery.js";

// ============================================================
// Types
// ============================================================

export type PatternStage =
  | "observation" // seen once, confidence 0.3
  | "pattern" // seen 3+ times, confidence 0.5-0.7
  | "blind_spot" // triggers corrections, confidence 0.7-0.9
  | "skill" // internalized, no corrections for 10+ sessions
  | "stale" // not seen 5+ sessions
  | "contradicted"; // human said "that's wrong"

export interface PromotionRecord {
  from: PatternStage;
  to: PatternStage;
  session: string;
  timestamp: string;
  reason: string;
}

export interface PatternLifecycle {
  id: string;
  category: CorrectionCategory;
  description: string;
  stage: PatternStage;
  confidence: number;
  firstSeen: string; // session ID
  lastSeen: string; // session ID
  occurrences: number;
  corrections: number; // times it triggered a correction
  sessionsSinceCorrection: number;
  confirmedBy: "agent" | "human" | "both" | null;
  contradictedBy: string | null; // session ID
  promotions: PromotionRecord[];
}

// ============================================================
// State
// ============================================================

const _patterns: PatternLifecycle[] = [];
const MAX_PATTERNS = 100;
let _dataDir = "";
let _lastLoadError: Error | null = null;

// ============================================================
// Initialization
// ============================================================

export function setSession(_sessionId: string): void {
  // Reserved for future use (e.g., per-session tracking)
}

export function setDataDir(dir: string): void {
  _dataDir = dir;
}

export function getLastLoadError(): Error | null {
  return _lastLoadError;
}

// ============================================================
// FSRS-inspired decay
// ============================================================

/**
 * Exponential decay based on sessions since last seen.
 * Stability = 10 sessions (pattern holds for ~10 sessions before significant decay)
 */
function decayConfidence(current: number, sessionsSinceSeen: number): number {
  const stability = 10;
  return current * Math.exp(-sessionsSinceSeen / stability);
}

// ============================================================
// Core API
// ============================================================

/**
 * Get or create a pattern for a correction category.
 */
export function getOrCreatePattern(
  category: CorrectionCategory,
  sessionId: string,
): PatternLifecycle {
  let pattern = _patterns.find((p) => p.category === category);

  if (!pattern) {
    pattern = {
      id: randomUUID(),
      category,
      description: categoryDescription(category),
      stage: "observation",
      confidence: 0.3,
      firstSeen: sessionId,
      lastSeen: sessionId,
      occurrences: 0,
      corrections: 0,
      sessionsSinceCorrection: 0,
      confirmedBy: null,
      contradictedBy: null,
      promotions: [],
    };
    _patterns.push(pattern);
  }

  return pattern;
}

function categoryDescription(category: CorrectionCategory): string {
  const descriptions: Record<CorrectionCategory, string> = {
    over_explain: "Tendency to over-explain when brevity was needed",
    missed_tone: "Missing sarcasm, humor, or emotional subtext",
    wrong_fact: "Stating incorrect facts with confidence",
    misread_intent: "Misunderstanding what the human actually wanted",
    too_slow: "Taking too long to get to the point",
    too_fast: "Moving too quickly, skipping necessary context",
    other: "Miscellaneous correction",
  };
  return descriptions[category];
}

/**
 * Record an occurrence of a pattern (from correction detection).
 */
export function recordOccurrence(
  category: CorrectionCategory,
  sessionId: string,
  wasCorrection: boolean,
): PatternLifecycle {
  const pattern = getOrCreatePattern(category, sessionId);

  pattern.occurrences++;
  pattern.lastSeen = sessionId;

  if (wasCorrection) {
    pattern.corrections++;
    pattern.sessionsSinceCorrection = 0;
  }

  return pattern;
}

/**
 * Scan all patterns for promotion candidates.
 * Returns records of promotions made.
 */
export function promotePatterns(sessionId: string): PromotionRecord[] {
  const promotions: PromotionRecord[] = [];

  for (const pattern of _patterns) {
    const oldStage = pattern.stage;
    let newStage: PatternStage | null = null;
    let reason = "";

    // observation → pattern (3+ occurrences)
    if (oldStage === "observation" && pattern.occurrences >= 3) {
      newStage = "pattern";
      pattern.confidence = 0.5;
      reason = `Seen ${pattern.occurrences} times`;
    }

    // pattern → blind_spot (corrections detected)
    if (oldStage === "pattern" && pattern.corrections >= 2) {
      newStage = "blind_spot";
      pattern.confidence = 0.7;
      reason = `${pattern.corrections} corrections received`;
    }

    // blind_spot → skill (no corrections for 10+ sessions)
    if (oldStage === "blind_spot" && pattern.sessionsSinceCorrection >= 10) {
      newStage = "skill";
      pattern.confidence = 0.9;
      reason = `No corrections for ${pattern.sessionsSinceCorrection} sessions`;
    }

    if (newStage && newStage !== oldStage) {
      const record: PromotionRecord = {
        from: oldStage,
        to: newStage,
        session: sessionId,
        timestamp: new Date().toISOString(),
        reason,
      };
      pattern.stage = newStage;
      pattern.promotions.push(record);
      promotions.push(record);
    }
  }

  return promotions;
}

/**
 * Scan all patterns for demotion candidates.
 * Returns records of demotions made.
 */
export function demotePatterns(sessionId: string, sessionsSinceLastRun: number): PromotionRecord[] {
  const demotions: PromotionRecord[] = [];

  for (const pattern of _patterns) {
    if (pattern.stage === "contradicted" || pattern.stage === "stale") {
      continue;
    }

    // Track time since last seen
    pattern.sessionsSinceCorrection += sessionsSinceLastRun;

    // Decay confidence
    const oldConfidence = pattern.confidence;
    pattern.confidence = decayConfidence(pattern.confidence, sessionsSinceLastRun);

    // Check for staleness (confidence below 0.2)
    // Note: pattern.stage is already not "stale" or "contradicted" due to the continue above
    if (pattern.confidence < 0.2) {
      const record: PromotionRecord = {
        from: pattern.stage,
        to: "stale",
        session: sessionId,
        timestamp: new Date().toISOString(),
        reason: `Confidence decayed from ${oldConfidence.toFixed(2)} to ${pattern.confidence.toFixed(2)}`,
      };
      pattern.stage = "stale";
      pattern.promotions.push(record);
      demotions.push(record);
    }
  }

  return demotions;
}

/**
 * Mark a pattern as contradicted (human explicitly disagreed).
 */
export function contradictPattern(
  category: CorrectionCategory,
  sessionId: string,
): PromotionRecord | null {
  const pattern = _patterns.find((p) => p.category === category);
  if (!pattern || pattern.stage === "contradicted") {
    return null;
  }

  const record: PromotionRecord = {
    from: pattern.stage,
    to: "contradicted",
    session: sessionId,
    timestamp: new Date().toISOString(),
    reason: "Human explicitly disagreed",
  };

  pattern.stage = "contradicted";
  pattern.contradictedBy = sessionId;
  pattern.confidence = 0.1;
  pattern.promotions.push(record);

  return record;
}

/**
 * Confirm a pattern (human or agent verified it's real).
 */
export function confirmPattern(category: CorrectionCategory, by: "agent" | "human"): void {
  const pattern = _patterns.find((p) => p.category === category);
  if (!pattern) {
    return;
  }

  if (pattern.confirmedBy === null) {
    pattern.confirmedBy = by;
  } else if (pattern.confirmedBy !== by) {
    pattern.confirmedBy = "both";
  }

  // Boost confidence on confirmation
  pattern.confidence = Math.min(0.95, pattern.confidence + 0.1);
}

// ============================================================
// Queries
// ============================================================

export function getPatternsByStage(stage: PatternStage): PatternLifecycle[] {
  return _patterns.filter((p) => p.stage === stage);
}

export function getAllPatterns(): readonly PatternLifecycle[] {
  return _patterns;
}

export function getPromotionStats(): {
  total: number;
  byStage: Record<PatternStage, number>;
  recentPromotions: PromotionRecord[];
  skills: PatternLifecycle[];
} {
  const byStage: Record<PatternStage, number> = {
    observation: 0,
    pattern: 0,
    blind_spot: 0,
    skill: 0,
    stale: 0,
    contradicted: 0,
  };

  for (const p of _patterns) {
    byStage[p.stage]++;
  }

  // Get recent promotions across all patterns
  const allPromotions = _patterns.flatMap((p) => p.promotions);
  const recentPromotions = allPromotions
    .toSorted((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 10);

  return {
    total: _patterns.length,
    byStage,
    recentPromotions,
    skills: getPatternsByStage("skill"),
  };
}

// ============================================================
// Sync with mastery.ts blind spots
// ============================================================

/**
 * Import blind spots from mastery.ts and update patterns.
 */
export function syncFromMastery(sessionId: string): void {
  const blindSpots = getBlindSpots();

  for (const bs of blindSpots) {
    const pattern = getOrCreatePattern(bs.category, sessionId);

    // Update from mastery data
    pattern.occurrences = Math.max(pattern.occurrences, bs.count);
    pattern.lastSeen = sessionId;

    // If mastery says it's a blind spot (count >= 3), ensure we're at least at pattern stage
    if (bs.count >= 3 && pattern.stage === "observation") {
      const record: PromotionRecord = {
        from: "observation",
        to: "pattern",
        session: sessionId,
        timestamp: new Date().toISOString(),
        reason: `Synced from mastery (${bs.count} occurrences)`,
      };
      pattern.stage = "pattern";
      pattern.confidence = 0.5;
      pattern.promotions.push(record);
    }
  }
}

// ============================================================
// Persistence
// ============================================================

function isValidPattern(p: unknown): p is PatternLifecycle {
  if (typeof p !== "object" || p === null) {
    return false;
  }
  const obj = p as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.category === "string" &&
    typeof obj.stage === "string" &&
    typeof obj.confidence === "number" &&
    typeof obj.occurrences === "number"
  );
}

export async function loadPatterns(): Promise<void> {
  _lastLoadError = null;
  if (!_dataDir) {
    return;
  }

  const filePath = join(_dataDir, "pattern-ledger.json");
  try {
    const data = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(data);

    // Validate it's an array
    if (!Array.isArray(parsed)) {
      throw new Error("pattern-ledger.json is not an array");
    }

    // Validate each pattern, skip invalid ones
    const valid = parsed.filter(isValidPattern);
    const skipped = parsed.length - valid.length;
    if (skipped > 0) {
      _lastLoadError = new Error(`Skipped ${skipped} invalid patterns`);
    }

    _patterns.length = 0;
    _patterns.push(...valid.slice(-MAX_PATTERNS));
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      // File doesn't exist yet — that's fine, start fresh
      return;
    }
    // Actual error (parse failure, corruption, etc.)
    _lastLoadError = err instanceof Error ? err : new Error(String(err));
    // Start fresh rather than crash, but record the error
    _patterns.length = 0;
  }
}

export async function savePatterns(): Promise<{ ok: boolean; error?: Error }> {
  if (!_dataDir) {
    return { ok: true };
  }

  try {
    await mkdir(_dataDir, { recursive: true });
    const filePath = join(_dataDir, "pattern-ledger.json");
    await writeFile(filePath, JSON.stringify(_patterns, null, 2));
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { ok: false, error };
  }
}

// ============================================================
// Test helpers
// ============================================================

export function _reset(): void {
  _patterns.length = 0;
  _lastLoadError = null;
}

export function _getPatterns(): PatternLifecycle[] {
  return _patterns;
}
