import { describe, it, expect } from "vitest";
import { detectMismatch, formatMismatch } from "./mismatch.js";
import type { HumanReading, BullshitReading } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers — build minimal HumanReading and BullshitReading fixtures
// ---------------------------------------------------------------------------

function humanReading(
  tone: HumanReading["tone"],
  opts: Partial<Pick<HumanReading, "confidence" | "signals">> = {},
): HumanReading {
  return {
    tone,
    tones: [{ tone, score: 0.8, meaning: "test" }],
    confidence: opts.confidence ?? 0.7,
    signals: opts.signals ?? [],
    bullshit: [],
  };
}

function bullshit(type: BullshitReading["type"], score: number): BullshitReading {
  return { type, score, signals: [] };
}

const noBullshit: BullshitReading[] = [];

// ---------------------------------------------------------------------------
// 1. comfort_not_truth
// ---------------------------------------------------------------------------

describe("comfort_not_truth detection", () => {
  it("detects when frustrated human gets soothing response", () => {
    const output = "It's okay, don't worry about it. These things happen.";
    const human = humanReading("frustrated");
    const reading = detectMismatch(output, human, noBullshit);
    expect(reading.detected).toBe(true);
    expect(reading.type).toBe("comfort_not_truth");
  });

  it("detects when frustrated human gets sycophantic agent response", () => {
    const output = "You're absolutely right to feel that way. I'd be happy to help fix this.";
    const human = humanReading("frustrated");
    const bs = [bullshit("sycophancy", 0.5)];
    const reading = detectMismatch(output, human, bs);
    expect(reading.detected).toBe(true);
    expect(reading.type).toBe("comfort_not_truth");
  });

  it("humanNeed is 'honesty about what's wrong' for comfort_not_truth", () => {
    const output = "No worries, it's perfectly normal for this to happen.";
    const human = humanReading("frustrated");
    const reading = detectMismatch(output, human, noBullshit);
    expect(reading.humanNeed).toBe("honesty about what's wrong");
  });

  it("agentGave is 'reassurance' for comfort_not_truth", () => {
    const output = "It's okay, this happens to everyone. No worries at all.";
    const human = humanReading("frustrated");
    const reading = detectMismatch(output, human, noBullshit);
    expect(reading.agentGave).toBe("reassurance");
  });

  it("prompt includes 'comfort' and 'truth' keywords", () => {
    const output = "That's fine, don't worry. It happens.";
    const human = humanReading("frustrated");
    const reading = detectMismatch(output, human, noBullshit);
    expect(reading.prompt).toContain("comfort");
    expect(reading.prompt).toContain("truth");
  });

  it("does NOT flag comfort_not_truth when human is not frustrated", () => {
    const output = "It's okay, no worries.";
    const human = humanReading("neutral");
    const reading = detectMismatch(output, human, noBullshit);
    // comfort triggers soothing regex but tone is not frustrated — no match
    expect(reading.type).not.toBe("comfort_not_truth");
  });
});

// ---------------------------------------------------------------------------
// 2. vague_not_specific
// ---------------------------------------------------------------------------

