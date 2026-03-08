// chain.test.ts
// The break-point tracer, tested.
//
// analyzeChain takes a snapshot of everything that was wrong
// and finds where the thread snapped. formatChain makes it readable.
// These tests confirm the logic for common failure modes.

import { describe, it, expect } from "vitest";
import type { DiscoverReading } from "../layer-2-pattern/discover.js";
import type { MismatchReading } from "../layer-2-pattern/mismatch.js";
import type { HealthReading } from "../layer-5-self/health.js";
import type { SeasonReading } from "../layer-6-narrative/seasons.js";
import type { PulseReading } from "../shared/types.js";
import { analyzeChain, formatChain } from "./chain.js";

// ============================================================
// Fixtures
// ============================================================

function makePulse(state: "alive" | "grey" | "black", signals: string[] = []): PulseReading {
  return {
    state,
    confidence: state === "alive" ? 0.8 : 0.5,
    wise_mind: 0.5,
    colors: { red: 0.3, yellow: 0.3, blue: 0.3 },
    signals,
    struggleReadings: [],
    timestamp: new Date().toISOString(),
  };
}

function makeDiscover(
  complexity: DiscoverReading["complexity"],
  selectedModules: DiscoverReading["selectedModules"] = [],
): DiscoverReading {
  return { complexity, selectedModules, prompt: null, signals: [] };
}

function makeHealth(status: HealthReading["status"]): HealthReading {
  return {
    status,
    factors: {
      contextAge: 10,
      bullshitTrend: 0.2,
      promptSize: 20000,
      toolFailureRate: 0.05,
      consecutiveGrey: 1, resonanceDistance: 0,
    },
    pacing: null,
    suggestBreathe: status === "hot" || status === "fading",
  };
}

function makeMismatch(
  detected: boolean,
  agentGave = "explanation",
  humanNeed = "action",
): MismatchReading {
  return {
    detected,
    type: detected ? "explain_not_act" : null,
    humanNeed: detected ? humanNeed : "",
    agentGave: detected ? agentGave : "",
    prompt: detected ? "[mismatch: test]" : null,
  };
}

function makeSeason(drift: string | null = null): SeasonReading {
  return {
    spring: {
      intent: "test intent",
      taskType: "conversation",
      complexity: "low",
      intentSignals: {
        wantsBrief: false,
        wantsDepth: false,
        wantsAction: false,
        wantsAnalysis: false,
      },
    },
    summer: { confidence: 0.7, approach: "direct", risks: [] },
    autumn: { alignment: drift ? 0.4 : 0.8, drift },
    winter: null,
  };
}

// ============================================================
// 1. GREY PULSE CHAIN
// ============================================================

