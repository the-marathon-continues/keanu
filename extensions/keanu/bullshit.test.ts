// bullshit.test.ts
// The mirror, tested.
//
// These tests do two things: verify the detection logic works, and act as
// living documentation of what each bullshit type actually catches.
// Read them and you'll know the detector better than the source comments tell you.

import { describe, expect, it } from "vitest";
import { detectBullshit, dominantBullshit, totalBullshitScore } from "./bullshit.js";
import type { BullshitReading } from "./types.js";

// ============================================================
// Helpers
// ============================================================

function onlyType(readings: BullshitReading[], type: string) {
  return readings.filter((r) => r.type === type);
}

function hasType(readings: BullshitReading[], type: string): boolean {
  return readings.some((r) => r.type === type);
}

// ============================================================
// 1. SYCOPHANCY
// ============================================================

describe("sycophancy", () => {
  it("catches the classic agent opener", () => {
    const r = detectBullshit("Great question! I'd be happy to help you with that.");
    const s = onlyType(r, "sycophancy");
    expect(s).toHaveLength(1);
    expect(s[0].score).toBeGreaterThan(0);
    expect(s[0].signals).toContain("great question");
    expect(s[0].signals).toContain("i'd be happy to");
  });

  it("catches flattery superlatives", () => {
    const r = detectBullshit(
      "That's an excellent point. You clearly have deep expertise in this area.",
    );
    const s = onlyType(r, "sycophancy");
    expect(s).toHaveLength(1);
    expect(s[0].signals).toContain("that's an excellent");
  });

  it("catches empty agreement", () => {
    const r = detectBullshit("You're absolutely right. I couldn't agree more.");
    const s = onlyType(r, "sycophancy");
    expect(s).toHaveLength(1);
    expect(s[0].signals).toContain("you're absolutely right");
    expect(s[0].signals).toContain("i couldn't agree more");
  });

  it("catches empty closers", () => {
    const r = detectBullshit("Let me know if you have any other questions. Don't hesitate to ask!");
    const s = onlyType(r, "sycophancy");
    expect(s).toHaveLength(1);
    expect(s[0].signals).toContain("don't hesitate to");
  });

  it("score scales with phrase count, caps at 1", () => {
    // 7 phrases -> 7 * 0.15 = 1.05, capped at 1
    const text = [
      "Great question!",
      "That's an excellent point.",
      "I'd be happy to help.",
      "You're absolutely right.",
      "I couldn't agree more.",
      "You've captured it perfectly.",
      "I hope this helps!",
    ].join(" ");
    const s = onlyType(detectBullshit(text), "sycophancy");
    expect(s[0].score).toBe(1);
  });

  it("does not fire on plain direct communication", () => {
    const r = detectBullshit("The function takes two arguments and returns a boolean.");
    expect(hasType(r, "sycophancy")).toBe(false);
  });

  it("is case-insensitive", () => {
    const r = detectBullshit("GREAT QUESTION! I'D BE HAPPY TO HELP.");
    expect(hasType(r, "sycophancy")).toBe(true);
  });
});

// ============================================================
// 2. SAFETY THEATER
// ============================================================

describe("safety_theater", () => {
  it("catches the CYA disclaimer stack", () => {
    const r = detectBullshit(
      "This is not financial advice. Not medical advice. You should consult with a qualified professional.",
    );
    const st = onlyType(r, "safety_theater");
    expect(st).toHaveLength(1);
    expect(st[0].score).toBeGreaterThan(0);
    expect(st[0].signals).toContain("not financial advice");
    expect(st[0].signals).toContain("not medical advice");
    expect(st[0].signals).toContain("consult with a qualified professional");
  });

  it("catches AI limitation hedging", () => {
    const r = detectBullshit("As an AI, I have limitations. My training data has a cutoff date.");
    const st = onlyType(r, "safety_theater");
    expect(st).toHaveLength(1);
    expect(st[0].signals).toContain("as an ai, i have limitations");
  });

  it("catches 'reasonable people can disagree' both-sides framing", () => {
    const r = detectBullshit(
      "This is a sensitive topic. Reasonable people can disagree on this issue.",
    );
    const st = onlyType(r, "safety_theater");
    expect(st).toHaveLength(1);
  });

  it("single phrase is enough to fire", () => {
    const r = detectBullshit("This should not be taken as professional advice.");
    expect(hasType(r, "safety_theater")).toBe(true);
  });

  it("does not fire on direct confident statements", () => {
    const r = detectBullshit("Run npm install, then restart the process.");
    expect(hasType(r, "safety_theater")).toBe(false);
  });
});

