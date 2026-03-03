// calibration-log.test.ts
// Tests for the calibration log — the reckoning.
//
// "No tests. None." — the gap we're filling.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import {
  initCalibrationLog,
  logPrediction,
  recordOutcome,
  getUnverifiedPredictions,
  autoVerify,
  calculateECE,
  calculateStats,
  formatCalibrationWarning,
  appendToLog,
  loadLog,
  saveLog,
  getRecentEntries,
  pruneOldEntries,
  type CalibrationLogState,
  type CalibrationEntry,
} from "./calibration-log.js";

// ============================================================
// Test Fixtures
// ============================================================

function createTestState(): CalibrationLogState {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "calibration-test-"));
  return initCalibrationLog(tempDir);
}

function addVerifiedPredictions(
  state: CalibrationLogState,
  predictions: Array<{ confidence: number; correct: boolean }>,
): void {
  for (let i = 0; i < predictions.length; i++) {
    const entry = logPrediction(
      state,
      `Test claim ${i}`,
      predictions[i].confidence,
      "test reason",
      "test-session",
      i,
    );
    recordOutcome(
      state,
      entry.id,
      predictions[i].correct ? "correct" : "incorrect",
      "test verification",
    );
  }
}

// ============================================================
// Basic Lifecycle Tests
// ============================================================

describe("calibration-log lifecycle", () => {
  let state: CalibrationLogState;

  beforeEach(() => {
    state = createTestState();
  });

  it("logs a prediction with all fields", () => {
    const entry = logPrediction(
      state,
      "TypeScript is better than JavaScript",
      0.8,
      "strong type system",
      "session-123",
      5,
    );

    expect(entry.claim).toBe("TypeScript is better than JavaScript");
    expect(entry.confidence).toBe(0.8);
    expect(entry.reason).toBe("strong type system");
    expect(entry.session).toBe("session-123");
    expect(entry.turn).toBe(5);
    expect(entry.verified).toBe(false);
    expect(entry.id).toMatch(/^cal-/);
    expect(entry.timestamp).toBeTruthy();
  });

  it("clamps confidence to 0-1 range", () => {
    const high = logPrediction(state, "claim", 1.5, "reason", "s", 0);
    const low = logPrediction(state, "claim", -0.5, "reason", "s", 1);

    expect(high.confidence).toBe(1);
    expect(low.confidence).toBe(0);
  });

  it("records outcome and marks verified", () => {
    const entry = logPrediction(state, "claim", 0.7, "reason", "s", 0);
    const success = recordOutcome(state, entry.id, "correct", "human confirmed");

    expect(success).toBe(true);
    expect(entry.verified).toBe(true);
    expect(entry.outcome).toBe("correct");
    expect(entry.outcomeReason).toBe("human confirmed");
    expect(entry.outcomeTimestamp).toBeTruthy();
  });

  it("returns false for unknown entry id", () => {
    const success = recordOutcome(state, "nonexistent-id", "correct");
    expect(success).toBe(false);
  });

  it("tracks unverified predictions", () => {
    logPrediction(state, "claim 1", 0.5, "r", "s", 0);
    const entry2 = logPrediction(state, "claim 2", 0.6, "r", "s", 1);
    logPrediction(state, "claim 3", 0.7, "r", "s", 2);

    recordOutcome(state, entry2.id, "correct");

    const unverified = getUnverifiedPredictions(state);
    expect(unverified.length).toBe(2);
    expect(unverified.map((e) => e.claim)).toContain("claim 1");
    expect(unverified.map((e) => e.claim)).toContain("claim 3");
  });
});

// ============================================================
// Auto-Verify Tests
// ============================================================

describe("autoVerify", () => {
  let state: CalibrationLogState;

  beforeEach(() => {
    state = createTestState();
  });

  it("detects human correction with word overlap", () => {
    logPrediction(state, "The API uses OAuth2 for authentication", 0.8, "saw docs", "s", 0);

    const verified = autoVerify(
      state,
      "I understand.",
      "Actually, the API uses API keys, not OAuth2",
    );

    expect(verified).toBe(1);
    expect(state.entries[0].verified).toBe(true);
    expect(state.entries[0].outcome).toBe("incorrect");
    expect(state.entries[0].outcomeReason).toBe("human correction detected");
  });

  it("detects self-correction", () => {
    logPrediction(state, "The function returns a string", 0.7, "type annotation", "s", 0);

    const verified = autoVerify(
      state,
      "Actually, I was wrong about the function return type - it returns a number.",
      "okay",
    );

    expect(verified).toBe(1);
    expect(state.entries[0].outcome).toBe("incorrect");
    expect(state.entries[0].outcomeReason).toBe("self-correction detected");
  });

  it("requires word overlap to verify", () => {
    logPrediction(state, "TypeScript is great", 0.9, "r", "s", 0);

    const verified = autoVerify(state, "output", "Actually, Python is better");

    // No overlap between "TypeScript is great" and "Python is better"
    expect(verified).toBe(0);
    expect(state.entries[0].verified).toBe(false);
  });

  it("does not re-verify already verified entries", () => {
    const entry = logPrediction(state, "claim about testing", 0.5, "r", "s", 0);
    recordOutcome(state, entry.id, "correct");

    const verified = autoVerify(state, "output", "Actually, wrong about testing");

    expect(verified).toBe(0);
    expect(entry.outcome).toBe("correct"); // Unchanged
  });
});

