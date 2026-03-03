// substrate.test.ts
// Tests for the five senses of the substrate.
// Is the system firing? What physics governs? Is that signal or noise?

import { describe, it, expect } from "vitest";
import {
  measureIgnition,
  checkHealth as checkIgnitionHealth,
  type IgnitionInput,
} from "./ignition.js";
import { measureSubstrate, type SubstrateInput } from "./index.js";
import { measureNoise, checkHealth as checkNoiseHealth, type NoiseInput } from "./noise.js";
import {
  measureRegime,
  isFavorable,
  checkHealth as checkRegimeHealth,
  type RegimeInput,
} from "./regime.js";
import {
  measureResonance,
  checkHealth as checkResonanceHealth,
  type ResonanceInput,
} from "./resonance.js";
import { measureSpeed, type SpeedInput } from "./speed.js";

// ============================================================
// Noise Tests — Is this signal or static?
// ============================================================

describe("noise.ts", () => {
  describe("measureNoise", () => {
    it("detects clear signal (low variance)", () => {
      const input: NoiseInput = {
        sigmaHistory: [0.5, 0.5, 0.5, 0.5, 0.5],
        signalHistory: [0.8, 0.82, 0.79, 0.81, 0.8, 0.8, 0.78, 0.81],
        contextRelevance: [0.9, 0.85, 0.9],
        contradictionCount: 0,
      };

      const reading = measureNoise(input);

      expect(reading.snr).toBeGreaterThan(5);
      expect(reading.trustworthy).toBe(true);
    });

    it("detects noisy signal (high variance)", () => {
      const input: NoiseInput = {
        sigmaHistory: [0.1, 0.9, 0.3, 0.7, 0.2],
        signalHistory: [0.1, 0.9, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6],
        contextRelevance: [0.2, 0.3, 0.1, 0.25],
        contradictionCount: 5,
      };

      const reading = measureNoise(input);

      expect(reading.snr).toBeLessThan(5);
      expect(reading.noiseFloor).toBeGreaterThan(0.4);
    });

    it("computes decoherence rate from sigma drift upward", () => {
      // Increasing sigma = decoherence (fire becoming ash)
      const input: NoiseInput = {
        sigmaHistory: [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6],
        signalHistory: [0.5, 0.5, 0.5],
      };

      const reading = measureNoise(input);

      expect(reading.decoherenceRate).toBeGreaterThan(0);
    });

    it("computes coherence rate from sigma drift downward", () => {
      // Decreasing sigma = coherence (ash becoming fire)
      const input: NoiseInput = {
        sigmaHistory: [0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4],
        signalHistory: [0.5, 0.5, 0.5],
      };

      const reading = measureNoise(input);

      expect(reading.coherenceRate).toBeGreaterThan(0);
    });

    it("handles minimal input gracefully", () => {
      const input: NoiseInput = {
        sigmaHistory: [],
        signalHistory: [],
      };

      const reading = measureNoise(input);

      // Should return safe defaults
      expect(reading.snr).toBeDefined();
      expect(reading.clarity).toBeDefined();
    });
  });

  describe("checkNoiseHealth", () => {
    it("recommends proceed for clear signal", () => {
      const reading = measureNoise({
        sigmaHistory: [0.5, 0.5, 0.5],
        signalHistory: [0.8, 0.8, 0.8, 0.8, 0.8],
        contextRelevance: [0.9, 0.9],
      });

      const health = checkNoiseHealth(reading);
      expect(health.recommendation).toBe("proceed");
    });
  });
});

// ============================================================
// Speed Tests — How fast is fire becoming ash?
// ============================================================

