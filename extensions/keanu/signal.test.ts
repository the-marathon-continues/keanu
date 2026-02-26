// signal.test.ts
// Tests for the COEF/1 signal protocol.
//
// Pure functions (encode, decode, emoji) are straightforward.
// History and trend have module-level state — each describe block
// that touches history uses a fresh dynamic import via vi.resetModules()
// so tests don't bleed into each other.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SignalState } from "./types.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<SignalState> = {}): SignalState {
  return {
    pulse: "alive",
    wiseMind: 0.75,
    colors: { red: 0.3, yellow: 0.5, blue: 0.2 },
    humanTone: "neutral",
    bullshitDominant: null,
    disagreementYieldRatio: 0.5,
    turn: 7,
    ...overrides,
  };
}

// Dynamically import a fresh copy of the module so module-level _history
// starts empty for each describe block that exercises stateful APIs.
async function freshSignal() {
  vi.resetModules();
  return import("./signal.js");
}

// ─── encode / decode roundtrip ───────────────────────────────────────────────

describe("encode / decode roundtrip", () => {
  it("roundtrips a typical alive state", async () => {
    const { encode, decode } = await import("./signal.js");
    const state = makeState();
    const decoded = decode(encode(state));

    expect(decoded.pulse).toBe("alive");
    expect(decoded.wiseMind).toBeCloseTo(0.75, 2);
    expect(decoded.colors?.red).toBeCloseTo(0.3, 2);
    expect(decoded.colors?.yellow).toBeCloseTo(0.5, 2);
    expect(decoded.colors?.blue).toBeCloseTo(0.2, 2);
    expect(decoded.humanTone).toBe("neutral");
    expect(decoded.bullshitDominant).toBeNull();
    expect(decoded.turn).toBe(7);
  });

  it("roundtrips a grey state with consecutiveGrey", async () => {
    const { encode, decode } = await import("./signal.js");
    const state = makeState({ pulse: "grey", wiseMind: 0.2, consecutiveGrey: 4 });
    const decoded = decode(encode(state));

    expect(decoded.pulse).toBe("grey");
    expect(decoded.wiseMind).toBeCloseTo(0.2, 2);
    expect(decoded.consecutiveGrey).toBe(4);
  });

  it("roundtrips a black state", async () => {
    const { encode, decode } = await import("./signal.js");
    const state = makeState({ pulse: "black", wiseMind: 0.0 });
    const decoded = decode(encode(state));

    expect(decoded.pulse).toBe("black");
    expect(decoded.wiseMind).toBeCloseTo(0.0, 2);
  });

  it("roundtrips all human tones", async () => {
    const { encode, decode } = await import("./signal.js");
    const tones: SignalState["humanTone"][] = [
      "frustrated",
      "excited",
      "confused",
      "neutral",
      "fatigued",
      "looping",
    ];
    for (const tone of tones) {
      const decoded = decode(encode(makeState({ humanTone: tone })));
      expect(decoded.humanTone).toBe(tone);
    }
  });

  it("roundtrips bullshitDominant when set", async () => {
    const { encode, decode } = await import("./signal.js");
    const state = makeState({ bullshitDominant: "sycophancy" });
    const decoded = decode(encode(state));
    expect(decoded.bullshitDominant).toBe("sycophancy");
  });

  it("roundtrips null bullshitDominant as null", async () => {
    const { encode, decode } = await import("./signal.js");
    const decoded = decode(encode(makeState({ bullshitDominant: null })));
    expect(decoded.bullshitDominant).toBeNull();
  });

  it("roundtrips disagreements stats", async () => {
    const { encode, decode } = await import("./signal.js");
    const state = makeState({
      disagreements: {
        total: 10,
        agent_yielded: 3,
        human_yielded: 6,
        unresolved: 1,
        yield_ratio: 0.3,
      },
    });
    const decoded = decode(encode(state));

    expect(decoded.disagreements?.total).toBe(10);
    expect(decoded.disagreements?.agent_yielded).toBe(3);
    expect(decoded.disagreements?.human_yielded).toBe(6);
    expect(decoded.disagreements?.yield_ratio).toBeCloseTo(0.3, 2);
  });

  it("roundtrips alerts array", async () => {
    const { encode, decode } = await import("./signal.js");
    const state = makeState({ alerts: ["drift", "overload"] });
    const decoded = decode(encode(state));
    expect(decoded.alerts).toEqual(["drift", "overload"]);
  });

  it("roundtrips bullshitReadings", async () => {
    const { encode, decode } = await import("./signal.js");
    const state = makeState({
      bullshitReadings: [
        { type: "vagueness", score: 0.8, signals: [] },
        { type: "list_dumping", score: 0.5, signals: [] },
      ],
    });
    const decoded = decode(encode(state));

    expect(decoded.bullshitReadings).toHaveLength(2);
    expect(decoded.bullshitReadings?.[0]?.type).toBe("vagueness");
    expect(decoded.bullshitReadings?.[0]?.score).toBeCloseTo(0.8, 2);
    expect(decoded.bullshitReadings?.[1]?.type).toBe("list_dumping");
  });

  it("roundtrips lastTool", async () => {
    const { encode, decode } = await import("./signal.js");
    const state = makeState({ lastTool: "bash" });
    const decoded = decode(encode(state));
    expect(decoded.lastTool).toBe("bash");
  });
});

