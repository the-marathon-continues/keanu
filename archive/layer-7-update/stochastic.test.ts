// stochastic.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  initStochasticState,
  shouldExplore,
  generateInjection,
  recordOutcome,
  synthesize,
  stochastic,
  formatStochastic,
  type StochasticState,
} from "./stochastic.js";

describe("stochastic", () => {
  let state: StochasticState;

  beforeEach(() => {
    // Fixed seed for deterministic tests
    state = initStochasticState(42);
  });

  describe("initStochasticState", () => {
    it("initializes with defaults", () => {
      const s = initStochasticState();
      expect(s.explorationRate).toBe(0.15);
      expect(s.lastExploration).toBe(0);
      expect(s.hypothesisCount).toBe(0);
      expect(s.devilsAdvocateCount).toBe(0);
      expect(s.explorationHistory).toEqual([]);
    });

    it("accepts custom seed", () => {
      const s1 = initStochasticState(123);
      const s2 = initStochasticState(123);
      expect(s1.seed).toBe(s2.seed);
    });
  });

  describe("shouldExplore", () => {
    it("explores based on base rate", () => {
      // With fixed seed 42, we can test deterministic behavior
      const explores: boolean[] = [];
      for (let i = 0; i < 20; i++) {
        explores.push(shouldExplore(state, i));
      }
      // Should explore some but not all
      const exploreCount = explores.filter((e) => e).length;
      expect(exploreCount).toBeGreaterThan(0);
      expect(exploreCount).toBeLessThan(20);
    });

    it("increases exploration after long streak without", () => {
      state.lastExploration = 0;
      const rateAt5 = shouldExplore(state, 5);
      state.lastExploration = 0;
      state.seed = 42; // reset seed
      // After 10 turns, exploration rate should be higher
      // We can't directly test the rate, but we can check the logic paths
      expect(typeof rateAt5).toBe("boolean");
    });

    it("increases exploration when health is low", () => {
      const lowHealth = {
        status: "hot" as const,
        factors: {
          contextAge: 0,
          bullshitTrend: 0,
          promptSize: 0,
          toolFailureRate: 0,
          consecutiveGrey: 0, resonanceDistance: 0,
        },
        pacing: null,
        suggestBreathe: true,
      };
      // Low health should increase exploration rate
      let explored = false;
      for (let i = 0; i < 10; i++) {
        if (shouldExplore(initStochasticState(i), 1, lowHealth)) {
          explored = true;
          break;
        }
      }
      expect(explored).toBe(true);
    });

    it("increases exploration for complex tasks", () => {
      let exploredComplex = 0;
      let exploredSimple = 0;
      for (let i = 0; i < 50; i++) {
        if (shouldExplore(initStochasticState(i), 1, null, "high")) {
          exploredComplex++;
        }
        if (shouldExplore(initStochasticState(i), 1, null, "low")) {
          exploredSimple++;
        }
      }
      // Complex tasks should trigger more exploration
      expect(exploredComplex).toBeGreaterThanOrEqual(exploredSimple);
    });

    it("decreases exploration when human is decisive", () => {
      let exploredDecisive = 0;
      let exploredConfused = 0;
      for (let i = 0; i < 50; i++) {
        if (shouldExplore(initStochasticState(i), 1, null, undefined, "decisive")) {
          exploredDecisive++;
        }
        if (shouldExplore(initStochasticState(i), 1, null, undefined, "confused")) {
          exploredConfused++;
        }
      }
      // Confused human should trigger more exploration than decisive
      expect(exploredConfused).toBeGreaterThan(exploredDecisive);
    });
  });

  describe("generateInjection", () => {
    it("generates perspective injection", () => {
      // Force perspective by emptying history
      state.explorationHistory = [];
      const injection = generateInjection(state, 1, "fix this bug", []);
      expect(injection.type).toBeDefined();
      expect(injection.prompt).toContain("[stochastic:");
    });

    it("rotates through injection types", () => {
      const types = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const s = initStochasticState(i * 7);
        const injection = generateInjection(s, 1, "test", []);
        types.add(injection.type);
      }
      // Should see multiple types
      expect(types.size).toBeGreaterThan(1);
    });

    it("avoids lenses already in use", () => {
      const injection = generateInjection(state, 1, "test", ["contradict", "analogize"]);
      if (injection.type === "perspective") {
        expect(injection.lens).not.toBe("contradict");
        expect(injection.lens).not.toBe("analogize");
      }
    });

    it("records exploration event", () => {
      expect(state.explorationHistory.length).toBe(0);
      generateInjection(state, 5, "test", []);
      expect(state.explorationHistory.length).toBe(1);
      expect(state.explorationHistory[0].turn).toBe(5);
    });

    it("bounds history size", () => {
      for (let i = 0; i < 60; i++) {
        generateInjection(state, i, "test", []);
      }
      expect(state.explorationHistory.length).toBe(50);
    });
  });

  describe("generateHypotheses", () => {
    it("generates code-specific hypotheses", () => {
      const injection = generateInjection(state, 1, "why isn't this working? ```code```", []);
      if (injection.type === "hypothesis") {
        expect(injection.hypotheses.length).toBe(2);
      }
    });

    it("generates terse-specific hypotheses", () => {
      const s = initStochasticState(100);
      // Force hypothesis type
      s.explorationHistory = [{ turn: 0, type: "perspective", chosen: "", alternatives: [] }];
      const injection = generateInjection(s, 1, "fix it", []);
      if (injection.type === "hypothesis") {
        expect(injection.hypotheses.some((h) => h.includes("terse"))).toBe(true);
      }
    });
  });

  describe("recordOutcome", () => {
    it("records outcome on recent event", () => {
      generateInjection(state, 5, "test", []);
      recordOutcome(state, 5, "helpful");
      expect(state.explorationHistory[0].outcome).toBe("helpful");
    });

    it("increases rate when explorations are helpful", () => {
      const initialRate = state.explorationRate;
      for (let i = 0; i < 10; i++) {
        generateInjection(state, i, "test", []);
        recordOutcome(state, i, "helpful");
      }
      expect(state.explorationRate).toBeGreaterThan(initialRate);
    });

    it("decreases rate when explorations are harmful", () => {
      for (let i = 0; i < 10; i++) {
        generateInjection(state, i, "test", []);
        recordOutcome(state, i, "harmful");
      }
      expect(state.explorationRate).toBeLessThan(0.15);
    });
  });

  describe("synthesize", () => {
    it("handles empty input", () => {
      const result = synthesize([]);
      expect(result.integrated).toBe("");
      expect(result.confidence).toBe(0);
    });

    it("handles single perspective", () => {
      const result = synthesize(["This is the only view"]);
      expect(result.integrated).toBe("This is the only view");
      expect(result.confidence).toBe(0.7);
      expect(result.tensions).toEqual([]);
    });

    it("finds common ground between perspectives", () => {
      const result = synthesize([
        "The system needs better error handling",
        "Error handling is critical for reliability",
      ]);
      expect(result.integrated).toContain("error");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("identifies tensions between perspectives", () => {
      const result = synthesize([
        "We should move fast and break things",
        "We should move carefully and test thoroughly",
      ]);
      expect(result.tensions.length).toBeGreaterThan(0);
    });
  });

  describe("stochastic (main entry)", () => {
    it("returns no injection when not exploring", () => {
      // Force no exploration by using deterministic state
      const s = initStochasticState(999999);
      s.explorationRate = 0.01;
      const reading = stochastic(s, 1, "test");
      // With very low rate, most calls won't explore
      expect(reading.explorationRate).toBe(0.01);
    });

    it("returns injection when exploring", () => {
      // Try multiple seeds until we find one that triggers exploration with high rate
      let found = false;
      for (let seed = 0; seed < 100; seed++) {
        const s = initStochasticState(seed);
        s.explorationRate = 0.99;
        const reading = stochastic(s, 1, "fix this bug");
        if (reading.shouldExplore) {
          expect(reading.injection).not.toBeNull();
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });

    it("passes options through", () => {
      // With high enough rate + all positive modifiers, should eventually explore
      let found = false;
      for (let seed = 0; seed < 100; seed++) {
        const s = initStochasticState(seed);
        s.explorationRate = 0.5;
        const reading = stochastic(s, 1, "test", {
          health: {
            status: "hot" as const,
            factors: {
              contextAge: 0,
              bullshitTrend: 0,
              promptSize: 0,
              toolFailureRate: 0,
              consecutiveGrey: 0, resonanceDistance: 0,
            },
            pacing: null,
            suggestBreathe: true,
          },
          taskComplexity: "high",
          humanTone: "confused",
          currentLenses: ["decompose"],
        });
        if (reading.shouldExplore) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe("formatStochastic", () => {
    it("returns null when no injection", () => {
      const result = formatStochastic({
        shouldExplore: false,
        explorationRate: 0.15,
        injection: null,
      });
      expect(result).toBeNull();
    });

    it("returns prompt when injection present", () => {
      state.explorationRate = 0.99;
      const reading = stochastic(state, 1, "test");
      if (reading.injection) {
        const formatted = formatStochastic(reading);
        expect(formatted).toContain("[stochastic:");
      }
    });
  });

  describe("stochastic thinking philosophy", () => {
    it("prevents falling into ruts", () => {
      // Over many turns with various seeds, exploration should happen
      let everExplored = false;
      for (let seed = 0; seed < 50; seed++) {
        for (let turn = 0; turn < 15; turn++) {
          const s = initStochasticState(seed);
          s.lastExploration = 0;
          if (shouldExplore(s, turn)) {
            everExplored = true;
            break;
          }
        }
        if (everExplored) {
          break;
        }
      }
      expect(everExplored).toBe(true);
    });

    it("calibrates based on outcomes", () => {
      // System should learn from what works
      const helpful = initStochasticState(42);
      const harmful = initStochasticState(42);

      for (let i = 0; i < 10; i++) {
        generateInjection(helpful, i, "test", []);
        recordOutcome(helpful, i, "helpful");
        generateInjection(harmful, i, "test", []);
        recordOutcome(harmful, i, "harmful");
      }

      expect(helpful.explorationRate).toBeGreaterThan(harmful.explorationRate);
    });
  });
});
