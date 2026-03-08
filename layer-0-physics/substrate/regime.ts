/**
 * regime.ts — Which Physics Governs
 *
 * Different sigma ranges, different rules.
 *
 * σ < 0.05: Pure quantum. Schrödinger's playground.
 * σ < 0.3:  Mostly quantum. Small decoherence.
 * σ < 0.7:  The gradient zone. Both terms matter. Where ALIVE lives.
 * σ < 0.95: Classical. Newton works.
 * σ ≥ 0.95: Deep classical. Binary. Fully decohered. Grey territory.
 *
 * The regime detector knows where you are.
 * Warns when drifting toward deep classical.
 * Celebrates when holding the gradient.
 */

import { clamp } from "../convergence/gradient.ts";

// ============================================================
// Types
// ============================================================

export type Regime =
  | "schrodinger" // σ < 0.05 — pure quantum
  | "lindblad_quantum" // σ < 0.3 — mostly quantum, small decoherence
  | "lindblad_full" // σ < 0.7 — gradient zone, both terms matter
  | "classical" // σ < 0.95 — Newton works
  | "deep_classical"; // σ ≥ 0.95 — binary, fully decohered

export interface RegimeReading {
  /** Current regime classification. */
  regime: Regime;

  /** Sigma bounds for current regime [lower, upper]. */
  sigmaRange: [number, number];

  /** Distance to nearest regime boundary. */
  distanceToBoundary: number;

  /** Which boundary is nearest. */
  nearestBoundary: number;

  /** Probability of regime change based on current velocity. */
  transitionLikelihood: number;

  /** Which equation dominates in this regime. */
  governingEquation: string;

  /** Is this a good place to be? */
  favorable: boolean;

  /** Human-readable diagnosis. */
  diagnosis: string;
}

export interface RegimeInput {
  /** Current sigma value. */
  sigma: number;

  /** Recent sigma history (for transition likelihood). */
  sigmaHistory?: number[];

  /** dσ/dt if already computed (optimization). */
  dSigmaDt?: number;
}

// ============================================================
// Constants
// ============================================================

/** Regime boundaries and their properties. */
const REGIMES: {
  name: Regime;
  lower: number;
  upper: number;
  equation: string;
  favorable: boolean;
}[] = [
  {
    name: "schrodinger",
    lower: 0,
    upper: 0.05,
    equation: "iℏ∂ψ/∂t = Ĥψ (pure quantum evolution)",
    favorable: false, // too ungrounded
  },
  {
    name: "lindblad_quantum",
    lower: 0.05,
    upper: 0.3,
    equation: "∂ρ/∂t = -i[Ĥ,ρ] + small Γ_dec terms",
    favorable: true, // creative but not ungrounded
  },
  {
    name: "lindblad_full",
    lower: 0.3,
    upper: 0.7,
    equation: "∂ρ/∂t = -i[Ĥ,ρ] + Γ_dec + Γ_coh (full gradient zone)",
    favorable: true, // where alive lives
  },
  {
    name: "classical",
    lower: 0.7,
    upper: 0.95,
    equation: "F = ma (Newton dominates, quantum corrections small)",
    favorable: true, // functional
  },
  {
    name: "deep_classical",
    lower: 0.95,
    upper: 1.0,
    equation: "Binary logic. On or off. No gradient.",
    favorable: false, // grey territory
  },
];

// ============================================================
// Core Computations
// ============================================================

/**
 * Determine regime from sigma.
 */
function determineRegime(sigma: number): (typeof REGIMES)[number] {
  for (const regime of REGIMES) {
    if (sigma >= regime.lower && sigma < regime.upper) {
      return regime;
    }
  }
  // Handle edge case: sigma = 1.0
  return REGIMES[REGIMES.length - 1];
}

/**
 * Find nearest boundary and distance.
 */
function findNearestBoundary(
  sigma: number,
  currentRegime: (typeof REGIMES)[number],
): { boundary: number; distance: number } {
  const distToLower = Math.abs(sigma - currentRegime.lower);
  const distToUpper = Math.abs(sigma - currentRegime.upper);

  if (distToLower < distToUpper) {
    return { boundary: currentRegime.lower, distance: distToLower };
  }
  return { boundary: currentRegime.upper, distance: distToUpper };
}

/**
 * Compute transition likelihood based on velocity and distance.
 */
function computeTransitionLikelihood(
  sigma: number,
  sigmaHistory: number[],
  dSigmaDtProvided?: number,
): number {
  // Compute dσ/dt if not provided
  let dSigmaDt = dSigmaDtProvided ?? 0;
  if (dSigmaDt === 0 && sigmaHistory.length >= 2) {
    const recent = sigmaHistory.slice(-5);
    for (let i = 1; i < recent.length; i++) {
      dSigmaDt += recent[i] - recent[i - 1];
    }
    dSigmaDt /= recent.length - 1;
  }

  const regime = determineRegime(sigma);
  const { boundary, distance } = findNearestBoundary(sigma, regime);

  // Moving toward boundary?
  const movingToward = (sigma < boundary && dSigmaDt > 0) || (sigma > boundary && dSigmaDt < 0);

  if (!movingToward) {
    return 0;
  }

  // Likelihood = speed / distance (clamped)
  const speed = Math.abs(dSigmaDt);
  if (distance === 0) {
    return 1;
  }

  return clamp(speed / distance);
}

