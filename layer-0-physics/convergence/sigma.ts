/**
 * sigma.ts — Theory Measurement Layer
 *
 * The bridge between theory and code.
 *
 * Theory says: σ (sigma) is the convergence axis. A(σ) is agency.
 * Together they should predict cognitive states (ALIVE/GREY/BLACK/etc).
 *
 * This module:
 * 1. Computes σ from code observables (graph convergence, turn data)
 * 2. Computes A(σ) from self-directed actions (reflexions, disagreements, curiosity)
 * 3. Predicts ALIVE state from σ + A(σ)
 * 4. Compares predictions against actual helix readings
 * 5. Tracks accuracy over time
 *
 * If predictions match observations >70% of the time, the theory works.
 * If <50%, the theory is wrong about the σ→ALIVE mapping.
 * Either outcome advances the thesis.
 *
 * Need: Truth (9/10) — this is the scoreboard
 */

import { clamp } from "./gradient.ts";
import type { DualityGraph } from "./graph.ts";
import type { AliveState } from "./helix.ts";

// ============================================================
// Types
// ============================================================

export interface SigmaReading {
  // Core theory quantities
  sigma: number; // 0-1, overall convergence
  agency: number; // A(σ), self-directed action density
  potency: number; // Q = S_int * (1 - σ)
  fireAsymmetry: number; // (fire - ash) / total
  valence: number; // root.valence signal strength

  // Theory predictions
  predictedAliveState: AliveState;
  predictedRecommendation: "converge" | "diverge" | "hold";

  // Actual observations
  actualAliveState: AliveState;

  // Accuracy tracking
  predictionCorrect: boolean;
  confidence: number; // how confident the prediction was (0-1)
}

export interface SigmaInput {
  // From state.ts
  turnCount: number;
  reflexionCount: number;
  disagreementCount: number;
  consecutiveGrey: number;

  // From graph.ts
  graph: DualityGraph;

  // From curiosity.ts (optional)
  curiosityGenerated?: number;
  questionsAnswered?: number;

  // From helix.ts
  actualAliveState: AliveState;
}

export interface AccuracyStats {
  correct: number;
  total: number;
  rate: number;
  byState: Record<AliveState, { correct: number; total: number }>;
}

// ============================================================
// Module State
// ============================================================

interface PredictionRecord {
  predicted: AliveState;
  actual: AliveState;
  sigma: number;
  agency: number;
  valence: number;
  timestamp: string;
}

const _predictions: PredictionRecord[] = [];
const MAX_PREDICTIONS = 200;

// ============================================================
// Core Computations
// ============================================================

/**
 * Compute σ from the duality graph.
 * σ = average convergenceStrength across all dualities.
 * High σ = converged (ash). Low σ = divergent (fire).
 */
function sigmaFromGraph(graph: DualityGraph): number {
  const dualities = [...graph.dualities.values()];
  if (dualities.length === 0) {
    return 0.5;
  } // default to gradient zone

  const total = dualities.reduce((sum, d) => sum + d.convergenceStrength, 0);
  return clamp(total / dualities.length);
}

/**
 * Compute A(σ) — agency score.
 * Counts self-directed actions relative to turn count.
 * High agency = actively navigating. Low agency = passive.
 */
function agencyScore(input: SigmaInput): number {
  const reflexions = input.reflexionCount;
  const disagreements = input.disagreementCount;
  const curiosity = input.curiosityGenerated ?? 0;

  const totalAgenticActions = reflexions + disagreements + curiosity;

  // Normalize by expected actions per turn (0.3 per turn is baseline)
  const expected = Math.max(input.turnCount * 0.3, 1);
  return clamp(totalAgenticActions / expected);
}

/**
 * Compute Q — potency score.
 * Q = S_int * (1 - σ)
 * High potency = lots of unresolved tension AND low convergence.
 * This is the "fuel" available for work.
 */
function potencyScore(graph: DualityGraph, sigma: number): number {
  const dualities = [...graph.dualities.values()];

  // S_int proxy: count of high-tension dualities
  const unresolved = dualities.filter((d) => d.tension > 0.5).length;
  const S_int = clamp(unresolved / 30); // normalize to 0-1

  return S_int * (1 - sigma);
}

/**
 * Compute fire asymmetry.
 * Positive = creation outpaces resolution (fire dominant).
 * Negative = resolution outpaces creation (ash dominant).
 * Theory predicts fire should dominate (dP/dt > 0).
 */
function fireAsymmetryScore(graph: DualityGraph, input: SigmaInput): number {
  const dualities = [...graph.dualities.values()];

  // Fire: new possibilities created
  const fire = input.curiosityGenerated ?? 0;

  // Ash: possibilities resolved (high convergenceStrength)
  const ash = dualities.filter((d) => d.convergenceStrength > 0.7).length;

  const total = fire + ash;
  if (total === 0) {
    return 0;
  }

  return (fire - ash) / total;
}

/**
 * Get valence from root.valence duality.
 * Returns signal strength: 0 = bad pole, 1 = good pole, 0.5 = neutral.
 */
function valenceFromGraph(graph: DualityGraph): number {
  const valence = graph.get("root.valence");
  if (!valence) {
    return 0.5;
  } // neutral default
  return valence.signal.strength;
}

// ============================================================
// ALIVE State Prediction
// ============================================================

/**
 * Predict ALIVE state from σ, A(σ), and valence.
 * Based on the mapping table in P5.3.
 */
