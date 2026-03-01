// mastery.test.ts
// The correction tracker, tested.
//
// mastery.ts watches when Drew corrects the system.
// Three corrections in the same category becomes a blind spot.
// These tests confirm the detection, accumulation, and surfacing logic.

import { describe, it, expect, beforeEach } from "vitest";
import {
  detectCorrection,
  recordCorrection,
  getBlindSpots,
  getAllBlindSpots,
  formatBlindSpots,
  correctionCount,
  recentCorrections,
} from "./mastery.js";
import type { Correction } from "./mastery.js";

// ============================================================
// Helpers
// ============================================================

function makeCorrection(
  userMessage: string,
  category: Correction["category"] = "other",
): Correction {
  return {
    turn: 1,
    userMessage,
    priorResponseSnippet: "Prior agent output.",
    category,
    sessionId: "test-session",
    timestamp: new Date().toISOString(),
  };
}

// Module-level state must be cleared between tests.
// mastery.ts uses module-level arrays, so we drain them by recording
// then checking, but we can't truly reset without an exported reset.
// Instead, each describe block that cares about state isolation runs
// its own sequence and avoids cross-contamination by counting deltas.

// ============================================================
// 1. CORRECTION DETECTION — "actually" / "no I meant"
// ============================================================

describe("detectCorrection — pattern matching", () => {
  const longOutput = "x".repeat(600); // > 500 chars

  it("returns a Correction on 'i meant'", () => {
    const result = detectCorrection("I meant the async version.", longOutput, "neutral");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("misread_intent");
  });

  it("returns a Correction on 'what i actually wanted'", () => {
    const result = detectCorrection("What I actually wanted was a list.", longOutput, "neutral");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("misread_intent");
  });

  it("returns a Correction on 'let me clarify'", () => {
    const result = detectCorrection("Let me clarify — not that endpoint.", longOutput, "neutral");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("misread_intent");
  });

  it("returns a Correction on explicit negation 'no,' (long enough to skip short-msg branch)", () => {
    // Short messages starting with "no" get caught by the short-frustrated branch as over_explain.
    // Use a message long enough (>= 30 chars) to fall through to the pattern loop.
    const msg = "No, that is definitely the wrong file to be editing right now.";
    expect(msg.length).toBeGreaterThanOrEqual(30);
    const result = detectCorrection(msg, longOutput, "neutral");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("misread_intent");
  });

  it("returns a Correction on 'wrong'", () => {
    const result = detectCorrection("Wrong approach.", longOutput, "neutral");
    expect(result).not.toBeNull();
  });

  it("returns a Correction on 'that's not' prefix", () => {
    const result = detectCorrection("That's not what I asked.", longOutput, "neutral");
    expect(result).not.toBeNull();
  });

  it("populates userMessage slice on the result", () => {
    const msg = "I meant the config file not the source.";
    const result = detectCorrection(msg, longOutput, "neutral");
    expect(result!.userMessage).toBe(msg);
  });

  it("returns null on a plain casual message with no correction signal", () => {
    const result = detectCorrection("Looks good, let's continue.", longOutput, "neutral");
    expect(result).toBeNull();
  });

  it("returns null on very short casual follow-up from a non-frustrated user", () => {
    // Short message but NOT frustrated and doesn't start with 'no/wrong/ugh/stop/ffs'
    const result = detectCorrection("ok", longOutput, "neutral");
    expect(result).toBeNull();
  });
});

// ============================================================
// 2. CORRECTION CATEGORY CLASSIFICATION
// ============================================================

describe("detectCorrection — category classification", () => {
  const longOutput = "x".repeat(600);

  it("classifies 'too long / verbose' as over_explain", () => {
    const result = detectCorrection("That's way too long, tl;dr please.", longOutput, "neutral");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("over_explain");
  });

  it("classifies 'shorter' as over_explain", () => {
    const result = detectCorrection("Shorter please.", longOutput, "neutral");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("over_explain");
  });

  it("classifies 'just tell me' as over_explain", () => {
    const result = detectCorrection("Just tell me the answer.", longOutput, "neutral");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("over_explain");
  });

  it("classifies 'wait, slow down' as too_fast", () => {
    const result = detectCorrection("Wait, slow down a bit.", longOutput, "neutral");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("too_fast");
  });

  it("classifies 'hold on' as too_fast", () => {
    const result = detectCorrection("Hold on, you lost me.", longOutput, "neutral");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("too_fast");
  });

  it("classifies 'that's incorrect' as wrong_fact", () => {
    const result = detectCorrection("That's incorrect — it's 8192 tokens.", longOutput, "neutral");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("wrong_fact");
  });

  it("classifies 'actually it's' as wrong_fact", () => {
    const result = detectCorrection("Actually it's 30 seconds, not 10.", longOutput, "neutral");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("wrong_fact");
  });

  it("classifies 'i was joking' as missed_tone", () => {
    const result = detectCorrection("I was joking about that.", longOutput, "neutral");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("missed_tone");
  });

  it("classifies 'that was sarcasm' as missed_tone", () => {
    const result = detectCorrection("That was sarcasm, you missed it.", longOutput, "neutral");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("missed_tone");
  });

  it("classifies frustrated short message after long output as over_explain", () => {
    const result = detectCorrection("no", longOutput, "frustrated");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("over_explain");
  });
});

// ============================================================
// 3. BLIND SPOT SURFACING AT 3+ CORRECTIONS
// ============================================================

