import { describe, it, expect } from "vitest";
import { encode, decode, emoji, diff, record, history, trend } from "./signal.ts";
import type { SignalState } from "../shared/types.ts";

function makeState(overrides: Partial<SignalState> = {}): SignalState {
  return {
    pulse: "alive",
    wiseMind: 0.5,
    colors: { red: 0.3, yellow: 0.4, blue: 0.3 },
    humanTone: "neutral",
    struggleDominant: null,
    disagreementYieldRatio: 0.5,
    turn: 5,
    ...overrides,
  };
}

describe("COEF encode/decode roundtrip", () => {
  it("roundtrips basic state", () => {
    const state = makeState();
    const encoded = encode(state);
    const decoded = decode(encoded);

    expect(decoded.pulse).toBe("alive");
    expect(decoded.wiseMind).toBeCloseTo(0.5, 1);
    expect(decoded.humanTone).toBe("neutral");
    expect(decoded.turn).toBe(5);
  });

  it("roundtrips colors", () => {
    const state = makeState({ colors: { red: 0.7, yellow: 0.2, blue: 0.1 } });
    const decoded = decode(encode(state));

    expect(decoded.colors!.red).toBeCloseTo(0.7, 1);
    expect(decoded.colors!.yellow).toBeCloseTo(0.2, 1);
    expect(decoded.colors!.blue).toBeCloseTo(0.1, 1);
  });

  it("roundtrips struggle dominant", () => {
    const state = makeState({ struggleDominant: "sycophancy" });
    const decoded = decode(encode(state));
    expect(decoded.struggleDominant).toBe("sycophancy");
  });

  it("roundtrips null struggle as dash", () => {
    const state = makeState({ struggleDominant: null });
    const encoded = encode(state);
    expect(encoded).toContain("bs=-");
    const decoded = decode(encoded);
    expect(decoded.struggleDominant).toBeNull();
  });

  it("roundtrips disagreement stats", () => {
    const state = makeState({
      disagreements: {
        total: 5,
        agent_yielded: 2,
        human_yielded: 1,
        unresolved: 2,
        yield_ratio: 0.4,
      },
    });
    const decoded = decode(encode(state));
    expect(decoded.disagreements!.total).toBe(5);
    expect(decoded.disagreements!.agent_yielded).toBe(2);
    expect(decoded.disagreements!.yield_ratio).toBeCloseTo(0.4, 1);
  });

  it("roundtrips consecutive grey", () => {
    const state = makeState({ consecutiveGrey: 3 });
    const decoded = decode(encode(state));
    expect(decoded.consecutiveGrey).toBe(3);
  });

  it("omits consecutive grey when zero", () => {
    const state = makeState({ consecutiveGrey: 0 });
    const encoded = encode(state);
    expect(encoded).not.toContain("grey=");
  });

  it("roundtrips struggle readings", () => {
    const state = makeState({
      struggleReadings: [
        { type: "sycophancy", score: 0.45, signals: [] },
        { type: "hedge_fog", score: 0.3, signals: [] },
      ],
    });
    const decoded = decode(encode(state));
    expect(decoded.struggleReadings).toHaveLength(2);
    expect(decoded.struggleReadings![0].type).toBe("sycophancy");
    expect(decoded.struggleReadings![0].score).toBeCloseTo(0.45, 1);
  });

  it("roundtrips lossy channel", () => {
    const state = makeState({
      lossy: {
        tones: [
          { tone: "frustrated", score: 0.8 },
          { tone: "excited", score: 0.2 },
        ],
        urgency: 0.65,
        subtext: "anger is information",
        confidence: 0.72,
      },
    });
    const decoded = decode(encode(state));
    expect(decoded.lossy).toBeDefined();
    expect(decoded.lossy!.urgency).toBeCloseTo(0.65, 1);
    expect(decoded.lossy!.confidence).toBeCloseTo(0.72, 1);
    expect(decoded.lossy!.subtext).toBe("anger is information");
    expect(decoded.lossy!.tones[0].tone).toBe("frustrated");
  });

  it("roundtrips wise channel", () => {
    const state = makeState({
      wise: {
        coherence: 0.85,
        tension: "storm",
        stance: "redirect",
        read: "intense but alive",
        confidence: 0.7,
      },
    });
    const decoded = decode(encode(state));
    expect(decoded.wise).toBeDefined();
    expect(decoded.wise!.coherence).toBeCloseTo(0.85, 1);
    expect(decoded.wise!.tension).toBe("storm");
    expect(decoded.wise!.stance).toBe("redirect");
    expect(decoded.wise!.read).toBe("intense but alive");
  });

  it("roundtrips memory channel", () => {
    const state = makeState({
      memory: {
        claims: { total: 10, active: 7, stale: 2, contradicted: 1 },
        knowledge: { entities: 5, relations: 3 },
        complexity: "mid",
        health: "warm",
        reflexions: 2,
        breathing: true,
        blindSpots: 1,
        corrections: 3,
      },
    });
    const decoded = decode(encode(state));
    expect(decoded.memory).toBeDefined();
    expect(decoded.memory!.claims.total).toBe(10);
    expect(decoded.memory!.claims.contradicted).toBe(1);
    expect(decoded.memory!.knowledge.entities).toBe(5);
    expect(decoded.memory!.complexity).toBe("mid");
    expect(decoded.memory!.breathing).toBe(true);
  });

  it("roundtrips substrate channel with Greek letters", () => {
    const state = makeState({
      substrate: {
        theta: 0.42,
        firing: true,
        regime: "lindblad_quantum",
        sigmaStar: 0.65,
        resonanceDistance: 0.12,
        noiseClarity: 0.88,
        urgency: 0.33,
        summary: "test",
      },
    });
    const decoded = decode(encode(state));
    expect(decoded.substrate).toBeDefined();
    expect(decoded.substrate!.theta).toBeCloseTo(0.42, 1);
    expect(decoded.substrate!.sigmaStar).toBeCloseTo(0.65, 1);
    expect(decoded.substrate!.firing).toBe(true);
    expect(decoded.substrate!.regime).toBe("lindblad_quantum");
    expect(decoded.substrate!.resonanceDistance).toBeCloseTo(0.12, 1);
    expect(decoded.substrate!.noiseClarity).toBeCloseTo(0.88, 1);
  });

  it("starts with COEF/1 version prefix", () => {
    const encoded = encode(makeState());
    expect(encoded.startsWith("COEF/1")).toBe(true);
  });

  it("is compact — under 200 chars for basic state", () => {
    const encoded = encode(makeState());
    expect(encoded.length).toBeLessThan(200);
  });
});

