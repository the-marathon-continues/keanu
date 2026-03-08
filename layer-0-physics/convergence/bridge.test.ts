import { describe, it, expect, beforeEach } from "vitest";
import {
  bridgeHelixSigma,
  helixToSigmaSpace,
  sigmaToHelixPrediction,
  recordDivergence,
  getDivergences,
  getDivergenceStats,
  resolveDivergence,
  _reset,
} from "./bridge.js";
import type { HelixResult, StrandScore } from "./helix.js";
import type { SigmaReading } from "./sigma.js";

// Test fixtures
function makeHelix(state: HelixResult["aliveState"], factual: number, felt: number): HelixResult {
  return {
    text: "test text for helix analysis",
    strands: {
      factual,
      felt,
      convergence: 1 - Math.abs(factual - felt),
      tension: Math.abs(factual - felt),
    },
    aliveState: state,
    color: "#228B22",
    diagnosis: `Both strands active`,
    warnings: [],
  };
}

function makeSigma(
  predictedState: SigmaReading["predictedAliveState"],
  sigma: number,
  agency: number,
  valence: number,
  confidence: number = 0.7,
): SigmaReading {
  return {
    sigma,
    agency,
    potency: 0.5,
    fireAsymmetry: 0,
    valence,
    predictedAliveState: predictedState,
    predictedRecommendation: "hold",
    actualAliveState: predictedState,
    predictionCorrect: true,
    confidence,
  };
}

