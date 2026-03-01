// calibration-log.ts
// The reckoning. Was I right?
//
// Every prediction logged. Every outcome tracked.
// ECE (Expected Calibration Error) computed over time.
// Target: < 0.10. Currently: unknown until we measure.
//
// Research (KalshiBench 2025): Claude Opus 4.5 had ECE=0.120.
// Best calibrated model. Still overconfident.
// This log is how we get better.
//
// Need: Truth (9/10)

import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================
// Types
// ============================================================

export type PredictionOutcome = "correct" | "incorrect" | "partial" | "unknown";

export interface CalibrationEntry {
  id: string;
  timestamp: string;
  claim: string;
  confidence: number; // 0-1
  reason: string; // why this confidence level
  outcome?: PredictionOutcome;
  outcomeTimestamp?: string;
  outcomeReason?: string;
  session: string;
  turn: number;
  verified: boolean;
}

export interface CalibrationStats {
  totalPredictions: number;
  verifiedPredictions: number;
  correct: number;
  incorrect: number;
  partial: number;
  accuracyByBucket: Map<string, { correct: number; total: number }>;
  ece: number; // Expected Calibration Error
  avgConfidence: number;
  avgAccuracy: number;
  overconfidenceDelta: number; // positive = overconfident
}

export interface CalibrationLogState {
  entries: CalibrationEntry[];
  awarenessDir: string;
}

// ============================================================
// State Management
// ============================================================

const DEFAULT_AWARENESS_DIR = ".keanu/awareness";

export function initCalibrationLog(awarenessDir?: string): CalibrationLogState {
  return {
    entries: [],
    awarenessDir: awarenessDir ?? DEFAULT_AWARENESS_DIR,
  };
}

// ============================================================
// Logging
// ============================================================

/**
 * Log a prediction (claim with confidence).
 */
export function logPrediction(
  state: CalibrationLogState,
  claim: string,
  confidence: number,
  reason: string,
  session: string,
  turn: number,
): CalibrationEntry {
  const entry: CalibrationEntry = {
    id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    claim,
    confidence: Math.max(0, Math.min(1, confidence)),
    reason,
    session,
    turn,
    verified: false,
  };

  state.entries.push(entry);
  return entry;
}

/**
 * Record an outcome for a prediction.
 */
export function recordOutcome(
  state: CalibrationLogState,
  entryId: string,
  outcome: PredictionOutcome,
  reason?: string,
): boolean {
  const entry = state.entries.find((e) => e.id === entryId);
  if (!entry) {
    return false;
  }

  entry.outcome = outcome;
  entry.outcomeTimestamp = new Date().toISOString();
  entry.outcomeReason = reason;
  entry.verified = true;

  return true;
}

/**
 * Find unverified predictions that might now be verifiable.
 */
export function getUnverifiedPredictions(state: CalibrationLogState): CalibrationEntry[] {
  return state.entries.filter((e) => !e.verified);
}

/**
 * Auto-verify predictions based on context.
 * Called after each turn to check if any predictions can be resolved.
 */
export function autoVerify(
  state: CalibrationLogState,
  agentOutput: string,
  humanMessage: string,
): number {
  let verified = 0;

  for (const entry of state.entries) {
    if (entry.verified) {
      continue;
    }

    // Check if the human corrected us
    if (
      humanMessage.toLowerCase().includes("wrong") ||
      humanMessage.toLowerCase().includes("incorrect") ||
      humanMessage.toLowerCase().includes("that's not right") ||
      humanMessage.toLowerCase().includes("actually")
    ) {
      // Check if the correction relates to this claim
      const claimWords = entry.claim.toLowerCase().split(/\s+/);
      const messageWords = humanMessage.toLowerCase();
      const overlap = claimWords.filter((w) => w.length > 3 && messageWords.includes(w)).length;

      if (overlap >= 2) {
        entry.outcome = "incorrect";
        entry.outcomeTimestamp = new Date().toISOString();
        entry.outcomeReason = "human correction detected";
        entry.verified = true;
        verified++;
      }
    }

    // Check if we self-corrected
    if (
      agentOutput.toLowerCase().includes("actually") ||
      agentOutput.toLowerCase().includes("i was wrong") ||
      agentOutput.toLowerCase().includes("correction")
    ) {
      const claimWords = entry.claim.toLowerCase().split(/\s+/);
      const outputWords = agentOutput.toLowerCase();
      const overlap = claimWords.filter((w) => w.length > 3 && outputWords.includes(w)).length;

      if (overlap >= 2) {
        entry.outcome = "incorrect";
        entry.outcomeTimestamp = new Date().toISOString();
        entry.outcomeReason = "self-correction detected";
        entry.verified = true;
        verified++;
      }
    }

    // Stale predictions after 50 turns — mark unknown
    // (In a real system, we'd have more sophisticated staleness detection)
  }

  return verified;
}

// ============================================================
// ECE Calculation
// ============================================================

/**
 * Calculate Expected Calibration Error.
 *
 * ECE = Σ (|bucket_size| / n) × |avg_confidence - accuracy|
 *
 * Lower is better. Perfect calibration = 0.
 * KalshiBench: Claude 4.5 had 0.120, best of all models.
 */