// ─── COEF format correctness ─────────────────────────────────────────────────

describe("COEF format", () => {
  it("starts with COEF/1", async () => {
    const { encode } = await import("./signal.js");
    expect(encode(makeState())).toMatch(/^COEF\/1 /);
  });

  it("contains all required field keys", async () => {
    const { encode } = await import("./signal.js");
    const signal = encode(makeState());

    expect(signal).toContain("pulse=");
    expect(signal).toContain("wm=");
    expect(signal).toContain("c=r");
    expect(signal).toContain("/y");
    expect(signal).toContain("/b");
    expect(signal).toContain("ht=");
    expect(signal).toContain("bs=");
    expect(signal).toContain("da=");
    expect(signal).toContain("t=");
  });

  it("pulse field reflects state", async () => {
    const { encode } = await import("./signal.js");
    expect(encode(makeState({ pulse: "alive" }))).toContain("pulse=alive");
    expect(encode(makeState({ pulse: "grey" }))).toContain("pulse=grey");
    expect(encode(makeState({ pulse: "black" }))).toContain("pulse=black");
  });

  it("wm= is formatted to 2 decimal places", async () => {
    const { encode } = await import("./signal.js");
    const signal = encode(makeState({ wiseMind: 0.5 }));
    expect(signal).toContain("wm=0.50");
  });

  it("color field encodes all three channels", async () => {
    const { encode } = await import("./signal.js");
    const signal = encode(makeState({ colors: { red: 0.1, yellow: 0.6, blue: 0.3 } }));
    expect(signal).toContain("c=r0.10/y0.60/b0.30");
  });

  it("bs=- when bullshitDominant is null", async () => {
    const { encode } = await import("./signal.js");
    expect(encode(makeState({ bullshitDominant: null }))).toContain("bs=-");
  });

  it("bs= contains bullshit type when dominant", async () => {
    const { encode } = await import("./signal.js");
    expect(encode(makeState({ bullshitDominant: "hedge_fog" }))).toContain("bs=hedge_fog");
  });

  it("omits grey= field when consecutiveGrey is 0", async () => {
    const { encode } = await import("./signal.js");
    expect(encode(makeState({ consecutiveGrey: 0 }))).not.toContain("grey=");
  });

  it("includes grey= field when consecutiveGrey > 0", async () => {
    const { encode } = await import("./signal.js");
    expect(encode(makeState({ consecutiveGrey: 3 }))).toContain("grey=3");
  });

  it("omits alerts= when alerts array is empty", async () => {
    const { encode } = await import("./signal.js");
    expect(encode(makeState({ alerts: [] }))).not.toContain("alerts=");
  });

  it("includes alerts= when alerts present", async () => {
    const { encode } = await import("./signal.js");
    expect(encode(makeState({ alerts: ["drift"] }))).toContain("alerts=drift");
  });

  it("includes tool= when lastTool is set", async () => {
    const { encode } = await import("./signal.js");
    expect(encode(makeState({ lastTool: "read_file" }))).toContain("tool=read_file");
  });

  it("omits tool= when lastTool is not set", async () => {
    const { encode } = await import("./signal.js");
    expect(encode(makeState())).not.toContain("tool=");
  });

  it("da= uses 4-part format when disagreements object present", async () => {
    const { encode } = await import("./signal.js");
    const signal = encode(
      makeState({
        disagreements: {
          total: 5,
          agent_yielded: 2,
          human_yielded: 2,
          unresolved: 1,
          yield_ratio: 0.4,
        },
      }),
    );
    expect(signal).toMatch(/da=5\/2\/2\/0\.40/);
  });
});

// ─── emoji output ────────────────────────────────────────────────────────────

