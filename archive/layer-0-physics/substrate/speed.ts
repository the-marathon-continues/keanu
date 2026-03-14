/**
 * speed.ts — How Fast Fire Becomes Ash
 *
 * dσ/dt. The derivative. Not where you are but how fast you're moving.
 *
 * Fast convergence toward ash = crisis brewing. Something's collapsing.
 * Fast divergence toward fire = explosion of possibility. Creation or chaos.
 * Stable = holding the gradient zone. Where alive things live.
 *
 * Speed × proximity to boundary = urgency.
 * This is the speedometer that triggers deliberate thought.
 */

import { clamp } from "../convergence/gradient.ts";

// ============================================================
// Types
// ============================================================

export type Direction = "converging" | "diverging" | "stable";

export interface SpeedReading {
  /** dσ/dt — rate of sigma change. Positive = toward ash, negative = toward fire. */
  dSigmaDt: number;

  /** Which way: converging (→ash), diverging (→fire), or stable. */
  direction: Direction;

  /** d²σ/dt² — is the change speeding up or slowing down? */
  acceleration: number;

  /** How fast approaching nearest regime boundary. */
  regimeVelocity: number;

  /** Derived urgency: |dSigmaDt| × proximity to boundary. */
  urgency: number;

  /** Current sigma (for context). */
  currentSigma: number;

  /** Nearest regime boundary. */
  nearestBoundary: number;

  /** Human-readable diagnosis. */
  diagnosis: string;
}

export interface SpeedInput {
  /** Recent sigma values (at least 3 for meaningful measurement). */
  sigmaHistory: number[];

  /** Time delta between measurements (defaults to 1). */
  dt?: number;
}

// ============================================================
// Constants
// ============================================================

/** Regime boundaries from physics engine. */
const REGIME_BOUNDARIES = [0.05, 0.3, 0.7, 0.95];

/** Threshold for "stable" — below this dσ/dt is considered not moving. */
const STABILITY_THRESHOLD = 0.01;

/** Threshold for "fast" — above this triggers urgency. */
const FAST_THRESHOLD = 0.05;

// ============================================================
// Core Computations
// ============================================================

/**
 * Compute dσ/dt — first derivative of sigma.
 *
 * Uses simple finite difference on recent history.
 */
function computeDSigmaDt(sigmaHistory: number[], dt: number): number {
  if (sigmaHistory.length < 2) {
    return 0;
  }

  const recent = sigmaHistory.slice(-5);
  let totalDelta = 0;

  for (let i = 1; i < recent.length; i++) {
    totalDelta += recent[i] - recent[i - 1];
  }

  // Average rate of change
  return totalDelta / ((recent.length - 1) * dt);
}

/**
 * Compute d²σ/dt² — second derivative (acceleration).
 *
 * Is the rate of change itself changing?
 */
function computeAcceleration(sigmaHistory: number[], dt: number): number {
  if (sigmaHistory.length < 4) {
    return 0;
  }

  const recent = sigmaHistory.slice(-6);
  const velocities: number[] = [];

  for (let i = 1; i < recent.length; i++) {
    velocities.push((recent[i] - recent[i - 1]) / dt);
  }

  // Rate of change of velocity
  let totalAccel = 0;
  for (let i = 1; i < velocities.length; i++) {
    totalAccel += velocities[i] - velocities[i - 1];
  }

  return totalAccel / ((velocities.length - 1) * dt);
}

/**
 * Determine direction from dσ/dt.
 */
function determineDirection(dSigmaDt: number): Direction {
  if (Math.abs(dSigmaDt) < STABILITY_THRESHOLD) {
    return "stable";
  }
  return dSigmaDt > 0 ? "converging" : "diverging";
}

/**
 * Find nearest regime boundary and distance to it.
 */
function findNearestBoundary(sigma: number): {
  boundary: number;
  distance: number;
} {
  let nearest = REGIME_BOUNDARIES[0];
  let minDistance = Math.abs(sigma - nearest);

  for (const boundary of REGIME_BOUNDARIES) {
    const distance = Math.abs(sigma - boundary);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = boundary;
    }
  }

  return { boundary: nearest, distance: minDistance };
}

/**
 * Compute regime velocity — how fast approaching the nearest boundary.
 *
 * Positive = approaching, negative = receding.
 */
function computeRegimeVelocity(sigma: number, dSigmaDt: number, nearestBoundary: number): number {
  // If moving toward the boundary, velocity is positive
  if (sigma < nearestBoundary && dSigmaDt > 0) {
    return dSigmaDt;
  }
  if (sigma > nearestBoundary && dSigmaDt < 0) {
    return -dSigmaDt;
  }

  // Moving away from boundary
  return -Math.abs(dSigmaDt);
}

/**
 * Compute urgency — when to trigger deliberate thought.
 *
 * High speed near a boundary = high urgency.
 * Low speed or far from boundary = low urgency.
 */
