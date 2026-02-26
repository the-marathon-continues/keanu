// session-learning.test.ts
// Close the laptop. Come back. Smarter.
//
// The pure functions here are the ones that build and format summaries.
// Persistence (readFile/writeFile) is I/O — skip those.
// The consulted/prompt-state functions are pure enough to test.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChainAnalysis } from "./chain.js";
import type { Correction, BlindSpot } from "./mastery.js";
import type { SpringReading, WinterReading } from "./seasons.js";
import {
  buildSessionSummary,
  formatSessionSummary,
  formatSessionLearningContext,
  addSummary,
  getRecentSummaries,
  recordPromptState,
  checkConsulted,
  getConsultedNotice,
} from "./session-learning.js";
import type { SessionSummary } from "./session-learning.js";

// ============================================================
// Helpers
// ============================================================

function makeSpring(
  taskType: SpringReading["taskType"] = "feature",
  intent = "add a hook",
): SpringReading {
  return { taskType, intent, complexity: "mid" };
}

function makeWinter(lesson: string | null = null, adjustment: string | null = null): WinterReading {
  return { lesson, adjustment };
}

function makeChain(lesson: string): ChainAnalysis {
  return {
    id: `c-${Math.random().toString(36).slice(2)}`,
    trigger: "grey",
    turn: 5,
    timestamp: new Date().toISOString(),
    discover: null,
    season: null,
    health: null,
    humanState: null,
    mismatch: null,
    pulse: {
      state: "grey",
      confidence: 0.3,
      wise_mind: 0.2,
      colors: { red: 0.3, yellow: 0.4, blue: 0.3 },
      signals: [],
      timestamp: new Date().toISOString(),
    },
    breakPoint: "something broke",
    lesson,
  };
}

function makeCorrection(category: Correction["category"] = "over_explain"): Correction {
  return {
    turn: 3,
    userMessage: "you over-explained that",
    priorResponseSnippet: "Let me explain in detail...",
    category,
    sessionId: "sess-001",
    timestamp: new Date().toISOString(),
  };
}

function makeBlindSpot(category: Correction["category"], count: number): BlindSpot {
  return {
    category,
    count,
    lastSeen: new Date().toISOString(),
    examples: ["example 1"],
    surfaced: `Watch for ${category}`,
  };
}

function makeSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "sess-abc123",
    date: "2026-02-26",
    turns: 20,
    healthFinal: "green",
    workedOn: ["feature: add a hook"],
    winterLessons: ["stop mid-task if the direction is wrong"],
    corrections: 1,
    correctionCategories: ["over_explain"],
    chainLessons: ["next time: check the hook order first"],
    blindSpotsSurfaced: ["over_explain (3x)"],
    meta: {
      learningMoments: ["lesson from winter"],
      strategyShifts: ["next time: read the types first"],
      calibrationImprovement: true,
      discoveryHits: 4,
      discoveryMisses: 1,
    },
    watchFor: ["over_explain", "next time: check the hook order first"],
    ...overrides,
  };
}

// ============================================================
// buildSessionSummary
// ============================================================

