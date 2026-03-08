// curiosity-spiral.test.ts
// Spiral depth tracking in the curiosity engine.
//
// A question asked twice at the same level is a circle.
// A question asked twice at different levels is a spiral.
// These tests confirm curiosity knows the difference.

import { describe, it, expect, beforeEach } from "vitest";
import type { Reflexion } from "../shared/types.js";
import { generateCuriosity, getSpiralReadings, resetSpirals } from "./curiosity.js";
import type { BlindSpot } from "./mastery.js";
import type { SessionSummary } from "./session-learning.js";

// ============================================================
// Helpers
// ============================================================

function makeBlindSpot(category: BlindSpot["category"], count: number = 3): BlindSpot {
  return {
    category,
    count,
    lastSeen: new Date().toISOString(),
    examples: ["example correction"],
    surfaced: `Pattern: ${category}`,
  };
}

function makeReflexion(trigger: Reflexion["trigger"]): Reflexion {
  return {
    id: `r-${Math.random().toString(36).slice(2)}`,
    turn: 1,
    timestamp: new Date().toISOString(),
    trigger,
    what_happened: "went grey",
    why_it_failed: "lost the why",
    what_was_missed: "tone shift",
    next_time: "slow down first",
    pulse_state: "grey",
    wise_mind: 0.4,
    struggle_types: [],
  };
}

function makeSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "test-session",
    date: new Date().toISOString(),
    turns: 5,
    healthFinal: "stable",
    workedOn: [],
    winterLessons: [],
    corrections: 0,
    correctionCategories: [],
    chainLessons: [],
    blindSpotsSurfaced: [],
    watchFor: [],
    meta: {
      learningMoments: [],
      strategyShifts: [],
      calibrationImprovement: false,
      discoveryHits: 0,
      discoveryMisses: 0,
    },
    ...overrides,
  };
}

function makeCtx(
  blindSpots: BlindSpot[] = [],
  reflexions: Reflexion[] = [],
): Parameters<typeof generateCuriosity>[0] {
  return {
    sessionId: "test-session",
    blindSpots,
    reflexions,
    summary: makeSummary(),
    greyRate: 0,
    driftDirection: "stable",
  };
}

// ============================================================
// Blind spot spirals
// ============================================================

describe("spiral created on first threshold crossing", () => {
  beforeEach(() => resetSpirals());

  it("creates a spiral at level 0 when a blind spot hits threshold", () => {
    generateCuriosity(makeCtx([makeBlindSpot("over_explain", 3)]));

    const readings = getSpiralReadings();
    const spiral = readings.get("blind_spot:over_explain");

    expect(spiral).toBeDefined();
    expect(spiral!.level).toBe(0);
    expect(spiral!.theme).toBe("blind_spot:over_explain");
    expect(spiral!.direction).toBe("outward");
  });
});