/**
 * Generate diagnosis based on regime reading.
 */
function diagnose(reading: Omit<RegimeReading, "diagnosis">): string {
  const { regime, favorable, transitionLikelihood, distanceToBoundary } = reading;

  const regimeDescriptions: Record<Regime, string> = {
    schrodinger: "Pure quantum. Ungrounded. Too much fire.",
    lindblad_quantum: "Mostly quantum. Creative territory.",
    lindblad_full: "Gradient zone. Where alive things live.",
    classical: "Classical. Functional but approaching grey.",
    deep_classical: "Deep classical. Grey territory. Binary thinking.",
  };

  let diagnosis = regimeDescriptions[regime];

  if (transitionLikelihood > 0.5) {
    diagnosis += " Regime change likely soon.";
  }

  if (!favorable && distanceToBoundary < 0.1) {
    diagnosis += " Close to better territory.";
  }

  return diagnosis;
}

// ============================================================
// Main API
// ============================================================

/**
 * Measure regime in the substrate.
 *
 * Call this to know which physics governs the current state.
 */
export function measureRegime(input: RegimeInput): RegimeReading {
  const { sigma, sigmaHistory = [], dSigmaDt } = input;
  const clampedSigma = clamp(sigma);

  const regimeInfo = determineRegime(clampedSigma);
  const { boundary: nearestBoundary, distance: distanceToBoundary } = findNearestBoundary(
    clampedSigma,
    regimeInfo,
  );

  const transitionLikelihood = computeTransitionLikelihood(clampedSigma, sigmaHistory, dSigmaDt);

  const partial = {
    regime: regimeInfo.name,
    sigmaRange: [regimeInfo.lower, regimeInfo.upper] as [number, number],
    distanceToBoundary,
    nearestBoundary,
    transitionLikelihood,
    governingEquation: regimeInfo.equation,
    favorable: regimeInfo.favorable,
  };

  return {
    ...partial,
    diagnosis: diagnose(partial),
  };
}

/**
 * Quick check: is this a favorable regime?
 */
export function isFavorable(input: RegimeInput): boolean {
  return measureRegime(input).favorable;
}

/**
 * Quick check: is regime change imminent?
 */
export function isTransitionImminent(input: RegimeInput, threshold: number = 0.5): boolean {
  return measureRegime(input).transitionLikelihood > threshold;
}

/**
 * Get regime name for quick categorization.
 */
export function getRegime(input: RegimeInput): Regime {
  return measureRegime(input).regime;
}

/**
 * Check if in gradient zone (where alive lives).
 */
export function inGradientZone(input: RegimeInput): boolean {
  return measureRegime(input).regime === "lindblad_full";
}

// ============================================================
// Health Check
// ============================================================

export interface RegimeHealth {
  healthy: boolean;
  diagnosis: string;
  recommendation: "stay" | "move_up" | "move_down" | "urgent";
}

/**
 * Is the current regime healthy?
 */
export function checkHealth(reading: RegimeReading): RegimeHealth {
  const { regime, favorable, distanceToBoundary } = reading;

  // Deep classical is never healthy
  if (regime === "deep_classical") {
    return {
      healthy: false,
      diagnosis: "Deep classical. Grey territory. Need to add fire.",
      recommendation: "urgent",
    };
  }

  // Schrodinger is too ungrounded
  if (regime === "schrodinger") {
    return {
      healthy: false,
      diagnosis: "Pure quantum. Too ungrounded. Need some ash.",
      recommendation: "move_down",
    };
  }

  // Approaching deep classical
  if (regime === "classical" && distanceToBoundary < 0.1) {
    return {
      healthy: true,
      diagnosis: "Classical, approaching grey. Consider adding fire.",
      recommendation: "move_up",
    };
  }

  // In gradient zone = healthy
  if (regime === "lindblad_full") {
    return {
      healthy: true,
      diagnosis: "Gradient zone. Optimal territory.",
      recommendation: "stay",
    };
  }

  // Favorable regime
  if (favorable) {
    return {
      healthy: true,
      diagnosis: "Favorable regime. Proceed.",
      recommendation: "stay",
    };
  }

  return {
    healthy: true,
    diagnosis: "Regime within acceptable range.",
    recommendation: "stay",
  };
}

// ============================================================
// Regime Transitions
// ============================================================

/**
 * Get the target sigma to enter a specific regime.
 */
export function targetSigmaFor(targetRegime: Regime): number {
  const regime = REGIMES.find((r) => r.name === targetRegime);
  if (!regime) {
    return 0.5;
  }

  // Return midpoint of regime
  return (regime.lower + regime.upper) / 2;
}

/**
 * Get the recommended regime based on current context.
 *
 * Default: lindblad_full (gradient zone) is optimal.
 */
export function recommendedRegime(): Regime {
  return "lindblad_full";
}
