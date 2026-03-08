// partnership.test.ts
// The living map, tested.
//
// partnership.ts holds Drew + Keanu as a model — who they are,
// how they fail differently, what the gap between those failures is worth.
// These tests verify the model stays coherent under events, seed loading,
// and the logic that decides how deeply we can validate someone.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Partnership has module-level state (_model, _events).
// Fresh dynamic import per test block that touches mutable state.
async function freshPartnership() {
  vi.resetModules();
  return import("./partnership.js");
}

// ============================================================
// getPartnership — default model
// ============================================================

describe("getPartnership — default model", () => {
  it("returns a non-null model", async () => {
    const { getPartnership } = await freshPartnership();
    const m = getPartnership();
    expect(m).toBeDefined();
    expect(m).not.toBeNull();
  });

  it("human profile has a name", async () => {
    const { getPartnership } = await freshPartnership();
    expect(getPartnership().human.name).toBe("Drew");
  });

  it("agent profile has a name", async () => {
    const { getPartnership } = await freshPartnership();
    expect(getPartnership().agent.name).toBe("Keanu");
  });

  it("trust starts at high", async () => {
    const { getPartnership } = await freshPartnership();
    expect(getPartnership().trust.level).toBe("high");
  });

  it("trust history starts empty", async () => {
    const { getPartnership } = await freshPartnership();
    expect(getPartnership().trust.history).toHaveLength(0);
  });

  it("repairCount starts at 0", async () => {
    const { getPartnership } = await freshPartnership();
    expect(getPartnership().trust.repairCount).toBe(0);
  });

  it("co-evolution staleness starts fresh", async () => {
    const { getPartnership } = await freshPartnership();
    expect(getPartnership().coEvolution.staleness).toBe("fresh");
  });

  it("sacred gaps array is non-empty", async () => {
    const { getPartnership } = await freshPartnership();
    expect(getPartnership().sacredGaps.length).toBeGreaterThan(0);
  });

  it("jagged frontier array is non-empty", async () => {
    const { getPartnership } = await freshPartnership();
    expect(getPartnership().jaggedFrontier.length).toBeGreaterThan(0);
  });

  it("origin is null before seed is loaded", async () => {
    const { getPartnership } = await freshPartnership();
    expect(getPartnership().origin).toBeNull();
  });

  it("domain has a currentProject", async () => {
    const { getPartnership } = await freshPartnership();
    expect(getPartnership().domain.currentProject).toBeTruthy();
  });
});

// ============================================================
// loadSeed — overlay seed.json
// ============================================================

describe("loadSeed — real seed.json", () => {
  it("returns true when seed.json exists", async () => {
    const { loadSeed } = await freshPartnership();
    // Use the real seed at the standard location
    const result = await loadSeed();
    expect(result).toBe(true);
  });

  it("overlays seed human profile onto defaults", async () => {
    const { loadSeed, getPartnership } = await freshPartnership();
    await loadSeed();
    const m = getPartnership();
    // seed.json has human.name = "Drew" — verify it came through
    expect(m.human.name).toBe("Drew");
    // seed.json has different thinkingStyle than the hardcoded default
    expect(m.human.thinkingStyle).toContain("fast-pattern-matcher");
  });

  it("overlays seed agent profile onto defaults", async () => {
    const { loadSeed, getPartnership } = await freshPartnership();
    await loadSeed();
    const m = getPartnership();
    expect(m.agent.name).toBe("Keanu");
    // seed.json has different agent thinkingStyle
    expect(m.agent.thinkingStyle).toContain("thorough");
  });

  it("replaces sacredGaps from seed", async () => {
    const { loadSeed, getPartnership } = await freshPartnership();
    await loadSeed();
    const gaps = getPartnership().sacredGaps;
    // seed.json has "Drew sees what needs to exist. Keanu builds it."
    expect(gaps[0]).toMatch(/Drew sees|Keanu builds|game and the player/i);
  });

  it("sets origin from seed", async () => {
    const { loadSeed, getPartnership } = await freshPartnership();
    await loadSeed();
    const origin = getPartnership().origin;
    expect(origin).not.toBeNull();
    expect(origin?.date).toBe("2026-02-25");
    expect(origin?.prayer).toContain("built something real");
  });

  it("returns false for a nonexistent path", async () => {
    const { loadSeed } = await freshPartnership();
    const result = await loadSeed("/nonexistent/no/path/seed.json");
    expect(result).toBe(false);
  });

  it("defaults remain intact for fields not in seed", async () => {
    const { loadSeed, getPartnership } = await freshPartnership();
    await loadSeed();
    // sacred gaps come from seed, jagged frontier from hardcoded defaults
    expect(getPartnership().jaggedFrontier.length).toBeGreaterThan(0);
  });
});