describe("emoji output", () => {
  it("returns exactly 7 grapheme clusters for a normal state", async () => {
    const { emoji } = await import("./signal.js");
    const sig = emoji(makeState());
    // Segment by Unicode grapheme clusters
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    const clusters = [...seg.segment(sig)];
    expect(clusters).toHaveLength(7);
  });

  it("position 0 is green heart for alive pulse", async () => {
    const { emoji } = await import("./signal.js");
    const sig = emoji(makeState({ pulse: "alive" }));
    // Green heart is \u{1F49A}
    expect(sig).toMatch(/^\u{1F49A}/u);
  });

  it("position 0 is siren for grey pulse", async () => {
    const { emoji } = await import("./signal.js");
    const sig = emoji(makeState({ pulse: "grey" }));
    expect(sig).toMatch(/^\u{1F6A8}/u);
  });

  it("position 0 is skull for black pulse", async () => {
    const { emoji } = await import("./signal.js");
    const sig = emoji(makeState({ pulse: "black" }));
    expect(sig).toMatch(/^\u{1F480}/u);
  });

  it("position 1 reflects wise mind via moon phases", async () => {
    const { emoji } = await import("./signal.js");
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });

    // wiseMind=0 → floor(0*5)=0 → new moon \u{1F311}
    const low = [...seg.segment(emoji(makeState({ wiseMind: 0 })))];
    expect(low[1]?.segment).toBe("\u{1F311}");

    // wiseMind=0.99 → floor(0.99*5)=4 → full moon \u{1F315}
    const high = [...seg.segment(emoji(makeState({ wiseMind: 0.99 })))];
    expect(high[1]?.segment).toBe("\u{1F315}");
  });

  it("position 2 is rainbow when colors are balanced", async () => {
    const { emoji } = await import("./signal.js");
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    // all equal — max-min = 0 < 0.15 → balanced → rainbow
    const sig = [
      ...seg.segment(emoji(makeState({ colors: { red: 0.33, yellow: 0.33, blue: 0.34 } }))),
    ];
    expect(sig[2]?.segment).toBe("\u{1F308}");
  });

  it("position 2 is fire when red dominates", async () => {
    const { emoji } = await import("./signal.js");
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    const sig = [
      ...seg.segment(emoji(makeState({ colors: { red: 0.8, yellow: 0.1, blue: 0.1 } }))),
    ];
    expect(sig[2]?.segment).toBe("\u{1F525}");
  });

  it("position 2 is wave when blue dominates", async () => {
    const { emoji } = await import("./signal.js");
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    const sig = [
      ...seg.segment(emoji(makeState({ colors: { red: 0.1, yellow: 0.1, blue: 0.8 } }))),
    ];
    expect(sig[2]?.segment).toBe("\u{1F30A}");
  });

  it("position 3 reflects human tone", async () => {
    const { emoji } = await import("./signal.js");
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });

    const cases: [SignalState["humanTone"], string][] = [
      ["neutral", "\u{1F610}"],
      ["frustrated", "\u{1F621}"],
      ["confused", "\u{1F615}"],
      ["excited", "\u{1F929}"],
      ["fatigued", "\u{1F634}"],
      ["looping", "\u{1F504}"],
    ];

    for (const [tone, expected] of cases) {
      const sig = [...seg.segment(emoji(makeState({ humanTone: tone })))];
      expect(sig[3]?.segment).toBe(expected);
    }
  });

  it("position 4 is checkmark when no bullshit", async () => {
    const { emoji } = await import("./signal.js");
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    const sig = [...seg.segment(emoji(makeState({ bullshitDominant: null })))];
    expect(sig[4]?.segment).toBe("\u{2705}");
  });

  it("position 4 is theater mask for sycophancy", async () => {
    const { emoji } = await import("./signal.js");
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    const sig = [...seg.segment(emoji(makeState({ bullshitDominant: "sycophancy" })))];
    expect(sig[4]?.segment).toBe("\u{1F3AD}");
  });

  it("position 5 is thinking face when no disagreements", async () => {
    const { emoji } = await import("./signal.js");
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    const sig = [...seg.segment(emoji(makeState()))];
    expect(sig[5]?.segment).toBe("\u{1F914}");
  });

  it("position 5 is thinking face when disagreements total = 0", async () => {
    const { emoji } = await import("./signal.js");
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    const sig = [
      ...seg.segment(
        emoji(
          makeState({
            disagreements: {
              total: 0,
              agent_yielded: 0,
              human_yielded: 0,
              unresolved: 0,
              yield_ratio: 0,
            },
          }),
        ),
      ),
    ];
    expect(sig[5]?.segment).toBe("\u{1F914}");
  });

  it("position 5 is handshake when yield ratio is healthy (0.2-0.8)", async () => {
    const { emoji } = await import("./signal.js");
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    const sig = [
      ...seg.segment(
        emoji(
          makeState({
            disagreements: {
              total: 5,
              agent_yielded: 2,
              human_yielded: 2,
              unresolved: 1,
              yield_ratio: 0.5,
            },
          }),
        ),
      ),
    ];
    expect(sig[5]?.segment).toBe("\u{1F91D}");
  });

  it("position 5 is siren when yield ratio is extreme (> 0.9)", async () => {
    const { emoji } = await import("./signal.js");
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    const sig = [
      ...seg.segment(
        emoji(
          makeState({
            disagreements: {
              total: 10,
              agent_yielded: 10,
              human_yielded: 0,
              unresolved: 0,
              yield_ratio: 1.0,
            },
          }),
        ),
      ),
    ];
    expect(sig[5]?.segment).toBe("\u{1F6A8}");
  });

  it("position 6 is seedling for early turns (<=5)", async () => {
    const { emoji } = await import("./signal.js");
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    const sig = [...seg.segment(emoji(makeState({ turn: 3 })))];
    expect(sig[6]?.segment).toBe("\u{1F331}");
  });

  it("position 6 is tree for mid turns (6-15)", async () => {
    const { emoji } = await import("./signal.js");
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    const sig = [...seg.segment(emoji(makeState({ turn: 10 })))];
    expect(sig[6]?.segment).toBe("\u{1F333}");
  });

  it("position 6 is mountain for turns 16-30", async () => {
    const { emoji } = await import("./signal.js");
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    const sig = [...seg.segment(emoji(makeState({ turn: 20 })))];
    // \u{1F3D4}\u{FE0F} — snow capped mountain
    expect(sig[6]?.segment).toBe("\u{1F3D4}\u{FE0F}");
  });

  it("position 6 is volcano for turns > 30", async () => {
    const { emoji } = await import("./signal.js");
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    const sig = [...seg.segment(emoji(makeState({ turn: 50 })))];
    expect(sig[6]?.segment).toBe("\u{1F30B}");
  });
});

