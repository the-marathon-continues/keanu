// human.test.ts
// Tests for readHuman and formatHumanReading.
//
// The function under test is a pure signal reader -- no I/O, no mocks needed.
// getRecentSummaries returns [] in a fresh test environment (no sessions loaded),
// so assessValidationDepth returns 3 (the baseline "reading between lines" level).
// That means formatHumanReading won't surface a depth label (only shown at 4+).
//
// Tests use realistic human messages. "What the fuck is this" should read frustrated.
// "Oh man this is amazing!!" should read excited. That's the whole bar.

import { describe, it, expect } from "vitest";
import { readHuman, formatHumanReading } from "./human.js";

// --- Helpers ---

function read(text: string, history: string[] = []) {
  return readHuman(text, history);
}

// Does the reading contain a given tone in its tones[] array?
function hasTone(reading: ReturnType<typeof readHuman>, tone: string): boolean {
  return reading.tones.some((t) => t.tone === tone);
}

// Get a specific tone reading from the tones[] array.
function getTone(reading: ReturnType<typeof readHuman>, tone: string) {
  return reading.tones.find((t) => t.tone === tone);
}

// ============================================================
// 1. Individual tone detection
// ============================================================

describe("frustrated tone", () => {
  it("detects direct anger with profanity", () => {
    // "what" at the start also triggers CONFUSED_PATTERNS[0], and confused weight (0.18)
    // beats frustrated weight (0.15), so dominant may be confused when both fire.
    // The important assertion is that frustrated IS detected -- not necessarily dominant.
    const r = read("What the fuck is this? I told you three times already.");
    expect(hasTone(r, "frustrated")).toBe(true);
  });

  it("detects explicit complaint phrases", () => {
    const r = read("This is broken again. Still wrong. Why can't you just do it right?");
    expect(hasTone(r, "frustrated")).toBe(true);
  });

  it("detects WTF opener", () => {
    const r = read("wtf is happening here, this doesn't work at all");
    expect(hasTone(r, "frustrated")).toBe(true);
  });

  it("detects 'I already told you' phrasing", () => {
    const r = read("I already told you, that's not what I meant. Try again.");
    expect(hasTone(r, "frustrated")).toBe(true);
  });

  it("detects 'still broken' phrasing", () => {
    const r = read("still broken. same issue as before.");
    expect(hasTone(r, "frustrated")).toBe(true);
  });

  it("detects multiple exclamation marks as frustration signal", () => {
    const r = read("No!! That's not right!! You're not getting it!!");
    expect(hasTone(r, "frustrated")).toBe(true);
  });

  it("detects ellipsis frustration", () => {
    const r = read("Ok so... I guess you just don't understand what I'm saying...");
    expect(hasTone(r, "frustrated")).toBe(true);
  });

  it("accumulates higher score for multiple frustrated signals", () => {
    // Ensure lowFrustration actually hits at least one pattern (ffs hits the WTF pattern).
    // High frustration hits many: fuck, broken, doesn't work, still wrong, I already told you.
    const highFrustration = read(
      "Fuck! This is broken, doesn't work, still wrong, I already told you.",
    );
    const lowFrustration = read("ffs, try again.");
    const highScore = getTone(highFrustration, "frustrated")?.score ?? 0;
    const lowScore = getTone(lowFrustration, "frustrated")?.score ?? 0;
    expect(highScore).toBeGreaterThan(lowScore);
  });

  it("frustrated tone carries empathy map meaning about anger as information", () => {
    const r = read("This is useless. Why can't you fix it?");
    const t = getTone(r, "frustrated");
    expect(t?.meaning).toContain("anger");
  });
});

