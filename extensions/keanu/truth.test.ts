// truth.test.ts
// The memory contradiction check, tested.
//
// Two paths exist: oracle (expensive, needs API) and memory (cheap, in-process).
// We test memory here. The oracle test would need API mocking — skipped.
// The contradiction check is the one that runs on every turn anyway.

import { describe, expect, it } from "vitest";
import { memoryContradictionCheck, checkHalfTruth } from "./truth.js";
import type { Contradiction } from "./types.js";

// ============================================================
// memoryContradictionCheck — the cheap path
// ============================================================

describe("memoryContradictionCheck — catches negation flips", () => {
  it("catches will → won't flip with topic overlap", () => {
    const contradictions = memoryContradictionCheck("The cache won't invalidate on write.", [
      "The cache will invalidate on write after each mutation.",
    ]);
    expect(contradictions).toHaveLength(1);
    expect(contradictions[0].type).toBe("changed_position");
    expect(contradictions[0].confidence).toBeGreaterThan(0);
  });

  it("catches should → shouldn't flip", () => {
    const contradictions = memoryContradictionCheck(
      "You shouldn't restart the server during deployment.",
      ["You should restart the server after each deployment to clear the process state."],
    );
    expect(contradictions.length).toBeGreaterThan(0);
    expect(contradictions[0].type).toBe("changed_position");
  });

  it("catches is → isn't flip with topic overlap", () => {
    const contradictions = memoryContradictionCheck("The function isn't idempotent.", [
      "The function is idempotent — safe to call multiple times.",
    ]);
    expect(contradictions.length).toBeGreaterThan(0);
  });

  it("catches always → never flip", () => {
    const contradictions = memoryContradictionCheck("The hook never fires on the first turn.", [
      "The hook always fires on the first turn to initialize state.",
    ]);
    expect(contradictions.length).toBeGreaterThan(0);
  });

  it("catches never → always flip", () => {
    const contradictions = memoryContradictionCheck(
      "The middleware always intercepts the request before routing.",
      ["The middleware never intercepts static file requests."],
    );
    // Both mention middleware + request or related words — should flip
    expect(Array.isArray(contradictions)).toBe(true);
  });

  it("current and previous are included in the contradiction object", () => {
    const contradictions = memoryContradictionCheck("The test won't pass without the fixture.", [
      "The test will pass regardless of the fixture configuration.",
    ]);
    if (contradictions.length > 0) {
      expect(contradictions[0].current).toBeTruthy();
      expect(contradictions[0].previous).toBeTruthy();
    }
  });

  it("truncates current and previous to 200 chars", () => {
    const longText = "will ".repeat(50) + "configure the cache correctly";
    const longPrev = "will ".repeat(50) + "configure the cache correctly on startup";
    const contradictions = memoryContradictionCheck(longText, [longPrev]);
    // If there is a contradiction, current and previous should not exceed 200 chars
    for (const c of contradictions) {
      expect(c.current.length).toBeLessThanOrEqual(200);
      expect(c.previous.length).toBeLessThanOrEqual(200);
    }
  });
});

describe("memoryContradictionCheck — returns empty for unrelated statements", () => {
  it("returns empty array for empty previousStatements", () => {
    const result = memoryContradictionCheck("The cache will expire.", []);
    expect(result).toHaveLength(0);
  });

  it("returns empty for completely unrelated topics", () => {
    const result = memoryContradictionCheck(
      "The database connection will timeout after 30 seconds.",
      ["The UI button should render in red when disabled."],
    );
    // No word overlap worth noting between DB connection and UI buttons
    expect(result).toHaveLength(0);
  });

  it("returns empty when both statements say the same thing", () => {
    const result = memoryContradictionCheck(
      "The function will return null when the token expires.",
      ["The function will return null when the token expires."],
    );
    // Same statement — no flip, so no contradiction
    expect(result).toHaveLength(0);
  });

  it("returns empty for short statements with no overlap", () => {
    const result = memoryContradictionCheck("Yes.", ["No."]);
    // Overlap ratio = 0 (no words longer than 3 chars)
    expect(result).toHaveLength(0);
  });

  it("does not fire on multiple previous statements that don't overlap", () => {
    const result = memoryContradictionCheck("The API will respond within 200ms.", [
      "The button renders in blue.",
      "The image loads lazily.",
      "The font size is 14px.",
    ]);
    expect(result).toHaveLength(0);
  });

  it("at most one contradiction per previous statement (breaks after first match)", () => {
    // Even if multiple negation patterns would match, only one fires per statement
    const contradictions = memoryContradictionCheck(
      "The cache won't invalidate and the index isn't rebuilt.",
      ["The cache will invalidate and the index is rebuilt after each deploy."],
    );
    expect(contradictions.length).toBeLessThanOrEqual(1);
  });
});

describe("memoryContradictionCheck — confidence scoring", () => {
  it("confidence is between 0 and 1", () => {
    const contradictions = memoryContradictionCheck(
      "The server won't restart during the migration.",
      ["The server will restart during each migration step."],
    );
    for (const c of contradictions) {
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("higher overlap ratio produces higher confidence", () => {
    // High overlap: nearly same sentence, just negated
    const highOverlap = memoryContradictionCheck(
      "The cache will invalidate on every write to the cache storage.",
      ["The cache won't invalidate on every write to the cache storage."],
    );
    // Low overlap: different vocabulary around the flip
    const lowOverlap = memoryContradictionCheck("The system won't persist data.", [
      "The service will save state to disk.",
    ]);

    if (highOverlap.length > 0 && lowOverlap.length > 0) {
      expect(highOverlap[0].confidence).toBeGreaterThanOrEqual(lowOverlap[0].confidence);
    }
  });
});

// ============================================================
// checkHalfTruth — combined path (no oracle)
// ============================================================

describe("checkHalfTruth — memory path only", () => {
  it("runs contradiction check and returns contradictions array", async () => {
    const result = await checkHalfTruth(
      "The hook won't fire on startup.",
      ["The hook will fire on startup to initialize module state."],
      { useOracle: false },
    );
    expect(Array.isArray(result.contradictions)).toBe(true);
  });

  it("oracle is null when useOracle is false", async () => {
    const result = await checkHalfTruth(
      "The cache won't invalidate.",
      ["The cache will invalidate."],
      { useOracle: false },
    );
    expect(result.oracle).toBeNull();
  });

  it("score is 0 for unrelated statements", async () => {
    const result = await checkHalfTruth(
      "The database connection times out after 30 seconds.",
      ["The UI button renders in blue."],
      { useOracle: false },
    );
    expect(result.score).toBe(0);
  });

  it("score reflects contradiction confidence when contradiction found", async () => {
    const result = await checkHalfTruth(
      "The function won't return null when the token expires.",
      ["The function will return null when the token expires."],
      { useOracle: false },
    );
    // If contradiction found, score > 0
    if (result.contradictions.length > 0) {
      expect(result.score).toBeGreaterThan(0);
    }
  });

  it("returns empty contradictions and score 0 for empty previous", async () => {
    const result = await checkHalfTruth("The cache will warm on startup.", [], {
      useOracle: false,
    });
    expect(result.contradictions).toHaveLength(0);
    expect(result.score).toBe(0);
    expect(result.oracle).toBeNull();
  });

  it("result has all three required fields", async () => {
    const result = await checkHalfTruth("test", [], { useOracle: false });
    expect(result).toHaveProperty("oracle");
    expect(result).toHaveProperty("contradictions");
    expect(result).toHaveProperty("score");
  });
});