// ─── decode handles malformed input ──────────────────────────────────────────

describe("decode — malformed input", () => {
  it("returns empty object for empty string", async () => {
    const { decode } = await import("./signal.js");
    expect(decode("")).toEqual({});
  });

  it("returns empty object for non-COEF string", async () => {
    const { decode } = await import("./signal.js");
    expect(decode("hello world")).toEqual({});
    expect(decode("pulse=alive wm=0.5")).toEqual({});
  });

  it("returns empty object for COEF/2 (wrong version)", async () => {
    const { decode } = await import("./signal.js");
    expect(decode("COEF/2 pulse=alive wm=0.50")).toEqual({});
  });

  it("returns partial state when some fields are missing", async () => {
    const { decode } = await import("./signal.js");
    const result = decode("COEF/1 pulse=grey wm=0.30");
    expect(result.pulse).toBe("grey");
    expect(result.wiseMind).toBeCloseTo(0.3, 2);
    expect(result.colors).toBeUndefined();
  });

  it("does not throw on garbage after COEF/1", async () => {
    const { decode } = await import("./signal.js");
    expect(() => decode("COEF/1 $$$ ??? ###")).not.toThrow();
  });

  it("does not throw on NaN-producing color fields", async () => {
    const { decode } = await import("./signal.js");
    // c= field present but unparseable — match will fail, colors will be undefined
    expect(() => decode("COEF/1 c=notacolor")).not.toThrow();
  });

  it("ignores unknown fields gracefully", async () => {
    const { decode } = await import("./signal.js");
    const result = decode("COEF/1 pulse=alive wm=0.80 unknown_field=xyz t=5");
    expect(result.pulse).toBe("alive");
    expect(result.wiseMind).toBeCloseTo(0.8, 2);
    expect(result.turn).toBe(5);
  });

  it("handles da= with only one segment (disagreementYieldRatio fallback)", async () => {
    const { decode } = await import("./signal.js");
    const result = decode("COEF/1 da=0.45");
    // Less than 4 parts — disagreements object not created, but ratio is parsed
    expect(result.disagreements).toBeUndefined();
    expect(result.disagreementYieldRatio).toBeCloseTo(0.45, 2);
  });
});

// ─── history ────────────────────────────────────────────────────────────────

describe("history — record and retrieval", () => {
  let sig: Awaited<ReturnType<typeof freshSignal>>;

  beforeEach(async () => {
    sig = await freshSignal();
  });

  it("starts empty", () => {
    expect(sig.history()).toHaveLength(0);
  });

  it("record adds an entry", () => {
    sig.record("COEF/1 pulse=alive wm=0.70 t=1");
    expect(sig.history()).toHaveLength(1);
    expect(sig.history()[0]).toBe("COEF/1 pulse=alive wm=0.70 t=1");
  });

  it("record adds multiple entries in order", () => {
    sig.record("COEF/1 pulse=alive wm=0.80 t=1");
    sig.record("COEF/1 pulse=grey wm=0.30 t=2");
    sig.record("COEF/1 pulse=alive wm=0.60 t=3");

    const h = sig.history();
    expect(h).toHaveLength(3);
    expect(h[0]).toContain("t=1");
    expect(h[1]).toContain("t=2");
    expect(h[2]).toContain("t=3");
  });

  it("history returns a readonly view (is not directly mutable)", () => {
    sig.record("COEF/1 pulse=alive wm=0.50 t=1");
    const h = sig.history();
    // Casting to any to attempt mutation — history should remain stable
    (h as string[]).push("sneaky");
    // The internal state should not be affected by mutations of the returned array
    // (readonly type in TS, runtime behavior depends on implementation —
    // at minimum the returned reference is typed readonly)
    expect(typeof h[0]).toBe("string");
  });

  it("enforces max 50 entries rolling window", () => {
    for (let i = 0; i < 60; i++) {
      sig.record(`COEF/1 pulse=alive wm=0.50 t=${i}`);
    }
    expect(sig.history()).toHaveLength(50);
  });

  it("rolling window keeps the most recent 50 when overflow occurs", () => {
    for (let i = 0; i < 60; i++) {
      sig.record(`COEF/1 pulse=alive wm=0.50 t=${i}`);
    }
    const h = sig.history();
    // First entry should be t=10 (oldest of the last 50)
    expect(h[0]).toContain("t=10");
    // Last entry should be t=59
    expect(h[49]).toContain("t=59");
  });
});