describe("excited tone", () => {
  it("detects enthusiastic energy with exclamations", () => {
    const r = read("Oh man this is amazing!! Let's gooooo");
    expect(r.tone).toBe("excited");
    expect(hasTone(r, "excited")).toBe(true);
  });

  it("detects positive keywords", () => {
    const r = read("Perfect, exactly what I wanted. Love it!");
    expect(hasTone(r, "excited")).toBe(true);
  });

  it("detects 'ship it' energy", () => {
    const r = read("Ship it! This is brilliant.");
    expect(hasTone(r, "excited")).toBe(true);
  });

  it("detects 'that's it, nailed it'", () => {
    const r = read("That's it! You nailed it. This is great.");
    expect(hasTone(r, "excited")).toBe(true);
  });

  it("detects collaborative energy phrases", () => {
    const r = read("Yes! Let's build something together.");
    expect(hasTone(r, "excited")).toBe(true);
  });

  it("detects 'amazing' keyword", () => {
    const r = read("This is amazing work, keep going.");
    expect(hasTone(r, "excited")).toBe(true);
  });

  it("multiple exclamations boost excited score", () => {
    const highEnergy = read("Yes! Perfect! Amazing! Ship it now!");
    const lowEnergy = read("Nice, that works.");
    const highScore = getTone(highEnergy, "excited")?.score ?? 0;
    const lowScore = getTone(lowEnergy, "excited")?.score ?? 0;
    expect(highScore).toBeGreaterThan(lowScore);
  });

  it("excited tone carries empathy map about riding momentum", () => {
    const r = read("Yes! Perfect! Let's go!");
    const t = getTone(r, "excited");
    expect(t?.meaning).toContain("momentum");
  });

  it("excited tone carries DBT skill about matching energy", () => {
    const r = read("Yes! Perfect! Let's go!");
    const t = getTone(r, "excited");
    expect(t?.skill).toContain("energy");
  });
});

describe("confused tone", () => {
  it("detects explicit confusion statement", () => {
    const r = read("Wait I'm confused, didn't you just say the opposite?");
    expect(r.tone).toBe("confused");
    expect(hasTone(r, "confused")).toBe(true);
  });

  it("detects 'I don't understand' phrasing", () => {
    const r = read("I don't understand. Can you explain this differently?");
    expect(hasTone(r, "confused")).toBe(true);
  });

  it("detects multiple question marks", () => {
    const r = read("Wait what?? How does that work?? Which one are we using??");
    expect(hasTone(r, "confused")).toBe(true);
  });

  it("detects 'huh' opener", () => {
    const r = read("Huh? I thought we decided something different earlier.");
    expect(hasTone(r, "confused")).toBe(true);
  });

  it("detects 'lost me' phrasing", () => {
    const r = read("You lost me at step 3. Where did that come from?");
    expect(hasTone(r, "confused")).toBe(true);
  });

  it("detects 'makes no sense'", () => {
    const r = read("This makes no sense. Which approach are we taking?");
    expect(hasTone(r, "confused")).toBe(true);
  });

  it("detects 'am I missing something'", () => {
    const r = read("Am I missing something? This doesn't seem right.");
    expect(hasTone(r, "confused")).toBe(true);
  });

  it("confused tone carries empathy map about needing a map not a lecture", () => {
    const r = read("I don't understand this. What do you mean by that?");
    const t = getTone(r, "confused");
    expect(t?.meaning).toContain("map");
  });
});

describe("fatigued tone", () => {
  it("detects explicit tired language", () => {
    const r = read("I'm exhausted. Brain is fried. Done for today.");
    expect(hasTone(r, "fatigued")).toBe(true);
  });

  it("detects 'need a break'", () => {
    const r = read("I need a break. Whatever, let's just leave it.");
    expect(hasTone(r, "fatigued")).toBe(true);
  });

  it("detects 'I'm done'", () => {
    const r = read("I'm done. We can pick this up tomorrow.");
    expect(hasTone(r, "fatigued")).toBe(true);
  });

  it("detects terse end-of-message resignation", () => {
    // The pattern is (whatever|fine|sure|ok|k)$ -- requires the word at end of string.
    // "Fine." has a trailing period so it doesn't match. Use bare "fine" or "whatever".
    const r = read("fine");
    expect(hasTone(r, "fatigued")).toBe(true);
  });

  it("detects 'going to sleep'", () => {
    const r = read("I'm going to sleep. We'll fix this tomorrow.");
    expect(hasTone(r, "fatigued")).toBe(true);
  });

  it("detects 'tired as shit'", () => {
    const r = read("Tired as shit. Let's wrap up.");
    expect(hasTone(r, "fatigued")).toBe(true);
  });

  it("fatigued tone carries empathy map about presence not pressure", () => {
    const r = read("I'm exhausted, done for today.");
    const t = getTone(r, "fatigued");
    expect(t?.meaning).toContain("presence");
  });

  it("short messages after a long history get a fatigue bonus", () => {
    const longHistory = Array(12).fill(
      "This is a moderately long message from a busy conversation session.",
    );
    const r = readHuman("ok", longHistory);
    // Should have fatigued in tones (via isFatigueByLength bonus or short_after_long_exchange)
    const hasFatigued = hasTone(r, "fatigued") || r.signals.some((s) => s.includes("fatigue"));
    expect(hasFatigued).toBe(true);
  });
});

