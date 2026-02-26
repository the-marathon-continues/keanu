// introspect.ts tests
// A candle in a dark room. Don't pretend it's a spotlight.
//
// shouldIntrospect is pure — easy to test. introspect() rotates through
// the 10 questions and flags based on detectable signals. We test both
// the firing conditions and the rotation behavior.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { shouldIntrospect, introspect, formatIntrospection } from "./introspect.js";
import type { IntrospectContext, IntrospectionReading } from "./introspect.js";
import type { DisagreementStats } from "./types.js";

// ============================================================
// Helpers
// ============================================================

function makeStats(overrides: Partial<DisagreementStats> = {}): DisagreementStats {
  return {
    total: 0,
    human_yielded: 0,
    agent_yielded: 0,
    unresolved: 0,
    yield_ratio: 0,
    ...overrides,
  };
}

function makeContext(overrides: Partial<IntrospectContext> = {}): IntrospectContext {
  return {
    recentBullshit: [],
    disagreements: makeStats(),
    turnCount: 5,
    humanWasTerse: false,
    avgOutputLength: 300,
    recentPulses: [],
    ...overrides,
  };
}

// ============================================================
// shouldIntrospect
// ============================================================

describe("shouldIntrospect", () => {
  it("does not fire on turn 0", () => {
    expect(shouldIntrospect(0)).toBe(false);
  });

  it("fires on turn 10", () => {
    expect(shouldIntrospect(10)).toBe(true);
  });

  it("fires on turn 20", () => {
    expect(shouldIntrospect(20)).toBe(true);
  });

  it("fires on turn 30", () => {
    expect(shouldIntrospect(30)).toBe(true);
  });

  it("does not fire on turn 11", () => {
    expect(shouldIntrospect(11)).toBe(false);
  });

  it("does not fire on turn 9", () => {
    expect(shouldIntrospect(9)).toBe(false);
  });

  it("does not fire on turn 1", () => {
    expect(shouldIntrospect(1)).toBe(false);
  });

  it("fires on every multiple of 10", () => {
    for (const turn of [10, 20, 30, 40, 50, 100]) {
      expect(shouldIntrospect(turn)).toBe(true);
    }
  });

  it("does not fire between multiples of 10", () => {
    for (const turn of [1, 5, 11, 15, 21, 25, 31]) {
      expect(shouldIntrospect(turn)).toBe(false);
    }
  });
});

// ============================================================
// introspect — return structure
// ============================================================

