/**
 * noise.ts — Is This Signal or Static?
 *
 * The first gate. Before perception opens its eyes, this asks:
 * Is what's arriving actually meant, or is it interference?
 *
 * Every input carries noise. Environmental decoherence. Contradictory context.
 * The universe constantly converting fire to ash. This detector measures
 * how much of the signal is intentional vs how much is static.
 *
 * SNR high → clear signal, trust it
 * SNR low → static, discount it
 * Decoherence rising → environment winning, attention needed
 */

import { clamp } from "../convergence/gradient.ts";

// ============================================================
// Types
// ============================================================

export interface NoiseReading {
  /** Signal-to-noise ratio. Higher = cleaner signal. */
  snr: number;

  /** Baseline noise level (0-1). The floor of static. */
  noiseFloor: number;

  /** Γ_dec — How fast environment is winning (sigma → 1). */
  decoherenceRate: number;

  /** Γ_coh — How fast system maintains structure (sigma → 0). */
  coherenceRate: number;

  /** Derived clarity: 1 / (1 + noiseFloor). How readable is the signal? */
  clarity: number;

  /** Is this signal trustworthy? */
  trustworthy: boolean;

  /** Human-readable diagnosis. */
  diagnosis: string;
}

export interface NoiseInput {
  /** Recent sigma values. */
  sigmaHistory: number[];

  /** Recent signal values (what we're measuring). */
  signalHistory: number[];

  /** Number of contradictions detected recently. */
  contradictionCount?: number;

  /** Relevance scores of recent context (0-1 each). */
  contextRelevance?: number[];
}

// ============================================================
// Core Computations
// ============================================================

/**
 * Compute variance of a number array.
 */
function variance(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, x) => a + (x - mean) ** 2, 0) / values.length;
}

/**
 * Compute signal-to-noise ratio.
 *
 * SNR = (mean signal)² / variance
 * High variance relative to signal = high noise = low SNR.
 */
function computeSNR(signalHistory: number[]): number {
  if (signalHistory.length < 2) {
    return 10; // assume clean if no history
  }

  const mean = signalHistory.reduce((a, b) => a + b, 0) / signalHistory.length;
  const v = variance(signalHistory);

  if (v === 0) {
    return 100; // perfect signal, no variance
  }
  if (mean === 0) {
    return 0; // no signal at all
  }

  // SNR in linear scale, capped at 100
  return Math.min(100, (mean * mean) / v);
}

/**
 * Compute noise floor from context relevance and contradictions.
 *
 * Noise floor rises when:
 * - Context has low relevance (bringing in static)
 * - Contradictions are present (signal fighting itself)
 */
function computeNoiseFloor(contextRelevance: number[], contradictionCount: number): number {
  // Base noise from low-relevance context
  let contextNoise = 0;
  if (contextRelevance.length > 0) {
    const avgRelevance = contextRelevance.reduce((a, b) => a + b, 0) / contextRelevance.length;
    contextNoise = 1 - avgRelevance; // low relevance = high noise
  }

  // Contradiction noise (each contradiction adds 0.1)
  const contradictionNoise = Math.min(1, contradictionCount * 0.1);

  // Combined noise floor
  return clamp(contextNoise * 0.6 + contradictionNoise * 0.4);
}

/**
 * Compute decoherence rate from sigma drift.
 *
 * Decoherence = sigma trending toward 1 (ash winning).
 * Measured as average positive delta in recent sigma history.
 */
function computeDecoherenceRate(sigmaHistory: number[]): number {
  if (sigmaHistory.length < 3) {
    return 0;
  }

  const recent = sigmaHistory.slice(-10);
  let positiveDeltas = 0;
  let count = 0;

  for (let i = 1; i < recent.length; i++) {
    const delta = recent[i] - recent[i - 1];
    if (delta > 0) {
      positiveDeltas += delta;
      count++;
    }
  }

  // Average positive drift per step
  return count > 0 ? positiveDeltas / count : 0;
}