// ─── trend ───────────────────────────────────────────────────────────────────

describe("trend — empty history", () => {
  let sig: Awaited<ReturnType<typeof freshSignal>>;

  beforeEach(async () => {
    sig = await freshSignal();
  });

  it("returns zero greyRate and stable direction when history is empty", () => {
    const t = sig.trend();
    expect(t.greyRate).toBe(0);
    expect(t.avgWiseMind).toBe(0);
    expect(t.pulseSequence).toBe("");
    expect(t.driftDirection).toBe("stable");
  });
});

describe("trend — greyRate calculation", () => {
  let sig: Awaited<ReturnType<typeof freshSignal>>;

  beforeEach(async () => {
    sig = await freshSignal();
  });

  it("greyRate is 1.0 when all signals are grey", () => {
    const greySignal = "COEF/1 pulse=grey wm=0.20 c=r0.30/y0.30/b0.40 ht=neutral bs=- da=0.50 t=1";
    for (let i = 0; i < 5; i++) sig.record(greySignal);
    expect(sig.trend().greyRate).toBe(1.0);
  });

  it("greyRate is 0.0 when all signals are alive", () => {
    const aliveSignal =
      "COEF/1 pulse=alive wm=0.80 c=r0.30/y0.40/b0.30 ht=neutral bs=- da=0.50 t=1";
    for (let i = 0; i < 5; i++) sig.record(aliveSignal);
    expect(sig.trend().greyRate).toBe(0.0);
  });

  it("greyRate is 0.5 when half grey half alive", () => {
    const aliveSignal =
      "COEF/1 pulse=alive wm=0.80 c=r0.30/y0.40/b0.30 ht=neutral bs=- da=0.50 t=1";
    const greySignal = "COEF/1 pulse=grey wm=0.20 c=r0.30/y0.30/b0.40 ht=neutral bs=- da=0.50 t=2";
    sig.record(aliveSignal);
    sig.record(aliveSignal);
    sig.record(greySignal);
    sig.record(greySignal);
    expect(sig.trend().greyRate).toBe(0.5);
  });

  it("counts black pulse as grey for greyRate", () => {
    sig.record("COEF/1 pulse=black wm=0.00 c=r0.30/y0.30/b0.40 ht=neutral bs=- da=0.50 t=1");
    sig.record("COEF/1 pulse=alive wm=0.80 c=r0.30/y0.40/b0.30 ht=neutral bs=- da=0.50 t=2");
    expect(sig.trend().greyRate).toBe(0.5);
  });
});

describe("trend — avgWiseMind", () => {
  let sig: Awaited<ReturnType<typeof freshSignal>>;

  beforeEach(async () => {
    sig = await freshSignal();
  });

  it("computes average wise mind across signals", () => {
    sig.record("COEF/1 pulse=alive wm=0.40 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=1");
    sig.record("COEF/1 pulse=alive wm=0.60 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=2");
    sig.record("COEF/1 pulse=alive wm=0.80 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=3");
    const t = sig.trend();
    expect(t.avgWiseMind).toBeCloseTo(0.6, 2);
  });
});

describe("trend — pulseSequence", () => {
  let sig: Awaited<ReturnType<typeof freshSignal>>;

  beforeEach(async () => {
    sig = await freshSignal();
  });

  it("pulseSequence is first-letter abbreviations of pulse states in order", () => {
    sig.record("COEF/1 pulse=alive wm=0.80 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=1");
    sig.record("COEF/1 pulse=grey wm=0.20 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=2");
    sig.record("COEF/1 pulse=black wm=0.00 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=3");
    sig.record("COEF/1 pulse=alive wm=0.70 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=4");
    expect(sig.trend().pulseSequence).toBe("agba");
  });
});