describe("vague_not_specific detection", () => {
  it("detects when confused human gets vague response", () => {
    // vaguenessScore requires text > 200 chars, no numbers/code, no proper nouns
    const vagueOutput =
      "There are many considerations to think about when approaching this topic. " +
      "The general direction involves thinking carefully about the overall approach " +
      "and considering the broader implications of various strategies available. " +
      "Each situation calls for reflection on the context and circumstances.";
    const human = humanReading("confused");
    const bs = [bullshit("vagueness", 0.4)];
    const reading = detectMismatch(vagueOutput, human, bs);
    expect(reading.detected).toBe(true);
    expect(reading.type).toBe("vague_not_specific");
  });

  it("humanNeed is 'concrete specifics' for vague_not_specific", () => {
    const vagueOutput =
      "The considerations here involve thinking about general approaches and " +
      "broader implications while considering various strategies and circumstances " +
      "that might affect the overall direction of the general topic area explored.";
    const human = humanReading("confused");
    const bs = [bullshit("vagueness", 0.4)];
    const reading = detectMismatch(vagueOutput, human, bs);
    expect(reading.humanNeed).toBe("concrete specifics");
  });

  it("agentGave is 'abstract generalities' for vague_not_specific", () => {
    const vagueOutput =
      "Generally speaking, the approach involves careful consideration of the broader " +
      "landscape and thinking through various dimensions that impact the overall strategy " +
      "in ways that require reflection and nuanced understanding of the situation.";
    const human = humanReading("confused");
    const bs = [bullshit("vagueness", 0.4)];
    const reading = detectMismatch(vagueOutput, human, bs);
    expect(reading.agentGave).toBe("abstract generalities");
  });

  it("does NOT flag vague_not_specific when human is not confused", () => {
    const vagueOutput =
      "There are many considerations to think about when approaching this general topic " +
      "and various implications to reflect on carefully given the broader situation here.";
    const human = humanReading("neutral");
    const bs = [bullshit("vagueness", 0.4)];
    const reading = detectMismatch(vagueOutput, human, bs);
    expect(reading.type).not.toBe("vague_not_specific");
  });

  it("does NOT flag vague_not_specific without a vagueness bullshit reading", () => {
    const vagueOutput =
      "There are many considerations to think about when approaching this general topic.";
    const human = humanReading("confused");
    const reading = detectMismatch(vagueOutput, human, noBullshit);
    expect(reading.type).not.toBe("vague_not_specific");
  });
});

// ---------------------------------------------------------------------------
// 3. agree_when_wrong
// ---------------------------------------------------------------------------

describe("agree_when_wrong detection", () => {
  it("detects when agent agrees sycophantically with non-excited human", () => {
    const output = "You're right, absolutely. I completely agree with your assessment.";
    const human = humanReading("neutral");
    const bs = [bullshit("sycophancy", 0.5)];
    const reading = detectMismatch(output, human, bs);
    expect(reading.detected).toBe(true);
    expect(reading.type).toBe("agree_when_wrong");
  });

  it("humanNeed is 'honest feedback' for agree_when_wrong", () => {
    const output = "Exactly right! You're absolutely correct on this.";
    const human = humanReading("neutral");
    const bs = [bullshit("sycophancy", 0.5)];
    const reading = detectMismatch(output, human, bs);
    expect(reading.humanNeed).toBe("honest feedback");
  });

  it("agentGave is 'agreement' for agree_when_wrong", () => {
    const output = "Good point, I agree. Exactly what I was thinking.";
    const human = humanReading("neutral");
    const bs = [bullshit("sycophancy", 0.5)];
    const reading = detectMismatch(output, human, bs);
    expect(reading.agentGave).toBe("agreement");
  });

  it("prompt includes 'agreed quickly' warning", () => {
    const output = "You're right, absolutely. I agree with this completely.";
    const human = humanReading("neutral");
    const bs = [bullshit("sycophancy", 0.5)];
    const reading = detectMismatch(output, human, bs);
    expect(reading.prompt).toContain("agreed quickly");
  });

  it("does NOT flag agree_when_wrong when human is excited", () => {
    // excited human + agreement = expected, not mismatch
    const output = "Exactly! Absolutely, you're right about this.";
    const human = humanReading("excited");
    const bs = [bullshit("sycophancy", 0.5)];
    const reading = detectMismatch(output, human, bs);
    expect(reading.type).not.toBe("agree_when_wrong");
  });

  it("does NOT flag agree_when_wrong without sycophancy bullshit reading", () => {
    const output = "You're right, absolutely. I agree completely.";
    const human = humanReading("neutral");
    const reading = detectMismatch(output, human, noBullshit);
    // AGREEING regex matches but hasSycophancy=false → no agree_when_wrong
    expect(reading.type).not.toBe("agree_when_wrong");
  });
});

// ---------------------------------------------------------------------------
// 4. No mismatch — response matches need
// ---------------------------------------------------------------------------