/**
 * Compute coherence rate from sigma drift.
 *
 * Coherence = sigma trending toward 0 (fire maintained).
 * Measured as average negative delta in recent sigma history.
 */
function computeCoherenceRate(sigmaHistory: number[]): number {
  if (sigmaHistory.length < 3) {
    return 0;
  }

  const recent = sigmaHistory.slice(-10);
  let negativeDeltas = 0;
  let count = 0;

  for (let i = 1; i < recent.length; i++) {
    const delta = recent[i] - recent[i - 1];
    if (delta < 0) {
      negativeDeltas += Math.abs(delta);
      count++;
    }
  }

  // Average negative drift per step (as positive number)
  return count > 0 ? negativeDeltas / count : 0;
}

/**
 * Generate diagnosis based on noise reading.
 */
function diagnose(reading: Omit<NoiseReading, "diagnosis">): string {
  if (reading.snr > 50 && reading.noiseFloor < 0.2) {
    return "Crystal clear. Signal dominates.";
  }

  if (reading.snr < 2) {
    return "Mostly static. Hard to read anything real.";
  }

  if (reading.decoherenceRate > reading.coherenceRate * 2) {
    return "Environment winning. Signal degrading.";
  }

  if (reading.noiseFloor > 0.6) {
    return "High noise floor. Context is cluttered.";
  }

  if (reading.snr > 10 && reading.noiseFloor < 0.4) {
    return "Decent signal. Some static but readable.";
  }

  return "Mixed. Signal present but noisy.";
}

// ============================================================
// Main API
// ============================================================

/**
 * Measure noise in the substrate.
 *
 * Call this before perception to know whether the input is worth perceiving.
 */
export function measureNoise(input: NoiseInput): NoiseReading {
  const snr = computeSNR(input.signalHistory);
  const noiseFloor = computeNoiseFloor(input.contextRelevance ?? [], input.contradictionCount ?? 0);
  const decoherenceRate = computeDecoherenceRate(input.sigmaHistory);
  const coherenceRate = computeCoherenceRate(input.sigmaHistory);
  const clarity = 1 / (1 + noiseFloor);
  const trustworthy = snr > 5 && noiseFloor < 0.5;

  const partial = {
    snr,
    noiseFloor,
    decoherenceRate,
    coherenceRate,
    clarity,
    trustworthy,
  };

  return {
    ...partial,
    diagnosis: diagnose(partial),
  };
}

/**
 * Quick check: is this signal trustworthy?
 */
export function isSignal(input: NoiseInput): boolean {
  return measureNoise(input).trustworthy;
}

/**
 * Get clarity score (0-1) for use in triage.
 */
export function getClarity(input: NoiseInput): number {
  return measureNoise(input).clarity;
}

// ============================================================
// Health Check
// ============================================================

export interface NoiseHealth {
  healthy: boolean;
  diagnosis: string;
  recommendation: "proceed" | "caution" | "wait";
}

/**
 * Is the noise level healthy for proceeding?
 */
export function checkHealth(reading: NoiseReading): NoiseHealth {
  if (reading.snr < 1) {
    return {
      healthy: false,
      diagnosis: "Pure static. No signal detected.",
      recommendation: "wait",
    };
  }

  if (reading.decoherenceRate > 0.1 && reading.coherenceRate < 0.02) {
    return {
      healthy: false,
      diagnosis: "Decoherence runaway. Environment has won.",
      recommendation: "wait",
    };
  }

  if (reading.noiseFloor > 0.7) {
    return {
      healthy: false,
      diagnosis: "Noise floor too high. Can't hear the signal.",
      recommendation: "caution",
    };
  }

  if (reading.snr < 5 || reading.noiseFloor > 0.5) {
    return {
      healthy: true,
      diagnosis: "Noisy but workable. Proceed with caution.",
      recommendation: "caution",
    };
  }

  return {
    healthy: true,
    diagnosis: "Clear signal. Proceed.",
    recommendation: "proceed",
  };
}