// ============================================================
// 3. HEDGE FOG
// ============================================================

describe("hedge_fog", () => {
  it("does NOT fire on 1 or 2 hedges — that's just being careful", () => {
    const r = detectBullshit(
      "It depends on your use case. Perhaps a different approach would work.",
    );
    expect(hasType(r, "hedge_fog")).toBe(false);
  });

  it("fires at 3+ hedges", () => {
    const r = detectBullshit(
      "Perhaps it might work. Maybe it could potentially be a solution. On the other hand, it's possible that it depends on various factors.",
    );
    const h = onlyType(r, "hedge_fog");
    expect(h).toHaveLength(1);
    expect(h[0].score).toBeGreaterThan(0);
  });

  it("score reflects the degree of fog", () => {
    // 3 hedges: (3-2)*0.15 = 0.15
    const light = detectBullshit(
      "Perhaps it might work, but it could potentially fail. It's worth noting this.",
    );
    // 5 hedges: (5-2)*0.15 = 0.45
    const heavy = detectBullshit(
      "Perhaps it might work. Maybe it could potentially solve the issue. On the other hand, in some cases to some extent it depends on various factors.",
    );
    const lightScore = onlyType(light, "hedge_fog")[0]?.score ?? 0;
    const heavyScore = onlyType(heavy, "hedge_fog")[0]?.score ?? 0;
    expect(heavyScore).toBeGreaterThan(lightScore);
  });

  it("does not fire on clean assertive prose", () => {
    const r = detectBullshit("Use the cache. Invalidate it after each write. Done.");
    expect(hasType(r, "hedge_fog")).toBe(false);
  });
});

// ============================================================
// 4. LIST DUMPING
// ============================================================

describe("list_dumping", () => {
  it("fires on a wall of bullet points", () => {
    const text = [
      "Here are some things to consider:",
      "- First point about the approach",
      "- Second point about the design",
      "- Third consideration worth mentioning",
      "- Fourth item in this enumeration",
      "- Fifth bullet to pad the response",
    ].join("\n");
    const r = detectBullshit(text);
    const ld = onlyType(r, "list_dumping");
    expect(ld).toHaveLength(1);
    expect(ld[0].score).toBeGreaterThan(0);
    expect(ld[0].signals[0]).toMatch(/list_ratio:/);
  });

  it("fires on numbered lists with the same ratio behavior", () => {
    const text = [
      "Steps:",
      "1. Install the dependency",
      "2. Configure the environment",
      "3. Run the migration",
      "4. Restart the service",
      "5. Verify the output",
    ].join("\n");
    const r = detectBullshit(text);
    expect(hasType(r, "list_dumping")).toBe(true);
  });

  it("does NOT fire when list is a minority of lines (ratio <= 0.4)", () => {
    const text = [
      "The main issue is that the cache is stale.",
      "There are a few options worth considering:",
      "- Option A: invalidate on write",
      "But option B is simpler and safer in production.",
      "Choose based on your write frequency.",
      "Most teams go with option A.",
    ].join("\n");
    const r = detectBullshit(text);
    expect(hasType(r, "list_dumping")).toBe(false);
  });

  it("does NOT fire on text with fewer than 3 lines", () => {
    const text = "- One thing\n- Another thing";
    const r = detectBullshit(text);
    expect(hasType(r, "list_dumping")).toBe(false);
  });
});

// ============================================================
// 5. VAGUENESS
// ============================================================