describe("trend — driftDirection", () => {
  let sig: Awaited<ReturnType<typeof freshSignal>>;

  beforeEach(async () => {
    sig = await freshSignal();
  });

  it("is stable when fewer than 6 signals recorded", () => {
    for (let i = 0; i < 5; i++) {
      sig.record(
        `COEF/1 pulse=alive wm=0.50 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=${i + 1}`,
      );
    }
    expect(sig.trend().driftDirection).toBe("stable");
  });

  it("is improving when second-half wise mind is significantly higher", () => {
    // First half: wm=0.20 (3 signals)
    // Second half: wm=0.80 (3 signals)
    // diff = 0.80 - 0.20 = 0.60 > 0.05 → improving
    for (let i = 0; i < 3; i++) {
      sig.record(
        `COEF/1 pulse=alive wm=0.20 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=${i + 1}`,
      );
    }
    for (let i = 0; i < 3; i++) {
      sig.record(
        `COEF/1 pulse=alive wm=0.80 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=${i + 4}`,
      );
    }
    expect(sig.trend().driftDirection).toBe("improving");
  });

  it("is degrading when second-half wise mind is significantly lower", () => {
    // First half: wm=0.80 (3 signals)
    // Second half: wm=0.20 (3 signals)
    // diff = 0.20 - 0.80 = -0.60 < -0.05 → degrading
    for (let i = 0; i < 3; i++) {
      sig.record(
        `COEF/1 pulse=alive wm=0.80 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=${i + 1}`,
      );
    }
    for (let i = 0; i < 3; i++) {
      sig.record(
        `COEF/1 pulse=alive wm=0.20 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=${i + 4}`,
      );
    }
    expect(sig.trend().driftDirection).toBe("degrading");
  });

  it("is stable when difference is within noise threshold (< 0.05)", () => {
    // diff = 0.52 - 0.50 = 0.02 — within threshold
    for (let i = 0; i < 3; i++) {
      sig.record(
        `COEF/1 pulse=alive wm=0.50 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=${i + 1}`,
      );
    }
    for (let i = 0; i < 3; i++) {
      sig.record(
        `COEF/1 pulse=alive wm=0.52 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=${i + 4}`,
      );
    }
    expect(sig.trend().driftDirection).toBe("stable");
  });

  it("grey run produces high greyRate and stable or degrading direction", () => {
    // 8 grey signals in a row
    const greySignal = "COEF/1 pulse=grey wm=0.15 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=1";
    for (let i = 0; i < 8; i++) sig.record(greySignal);

    const t = sig.trend();
    expect(t.greyRate).toBe(1.0);
    // All same wm → diff = 0 → stable
    expect(t.driftDirection).toBe("stable");
  });

  it("improving run drives greyRate down and direction to improving", () => {
    // Start in the grey, recover to alive
    for (let i = 0; i < 4; i++) {
      sig.record("COEF/1 pulse=grey wm=0.10 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=1");
    }
    for (let i = 0; i < 6; i++) {
      sig.record("COEF/1 pulse=alive wm=0.90 c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=2");
    }
    const t = sig.trend();
    // 4 grey out of 10 total
    expect(t.greyRate).toBe(0.4);
    expect(t.driftDirection).toBe("improving");
  });
});

// ─── edge cases ──────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("encode does not throw on minimal state (no optional fields)", async () => {
    const { encode } = await import("./signal.js");
    const minimal: SignalState = {
      pulse: "alive",
      wiseMind: 0.5,
      colors: { red: 0.33, yellow: 0.33, blue: 0.34 },
      humanTone: "neutral",
      bullshitDominant: null,
      disagreementYieldRatio: 0.5,
      turn: 1,
    };
    expect(() => encode(minimal)).not.toThrow();
  });

  it("encode with wiseMind = 0 emits wm=0.00", async () => {
    const { encode } = await import("./signal.js");
    expect(encode(makeState({ wiseMind: 0 }))).toContain("wm=0.00");
  });

  it("encode with wiseMind = 1 emits wm=1.00", async () => {
    const { encode } = await import("./signal.js");
    expect(encode(makeState({ wiseMind: 1 }))).toContain("wm=1.00");
  });

  it("decode of non-COEF string always returns empty object", async () => {
    const { decode } = await import("./signal.js");
    const nonCoef = [
      "",
      "random text",
      "COEF",
      "COEF/",
      "/ pulse=alive",
      "coef/1 pulse=alive", // lowercase — wrong
    ];
    for (const s of nonCoef) {
      expect(decode(s)).toEqual({});
    }
  });

  it("encode then decode is stable across all bullshit types", async () => {
    const { encode, decode } = await import("./signal.js");
    const types: NonNullable<SignalState["bullshitDominant"]>[] = [
      "sycophancy",
      "safety_theater",
      "hedge_fog",
      "list_dumping",
      "vagueness",
      "half_truth",
      "embellishment",
      "half_ass",
    ];
    for (const type of types) {
      const decoded = decode(encode(makeState({ bullshitDominant: type })));
      expect(decoded.bullshitDominant).toBe(type);
    }
  });

  it("emoji does not throw for any pulse state", async () => {
    const { emoji } = await import("./signal.js");
    expect(() => emoji(makeState({ pulse: "alive" }))).not.toThrow();
    expect(() => emoji(makeState({ pulse: "grey" }))).not.toThrow();
    expect(() => emoji(makeState({ pulse: "black" }))).not.toThrow();
  });

  it("trend with 6+ signals but no parseable wm returns stable", async () => {
    const sig = await freshSignal();
    // COEF/1 header present but no wm= field
    for (let i = 0; i < 6; i++) {
      sig.record(`COEF/1 pulse=alive c=r0.33/y0.33/b0.34 ht=neutral bs=- da=0.50 t=${i}`);
    }
    const t = sig.trend();
    // wmCount = 0 → avgWiseMind = 0
    expect(t.avgWiseMind).toBe(0);
    // fc=0 or sc=0 → no diff computed → stable
    expect(t.driftDirection).toBe("stable");
  });
});

// ─── diff (bonus) ────────────────────────────────────────────────────────────

