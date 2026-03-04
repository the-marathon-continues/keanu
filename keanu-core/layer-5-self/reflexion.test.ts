// reflexion.ts tests
// Learning from stumbles.
//
// The oracle path needs an API key and real HTTP — skip it.
// The fast path is pure logic and we can test all six triggers.
// shouldUseOracle is the gatekeeper — test the decision logic directly.

import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import type { Reflexion } from "../shared/types.js";
import { reflect, formatReflexion, resetRecurrence } from "./reflexion.js";
import type { ReflexionContext } from "./reflexion.js";

// Reset recurrence tracking before each test to prevent cross-test interference
beforeEach(() => {
  resetRecurrence();
});

// ============================================================
// Helpers
// ============================================================

function makeContext(overrides: Partial<ReflexionContext> = {}): ReflexionContext {
  return {
    trigger: "high_struggle",
    turn: 5,
    pulse: {
      state: "alive",
      confidence: 0.8,
      wise_mind: 0.6,
      colors: { red: 0.3, yellow: 0.4, blue: 0.3 },
      signals: [],
      timestamp: new Date().toISOString(),
    },
    struggleReadings: [],
    recentOutputs: ["Here is a comprehensive and robust solution."],
    contradictionCount: 0,
    ...overrides,
  };
}

// ============================================================
// Fast path — reflect() with no API key
// ============================================================
// Without ANTHROPIC_API_KEY, shouldUseOracle returns false for most triggers
// and the fast path runs. We delete the key before tests to ensure that.

describe("reflect — fast path (no oracle)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a Reflexion object for high_bullshit trigger", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await reflect(makeContext({ trigger: "high_struggle" }));
    expect(r.trigger).toBe("high_struggle");
    expect(r.what_happened).toBeTruthy();
    expect(r.why_it_failed).toBeTruthy();
    expect(r.what_was_missed).toBeTruthy();
    expect(r.next_time).toBeTruthy();
  });

  it("high_bullshit with sycophancy mentions agreement or pushback", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await reflect(
      makeContext({
        trigger: "high_struggle",
        struggleReadings: [{ type: "sycophancy", score: 0.8, signals: [] }],
      }),
    );
    // Fast path checks for sycophancy type
    expect(r.why_it_failed.toLowerCase()).toContain("agree");
    expect(r.next_time.toLowerCase()).toMatch(/push back|sycophancy/i);
  });

  it("high_bullshit with vagueness mentions abstract vs specific", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await reflect(
      makeContext({
        trigger: "high_struggle",
        struggleReadings: [{ type: "vagueness", score: 0.7, signals: [] }],
      }),
    );
    expect(r.why_it_failed.toLowerCase()).toMatch(/abstract|specific/i);
  });

  it("consecutive_grey trigger produces appropriate reflection", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await reflect(makeContext({ trigger: "consecutive_grey" }));
    expect(r.trigger).toBe("consecutive_grey");
    expect(r.what_happened.toLowerCase()).toContain("grey");
    expect(r.next_time.toLowerCase()).toMatch(/thinking|generating/i);
  });

  it("black_state trigger produces reflection about lost contact", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await reflect(
      makeContext({
        trigger: "black_state",
        pulse: {
          state: "black",
          confidence: 0.1,
          wise_mind: 0.0,
          colors: { red: 0.1, yellow: 0.1, blue: 0.8 },
          signals: [],
          timestamp: new Date().toISOString(),
        },
      }),
    );
    expect(r.trigger).toBe("black_state");
    expect(r.what_happened.toLowerCase()).toContain("black");
  });

  it("contradiction trigger mentions contradicting output", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await reflect(makeContext({ trigger: "contradiction", contradictionCount: 2 }));
    expect(r.trigger).toBe("contradiction");
    expect(r.what_happened.toLowerCase()).toContain("contradict");
  });

  it("oracle_flag trigger mentions external verification", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await reflect(makeContext({ trigger: "oracle_flag" }));
    expect(r.trigger).toBe("oracle_flag");
    expect(r.what_happened.toLowerCase()).toMatch(/oracle|truth check/i);
  });

  it("manual trigger notes human saw something", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await reflect(makeContext({ trigger: "manual" }));
    expect(r.trigger).toBe("manual");
    expect(r.what_happened.toLowerCase()).toContain("manual");
  });

  it("returns a unique id for each reflexion", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r1 = await reflect(makeContext());
    const r2 = await reflect(makeContext());
    expect(r1.id).not.toBe(r2.id);
    expect(r1.id).toMatch(/^r-\d+-/);
  });

  it("id has the r- prefix format", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await reflect(makeContext());
    expect(r.id).toMatch(/^r-\d+-.+$/);
  });

  it("turn is copied from context", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await reflect(makeContext({ turn: 42 }));
    expect(r.turn).toBe(42);
  });

  it("pulse_state is copied from context pulse", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await reflect(
      makeContext({
        pulse: {
          state: "grey",
          confidence: 0.3,
          wise_mind: 0.2,
          colors: { red: 0.2, yellow: 0.4, blue: 0.4 },
          signals: [],
          timestamp: new Date().toISOString(),
        },
      }),
    );
    expect(r.pulse_state).toBe("grey");
  });

  it("wise_mind is copied from context pulse", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await reflect(
      makeContext({
        pulse: {
          state: "alive",
          confidence: 0.9,
          wise_mind: 0.77,
          colors: { red: 0.3, yellow: 0.4, blue: 0.3 },
          signals: [],
          timestamp: new Date().toISOString(),
        },
      }),
    );
    expect(r.wise_mind).toBeCloseTo(0.77, 2);
  });

  it("struggle_types is extracted from readings", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await reflect(
      makeContext({
        struggleReadings: [
          { type: "sycophancy", score: 0.6, signals: [] },
          { type: "vagueness", score: 0.4, signals: [] },
        ],
      }),
    );
    expect(r.struggle_types).toContain("sycophancy");
    expect(r.struggle_types).toContain("vagueness");
  });

  it("timestamp is an ISO string", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const r = await reflect(makeContext());
    expect(() => new Date(r.timestamp)).not.toThrow();
    expect(isNaN(new Date(r.timestamp).getTime())).toBe(false);
  });
});