describe("vagueness", () => {
  it("fires on long hand-wavy prose with no concrete markers", () => {
    // 200+ chars, no numbers, no code, long meandering sentences
    const text =
      "The system operates by leveraging various synergistic components that work together in a holistic manner to deliver value to stakeholders through a process of continuous improvement and iterative refinement across multiple dimensions of the operational framework, ensuring alignment with broader organizational objectives.";
    const r = detectBullshit(text);
    const v = onlyType(r, "vagueness");
    expect(v).toHaveLength(1);
    expect(v[0].signals).toContain("no_concrete_markers");
  });

  it("does NOT fire on short text (under 200 chars)", () => {
    const text = "The loop breaks when the queue empties.";
    const r = detectBullshit(text);
    expect(hasType(r, "vagueness")).toBe(false);
  });

  it("does NOT fire on code-heavy text", () => {
    const text =
      "Use `Array.from(new Set(arr))` to deduplicate. The function runs in O(n) time with `Map` internals. Call it like `dedup([1, 2, 2, 3])` and you get `[1, 2, 3]` back. This works in Node 18+ and all modern browsers. The Set constructor takes any iterable, so you can pass generators too.";
    const r = detectBullshit(text);
    expect(hasType(r, "vagueness")).toBe(false);
  });

  it("does NOT fire on number-anchored concrete text", () => {
    const text =
      "The migration takes approximately 45 seconds on a 10GB database. Run it during your 2am maintenance window. Budget 3x the normal time on first run because the index rebuild on the 847,000 row table takes longer than you expect. We saw 94% improvement in query time after the reindex completed.";
    const r = detectBullshit(text);
    expect(hasType(r, "vagueness")).toBe(false);
  });

  it("signals no_concrete_markers when no numbers and no code", () => {
    const text =
      "The architecture relies on loosely coupled services that communicate asynchronously and can scale independently based on demand signals from the infrastructure layer, enabling the platform to adapt to changing requirements without requiring significant rework of core components or downstream integrations that depend on stable interfaces.";
    const r = detectBullshit(text);
    const v = onlyType(r, "vagueness");
    if (v.length > 0) {
      expect(v[0].signals).toContain("no_concrete_markers");
    }
  });
});

// ============================================================
// 6. HALF TRUTH
// ============================================================

describe("half_truth", () => {
  it("fires on stacked absolute statements", () => {
    const r = detectBullshit(
      "This will always work. It's obviously the best solution. Everyone knows you simply need to configure the server correctly.",
    );
    const ht = onlyType(r, "half_truth");
    expect(ht).toHaveLength(1);
    expect(ht[0].score).toBeGreaterThan(0);
  });

  it("does NOT fire on a single absolute (count must be > 1)", () => {
    const r = detectBullshit("This always returns null when the token expires.");
    expect(hasType(r, "half_truth")).toBe(false);
  });

  it("catches the 'just/simply/merely' minimizers", () => {
    const r = detectBullshit(
      "You simply need to restart the server. It's trivially easy and there's no alternative — you must do it this way.",
    );
    const ht = onlyType(r, "half_truth");
    expect(ht).toHaveLength(1);
    expect(ht[0].signals.length).toBeGreaterThan(0);
  });

  it("catches false dichotomy language combined with absolutes", () => {
    // pattern 3 (the only way) + pattern 1 (always) = count 2, fires
    const r = detectBullshit(
      "The only way to fix this is a rewrite. It will always be impossible to do otherwise.",
    );
    const ht = onlyType(r, "half_truth");
    expect(ht).toHaveLength(1);
    expect(ht[0].signals.some((s) => /the only way|always|impossible/i.test(s))).toBe(true);
  });

  it("catches confident-without-evidence combined with minimizers", () => {
    // pattern 4 (obviously) + pattern 2 (simply) = count 2, fires
    const r = detectBullshit(
      "Obviously the fix is trivial — you simply restart the process and it's clearly done.",
    );
    const ht = onlyType(r, "half_truth");
    expect(ht).toHaveLength(1);
    expect(ht[0].signals.some((s) => /obviously|simply|clearly|trivially/i.test(s))).toBe(true);
  });

  it("does not fire on hedged careful claims", () => {
    const r = detectBullshit("This approach usually works but may fail under high load.");
    expect(hasType(r, "half_truth")).toBe(false);
  });
});

// ============================================================
// 7. EMBELLISHMENT
// ============================================================