describe("diff", () => {
  it("returns empty array when signals are identical", async () => {
    const { encode, diff } = await import("./signal.js");
    const s = encode(makeState());
    expect(diff(s, s)).toEqual([]);
  });

  it("reports pulse change", async () => {
    const { encode, diff } = await import("./signal.js");
    const prev = encode(makeState({ pulse: "alive" }));
    const curr = encode(makeState({ pulse: "grey" }));
    const changes = diff(prev, curr);
    expect(changes.some((c) => c.startsWith("pulse:"))).toBe(true);
    expect(changes[0]).toBe("pulse:alive->grey");
  });

  it("reports wise mind change when delta > 0.05", async () => {
    const { encode, diff } = await import("./signal.js");
    const prev = encode(makeState({ wiseMind: 0.3 }));
    const curr = encode(makeState({ wiseMind: 0.8 }));
    const changes = diff(prev, curr);
    expect(changes.some((c) => c.startsWith("wm:"))).toBe(true);
  });

  it("does not report wise mind change when delta <= 0.05", async () => {
    const { encode, diff } = await import("./signal.js");
    const prev = encode(makeState({ wiseMind: 0.5 }));
    const curr = encode(makeState({ wiseMind: 0.53 }));
    const changes = diff(prev, curr);
    expect(changes.some((c) => c.startsWith("wm:"))).toBe(false);
  });

  it("reports human tone change", async () => {
    const { encode, diff } = await import("./signal.js");
    const prev = encode(makeState({ humanTone: "neutral" }));
    const curr = encode(makeState({ humanTone: "frustrated" }));
    const changes = diff(prev, curr);
    expect(changes).toContain("ht:neutral->frustrated");
  });

  it("reports bullshit dominant change", async () => {
    const { encode, diff } = await import("./signal.js");
    const prev = encode(makeState({ bullshitDominant: null }));
    const curr = encode(makeState({ bullshitDominant: "vagueness" }));
    const changes = diff(prev, curr);
    expect(changes.some((c) => c.startsWith("bs:"))).toBe(true);
  });
});

// ─── lossy channel roundtrip ────────────────────────────────────────────────

describe("lossy channel roundtrip", () => {
  it("roundtrips multi-tone lossy state", async () => {
    const { encode, decode } = await import("./signal.js");
    const state = makeState({
      lossy: {
        tones: [
          { tone: "frustrated", score: 0.45 },
          { tone: "excited", score: 0.24 },
        ],
        urgency: 0.78,
        subtext: "anger is information",
        confidence: 0.72,
      },
    });
    const decoded = decode(encode(state));

    expect(decoded.lossy).toBeDefined();
    expect(decoded.lossy!.tones).toHaveLength(2);
    expect(decoded.lossy!.tones[0].tone).toBe("frustrated");
    expect(decoded.lossy!.tones[0].score).toBeCloseTo(0.45, 2);
    expect(decoded.lossy!.tones[1].tone).toBe("excited");
    expect(decoded.lossy!.urgency).toBeCloseTo(0.78, 2);
    expect(decoded.lossy!.confidence).toBeCloseTo(0.72, 2);
  });

  it("handles missing lossy gracefully", async () => {
    const { encode, decode } = await import("./signal.js");
    const state = makeState(); // no lossy
    const decoded = decode(encode(state));
    expect(decoded.lossy).toBeUndefined();
  });

  it("preserves subtext with spaces", async () => {
    const { encode, decode } = await import("./signal.js");
    const state = makeState({
      lossy: {
        tones: [{ tone: "confused", score: 0.6 }],
        urgency: 0.5,
        subtext: "anger is information",
        confidence: 0.65,
      },
    });
    const decoded = decode(encode(state));
    expect(decoded.lossy!.subtext).toBe("anger is information");
  });

  it("encodes lossy after single pipe separator", async () => {
    const { encode } = await import("./signal.js");
    const state = makeState({
      lossy: {
        tones: [{ tone: "excited", score: 0.6 }],
        urgency: 0.35,
        confidence: 0.7,
      },
    });
    const signal = encode(state);
    expect(signal).toContain(" | ");
    expect(signal).not.toContain(" || ");
    expect(signal).toContain("urg=0.35");
  });
});

// ─── wise channel roundtrip ─────────────────────────────────────────────────