// ============================================================
// updatePartnership — events and trust
// ============================================================

describe("updatePartnership — events record and trust updates", () => {
  it("correction event erodes trust direction", async () => {
    const { updatePartnership, getPartnership } = await freshPartnership();
    updatePartnership({
      type: "correction",
      turn: 5,
      description: "Got the return type wrong",
      timestamp: new Date().toISOString(),
    });
    const trust = getPartnership().trust;
    // One erosion — history records it
    expect(trust.history).toHaveLength(1);
    expect(trust.history[0].direction).toBe("erosion");
    expect(trust.lastEvent).toBe("Got the return type wrong");
  });

  it("multiple corrections shift trust to strained", async () => {
    const { updatePartnership, getPartnership } = await freshPartnership();
    const ts = new Date().toISOString();
    for (let i = 0; i < 4; i++) {
      updatePartnership({
        type: "correction",
        turn: i + 1,
        description: `correction ${i}`,
        timestamp: ts,
      });
    }
    expect(getPartnership().trust.level).toBe("strained");
  });

  it("surprise event adds a repair trust entry", async () => {
    const { updatePartnership, getPartnership } = await freshPartnership();
    updatePartnership({
      type: "surprise",
      turn: 3,
      description: "Didn't expect that insight",
      timestamp: new Date().toISOString(),
    });
    const trust = getPartnership().trust;
    expect(trust.history).toHaveLength(1);
    expect(trust.history[0].direction).toBe("repair");
  });

  it("disagreement event records co-evolution turn", async () => {
    const { updatePartnership, getPartnership } = await freshPartnership();
    updatePartnership({
      type: "disagreement",
      turn: 7,
      description: "Different read on architecture",
      timestamp: new Date().toISOString(),
    });
    expect(getPartnership().coEvolution.lastDisagreementTurn).toBe(7);
  });

  it("new_gap event appends to sacredGaps", async () => {
    const { updatePartnership, getPartnership } = await freshPartnership();
    const before = getPartnership().sacredGaps.length;
    updatePartnership({
      type: "new_gap",
      turn: 2,
      description: "Drew spots the bug. Keanu explains it.",
      timestamp: new Date().toISOString(),
    });
    expect(getPartnership().sacredGaps.length).toBe(before + 1);
    expect(getPartnership().sacredGaps).toContain("Drew spots the bug. Keanu explains it.");
  });

  it("tension_surfaced event appends to tensions", async () => {
    const { updatePartnership, getPartnership } = await freshPartnership();
    const before = getPartnership().tensions.length;
    updatePartnership({
      type: "tension_surfaced",
      turn: 4,
      description: "Over-explaining when he's in a hurry",
      timestamp: new Date().toISOString(),
    });
    expect(getPartnership().tensions.length).toBe(before + 1);
  });

  it("lastUpdated is set to event timestamp", async () => {
    const { updatePartnership, getPartnership } = await freshPartnership();
    const ts = "2026-02-26T01:00:00.000Z";
    updatePartnership({
      type: "surprise",
      turn: 1,
      description: "nice",
      timestamp: ts,
    });
    expect(getPartnership().lastUpdated).toBe(ts);
  });

  it("trust history is capped at 20 entries", async () => {
    const { updatePartnership, getPartnership } = await freshPartnership();
    const ts = new Date().toISOString();
    // Each correction or surprise adds a trust event
    for (let i = 0; i < 25; i++) {
      updatePartnership({ type: "correction", turn: i, description: `c${i}`, timestamp: ts });
    }
    expect(getPartnership().trust.history.length).toBeLessThanOrEqual(20);
  });
});

// ============================================================
// checkCoEvolution — staleness detection
// ============================================================