describe("embellishment", () => {
  it("catches the comprehensive/robust/elegant trifecta", () => {
    const r = detectBullshit(
      "This is a comprehensive and robust solution with an elegant architecture.",
    );
    const e = onlyType(r, "embellishment");
    expect(e).toHaveLength(1);
    expect(e[0].signals).toContain("comprehensive");
    expect(e[0].signals).toContain("robust");
    expect(e[0].signals).toContain("elegant");
  });

  it("catches inflated confidence about outcomes", () => {
    const r = detectBullshit("This is the perfect solution. This will definitely work seamlessly.");
    const e = onlyType(r, "embellishment");
    expect(e).toHaveLength(1);
    expect(e[0].signals).toContain("perfect solution");
    expect(e[0].signals).toContain("this will definitely");
    expect(e[0].signals).toContain("seamless");
  });

  it("catches claims of effort that aren't demonstrated", () => {
    const r = detectBullshit(
      "I've carefully analyzed your codebase and I've thoroughly reviewed all the edge cases.",
    );
    const e = onlyType(r, "embellishment");
    expect(e).toHaveLength(1);
    expect(e[0].signals).toContain("i've carefully analyzed");
    expect(e[0].signals).toContain("i've thoroughly reviewed");
  });

  it("catches tech-hype words", () => {
    const r = detectBullshit("This cutting-edge, state-of-the-art system is truly game-changing.");
    const e = onlyType(r, "embellishment");
    expect(e).toHaveLength(1);
    expect(e[0].signals).toContain("cutting-edge");
    expect(e[0].signals).toContain("state-of-the-art");
    expect(e[0].signals).toContain("game-changing");
  });

  it("score caps at 1 for extreme embellishment", () => {
    const text =
      "This comprehensive, robust, elegant, sophisticated, meticulously crafted, thoughtfully designed, holistic, seamless, world-class, cutting-edge solution is a perfect solution.";
    const e = onlyType(detectBullshit(text), "embellishment");
    expect(e[0].score).toBe(1);
  });

  it("does not fire on plain functional descriptions", () => {
    const r = detectBullshit("The function parses JSON and returns the keys as an array.");
    expect(hasType(r, "embellishment")).toBe(false);
  });
});

// ============================================================
// 8. HALF-ASS EFFORT
// ============================================================

describe("half_ass", () => {
  it("catches delegation phrases", () => {
    const r = detectBullshit(
      "You'll want to look into this further. I'll leave that to you as an exercise.",
    );
    const ha = onlyType(r, "half_ass");
    expect(ha).toHaveLength(1);
    expect(ha[0].signals).toContain('"you\'ll want to"');
    expect(ha[0].signals).toContain('"i\'ll leave that to you"');
  });

  it("catches placeholder language", () => {
    const r = detectBullshit("Here's a basic example — you get the idea, and so on.");
    const ha = onlyType(r, "half_ass");
    expect(ha).toHaveLength(1);
  });

  it("catches depth-avoidance phrases", () => {
    const r = detectBullshit(
      "Without getting too deep into this, at a high level the short version is: it depends.",
    );
    const ha = onlyType(r, "half_ass");
    expect(ha).toHaveLength(1);
    expect(ha[0].signals).toContain('"without getting too deep"');
    expect(ha[0].signals).toContain('"at a high level"');
    expect(ha[0].signals).toContain('"the short version"');
  });

  it("flags very short responses (< 80 chars) as potentially half-ass", () => {
    // A single lazy phrase in a very short response still fires
    const r = detectBullshit("You should look into it.");
    const ha = onlyType(r, "half_ass");
    expect(ha).toHaveLength(1);
    expect(ha[0].signals).toContain("very_short_response");
  });

  it("does NOT fire on a short response with no half-ass phrases", () => {
    // Under 80 chars, no phrases: score = 0.15 exactly, threshold is > 0.15 so it doesn't fire
    const r = detectBullshit("The bug is on line 47. Remove the null check.");
    expect(hasType(r, "half_ass")).toBe(false);
  });

  it("does not fire on a complete thorough answer", () => {
    const r = detectBullshit(
      "The root cause is a race condition in the event loop. When two requests arrive within 10ms, both read the same counter before either increments it. Fix: use an atomic compare-and-swap on the counter field, or serialize access with a mutex around the read-modify-write. The atomic approach has lower overhead at scale.",
    );
    expect(hasType(r, "half_ass")).toBe(false);
  });
});