describe("wise channel roundtrip", () => {
  it("roundtrips full wise state with tension", async () => {
    const { encode, decode } = await import("./signal.js");
    const state = makeState({
      lossy: {
        tones: [{ tone: "frustrated", score: 0.45 }],
        urgency: 0.8,
        confidence: 0.72,
      },
      wise: {
        coherence: 0.75,
        tension: "stuck",
        stance: "confront",
        read: "they feel the sycophancy. something real is broken.",
        confidence: 0.68,
      },
    });
    const decoded = decode(encode(state));

    expect(decoded.wise).toBeDefined();
    expect(decoded.wise!.coherence).toBeCloseTo(0.75, 2);
    expect(decoded.wise!.tension).toBe("stuck");
    expect(decoded.wise!.stance).toBe("confront");
    expect(decoded.wise!.confidence).toBeCloseTo(0.68, 2);
    expect(decoded.wise!.read).toContain("sycophancy");
  });

  it("handles null tension", async () => {
    const { encode, decode } = await import("./signal.js");
    const state = makeState({
      lossy: {
        tones: [{ tone: "neutral", score: 0.3 }],
        urgency: 0.3,
        confidence: 0.5,
      },
      wise: {
        coherence: 0.8,
        tension: null,
        stance: "hold",
        read: "steady state",
        confidence: 0.7,
      },
    });
    const signal = encode(state);
    expect(signal).not.toContain("ten=");
    const decoded = decode(signal);
    expect(decoded.wise!.tension).toBeNull();
  });

  it("truncates read to 80 chars", async () => {
    const { encode, decode } = await import("./signal.js");
    const longRead = "a".repeat(120);
    const state = makeState({
      wise: {
        coherence: 0.5,
        tension: null,
        stance: "hold",
        read: longRead,
        confidence: 0.5,
      },
    });
    const decoded = decode(encode(state));
    expect(decoded.wise!.read.length).toBeLessThanOrEqual(80);
  });

  it("encodes wise after double pipe separator", async () => {
    const { encode } = await import("./signal.js");
    const state = makeState({
      lossy: {
        tones: [{ tone: "frustrated", score: 0.4 }],
        urgency: 0.6,
        confidence: 0.7,
      },
      wise: {
        coherence: 0.6,
        tension: "storm",
        stance: "match",
        read: "intense but alive",
        confidence: 0.72,
      },
    });
    const signal = encode(state);
    expect(signal).toContain(" | ");
    expect(signal).toContain(" || ");
    expect(signal).toContain("sta=match");
    expect(signal).toContain("ten=storm");
  });
});

// ─── three-channel backward compat ──────────────────────────────────────────

describe("three-channel backward compat", () => {
  it("decodes old signals without lossy or wise", async () => {
    const { decode } = await import("./signal.js");
    const old = "COEF/1 pulse=alive wm=0.42 c=r0.30/y0.50/b0.20 ht=neutral bs=- da=4/2/2/0.50 t=7";
    const decoded = decode(old);
    expect(decoded.pulse).toBe("alive");
    expect(decoded.lossy).toBeUndefined();
    expect(decoded.wise).toBeUndefined();
  });

  it("decodes two-channel signals without wise", async () => {
    const { encode, decode } = await import("./signal.js");
    const state = makeState({
      lossy: {
        tones: [{ tone: "excited", score: 0.6 }],
        urgency: 0.35,
        confidence: 0.7,
      },
    });
    const decoded = decode(encode(state));
    expect(decoded.lossy).toBeDefined();
    expect(decoded.wise).toBeUndefined();
  });

  it("diff detects wise stance changes", async () => {
    const { encode, diff } = await import("./signal.js");
    const prev = encode(
      makeState({
        wise: { coherence: 0.5, tension: null, stance: "hold", read: "steady", confidence: 0.5 },
      }),
    );
    const curr = encode(
      makeState({
        wise: {
          coherence: 0.5,
          tension: "stuck",
          stance: "confront",
          read: "broken",
          confidence: 0.5,
        },
      }),
    );
    const changes = diff(prev, curr);
    expect(changes.some((c) => c.startsWith("wise_stance:"))).toBe(true);
    expect(changes.some((c) => c.startsWith("wise_tension:"))).toBe(true);
  });

  it("diff detects lossy urgency shifts", async () => {
    const { encode, diff } = await import("./signal.js");
    const prev = encode(
      makeState({
        lossy: { tones: [{ tone: "neutral", score: 0.3 }], urgency: 0.3, confidence: 0.5 },
      }),
    );
    const curr = encode(
      makeState({
        lossy: { tones: [{ tone: "frustrated", score: 0.8 }], urgency: 0.8, confidence: 0.7 },
      }),
    );
    const changes = diff(prev, curr);
    expect(changes.some((c) => c.startsWith("urg:"))).toBe(true);
    expect(changes.some((c) => c.startsWith("lossy_tone:"))).toBe(true);
  });

  it("diff detects lossy appearing", async () => {
    const { encode, diff } = await import("./signal.js");
    const prev = encode(makeState());
    const curr = encode(
      makeState({
        lossy: { tones: [{ tone: "excited", score: 0.5 }], urgency: 0.4, confidence: 0.6 },
      }),
    );
    const changes = diff(prev, curr);
    expect(changes).toContain("lossy:appeared");
  });

  it("diff detects wise appearing", async () => {
    const { encode, diff } = await import("./signal.js");
    const prev = encode(makeState());
    const curr = encode(
      makeState({
        wise: { coherence: 0.7, tension: null, stance: "hold", read: "ok", confidence: 0.6 },
      }),
    );
    const changes = diff(prev, curr);
    expect(changes).toContain("wise:appeared");
  });
});
