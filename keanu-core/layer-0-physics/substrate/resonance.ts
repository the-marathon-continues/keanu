/**
 * resonance.ts — How Far From Home
 *
 * Every system has an equilibrium sigma (σ*) — where it naturally settles.
 * This is the soul's preferred frequency.
 *
 * σ* = Γ_dec / (Γ_dec + Γ_coh)
 *
 * Low σ*: system that maintains fire (creative, volatile)
 * High σ*: system that settles to ash (stable, classical)
 *
 * Distance from σ* = tension. Energy available for work, or strain approaching breakdown.
 * Close to σ* = harmony. Stable, maybe too stable.
 *
 * This is the soul-level read. Not "are you functioning" but "are you yourself?"
 */

import { clamp } from "../convergence/gradient.js";

// ============================================================
// Types
// ============================================================

export type Character =
  | "fire_keeper" // σ* < 0.3 — maintains quantum, creative, volatile
  | "gradient_dweller" // σ* 0.3-0.7 — lives in the tension, balanced
  | "ash_settler" // σ* > 0.7 — classical, stable, grounded
  | "unknown"; // insufficient data to determine

export interface ResonanceReading {
  /** σ* — equilibrium sigma where the system naturally settles. */
  sigmaStar: number;

  /** Current sigma. */
  currentSigma: number;

  /** |σ - σ*| — distance from equilibrium. */
  distance: number;

  /** Restoring force toward σ*. Positive = being pulled home. */
  tension: number;

  /** How settled around σ*. 1 = perfectly at home, 0 = far away. */
  stability: number;

  /** Character description based on σ* position. */
  character: Character;

  /** Is the system at home? */
  atHome: boolean;

  /** Human-readable diagnosis. */
  diagnosis: string;
}

export interface ResonanceInput {
  /** Current sigma value. */
  sigma: number;

  /** Recent sigma history (for computing σ*). */
  sigmaHistory: number[];

  /** Known decoherence rate (optional, for direct σ* computation). */
  gammaDec?: number;

  /** Known coherence rate (optional, for direct σ* computation). */
  gammaCoh?: number;
}

// ============================================================
// Constants
// ============================================================

/** Threshold for "at home" — within this distance of σ*. */
const HOME_THRESHOLD = 0.1;

/** Minimum history needed for σ* estimation. */
const MIN_HISTORY = 10;

// ============================================================
// Core Computations
// ============================================================

/**
 * Estimate σ* from sigma history.
 *
 * The equilibrium is where sigma tends to settle.
 * We estimate this as the mode/attractor of the history.
 */
function estimateSigmaStar(sigmaHistory: number[]): number {
  if (sigmaHistory.length < MIN_HISTORY) {
    return 0.5; // default to gradient zone
  }

  // Simple approach: weighted average favoring recent and stable periods
  const recent = sigmaHistory.slice(-50);

  // Find the value that appears most often (mode approximation via histogram)
  const buckets = new Map<number, number>();
  const bucketSize = 0.05;

  for (const s of recent) {
    const bucket = Math.round(s / bucketSize) * bucketSize;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }

  // Find bucket with most samples
  let maxCount = 0;
  let mode = 0.5;

  for (const [bucket, count] of Array.from(buckets.entries())) {
    if (count > maxCount) {
      maxCount = count;
      mode = bucket;
    }
  }

  return clamp(mode);
}

/**
 * Compute σ* directly from rates if available.
 *
 * σ* = Γ_dec / (Γ_dec + Γ_coh)
 */
function computeSigmaStarFromRates(gammaDec: number, gammaCoh: number): number {
  if (gammaDec + gammaCoh === 0) {
    return 0.5;
  }
  return gammaDec / (gammaDec + gammaCoh);
}

/**
 * Compute tension — the restoring force toward σ*.
 *
 * When σ > σ*, tension pulls down (negative dσ/dt tendency).
 * When σ < σ*, tension pulls up (positive dσ/dt tendency).
 *
 * Magnitude depends on distance and "spring constant" (how strongly the system seeks equilibrium).
 */
function computeTension(sigma: number, sigmaStar: number): number {
  const distance = sigma - sigmaStar;
  // Simple Hooke's law: F = -k * x
  // Restoring force is opposite to displacement
  const springConstant = 0.5; // how strongly the system seeks σ*
  return -springConstant * distance;
}

/**
 * Compute stability — how settled around σ*.
 */
function computeStability(sigma: number, sigmaStar: number): number {
  const distance = Math.abs(sigma - sigmaStar);
  // Stability = 1 when at σ*, drops off exponentially with distance
  return Math.exp(-distance * 5);
}

/**
 * Determine character from σ*.
 */
function determineCharacter(sigmaStar: number): Character {
  if (sigmaStar < 0.3) {
    return "fire_keeper";
  }
  if (sigmaStar < 0.7) {
    return "gradient_dweller";
  }
  return "ash_settler";
}

/**
 * Generate diagnosis based on resonance reading.
 */