// ============================================================
// ECE Calculation Tests
// ============================================================

describe("calculateECE", () => {
  let state: CalibrationLogState;

  beforeEach(() => {
    state = createTestState();
  });

  it("returns -1 with insufficient data", () => {
    addVerifiedPredictions(state, [
      { confidence: 0.9, correct: true },
      { confidence: 0.8, correct: false },
    ]);

    expect(calculateECE(state)).toBe(-1);
  });

  it("calculates ECE for well-calibrated predictions", () => {
    // Perfect calibration: 90% confident, 90% correct
    addVerifiedPredictions(
      state,
      Array(10)
        .fill(null)
        .map((_, i) => ({
          confidence: 0.9,
          correct: i < 9, // 9 out of 10 correct = 90%
        })),
    );

    const ece = calculateECE(state);
    expect(ece).toBeGreaterThanOrEqual(0);
    expect(ece).toBeLessThan(0.1); // Should be nearly 0
  });

  it("calculates high ECE for overconfident predictions", () => {
    // Overconfident: 90% confident, only 50% correct
    addVerifiedPredictions(
      state,
      Array(10)
        .fill(null)
        .map((_, i) => ({
          confidence: 0.9,
          correct: i < 5, // Only 50% correct
        })),
    );

    const ece = calculateECE(state);
    expect(ece).toBeGreaterThan(0.3); // Significant miscalibration
  });

  it("calculates ECE across multiple buckets", () => {
    // Mixed predictions across different confidence levels
    addVerifiedPredictions(state, [
      // Low confidence (0.2-0.3 bucket) - all correct (underconfident)
      { confidence: 0.25, correct: true },
      { confidence: 0.25, correct: true },
      // Medium confidence (0.5-0.6 bucket) - half correct (calibrated)
      { confidence: 0.55, correct: true },
      { confidence: 0.55, correct: false },
      // High confidence (0.8-0.9 bucket) - all wrong (overconfident)
      { confidence: 0.85, correct: false },
      { confidence: 0.85, correct: false },
    ]);

    const ece = calculateECE(state);
    expect(ece).toBeGreaterThan(0);
    expect(ece).toBeLessThan(1);
  });
});

// ============================================================
// Stats Calculation Tests
// ============================================================

describe("calculateStats", () => {
  let state: CalibrationLogState;

  beforeEach(() => {
    state = createTestState();
  });

  it("calculates comprehensive stats", () => {
    addVerifiedPredictions(state, [
      { confidence: 0.9, correct: true },
      { confidence: 0.8, correct: true },
      { confidence: 0.7, correct: false },
      { confidence: 0.6, correct: true },
      { confidence: 0.5, correct: false },
    ]);

    const stats = calculateStats(state);

    expect(stats.totalPredictions).toBe(5);
    expect(stats.verifiedPredictions).toBe(5);
    expect(stats.correct).toBe(3);
    expect(stats.incorrect).toBe(2);
    expect(stats.avgConfidence).toBeCloseTo(0.7, 1);
    expect(stats.avgAccuracy).toBeCloseTo(0.6, 1);
    expect(stats.overconfidenceDelta).toBeCloseTo(0.1, 1); // Slightly overconfident
  });

  it("handles partial outcomes", () => {
    const entry = logPrediction(state, "claim", 0.6, "r", "s", 0);
    recordOutcome(state, entry.id, "partial");

    const stats = calculateStats(state);
    expect(stats.partial).toBe(1);
    expect(stats.avgAccuracy).toBe(0.5); // Partial counts as 0.5
  });

  it("builds accuracy by bucket map", () => {
    addVerifiedPredictions(state, [
      { confidence: 0.85, correct: true },
      { confidence: 0.82, correct: true },
      { confidence: 0.88, correct: false },
    ]);

    const stats = calculateStats(state);
    const bucket = stats.accuracyByBucket.get("0.8-0.9");

    expect(bucket).toBeDefined();
    expect(bucket!.total).toBe(3);
    expect(bucket!.correct).toBe(2);
  });
});

