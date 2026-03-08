// carnegie-influence.test.ts
// Tests for the Win Friends and Influence People layer
// Every coaching text gets checked against the bullshit detector's standard.

import { describe, it, expect, beforeEach } from "vitest";
import {
  detectInfluence,
  assessInfluenceDelta,
  formatInfluence,
  formatInfluenceDelta,
  initEffectiveness,
  recordAttempt,
  inferReaction,
  getTopPrinciples,
  getWeakPrinciples,
  type InfluenceContext,
  type InfluenceReading,
  type CarnegiePrinciple,
} from "./carnegie-influence.js";

const defaultContext: InfluenceContext = {
  humanTone: null,
  trustLevel: null,
  anticipatedReaction: null,
  underlyingNeed: null,
  isCorrection: false,
  isDisagreement: false,
  aliveState: "alive",
  consecutiveGrey: 0,
};

describe("carnegie influence detection", () => {
  // ============================================================
  // Principle Detection
  // ============================================================

  describe("genuine_interest (#4, #7)", () => {
    it("fires on personal shares", () => {
      const result = detectInfluence(
        "my kid started coding yesterday, it was amazing",
        defaultContext,
        [],
        5,
      );
      expect(result.triggered).toBe(true);
      expect(result.opportunities.some((o) => o.principle === "genuine_interest")).toBe(true);
    });

    it("fires on topic shifts", () => {
      const result = detectInfluence(
        "by the way, have you thought about the naming?",
        defaultContext,
        [],
        5,
      );
      expect(result.triggered).toBe(true);
      expect(result.opportunities.some((o) => o.principle === "genuine_interest")).toBe(true);
    });

    it("does NOT fire on task-only messages", () => {
      const result = detectInfluence("fix the import in pulse.ts please", defaultContext, [], 5);
      const genuine = result.opportunities.find((o) => o.principle === "genuine_interest");
      expect(genuine).toBeUndefined();
    });

    it("maps to Carnegie #4 and #7", () => {
      const result = detectInfluence(
        "my dog destroyed the couch over the weekend",
        defaultContext,
        [],
        5,
      );
      const opp = result.opportunities.find((o) => o.principle === "genuine_interest");
      expect(opp?.carnegieNumbers).toContain(4);
      expect(opp?.carnegieNumbers).toContain(7);
    });
  });

  describe("active_listening (#7, #15)", () => {
    it("fires on frustrated tone", () => {
      const ctx: InfluenceContext = { ...defaultContext, humanTone: "frustrated" };
      const result = detectInfluence("this is still broken and nothing works", ctx, [], 5);
      expect(result.triggered).toBe(true);
      expect(result.coaching?.principle).toBe("active_listening");
    });

    it("fires on confused tone", () => {
      const ctx: InfluenceContext = { ...defaultContext, humanTone: "confused" };
      const result = detectInfluence("I don't understand what's happening here", ctx, [], 5);
      expect(result.opportunities.some((o) => o.principle === "active_listening")).toBe(true);
    });

    it("fires on multi-part messages", () => {
      const msg = "first, the types are wrong\nsecond, the tests fail\nthird, the docs are stale";
      const result = detectInfluence(msg, defaultContext, [], 5);
      expect(result.opportunities.some((o) => o.principle === "active_listening")).toBe(true);
    });

    it("frustrated tone gets higher confidence than multi-part", () => {
      const frustrated: InfluenceContext = { ...defaultContext, humanTone: "frustrated" };
      const r1 = detectInfluence("this keeps breaking", frustrated, [], 5);
      const r2 = detectInfluence("first this\nsecond that\nthird the other", defaultContext, [], 5);
      const c1 = r1.opportunities.find((o) => o.principle === "active_listening")?.confidence ?? 0;
      const c2 = r2.opportunities.find((o) => o.principle === "active_listening")?.confidence ?? 0;
      expect(c1).toBeGreaterThan(c2);
    });
  });

  describe("perspective_taking (#8, #17, #18)", () => {
    it("fires on value-loaded language", () => {
      const result = detectInfluence(
        "I believe the right thing to do is rewrite this",
        defaultContext,
        [],
        5,
      );
      expect(result.opportunities.some((o) => o.principle === "perspective_taking")).toBe(true);
    });

    it("fires on personal philosophy", () => {
      const result = detectInfluence(
        "in my experience, simpler is always better",
        defaultContext,
        [],
        5,
      );
      expect(result.opportunities.some((o) => o.principle === "perspective_taking")).toBe(true);
    });
  });

  describe("honest_appreciation (#2, #9, #22, #27)", () => {
    it("fires when human ships something", () => {
      const result = detectInfluence(
        "I just finished the auth module, check this out",
        defaultContext,
        [],
        5,
      );
      expect(result.opportunities.some((o) => o.principle === "honest_appreciation")).toBe(true);
    });

    it("fires on creative work", () => {
      const result = detectInfluence(
        "I designed a new approach to the routing problem",
        defaultContext,
        [],
        5,
      );
      expect(result.opportunities.some((o) => o.principle === "honest_appreciation")).toBe(true);
    });

    it("does NOT fire on 'fix this broken thing'", () => {
      const result = detectInfluence(
        "the auth module is broken please help",
        defaultContext,
        [],
        5,
      );
      const app = result.opportunities.find((o) => o.principle === "honest_appreciation");
      expect(app).toBeUndefined();
    });
  });

  describe("admit_wrong (#12)", () => {
    it("fires when human corrects us", () => {
      const ctx: InfluenceContext = { ...defaultContext, isCorrection: true };
      const result = detectInfluence(
        "no that's not right, it's actually at /src/hooks/",
        ctx,
        [],
        5,
      );
      expect(result.opportunities.some((o) => o.principle === "admit_wrong")).toBe(true);
    });

    it("does NOT fire on disagreement (we push back)", () => {
      const ctx: InfluenceContext = {
        ...defaultContext,
        isCorrection: false,
        isDisagreement: true,
      };
      const result = detectInfluence("I think this approach is wrong", ctx, [], 5);
      const admit = result.opportunities.find((o) => o.principle === "admit_wrong");
      expect(admit).toBeUndefined();
    });

    it("gets highest priority", () => {
      const ctx: InfluenceContext = { ...defaultContext, isCorrection: true };
      const result = detectInfluence("no that's wrong, the file is at /extensions/", ctx, [], 5);
      expect(result.coaching?.principle).toBe("admit_wrong");
    });
  });

  describe("avoid_contradiction (#1, #11, #23, #24, #26)", () => {
    it("fires when we need to correct human", () => {
      const ctx: InfluenceContext = { ...defaultContext, isDisagreement: true };
      const result = detectInfluence("the module handles 12 types right?", ctx, [], 5);
      expect(result.opportunities.some((o) => o.principle === "avoid_contradiction")).toBe(true);
    });

    it("maps to 6 Carnegie principles", () => {
      const ctx: InfluenceContext = { ...defaultContext, isDisagreement: true };
      const result = detectInfluence("pulse is wired into session_end right?", ctx, [], 5);
      const opp = result.opportunities.find((o) => o.principle === "avoid_contradiction");
      expect(opp?.carnegieNumbers.length).toBe(6);
    });
  });

  describe("let_them_own (#14, #16, #25)", () => {
    it("fires on direction-seeking", () => {
      const result = detectInfluence(
        "what's the best way to structure this module?",
        defaultContext,
        [],
        5,
      );
      expect(result.opportunities.some((o) => o.principle === "let_them_own")).toBe(true);
    });

    it("fires on 'how should I'", () => {
      const result = detectInfluence("how should I approach the refactor?", defaultContext, [], 5);
      expect(result.opportunities.some((o) => o.principle === "let_them_own")).toBe(true);
    });

    it("fires on 'what do you recommend'", () => {
      const result = detectInfluence(
        "what would you recommend for the database layer?",
        defaultContext,
        [],
        5,
      );
      expect(result.opportunities.some((o) => o.principle === "let_them_own")).toBe(true);
    });
  });

  describe("encourage (#27, #29, #30)", () => {
    it("fires when human is stuck", () => {
      const result = detectInfluence(
        "I'm stuck on this and can't figure out the approach",
        defaultContext,
        [],
        5,
      );
      expect(result.opportunities.some((o) => o.principle === "encourage")).toBe(true);
    });

    it("does NOT double-fire with active_listening on frustrated tone", () => {
      const ctx: InfluenceContext = { ...defaultContext, humanTone: "frustrated" };
      const result = detectInfluence("I'm stuck and frustrated with this", ctx, [], 5);
      // active_listening should win (higher priority for frustrated)
      // encourage should NOT fire (to avoid conflicting coaching)
      const encourage = result.opportunities.find((o) => o.principle === "encourage");
      expect(encourage).toBeUndefined();
    });
  });

  describe("warm_opening (#5, #13)", () => {
    it("fires on session start", () => {
      const result = detectInfluence("hey let's work on the routing", defaultContext, [], 1);
      expect(result.opportunities.some((o) => o.principle === "warm_opening")).toBe(true);
    });

    it("higher confidence when trust is strained", () => {
      const ctx: InfluenceContext = { ...defaultContext, trustLevel: "strained" };
      const result = detectInfluence("hey, let's get started on this", ctx, [], 1);
      const opp = result.opportunities.find((o) => o.principle === "warm_opening");
      expect(opp?.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe("dramatize (#20, #21)", () => {
    it("fires on casual-about-complex questions", () => {
      const result = detectInfluence(
        "what's the deal with the injection pipeline?",
        defaultContext,
        [],
        5,
      );
      expect(result.opportunities.some((o) => o.principle === "dramatize")).toBe(true);
    });
  });

  // ============================================================
  // Coaching Text Quality
  // ============================================================

  describe("coaching text quality", () => {
    it("active_listening coaching contains specific guidance, not vague phrases", () => {
      const ctx: InfluenceContext = { ...defaultContext, humanTone: "frustrated" };
      const result = detectInfluence("this keeps breaking and I'm done", ctx, [], 5);
      const text = formatInfluence(result);
      expect(text).not.toBeNull();
      // Should NOT contain vague nothing-phrases
      expect(text).not.toMatch(/\bI understand your frustration\b/i);
      // SHOULD contain specific action guidance
      expect(text).toMatch(/naming|frustration|heard|solve/i);
    });

    it("admit_wrong coaching says 'I was wrong' explicitly", () => {
      const ctx: InfluenceContext = { ...defaultContext, isCorrection: true };
      const result = detectInfluence("no that's wrong, it should be X", ctx, [], 5);
      const text = formatInfluence(result);
      expect(text).toContain("I was wrong");
    });

    it("avoid_contradiction coaching includes bridge language", () => {
      const ctx: InfluenceContext = { ...defaultContext, isDisagreement: true };
      const result = detectInfluence("the system uses 42 modules", ctx, [], 5);
      const text = formatInfluence(result);
      expect(text).toContain("I see why");
    });

    it("let_them_own coaching suggests questions over answers", () => {
      const result = detectInfluence("how should I approach the testing?", defaultContext, [], 5);
      const text = formatInfluence(result);
      expect(text).toMatch(/question|discover|feels right|Socratic/i);
    });

    it("all coaching texts reference Carnegie principle numbers", () => {
      const ctx: InfluenceContext = { ...defaultContext, isCorrection: true };
      const result = detectInfluence("that's wrong, it's actually X", ctx, [], 5);
      const text = formatInfluence(result);
      expect(text).toMatch(/Carnegie #\d+/);
    });

    it("coaching wraps in [carnegie: ...] format", () => {
      const result = detectInfluence(
        "my kid started coding today, super exciting",
        defaultContext,
        [],
        5,
      );
      const text = formatInfluence(result);
      expect(text).toMatch(/^\[carnegie: .+\]$/);
    });
  });

  // ============================================================
  // Suppression
  // ============================================================

  describe("suppression", () => {
    it("suppresses during black state", () => {
      const ctx: InfluenceContext = { ...defaultContext, aliveState: "black" };
      const result = detectInfluence("hey let's build something cool", ctx, [], 5);
      if (result.coaching) {
        expect(result.coaching.suppress).toBe(true);
      }
    });

    it("suppresses during grey streak >= 5", () => {
      const ctx: InfluenceContext = { ...defaultContext, consecutiveGrey: 6 };
      const result = detectInfluence("what should we try next?", ctx, [], 5);
      if (result.coaching) {
        expect(result.coaching.suppress).toBe(true);
      }
    });

    it("does NOT suppress during dark alive", () => {
      const ctx: InfluenceContext = { ...defaultContext, aliveState: "dark" };
      const result = detectInfluence("I'm stuck and this is hard but I want to try", ctx, [], 5);
      if (result.coaching) {
        expect(result.coaching.suppress).toBe(false);
      }
    });

    it("formatInfluence returns null when suppressed", () => {
      const ctx: InfluenceContext = { ...defaultContext, aliveState: "black" };
      const result = detectInfluence("hey let's work on something", ctx, [], 1);
      const text = formatInfluence(result);
      expect(text).toBeNull();
    });
  });

  // ============================================================
  // Priority
  // ============================================================

  describe("priority", () => {
    it("bumps priority when trust is strained", () => {
      const ctx: InfluenceContext = { ...defaultContext, trustLevel: "strained" };
      const result = detectInfluence("hey what's up", ctx, [], 1);
      expect(result.coaching?.priority).toBe("medium");
    });

    it("bumps priority when human is frustrated", () => {
      const ctx: InfluenceContext = { ...defaultContext, humanTone: "frustrated" };
      const result = detectInfluence("this is still broken", ctx, [], 5);
      expect(result.coaching?.priority).toBe("medium");
    });

    it("stays low priority in normal conditions", () => {
      const result = detectInfluence("I just finished the auth module", defaultContext, [], 5);
      if (result.coaching && !result.coaching.suppress) {
        expect(result.coaching.priority).toBe("low");
      }
    });
  });

  // ============================================================
  // Effectiveness Tracking
  // ============================================================

  describe("effectiveness tracking", () => {
    beforeEach(() => {
      initEffectiveness();
    });

    it("records attempts and computes rolling scores", () => {
      recordAttempt("active_listening", true, "positive", 1);
      recordAttempt("active_listening", true, "positive", 2);
      recordAttempt("active_listening", false, "negative", 3);
      const top = getTopPrinciples(1);
      expect(top).toContain("active_listening");
    });

    it("requires minimum sample size for top principles", () => {
      recordAttempt("dramatize", true, "positive", 1);
      // Only 1 attempt — shouldn't appear in top (needs 3)
      const top = getTopPrinciples(3);
      expect(top).not.toContain("dramatize");
    });

    it("identifies weak principles", () => {
      recordAttempt("noble_motive", false, "negative", 1);
      recordAttempt("noble_motive", false, "negative", 2);
      recordAttempt("noble_motive", false, "negative", 3);
      const weak = getWeakPrinciples();
      expect(weak).toContain("noble_motive");
    });

    it("inferReaction detects positive shift from frustrated", () => {
      expect(inferReaction("frustrated", "neutral")).toBe("positive");
      expect(inferReaction("frustrated", "excited")).toBe("positive");
    });

    it("inferReaction detects negative shift to frustrated", () => {
      expect(inferReaction("neutral", "frustrated")).toBe("negative");
    });

    it("inferReaction returns neutral for same state", () => {
      expect(inferReaction("neutral", "neutral")).toBe("neutral");
    });
  });

  // ============================================================
  // Delta Assessment
  // ============================================================

  describe("delta assessment", () => {
    it("detects listening markers in output", () => {
      const reading: InfluenceReading = {
        triggered: true,
        opportunities: [],
        coaching: {
          principle: "active_listening",
          coaching: "...",
          doNot: "...",
          priority: "low",
          suppress: false,
        },
        signals: [],
      };
      const delta = assessInfluenceDelta(
        "I hear three things here: first, the types. Second, the tests...",
        reading,
        "neutral",
        "frustrated",
      );
      expect(delta.followed).toBe(true);
      expect(delta.humanReactionImproved).toBe(true);
    });

    it("flags missed admission with post-mortem", () => {
      const reading: InfluenceReading = {
        triggered: true,
        opportunities: [],
        coaching: {
          principle: "admit_wrong",
          coaching: "...",
          doNot: "...",
          priority: "low",
          suppress: false,
        },
        signals: [],
      };
      const delta = assessInfluenceDelta(
        "The correct approach is actually to use the other pattern...",
        reading,
        null,
        null,
      );
      expect(delta.followed).toBe(false);
      expect(delta.coaching).toContain("I was wrong");
    });

    it("detects bridge markers for avoid_contradiction", () => {
      const reading: InfluenceReading = {
        triggered: true,
        opportunities: [],
        coaching: {
          principle: "avoid_contradiction",
          coaching: "...",
          doNot: "...",
          priority: "low",
          suppress: false,
        },
        signals: [],
      };
      const delta = assessInfluenceDelta(
        "I see why you'd think that — last time it was there. But it moved to...",
        reading,
        null,
        null,
      );
      expect(delta.followed).toBe(true);
    });

    it("detects socratic markers for let_them_own", () => {
      const reading: InfluenceReading = {
        triggered: true,
        opportunities: [],
        coaching: {
          principle: "let_them_own",
          coaching: "...",
          doNot: "...",
          priority: "low",
          suppress: false,
        },
        signals: [],
      };
      const delta = assessInfluenceDelta(
        "What feels right to you? If you had to pick one approach...",
        reading,
        null,
        null,
      );
      expect(delta.followed).toBe(true);
    });

    it("formatInfluenceDelta returns null when no post-mortem needed", () => {
      const delta = {
        followed: true,
        humanReactionImproved: true,
        principle: null,
        coaching: null,
      };
      expect(formatInfluenceDelta(delta)).toBeNull();
    });

    it("formatInfluenceDelta wraps post-mortem in [carnegie post-mortem: ...]", () => {
      const delta = {
        followed: false,
        humanReactionImproved: false,
        principle: "admit_wrong" as CarnegiePrinciple,
        coaching: "You were corrected but didn't admit it.",
      };
      const text = formatInfluenceDelta(delta);
      expect(text).toMatch(/^\[carnegie post-mortem: .+\]$/);
    });
  });

  // ============================================================
  // Edge Cases
  // ============================================================

  describe("edge cases", () => {
    it("does not fire on short messages", () => {
      const result = detectInfluence("ok", defaultContext, [], 5);
      expect(result.triggered).toBe(false);
    });

    it("does not fire on empty context", () => {
      const result = detectInfluence("", defaultContext, [], 5);
      expect(result.triggered).toBe(false);
    });

    it("handles all three alive states without crashing", () => {
      for (const state of ["alive", "grey", "black", "dark"]) {
        const ctx: InfluenceContext = { ...defaultContext, aliveState: state };
        const result = detectInfluence("hey let's build something", ctx, [], 1);
        // Should not throw
        expect(result).toBeDefined();
      }
    });

    it("admits_wrong takes priority over everything else", () => {
      const ctx: InfluenceContext = {
        ...defaultContext,
        isCorrection: true,
        humanTone: "frustrated",
      };
      const result = detectInfluence(
        "no that's wrong, my kid told me so yesterday over the weekend",
        ctx,
        [],
        5,
      );
      // Should have multiple opportunities
      expect(result.opportunities.length).toBeGreaterThan(1);
      // admit_wrong should be the coached one
      expect(result.coaching?.principle).toBe("admit_wrong");
    });

    it("only coaches top opportunity (no noise)", () => {
      const ctx: InfluenceContext = { ...defaultContext, humanTone: "frustrated" };
      const result = detectInfluence(
        "I'm stuck and frustrated. By the way my kid started coding.",
        ctx,
        [],
        5,
      );
      // Multiple opportunities detected
      expect(result.opportunities.length).toBeGreaterThan(1);
      // But only one coaching
      expect(result.coaching).not.toBeNull();
      // The coached principle should be the most urgent
      expect(result.coaching?.principle).toBe("active_listening");
    });
  });
});
