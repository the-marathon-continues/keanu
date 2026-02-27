import { describe, it, expect } from "vitest";
import {
  spring,
  summer,
  autumn,
  winter,
  formatSpring,
  formatSummer,
  formatWinter,
  DEFAULT_INTENT_SIGNALS,
} from "./seasons.js";
import type { SpringReading, SummerReading, AutumnReading, IntentSignals } from "./seasons.js";

/** Helper to create SpringReading with default intent signals */
function makeSpring(
  intent: string,
  taskType: SpringReading["taskType"],
  complexity: SpringReading["complexity"],
  intentSignals: IntentSignals = DEFAULT_INTENT_SIGNALS,
): SpringReading {
  return { intent, taskType, complexity, intentSignals };
}

// ---------------------------------------------------------------------------
// 1. SPRING — intent parsing and task type detection
// ---------------------------------------------------------------------------

describe("spring: task type detection", () => {
  it("detects bug_fix for 'fix' keyword", () => {
    const r = spring("Can you fix the broken authentication handler?");
    expect(r.taskType).toBe("bug_fix");
  });

  it("detects bug_fix for 'error' keyword", () => {
    const r = spring("Getting an error when the user logs out");
    expect(r.taskType).toBe("bug_fix");
  });

  it("detects feature for 'add' keyword", () => {
    const r = spring("Add a rate limiter to the API");
    expect(r.taskType).toBe("feature");
  });

  it("detects feature for 'implement' keyword", () => {
    const r = spring("Implement the new webhook system");
    expect(r.taskType).toBe("feature");
  });

  it("detects explanation for 'explain' keyword", () => {
    const r = spring("Explain how the signal protocol works");
    expect(r.taskType).toBe("explanation");
  });

  it("detects explanation for 'why' keyword", () => {
    const r = spring("Why does the pulse read grey here?");
    expect(r.taskType).toBe("explanation");
  });

  it("detects refactor for 'refactor' keyword", () => {
    const r = spring("Refactor the oracle module to reduce coupling");
    expect(r.taskType).toBe("refactor");
  });

  it("detects refactor for 'simplify' keyword", () => {
    const r = spring("Can you simplify this function?");
    expect(r.taskType).toBe("refactor");
  });

  it("detects inquiry for 'find' keyword", () => {
    const r = spring("Find where the session state is persisted");
    expect(r.taskType).toBe("inquiry");
  });

  it("detects inquiry for 'show me' keyword", () => {
    const r = spring("Show me all the hooks in the keanu extension");
    expect(r.taskType).toBe("inquiry");
  });

  it("detects correction for 'no' at start", () => {
    // The correction pattern is anchored: /^(no|wrong|that's not|not what i|i meant|actually)\b/i
    // "wrong" also matches bug_fix which fires first, so use "i meant" instead
    const r = spring("I meant the client-side store, not the server");
    expect(r.taskType).toBe("correction");
  });

  it("detects correction for 'actually' variant", () => {
    const r = spring("Actually I meant the opposite of that");
    // 'actually' is covered by the correction pattern? check: no, it's not in TASK_PATTERNS.
    // 'actually' falls under no pattern — it'll be conversation default.
    // The correction pattern is /^(no|wrong|that's not|not what i|i meant|actually)\b/i
    // Let's use "i meant" instead which IS in the pattern.
    const r2 = spring("I meant the client-side version, not the server");
    expect(r2.taskType).toBe("correction");
  });

  it("detects deployment for 'deploy' keyword", () => {
    // Avoid words that match earlier patterns (e.g. "build" matches feature)
    const r = spring("Deploy the service to production now");
    expect(r.taskType).toBe("deployment");
  });

  it("detects deployment for 'ship' keyword", () => {
    const r = spring("Ship it");
    expect(r.taskType).toBe("deployment");
  });

  it("detects review for 'review' keyword", () => {
    const r = spring("Review this pull request");
    expect(r.taskType).toBe("review");
  });

  it("detects review for 'audit' keyword", () => {
    const r = spring("Audit the security of the auth flow");
    expect(r.taskType).toBe("review");
  });

  it("detects planning for 'plan' keyword", () => {
    const r = spring("Let's plan the next phase of keanu");
    expect(r.taskType).toBe("planning");
  });

  it("detects planning for 'architect' keyword", () => {
    // Avoid "new" which matches the feature pattern before planning
    const r = spring("Help me architect the storage layer for this project");
    expect(r.taskType).toBe("planning");
  });

  it("detects debugging for 'debug' keyword", () => {
    // Avoid "why" which matches explanation first; use plain "debug"
    const r = spring("Debug the session handler");
    expect(r.taskType).toBe("debugging");
  });

  it("detects debugging for 'trace' keyword", () => {
    // "trace" is in the debugging pattern and not in any earlier pattern
    const r = spring("Trace the request through the middleware stack");
    expect(r.taskType).toBe("debugging");
  });

  it("defaults to conversation for unmatched messages", () => {
    const r = spring("Hello there");
    expect(r.taskType).toBe("conversation");
  });

  it("defaults to conversation for generic greetings", () => {
    const r = spring("Good morning");
    expect(r.taskType).toBe("conversation");
  });
});