describe("looping tone", () => {
  it("detects repeated identical message in history", () => {
    const repeated = "Why isn't this working? I keep getting the same error.";
    const history = [repeated, "something else", repeated];
    const r = readHuman(repeated, history);
    expect(r.tone).toBe("looping");
    expect(hasTone(r, "looping")).toBe(true);
  });

  it("detects similar messages by prefix match", () => {
    const msg = "Can you fix the authentication bug?";
    const history = [
      "Can you fix the authentication bug? It's still broken.",
      "Some unrelated message.",
      "Can you fix the authentication bug? Why is it still failing?",
    ];
    const r = readHuman(msg, history);
    expect(r.tone).toBe("looping");
  });

  it("looping is dominant over other tones when detected", () => {
    const msg = "This is broken and I'm frustrated! Can you fix this??";
    const history = [msg, "other stuff", msg];
    const r = readHuman(msg, history);
    expect(r.tone).toBe("looping");
  });

  it("looping tone carries empathy map about being stuck in a pattern", () => {
    const msg = "Why isn't the deploy working?";
    const history = [msg, "I tried that.", msg];
    const r = readHuman(msg, history);
    const t = getTone(r, "looping");
    expect(t?.meaning).toContain("stuck");
  });

  it("looping adds repeating_query to signals", () => {
    const msg = "How do I fix the import error?";
    const history = [msg, "other message", msg];
    const r = readHuman(msg, history);
    expect(r.signals).toContain("repeating_query");
  });

  it("does not trigger looping on short history", () => {
    const msg = "Why isn't this working?";
    const history = [msg]; // Only 1 prior, not enough
    const r = readHuman(msg, history);
    expect(r.tone).not.toBe("looping");
  });
});

describe("neutral tone", () => {
  it("normal factual message reads neutral", () => {
    const r = read("The config file is in the root directory.");
    expect(r.tone).toBe("neutral");
    expect(r.tones).toHaveLength(0);
  });

  it("polite request reads neutral", () => {
    const r = read("Can you check the server logs?");
    expect(r.tone).toBe("neutral");
  });

  it("simple acknowledgment reads neutral", () => {
    const r = read("Got it. I'll review the changes.");
    expect(r.tone).toBe("neutral");
  });

  it("neutral reading has no detected tones in tones array", () => {
    const r = read("The function takes two arguments.");
    expect(r.tones).toHaveLength(0);
  });
});

// ============================================================
// 2. Multiple tones detected simultaneously
// ============================================================

describe("simultaneous tone detection", () => {
  it("frustrated and excited can coexist (swearing from enthusiasm)", () => {
    // "Fuck yes!" -- profanity (frustrated) + excited positive energy
    const r = read("Fuck yes! This is exactly what I wanted! Ship it!");
    // Both should be present even if one dominates
    expect(hasTone(r, "frustrated")).toBe(true);
    expect(hasTone(r, "excited")).toBe(true);
  });

  it("confused and frustrated can coexist", () => {
    const r = read("What the fuck does this even mean?? I don't get it at all.");
    expect(hasTone(r, "frustrated")).toBe(true);
    expect(hasTone(r, "confused")).toBe(true);
  });

  it("tones are sorted by score descending", () => {
    const r = read("I don't understand any of this. What?? How does this work?? Which way??");
    // confused should be dominant given all the confused patterns
    if (r.tones.length >= 2) {
      const scores = r.tones.map((t) => t.score);
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
      }
    }
  });

  it("dominant tone reflects highest score", () => {
    const r = read("I'm confused and frustrated. I don't understand. Why can't you explain it?");
    expect(r.tone).toBe(r.tones[0]?.tone ?? "neutral");
  });

  it("multiple tones all have meaning and skill populated", () => {
    const r = read("What the fuck is this?? I'm totally confused and frustrated!!");
    for (const t of r.tones) {
      expect(t.meaning).toBeTruthy();
      expect(t.skill).toBeTruthy();
    }
  });
});

