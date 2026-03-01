// calibrate.test.ts
// The better thermometer, tested.
//
// Tests confirm the CC: protocol fires on the right signals —
// version claims, absolutes, recommendations — and stays quiet
// on casual conversation. The format is the message.
//
// Threshold note: at highComplexity=false, extracted.length must be > 1
// (two distinct claim categories) to trigger. At highComplexity=true,
// threshold=0, so a single extraction is enough. We use highComplexity=true
// when testing individual pattern detection in isolation.

import { describe, it, expect } from "vitest";
import {
  checkCalibration,
  formatCalibration,
  trackCalibrationClaims,
  formatCalibrationDelta,
} from "./calibrate.js";
import type { CalibrationReading } from "./calibrate.js";

// ============================================================
// Helpers
// ============================================================

/** Pad a string to at least 51 chars so the length guard passes. */
function pad(text: string): string {
  return text.length >= 51 ? text : text + " ".repeat(51 - text.length);
}

// ============================================================
// 1. VERSION CLAIMS
// ============================================================

describe("version claim detection", () => {
  it("triggers on a plain version number claim (highComplexity=true)", () => {
    // highComplexity=true → threshold=0, a single version extraction is enough
    const output = pad("Node 20.1.0 supports the fetch API natively without any flags.");
    const reading = checkCalibration(output, "does node support fetch?", true);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("factual_claim");
  });

  it("claims array includes the detected version string", () => {
    const output = pad("You should use React v18.2.0 or later for concurrent features.");
    const reading = checkCalibration(output, "which react version?", true);
    expect(reading.triggered).toBe(true);
    const hasVersionClaim = reading.claims.some((c) => c.includes("version"));
    expect(hasVersionClaim).toBe(true);
  });

  it("triggers on version combined with recommendation (highComplexity=false)", () => {
    // Two patterns: recommendation + factual_claim (version) → extracted.length=2 > threshold=1
    const output = pad(
      "I recommend upgrading from v16.8.0 to v18.2.0 for concurrent mode support.",
    );
    const reading = checkCalibration(output, "upgrade path?", false);
    expect(reading.triggered).toBe(true);
  });

  it("high complexity lowers threshold — single version claim triggers", () => {
    const output = pad("Node 18.0 ships with experimental vm.Module support.");
    const reading = checkCalibration(output, "does node support vm.Module?", true);
    expect(reading.triggered).toBe(true);
  });
});

// ============================================================
// 2. ABSOLUTE LANGUAGE
// ============================================================

describe("absolute language detection", () => {
  it("triggers when two or more absolute terms appear (highComplexity=true)", () => {
    // absolute_language fires when absolutes.length >= 2 inside extractClaims.
    // At highComplexity=true, one extracted entry is enough to trigger.
    const output = pad("This approach is always correct and never fails in any production system.");
    const reading = checkCalibration(output, "is this approach correct?", true);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("absolute_language");
  });

  it("triggers via absolute + recommendation combined (highComplexity=false)", () => {
    // "you should" (recommendation) + "always"+"never" (absolute_language) = 2 extractions
    const output = pad(
      "You should always sanitize inputs and never trust user data under any circumstances.",
    );
    const reading = checkCalibration(output, "how should I handle inputs?", false);
    expect(reading.triggered).toBe(true);
  });

  it("prompt includes the CC: absolute_language context", () => {
    const output = pad("This approach is always correct and never fails in any production system.");
    const reading = checkCalibration(output, "is this approach correct?", true);
    expect(reading.triggered).toBe(true);
    expect(reading.prompt).toContain("CC:");
    expect(reading.prompt).toContain("absolute");
  });

  it("single absolute term does NOT trigger (extractClaims requires >= 2 absolute matches)", () => {
    // "always" alone = 1 absolute → absolute_language not extracted.
    // No other patterns fire. extracted.length=0 → no trigger even at highComplexity=true.
    const output = pad(
      "This configuration always applies to the environment. Update the docs accordingly please.",
    );
    const reading = checkCalibration(output, "does this always apply?", true);
    expect(reading.triggered).toBe(false);
  });

  it("CAPITALISED absolute terms are caught (case-insensitive regex)", () => {
    // ALWAYS + NEVER + ALL + must = 4 absolute matches → absolute_language fires
    const output = pad(
      "ALWAYS validate. NEVER skip. ALL inputs must be checked before proceeding.",
    );
    const reading = checkCalibration(output, "how to validate?", true);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("absolute_language");
  });
});