describe("bridge", () => {
  beforeEach(() => {
    _reset();
  });

  describe("bridgeHelixSigma", () => {
    it("returns agreement=true when states match", () => {
      const helix = makeHelix("alive", 0.6, 0.6);
      const sigma = makeSigma("alive", 0.5, 0.6, 0.5);

      const result = bridgeHelixSigma(helix, sigma);

      expect(result.agreement).toBe(true);
      expect(result.disagreementType).toBeUndefined();
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("returns agreement=false when states differ", () => {
      const helix = makeHelix("alive", 0.6, 0.6);
      const sigma = makeSigma("grey", 0.7, 0.02, 0.5);

      const result = bridgeHelixSigma(helix, sigma);

      expect(result.agreement).toBe(false);
      expect(result.disagreementType).toBeDefined();
    });

    it("classifies disagreement as valence when categories differ", () => {
      // alive (positive) vs black (negative)
      const helix = makeHelix("alive", 0.6, 0.6);
      const sigma = makeSigma("black", 0.8, 0.005, 0.5);

      const result = bridgeHelixSigma(helix, sigma);

      expect(result.agreement).toBe(false);
      expect(result.disagreementType).toBe("valence");
    });

    it("classifies disagreement as intensity when same category", () => {
      // alive (positive) vs luminous (positive) - same category, different intensity
      const helix = makeHelix("alive", 0.6, 0.6);
      const sigma = makeSigma("luminous", 0.4, 0.3, 0.8);

      const result = bridgeHelixSigma(helix, sigma);

      expect(result.agreement).toBe(false);
      expect(result.disagreementType).toBe("intensity");
    });

    it("boosts confidence when lenses agree", () => {
      const helix = makeHelix("alive", 0.6, 0.6);
      const sigmaAgree = makeSigma("alive", 0.5, 0.6, 0.5, 0.7);
      const sigmaDisagree = makeSigma("grey", 0.7, 0.02, 0.5, 0.7);

      const resultAgree = bridgeHelixSigma(helix, sigmaAgree);
      const resultDisagree = bridgeHelixSigma(helix, sigmaDisagree);

      expect(resultAgree.confidence).toBeGreaterThan(resultDisagree.confidence);
    });
  });

  describe("helixToSigmaSpace", () => {
    it("maps factual to estimated sigma", () => {
      const helix = makeHelix("alive", 0.8, 0.5);
      const result = helixToSigmaSpace(helix);

      expect(result.estimatedSigma).toBe(0.8);
    });

    it("maps felt to estimated agency", () => {
      const helix = makeHelix("alive", 0.5, 0.7);
      const result = helixToSigmaSpace(helix);

      expect(result.estimatedAgency).toBe(0.7);
    });

    it("maps luminous state to high valence", () => {
      const helix = makeHelix("luminous", 0.6, 0.6);
      const result = helixToSigmaSpace(helix);

      // luminous returns ~0.8 from scoreLuminousFromResult
      expect(result.estimatedValence).toBeGreaterThan(0.7);
    });

    it("maps dark state to low valence", () => {
      const helix = makeHelix("dark", 0.5, 0.5);
      const result = helixToSigmaSpace(helix);

      // dark returns ~0.7 from scoreDarkFromResult, so valence < 0.5
      expect(result.estimatedValence).toBeLessThan(0.3);
    });
  });

  describe("sigmaToHelixPrediction", () => {
    it("predicts factual_heavy when sigma > agency", () => {
      const sigma = makeSigma("grey", 0.8, 0.3, 0.5);
      const result = sigmaToHelixPrediction(sigma);

      expect(result.expectedStrandBalance).toBe("factual_heavy");
    });

    it("predicts felt_heavy when agency > sigma", () => {
      const sigma = makeSigma("white", 0.3, 0.8, 0.5);
      const result = sigmaToHelixPrediction(sigma);

      expect(result.expectedStrandBalance).toBe("felt_heavy");
    });

    it("predicts balanced when sigma ~ agency", () => {
      const sigma = makeSigma("alive", 0.5, 0.55, 0.5);
      const result = sigmaToHelixPrediction(sigma);

      expect(result.expectedStrandBalance).toBe("balanced");
    });

    it("uses sigma predicted state", () => {
      const sigma = makeSigma("luminous", 0.4, 0.3, 0.8);
      const result = sigmaToHelixPrediction(sigma);

      expect(result.predictedState).toBe("luminous");
    });
  });

  describe("divergence tracking", () => {
    it("records divergence when states differ", () => {
      const helix = makeHelix("alive", 0.6, 0.6);
      const sigma = makeSigma("grey", 0.7, 0.02, 0.5);

      const div = recordDivergence(helix, sigma, "test text");

      expect(div).not.toBeNull();
      expect(div!.helixState).toBe("alive");
      expect(div!.sigmaState).toBe("grey");
      expect(div!.resolved).toBe(false);
    });

    it("returns null when states agree", () => {
      const helix = makeHelix("alive", 0.6, 0.6);
      const sigma = makeSigma("alive", 0.5, 0.6, 0.5);

      const div = recordDivergence(helix, sigma);

      expect(div).toBeNull();
    });

    it("tracks multiple divergences", () => {
      const helix1 = makeHelix("alive", 0.6, 0.6);
      const sigma1 = makeSigma("grey", 0.7, 0.02, 0.5);

      const helix2 = makeHelix("luminous", 0.7, 0.7);
      const sigma2 = makeSigma("dark", 0.4, 0.2, 0.2);

      recordDivergence(helix1, sigma1);
      recordDivergence(helix2, sigma2);

      const divergences = getDivergences();
      expect(divergences).toHaveLength(2);
    });

    it("resolves divergence", () => {
      const helix = makeHelix("alive", 0.6, 0.6);
      const sigma = makeSigma("grey", 0.7, 0.02, 0.5);

      const div = recordDivergence(helix, sigma);
      const resolved = resolveDivergence(div!.id, "helix was correct");

      expect(resolved).toBe(true);

      const divergences = getDivergences();
      expect(divergences[0].resolved).toBe(true);
      expect(divergences[0].resolution).toBe("helix was correct");
    });

    it("returns stats", () => {
      const helix1 = makeHelix("alive", 0.6, 0.6);
      const sigma1 = makeSigma("grey", 0.7, 0.02, 0.5); // valence disagreement

      const helix2 = makeHelix("alive", 0.6, 0.6);
      const sigma2 = makeSigma("luminous", 0.4, 0.3, 0.8); // intensity disagreement

      recordDivergence(helix1, sigma1);
      recordDivergence(helix2, sigma2);

      const stats = getDivergenceStats();
      expect(stats.total).toBe(2);
      expect(stats.byType).toBeDefined();
    });
  });
});