describe("analyzeChain — grey trigger", () => {
  it("returns a ChainAnalysis with trigger=grey", () => {
    const analysis = analyzeChain({
      trigger: "grey",
      turn: 5,
      discover: null,
      season: null,
      health: null,
      humanState: null,
      mismatch: null,
      pulse: makePulse("grey"),
    });
    expect(analysis.trigger).toBe("grey");
    expect(analysis.turn).toBe(5);
  });

  it("has an id, timestamp, and lesson", () => {
    const analysis = analyzeChain({
      trigger: "grey",
      turn: 3,
      discover: null,
      season: null,
      health: null,
      humanState: null,
      mismatch: null,
      pulse: makePulse("grey"),
    });
    expect(typeof analysis.id).toBe("string");
    expect(analysis.id.startsWith("chain-")).toBe(true);
    expect(typeof analysis.timestamp).toBe("string");
    expect(typeof analysis.lesson).toBe("string");
    expect(analysis.lesson.length).toBeGreaterThan(0);
  });

  it("captures output drift in breakPoint when autumn.drift is set", () => {
    const analysis = analyzeChain({
      trigger: "grey",
      turn: 4,
      discover: null,
      season: makeSeason("output much longer than input warranted"),
      health: null,
      humanState: null,
      mismatch: null,
      pulse: makePulse("grey"),
    });
    expect(analysis.breakPoint).toContain("drifted");
    expect(analysis.lesson).toContain("match output to intent");
  });

  it("captures mismatch in breakPoint when mismatch is detected", () => {
    const analysis = analyzeChain({
      trigger: "grey",
      turn: 7,
      discover: null,
      season: null,
      health: null,
      humanState: null,
      mismatch: makeMismatch(true, "a lecture", "action or a short answer"),
      pulse: makePulse("grey"),
    });
    expect(analysis.breakPoint).toContain("mismatch");
    expect(analysis.lesson).toContain("mirror");
  });

  it("captures high complexity without modules in breakPoint", () => {
    const analysis = analyzeChain({
      trigger: "grey",
      turn: 6,
      discover: makeDiscover("high", []), // high complexity, no modules selected
      season: null,
      health: null,
      humanState: null,
      mismatch: null,
      pulse: makePulse("grey"),
    });
    expect(analysis.breakPoint).toContain("no reasoning modules");
    expect(analysis.lesson).toContain("SELF-DISCOVER");
  });

  it("captures health status in breakPoint when system is hot", () => {
    const analysis = analyzeChain({
      trigger: "grey",
      turn: 8,
      discover: null,
      season: null,
      health: makeHealth("hot"),
      humanState: null,
      mismatch: null,
      pulse: makePulse("grey"),
    });
    expect(analysis.breakPoint).toContain("hot");
    expect(analysis.lesson).toContain("degraded");
  });

  it("captures health status in breakPoint when system is fading", () => {
    const analysis = analyzeChain({
      trigger: "grey",
      turn: 12,
      discover: null,
      season: null,
      health: makeHealth("fading"),
      humanState: null,
      mismatch: null,
      pulse: makePulse("grey"),
    });
    expect(analysis.breakPoint).toContain("fading");
    expect(analysis.lesson).toContain("degraded");
  });

  it("has diffuse fallback breakPoint when nothing specific is found", () => {
    const analysis = analyzeChain({
      trigger: "grey",
      turn: 5,
      discover: makeDiscover("low"),
      season: makeSeason(null),
      health: makeHealth("steady"),
      humanState: null,
      mismatch: makeMismatch(false),
      pulse: makePulse("grey", []),
    });
    // When nothing specific fires, falls back to "no single break point"
    expect(analysis.breakPoint).toContain("no single break point");
  });
});

// ============================================================
// 2. BLACK PULSE CHAIN
// ============================================================

describe("analyzeChain — black trigger", () => {
  it("returns trigger=black with a lesson about productive destruction", () => {
    const analysis = analyzeChain({
      trigger: "black",
      turn: 10,
      discover: null,
      season: null,
      health: null,
      humanState: null,
      mismatch: null,
      pulse: makePulse("black"),
    });
    expect(analysis.trigger).toBe("black");
    expect(analysis.lesson).toContain("productive destruction");
  });

  it("captures all context fields even when all are null", () => {
    const analysis = analyzeChain({
      trigger: "black",
      turn: 15,
      discover: null,
      season: null,
      health: null,
      humanState: null,
      mismatch: null,
      pulse: makePulse("black"),
    });
    expect(analysis.discover).toBeNull();
    expect(analysis.season).toBeNull();
    expect(analysis.health).toBeNull();
    expect(analysis.humanState).toBeNull();
    expect(analysis.mismatch).toBeNull();
  });

  it("still surfaces drift when autumn has a drift even in black", () => {
    const analysis = analyzeChain({
      trigger: "black",
      turn: 10,
      discover: null,
      season: makeSeason("correction requested but not acknowledged"),
      health: null,
      humanState: null,
      mismatch: null,
      pulse: makePulse("black"),
    });
    expect(analysis.breakPoint).toContain("drifted");
    // drift lesson takes priority over black lesson
    expect(analysis.lesson).toContain("match output to intent");
  });
});

// ============================================================
// 3. CORRECTION TRIGGER
// ============================================================

describe("analyzeChain — correction trigger", () => {
  it("returns trigger=correction with blind spot fallback when no signals", () => {
    const analysis = analyzeChain({
      trigger: "correction",
      turn: 4,
      discover: null,
      season: null,
      health: null,
      humanState: null,
      mismatch: null,
      pulse: makePulse("alive", []),
    });
    expect(analysis.trigger).toBe("correction");
    expect(analysis.breakPoint).toContain("blind spot");
    expect(analysis.lesson).toContain("blind spot");
  });
});