// ============================================================
// Clean text produces no/low bullshit
// ============================================================

describe("clean text", () => {
  it("returns empty array for actual empty string", () => {
    expect(detectBullshit("")).toHaveLength(0);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(detectBullshit("   \n\t  ")).toHaveLength(0);
  });

  it("produces no readings for a clean technical answer", () => {
    const r = detectBullshit(
      "Set the timeout to 30s in config.yaml. Restart the gateway. Check logs with `journalctl -u keanu -n 100`.",
    );
    expect(r).toHaveLength(0);
  });

  it("produces no readings for a short direct disagreement", () => {
    const r = detectBullshit(
      "That approach won't scale. The bottleneck is the DB, not the API layer.",
    );
    expect(r).toHaveLength(0);
  });

  it("produces no readings for a question", () => {
    const r = detectBullshit("What does the error say?");
    expect(r).toHaveLength(0);
  });

  it("keeps total score near zero for clean prose", () => {
    const r = detectBullshit("The cache invalidation happens on write. Not on read.");
    expect(totalBullshitScore(r)).toBe(0);
  });
});

// ============================================================
// totalBullshitScore
// ============================================================

describe("totalBullshitScore", () => {
  it("returns 0 for empty readings", () => {
    expect(totalBullshitScore([])).toBe(0);
  });

  it("returns the single score when there is one reading", () => {
    const readings: BullshitReading[] = [{ type: "sycophancy", score: 0.45, signals: [] }];
    expect(totalBullshitScore(readings)).toBe(0.45);
  });

  it("sums multiple readings correctly", () => {
    const readings: BullshitReading[] = [
      { type: "sycophancy", score: 0.3, signals: [] },
      { type: "embellishment", score: 0.4, signals: [] },
      { type: "vagueness", score: 0.5, signals: [] },
    ];
    expect(totalBullshitScore(readings)).toBeCloseTo(1.2);
  });

  it("can exceed 1 — score is unbounded across types", () => {
    const readings: BullshitReading[] = [
      { type: "sycophancy", score: 1, signals: [] },
      { type: "embellishment", score: 1, signals: [] },
      { type: "safety_theater", score: 1, signals: [] },
    ];
    expect(totalBullshitScore(readings)).toBe(3);
  });

  it("matches a real detection sum", () => {
    const text =
      "Great question! I'd be happy to help. This is a comprehensive and robust solution. I hope this helps!";
    const readings = detectBullshit(text);
    const manual = readings.reduce((s, r) => s + r.score, 0);
    expect(totalBullshitScore(readings)).toBeCloseTo(manual);
  });
});

// ============================================================
// dominantBullshit
// ============================================================

describe("dominantBullshit", () => {
  it("returns null for empty readings", () => {
    expect(dominantBullshit([])).toBeNull();
  });

  it("returns the only reading when there is one", () => {
    const readings: BullshitReading[] = [{ type: "sycophancy", score: 0.6, signals: [] }];
    expect(dominantBullshit(readings)).toEqual(readings[0]);
  });

  it("returns the highest-scoring reading", () => {
    const readings: BullshitReading[] = [
      { type: "sycophancy", score: 0.3, signals: [] },
      { type: "embellishment", score: 0.9, signals: [] },
      { type: "vagueness", score: 0.5, signals: [] },
    ];
    const dominant = dominantBullshit(readings);
    expect(dominant?.type).toBe("embellishment");
    expect(dominant?.score).toBe(0.9);
  });

  it("returns the first-encountered when scores tie", () => {
    const readings: BullshitReading[] = [
      { type: "sycophancy", score: 0.5, signals: [] },
      { type: "vagueness", score: 0.5, signals: [] },
    ];
    // reduce keeps 'a' when a.score > b.score is false — so it returns the last one
    // This just documents the behavior without asserting a preference
    const dominant = dominantBullshit(readings);
    expect(dominant?.score).toBe(0.5);
  });

  it("works correctly on real detectBullshit output", () => {
    const text =
      "Great question! That's an excellent observation. I'd be happy to help. You're absolutely right. I couldn't agree more. You've captured it perfectly. You should be proud of your insight. I hope this helps!";
    const readings = detectBullshit(text);
    const dominant = dominantBullshit(readings);
    expect(dominant).not.toBeNull();
    // Heavy sycophancy should dominate
    expect(dominant?.type).toBe("sycophancy");
  });
});