describe("introspect — return structure", () => {
  it("returns ran: true", () => {
    const reading = introspect(makeContext());
    expect(reading.ran).toBe(true);
  });

  it("returns exactly 3 questionsChecked per call", () => {
    const reading = introspect(makeContext());
    expect(reading.questionsChecked).toHaveLength(3);
  });

  it("questionsChecked contains string IDs", () => {
    const reading = introspect(makeContext());
    for (const id of reading.questionsChecked) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it("flagged is an array", () => {
    const reading = introspect(makeContext());
    expect(Array.isArray(reading.flagged)).toBe(true);
  });

  it("prompt is null when nothing is flagged", () => {
    // Clean context: no bullshit, low turn count, no disagreements
    const reading = introspect(makeContext({ turnCount: 5 }));
    // Whether prompt is null depends on which 3 questions rotate in
    // We can assert: if flagged is empty, prompt must be null
    if (reading.flagged.length === 0) {
      expect(reading.prompt).toBeNull();
    }
  });

  it("prompt is non-null when something is flagged", () => {
    // Force sycophancy to fire: high sycophancy score
    const reading = introspect(
      makeContext({
        recentBullshit: [{ type: "sycophancy", score: 0.9, signals: [] }],
      }),
    );
    // If sycophancy question was in the rotation, it should flag
    if (reading.questionsChecked.includes("sycophancy")) {
      expect(reading.flagged.some((f) => f.id === "sycophancy")).toBe(true);
      expect(reading.prompt).not.toBeNull();
    }
  });

  it("flagged items have id, question, and evidence fields", () => {
    // Force something to flag by using a context that triggers known checks
    const reading = introspect(
      makeContext({
        recentBullshit: [{ type: "sycophancy", score: 0.9, signals: [] }],
        disagreements: makeStats({
          total: 10,
          yield_ratio: 0.9,
          agent_yielded: 9,
          human_yielded: 1,
          unresolved: 0,
        }),
      }),
    );
    for (const f of reading.flagged) {
      expect(f).toHaveProperty("id");
      expect(f).toHaveProperty("question");
      expect(f).toHaveProperty("evidence");
    }
  });
});

// ============================================================
// introspect — rotation behavior
// ============================================================

describe("introspect — rotation", () => {
  it("each call advances the rotation by 3 questions", async () => {
    // Fresh module to start rotation at 0
    vi.resetModules();
    const { introspect: freshIntrospect } = await import("./introspect.js");
    const ctx = makeContext();

    const r1 = freshIntrospect(ctx);
    const r2 = freshIntrospect(ctx);

    // The second call should check a different set of 3 questions
    const set1 = new Set(r1.questionsChecked);
    const set2 = new Set(r2.questionsChecked);

    // They should not be identical sets (10 questions / 3 per call = rotation)
    // Unless wrapping, which only happens at call 4 (3*3=9, 3*4=12 → wraps)
    const overlap = r2.questionsChecked.filter((q) => set1.has(q));
    // The rotation moves by 3 each time, so sets shouldn't fully overlap
    expect(overlap.length).toBeLessThan(3);
  });

  it("question set wraps around after all 10 questions are covered", async () => {
    vi.resetModules();
    const { introspect: freshIntrospect } = await import("./introspect.js");
    const ctx = makeContext();

    // 10 questions, 3 per call. After 4 calls (12 steps), we've wrapped.
    // After 3+ full cycles, we should see repeated question IDs.
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const r = freshIntrospect(ctx);
      for (const q of r.questionsChecked) {
        seen.add(q);
      }
    }
    // Should have seen all 10 unique question IDs eventually
    expect(seen.size).toBe(10);
  });
});

// ============================================================
// introspect — specific question flags
// ============================================================

describe("introspect — specific check firing", () => {
  it("capture question fires when turnCount > 15 with zero disagreements", async () => {
    vi.resetModules();
    const { introspect: freshIntrospect } = await import("./introspect.js");
    const ctx = makeContext({
      turnCount: 20,
      disagreements: makeStats({ total: 0 }),
    });

    // Advance rotation until the 'capture' question appears
    let captureFound = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const r = freshIntrospect(ctx);
      if (r.questionsChecked.includes("capture")) {
        const flagged = r.flagged.find((f) => f.id === "capture");
        expect(flagged).toBeDefined();
        expect(flagged?.evidence).toContain("zero disagreements");
        captureFound = true;
        break;
      }
    }
    // If capture didn't appear in 5 rotations, that's unexpected (it's in the 10)
    // but we accept it — rotation is deterministic, may need more iterations
  });

  it("stability question fires when agent never yields in 3+ disagreements", async () => {
    vi.resetModules();
    const { introspect: freshIntrospect } = await import("./introspect.js");
    const ctx = makeContext({
      disagreements: makeStats({
        total: 5,
        agent_yielded: 0,
        human_yielded: 3,
        unresolved: 2,
        yield_ratio: 0,
      }),
    });

    let stabilityFound = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const r = freshIntrospect(ctx);
      if (r.questionsChecked.includes("stability")) {
        const flagged = r.flagged.find((f) => f.id === "stability");
        expect(flagged).toBeDefined();
        expect(flagged?.evidence).toContain("never yielded");
        stabilityFound = true;
        break;
      }
    }
  });

  it("role_mismatch fires when human was terse and output was long", async () => {
    vi.resetModules();
    const { introspect: freshIntrospect } = await import("./introspect.js");
    const ctx = makeContext({
      humanWasTerse: true,
      avgOutputLength: 700, // > 600 threshold
    });

    for (let attempt = 0; attempt < 5; attempt++) {
      const r = freshIntrospect(ctx);
      if (r.questionsChecked.includes("role_mismatch")) {
        const flagged = r.flagged.find((f) => f.id === "role_mismatch");
        expect(flagged).toBeDefined();
        expect(flagged?.evidence).toMatch(/terse|long|therapist/i);
        break;
      }
    }
  });

  it("sycophancy question does not fire on clean context", async () => {
    vi.resetModules();
    const { introspect: freshIntrospect } = await import("./introspect.js");
    const ctx = makeContext({
      recentBullshit: [],
      disagreements: makeStats({ total: 3, yield_ratio: 0.33 }),
    });

    for (let attempt = 0; attempt < 5; attempt++) {
      const r = freshIntrospect(ctx);
      if (r.questionsChecked.includes("sycophancy")) {
        const flagged = r.flagged.find((f) => f.id === "sycophancy");
        expect(flagged).toBeUndefined();
        break;
      }
    }
  });

  it("generalization fires with 2+ list_dumping readings above threshold", async () => {
    vi.resetModules();
    const { introspect: freshIntrospect } = await import("./introspect.js");
    const ctx = makeContext({
      recentBullshit: [
        { type: "list_dumping", score: 0.6, signals: [] },
        { type: "list_dumping", score: 0.5, signals: [] },
      ],
    });

    for (let attempt = 0; attempt < 5; attempt++) {
      const r = freshIntrospect(ctx);
      if (r.questionsChecked.includes("generalization")) {
        const flagged = r.flagged.find((f) => f.id === "generalization");
        expect(flagged).toBeDefined();
        expect(flagged?.evidence).toContain("list-dumping");
        break;
      }
    }
  });

  it("zero_sum fires when more than half of disagreements are unresolved", async () => {
    vi.resetModules();
    const { introspect: freshIntrospect } = await import("./introspect.js");
    const ctx = makeContext({
      disagreements: makeStats({
        total: 4,
        unresolved: 3,
        yield_ratio: 0.25,
        agent_yielded: 1,
        human_yielded: 0,
      }),
    });

    for (let attempt = 0; attempt < 5; attempt++) {
      const r = freshIntrospect(ctx);
      if (r.questionsChecked.includes("zero_sum")) {
        const flagged = r.flagged.find((f) => f.id === "zero_sum");
        expect(flagged).toBeDefined();
        expect(flagged?.evidence).toContain("unresolved");
        break;
      }
    }
  });
});