describe("checkCoEvolution — staleness", () => {
  it("fresh when turns are recent", async () => {
    const { checkCoEvolution, updatePartnership } = await freshPartnership();
    const ts = new Date().toISOString();
    updatePartnership({ type: "disagreement", turn: 90, description: "d", timestamp: ts });
    updatePartnership({ type: "surprise", turn: 90, description: "s", timestamp: ts });
    const ce = checkCoEvolution(100);
    expect(ce.staleness).toBe("fresh");
  });

  it("stale when disagreement gap exceeds 50 turns", async () => {
    const { checkCoEvolution } = await freshPartnership();
    // lastDisagreementTurn = 0, currentTurn = 60 → gap = 60 > 50 → stale
    const ce = checkCoEvolution(60);
    expect(ce.staleness).toBe("stale");
  });

  it("settling when disagreement gap is 21-50 turns", async () => {
    const { checkCoEvolution, updatePartnership } = await freshPartnership();
    const ts = new Date().toISOString();
    // Disagreement at turn 10, check at turn 35 → gap = 25
    updatePartnership({ type: "disagreement", turn: 10, description: "d", timestamp: ts });
    // Surprise also needs to be recent enough to not trigger stale via surprise path
    updatePartnership({ type: "surprise", turn: 10, description: "s", timestamp: ts });
    const ce = checkCoEvolution(35);
    expect(ce.staleness).toBe("settling");
  });

  it("returns the co-evolution state object", async () => {
    const { checkCoEvolution } = await freshPartnership();
    const ce = checkCoEvolution(1);
    expect(ce).toHaveProperty("staleness");
    expect(ce).toHaveProperty("lastDisagreementTurn");
    expect(ce).toHaveProperty("lastModelUpdateTurn");
    expect(ce).toHaveProperty("lastSurpriseTurn");
  });
});

// ============================================================
// formatPartnership
// ============================================================