// ============================================================
// 3. RECOMMENDATIONS
// ============================================================

describe("recommendation detection", () => {
  it("triggers on 'you should use X' (highComplexity=true)", () => {
    const output = pad("You should use PostgreSQL here, it handles this workload better.");
    const reading = checkCalibration(output, "which database?", true);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("recommendation");
  });

  it("triggers on 'I recommend' (highComplexity=true)", () => {
    const output = pad("I recommend switching to pnpm. It has better workspace support than npm.");
    const reading = checkCalibration(output, "which package manager?", true);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("recommendation");
  });

  it("triggers on 'the best approach' (highComplexity=true)", () => {
    const output = pad("The best approach here is to separate concerns into discrete modules.");
    const reading = checkCalibration(output, "how to structure this?", true);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("recommendation");
  });

  it('triggers on "I\'d suggest" (highComplexity=true)', () => {
    const output = pad("I'd suggest starting with a prototype before committing to this design.");
    const reading = checkCalibration(output, "should I build this?", true);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("recommendation");
  });

  it("prompt for recommendation includes CC: protocol elements", () => {
    const output = pad("I recommend using vitest over jest for this project and team setup.");
    const reading = checkCalibration(output, "which test runner?", true);
    expect(reading.triggered).toBe(true);
    expect(reading.prompt).toContain("CC:");
    expect(reading.prompt).toContain("evidence");
    expect(reading.prompt).toContain("downsides");
  });
});

// ============================================================
// 4. NO TRIGGER ON CASUAL CONVERSATION
// ============================================================

describe("no trigger on casual conversation", () => {
  it("does not trigger on a short output (under 50 chars)", () => {
    const reading = checkCalibration("Sure, sounds good!", "ok?", false);
    expect(reading.triggered).toBe(false);
    expect(reading.reason).toBeNull();
    expect(reading.prompt).toBeNull();
  });

  it("does not trigger on plain descriptive text with no claim patterns", () => {
    const output = pad(
      "The function reads from the queue, processes each item, and writes results to disk.",
    );
    const reading = checkCalibration(output, "how does this work?", false);
    expect(reading.triggered).toBe(false);
  });

  it("does not trigger on a benign agent output with empty human message", () => {
    const output = pad("Happy to look at that. Share the file when you are ready.");
    const reading = checkCalibration(output, "", false);
    expect(reading.triggered).toBe(false);
  });

  it("does not trigger even at highComplexity=true when no patterns match", () => {
    const output = pad("The handler dispatches the event to all registered listeners in order.");
    const reading = checkCalibration(output, "what does the handler do?", true);
    expect(reading.triggered).toBe(false);
  });
});

// ============================================================
// 5. CONTRADICTION PATH
// ============================================================
//
// Contradiction is checked AFTER the threshold guard. An agent output
// that only matches DISAGREEMENT_WITH_HUMAN but no other extractable
// patterns will fail the threshold check and not trigger. We need to
// include extractable content alongside the disagreement language.

describe("contradiction detection", () => {
  it("triggers contradiction: DISAGREEMENT_WITH_HUMAN match + at least one extraction", () => {
    // DISAGREEMENT_WITH_HUMAN = /\b(actually|that's not quite|not exactly|i'd push back|i disagree)\b/
    // The contradiction check is AFTER the threshold guard, so we need at least one extraction.
    // "i'd suggest" hits RECOMMENDATIONS (extraction #1).
    // "actually" hits DISAGREEMENT_WITH_HUMAN → contradiction fires.
    const output = pad(
      "Actually I'd suggest the other approach. The default timeout is 30s not 10s.",
    );
    const reading = checkCalibration(output, "is it 10 seconds?", true);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("contradiction");
  });

  it("contradiction prompt contains CC: and evidence", () => {
    // "i disagree" hits DISAGREEMENT_WITH_HUMAN. "you should" hits RECOMMENDATIONS (extraction).
    const output = pad("I disagree with that. You should use the async version here instead.");
    const reading = checkCalibration(output, "which version?", true);
    expect(reading.triggered).toBe(true);
    expect(reading.prompt).toContain("CC:");
    expect(reading.prompt).toContain("evidence");
  });
});

// ============================================================
// 6. FORMAT
// ============================================================