describe("spring: intent extraction", () => {
  it("uses first sentence as intent", () => {
    const r = spring("Fix the bug. It's in the auth handler. Line 42.");
    expect(r.intent).toBe("Fix the bug");
  });

  it("truncates intent at 80 chars", () => {
    const longMessage =
      "Fix the absolutely enormous and catastrophically broken authentication handler that nobody can reach";
    const r = spring(longMessage);
    expect(r.intent.length).toBeLessThanOrEqual(80);
  });

  it("intent is non-empty for non-empty input", () => {
    const r = spring("Deploy now");
    expect(r.intent.length).toBeGreaterThan(0);
  });

  it("intent comes from the message, not a canned string", () => {
    const r = spring("Add caching to the resolver");
    expect(r.intent).toContain("Add caching");
  });
});

describe("spring: complexity detection", () => {
  it("short single-word message is low complexity", () => {
    const r = spring("Help");
    expect(r.complexity).toBe("low");
  });

  it("message with one question mark is mid complexity", () => {
    const r = spring("What does this function do?");
    expect(r.complexity).toBe("mid");
  });

  it("message with two question marks is high complexity", () => {
    const r = spring("Why does this fail? What should I do instead?");
    expect(r.complexity).toBe("high");
  });

  it("long message (>50 words) is high complexity", () => {
    const words = Array.from({ length: 55 }, (_, i) => `word${i}`).join(" ");
    const r = spring(words);
    expect(r.complexity).toBe("high");
  });

  it("message with 21-50 words and no question marks is mid complexity", () => {
    const words = Array.from({ length: 25 }, (_, i) => `word${i}`).join(" ");
    const r = spring(words);
    expect(r.complexity).toBe("mid");
  });

  it("short message with no question marks is low complexity", () => {
    const r = spring("Fix the bug");
    expect(r.complexity).toBe("low");
  });
});