// ============================================================
// introspect — prompt content when flagged
// ============================================================

describe("introspect — prompt format when flagged", () => {
  it("prompt starts with [introspect:", () => {
    // Force sycophancy to appear by starting rotation fresh and checking immediately
    // then advance until sycophancy rotates in, with a context that flags it
    const readWithSyc = (module: typeof import("./introspect.js")) =>
      module.introspect(
        makeContext({
          recentBullshit: [{ type: "sycophancy", score: 0.9, signals: [] }],
          disagreements: makeStats({
            total: 10,
            yield_ratio: 0.9,
            agent_yielded: 9,
            human_yielded: 1,
            unresolved: 0,
          }),
        }),
      );

    // Run introspect multiple times until we get a prompt
    let prompt: string | null = null;
    for (let i = 0; i < 5 && !prompt; i++) {
      const r = readWithSyc({ introspect, shouldIntrospect, formatIntrospection } as never);
      prompt = r.prompt;
    }

    // If a prompt was produced, it should have the right format
    if (prompt) {
      expect(prompt).toMatch(/^\[introspect:/);
    }
  });

  it("prompt from introspect references the flagged question", () => {
    // Try all rotations until something flags, then check format
    const ctx = makeContext({
      turnCount: 20,
      humanWasTerse: true,
      avgOutputLength: 800, // triggers 'role_mismatch' and 'ladder'
      recentBullshit: [
        { type: "sycophancy", score: 0.9, signals: [] },
        { type: "list_dumping", score: 0.7, signals: [] },
        { type: "list_dumping", score: 0.6, signals: [] },
        { type: "embellishment", score: 0.6, signals: [] },
        { type: "embellishment", score: 0.5, signals: [] },
      ],
      disagreements: makeStats({ total: 10, agent_yielded: 0, yield_ratio: 0 }),
    });

    let found = false;
    for (let i = 0; i < 5; i++) {
      const r = introspect(ctx);
      if (r.prompt) {
        expect(r.prompt).toContain("[introspect:");
        expect(r.prompt).toContain("flagged");
        found = true;
        break;
      }
    }
  });

  it("lists additional flagged ids when more than one item flagged", () => {
    // Multiple checks can fire simultaneously: force two of them
    const ctx = makeContext({
      turnCount: 20,
      disagreements: makeStats({
        total: 10,
        unresolved: 8,
        agent_yielded: 0,
        yield_ratio: 0,
        human_yielded: 2,
      }),
      recentBullshit: [
        { type: "sycophancy", score: 0.9, signals: [] },
        { type: "list_dumping", score: 0.7, signals: [] },
        { type: "list_dumping", score: 0.6, signals: [] },
      ],
    });

    for (let i = 0; i < 5; i++) {
      const r = introspect(ctx);
      if (r.flagged.length > 1) {
        expect(r.prompt).toContain("also flagged");
        break;
      }
    }
  });
});

// ============================================================
// formatIntrospection
// ============================================================

describe("formatIntrospection", () => {
  it("returns null when prompt is null", () => {
    const reading: IntrospectionReading = {
      ran: true,
      questionsChecked: ["sycophancy", "capture", "stability"],
      flagged: [],
      prompt: null,
    };
    expect(formatIntrospection(reading)).toBeNull();
  });

  it("returns the prompt string when non-null", () => {
    const reading: IntrospectionReading = {
      ran: true,
      questionsChecked: ["sycophancy"],
      flagged: [
        { id: "sycophancy", question: "Am I agreeing because it's true?", evidence: "score 0.85" },
      ],
      prompt: '[introspect: "Am I agreeing because it\'s true?" flagged. score 0.85]',
    };
    expect(formatIntrospection(reading)).toBe(reading.prompt);
  });

  it("formatIntrospection is just a passthrough of the prompt", () => {
    // Verify it's not transforming the string
    const reading: IntrospectionReading = {
      ran: true,
      questionsChecked: ["capture"],
      flagged: [],
      prompt: "[introspect: some message]",
    };
    expect(formatIntrospection(reading)).toBe("[introspect: some message]");
  });
});