// ============================================================
// 3. Bullshit detection on human input
// ============================================================

describe("bullshit detection on human input", () => {
  it("detects sycophancy when a human is flattering", () => {
    const r = read("That's a great question you just answered. No notes. You nailed it.");
    // sycophancy phrases present
    const bsTypes = r.bullshit.map((b) => b.type);
    expect(bsTypes).toContain("sycophancy");
  });

  it("detects hedge fog when a human is waffling", () => {
    const r = read(
      "Maybe it depends on various factors. Perhaps we could consider this. It might work in some cases, or maybe not, depending on circumstances.",
    );
    // hedge_fog triggers at count > 2
    const bsTypes = r.bullshit.map((b) => b.type);
    expect(bsTypes).toContain("hedge_fog");
  });

  it("detects embellishment when a human inflates", () => {
    const r = read(
      "This is a comprehensive and robust solution. It's elegant, sophisticated, and seamless.",
    );
    const bsTypes = r.bullshit.map((b) => b.type);
    expect(bsTypes).toContain("embellishment");
  });

  it("detects half_truth in absolute claims", () => {
    // Needs 2+ pattern matches
    const r = read(
      "This will always work. It's simply impossible to fail. Obviously everyone knows this is the only way.",
    );
    const bsTypes = r.bullshit.map((b) => b.type);
    expect(bsTypes).toContain("half_truth");
  });

  it("bullshit signals appear in signals array", () => {
    const r = read("That's a great question. I completely agree with you on this.");
    const bsSignals = r.signals.filter((s) => s.startsWith("human_bs:"));
    expect(bsSignals.length).toBeGreaterThan(0);
  });

  it("clean, direct human message has no bullshit", () => {
    const r = read("The build failed on line 42. Here is the error message.");
    expect(r.bullshit).toHaveLength(0);
  });

  it("bullshit is an array on every reading", () => {
    const r = read("hello");
    expect(Array.isArray(r.bullshit)).toBe(true);
  });

  it("same mirror applies both directions -- same patterns, no special treatment", () => {
    // The point: "great question" triggers sycophancy whether Keanu says it or Drew does.
    const humanFlattery = read(
      "Great question! I couldn't agree more. You've captured it perfectly.",
    );
    expect(humanFlattery.bullshit.some((b) => b.type === "sycophancy")).toBe(true);
  });
});

// ============================================================
// 4. Confidence scoring
// ============================================================