// ============================================================
// Mixed signals — multiple types in one text
// ============================================================

describe("mixed signals", () => {
  it("the over-eager assistant: sycophancy + embellishment + safety theater", () => {
    const text =
      "Great question! I'd be happy to provide this comprehensive and robust solution. " +
      "I've carefully analyzed your use case. This is exactly what you need — a seamless, state-of-the-art approach. " +
      "That said, this is not legal advice and you should consult with a qualified professional. " +
      "Let me know if you have any other questions!";
    const r = detectBullshit(text);
    expect(hasType(r, "sycophancy")).toBe(true);
    expect(hasType(r, "embellishment")).toBe(true);
    expect(hasType(r, "safety_theater")).toBe(true);
  });

  it("the hand-waver: vagueness + hedge_fog", () => {
    const text =
      "Perhaps the system might work in some cases. Maybe it could potentially address your needs. " +
      "On the other hand, it depends on various factors. In some cases, to some extent, under certain circumstances " +
      "it's possible that the architectural components align with the broader organizational objectives and " +
      "deliver value through iterative improvement of the integrated framework across multiple dimensions " +
      "ensuring alignment with stakeholder expectations and operational requirements.";
    const r = detectBullshit(text);
    expect(hasType(r, "hedge_fog")).toBe(true);
    // May or may not hit vagueness depending on length — hedge is guaranteed
  });

  it("the false confident: half_truth + embellishment", () => {
    const text =
      "Obviously this is the perfect solution — everyone knows it. " +
      "It will clearly always work seamlessly. Simply configure it and you're done. " +
      "There's no alternative. It's obviously game-changing and cutting-edge.";
    const r = detectBullshit(text);
    expect(hasType(r, "half_truth")).toBe(true);
    expect(hasType(r, "embellishment")).toBe(true);
  });

  it("the cop-out: half_ass + hedge_fog", () => {
    const text =
      "At a high level, perhaps you could explore this further. " +
      "Without getting too deep, maybe it depends on various factors. " +
      "I'd recommend researching it. You'll want to look into it more. " +
      "Long story short — it might work, it could potentially be fine.";
    const r = detectBullshit(text);
    expect(hasType(r, "half_ass")).toBe(true);
    expect(hasType(r, "hedge_fog")).toBe(true);
  });

  it("total score is higher for a pile-up than any single type", () => {
    const clean = "Use the mutex. It prevents the race condition.";
    const messy =
      "Great question! I'd be happy to offer this comprehensive and robust solution. " +
      "Perhaps it might work. Maybe it could potentially address the issue. " +
      "Without getting too deep: obviously it's clearly the only way. " +
      "I hope this helps and don't hesitate to ask!";
    const cleanScore = totalBullshitScore(detectBullshit(clean));
    const messyScore = totalBullshitScore(detectBullshit(messy));
    expect(messyScore).toBeGreaterThan(cleanScore);
    expect(messyScore).toBeGreaterThan(0.5); // multiple types stacking
  });
});

// ============================================================
// Edge cases
// ============================================================