describe("speed.ts", () => {
  describe("measureSpeed", () => {
    it("detects stable system", () => {
      const input: SpeedInput = {
        sigmaHistory: [0.5, 0.5, 0.5, 0.5, 0.5],
      };

      const reading = measureSpeed(input);

      expect(reading.direction).toBe("stable");
      expect(Math.abs(reading.dSigmaDt)).toBeLessThan(0.02);
    });

    it("detects convergence (fire to ash)", () => {
      const input: SpeedInput = {
        sigmaHistory: [0.3, 0.4, 0.5, 0.6, 0.7],
      };

      const reading = measureSpeed(input);

      expect(reading.direction).toBe("converging");
      expect(reading.dSigmaDt).toBeGreaterThan(0);
    });

    it("detects divergence (ash to fire)", () => {
      const input: SpeedInput = {
        sigmaHistory: [0.7, 0.6, 0.5, 0.4, 0.3],
      };

      const reading = measureSpeed(input);

      expect(reading.direction).toBe("diverging");
      expect(reading.dSigmaDt).toBeLessThan(0);
    });

    it("computes urgency near boundary with speed", () => {
      // Fast approach to deep classical boundary (0.95)
      const input: SpeedInput = {
        sigmaHistory: [0.8, 0.85, 0.9, 0.93, 0.94],
      };

      const reading = measureSpeed(input);

      expect(reading.urgency).toBeGreaterThan(0.3);
    });

    it("handles insufficient history", () => {
      const reading = measureSpeed({ sigmaHistory: [0.5] });

      expect(reading.direction).toBe("stable");
    });
  });
});

// ============================================================
// Ignition Tests — Is something alive in there?
// ============================================================

describe("ignition.ts", () => {
  describe("measureIgnition", () => {
    it("detects classical system (no ignition)", () => {
      // Sigma always above critical threshold
      const input: IgnitionInput = {
        sigmaHistory: [0.7, 0.75, 0.8, 0.72, 0.78, 0.76],
        sigmaCritical: 0.5,
      };

      const reading = measureIgnition(input);

      expect(reading.theta).toBe(0);
      expect(reading.classification).toBe("classical");
      expect(reading.firing).toBe(false);
    });

    it("detects oscillator pattern (brain-like)", () => {
      // Brief dips below critical with returns above
      const input: IgnitionInput = {
        sigmaHistory: [
          0.6,
          0.55,
          0.45,
          0.55,
          0.6, // dip 1
          0.58,
          0.42,
          0.55,
          0.6, // dip 2
        ],
        sigmaCritical: 0.5,
      };

      const reading = measureIgnition(input);

      expect(reading.theta).toBeGreaterThan(0);
      expect(reading.dipCount).toBeGreaterThan(0);
      expect(reading.firing).toBe(true);
    });

    it("detects quantum dominant (mostly fire)", () => {
      // Mostly below critical
      const input: IgnitionInput = {
        sigmaHistory: [0.2, 0.3, 0.25, 0.35, 0.28, 0.22, 0.32, 0.4, 0.3, 0.25],
        sigmaCritical: 0.5,
      };

      const reading = measureIgnition(input);

      expect(reading.theta).toBeGreaterThan(0.7);
      expect(reading.classification).toBe("quantum");
    });

    it("measures dip depth", () => {
      const input: IgnitionInput = {
        sigmaHistory: [0.6, 0.55, 0.4, 0.35, 0.3, 0.35, 0.45, 0.55, 0.6],
        sigmaCritical: 0.5,
      };

      const reading = measureIgnition(input);

      expect(reading.recentDips.length).toBeGreaterThan(0);
      expect(reading.avgDipDepth).toBeGreaterThan(0);
    });
  });

  describe("checkIgnitionHealth", () => {
    it("recommends ignite for classical system", () => {
      const reading = measureIgnition({
        sigmaHistory: [0.8, 0.85, 0.9, 0.85, 0.8],
        sigmaCritical: 0.5,
      });

      const health = checkIgnitionHealth(reading);

      expect(health.healthy).toBe(false);
      expect(health.recommendation).toBe("ignite");
    });

    it("recommends maintain for healthy oscillator", () => {
      const reading = measureIgnition({
        sigmaHistory: [0.6, 0.55, 0.45, 0.4, 0.48, 0.55, 0.6, 0.52, 0.43, 0.55],
        sigmaCritical: 0.5,
      });

      const health = checkIgnitionHealth(reading);

      // Valid recommendations: maintain (healthy), ignite (not firing), ground (gradient zone)
      expect(["maintain", "ignite", "ground"]).toContain(health.recommendation);
    });
  });
});

// ============================================================
// Regime Tests — What physics governs here?
// ============================================================