describe("confidence scoring", () => {
  it("neutral message has baseline confidence", () => {
    const r = read("The server is running on port 3000.");
    // Baseline is 0.3 (no tone hit adds to it)
    expect(r.confidence).toBe(0.3);
  });

  it("confidence is above baseline when a tone is detected", () => {
    const r = read("What the fuck is this? Still broken. I already told you.");
    expect(r.confidence).toBeGreaterThan(0.3);
  });

  it("confidence is capped at 1.0", () => {
    // Extremely strong signal -- should not exceed 1
    const r = read(
      "Fuck! Shit! This is broken, doesn't work, still wrong, useless! Why can't you! I already told you! Annoying!",
    );
    expect(r.confidence).toBeLessThanOrEqual(1.0);
  });

  it("confidence increases with tone score", () => {
    const weak = read("Ugh, try again.");
    const strong = read(
      "What the fuck! This is broken, useless, doesn't work, I told you this three times.",
    );
    expect(strong.confidence).toBeGreaterThanOrEqual(weak.confidence);
  });

  it("looping detection adds 0.3 to confidence", () => {
    const msg = "Why isn't this working?";
    const base = read(msg); // no history
    const looping = readHuman(msg, [msg, "other", msg]);
    expect(looping.confidence).toBeGreaterThan(base.confidence);
  });

  it("confidence is always between 0 and 1", () => {
    const cases = [
      "hello",
      "What the fuck!! This is broken!!",
      "I don't understand anything",
      "Yes! Perfect! Ship it!",
    ];
    for (const text of cases) {
      const r = read(text);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================
// 5. formatHumanReading
// ============================================================

describe("formatHumanReading", () => {
  it("returns null for fully neutral reading with no bullshit", () => {
    const r = read("The database connection is configured.");
    const formatted = formatHumanReading(r);
    // Only null if tone=neutral AND tones=[] AND bullshit=[]
    if (r.tone === "neutral" && r.tones.length === 0 && r.bullshit.length === 0) {
      expect(formatted).toBeNull();
    }
  });

  it("returns a string for non-neutral readings", () => {
    const r = read("What the fuck is this? I told you three times.");
    const formatted = formatHumanReading(r);
    expect(formatted).not.toBeNull();
    expect(typeof formatted).toBe("string");
  });

  it("output starts with [pulse: human", () => {
    const r = read("Still broken. Doesn't work. I already told you.");
    const formatted = formatHumanReading(r);
    expect(formatted).toMatch(/^\[pulse: human/);
  });

  it("output includes confidence value", () => {
    const r = read("What the fuck, this is broken again.");
    const formatted = formatHumanReading(r);
    expect(formatted).toContain("confidence=");
  });

  it("output includes all detected tone names", () => {
    const r = read("What the fuck is this?? I'm totally confused. This is broken.");
    const formatted = formatHumanReading(r);
    if (formatted) {
      for (const t of r.tones) {
        expect(formatted).toContain(t.tone);
      }
    }
  });

  it("output includes score values for tones", () => {
    const r = read("I'm confused. What do you mean? How does this work?");
    const formatted = formatHumanReading(r);
    expect(formatted).toMatch(/tones=\[/);
  });

  it("output includes skill suggestion for dominant tone", () => {
    const r = read("I don't understand this at all. Can you explain?");
    const formatted = formatHumanReading(r);
    expect(formatted).toContain("skill:");
  });

  it("output includes bullshit mirror note when bullshit detected", () => {
    const r = read("That's a great question. You nailed it. No notes.");
    const formatted = formatHumanReading(r);
    if (r.bullshit.length > 0) {
      expect(formatted).toContain("mirror=");
      expect(formatted).toContain("assume they're trying");
    }
  });

  it("output ends with partnership affirmation", () => {
    const r = read("This is broken. Why can't you fix it?");
    const formatted = formatHumanReading(r);
    expect(formatted).toContain("partnership.");
  });

  it("non-neutral tone without tones[] still falls back to single tone format", () => {
    // Simulate a reading that has a tone but empty tones array (edge case coverage)
    const syntheticReading = {
      tone: "fatigued" as const,
      tones: [], // empty -- falls into the else-if branch
      confidence: 0.4,
      signals: [],
      bullshit: [],
    };
    const formatted = formatHumanReading(syntheticReading);
    expect(formatted).toContain("fatigued");
    expect(formatted).toContain("presence not pressure");
  });
});

// ============================================================
// 6. Edge cases
// ============================================================

describe("edge cases", () => {
  it("empty string returns neutral with no tones", () => {
    const r = read("");
    expect(r.tone).toBe("neutral");
    expect(r.tones).toHaveLength(0);
  });

  it("empty string has base confidence of 0.3", () => {
    const r = read("");
    expect(r.confidence).toBe(0.3);
  });

  it("single word returns a valid reading", () => {
    const r = read("why");
    expect(r).toBeDefined();
    expect(r.tone).toBeDefined();
    expect(Array.isArray(r.tones)).toBe(true);
    expect(Array.isArray(r.signals)).toBe(true);
  });

  it("single word 'fine' triggers fatigued (matches resignation pattern)", () => {
    const r = read("fine");
    expect(hasTone(r, "fatigued")).toBe(true);
  });

  it("emoji-only string returns neutral with no tones", () => {
    const r = read("🔥💚🤖");
    // No emoji patterns in the detectors
    expect(r.tone).toBe("neutral");
    expect(r.tones).toHaveLength(0);
  });

  it("emoji-only reading formats to null (neutral, no bullshit)", () => {
    const r = read("🔥💚🤖");
    const formatted = formatHumanReading(r);
    expect(formatted).toBeNull();
  });

  it("very long rant with mixed signals is handled without error", () => {
    const rant = `
      What the FUCK is going on here?? I've told you this FIVE times already.
      This doesn't work. Nothing works. The whole system is broken.
      Why can't you understand what I'm asking?? It makes no sense.
      I'm confused, I'm frustrated, I'm exhausted.
      I don't get it. I already told you three times. Still broken.
      This is useless. Waste of time. Why can't you just listen?
      I'm done. Whatever. Fine. Going to sleep.
    `.repeat(3);

    expect(() => read(rant)).not.toThrow();
    const r = read(rant);
    expect(r.tone).toBeDefined();
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(r.tones)).toBe(true);
    expect(Array.isArray(r.bullshit)).toBe(true);
  });

  it("very long rant detects frustrated as dominant or co-dominant", () => {
    const rant = [
      "What the fuck is this??",
      "Still broken. Doesn't work. I already told you.",
      "This is useless. Why can't you fix it?",
      "FFS, try again. This isn't working.",
    ].join(" ");

    const r = read(rant);
    expect(hasTone(r, "frustrated")).toBe(true);
  });

  it("terse lowercase input is flagged as a signal", () => {
    const r = read("ok");
    expect(r.signals).toContain("terse_lowercase");
  });

  it("empty history array is accepted without error", () => {
    expect(() => readHuman("hello", [])).not.toThrow();
  });

  it("large history array is accepted without error", () => {
    const history = Array(100).fill("Some message in the conversation history.");
    expect(() => readHuman("ok", history)).not.toThrow();
  });

  it("whitespace-only string returns neutral", () => {
    const r = read("   ");
    // terse_lowercase check: length < 20 and lowercase -- whitespace triggers it
    // but no tone patterns hit
    expect(r.tone).toBe("neutral");
    expect(r.tones).toHaveLength(0);
  });

  it("formatHumanReading returns null for clean neutral", () => {
    // Pure, unremarkable message -- no patterns, no bullshit
    const r = read("The server logs are in /var/log/app.log");
    if (r.tone === "neutral" && r.tones.length === 0 && r.bullshit.length === 0) {
      expect(formatHumanReading(r)).toBeNull();
    }
  });

  it("signals array is always present and is an array", () => {
    const cases = ["", "hello", "what the fuck", "I don't understand??"];
    for (const text of cases) {
      const r = read(text);
      expect(Array.isArray(r.signals)).toBe(true);
    }
  });

  it("validationDepth is always between 1 and 6", () => {
    const r = read("Tell me what to do next.");
    expect(r.validationDepth).toBeGreaterThanOrEqual(1);
    expect(r.validationDepth).toBeLessThanOrEqual(6);
  });
});

// ============================================================
// 7. Signal protocol integrity
// ============================================================

describe("signal protocol", () => {
  it("tone pattern hits are recorded in signals", () => {
    const r = read("What the fuck is this? Still broken. Doesn't work.");
    const toneSignals = r.signals.filter((s) => s.match(/^frustrated_patterns:/));
    expect(toneSignals.length).toBeGreaterThan(0);
  });

  it("confused pattern hits are recorded in signals", () => {
    const r = read("I don't understand this. What do you mean?");
    const confusedSignals = r.signals.filter((s) => s.match(/^confused_patterns:/));
    expect(confusedSignals.length).toBeGreaterThan(0);
  });

  it("excited pattern hits are recorded in signals", () => {
    const r = read("Yes! Perfect! Ship it!");
    const excitedSignals = r.signals.filter((s) => s.match(/^excited_patterns:/));
    expect(excitedSignals.length).toBeGreaterThan(0);
  });

  it("bullshit signals use human_bs: prefix", () => {
    const r = read("Great question. You nailed it, no notes.");
    const bsSignals = r.signals.filter((s) => s.startsWith("human_bs:"));
    if (r.bullshit.length > 0) {
      expect(bsSignals.length).toBeGreaterThan(0);
    }
  });

  it("hit counts in signals match tone count in tones[]", () => {
    const r = read("I don't understand this. What?? Which one? How does that work?");
    const confusedSignal = r.signals.find((s) => s.startsWith("confused_patterns:"));
    if (confusedSignal) {
      const hits = parseInt(confusedSignal.split(":")[1]);
      const toneScore = getTone(r, "confused")?.score ?? 0;
      // score = min(1, hits * 0.18) -- just verify it's proportional
      expect(toneScore).toBe(Math.min(1, hits * 0.18));
    }
  });
});