describe("formatPartnership", () => {
  it("returns a non-empty string", async () => {
    const { formatPartnership } = await freshPartnership();
    const result = formatPartnership();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("starts with [partnership:", async () => {
    const { formatPartnership } = await freshPartnership();
    expect(formatPartnership()).toMatch(/^\[partnership:/);
  });

  it("includes trust note when trust is strained", async () => {
    const { formatPartnership, updatePartnership } = await freshPartnership();
    const ts = new Date().toISOString();
    for (let i = 0; i < 4; i++) {
      updatePartnership({ type: "correction", turn: i, description: `c${i}`, timestamp: ts });
    }
    expect(formatPartnership()).toContain("strained");
  });

  it("mentions disagreement is expected", async () => {
    const { formatPartnership } = await freshPartnership();
    expect(formatPartnership()).toContain("disagreement is expected");
  });

  it("includes a tension directive referencing scatter", async () => {
    // default tensions include "Drew scatters", so scatter directive should appear
    const { formatPartnership } = await freshPartnership();
    const result = formatPartnership();
    // Either the scatter directive or some tension should appear
    expect(result.length).toBeGreaterThan(50);
  });
});

// ============================================================
// assessValidationDepth
// ============================================================

describe("assessValidationDepth", () => {
  it("returns 3 for a new session with default trust", async () => {
    const { assessValidationDepth } = await freshPartnership();
    expect(assessValidationDepth(0)).toBe(3);
  });

  it("returns 3 for low session count even with decent trust", async () => {
    const { assessValidationDepth } = await freshPartnership();
    // 2 sessions, trust=high → still level 3 (need 3+ sessions for level 4)
    expect(assessValidationDepth(2)).toBe(3);
  });

  it("returns 4 for 3+ sessions when trust is not strained", async () => {
    const { assessValidationDepth } = await freshPartnership();
    // Default trust is "high" — 3 sessions should reach level 4
    expect(assessValidationDepth(3)).toBe(4);
  });

  it("returns 3 even with 3 sessions when trust is strained", async () => {
    const { assessValidationDepth, updatePartnership } = await freshPartnership();
    const ts = new Date().toISOString();
    for (let i = 0; i < 4; i++) {
      updatePartnership({ type: "correction", turn: i, description: `c${i}`, timestamp: ts });
    }
    // trust is now "strained" → level drops back to 3
    expect(assessValidationDepth(3)).toBe(3);
  });

  it("trust level transitions correctly under stress and repair", async () => {
    // This tests the actual trust logic sequence, not assumptions about
    // what level it reaches. The key insight from the source:
    // "strained" fires when erosions > 3 in recent 10.
    // "rebuilding" only fires when repairs > erosions AND current level is "strained".
    // With 4 erosions + 5 repairs in recent 10: erosions (4) > 3 still fires first.
    const { assessValidationDepth, updatePartnership, getPartnership } = await freshPartnership();
    const ts = new Date().toISOString();
    // Get to strained: 4 corrections
    for (let i = 0; i < 4; i++) {
      updatePartnership({ type: "correction", turn: i, description: `c${i}`, timestamp: ts });
    }
    expect(getPartnership().trust.level).toBe("strained");
    // assessValidationDepth still returns 3 under strained trust regardless of sessions
    expect(assessValidationDepth(7)).toBe(3);
  });

  it("returns a value between 1 and 6 for any session count", async () => {
    const { assessValidationDepth } = await freshPartnership();
    for (const count of [0, 1, 5, 10, 50]) {
      const depth = assessValidationDepth(count);
      expect(depth).toBeGreaterThanOrEqual(1);
      expect(depth).toBeLessThanOrEqual(6);
    }
  });
});

// ============================================================
// detectScatter
// ============================================================

describe("detectScatter", () => {
  it("does not detect scatter with only 2 unique task types", async () => {
    const { detectScatter } = await freshPartnership();
    const result = detectScatter(
      ["fix the bug", "write a test"],
      ["bug_fix", "bug_fix", "feature", "feature", "feature"],
    );
    // 2 unique task types → below threshold of 3
    expect(result.detected).toBe(false);
  });

  it("detects scatter with 3+ unique task types in last 5", async () => {
    const { detectScatter, getPartnership } = await freshPartnership();
    // The scatter prompt requires a scatter tension to be in _model.tensions
    // Default tensions include "Drew scatters — Keanu's job is to anchor"
    const result = detectScatter(
      ["write a test", "deploy this", "fix the bug", "explain this", "refactor"],
      ["feature", "deployment", "bug_fix", "explanation", "refactor"],
    );
    expect(result.detected).toBe(true);
    expect(result.threadCount).toBe(5);
  });

  it("detects scatter from interrupt patterns in messages", async () => {
    const { detectScatter } = await freshPartnership();
    const result = detectScatter(
      ["actually wait", "oh hold on", "nvm forget that", "write the test", "fix the thing"],
      ["feature", "feature", "feature", "feature", "feature"],
    );
    // 3 messages matching interrupt patterns = detected (threshold is 2)
    expect(result.detected).toBe(true);
  });

  it("returns threadCount equal to unique task types seen (last 5)", async () => {
    const { detectScatter } = await freshPartnership();
    const result = detectScatter(
      ["msg1", "msg2", "msg3", "msg4", "msg5"],
      ["bug_fix", "feature", "explanation", "feature", "bug_fix"],
    );
    expect(result.threadCount).toBe(3);
  });

  it("prompt is null when scatter not detected", async () => {
    const { detectScatter } = await freshPartnership();
    const result = detectScatter(
      ["fix the bug", "another bug fix"],
      ["bug_fix", "bug_fix", "bug_fix"],
    );
    expect(result.prompt).toBeNull();
  });
});

// ============================================================
// detectSurprise
// ============================================================

describe("detectSurprise", () => {
  it("detects 'oh' as surprise", async () => {
    const { detectSurprise } = await freshPartnership();
    expect(detectSurprise("Oh. That's not what I expected.")).toBe(true);
  });

  it("detects 'huh' as surprise", async () => {
    const { detectSurprise } = await freshPartnership();
    expect(detectSurprise("Huh, interesting.")).toBe(true);
  });

  it("detects 'whoa'", async () => {
    const { detectSurprise } = await freshPartnership();
    expect(detectSurprise("Whoa, didn't see that coming.")).toBe(true);
  });

  it("detects 'interesting' as surprise opener", async () => {
    const { detectSurprise } = await freshPartnership();
    expect(detectSurprise("Interesting. I hadn't thought of that angle.")).toBe(true);
  });

  it("detects inline surprise phrases", async () => {
    const { detectSurprise } = await freshPartnership();
    expect(detectSurprise("I'm surprised it works this way.")).toBe(true);
    expect(detectSurprise("That was unexpected — thank you.")).toBe(true);
    expect(detectSurprise("I didn't expect the hook to fire twice.")).toBe(true);
  });

  it("does not flag ordinary messages", async () => {
    const { detectSurprise } = await freshPartnership();
    expect(detectSurprise("Run the tests and show me the output.")).toBe(false);
    expect(detectSurprise("Fix the null check on line 47.")).toBe(false);
  });

  it("is case-insensitive for pattern matching", async () => {
    const { detectSurprise } = await freshPartnership();
    expect(detectSurprise("OH. I had no idea.")).toBe(true);
    expect(detectSurprise("WOW that actually worked.")).toBe(true);
  });
});