describe("spiral advances on repeated threshold crossings", () => {
  beforeEach(() => resetSpirals());

  it("advances the spiral angle on each generateCuriosity call with the same blind spot", () => {
    const ctx = makeCtx([makeBlindSpot("missed_tone", 4)]);

    generateCuriosity(ctx); // first crossing — creates
    const after1 = getSpiralReadings().get("blind_spot:missed_tone");

    generateCuriosity(ctx); // second crossing — advances
    const after2 = getSpiralReadings().get("blind_spot:missed_tone");

    generateCuriosity(ctx); // third crossing — advances again
    const after3 = getSpiralReadings().get("blind_spot:missed_tone");

    expect(after1).toBeDefined();
    expect(after2).toBeDefined();
    expect(after3).toBeDefined();

    // Angle should increase with each advance (angle wraps at 2π, level increments)
    // First call creates at angle 0, next advances by 1 radian
    expect(after2!.angle).toBeGreaterThan(0);
    expect(after3!.angle).toBeGreaterThan(0);
  });

  it("increments level after enough advances to complete a ring (2π radians)", () => {
    const ctx = makeCtx([makeBlindSpot("wrong_fact", 5)]);

    // Default advance is 1 radian. Full ring is 2π ≈ 6.28 radians.
    // First call creates at angle=0 (no advance yet).
    // Each subsequent call does Spiral.advance(existing, 1).
    // Ring completes when (angle + 1) % (2π) < angle, i.e., after 7 advances.
    // So we need 1 create + 7 advance calls = 8 total.
    for (let i = 0; i < 8; i++) {
      generateCuriosity(ctx);
    }

    const spiral = getSpiralReadings().get("blind_spot:wrong_fact");
    expect(spiral).toBeDefined();
    expect(spiral!.level).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// Reflexion pattern spirals
// ============================================================

describe("reflexion pattern spirals", () => {
  beforeEach(() => resetSpirals());

  it("creates a spiral for a recurring reflexion trigger", () => {
    const ctx = makeCtx([], [makeReflexion("high_struggle"), makeReflexion("high_struggle")]);

    generateCuriosity(ctx);

    const readings = getSpiralReadings();
    const spiral = readings.get("reflexion_pattern:high_struggle");
    expect(spiral).toBeDefined();
    expect(spiral!.level).toBe(0);
  });

  it("advances the reflexion spiral on repeated calls", () => {
    const ctx = makeCtx([], [makeReflexion("consecutive_grey"), makeReflexion("consecutive_grey")]);

    generateCuriosity(ctx);
    generateCuriosity(ctx);
    generateCuriosity(ctx);

    const spiral = getSpiralReadings().get("reflexion_pattern:consecutive_grey");
    expect(spiral).toBeDefined();
    // Angle should have advanced beyond initial 0
    expect(spiral!.angle).toBeGreaterThan(0);
  });
});

// ============================================================
// Question text includes depth info
// ============================================================

describe("question text includes depth info", () => {
  beforeEach(() => resetSpirals());

  it("first call includes 'first pass' in the question", () => {
    const items = generateCuriosity(makeCtx([makeBlindSpot("over_explain", 3)]));

    expect(items.length).toBeGreaterThan(0);
    const question = items[0].question;
    expect(question).toContain("first pass");
  });

  it("question includes times count", () => {
    const items = generateCuriosity(makeCtx([makeBlindSpot("over_explain", 5)]));
    expect(items[0].question).toContain("5 times now");
  });

  it("after enough advances, question includes level number", () => {
    const ctx = makeCtx([makeBlindSpot("misread_intent", 4)]);

    // Advance 7 times to complete one ring and reach level 1
    for (let i = 0; i < 7; i++) {
      generateCuriosity(ctx);
    }

    const items = generateCuriosity(ctx);
    const relevantItem = items.find((i) => i.source === "blind_spot:misread_intent");
    expect(relevantItem).toBeDefined();
    expect(relevantItem!.question).toMatch(/level \d+/);
  });
});

// ============================================================
// Different triggers get different spirals
// ============================================================

describe("different triggers get different spirals", () => {
  beforeEach(() => resetSpirals());

  it("two blind spot categories produce two separate spirals", () => {
    const ctx = makeCtx([makeBlindSpot("over_explain", 3), makeBlindSpot("wrong_fact", 4)]);

    generateCuriosity(ctx);

    const readings = getSpiralReadings();
    expect(readings.has("blind_spot:over_explain")).toBe(true);
    expect(readings.has("blind_spot:wrong_fact")).toBe(true);
    expect(readings.size).toBe(2);
  });

  it("blind spot spiral and reflexion spiral have separate keys", () => {
    const ctx = makeCtx(
      [makeBlindSpot("missed_tone", 3)],
      [makeReflexion("high_struggle"), makeReflexion("high_struggle")],
    );

    generateCuriosity(ctx);

    const readings = getSpiralReadings();
    expect(readings.has("blind_spot:missed_tone")).toBe(true);
    expect(readings.has("reflexion_pattern:high_struggle")).toBe(true);
    expect(readings.size).toBe(2);
  });
});

// ============================================================
// getSpiralReadings returns a copy
// ============================================================

describe("getSpiralReadings returns copy", () => {
  beforeEach(() => resetSpirals());

  it("mutating the returned map does not affect internal state", () => {
    generateCuriosity(makeCtx([makeBlindSpot("over_explain", 3)]));

    const copy1 = getSpiralReadings();
    copy1.set("injected:key", {
      level: 99,
      angle: 0,
      radius: 1,
      direction: "outward",
      pitch: 1,
      theme: "injected",
    });

    const copy2 = getSpiralReadings();
    expect(copy2.has("injected:key")).toBe(false);
    expect(copy2.size).toBe(1);
  });
});

// ============================================================
// resetSpirals clears all
// ============================================================

describe("resetSpirals clears all", () => {
  it("after reset, getSpiralReadings returns empty map", () => {
    generateCuriosity(makeCtx([makeBlindSpot("over_explain", 3)]));
    expect(getSpiralReadings().size).toBeGreaterThan(0);

    resetSpirals();
    expect(getSpiralReadings().size).toBe(0);
  });

  it("new calls after reset start fresh at level 0", () => {
    // Advance deep into one spiral
    const ctx = makeCtx([makeBlindSpot("too_fast", 3)]);
    for (let i = 0; i < 5; i++) {
      generateCuriosity(ctx);
    }

    resetSpirals();
    generateCuriosity(ctx);

    const spiral = getSpiralReadings().get("blind_spot:too_fast");
    expect(spiral).toBeDefined();
    expect(spiral!.level).toBe(0);
  });
});