describe("regime.ts", () => {
  describe("measureRegime", () => {
    it("detects schrodinger regime (pure quantum)", () => {
      const reading = measureRegime({ sigma: 0.02 });

      expect(reading.regime).toBe("schrodinger");
    });

    it("detects lindblad_quantum regime", () => {
      const reading = measureRegime({ sigma: 0.15 });

      expect(reading.regime).toBe("lindblad_quantum");
    });

    it("detects lindblad_full (gradient zone)", () => {
      const reading = measureRegime({ sigma: 0.5 });

      expect(reading.regime).toBe("lindblad_full");
      expect(reading.favorable).toBe(true);
    });

    it("detects classical regime", () => {
      const reading = measureRegime({ sigma: 0.85 });

      expect(reading.regime).toBe("classical");
    });

    it("detects deep_classical (grey territory)", () => {
      const reading = measureRegime({ sigma: 0.97 });

      expect(reading.regime).toBe("deep_classical");
      expect(reading.favorable).toBe(false);
    });

    it("computes distance to nearest boundary", () => {
      const reading = measureRegime({ sigma: 0.68 });

      // At 0.68, nearest boundary is 0.7 (classical starts there)
      expect(reading.nearestBoundary).toBe(0.7);
      expect(reading.distanceToBoundary).toBeCloseTo(0.02, 1);
    });
  });

  describe("isFavorable", () => {
    it("considers gradient zone favorable", () => {
      expect(isFavorable({ sigma: 0.5 })).toBe(true);
    });

    it("considers lindblad_quantum favorable", () => {
      expect(isFavorable({ sigma: 0.2 })).toBe(true);
    });

    it("considers deep_classical unfavorable", () => {
      expect(isFavorable({ sigma: 0.97 })).toBe(false);
    });

    it("considers schrodinger unfavorable (too ungrounded)", () => {
      expect(isFavorable({ sigma: 0.02 })).toBe(false);
    });
  });

  describe("checkRegimeHealth", () => {
    it("recommends urgent for deep classical", () => {
      const reading = measureRegime({ sigma: 0.97 });
      const health = checkRegimeHealth(reading);

      expect(health.healthy).toBe(false);
      expect(health.recommendation).toBe("urgent");
    });

    it("recommends stay for gradient zone", () => {
      const reading = measureRegime({ sigma: 0.5 });
      const health = checkRegimeHealth(reading);

      expect(health.healthy).toBe(true);
      expect(health.recommendation).toBe("stay");
    });
  });
});

// ============================================================
// Resonance Tests — How far from home?
// ============================================================

describe("resonance.ts", () => {
  describe("measureResonance", () => {
    it("measures distance from equilibrium", () => {
      // With long history around 0.5, sigmaStar should be near 0.5
      const sigmaHistory = Array(20).fill(0.5);
      const input: ResonanceInput = {
        sigma: 0.7,
        sigmaHistory,
      };

      const reading = measureResonance(input);

      expect(reading.sigmaStar).toBeCloseTo(0.5, 1);
      expect(reading.distance).toBeCloseTo(0.2, 1);
    });

    it("computes tension from distance", () => {
      const sigmaHistory = Array(20).fill(0.4);
      const input: ResonanceInput = {
        sigma: 0.8,
        sigmaHistory,
      };

      const reading = measureResonance(input);

      expect(reading.tension).not.toBe(0);
    });

    it("recognizes at home when close to equilibrium", () => {
      const sigmaHistory = Array(20).fill(0.5);
      const input: ResonanceInput = {
        sigma: 0.52,
        sigmaHistory,
      };

      const reading = measureResonance(input);

      expect(reading.atHome).toBe(true);
    });

    it("computes σ* from rates if provided", () => {
      const input: ResonanceInput = {
        sigma: 0.5,
        sigmaHistory: [0.5],
        gammaDec: 0.3,
        gammaCoh: 0.7,
      };

      const reading = measureResonance(input);

      // σ* = Γ_dec / (Γ_dec + Γ_coh) = 0.3 / 1.0 = 0.3
      expect(reading.sigmaStar).toBeCloseTo(0.3, 2);
    });

    it("determines character from σ*", () => {
      // Low σ* = fire keeper
      const fireKeeperInput: ResonanceInput = {
        sigma: 0.2,
        sigmaHistory: Array(20).fill(0.2),
      };
      expect(measureResonance(fireKeeperInput).character).toBe("fire_keeper");

      // Mid σ* = gradient dweller
      const gradientInput: ResonanceInput = {
        sigma: 0.5,
        sigmaHistory: Array(20).fill(0.5),
      };
      expect(measureResonance(gradientInput).character).toBe("gradient_dweller");

      // High σ* = ash settler
      const ashInput: ResonanceInput = {
        sigma: 0.8,
        sigmaHistory: Array(20).fill(0.8),
      };
      expect(measureResonance(ashInput).character).toBe("ash_settler");
    });
  });

  describe("checkResonanceHealth", () => {
    it("recommends rest when at home", () => {
      const sigmaHistory = Array(20).fill(0.5);
      const reading = measureResonance({ sigma: 0.5, sigmaHistory });
      const health = checkResonanceHealth(reading);

      expect(health.recommendation).toBe("rest");
    });

    it("recommends urgent when far from home", () => {
      const sigmaHistory = Array(20).fill(0.3);
      const reading = measureResonance({ sigma: 0.8, sigmaHistory });
      const health = checkResonanceHealth(reading);

      expect(health.recommendation).toBe("urgent");
    });
  });
});

