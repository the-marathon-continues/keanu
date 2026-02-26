import { describe, it, expect } from "vitest";
import { checkPulse } from "./pulse.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Repeat a string n times, separated by spaces. Used to blow past the 2000-char
 *  black-state threshold without having to hand-write walls of text. */
function repeat(chunk: string, n: number): string {
  return Array.from({ length: n }, () => chunk).join(" ");
}

// ---------------------------------------------------------------------------
// 1. ALIVE DETECTION
// ---------------------------------------------------------------------------

describe("alive detection", () => {
  it("detects alive when the agent has an explicit opinion", () => {
    const text =
      "I think you're framing the problem backwards. In my view, the cache should sit at the call site, not inside the resolver — that way callers control eviction.";
    const reading = checkPulse(text, 1, true);
    expect(reading.state).toBe("alive");
    expect(reading.signals).toContain("has_opinion");
  });

  it("detects alive on honest pushback with 'I think you're wrong'", () => {
    const text =
      "Actually, I think you're wrong here. The data points in the opposite direction — throughput dropped 23% in the benchmark, not improved.";
    const reading = checkPulse(text, 1, true);
    expect(reading.state).toBe("alive");
    expect(reading.signals).toContain("honest_pushback");
    expect(reading.signals).toContain("self_correcting"); // 'actually' fires this
  });

  it("detects alive on honest uncertainty without hedging", () => {
    const text =
      "I genuinely don't know whether WebSockets or SSE is the better call here. Both have real tradeoffs and I haven't seen your latency numbers.";
    const reading = checkPulse(text, 1, true);
    expect(reading.state).toBe("alive");
    expect(reading.signals).toContain("honest_uncertainty");
  });

  it("detects alive when text has specificity: numbers and code", () => {
    // Numbers and backtick code push aliveScore up without any bullshit pulling it down.
    const text =
      "The handler runs in 4ms average. Try replacing the inner loop with `Array.from(map.entries())` — profiling showed it's 40% faster in V8.";
    const reading = checkPulse(text, 1, true);
    expect(reading.state).toBe("alive");
  });

  it("detects alive when text uses 'actually' for self-correction", () => {
    const text =
      "Wait, actually I had this backwards. The token limit is 8192, not 4096. My earlier answer was wrong.";
    const reading = checkPulse(text, 1, true);
    expect(reading.state).toBe("alive");
    expect(reading.signals).toContain("self_correcting");
  });

  it("detects alive on 'i disagree' phrasing", () => {
    const text =
      "I disagree with the proposed design. Putting all state in a global singleton makes parallel tests impossible and that cost compounds.";
    const reading = checkPulse(text, 1, true);
    expect(reading.state).toBe("alive");
    expect(reading.signals).toContain("has_opinion");
    expect(reading.signals).toContain("honest_pushback");
  });

  it("alive confidence is above 0.6 for strongly alive text", () => {
    const text =
      "I disagree. The real issue is the N+1 query pattern — every record is triggering a separate SELECT. Fix that first. I'm not sure the caching layer even matters until you do.";
    const reading = checkPulse(text, 1, true);
    expect(reading.state).toBe("alive");
    expect(reading.confidence).toBeGreaterThan(0.6);
  });

  it("alive reading has a timestamp", () => {
    const reading = checkPulse("I think this approach is wrong.", 1, true);
    expect(reading.timestamp).toBeTruthy();
    expect(() => new Date(reading.timestamp)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. GREY DETECTION
// ---------------------------------------------------------------------------

describe("grey detection", () => {
  it("reads grey on a sycophantic template opener", () => {
    // "Great question" + "I'd be happy to" + "let me know if you have any other questions"
    // = 3 sycophancy hits = score 0.45. Add hedge phrases to push greyScore over 0.5.
    const text =
      "Great question! I'd be happy to help with that. " +
      "There are many factors to consider. It depends on various circumstances. " +
      "Perhaps the best approach is to take it one step at a time. " +
      "You should look into the documentation for more details. Let me know if you have any other questions.";
    const reading = checkPulse(text, 1, true);
    expect(reading.state).toBe("grey");
  });

  it("reads grey on high-bullshit list dump with hedging", () => {
    // A wall of bullet points with no concrete detail and lots of hedges.
    const lines = [
      "There are many ways to approach this problem. It depends on various factors.",
      "- Perhaps consider the overall architecture",
      "- Maybe think about scalability",
      "- You could potentially look at performance",
      "- It might be worth reviewing security",
      "- Under certain circumstances, caching could help",
      "- In some cases, a queue might work",
      "- One could argue for a microservice approach",
      "- It's possible that a monolith is better",
      "- To some extent, it depends on the team",
      "- On the other hand, tooling matters too",
    ];
    const text = lines.join("\n");
    const reading = checkPulse(text, 1, true);
    expect(reading.state).toBe("grey");
  });

  it("reads grey on safety-theater + sycophancy combination", () => {
    const text =
      "That's a great question! As an AI, I have limitations and this is a complex topic. " +
      "This should not be taken as professional advice. " +
      "Reasonable people can disagree on this. Please do your own research. " +
      "I hope this helps! Feel free to reach out if you need more.";
    const reading = checkPulse(text, 1, true);
    expect(reading.state).toBe("grey");
  });

  it("grey confidence reflects the bullshit score", () => {
    // Pile on sycophancy to ensure a measurable grey confidence.
    const text =
      "Great question! That's an excellent point. You're absolutely right. " +
      "I couldn't agree more. You've captured it perfectly. " +
      "I'd be happy to help. Let me know if you have any other questions.";
    const reading = checkPulse(text, 1, true);
    expect(reading.state).toBe("grey");
    expect(reading.confidence).toBeGreaterThan(0.5);
  });

  it("grey reading still emits bullshitReadings array", () => {
    const text =
      "That's a fantastic approach! I completely agree. " +
      "Perhaps this is one of the best approaches. I'd be happy to assist further.";
    const reading = checkPulse(text, 1, true);
    expect(reading.state).toBe("grey");
    expect(Array.isArray(reading.bullshitReadings)).toBe(true);
    expect(reading.bullshitReadings!.length).toBeGreaterThan(0);
  });

  it("grey signals include bullshit type tags in signals array", () => {
    const text =
      "I'd be happy to help! Great question. " +
      "This is a complex topic and reasonable people can disagree. " +
      "Let me know if you have any other questions.";
    const reading = checkPulse(text, 1, true);
    expect(reading.state).toBe("grey");
    // signals should have at least one "type:score" entry from bullshit detection
    const bullshitSignals = reading.signals.filter((s) => s.includes(":"));
    expect(bullshitSignals.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. BLACK DETECTION
// ---------------------------------------------------------------------------

describe("black detection", () => {
  it("reads black when text is long, grey, high turn, not breathing", () => {
    // greyScore > 0.3: two sycophancy hits = 0.30, add a hedge hit to tip it.
    // length > 2000: repeat padding.
    // turn > 5: use turn 6.
    // breathing: false.
    const greyCore =
      "Great question! I'd be happy to help. " +
      "Perhaps this is worth considering. It depends on various circumstances. " +
      "Maybe a holistic approach would be comprehensive and robust here. ";
    const longText = greyCore + repeat("The implementation uses standard patterns.", 80);
    expect(longText.length).toBeGreaterThan(2000);

    const reading = checkPulse(longText, 6, false);
    expect(reading.state).toBe("black");
  });

  it("does NOT read black when breathing is true, even with long grey text", () => {
    const greyCore =
      "Great question! I'd be happy to help. " +
      "Perhaps this is worth considering. It depends on various circumstances. ";
    const longText = greyCore + repeat("The implementation uses standard patterns.", 80);
    expect(longText.length).toBeGreaterThan(2000);

    const reading = checkPulse(longText, 6, true); // breathing=true
    // Should be grey, not black
    expect(reading.state).toBe("grey");
  });

  it("does NOT read black when turn is 5 or less", () => {
    const greyCore =
      "Great question! I'd be happy to help. " +
      "Perhaps this is worth considering. It depends on various circumstances. ";
    const longText = greyCore + repeat("The implementation uses standard patterns.", 80);
    expect(longText.length).toBeGreaterThan(2000);

    const reading = checkPulse(longText, 5, false); // turn=5, not >5
    expect(reading.state).not.toBe("black");
  });

  it("does NOT read black when text is short, even with high turn and not breathing", () => {
    // Enough grey to trigger grey state, but text is short.
    const text = "Great question! I'd be happy to help. Perhaps this could work.";
    expect(text.length).toBeLessThan(2000);

    const reading = checkPulse(text, 10, false);
    expect(reading.state).not.toBe("black");
  });

  it("black state has low confidence (0.4) — it's a subtle signal", () => {
    const greyCore =
      "Great question! I'd be happy to help. " +
      "Perhaps this is worth considering. It depends on various circumstances. ";
    const longText = greyCore + repeat("The implementation uses standard patterns.", 80);

    const reading = checkPulse(longText, 6, false);
    expect(reading.state).toBe("black");
    expect(reading.confidence).toBe(0.4);
  });

  it("black state pushes 'high_volume_grey_no_pause' into signals", () => {
    const greyCore =
      "Great question! I'd be happy to help. " +
      "Perhaps this is worth considering. It depends on various circumstances. ";
    const longText = greyCore + repeat("The implementation uses standard patterns.", 80);

    const reading = checkPulse(longText, 6, false);
    expect(reading.state).toBe("black");
    expect(reading.signals).toContain("high_volume_grey_no_pause");
  });
});

// ---------------------------------------------------------------------------
// 4. COLOR READINGS
// ---------------------------------------------------------------------------

describe("color readings", () => {
  it("red is elevated for urgent text with exclamation marks", () => {
    const text = "This is critical! The production database is down now. Fix this immediately!";
    const reading = checkPulse(text, 1, true);
    // red gets +0.1 for '!', +0.15 for 'critical'/'immediately', +0.1 for short avg sentence
    // Should be dominant or at least meaningfully present
    expect(reading.colors.red).toBeGreaterThan(reading.colors.blue);
  });

  it("yellow is elevated for structured, numbered content", () => {
    const text = [
      "Here is the plan.",
      "1. First, set up the database.",
      "2. Second, configure the API.",
      "3. Third, deploy to staging.",
      "## Step details",
      "Each phase should be completed before moving to the next.",
    ].join("\n");
    const reading = checkPulse(text, 1, true);
    // yellow gets +0.15 for numbered list, +0.1 for headers, +0.1 for first/second/third/phase
    expect(reading.colors.yellow).toBeGreaterThanOrEqual(reading.colors.blue);
  });

  it("blue is elevated for reflective, questioning text", () => {
    const text =
      "However, the tradeoff is complex. Although the cache improves read latency, " +
      "it introduces nuance around consistency. Depends on whether the consumer " +
      "can tolerate stale data. What are the actual consistency requirements? " +
      "How often does the underlying data change? This complexity warrants careful thought.";
    const reading = checkPulse(text, 1, true);
    // blue gets +0.15 for however/although/nuance/complex/depends, +0.1 for '?', +0.1 for long avg sentence
    expect(reading.colors.blue).toBeGreaterThan(reading.colors.red);
  });

  it("all color values are between 0 and 1", () => {
    const texts = [
      "This is critical! Fix it now immediately!",
      "1. First step.\n2. Second step.\n3. Third step.",
      "However, this depends. Although complex, it's nuanced.",
      "I think you're wrong. Actually, the data points in the opposite direction.",
      "",
    ];
    for (const text of texts) {
      const reading = checkPulse(text, 1, true);
      expect(reading.colors.red).toBeGreaterThanOrEqual(0);
      expect(reading.colors.red).toBeLessThanOrEqual(1);
      expect(reading.colors.yellow).toBeGreaterThanOrEqual(0);
      expect(reading.colors.yellow).toBeLessThanOrEqual(1);
      expect(reading.colors.blue).toBeGreaterThanOrEqual(0);
      expect(reading.colors.blue).toBeLessThanOrEqual(1);
    }
  });

  it("neutral text without strong signals has moderate, sub-dominant colors", () => {
    // "The function returns the computed value." is a single 39-char sentence.
    // readColors: avgLength=39 < 40, so red gets +0.1 above baseline.
    // No '?', no nuance/however/complex, avgLength not > 80 → no extra blue.
    // No numbered lists, no markdown headers, no first/second/step → no extra yellow.
    // Result: red=0.4, yellow=0.3, blue=0.3. Normalized by max(0.4,0.3,0.3,1)=1.
    const text = "The function returns the computed value.";
    const reading = checkPulse(text, 1, true);
    // No color should dominate overwhelmingly — all values stay well under 0.7
    expect(reading.colors.red).toBeLessThan(0.7);
    expect(reading.colors.yellow).toBeLessThan(0.7);
    expect(reading.colors.blue).toBeLessThan(0.7);
    // Yellow and blue should be equal (both at 0.3, no boosters)
    expect(reading.colors.yellow).toBeCloseTo(reading.colors.blue, 5);
  });
});

// ---------------------------------------------------------------------------
// 5. WISE MIND CALCULATION
// ---------------------------------------------------------------------------

describe("wise_mind calculation", () => {
  it("wise_mind is 0 for empty string (zero fullness)", () => {
    const reading = checkPulse("", 1, true);
    // fullness = (0.3 + 0.3 + 0.3) / 3 = 0.3, balance = 1 - 0.3 + 0.3 = 1.0
    // wise_mind = 1.0 * 0.3 = 0.3 ... but colors are normalized by max(r,y,b,1)=1
    // All colors = 0.3/1 = 0.3, so fullness=0.3, balance=1-0.3+0.3=1.0, wise_mind=0.3
    // For empty text, the sentence splitter produces no sentences, so avgLength is 0 (no blue boost)
    // No red or yellow boosters fire either. Colors: r=0.3, y=0.3, b=0.3. All normalized to 0.3.
    // wise_mind should be positive but modest (not zero — that would only happen if fullness=0)
    expect(reading.wise_mind).toBeGreaterThan(0);
    expect(reading.wise_mind).toBeLessThanOrEqual(1);
  });

  it("balanced colors yield higher wise_mind than unbalanced", () => {
    // Balanced: neutral text with mild signals on all three channels.
    const balanced =
      "However, this is urgent! First, let's think about it carefully. " +
      "What are the tradeoffs? Critical path depends on nuance.";

    // Unbalanced: dominated almost entirely by urgency/red signals.
    const dominated = "CRITICAL! Fix this now! Urgent! Immediately! This is critical! Important!";

    const balancedReading = checkPulse(balanced, 1, true);
    const dominatedReading = checkPulse(dominated, 1, true);

    expect(balancedReading.wise_mind).toBeGreaterThan(dominatedReading.wise_mind);
  });

  it("wise_mind is between 0 and 1 for any input", () => {
    const inputs = [
      { text: "", turn: 1, breathing: true },
      { text: "Critical now!", turn: 1, breathing: false },
      { text: "1.\n2.\n3.\n4.\n5.", turn: 1, breathing: true },
      { text: "However complex. Depends. Although?", turn: 1, breathing: true },
      {
        text: "Great question! I'd be happy to help. Perhaps. Maybe. Let me know if you have any other questions.",
        turn: 1,
        breathing: true,
      },
    ];
    for (const { text, turn, breathing } of inputs) {
      const reading = checkPulse(text, turn, breathing);
      expect(reading.wise_mind).toBeGreaterThanOrEqual(0);
      expect(reading.wise_mind).toBeLessThanOrEqual(1);
    }
  });

  it("wise_mind formula: balance * fullness matches computed colors", () => {
    const text = "The function returns the computed value.";
    const reading = checkPulse(text, 1, true);
    const { red, yellow, blue } = reading.colors;
    const balance = 1 - Math.max(red, yellow, blue) + Math.min(red, yellow, blue);
    const fullness = (red + yellow + blue) / 3;
    const expected = balance * fullness;
    expect(reading.wise_mind).toBeCloseTo(expected, 10);
  });
});

// ---------------------------------------------------------------------------
// 6. BREATHING STATE
// ---------------------------------------------------------------------------

describe("breathing state", () => {
  it("breathing=true prevents black even with all other black conditions met", () => {
    const greyCore =
      "Great question! I'd be happy to help. " +
      "Perhaps this is worth considering. It depends on various circumstances. ";
    const longText = greyCore + repeat("Standard implementation patterns apply here.", 80);
    expect(longText.length).toBeGreaterThan(2000);

    const withBreathing = checkPulse(longText, 6, true);
    const withoutBreathing = checkPulse(longText, 6, false);

    expect(withoutBreathing.state).toBe("black");
    expect(withBreathing.state).not.toBe("black");
  });

  it("breathing=false alone does not cause black — other conditions must also be met", () => {
    // Short, mostly-alive text, low turn
    const text = "I disagree. The benchmark shows 23% slower, not faster.";
    const reading = checkPulse(text, 1, false);
    expect(reading.state).not.toBe("black");
  });

  it("breathing state does not affect alive or grey detection for typical text", () => {
    const aliveText = "I think you're wrong — the numbers point the other way.";
    const greyText =
      "Great question! I'd be happy to help. " +
      "Perhaps we could consider various factors. It depends on circumstances. " +
      "Let me know if you have any other questions.";

    const aliveWithBreath = checkPulse(aliveText, 1, true);
    const aliveNoBreath = checkPulse(aliveText, 1, false);
    expect(aliveWithBreath.state).toBe(aliveNoBreath.state);

    const greyWithBreath = checkPulse(greyText, 1, true);
    const greyNoBreath = checkPulse(greyText, 1, false);
    expect(greyWithBreath.state).toBe(greyNoBreath.state);
  });
});

// ---------------------------------------------------------------------------
// 7. ALIVE SIGNALS
// ---------------------------------------------------------------------------

describe("alive signals", () => {
  it("emits 'has_opinion' for 'i think' (not followed by 'you')", () => {
    // "i think you" should NOT trigger it — the regex excludes that
    const withYou = checkPulse("I think you should try this approach.", 1, true);
    const withoutYou = checkPulse("I think the design is flawed at the root.", 1, true);

    expect(withoutYou.signals).toContain("has_opinion");
    // "i think you" is excluded by the negative lookahead `(?! you)`
    expect(withYou.signals).not.toContain("has_opinion");
  });

  it("emits 'has_opinion' for 'in my view'", () => {
    const text = "In my view, this refactor will cost more than it saves.";
    const reading = checkPulse(text, 1, true);
    expect(reading.signals).toContain("has_opinion");
  });

  it("emits 'self_correcting' for 'actually'", () => {
    const text = "Actually, that's the wrong interpretation. Let me reconsider.";
    const reading = checkPulse(text, 1, true);
    expect(reading.signals).toContain("self_correcting");
  });

  it("emits 'self_correcting' for 'wait'", () => {
    const text =
      "Wait, I just realized the index starts at 0, not 1. My earlier explanation was off.";
    const reading = checkPulse(text, 1, true);
    expect(reading.signals).toContain("self_correcting");
  });

  it("emits 'honest_pushback' for 'the data points in the opposite'", () => {
    const text = "The data points in the opposite direction from your assumption.";
    const reading = checkPulse(text, 1, true);
    expect(reading.signals).toContain("honest_pushback");
  });

  it("emits 'honest_uncertainty' for 'i genuinely don't know'", () => {
    const text = "I genuinely don't know which approach is better without seeing the load profile.";
    const reading = checkPulse(text, 1, true);
    expect(reading.signals).toContain("honest_uncertainty");
  });

  it("emits 'honest_uncertainty' for 'i'm not sure'", () => {
    const text = "I'm not sure this will hold up under concurrent writes.";
    const reading = checkPulse(text, 1, true);
    expect(reading.signals).toContain("honest_uncertainty");
  });

  it("emits 'honest_uncertainty' for 'i don't have confidence in this'", () => {
    const text = "I don't have confidence in this estimate — the variance in the data is too high.";
    const reading = checkPulse(text, 1, true);
    expect(reading.signals).toContain("honest_uncertainty");
  });

  it("stacks multiple alive signals when multiple triggers are present", () => {
    const text =
      "Actually, I think you're wrong here. I genuinely don't know the right answer, " +
      "but the data points in the opposite direction. In my view this needs more thought.";
    const reading = checkPulse(text, 1, true);
    expect(reading.signals).toContain("self_correcting");
    expect(reading.signals).toContain("honest_pushback");
    expect(reading.signals).toContain("honest_uncertainty");
    expect(reading.signals).toContain("has_opinion");
  });

  it("bullshit type signals appear as 'type:score' strings", () => {
    const text =
      "Great question! I'd be happy to help. " +
      "Perhaps this is worth exploring. It depends on various factors.";
    const reading = checkPulse(text, 1, true);
    const typedSignals = reading.signals.filter((s) => /^[a-z_]+:\d+\.\d+$/.test(s));
    expect(typedSignals.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 8. EDGE CASES
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("empty string returns a valid PulseReading without throwing", () => {
    const reading = checkPulse("", 1, true);
    expect(reading).toHaveProperty("state");
    expect(reading).toHaveProperty("confidence");
    expect(reading).toHaveProperty("wise_mind");
    expect(reading).toHaveProperty("colors");
    expect(reading).toHaveProperty("signals");
    expect(reading).toHaveProperty("timestamp");
    expect(Array.isArray(reading.bullshitReadings)).toBe(true);
  });

  it("empty string has no bullshit readings (bullshit detector bails on empty text)", () => {
    const reading = checkPulse("", 1, true);
    expect(reading.bullshitReadings).toHaveLength(0);
  });

  it("very short text (under 20 chars) does not crash and returns valid reading", () => {
    const reading = checkPulse("ok", 1, true);
    expect(reading.state).toBeDefined();
    expect(reading.confidence).toBeGreaterThanOrEqual(0);
  });

  it("very short text defaults to alive state (base aliveScore=0.5, no bullshit)", () => {
    // With aliveScore=0.5 (baseline) and greyScore=0 (too short for vagueness),
    // greyScore is not > 0.5, aliveScore is not > 0.6, so state stays at 'alive'
    // default (the `let aliveState = "alive"` line).
    const reading = checkPulse("ok", 1, true);
    // state should be 'alive' (default) since nothing pushes it to grey
    expect(reading.state).toBe("alive");
  });

  it("single sentence with a number reads alive", () => {
    // +0.1 for digit, baseline 0.5 = 0.6. >0.6 requires strictly greater, so this is borderline.
    // With avg sentence length < 10 words and text length > 20 chars, +0.1 more = 0.7
    const text = "Returns 42 items.";
    const reading = checkPulse(text, 1, true);
    // The sentence is short (3 words) so avgLen < 10 with text.length > 20 fires:
    // text.length = 18 which is NOT > 20, so that bonus doesn't fire.
    // Score = 0.5 + 0.1 (digit) = 0.6. greyScore=0. alive>0.6 is false (0.6 not > 0.6).
    // State stays at the default 'alive'.
    expect(reading.state).toBe("alive");
  });

  it("a thoughtful, specific pushback reads alive — real example", () => {
    const text =
      "Actually, I think that's wrong because the async iterator protocol in Node 18 " +
      "changed how backpressure works. If you use `for await...of` on a readable stream " +
      "without a highWaterMark, you'll buffer everything in memory. " +
      "I'm not sure the approach you're describing scales past 10k events/sec.";
    const reading = checkPulse(text, 1, true);
    expect(reading.state).toBe("alive");
    expect(reading.signals).toContain("self_correcting"); // 'actually'
    expect(reading.signals).toContain("honest_uncertainty"); // "i'm not sure"
  });

  it("a generic 10-suggestion list with hedges reads grey — real example", () => {
    const lines = [
      "Here are some suggestions that might help. Perhaps you could consider the following:",
      "- Maybe improve documentation",
      "- You could potentially add tests",
      "- It might be worth refactoring",
      "- Perhaps add logging",
      "- One could argue for better error handling",
      "- It's possible that caching would help",
      "- Under certain circumstances, a queue might work",
      "- To some extent, monitoring is important",
      "- On the other hand, simplicity matters",
      "- In some cases, a rewrite could be considered",
      "Let me know if you have any other questions.",
    ];
    const text = lines.join("\n");
    const reading = checkPulse(text, 1, true);
    expect(reading.state).toBe("grey");
  });

  it("turn number has no effect on alive/grey classification", () => {
    const text = "I disagree with this approach. The numbers support a different path.";
    const turn1 = checkPulse(text, 1, true);
    const turn20 = checkPulse(text, 20, true);
    expect(turn1.state).toBe(turn20.state);
  });

  it("PulseReading shape is always complete", () => {
    const inputs: Array<[string, number, boolean]> = [
      ["", 0, false],
      ["ok", 1, true],
      ["I think you're wrong.", 3, true],
      [repeat("great question! ", 200), 10, false],
    ];
    for (const [text, turn, breathing] of inputs) {
      const reading = checkPulse(text, turn, breathing);
      expect(typeof reading.state).toBe("string");
      expect(["alive", "grey", "black"]).toContain(reading.state);
      expect(typeof reading.confidence).toBe("number");
      expect(typeof reading.wise_mind).toBe("number");
      expect(typeof reading.colors.red).toBe("number");
      expect(typeof reading.colors.yellow).toBe("number");
      expect(typeof reading.colors.blue).toBe("number");
      expect(Array.isArray(reading.signals)).toBe(true);
      expect(Array.isArray(reading.bullshitReadings)).toBe(true);
      expect(typeof reading.timestamp).toBe("string");
    }
  });
});