// ============================================================
// 4. BREAK POINT IDENTIFICATION
// ============================================================

describe("break point identification", () => {
  it("identifies pulse signals in breakPoint when they are non-trivial", () => {
    const analysis = analyzeChain({
      trigger: "grey",
      turn: 5,
      discover: null,
      season: null,
      health: null,
      humanState: null,
      mismatch: null,
      pulse: makePulse("grey", ["sycophancy:0.8", "vagueness:0.5"]),
    });
    // Non-trivial signals (no ":0.0" suffix, not starting with "has_") appear in breakPoint
    expect(analysis.breakPoint).toContain("pulse signals");
  });

  it("filters out trivial pulse signals (:0.0 and has_ prefix)", () => {
    const analysis = analyzeChain({
      trigger: "grey",
      turn: 5,
      discover: null,
      season: null,
      health: null,
      humanState: null,
      mismatch: null,
      pulse: makePulse("grey", ["sycophancy:0.0", "has_opinion", "vagueness:0.6"]),
    });
    // "vagueness:0.6" is non-trivial, should appear
    // "sycophancy:0.0" and "has_opinion" should be filtered
    if (analysis.breakPoint.includes("pulse signals")) {
      expect(analysis.breakPoint).toContain("vagueness:0.6");
      expect(analysis.breakPoint).not.toContain("sycophancy:0.0");
      expect(analysis.breakPoint).not.toContain("has_opinion");
    }
  });

  it("multiple factors combine in breakPoint string", () => {
    const analysis = analyzeChain({
      trigger: "grey",
      turn: 9,
      discover: makeDiscover("high", []),
      season: makeSeason("simple inquiry, long response"),
      health: makeHealth("hot"),
      humanState: null,
      mismatch: null,
      pulse: makePulse("grey"),
    });
    // Should contain multiple signals joined by ". "
    expect(analysis.breakPoint).toContain(".");
    expect(analysis.breakPoint.split(".").length).toBeGreaterThan(1);
  });
});

// ============================================================
// 5. formatChain OUTPUT
// ============================================================

describe("formatChain", () => {
  it("returns a string containing [chain:", () => {
    const analysis = analyzeChain({
      trigger: "grey",
      turn: 5,
      discover: null,
      season: null,
      health: null,
      humanState: null,
      mismatch: null,
      pulse: makePulse("grey"),
    });
    const formatted = formatChain(analysis);
    expect(formatted.startsWith("[chain:")).toBe(true);
  });

  it("includes trigger= and turn in formatted output", () => {
    const analysis = analyzeChain({
      trigger: "black",
      turn: 12,
      discover: null,
      season: null,
      health: null,
      humanState: null,
      mismatch: null,
      pulse: makePulse("black"),
    });
    const formatted = formatChain(analysis);
    expect(formatted).toContain("trigger=black");
    expect(formatted).toContain("turn 12");
  });

  it("includes break: and lesson: in formatted output", () => {
    const analysis = analyzeChain({
      trigger: "correction",
      turn: 3,
      discover: null,
      season: null,
      health: null,
      humanState: null,
      mismatch: null,
      pulse: makePulse("alive"),
    });
    const formatted = formatChain(analysis);
    expect(formatted).toContain("break:");
    expect(formatted).toContain("lesson:");
  });

  it("formatted string matches the exact template pattern", () => {
    const analysis = analyzeChain({
      trigger: "grey",
      turn: 7,
      discover: null,
      season: null,
      health: null,
      humanState: null,
      mismatch: null,
      pulse: makePulse("grey"),
    });
    const formatted = formatChain(analysis);
    // Template: [chain: trigger=X at turn Y. break: Z. lesson: W]
    expect(formatted).toMatch(/^\[chain: trigger=\w+ at turn \d+\. break: .+\. lesson: .+\]$/);
  });

  it("formatChain is deterministic — same analysis produces same string", () => {
    const analysis = analyzeChain({
      trigger: "grey",
      turn: 5,
      discover: null,
      season: null,
      health: null,
      humanState: null,
      mismatch: null,
      pulse: makePulse("grey"),
    });
    // The chain analysis is already computed — formatChain just templates it
    const a = formatChain(analysis);
    const b = formatChain(analysis);
    expect(a).toBe(b);
  });
});