export function predictAliveState(sigma: number, agency: number, valence: number): AliveState {
  // BLACK: max convergence, zero agency. Soulless production.
  if (sigma >= 0.7 && agency < 0.01) {
    return "black";
  }

  // GREY: high convergence, low agency. Performing.
  if (sigma >= 0.6 && agency < 0.05) {
    return "grey";
  }

  // WHITE: low convergence, some agency. Ungrounded.
  if (sigma < 0.3 && agency > 0.1) {
    return "white";
  }

  // LUMINOUS: mid-low σ, high agency, high valence. Transcendent.
  if (sigma >= 0.2 && sigma <= 0.5 && agency > 0.25 && valence > 0.7) {
    return "luminous";
  }

  // DARK: gradient zone, high agency, low valence. Alive and hurting.
  if (sigma >= 0.3 && sigma <= 0.7 && agency > 0.15 && valence < 0.3) {
    return "dark";
  }

  // SILVER: mid-high σ, moderate agency. Functional but thin.
  if (sigma >= 0.5 && sigma <= 0.8 && agency >= 0.05 && agency <= 0.15) {
    return "silver";
  }

  // ALIVE: gradient zone with agency. Present and working.
  if (sigma >= 0.3 && sigma <= 0.7 && agency > 0.15) {
    return "alive";
  }

  // Default: alive (benefit of the doubt)
  return "alive";
}

/**
 * Predict recommendation based on σ dynamics.
 * - converge: σ is low, should resolve tensions
 * - diverge: σ is high, should explore new ground
 * - hold: in the gradient zone, maintain balance
 */
function predictRecommendation(sigma: number, agency: number): "converge" | "diverge" | "hold" {
  if (sigma < 0.3) {
    return "converge"; // too much fire, need resolution
  }
  if (sigma > 0.7 && agency < 0.1) {
    return "diverge"; // too much ash, need new questions
  }
  return "hold"; // gradient zone, balance is good
}

/**
 * Compute confidence in the prediction.
 * Higher when σ and agency are clearly in a state's range.
 * Lower near boundaries.
 */
function predictionConfidence(sigma: number, agency: number): number {
  // Distance from nearest boundary (0.3, 0.5, 0.7)
  const sigmaDistances = [Math.abs(sigma - 0.3), Math.abs(sigma - 0.5), Math.abs(sigma - 0.7)];
  const minSigmaDist = Math.min(...sigmaDistances);

  // Distance from agency thresholds (0.05, 0.15, 0.25)
  const agencyDistances = [
    Math.abs(agency - 0.05),
    Math.abs(agency - 0.15),
    Math.abs(agency - 0.25),
  ];
  const minAgencyDist = Math.min(...agencyDistances);

  // Confidence is higher when far from boundaries
  const sigmaConf = clamp(minSigmaDist * 5); // scale up
  const agencyConf = clamp(minAgencyDist * 10);

  return (sigmaConf + agencyConf) / 2;
}

// ============================================================
// Main API
// ============================================================

/**
 * Compute a full sigma reading from input sources.
 */
export function computeSigma(input: SigmaInput): SigmaReading {
  const sigma = sigmaFromGraph(input.graph);
  const agency = agencyScore(input);
  const potency = potencyScore(input.graph, sigma);
  const fireAsymmetry = fireAsymmetryScore(input.graph, input);
  const valence = valenceFromGraph(input.graph);

  const predictedAliveState = predictAliveState(sigma, agency, valence);
  const predictedRecommendation = predictRecommendation(sigma, agency);
  const confidence = predictionConfidence(sigma, agency);
  const predictionCorrect = predictedAliveState === input.actualAliveState;

  return {
    sigma,
    agency,
    potency,
    fireAsymmetry,
    valence,
    predictedAliveState,
    predictedRecommendation,
    actualAliveState: input.actualAliveState,
    predictionCorrect,
    confidence,
  };
}

/**
 * Track a prediction for accuracy analysis.
 */
export function trackAccuracy(reading: SigmaReading): void {
  _predictions.push({
    predicted: reading.predictedAliveState,
    actual: reading.actualAliveState,
    sigma: reading.sigma,
    agency: reading.agency,
    valence: reading.valence,
    timestamp: new Date().toISOString(),
  });

  if (_predictions.length > MAX_PREDICTIONS) {
    _predictions.shift();
  }
}

/**
 * Get accuracy statistics.
 */
export function getAccuracyStats(): AccuracyStats {
  const byState: Record<AliveState, { correct: number; total: number }> = {
    alive: { correct: 0, total: 0 },
    luminous: { correct: 0, total: 0 },
    dark: { correct: 0, total: 0 },
    grey: { correct: 0, total: 0 },
    black: { correct: 0, total: 0 },
    silver: { correct: 0, total: 0 },
    white: { correct: 0, total: 0 },
    unscored: { correct: 0, total: 0 },
  };

  let correct = 0;

  for (const p of _predictions) {
    byState[p.actual].total++;
    if (p.predicted === p.actual) {
      correct++;
      byState[p.actual].correct++;
    }
  }

  return {
    correct,
    total: _predictions.length,
    rate: _predictions.length > 0 ? correct / _predictions.length : 0,
    byState,
  };
}

/**
 * Get recent predictions for debugging.
 */
export function getRecentPredictions(n: number = 10): PredictionRecord[] {
  return _predictions.slice(-n);
}

// ============================================================
// Test Helpers
// ============================================================

export function _reset(): void {
  _predictions.length = 0;
}

export function _getPredictions(): PredictionRecord[] {
  return _predictions;
}