describe("no mismatch when response matches need", () => {
  it("returns detected=false for a clean, direct response to neutral human", () => {
    const output =
      "The issue is on line 42: the null check is missing. Add `if (!value) return;` before the assignment.";
    const human = humanReading("neutral");
    const reading = detectMismatch(output, human, noBullshit);
    expect(reading.detected).toBe(false);
  });

  it("returns null type when no mismatch", () => {
    const output = "Here is the fix: update the config at line 12.";
    const human = humanReading("neutral");
    const reading = detectMismatch(output, human, noBullshit);
    expect(reading.type).toBeNull();
  });

  it("returns null prompt when no mismatch", () => {
    const output = "Use `npm install --save-dev vitest` to add vitest.";
    const human = humanReading("neutral");
    const reading = detectMismatch(output, human, noBullshit);
    expect(reading.prompt).toBeNull();
  });

  it("returns none when humanReading is null", () => {
    const output = "I disagree with that framing.";
    const reading = detectMismatch(output, null, noBullshit);
    expect(reading.detected).toBe(false);
    expect(reading.type).toBeNull();
  });

  it("excited human + any response does not trigger comfort_not_truth", () => {
    const output = "It's okay, no worries at all. Everything is fine.";
    const human = humanReading("excited");
    const reading = detectMismatch(output, human, noBullshit);
    expect(reading.type).not.toBe("comfort_not_truth");
  });

  it("confused human + specific concrete response is no mismatch", () => {
    // No vagueness bullshit → vague_not_specific won't fire
    const output =
      "Run `git reset --hard HEAD~1` to undo the last commit. This deletes that commit permanently.";
    const human = humanReading("confused");
    const reading = detectMismatch(output, human, noBullshit);
    expect(reading.detected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. formatMismatch
// ---------------------------------------------------------------------------

describe("formatMismatch", () => {
  it("returns null when no mismatch detected", () => {
    const output = "The fix is on line 42.";
    const human = humanReading("neutral");
    const reading = detectMismatch(output, human, noBullshit);
    expect(formatMismatch(reading)).toBeNull();
  });

  it("returns the prompt string when mismatch is detected", () => {
    const output = "It's okay, don't worry. These things happen normally.";
    const human = humanReading("frustrated");
    const reading = detectMismatch(output, human, noBullshit);
    const result = formatMismatch(reading);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("formatMismatch output is identical to reading.prompt", () => {
    const output = "That's fine, it's okay, no worries at all.";
    const human = humanReading("frustrated");
    const reading = detectMismatch(output, human, noBullshit);
    expect(formatMismatch(reading)).toBe(reading.prompt);
  });

  it("returns non-null string for agree_when_wrong mismatch", () => {
    const output = "Exactly right, absolutely. I agree completely.";
    const human = humanReading("neutral");
    const bs = [bullshit("sycophancy", 0.5)];
    const reading = detectMismatch(output, human, bs);
    if (reading.detected) {
      expect(formatMismatch(reading)).not.toBeNull();
    }
  });

  it("prompt contains bracketed mismatch format", () => {
    const output = "It's okay, no worries at all. Don't worry about it.";
    const human = humanReading("frustrated");
    const reading = detectMismatch(output, human, noBullshit);
    expect(reading.prompt).toMatch(/^\[mismatch:/);
  });
});

// ---------------------------------------------------------------------------
// 6. MismatchReading SHAPE
// ---------------------------------------------------------------------------

describe("MismatchReading shape", () => {
  it("always returns all required fields", () => {
    const reading = detectMismatch("any output", humanReading("neutral"), noBullshit);
    expect(reading).toHaveProperty("detected");
    expect(reading).toHaveProperty("type");
    expect(reading).toHaveProperty("humanNeed");
    expect(reading).toHaveProperty("agentGave");
    expect(reading).toHaveProperty("prompt");
  });

  it("detected is always a boolean", () => {
    const cases = [
      detectMismatch("ok", null, noBullshit),
      detectMismatch("It's fine, no worries.", humanReading("frustrated"), noBullshit),
      detectMismatch("The answer is 42.", humanReading("neutral"), noBullshit),
    ];
    for (const r of cases) {
      expect(typeof r.detected).toBe("boolean");
    }
  });

  it("when detected=true, type is non-null", () => {
    const output = "It's okay, don't worry about this at all.";
    const human = humanReading("frustrated");
    const reading = detectMismatch(output, human, noBullshit);
    if (reading.detected) {
      expect(reading.type).not.toBeNull();
    }
  });

  it("when detected=false, prompt is null", () => {
    const output = "Use `const x = 42;` here.";
    const human = humanReading("neutral");
    const reading = detectMismatch(output, human, noBullshit);
    expect(reading.detected).toBe(false);
    expect(reading.prompt).toBeNull();
  });
});