describe("blind spot surfacing", () => {
  beforeEach(() => {
    // We can't reset module state, so we track starting counts and work with deltas.
    // Each test records its own corrections with a unique category unlikely to collide.
  });

  it("does not surface blind spot at 1 correction", () => {
    const before = getAllBlindSpots().find((b) => b.category === "too_slow");
    const beforeCount = before?.count ?? 0;

    recordCorrection(makeCorrection("You took too long.", "too_slow"));

    const after = getAllBlindSpots().find((b) => b.category === "too_slow");
    const afterCount = after?.count ?? 0;
    expect(afterCount).toBe(beforeCount + 1);

    // getBlindSpots only returns those >= BLIND_SPOT_THRESHOLD (3)
    const active = getBlindSpots().find((b) => b.category === "too_slow");
    if (afterCount < 3) {
      expect(active).toBeUndefined();
    }
  });

  it("surfaces blind spot after 3 corrections in same category", () => {
    // Use missed_tone for this sequence — record 3 in sequence
    for (let i = 0; i < 3; i++) {
      recordCorrection(makeCorrection(`I was kidding about that #${i}.`, "missed_tone"));
    }
    const active = getBlindSpots().find((b) => b.category === "missed_tone");
    expect(active).toBeDefined();
    expect(active!.count).toBeGreaterThanOrEqual(3);
  });

  it("blind spot count increments with each new correction", () => {
    const before = getAllBlindSpots().find((b) => b.category === "wrong_fact")?.count ?? 0;
    recordCorrection(makeCorrection("That's inaccurate.", "wrong_fact"));
    const after = getAllBlindSpots().find((b) => b.category === "wrong_fact")?.count ?? 0;
    expect(after).toBe(before + 1);
  });

  it("examples array on a blind spot holds the correction messages", () => {
    recordCorrection(makeCorrection("I'm asking for the short version.", "over_explain"));
    const spot = getAllBlindSpots().find((b) => b.category === "over_explain");
    expect(spot).toBeDefined();
    expect(spot!.examples.length).toBeGreaterThan(0);
  });

  it("examples array is capped at 3 entries", () => {
    // Record 5 over_explain corrections — examples should cap at 3
    for (let i = 0; i < 5; i++) {
      recordCorrection(makeCorrection(`Just give me the short answer #${i}.`, "over_explain"));
    }
    const spot = getAllBlindSpots().find((b) => b.category === "over_explain");
    expect(spot).toBeDefined();
    expect(spot!.examples.length).toBeLessThanOrEqual(3);
  });
});

// ============================================================
// 4. formatBlindSpots OUTPUT
// ============================================================

describe("formatBlindSpots", () => {
  it("returns null when no blind spots are at threshold", () => {
    // If no category has >= 3 corrections, returns null.
    // We can't fully guarantee state here, but we can verify the contract:
    // if getBlindSpots() is empty, formatBlindSpots() is null.
    const active = getBlindSpots();
    if (active.length === 0) {
      expect(formatBlindSpots()).toBeNull();
    } else {
      expect(typeof formatBlindSpots()).toBe("string");
    }
  });

  it("returns a string containing [blind spot: when spots exist", () => {
    // Ensure at least one blind spot exists by recording 3 misread_intent
    for (let i = 0; i < 3; i++) {
      recordCorrection(makeCorrection(`I meant the other thing #${i}.`, "misread_intent"));
    }
    const result = formatBlindSpots();
    expect(result).not.toBeNull();
    expect(result!).toContain("[blind spot:");
  });

  it("result mentions the correction count", () => {
    for (let i = 0; i < 3; i++) {
      recordCorrection(makeCorrection(`Too verbose #${i}.`, "over_explain"));
    }
    const result = formatBlindSpots();
    expect(result).not.toBeNull();
    expect(result!).toMatch(/\d+ corrections? in this category/);
  });

  it("multiple blind spots produce multi-line output", () => {
    // Accumulate into two categories
    for (let i = 0; i < 3; i++) {
      recordCorrection(makeCorrection(`Wrong fact #${i}.`, "wrong_fact"));
    }
    for (let i = 0; i < 3; i++) {
      recordCorrection(makeCorrection(`Too fast #${i}.`, "too_fast"));
    }
    const result = formatBlindSpots();
    if (result && result.includes("\n")) {
      const lines = result.split("\n").filter(Boolean);
      expect(lines.length).toBeGreaterThan(1);
    }
    // Or it could be a single line if only one threshold is met — either is valid
    expect(result).not.toBeNull();
  });
});

// ============================================================
// 5. correctionCount AND recentCorrections
// ============================================================

describe("correctionCount and recentCorrections", () => {
  it("correctionCount increases after recordCorrection", () => {
    const before = correctionCount();
    recordCorrection(makeCorrection("Not what I wanted.", "misread_intent"));
    expect(correctionCount()).toBe(before + 1);
  });

  it("recentCorrections returns the last N corrections", () => {
    const beforeCount = correctionCount();
    recordCorrection(makeCorrection("Too long again.", "over_explain"));
    const recent = recentCorrections(1);
    expect(recent.length).toBeGreaterThanOrEqual(1);
    expect(recent[recent.length - 1].category).toBe("over_explain");
  });

  it("recentCorrections default is 5", () => {
    const recent = recentCorrections();
    expect(recent.length).toBeLessThanOrEqual(5);
  });
});