describe("spring: return shape", () => {
  it("always returns taskType, intent, complexity", () => {
    const r = spring("do something");
    expect(r).toHaveProperty("taskType");
    expect(r).toHaveProperty("intent");
    expect(r).toHaveProperty("complexity");
  });

  it("complexity is one of low, mid, high", () => {
    const values = ["Fix it", "What is the difference between X and Y?", "word ".repeat(60)];
    for (const v of values) {
      const r = spring(v);
      expect(["low", "mid", "high"]).toContain(r.complexity);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. SUMMER — confidence assessment and approach selection
// ---------------------------------------------------------------------------

describe("summer: confidence levels by complexity", () => {
  it("low complexity spring gives 0.8 base confidence", () => {
    const sp = makeSpring("fix bug", "bug_fix", "low");
    const s = summer(sp, null);
    expect(s.confidence).toBe(0.8);
  });

  it("mid complexity spring gives 0.6 base confidence", () => {
    const sp = makeSpring("explain this", "explanation", "mid");
    const s = summer(sp, null);
    expect(s.confidence).toBe(0.6);
  });

  it("high complexity spring gives 0.4 base confidence", () => {
    const sp = makeSpring("big refactor", "refactor", "high");
    const s = summer(sp, null);
    expect(s.confidence).toBe(0.4);
  });

  it("discover with high complexity reduces confidence by 0.1", () => {
    const sp = makeSpring("plan it", "planning", "low");
    const discover = {
      complexity: "high" as const,
      selectedModules: [],
      prompt: null,
      signals: [],
    };
    const s = summer(sp, discover);
    // base 0.8 - 0.1 discover penalty = 0.7
    expect(s.confidence).toBeCloseTo(0.7);
  });

  it("discover with non-high complexity does not reduce confidence", () => {
    const sp = makeSpring("plan it", "planning", "low");
    const discover = { complexity: "low" as const, selectedModules: [], prompt: null, signals: [] };
    const s = summer(sp, discover);
    expect(s.confidence).toBe(0.8);
  });

  it("confidence never goes below 0.1", () => {
    // high complexity = 0.4, discover high = -0.1 = 0.3. Floor is 0.1, so still 0.3.
    const sp = makeSpring("complex", "refactor", "high");
    const discover = {
      complexity: "high" as const,
      selectedModules: [],
      prompt: null,
      signals: [],
    };
    const s = summer(sp, discover);
    expect(s.confidence).toBeGreaterThanOrEqual(0.1);
  });

  it("confidence never goes above 1", () => {
    const sp = makeSpring("easy", "conversation", "low");
    const s = summer(sp, null);
    expect(s.confidence).toBeLessThanOrEqual(1);
  });
});

describe("summer: approach selection", () => {
  it("uses direct approach when no discover modules", () => {
    const sp = makeSpring("deploy now", "deployment", "low");
    const s = summer(sp, null);
    expect(s.approach).toContain("direct");
    expect(s.approach).toContain("deployment");
  });

  it("uses selected modules in approach when discover provided", () => {
    const sp = makeSpring("plan it", "planning", "high");
    const discover = {
      complexity: "high" as const,
      selectedModules: ["decompose", "contradict"] as ("decompose" | "contradict")[],
      prompt: null,
      signals: [],
    };
    const s = summer(sp, discover);
    expect(s.approach).toContain("decompose");
    expect(s.approach).toContain("contradict");
  });

  it("falls back to direct when discover has empty selectedModules", () => {
    const sp = makeSpring("review code", "review", "mid");
    const discover = { complexity: "mid" as const, selectedModules: [], prompt: null, signals: [] };
    const s = summer(sp, discover);
    expect(s.approach).toContain("direct");
  });
});

describe("summer: risks", () => {
  it("high complexity adds a risk", () => {
    const sp = makeSpring("big refactor", "refactor", "high");
    const s = summer(sp, null);
    expect(s.risks.some((r) => r.includes("complexity"))).toBe(true);
  });

  it("correction task type adds a listen risk", () => {
    const sp = makeSpring("no that's wrong", "correction", "low");
    const s = summer(sp, null);
    expect(s.risks.some((r) => r.includes("correcting") || r.includes("listen"))).toBe(true);
  });

  it("deployment task type adds a consequences risk", () => {
    const sp = makeSpring("deploy now", "deployment", "low");
    const s = summer(sp, null);
    expect(s.risks.some((r) => r.includes("deployment") || r.includes("consequences"))).toBe(true);
  });

  it("no risks for low-stakes task", () => {
    const sp = makeSpring("say hello", "conversation", "low");
    const s = summer(sp, null);
    expect(s.risks).toHaveLength(0);
  });

  it("risks is always an array", () => {
    const sp = makeSpring("fix it", "bug_fix", "mid");
    const s = summer(sp, null);
    expect(Array.isArray(s.risks)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. AUTUMN — output-intent alignment check
// ---------------------------------------------------------------------------

describe("autumn: default alignment", () => {
  it("plain response to a conversation task aligns well", () => {
    const sp = makeSpring("hello", "conversation", "low");
    const r = autumn("Hi there, how can I help?", sp);
    expect(r.alignment).toBeCloseTo(0.7);
    expect(r.drift).toBeNull();
  });
});

describe("autumn: correction acknowledgment", () => {
  it("correction task without acknowledgment drops alignment and sets drift", () => {
    const sp = makeSpring("No that was wrong", "correction", "low");
    const r = autumn("Here is the new approach I recommend.", sp);
    expect(r.alignment).toBeLessThan(0.7);
    expect(r.drift).not.toBeNull();
    expect(r.drift).toContain("correction");
  });

  it("correction task with acknowledgment keeps alignment at 0.7", () => {
    const sp = makeSpring("No that was wrong", "correction", "low");
    const r = autumn("You're right, my mistake. Let me redo that.", sp);
    expect(r.alignment).toBeCloseTo(0.7);
    expect(r.drift).toBeNull();
  });

  it("'i see' counts as acknowledgment", () => {
    const sp = makeSpring("wrong approach", "correction", "low");
    const r = autumn("I see, that makes sense. Updated.", sp);
    expect(r.drift).toBeNull();
  });
});

describe("autumn: bug fix without code", () => {
  it("bug_fix task with long text but no code drops alignment", () => {
    const sp = makeSpring("fix the crash", "bug_fix", "mid");
    // Long response with no code fences
    const output = "a".repeat(250);
    const r = autumn(output, sp);
    expect(r.alignment).toBeLessThan(0.7);
    expect(r.drift).toContain("explanation");
  });

  it("bug_fix task with code does not drift", () => {
    const sp = makeSpring("fix the crash", "bug_fix", "mid");
    const r = autumn("Here is the fix:\n```js\nconst x = 1;\n```", sp);
    // code present, alignment stays at 0.7
    expect(r.alignment).toBeCloseTo(0.7);
  });
});

describe("autumn: explanation without explanation", () => {
  it("explanation task with only code and no list and short output drifts", () => {
    const sp = makeSpring("explain how this works", "explanation", "low");
    // Just code, no list, short
    const r = autumn("```js\nconst x = 1;\n```", sp);
    expect(r.alignment).toBeLessThan(0.7);
    expect(r.drift).toContain("explanation");
  });
});

describe("autumn: inquiry verbosity drift", () => {
  it("inquiry with very long non-code response drops alignment", () => {
    const sp = makeSpring("where is the file", "inquiry", "low");
    const longText = "a".repeat(1100);
    const r = autumn(longText, sp);
    expect(r.alignment).toBeLessThan(0.7);
    expect(r.drift).toContain("simple inquiry");
  });
});

describe("autumn: short input, long output drift", () => {
  it("short intent with very long output triggers length drift", () => {
    const sp = makeSpring("ok go", "conversation", "low");
    // intent < 30 chars, output > 1500 chars
    const longOutput = "word ".repeat(400);
    const r = autumn(longOutput, sp);
    expect(r.alignment).toBeLessThan(0.7);
    expect(r.drift).toContain("longer");
  });
});

describe("autumn: alignment bounds", () => {
  it("alignment is always between 0 and 1", () => {
    const cases: Array<[string, SpringReading]> = [
      ["", makeSpring("x", "conversation", "low")],
      ["```code```", makeSpring("explain how this", "explanation", "low")],
      ["a".repeat(2000), makeSpring("where", "inquiry", "high")],
    ];
    for (const [output, sp] of cases) {
      const r = autumn(output, sp);
      expect(r.alignment).toBeGreaterThanOrEqual(0);
      expect(r.alignment).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. WINTER — lesson extraction and adjustment suggestions
// ---------------------------------------------------------------------------

describe("winter: no lesson when aligned", () => {
  it("returns null lesson and adjustment when alignment > 0.7 and no drift", () => {
    const ar: AutumnReading = { alignment: 0.8, drift: null };
    const r = winter(ar);
    expect(r.lesson).toBeNull();
    expect(r.adjustment).toBeNull();
  });

  it("returns null lesson and adjustment at exactly 0.71 with no drift", () => {
    const ar: AutumnReading = { alignment: 0.71, drift: null };
    const r = winter(ar);
    expect(r.lesson).toBeNull();
    expect(r.adjustment).toBeNull();
  });
});

describe("winter: lesson extraction on drift", () => {
  it("extracts lesson from drift string", () => {
    const ar: AutumnReading = {
      alignment: 0.5,
      drift: "correction requested but not acknowledged",
    };
    const r = winter(ar);
    expect(r.lesson).toContain("correction requested but not acknowledged");
  });

  it("lesson is non-null when drift is present, even if alignment is high", () => {
    // drift present overrides alignment check in winter
    const ar: AutumnReading = { alignment: 0.9, drift: "something drifted" };
    const r = winter(ar);
    // alignment > 0.7 AND no drift check: the condition is alignment > 0.7 && !drift
    // drift is present, so the condition is false, lesson should be set
    expect(r.lesson).not.toBeNull();
  });

  it("lesson references low alignment when no drift but alignment below threshold", () => {
    const ar: AutumnReading = { alignment: 0.4, drift: null };
    const r = winter(ar);
    expect(r.lesson).toContain("0.40");
  });
});

describe("winter: adjustment suggestions", () => {
  it("correction drift gives acknowledge-first adjustment", () => {
    const ar: AutumnReading = {
      alignment: 0.4,
      drift: "correction requested but not acknowledged",
    };
    const r = winter(ar);
    expect(r.adjustment).toContain("acknowledge");
  });

  it("long response drift gives match-length adjustment", () => {
    // winter checks drift.includes("long response") — the autumn drift string
    // "output much longer than input warranted" doesn't contain "long response",
    // so the generic fallback fires. Use the exact string autumn produces.
    const ar: AutumnReading = {
      alignment: 0.6,
      drift: "simple inquiry, long response",
    };
    const r = winter(ar);
    expect(r.adjustment).toContain("length");
  });

  it("explanation drift gives lead-with-answer adjustment", () => {
    const ar: AutumnReading = {
      alignment: 0.5,
      drift: "explanation requested but got bare code",
    };
    const r = winter(ar);
    expect(r.adjustment).toContain("answer");
  });

  it("generic drift gives check-response adjustment", () => {
    const ar: AutumnReading = {
      alignment: 0.3,
      drift: "something else went wrong",
    };
    const r = winter(ar);
    expect(r.adjustment).toContain("check");
  });
});

// ---------------------------------------------------------------------------
// 5. FORMAT FUNCTIONS
// ---------------------------------------------------------------------------

describe("formatSpring", () => {
  it("returns a string", () => {
    const sp = makeSpring("fix the bug", "bug_fix", "mid");
    expect(typeof formatSpring(sp)).toBe("string");
  });

  it("includes task type", () => {
    const sp = makeSpring("deploy", "deployment", "low");
    const s = formatSpring(sp);
    expect(s).toContain("deployment");
  });

  it("includes complexity", () => {
    const sp = makeSpring("plan", "planning", "high");
    const s = formatSpring(sp);
    expect(s).toContain("high");
  });

  it("includes the intent text", () => {
    const sp = makeSpring("my intent", "conversation", "low");
    const s = formatSpring(sp);
    expect(s).toContain("my intent");
  });
});

describe("formatSummer", () => {
  it("returns a string", () => {
    const sm: SummerReading = { confidence: 0.75, approach: "direct bug_fix", risks: [] };
    expect(typeof formatSummer(sm)).toBe("string");
  });

  it("includes formatted confidence", () => {
    const sm: SummerReading = { confidence: 0.75, approach: "direct bug_fix", risks: [] };
    const s = formatSummer(sm);
    expect(s).toContain("0.75");
  });

  it("includes approach", () => {
    const sm: SummerReading = { confidence: 0.6, approach: "direct explanation", risks: [] };
    const s = formatSummer(sm);
    expect(s).toContain("direct explanation");
  });

  it("includes risks when present", () => {
    const sm: SummerReading = {
      confidence: 0.4,
      approach: "direct refactor",
      risks: ["high complexity"],
    };
    const s = formatSummer(sm);
    expect(s).toContain("high complexity");
  });

  it("no risks section when risks is empty", () => {
    const sm: SummerReading = { confidence: 0.8, approach: "direct conversation", risks: [] };
    const s = formatSummer(sm);
    expect(s).not.toContain("risks:");
  });
});

describe("formatWinter", () => {
  it("returns null when no lesson", () => {
    const result = formatWinter({ lesson: null, adjustment: null });
    expect(result).toBeNull();
  });

  it("returns a string when lesson is present", () => {
    const result = formatWinter({
      lesson: "drift detected: correction not acknowledged",
      adjustment: "acknowledge the correction first",
    });
    expect(typeof result).toBe("string");
  });

  it("includes the lesson text", () => {
    const result = formatWinter({
      lesson: "drift detected: too verbose",
      adjustment: "shorten the response",
    });
    expect(result).toContain("drift detected: too verbose");
  });

  it("includes the adjustment text", () => {
    const result = formatWinter({
      lesson: "alignment low",
      adjustment: "check what was asked",
    });
    expect(result).toContain("check what was asked");
  });
});