// ============================================================
// shouldUseOracle — decision logic
// ============================================================
// The function is not exported, but we can infer its behavior from
// reflect() — if ANTHROPIC_API_KEY is absent, oracle is never used
// and the fast path always runs.

describe("shouldUseOracle — gating logic via env var", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fast path runs when API key is absent (no throw, no network call)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    // black_state would trigger oracle if key existed — but with no key, fast path runs
    const r = await reflect(makeContext({ trigger: "black_state" }));
    // Fast path produces a specific string pattern for black_state
    expect(r.what_happened).toContain("black");
  });

  it("high bullshit score does not cause oracle attempt without API key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    // bullshit score > 0.7 would normally trigger oracle
    const r = await reflect(
      makeContext({
        struggleReadings: [{ type: "embellishment", score: 1.0, signals: [] }],
      }),
    );
    // If oracle had been called without a key, it would throw.
    // Fast path produces known content.
    expect(r.trigger).toBe("high_struggle");
  });
});

// ============================================================
// formatReflexion
// ============================================================

describe("formatReflexion", () => {
  function makeReflexion(overrides: Partial<Reflexion> = {}): Reflexion {
    return {
      id: "r-test-001",
      turn: 3,
      timestamp: new Date().toISOString(),
      trigger: "high_struggle",
      what_happened: "Bullshit score hit 0.80 with sycophancy",
      why_it_failed: "Agreed too readily instead of checking",
      what_was_missed: "The gap between sounding helpful and being useful",
      next_time: "Push back on at least one point per exchange",
      pulse_state: "alive",
      wise_mind: 0.6,
      struggle_types: ["sycophancy"],
      ...overrides,
    };
  }

  it("returns a non-empty string", () => {
    expect(formatReflexion(makeReflexion()).length).toBeGreaterThan(0);
  });

  it("starts with [reflexion:", () => {
    expect(formatReflexion(makeReflexion())).toMatch(/^\[reflexion:/);
  });

  it("includes the trigger in the output", () => {
    expect(formatReflexion(makeReflexion({ trigger: "consecutive_grey" }))).toContain(
      "consecutive_grey",
    );
  });

  it("includes bullshit types in parentheses", () => {
    const result = formatReflexion(makeReflexion({ struggle_types: ["vagueness", "hedge_fog"] }));
    expect(result).toContain("vagueness");
    expect(result).toContain("hedge_fog");
  });

  it("omits parentheses when no bullshit types", () => {
    const result = formatReflexion(makeReflexion({ struggle_types: [] }));
    // No bullshit type note
    expect(result).not.toContain("(");
  });

  it("includes what_happened lowercased", () => {
    const result = formatReflexion(makeReflexion({ what_happened: "PULSE READ BLACK AT TURN 5" }));
    expect(result).toContain("pulse read black at turn 5");
  });

  it("includes next_time lowercased", () => {
    const result = formatReflexion(
      makeReflexion({ next_time: "STOP AND CHECK BEFORE GENERATING" }),
    );
    expect(result).toContain("stop and check before generating");
  });

  it("ends with a closing bracket", () => {
    expect(formatReflexion(makeReflexion())).toMatch(/\]$/);
  });
});
