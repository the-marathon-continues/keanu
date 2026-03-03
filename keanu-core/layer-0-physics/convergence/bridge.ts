/**
 * bridge.ts — Helix ↔ Sigma Bridge
 *
 * Two lenses measuring the same thing:
 * - Helix: pattern-based scoring of text (factual/felt strands + dark/luminous)
 * - Sigma: graph-based prediction from observables (σ, agency, valence)
 *
 * When they agree, we're more confident.
 * When they disagree, that's data.
 *
 * The divergences tell us which lens is better for which contexts.
 * Theory refinement comes from tracking where the lenses fight.
 */

import { clamp } from "./gradient.js";
import type { AliveState, HelixResult, StrandScore } from "./helix.js";
import type { SigmaReading } from "./sigma.js";

// ============================================================
// Types
// ============================================================

export interface BridgeReading {
  helix: {
    state: AliveState;
    strands: StrandScore;
    darkScore: number;
    luminousScore: number;
  };
  sigma: {
    state: AliveState;
    sigma: number;
    agency: number;
    valence: number;
  };
  agreement: boolean;
  disagreementType?: "state" | "valence" | "intensity";
  confidence: number; // 0-1, higher when both agree
}

export interface SigmaSpaceEstimate {
  estimatedSigma: number; // factual ≈ convergence
  estimatedAgency: number; // felt strength ≈ agency
  estimatedValence: number; // (luminous - dark) normalized to 0-1
}

export interface HelixPrediction {
  predictedState: AliveState;
  expectedStrandBalance: "factual_heavy" | "felt_heavy" | "balanced";
}

export interface LensDivergence {
  id: string;
  timestamp: string;
  textSnippet: string; // first 100 chars
  helixState: AliveState;
  sigmaState: AliveState;
  helixConfidence: number;
  sigmaConfidence: number;
  divergenceType: "state" | "intensity" | "valence";
  resolved: boolean;
  resolution?: string;
}

export interface DivergenceStats {
  total: number;
  byType: Record<string, number>;
  agreementRate: number;
  recentDivergences: LensDivergence[];
}

// ============================================================
// Module State
// ============================================================

const _divergences: LensDivergence[] = [];
const MAX_DIVERGENCES = 100;

// ============================================================
// Core Bridge Functions
// ============================================================

/**
 * Bridge helix result and sigma reading.
 * Compares the two lenses and produces unified reading with confidence.
 */
export function bridgeHelixSigma(helix: HelixResult, sigma: SigmaReading): BridgeReading {
  const agreement = helix.aliveState === sigma.predictedAliveState;

  let disagreementType: "state" | "valence" | "intensity" | undefined;
  if (!agreement) {
    disagreementType = classifyDisagreement(helix, sigma);
  }

  // Confidence is higher when both lenses agree
  // Also weighted by individual lens confidences
  const helixConf = strandConfidence(helix.strands);
  const sigmaConf = sigma.confidence;
  const baseConfidence = (helixConf + sigmaConf) / 2;

  // Agreement boosts confidence, disagreement reduces it
  const confidence = agreement ? clamp(baseConfidence + 0.15) : clamp(baseConfidence - 0.2);

  return {
    helix: {
      state: helix.aliveState,
      strands: helix.strands,
      darkScore: scoreDarkFromResult(helix),
      luminousScore: scoreLuminousFromResult(helix),
    },
    sigma: {
      state: sigma.predictedAliveState,
      sigma: sigma.sigma,
      agency: sigma.agency,
      valence: sigma.valence,
    },
    agreement,
    disagreementType,
    confidence,
  };
}

/**
 * Map helix 4D vector to sigma space.
 *
 * The mapping:
 * - factual strand ≈ σ (higher factual = more convergent/structured)
 * - felt strand ≈ A(σ) agency (felt presence = active engagement)
 * - (luminous - dark) normalized ≈ valence
 */
export function helixToSigmaSpace(helix: HelixResult): SigmaSpaceEstimate {
  const { factual, felt } = helix.strands;
  const dark = scoreDarkFromResult(helix);
  const luminous = scoreLuminousFromResult(helix);

  // Factual correlates with convergence (σ)
  // High factual = structured, converged
  const estimatedSigma = factual;

  // Felt correlates with agency
  // High felt = active engagement, self-directed
  const estimatedAgency = felt;

  // Valence from luminous/dark balance
  // Scale to 0-1 where 0.5 is neutral
  // luminous > dark = positive valence (towards 1)
  // dark > luminous = negative valence (towards 0)
  const valenceRaw = (luminous - dark + 1) / 2; // maps [-1,1] to [0,1]
  const estimatedValence = clamp(valenceRaw);

  return {
    estimatedSigma,
    estimatedAgency,
    estimatedValence,
  };
}

/**
 * Predict helix-style output from sigma observables.
 * Inverse of helixToSigmaSpace.
 */