describe("formatCalibration", () => {
  it("returns the prompt string when triggered", () => {
    const output = pad("You should always use TypeScript and never write plain JavaScript.");
    const reading = checkCalibration(output, "typescript?", true);
    const formatted = formatCalibration(reading);
    expect(formatted).toBe(reading.prompt);
    expect(typeof formatted).toBe("string");
  });

  it("returns null when not triggered", () => {
    const reading = checkCalibration("ok", "", false);
    expect(formatCalibration(reading)).toBeNull();
  });

  it("prompt always starts with [CC: when triggered", () => {
    const output = pad("I recommend using vitest over jest for this project and team setup.");
    const reading = checkCalibration(output, "which test runner?", true);
    expect(reading.triggered).toBe(true);
    expect(reading.prompt!.startsWith("[CC:")).toBe(true);
  });
});

// ============================================================
// 7. trackCalibrationClaims
// ============================================================

describe("trackCalibrationClaims", () => {
  it("calls trackClaim for each claim when triggered", () => {
    const output = pad("You should always use strict mode and never disable it in production.");
    const reading = checkCalibration(output, "strict mode?", false);
    const calls: Array<{ text: string; confidence: number; session: string }> = [];
    trackCalibrationClaims(reading, "session-001", (text, confidence, session) => {
      calls.push({ text, confidence, session });
    });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].session).toBe("session-001");
  });

  it("does not call trackClaim when not triggered", () => {
    const reading: CalibrationReading = {
      triggered: false,
      reason: null,
      claims: [],
      prompt: null,
    };
    let called = false;
    trackCalibrationClaims(reading, "session-002", () => {
      called = true;
    });
    expect(called).toBe(false);
  });

  it("uses confidence 2 for external_state claims", () => {
    const reading: CalibrationReading = {
      triggered: true,
      reason: "external_state",
      claims: ["asserts external state"],
      prompt: "[CC: asserting external state | C:? | ...]",
    };
    const calls: Array<{ confidence: number }> = [];
    trackCalibrationClaims(reading, "session-003", (_text, confidence) => {
      calls.push({ confidence });
    });
    expect(calls[0].confidence).toBe(2);
  });

  it("uses confidence 4 for absolute_language claims", () => {
    const reading: CalibrationReading = {
      triggered: true,
      reason: "absolute_language",
      claims: ["2 absolute terms: always, never"],
      prompt: "[CC: using absolute language | C:? | ...]",
    };
    const calls: Array<{ confidence: number }> = [];
    trackCalibrationClaims(reading, "session-004", (_text, confidence) => {
      calls.push({ confidence });
    });
    expect(calls[0].confidence).toBe(4);
  });

  it("uses confidence 3 for recommendation claims", () => {
    const reading: CalibrationReading = {
      triggered: true,
      reason: "recommendation",
      claims: ["you should use Redis"],
      prompt: "[CC: recommendation | C:? | ...]",
    };
    const calls: Array<{ confidence: number }> = [];
    trackCalibrationClaims(reading, "session-005", (_text, confidence) => {
      calls.push({ confidence });
    });
    expect(calls[0].confidence).toBe(3);
  });

  it("tracks at most 3 claims even when more exist", () => {
    const reading: CalibrationReading = {
      triggered: true,
      reason: "factual_claim",
      claims: ["claim-1", "claim-2", "claim-3", "claim-4", "claim-5"],
      prompt: "[CC: factual claim | C:? | ...]",
    };
    const calls: Array<unknown> = [];
    trackCalibrationClaims(reading, "session-006", () => {
      calls.push(true);
    });
    expect(calls.length).toBeLessThanOrEqual(3);
  });
});

// ============================================================
// formatCalibrationDelta — accuracy vs confidence warnings
// ============================================================

describe("formatCalibrationDelta", () => {
  it("returns null when delta is small (<10%)", () => {
    const result = formatCalibrationDelta(0.7, 0.75); // 5% overconfident
    expect(result).toBeNull();
  });

  it("warns about significant overconfidence (>20%)", () => {
    const result = formatCalibrationDelta(0.5, 0.8); // 30% overconfident
    expect(result).toContain("overconfident");
    expect(result).toContain("dial back");
  });

  it("warns about slight overconfidence (10-20%)", () => {
    const result = formatCalibrationDelta(0.6, 0.75); // 15% overconfident
    expect(result).toContain("slight overconfidence");
  });

  it("encourages when underconfident (>20%)", () => {
    const result = formatCalibrationDelta(0.9, 0.6); // 30% underconfident
    expect(result).toContain("underconfident");
    expect(result).toContain("trust yourself");
  });

  it("notes slight underconfidence (10-20%)", () => {
    const result = formatCalibrationDelta(0.8, 0.65); // 15% underconfident
    expect(result).toContain("slight underconfidence");
  });
});