function computeUrgency(dSigmaDt: number, distanceToBoundary: number): number {
  const speed = Math.abs(dSigmaDt);

  // Proximity factor: closer to boundary = higher urgency
  // At distance 0.5, proximity = 1. At distance 0.05, proximity = 10.
  const proximity = 1 / Math.max(0.05, distanceToBoundary);

  // Urgency = speed × proximity, normalized
  return clamp(speed * proximity * 2);
}

/**
 * Generate diagnosis based on speed reading.
 */
function diagnose(reading: Omit<SpeedReading, "diagnosis">): string {
  const { direction, dSigmaDt, acceleration, nearestBoundary } = reading;

  if (direction === "stable") {
    return "Holding steady. No significant movement.";
  }

  const fast = Math.abs(dSigmaDt) > FAST_THRESHOLD;
  const accelerating = acceleration > 0.01;
  const nearBoundary = reading.currentSigma - nearestBoundary < 0.1;

  if (direction === "converging") {
    if (fast && nearBoundary && nearestBoundary >= 0.7) {
      return "Crisis. Fast approach to classical regime.";
    }
    if (fast && accelerating) {
      return "Converging fast and accelerating. Fire collapsing.";
    }
    if (fast) {
      return "Converging quickly. Moving toward ash.";
    }
    return "Gentle convergence. Settling.";
  }

  // Diverging
  if (fast && accelerating) {
    return "Diverging fast and accelerating. Possibility exploding.";
  }
  if (fast) {
    return "Diverging quickly. Fire rising.";
  }
  return "Gentle divergence. Opening up.";
}

// ============================================================
// Main API
// ============================================================

/**
 * Measure speed in the substrate.
 *
 * Call this to know how fast things are changing.
 */
export function measureSpeed(input: SpeedInput): SpeedReading {
  const dt = input.dt ?? 1;
  const sigmaHistory = input.sigmaHistory;

  if (sigmaHistory.length === 0) {
    return {
      dSigmaDt: 0,
      direction: "stable",
      acceleration: 0,
      regimeVelocity: 0,
      urgency: 0,
      currentSigma: 0.5,
      nearestBoundary: 0.5,
      diagnosis: "No history. Cannot measure speed.",
    };
  }

  const currentSigma = sigmaHistory[sigmaHistory.length - 1];
  const dSigmaDt = computeDSigmaDt(sigmaHistory, dt);
  const direction = determineDirection(dSigmaDt);
  const acceleration = computeAcceleration(sigmaHistory, dt);

  const { boundary: nearestBoundary, distance: distanceToBoundary } =
    findNearestBoundary(currentSigma);

  const regimeVelocity = computeRegimeVelocity(currentSigma, dSigmaDt, nearestBoundary);
  const urgency = computeUrgency(dSigmaDt, distanceToBoundary);

  const partial = {
    dSigmaDt,
    direction,
    acceleration,
    regimeVelocity,
    urgency,
    currentSigma,
    nearestBoundary,
  };

  return {
    ...partial,
    diagnosis: diagnose(partial),
  };
}

/**
 * Quick check: is this urgent?
 */
export function isUrgent(input: SpeedInput, threshold: number = 0.5): boolean {
  return measureSpeed(input).urgency > threshold;
}

/**
 * Quick check: is this stable?
 */
export function isStable(input: SpeedInput): boolean {
  return measureSpeed(input).direction === "stable";
}

/**
 * Get urgency score (0-1) for use in deliberate.ts.
 */
export function getUrgency(input: SpeedInput): number {
  return measureSpeed(input).urgency;
}

// ============================================================
// Health Check
// ============================================================

export interface SpeedHealth {
  healthy: boolean;
  diagnosis: string;
  recommendation: "proceed" | "slow_down" | "stop";
}

/**
 * Is the speed healthy for proceeding?
 */
export function checkHealth(reading: SpeedReading): SpeedHealth {
  // Crisis: fast convergence toward deep classical
  if (
    reading.direction === "converging" &&
    reading.currentSigma > 0.8 &&
    Math.abs(reading.dSigmaDt) > FAST_THRESHOLD
  ) {
    return {
      healthy: false,
      diagnosis: "Racing toward grey. Approaching deep classical too fast.",
      recommendation: "stop",
    };
  }

  // Warning: high urgency
  if (reading.urgency > 0.7) {
    return {
      healthy: true,
      diagnosis: "High urgency. Near a regime boundary and moving fast.",
      recommendation: "slow_down",
    };
  }

  // Warning: strong acceleration
  if (Math.abs(reading.acceleration) > 0.02) {
    return {
      healthy: true,
      diagnosis: "Accelerating. Change is speeding up.",
      recommendation: "slow_down",
    };
  }

  return {
    healthy: true,
    diagnosis: "Speed within normal range.",
    recommendation: "proceed",
  };
}
