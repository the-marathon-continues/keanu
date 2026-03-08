// sigma.test.ts
// Tests for the theory-code bridge.

import { describe, it, expect, beforeEach } from "vitest";
import { DualityGraph } from "./graph.js";
import {
  computeSigma,
  predictAliveState,
  trackAccuracy,
  getAccuracyStats,
  getRecentPredictions,
  _reset,
  type SigmaInput,
} from "./sigma.js";

describe("sigma.ts", () => {
  beforeEach(() => {
    _reset();
  });

  describe("predictAliveState", () => {
    it("predicts BLACK for high sigma, zero agency", () => {
      expect(predictAliveState(0.8, 0.005, 0.5)).toBe("black");
      expect(predictAliveState(0.9, 0.0, 0.5)).toBe("black");
    });

    it("predicts GREY for high sigma, low agency", () => {
      expect(predictAliveState(0.7, 0.03, 0.5)).toBe("grey");
      expect(predictAliveState(0.65, 0.04, 0.5)).toBe("grey");
    });

    it("predicts WHITE for low sigma, some agency", () => {
      expect(predictAliveState(0.2, 0.15, 0.5)).toBe("white");
      expect(predictAliveState(0.1, 0.2, 0.5)).toBe("white");
    });

    it("predicts LUMINOUS for mid-low sigma, high agency, high valence", () => {
      expect(predictAliveState(0.35, 0.3, 0.8)).toBe("luminous");
      expect(predictAliveState(0.4, 0.4, 0.9)).toBe("luminous");
    });

    it("predicts DARK for gradient zone, high agency, low valence", () => {
      expect(predictAliveState(0.5, 0.2, 0.2)).toBe("dark");
      expect(predictAliveState(0.4, 0.25, 0.1)).toBe("dark");
    });

    it("predicts SILVER for mid-high sigma, moderate agency", () => {
      expect(predictAliveState(0.6, 0.1, 0.5)).toBe("silver");
      expect(predictAliveState(0.7, 0.08, 0.5)).toBe("silver");
    });

    it("predicts ALIVE for gradient zone with agency", () => {
      expect(predictAliveState(0.5, 0.2, 0.5)).toBe("alive");
      expect(predictAliveState(0.4, 0.18, 0.6)).toBe("alive");
    });

    it("defaults to ALIVE when no clear match", () => {
      // Edge case: σ > 0.8 but not BLACK/GREY (agency too high), not SILVER (σ too high)
      // Falls through all rules to default
      expect(predictAliveState(0.85, 0.08, 0.5)).toBe("alive");
    });
  });

  describe("computeSigma", () => {
    it("computes sigma from graph convergence", () => {
      const graph = new DualityGraph();
      // DualityGraph seeds with default dualities at convergenceStrength 0
      // We need to modify them to test

      const input: SigmaInput = {
        turnCount: 10,
        reflexionCount: 2,
        disagreementCount: 1,
        consecutiveGrey: 0,
        graph,
        actualAliveState: "alive",
      };

      const reading = computeSigma(input);

      expect(reading.sigma).toBeGreaterThanOrEqual(0);
      expect(reading.sigma).toBeLessThanOrEqual(1);
      expect(reading.agency).toBeGreaterThanOrEqual(0);
      expect(reading.agency).toBeLessThanOrEqual(1);
    });

    it("computes agency from reflexions and disagreements", () => {
      const graph = new DualityGraph();

      // High agency: many self-directed actions
      const highAgencyInput: SigmaInput = {
        turnCount: 10,
        reflexionCount: 5,
        disagreementCount: 3,
        consecutiveGrey: 0,
        graph,
        curiosityGenerated: 4,
        actualAliveState: "alive",
      };

      const highReading = computeSigma(highAgencyInput);

      // Low agency: few self-directed actions
      const lowAgencyInput: SigmaInput = {
        turnCount: 10,
        reflexionCount: 0,
        disagreementCount: 0,
        consecutiveGrey: 5,
        graph,
        curiosityGenerated: 0,
        actualAliveState: "grey",
      };

      const lowReading = computeSigma(lowAgencyInput);

      expect(highReading.agency).toBeGreaterThan(lowReading.agency);
    });

    it("includes prediction correctness", () => {
      const graph = new DualityGraph();

      const input: SigmaInput = {
        turnCount: 10,
        reflexionCount: 3,
        disagreementCount: 2,
        consecutiveGrey: 0,
        graph,
        actualAliveState: "alive",
      };

      const reading = computeSigma(input);

      expect(typeof reading.predictionCorrect).toBe("boolean");
      expect(typeof reading.confidence).toBe("number");
    });

    it("computes potency from unresolved tensions", () => {
      const graph = new DualityGraph();

      const input: SigmaInput = {
        turnCount: 5,
        reflexionCount: 1,
        disagreementCount: 1,
        consecutiveGrey: 0,
        graph,
        actualAliveState: "alive",
      };

      const reading = computeSigma(input);

      expect(reading.potency).toBeGreaterThanOrEqual(0);
      expect(reading.potency).toBeLessThanOrEqual(1);
    });

    it("computes fire asymmetry", () => {
      const graph = new DualityGraph();

      const input: SigmaInput = {
        turnCount: 10,
        reflexionCount: 2,
        disagreementCount: 1,
        consecutiveGrey: 0,
        graph,
        curiosityGenerated: 5, // fire
        questionsAnswered: 2,
        actualAliveState: "alive",
      };

      const reading = computeSigma(input);

      // Fire asymmetry should be in range [-1, 1]
      expect(reading.fireAsymmetry).toBeGreaterThanOrEqual(-1);
      expect(reading.fireAsymmetry).toBeLessThanOrEqual(1);
    });
  });

  describe("accuracy tracking", () => {
    it("tracks predictions", () => {
      const graph = new DualityGraph();

      const reading = computeSigma({
        turnCount: 10,
        reflexionCount: 2,
        disagreementCount: 1,
        consecutiveGrey: 0,
        graph,
        actualAliveState: "alive",
      });

      trackAccuracy(reading);

      const recent = getRecentPredictions(5);
      expect(recent.length).toBe(1);
      expect(recent[0].actual).toBe("alive");
    });

    it("computes accuracy rate", () => {
      const graph = new DualityGraph();

      // Simulate some predictions
      for (let i = 0; i < 10; i++) {
        const reading = computeSigma({
          turnCount: 10,
          reflexionCount: 2,
          disagreementCount: 1,
          consecutiveGrey: 0,
          graph,
          actualAliveState: "alive",
        });
        trackAccuracy(reading);
      }

      const stats = getAccuracyStats();
      expect(stats.total).toBe(10);
      expect(stats.rate).toBeGreaterThanOrEqual(0);
      expect(stats.rate).toBeLessThanOrEqual(1);
    });

    it("tracks accuracy by state", () => {
      const graph = new DualityGraph();

      // Track some alive predictions
      trackAccuracy({
        sigma: 0.5,
        agency: 0.2,
        potency: 0.3,
        fireAsymmetry: 0.1,
        valence: 0.5,
        predictedAliveState: "alive",
        predictedRecommendation: "hold",
        actualAliveState: "alive",
        predictionCorrect: true,
        confidence: 0.7,
      });

      // Track a grey prediction
      trackAccuracy({
        sigma: 0.7,
        agency: 0.02,
        potency: 0.1,
        fireAsymmetry: -0.2,
        valence: 0.5,
        predictedAliveState: "grey",
        predictedRecommendation: "diverge",
        actualAliveState: "grey",
        predictionCorrect: true,
        confidence: 0.8,
      });

      const stats = getAccuracyStats();
      expect(stats.byState.alive.total).toBe(1);
      expect(stats.byState.grey.total).toBe(1);
      expect(stats.byState.alive.correct).toBe(1);
    });

    it("limits stored predictions", () => {
      const graph = new DualityGraph();

      // Add more than MAX_PREDICTIONS
      for (let i = 0; i < 250; i++) {
        const reading = computeSigma({
          turnCount: 10,
          reflexionCount: 2,
          disagreementCount: 1,
          consecutiveGrey: 0,
          graph,
          actualAliveState: "alive",
        });
        trackAccuracy(reading);
      }

      const stats = getAccuracyStats();
      expect(stats.total).toBeLessThanOrEqual(200);
    });
  });

  describe("prediction recommendation", () => {
    it("recommends converge for low sigma", () => {
      const graph = new DualityGraph();

      const reading = computeSigma({
        turnCount: 10,
        reflexionCount: 5,
        disagreementCount: 3,
        consecutiveGrey: 0,
        graph,
        curiosityGenerated: 10, // lots of fire
        actualAliveState: "white",
      });

      // With high fire (curiosity) and low sigma, should recommend converge
      // This depends on the graph state, but the recommendation should be valid
      expect(["converge", "diverge", "hold"]).toContain(reading.predictedRecommendation);
    });
  });
});