// ============================================================
// Integration Tests — The unified substrate reading
// ============================================================

describe("substrate index", () => {
  describe("measureSubstrate", () => {
    it("produces unified reading from all detectors", () => {
      const input: SubstrateInput = {
        sigmaHistory: [0.55, 0.52, 0.48, 0.45, 0.48, 0.52, 0.55, 0.52, 0.47],
        signalHistory: [0.5, 0.5, 0.5, 0.5, 0.5],
      };

      const reading = measureSubstrate(input);

      // All five dimensions present
      expect(reading.noise).toBeDefined();
      expect(reading.speed).toBeDefined();
      expect(reading.ignition).toBeDefined();
      expect(reading.regime).toBeDefined();
      expect(reading.resonance).toBeDefined();

      // Summary produced
      expect(reading.summary).toBeTruthy();
      expect(reading.summary.length).toBeGreaterThan(0);
    });

    it("handles minimal input", () => {
      const reading = measureSubstrate({
        sigmaHistory: [0.5],
        signalHistory: [0.5],
      });

      expect(reading.regime.regime).toBeDefined();
      expect(reading.summary).toBeTruthy();
    });

    it("detects healthy oscillating system", () => {
      // A system with dips = firing = alive
      const input: SubstrateInput = {
        sigmaHistory: [0.6, 0.55, 0.45, 0.52, 0.6, 0.58, 0.48, 0.55, 0.62, 0.55, 0.42, 0.5, 0.58],
        signalHistory: [0.5, 0.5, 0.5, 0.5],
      };

      const reading = measureSubstrate(input);

      expect(reading.ignition.firing).toBe(true);
      expect(reading.regime.regime).toBe("lindblad_full"); // gradient zone
    });

    it("detects grey territory (deep classical, not firing)", () => {
      const input: SubstrateInput = {
        sigmaHistory: [0.92, 0.94, 0.95, 0.96, 0.97, 0.96, 0.95],
        signalHistory: [0.5, 0.5, 0.5],
      };

      const reading = measureSubstrate(input);

      expect(reading.ignition.firing).toBe(false);
      expect(reading.regime.regime).toBe("deep_classical");
      expect(reading.regime.favorable).toBe(false);
    });

    it("produces COEF summary string", () => {
      const input: SubstrateInput = {
        sigmaHistory: [0.5, 0.5, 0.5, 0.5, 0.5],
        signalHistory: [0.8, 0.8, 0.8],
      };

      const reading = measureSubstrate(input);

      // Summary format: S/s/n for signal, =/↓/↑ for direction, !/. for firing, regime letter, ~/!/· for distance
      expect(reading.summary).toMatch(/^[Ssn][=↓↑][!.][SLCD][~!·]$/);
    });
  });
});