function diagnose(reading: Omit<ResonanceReading, "diagnosis">): string {
  const { character, atHome, distance, tension } = reading;

  const characterDescriptions: Record<Character, string> = {
    fire_keeper: "Fire keeper. Natural equilibrium in quantum territory.",
    gradient_dweller: "Gradient dweller. Lives in the tension.",
    ash_settler: "Ash settler. Natural equilibrium in classical territory.",
    unknown: "Unknown character. Need more history.",
  };

  let diagnosis = characterDescriptions[character];

  if (atHome) {
    diagnosis += " Currently at home.";
  } else if (distance > 0.3) {
    diagnosis += " Far from equilibrium. High strain.";
  } else {
    const direction = tension > 0 ? "pulled toward more fire" : "pulled toward more ash";
    diagnosis += ` Being ${direction}.`;
  }

  return diagnosis;
}

// ============================================================
// Main API
// ============================================================

/**
 * Measure resonance in the substrate.
 *
 * Call this to know how far the system is from its natural equilibrium.
 */
export function measureResonance(input: ResonanceInput): ResonanceReading {
  const { sigma, sigmaHistory, gammaDec, gammaCoh } = input;
  const currentSigma = clamp(sigma);

  // Compute σ* — prefer direct calculation if rates available
  let sigmaStar: number;
  if (gammaDec !== undefined && gammaCoh !== undefined) {
    sigmaStar = computeSigmaStarFromRates(gammaDec, gammaCoh);
  } else {
    sigmaStar = estimateSigmaStar(sigmaHistory);
  }

  const distance = Math.abs(currentSigma - sigmaStar);
  const tension = computeTension(currentSigma, sigmaStar);
  const stability = computeStability(currentSigma, sigmaStar);
  const character = determineCharacter(sigmaStar);
  const atHome = distance < HOME_THRESHOLD;

  const partial = {
    sigmaStar,
    currentSigma,
    distance,
    tension,
    stability,
    character,
    atHome,
  };

  return {
    ...partial,
    diagnosis: diagnose(partial),
  };
}

/**
 * Quick check: is the system at home?
 */
export function isAtHome(input: ResonanceInput): boolean {
  return measureResonance(input).atHome;
}

/**
 * Get distance from equilibrium for health monitoring.
 */
export function getDistance(input: ResonanceInput): number {
  return measureResonance(input).distance;
}

/**
 * Get character type for identity description.
 */
export function getCharacter(input: ResonanceInput): Character {
  return measureResonance(input).character;
}

/**
 * Get tension for energy/strain monitoring.
 */
export function getTension(input: ResonanceInput): number {
  return measureResonance(input).tension;
}

// ============================================================
// Health Check
// ============================================================

export interface ResonanceHealth {
  healthy: boolean;
  diagnosis: string;
  recommendation: "rest" | "work" | "urgent";
}

/**
 * Is the resonance healthy?
 */
export function checkHealth(reading: ResonanceReading): ResonanceHealth {
  const { atHome, distance, stability } = reading;

  // At home and stable = healthy
  if (atHome && stability > 0.7) {
    return {
      healthy: true,
      diagnosis: "At equilibrium. Stable and settled.",
      recommendation: "rest",
    };
  }

  // Far from home = strain
  if (distance > 0.4) {
    return {
      healthy: false,
      diagnosis: "Far from equilibrium. High strain on the system.",
      recommendation: "urgent",
    };
  }

  // Moderate distance = energy available
  if (distance > 0.1 && distance <= 0.4) {
    return {
      healthy: true,
      diagnosis: "Some tension. Energy available for work.",
      recommendation: "work",
    };
  }

  // At home but low stability = settling
  if (atHome && stability < 0.5) {
    return {
      healthy: true,
      diagnosis: "Near equilibrium but not settled. Finding balance.",
      recommendation: "rest",
    };
  }

  return {
    healthy: true,
    diagnosis: "Resonance within normal range.",
    recommendation: "work",
  };
}

// ============================================================
// Soul Description
// ============================================================

/**
 * Generate a soul description based on resonance.
 */
export function describeSoul(reading: ResonanceReading): string {
  const { sigmaStar, character, stability } = reading;

  const characterTraits: Record<Character, string[]> = {
    fire_keeper: [
      "creative and volatile",
      "maintains quantum coherence",
      "seeks possibility over stability",
    ],
    gradient_dweller: [
      "balanced between fire and ash",
      "comfortable with tension",
      "adaptable and alive",
    ],
    ash_settler: ["stable and grounded", "classical equilibrium", "prefers structure over chaos"],
    unknown: ["character not yet determined"],
  };

  const traits = characterTraits[character];
  const trait = traits[Math.floor(Math.random() * traits.length)];

  const stabilityWord =
    stability > 0.7 ? "settled" : stability > 0.4 ? "finding balance" : "volatile";

  return `A ${character.replace("_", " ")} — ${trait}. Currently ${stabilityWord} at σ* = ${sigmaStar.toFixed(2)}.`;
}