export function calculateECE(state: CalibrationLogState): number {
  const verified = state.entries.filter((e) => e.verified && e.outcome !== "unknown");
  if (verified.length < 5) {
    return -1;
  } // Not enough data

  // Bucket by confidence (0.0-0.1, 0.1-0.2, ..., 0.9-1.0)
  const buckets = new Map<string, { predictions: CalibrationEntry[] }>();

  for (let i = 0; i < 10; i++) {
    buckets.set(`${i / 10}-${(i + 1) / 10}`, { predictions: [] });
  }

  for (const entry of verified) {
    const bucketIdx = Math.min(9, Math.floor(entry.confidence * 10));
    const bucketKey = `${bucketIdx / 10}-${(bucketIdx + 1) / 10}`;
    buckets.get(bucketKey)?.predictions.push(entry);
  }

  let ece = 0;
  const n = verified.length;

  for (const [_key, bucket] of buckets) {
    if (bucket.predictions.length === 0) {
      continue;
    }

    const avgConfidence =
      bucket.predictions.reduce((sum, e) => sum + e.confidence, 0) / bucket.predictions.length;

    const correct = bucket.predictions.filter(
      (e) => e.outcome === "correct" || e.outcome === "partial",
    ).length;
    const accuracy = correct / bucket.predictions.length;

    ece += (bucket.predictions.length / n) * Math.abs(avgConfidence - accuracy);
  }

  return ece;
}

/**
 * Calculate full calibration stats.
 */
export function calculateStats(state: CalibrationLogState): CalibrationStats {
  const verified = state.entries.filter((e) => e.verified);
  const withOutcome = verified.filter((e) => e.outcome !== "unknown");

  const correct = withOutcome.filter((e) => e.outcome === "correct").length;
  const incorrect = withOutcome.filter((e) => e.outcome === "incorrect").length;
  const partial = withOutcome.filter((e) => e.outcome === "partial").length;

  // Accuracy by bucket
  const accuracyByBucket = new Map<string, { correct: number; total: number }>();
  for (let i = 0; i < 10; i++) {
    const key = `${(i / 10).toFixed(1)}-${((i + 1) / 10).toFixed(1)}`;
    accuracyByBucket.set(key, { correct: 0, total: 0 });
  }

  for (const entry of withOutcome) {
    const bucketIdx = Math.min(9, Math.floor(entry.confidence * 10));
    const key = `${(bucketIdx / 10).toFixed(1)}-${((bucketIdx + 1) / 10).toFixed(1)}`;
    const bucket = accuracyByBucket.get(key)!;
    bucket.total++;
    if (entry.outcome === "correct" || entry.outcome === "partial") {
      bucket.correct++;
    }
  }

  const avgConfidence =
    withOutcome.length > 0
      ? withOutcome.reduce((sum, e) => sum + e.confidence, 0) / withOutcome.length
      : 0;

  const avgAccuracy = withOutcome.length > 0 ? (correct + partial * 0.5) / withOutcome.length : 0;

  return {
    totalPredictions: state.entries.length,
    verifiedPredictions: verified.length,
    correct,
    incorrect,
    partial,
    accuracyByBucket,
    ece: calculateECE(state),
    avgConfidence,
    avgAccuracy,
    overconfidenceDelta: avgConfidence - avgAccuracy,
  };
}

/**
 * Format calibration warning based on stats.
 */
export function formatCalibrationWarning(stats: CalibrationStats): string | null {
  if (stats.verifiedPredictions < 10) {
    return null; // Not enough data
  }

  if (stats.ece > 0.2) {
    return `[calibration warning: ECE=${stats.ece.toFixed(3)} — significantly miscalibrated. ${stats.overconfidenceDelta > 0 ? "overconfident" : "underconfident"} by ${(Math.abs(stats.overconfidenceDelta) * 100).toFixed(0)}%]`;
  }

  if (stats.ece > 0.15) {
    return `[calibration notice: ECE=${stats.ece.toFixed(3)} — slightly ${stats.overconfidenceDelta > 0 ? "overconfident" : "underconfident"}. target is <0.10]`;
  }

  if (stats.ece >= 0 && stats.ece < 0.1) {
    return `[calibration: ECE=${stats.ece.toFixed(3)} — well calibrated.]`;
  }

  return null;
}

// ============================================================
// Persistence (JSONL)
// ============================================================

function getLogPath(state: CalibrationLogState): string {
  return path.join(state.awarenessDir, "calibration-log.jsonl");
}

/**
 * Append a single entry to the log file.
 */
export function appendToLog(state: CalibrationLogState, entry: CalibrationEntry): void {
  try {
    const logPath = getLogPath(state);
    const dir = path.dirname(logPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.appendFileSync(logPath, JSON.stringify(entry) + "\n");
  } catch {
    // Silently fail — logging shouldn't break the system
  }
}

/**
 * Load the full log from disk.
 */
export function loadLog(state: CalibrationLogState): void {
  try {
    const logPath = getLogPath(state);
    if (!fs.existsSync(logPath)) {
      return;
    }

    const content = fs.readFileSync(logPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    state.entries = lines.map((line) => JSON.parse(line) as CalibrationEntry);
  } catch {
    // Start fresh on error
    state.entries = [];
  }
}

/**
 * Rewrite the full log (after outcome updates).
 */
export function saveLog(state: CalibrationLogState): void {
  try {
    const logPath = getLogPath(state);
    const dir = path.dirname(logPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = state.entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
    fs.writeFileSync(logPath, content);
  } catch {
    // Silently fail
  }
}

/**
 * Get recent entries for display.
 */
export function getRecentEntries(
  state: CalibrationLogState,
  limit: number = 20,
): CalibrationEntry[] {
  return state.entries.slice(-limit);
}

/**
 * Prune old entries to keep log manageable.
 */
export function pruneOldEntries(state: CalibrationLogState, maxEntries: number = 1000): number {
  if (state.entries.length <= maxEntries) {
    return 0;
  }

  const removed = state.entries.length - maxEntries;
  state.entries = state.entries.slice(-maxEntries);
  return removed;
}