describe("decode edge cases", () => {
  it("returns empty object for non-COEF string", () => {
    const decoded = decode("not a coef signal");
    expect(Object.keys(decoded)).toHaveLength(0);
  });

  it("returns empty object for empty string", () => {
    const decoded = decode("");
    expect(Object.keys(decoded)).toHaveLength(0);
  });
});

describe("emoji", () => {
  it("returns a non-empty string", () => {
    const result = emoji(makeState());
    expect(result.length).toBeGreaterThan(0);
  });

  it("changes when pulse changes", () => {
    const alive = emoji(makeState({ pulse: "alive" }));
    const grey = emoji(makeState({ pulse: "grey" }));
    expect(alive).not.toBe(grey);
  });
});

describe("diff", () => {
  it("detects pulse change", () => {
    const prev = encode(makeState({ pulse: "alive" }));
    const curr = encode(makeState({ pulse: "grey" }));
    const changes = diff(prev, curr);
    expect(changes.some((c) => c.startsWith("pulse:"))).toBe(true);
  });

  it("detects tone change", () => {
    const prev = encode(makeState({ humanTone: "neutral" }));
    const curr = encode(makeState({ humanTone: "frustrated" }));
    const changes = diff(prev, curr);
    expect(changes.some((c) => c.startsWith("ht:"))).toBe(true);
  });

  it("returns empty for identical signals", () => {
    const signal = encode(makeState());
    const changes = diff(signal, signal);
    expect(changes).toHaveLength(0);
  });
});

describe("history and trend", () => {
  it("records signals to history", () => {
    const before = history().length;
    record(encode(makeState()));
    expect(history().length).toBe(before + 1);
  });

  it("trend returns stable for few signals", () => {
    const t = trend();
    expect(["improving", "degrading", "stable"]).toContain(t.driftDirection);
  });
});