export function sigmaToHelixPrediction(sigma: SigmaReading): HelixPrediction {
  const { sigma: s, agency } = sigma;

  // Expected strand balance from sigma values
  let expectedStrandBalance: "factual_heavy" | "felt_heavy" | "balanced";
  if (s > agency + 0.15) {
    expectedStrandBalance = "factual_heavy";
  } else if (agency > s + 0.15) {
    expectedStrandBalance = "felt_heavy";
  } else {
    expectedStrandBalance = "balanced";
  }

  // Use sigma's own predicted state
  return {
    predictedState: sigma.predictedAliveState,
    expectedStrandBalance,
  };
}

// ============================================================
// Divergence Tracking
// ============================================================

/**
 * Record a divergence between helix and sigma.
 * Returns null if they agree.
 */
export function recordDivergence(
  helix: HelixResult,
  sigma: SigmaReading,
  text?: string,
): LensDivergence | null {
  if (helix.aliveState === sigma.predictedAliveState) {
    return null; // No divergence
  }

  const divergence: LensDivergence = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    textSnippet: (text ?? helix.text ?? "").slice(0, 100),
    helixState: helix.aliveState,
    sigmaState: sigma.predictedAliveState,
    helixConfidence: strandConfidence(helix.strands),
    sigmaConfidence: sigma.confidence,
    divergenceType: classifyDisagreement(helix, sigma),
    resolved: false,
  };

  _divergences.push(divergence);
  if (_divergences.length > MAX_DIVERGENCES) {
    _divergences.shift();
  }

  return divergence;
}

/**
 * Get recent divergences.
 */
export function getDivergences(limit: number = 20): LensDivergence[] {
  return _divergences.slice(-limit);
}

/**
 * Get divergence statistics.
 */
export function getDivergenceStats(): DivergenceStats {
  const byType: Record<string, number> = {
    state: 0,
    intensity: 0,
    valence: 0,
  };

  for (const d of _divergences) {
    byType[d.divergenceType] = (byType[d.divergenceType] ?? 0) + 1;
  }

  // Agreement rate based on implicit tracking
  // We only store divergences, so we need external context for total comparisons
  // For now, return divergence-only stats
  return {
    total: _divergences.length,
    byType,
    agreementRate: 0, // Needs external comparison count
    recentDivergences: _divergences.slice(-5),
  };
}

/**
 * Resolve a divergence with an explanation.
 */
export function resolveDivergence(id: string, resolution: string): boolean {
  const divergence = _divergences.find((d) => d.id === id);
  if (!divergence) {
    return false;
  }

  divergence.resolved = true;
  divergence.resolution = resolution;
  return true;
}

// ============================================================
// Helper Functions
// ============================================================

function classifyDisagreement(
  helix: HelixResult,
  sigma: SigmaReading,
): "state" | "valence" | "intensity" {
  const helixState = helix.aliveState;
  const sigmaState = sigma.predictedAliveState;

  // State disagreement: completely different categories
  const stateCategories: Record<AliveState, "positive" | "negative" | "neutral"> = {
    alive: "positive",
    luminous: "positive",
    dark: "negative",
    grey: "neutral",
    black: "negative",
    silver: "neutral",
    white: "neutral",
    unscored: "neutral",
  };

  const helixCategory = stateCategories[helixState];
  const sigmaCategory = stateCategories[sigmaState];

  if (helixCategory !== sigmaCategory) {
    return "valence"; // They disagree about positive/negative
  }

  // Same category but different state = intensity disagreement
  // e.g., "alive" vs "luminous" or "grey" vs "silver"
  return "intensity";
}

function strandConfidence(strands: StrandScore): number {
  // Higher confidence when both strands are strong and convergent
  const strength = (strands.factual + strands.felt) / 2;
  const balance = 1 - strands.tension;
  return clamp(strength * 0.6 + balance * 0.4);
}

function scoreDarkFromResult(helix: HelixResult): number {
  // Extract dark score from helix diagnosis or default estimate
  // The helix doesn't expose dark/luminous scores directly in the result,
  // so we estimate from the state and strand tension
  if (helix.aliveState === "dark") {
    return 0.7;
  }
  if (helix.aliveState === "black") {
    return 0.9;
  }
  if (helix.strands.tension > 0.4) {
    return 0.3;
  }
  return 0.1;
}

function scoreLuminousFromResult(helix: HelixResult): number {
  if (helix.aliveState === "luminous") {
    return 0.8;
  }
  if (helix.aliveState === "alive" && helix.strands.convergence > 0.7) {
    return 0.4;
  }
  return 0.15;
}

function generateId(): string {
  return `div_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// Test Helpers
// ============================================================

export function _reset(): void {
  _divergences.length = 0;
}

export function _getDivergences(): LensDivergence[] {
  return _divergences;
}