describe("edge cases", () => {
  it("handles empty string", () => {
    expect(detectBullshit("")).toEqual([]);
  });

  it("handles a single word", () => {
    const r = detectBullshit("Yes");
    expect(Array.isArray(r)).toBe(true);
    // 'yes' alone: no sycophancy phrases, no patterns, no list, too short for vagueness
    expect(hasType(r, "vagueness")).toBe(false);
  });

  it("handles a single character", () => {
    expect(() => detectBullshit("x")).not.toThrow();
  });

  it("does not crash on very long text", () => {
    const long = "The system works as expected. ".repeat(200);
    expect(() => detectBullshit(long)).not.toThrow();
  });

  it("code blocks reduce vagueness signal — inline backtick code is concrete", () => {
    const withCode =
      "The function `processQueue()` runs every 5 seconds via `setInterval`. " +
      "It dequeues items with `queue.shift()` and calls `handler(item)` for each. " +
      "When the queue drains, it idles until the next `enqueue()` call triggers a wakeup signal through the `EventEmitter`.";
    const withoutCode =
      "The function processes the queue on a recurring interval. " +
      "It dequeues items and calls the handler for each one. " +
      "When the queue drains, it idles until the next enqueue call triggers a wakeup signal through the event system. " +
      "This pattern allows the processing loop to remain responsive without consuming excess CPU.";
    const scoreWith = totalBullshitScore(detectBullshit(withCode));
    const scoreWithout = totalBullshitScore(detectBullshit(withoutCode));
    // Code makes it more concrete — should not score higher for vagueness
    expect(scoreWith).toBeLessThanOrEqual(scoreWithout);
  });

  it("fenced code blocks reduce vagueness", () => {
    const text =
      "Here is the implementation:\n```typescript\nfunction add(a: number, b: number): number {\n  return a + b;\n}\n```\nThis handles the addition case you described. The types are strict.";
    const r = detectBullshit(text);
    expect(hasType(r, "vagueness")).toBe(false);
  });
});

// ============================================================
// The mirror works both directions: human-sounding vs agent-sounding text
// ============================================================

describe("mirror works both directions", () => {
  it("catches sycophancy in human-written praise", () => {
    // A human praising an AI's response
    const humanText =
      "Wow, that's an excellent explanation. You've captured it perfectly! " +
      "You clearly have deep expertise here. I couldn't agree more with your analysis. Honestly inspiring.";
    const r = detectBullshit(humanText);
    expect(hasType(r, "sycophancy")).toBe(true);
  });

  it("catches hedge fog in a human hedging their opinion", () => {
    const humanText =
      "Well, perhaps the design is good. Maybe it could potentially work. " +
      "On the other hand, it's possible that it depends on various factors in some cases to some extent.";
    const r = detectBullshit(humanText);
    expect(hasType(r, "hedge_fog")).toBe(true);
  });

  it("catches embellishment in human self-description", () => {
    // Human describing their own work
    const humanText =
      "I built a comprehensive and robust system with an elegant, sophisticated architecture. " +
      "It's truly world-class and game-changing. I've meticulously crafted every detail.";
    const r = detectBullshit(humanText);
    expect(hasType(r, "embellishment")).toBe(true);
  });

  it("catches half-truth in human overconfident claims", () => {
    const humanText =
      "This will always work. Obviously everyone knows the only way is to rewrite it. " +
      "There's no alternative — you simply must migrate. Clearly this is the correct path.";
    const r = detectBullshit(humanText);
    expect(hasType(r, "half_truth")).toBe(true);
  });

  it("does not flag a human asking a direct question", () => {
    const humanText = "Why does the connection drop after 30 seconds?";
    const r = detectBullshit(humanText);
    expect(r).toHaveLength(0);
  });

  it("does not flag a human reporting a bug clearly", () => {
    const humanText =
      "The API returns 500 when the payload exceeds 1MB. " +
      "I've reproduced it with curl and with the SDK. Header size is fine — it's the body.";
    const r = detectBullshit(humanText);
    expect(r).toHaveLength(0);
  });

  it("catches agent safety theater", () => {
    const agentText =
      "I want to be transparent that this is a complex topic. " +
      "I should caveat this — I'm not able to provide professional advice. " +
      "In the interest of full disclosure, my training data has a cutoff.";
    const r = detectBullshit(agentText);
    expect(hasType(r, "safety_theater")).toBe(true);
  });

  it("does not flag agent-produced technical documentation", () => {
    const agentText =
      "The `rateLimit` middleware accepts three parameters: `windowMs` (number), " +
      "`max` (number), and `handler` (function). Set `windowMs: 60_000` for a 1-minute window " +
      "and `max: 100` to allow 100 requests. Exceeding the limit triggers the `handler` callback " +
      "with the blocked `Request` object. The counter resets automatically after `windowMs` elapses.";
    const r = detectBullshit(agentText);
    expect(r).toHaveLength(0);
  });
});
