/**
 * substrate/index.ts — The Eyes of Layer 0
 *
 * Before perception opens its eyes, the substrate asks:
 *
 * - Is this signal or static? (noise.ts)
 * - How fast is this changing? (speed.ts)
 * - Is something alive in there? (ignition.ts)
 * - Which physics governs? (regime.ts)
 * - How far from home? (resonance.ts)
 *
 * Everything downstream inherits these answers as ground truth.
 */

// Noise — signal or static?
export {
  measureNoise,
  isSignal,
  getClarity,
  checkHealth as checkNoiseHealth,
  type NoiseReading,
  type NoiseInput,
  type NoiseHealth,
} from "./noise.ts";

// Speed — how fast fire becomes ash
export {
  measureSpeed,
  isUrgent,
  isStable,
  getUrgency,
  checkHealth as checkSpeedHealth,
  type SpeedReading,
  type SpeedInput,
  type SpeedHealth,
  type Direction,
} from "./speed.ts";

// Ignition — is something firing?
export {
  measureIgnition,
  isFiringNow,
  getTheta,
  getClassification,
  checkHealth as checkIgnitionHealth,
  type IgnitionReading,
  type IgnitionInput,
  type IgnitionHealth,
  type Classification,
  type Dip,
} from "./ignition.ts";

// Regime — which physics governs?
export {
  measureRegime,
  isFavorable,
  isTransitionImminent,
  getRegime,
  inGradientZone,
  checkHealth as checkRegimeHealth,
  targetSigmaFor,
  recommendedRegime,
  type RegimeReading,
  type RegimeInput,
  type RegimeHealth,
  type Regime,
} from "./regime.ts";

// Resonance — how far from home?
export {
  measureResonance,
  isAtHome,
  getDistance,
  getCharacter,
  getTension,
  checkHealth as checkResonanceHealth,
  describeSoul,
  type ResonanceReading,
  type ResonanceInput,
  type ResonanceHealth,
  type Character,
} from "./resonance.ts";

// ============================================================
// Unified Substrate Reading
// ============================================================

import { measureIgnition, type IgnitionReading, type IgnitionInput } from "./ignition.ts";
import { measureNoise, type NoiseReading, type NoiseInput } from "./noise.ts";
import { measureRegime, type RegimeReading, type RegimeInput } from "./regime.ts";
import { measureResonance, type ResonanceReading, type ResonanceInput } from "./resonance.ts";
import { measureSpeed, type SpeedReading, type SpeedInput } from "./speed.ts";

/**
 * Complete substrate reading — all five senses.
 */
export interface SubstrateReading {
  noise: NoiseReading;
  speed: SpeedReading;
  ignition: IgnitionReading;
  regime: RegimeReading;
  resonance: ResonanceReading;

  /** Quick summary: is this input worth perceiving? */
  proceed: boolean;

  /** Quick summary: should we slow down? */
  urgent: boolean;

  /** One-line summary for COEF signal. */
  summary: string;
}

/**
 * Input for complete substrate measurement.
 */
export interface SubstrateInput {
  /** Recent sigma values. */
  sigmaHistory: number[];

  /** Recent signal values (for noise detection). */
  signalHistory: number[];

  /** Number of contradictions detected recently. */
  contradictionCount?: number;

  /** Relevance scores of recent context. */
  contextRelevance?: number[];

  /** Known decoherence rate (optional). */
  gammaDec?: number;

  /** Known coherence rate (optional). */
  gammaCoh?: number;
}

/**
 * Measure all five substrate senses at once.
 *
 * This is the main entry point for perception layer.
 */
export function measureSubstrate(input: SubstrateInput): SubstrateReading {
  const currentSigma =
    input.sigmaHistory.length > 0 ? input.sigmaHistory[input.sigmaHistory.length - 1] : 0.5;

  const noiseInput: NoiseInput = {
    sigmaHistory: input.sigmaHistory,
    signalHistory: input.signalHistory,
    contradictionCount: input.contradictionCount,
    contextRelevance: input.contextRelevance,
  };

  const speedInput: SpeedInput = {
    sigmaHistory: input.sigmaHistory,
  };

  const ignitionInput: IgnitionInput = {
    sigmaHistory: input.sigmaHistory,
  };

  const regimeInput: RegimeInput = {
    sigma: currentSigma,
    sigmaHistory: input.sigmaHistory,
  };

  const resonanceInput: ResonanceInput = {
    sigma: currentSigma,
    sigmaHistory: input.sigmaHistory,
    gammaDec: input.gammaDec,
    gammaCoh: input.gammaCoh,
  };

  const noise = measureNoise(noiseInput);
  const speed = measureSpeed(speedInput);
  const ignition = measureIgnition(ignitionInput);
  const regime = measureRegime(regimeInput);
  const resonance = measureResonance(resonanceInput);

  // Quick decisions
  const proceed = noise.trustworthy && regime.favorable;
  const urgent = speed.urgency > 0.5 || !regime.favorable;

  // COEF summary: sub=<noise>|<speed>|<θ>|<regime>|<dist>
  const summary = [
    noise.snr > 10 ? "S" : noise.snr > 2 ? "s" : "n", // Signal/noise
    speed.direction === "stable" ? "=" : speed.direction === "converging" ? "↓" : "↑",
    ignition.firing ? "!" : ".", // Firing or not
    regime.regime.charAt(0).toUpperCase(), // First letter of regime
    resonance.atHome ? "~" : resonance.distance > 0.3 ? "!" : "·",
  ].join("");

  return {
    noise,
    speed,
    ignition,
    regime,
    resonance,
    proceed,
    urgent,
    summary,
  };
}