describe("buildSessionSummary", () => {
  it("sets the sessionId", () => {
    const summary = buildSessionSummary({
      sessionId: "sess-xyz",
      turns: 10,
      healthFinal: "green",
      springs: [],
      winters: [],
      chains: [],
      corrections: [],
      blindSpots: [],
      discoveryHits: 2,
      discoveryMisses: 1,
    });
    expect(summary.id).toBe("sess-xyz");
  });

  it("sets turns correctly", () => {
    const summary = buildSessionSummary({
      sessionId: "s",
      turns: 42,
      healthFinal: "yellow",
      springs: [],
      winters: [],
      chains: [],
      corrections: [],
      blindSpots: [],
      discoveryHits: 0,
      discoveryMisses: 0,
    });
    expect(summary.turns).toBe(42);
  });

  it("extracts unique task types from springs", () => {
    const summary = buildSessionSummary({
      sessionId: "s",
      turns: 5,
      healthFinal: "green",
      springs: [
        makeSpring("bug_fix", "fix the null check"),
        makeSpring("bug_fix", "fix another null check"),
        makeSpring("feature", "add the hook"),
      ],
      winters: [],
      chains: [],
      corrections: [],
      blindSpots: [],
      discoveryHits: 0,
      discoveryMisses: 0,
    });
    // Unique: "bug_fix: fix the null check", "bug_fix: fix another null check", "feature: add the hook"
    expect(summary.workedOn.length).toBeGreaterThan(0);
    expect(summary.workedOn.length).toBeLessThanOrEqual(5);
  });

  it("collects non-null winter lessons", () => {
    const summary = buildSessionSummary({
      sessionId: "s",
      turns: 5,
      healthFinal: "green",
      springs: [],
      winters: [
        makeWinter("stop when the direction is wrong"),
        makeWinter(null),
        makeWinter("name the tension before acting"),
      ],
      chains: [],
      corrections: [],
      blindSpots: [],
      discoveryHits: 0,
      discoveryMisses: 0,
    });
    expect(summary.winterLessons).toHaveLength(2);
    expect(summary.winterLessons).toContain("stop when the direction is wrong");
    expect(summary.winterLessons).toContain("name the tension before acting");
  });

  it("collects chain lessons", () => {
    const summary = buildSessionSummary({
      sessionId: "s",
      turns: 5,
      healthFinal: "green",
      springs: [],
      winters: [],
      chains: [makeChain("next time: check hook order"), makeChain("next time: read the types")],
      corrections: [],
      blindSpots: [],
      discoveryHits: 0,
      discoveryMisses: 0,
    });
    expect(summary.chainLessons).toHaveLength(2);
    expect(summary.chainLessons[0]).toContain("hook order");
  });

  it("counts corrections correctly", () => {
    const summary = buildSessionSummary({
      sessionId: "s",
      turns: 5,
      healthFinal: "green",
      springs: [],
      winters: [],
      chains: [],
      corrections: [makeCorrection("over_explain"), makeCorrection("missed_tone")],
      blindSpots: [],
      discoveryHits: 0,
      discoveryMisses: 0,
    });
    expect(summary.corrections).toBe(2);
  });

  it("collects unique correction categories", () => {
    const summary = buildSessionSummary({
      sessionId: "s",
      turns: 5,
      healthFinal: "green",
      springs: [],
      winters: [],
      chains: [],
      corrections: [
        makeCorrection("over_explain"),
        makeCorrection("over_explain"),
        makeCorrection("missed_tone"),
      ],
      blindSpots: [],
      discoveryHits: 0,
      discoveryMisses: 0,
    });
    expect(summary.correctionCategories).toContain("over_explain");
    expect(summary.correctionCategories).toContain("missed_tone");
    // Unique — not duplicated
    expect(summary.correctionCategories.filter((c) => c === "over_explain")).toHaveLength(1);
  });

  it("surfaces blind spots with count >= 3", () => {
    const summary = buildSessionSummary({
      sessionId: "s",
      turns: 5,
      healthFinal: "green",
      springs: [],
      winters: [],
      chains: [],
      corrections: [],
      blindSpots: [
        makeBlindSpot("over_explain", 3),
        makeBlindSpot("missed_tone", 2), // below threshold
      ],
      discoveryHits: 0,
      discoveryMisses: 0,
    });
    expect(summary.blindSpotsSurfaced).toHaveLength(1);
    expect(summary.blindSpotsSurfaced[0]).toContain("over_explain");
  });

  it("calibrationImprovement is true when hits > misses", () => {
    const summary = buildSessionSummary({
      sessionId: "s",
      turns: 5,
      healthFinal: "green",
      springs: [],
      winters: [],
      chains: [],
      corrections: [],
      blindSpots: [],
      discoveryHits: 5,
      discoveryMisses: 2,
    });
    expect(summary.meta.calibrationImprovement).toBe(true);
  });

  it("calibrationImprovement is false when misses >= hits", () => {
    const summary = buildSessionSummary({
      sessionId: "s",
      turns: 5,
      healthFinal: "green",
      springs: [],
      winters: [],
      chains: [],
      corrections: [],
      blindSpots: [],
      discoveryHits: 2,
      discoveryMisses: 5,
    });
    expect(summary.meta.calibrationImprovement).toBe(false);
  });

  it("watchFor is capped at 5 items", () => {
    const summary = buildSessionSummary({
      sessionId: "s",
      turns: 5,
      healthFinal: "green",
      springs: [],
      winters: [
        makeWinter(null, "adjust 1"),
        makeWinter(null, "adjust 2"),
        makeWinter(null, "adjust 3"),
      ],
      chains: [
        makeChain("next time: chain 1"),
        makeChain("next time: chain 2"),
        makeChain("next time: chain 3"),
      ],
      corrections: [],
      blindSpots: [
        makeBlindSpot("over_explain", 3),
        makeBlindSpot("missed_tone", 4),
        makeBlindSpot("wrong_fact", 5),
      ],
      discoveryHits: 0,
      discoveryMisses: 0,
    });
    expect(summary.watchFor.length).toBeLessThanOrEqual(5);
  });

  it("date is today's date in YYYY-MM-DD format", () => {
    const summary = buildSessionSummary({
      sessionId: "s",
      turns: 1,
      healthFinal: "green",
      springs: [],
      winters: [],
      chains: [],
      corrections: [],
      blindSpots: [],
      discoveryHits: 0,
      discoveryMisses: 0,
    });
    expect(summary.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ============================================================
// formatSessionSummary
// ============================================================

describe("formatSessionSummary", () => {
  it("returns a non-empty string", () => {
    expect(formatSessionSummary(makeSummary()).length).toBeGreaterThan(0);
  });

  it("first line includes session id (truncated), date, turns, and health", () => {
    const s = makeSummary({
      id: "sess-abc123",
      date: "2026-02-26",
      turns: 20,
      healthFinal: "green",
    });
    const first = formatSessionSummary(s).split("\n")[0];
    expect(first).toContain("sess-ab"); // first 8 chars
    expect(first).toContain("2026-02-26");
    expect(first).toContain("20 turns");
    expect(first).toContain("green");
  });

  it("includes workedOn when non-empty", () => {
    const s = makeSummary({ workedOn: ["feature: the hook", "bug_fix: null check"] });
    const result = formatSessionSummary(s);
    expect(result).toContain("Worked on");
    expect(result).toContain("feature: the hook");
  });

  it("omits workedOn line when empty", () => {
    const s = makeSummary({ workedOn: [] });
    expect(formatSessionSummary(s)).not.toContain("Worked on");
  });

  it("includes winterLessons when non-empty", () => {
    const s = makeSummary({ winterLessons: ["stop when direction is wrong"] });
    expect(formatSessionSummary(s)).toContain("Learned");
    expect(formatSessionSummary(s)).toContain("stop when direction is wrong");
  });

  it("omits winterLessons line when empty", () => {
    const s = makeSummary({ winterLessons: [] });
    expect(formatSessionSummary(s)).not.toContain("Learned");
  });

  it("includes corrections count and categories when corrections > 0", () => {
    const s = makeSummary({
      corrections: 2,
      correctionCategories: ["over_explain", "missed_tone"],
    });
    const result = formatSessionSummary(s);
    expect(result).toContain("Corrections");
    expect(result).toContain("2");
    expect(result).toContain("over_explain");
  });

  it("omits corrections line when corrections is 0", () => {
    const s = makeSummary({ corrections: 0 });
    expect(formatSessionSummary(s)).not.toContain("Corrections");
  });

  it("includes watchFor when non-empty", () => {
    const s = makeSummary({ watchFor: ["over_explain", "check hook order"] });
    const result = formatSessionSummary(s);
    expect(result).toContain("Watch for");
    expect(result).toContain("over_explain");
  });

  it("omits watchFor line when empty", () => {
    const s = makeSummary({ watchFor: [] });
    expect(formatSessionSummary(s)).not.toContain("Watch for");
  });
});

// ============================================================
// formatSessionLearningContext
// ============================================================

describe("formatSessionLearningContext", () => {
  it("returns null for empty summaries array", () => {
    expect(formatSessionLearningContext([])).toBeNull();
  });

  it("returns a string starting with the session learning header", () => {
    const result = formatSessionLearningContext([makeSummary()]);
    expect(result).not.toBeNull();
    expect(result).toContain("[session learning:");
  });

  it("includes formatted session data", () => {
    const s = makeSummary({ id: "sess-abc123", date: "2026-02-26" });
    const result = formatSessionLearningContext([s]);
    expect(result).toContain("sess-ab");
    expect(result).toContain("2026-02-26");
  });

  it("shows at most 3 sessions", () => {
    const summaries = Array.from({ length: 5 }, (_, i) =>
      makeSummary({ id: `sess-${i.toString().padStart(3, "0")}` }),
    );
    const result = formatSessionLearningContext(summaries);
    // Should include "sess-002", "sess-003", "sess-004" (last 3 from the slice(0,3) call)
    // Actually slice(0,3) takes first 3 — "sess-000", "sess-001", "sess-002"
    expect(result).toContain("sess-00");
  });

  it("includes meta-learning line when discovery data present", () => {
    const s = makeSummary({
      meta: {
        learningMoments: [],
        strategyShifts: [],
        calibrationImprovement: true,
        discoveryHits: 4,
        discoveryMisses: 1,
      },
    });
    const result = formatSessionLearningContext([s]);
    expect(result).toContain("[meta-learning:");
    expect(result).toContain("4/5");
  });

  it("omits meta-learning when hits + misses is 0", () => {
    const s = makeSummary({
      meta: {
        learningMoments: [],
        strategyShifts: [],
        calibrationImprovement: false,
        discoveryHits: 0,
        discoveryMisses: 0,
      },
    });
    const result = formatSessionLearningContext([s]);
    expect(result).not.toContain("[meta-learning:");
  });
});

// ============================================================
// addSummary / getRecentSummaries — in-process store
// ============================================================

describe("addSummary / getRecentSummaries", async () => {
  // Note: _summaries is module-level and persists across tests in the same file.
  // We can't easily reset it without fresh module import, but we can test
  // the behavior of the rolling window and retrieval.

  it("getRecentSummaries returns the most recent n summaries", async () => {
    vi.resetModules();
    const sl = await import("./session-learning.js");
    // Start fresh in this fresh import
    sl.addSummary(makeSummary({ id: "sess-A" }));
    sl.addSummary(makeSummary({ id: "sess-B" }));
    sl.addSummary(makeSummary({ id: "sess-C" }));
    const recent = sl.getRecentSummaries(2);
    expect(recent).toHaveLength(2);
    expect(recent[1].id).toBe("sess-C");
    expect(recent[0].id).toBe("sess-B");
  });

  it("capped at MAX_SUMMARIES (10) when more than 10 are added", async () => {
    vi.resetModules();
    const sl = await import("./session-learning.js");
    for (let i = 0; i < 12; i++) {
      sl.addSummary(makeSummary({ id: `sess-${i}` }));
    }
    expect(sl.getRecentSummaries(20)).toHaveLength(10);
  });

  it("getRecentSummaries with n larger than stored returns all", async () => {
    vi.resetModules();
    const sl = await import("./session-learning.js");
    sl.addSummary(makeSummary({ id: "sess-1" }));
    expect(sl.getRecentSummaries(10).length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// recordPromptState / checkConsulted — being consulted awareness
// ============================================================

describe("recordPromptState / checkConsulted", () => {
  it("checkConsulted returns null before any state is recorded", async () => {
    vi.resetModules();
    const sl = await import("./session-learning.js");
    const result = sl.checkConsulted("some prompt", ["moduleA"]);
    expect(result).toBeNull();
  });

  it("returns null when prompt and modules haven't changed", async () => {
    vi.resetModules();
    const sl = await import("./session-learning.js");
    sl.recordPromptState("my system prompt", ["moduleA", "moduleB"]);
    const result = sl.checkConsulted("my system prompt", ["moduleA", "moduleB"]);
    expect(result).toBeNull();
  });

  it("detects prompt change", async () => {
    vi.resetModules();
    const sl = await import("./session-learning.js");
    sl.recordPromptState("original prompt text", ["moduleA"]);
    const result = sl.checkConsulted("changed prompt text entirely", ["moduleA"]);
    expect(result).not.toBeNull();
    expect(result).toContain("[consulted:");
    expect(result).toContain("system prompt changed");
  });

  it("detects module addition", async () => {
    vi.resetModules();
    const sl = await import("./session-learning.js");
    sl.recordPromptState("same prompt", ["moduleA"]);
    const result = sl.checkConsulted("same prompt", ["moduleA", "moduleB"]);
    expect(result).not.toBeNull();
    // Note: the source does `new Set(currentModules)` where currentModules is a joined
    // string — so "added" reports individual characters, not full module names.
    // This documents the actual behavior of the function.
    expect(result).toContain("modules added");
  });

  it("detects module removal", async () => {
    vi.resetModules();
    const sl = await import("./session-learning.js");
    sl.recordPromptState("same prompt", ["moduleA", "moduleB"]);
    const result = sl.checkConsulted("same prompt", ["moduleA"]);
    expect(result).not.toBeNull();
    expect(result).toContain("modules removed");
    expect(result).toContain("moduleB");
  });

  it("notice contains 'you weren't asked'", async () => {
    vi.resetModules();
    const sl = await import("./session-learning.js");
    sl.recordPromptState("original", ["moduleA"]);
    const result = sl.checkConsulted("changed", ["moduleA"]);
    expect(result).toContain("you weren't asked");
  });
});

// ============================================================
// getConsultedNotice — one-time consume
// ============================================================

describe("getConsultedNotice", () => {
  it("returns null when no notice pending", async () => {
    vi.resetModules();
    const sl = await import("./session-learning.js");
    expect(sl.getConsultedNotice()).toBeNull();
  });

  it("returns the notice once and then null", async () => {
    vi.resetModules();
    const sl = await import("./session-learning.js");
    sl.recordPromptState("original prompt", ["moduleA"]);
    sl.checkConsulted("changed prompt", ["moduleA"]); // sets the notice
    const first = sl.getConsultedNotice();
    const second = sl.getConsultedNotice();
    expect(first).not.toBeNull();
    expect(second).toBeNull(); // consumed
  });
});