// ============================================================
// Warning Format Tests
// ============================================================

describe("formatCalibrationWarning", () => {
  let state: CalibrationLogState;

  beforeEach(() => {
    state = createTestState();
  });

  it("returns null with insufficient data", () => {
    addVerifiedPredictions(state, [{ confidence: 0.9, correct: true }]);

    const stats = calculateStats(state);
    const warning = formatCalibrationWarning(stats);

    expect(warning).toBeNull();
  });

  it("warns about significant miscalibration", () => {
    // Very overconfident
    addVerifiedPredictions(
      state,
      Array(15)
        .fill(null)
        .map(() => ({
          confidence: 0.9,
          correct: false,
        })),
    );

    const stats = calculateStats(state);
    const warning = formatCalibrationWarning(stats);

    expect(warning).toContain("calibration warning");
    expect(warning).toContain("overconfident");
  });

  it("gives notice for slight miscalibration", () => {
    // Slightly overconfident
    addVerifiedPredictions(
      state,
      Array(15)
        .fill(null)
        .map((_, i) => ({
          confidence: 0.75,
          correct: i < 9, // 60% correct at 75% confidence
        })),
    );

    const stats = calculateStats(state);
    const warning = formatCalibrationWarning(stats);

    expect(warning).toContain("calibration");
  });

  it("reports well-calibrated state", () => {
    // Well calibrated
    addVerifiedPredictions(
      state,
      Array(15)
        .fill(null)
        .map((_, i) => ({
          confidence: 0.6,
          correct: i < 9, // 60% correct at 60% confidence
        })),
    );

    const stats = calculateStats(state);
    const warning = formatCalibrationWarning(stats);

    if (warning) {
      expect(warning).toContain("well calibrated");
    }
  });
});

// ============================================================
// Persistence Tests
// ============================================================

describe("persistence", () => {
  let state: CalibrationLogState;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "calibration-persist-"));
    state = initCalibrationLog(tempDir);
  });

  it("saves and loads round-trip", () => {
    logPrediction(state, "claim 1", 0.5, "reason 1", "s1", 0);
    const entry2 = logPrediction(state, "claim 2", 0.8, "reason 2", "s1", 1);
    recordOutcome(state, entry2.id, "correct", "verified");

    saveLog(state);

    // Create fresh state and load
    const newState = initCalibrationLog(tempDir);
    loadLog(newState);

    expect(newState.entries.length).toBe(2);
    expect(newState.entries[0].claim).toBe("claim 1");
    expect(newState.entries[1].verified).toBe(true);
    expect(newState.entries[1].outcome).toBe("correct");
  });

  it("appends single entries", () => {
    const entry = logPrediction(state, "single claim", 0.6, "r", "s", 0);
    appendToLog(state, entry);

    // Load in new state
    const newState = initCalibrationLog(tempDir);
    loadLog(newState);

    expect(newState.entries.length).toBe(1);
    expect(newState.entries[0].claim).toBe("single claim");
  });

  it("handles missing file gracefully", () => {
    const emptyState = initCalibrationLog(tempDir);
    loadLog(emptyState);

    expect(emptyState.entries).toEqual([]);
  });

  it("handles corrupted file gracefully", () => {
    // Write garbage
    const logPath = path.join(tempDir, "calibration-log.jsonl");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, "not valid json\n{broken");

    const corruptState = initCalibrationLog(tempDir);
    loadLog(corruptState);

    expect(corruptState.entries).toEqual([]);
  });
});

// ============================================================
// Utility Tests
// ============================================================

describe("utilities", () => {
  let state: CalibrationLogState;

  beforeEach(() => {
    state = createTestState();
  });

  it("gets recent entries with limit", () => {
    for (let i = 0; i < 30; i++) {
      logPrediction(state, `claim ${i}`, 0.5, "r", "s", i);
    }

    const recent = getRecentEntries(state, 10);

    expect(recent.length).toBe(10);
    expect(recent[0].claim).toBe("claim 20");
    expect(recent[9].claim).toBe("claim 29");
  });

  it("prunes old entries keeping most recent", () => {
    for (let i = 0; i < 100; i++) {
      logPrediction(state, `claim ${i}`, 0.5, "r", "s", i);
    }

    const removed = pruneOldEntries(state, 30);

    expect(removed).toBe(70);
    expect(state.entries.length).toBe(30);
    expect(state.entries[0].claim).toBe("claim 70");
  });

  it("does not prune if under limit", () => {
    logPrediction(state, "only claim", 0.5, "r", "s", 0);

    const removed = pruneOldEntries(state, 100);

    expect(removed).toBe(0);
    expect(state.entries.length).toBe(1);
  });
});
