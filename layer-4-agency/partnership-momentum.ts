// partnership-momentum.ts
// Mass times velocity. How hard is this partnership to steer?
//
// High momentum + high inertia = committed but hard to redirect.
// Fading momentum = something's draining the energy.
// Zero momentum = stuck.

import { Momentum, type MomentumResult } from "../layer-0-physics/throughline/momentum.ts";

let _current: MomentumResult | null = null;
const _history: MomentumResult[] = [];
const MAX_HISTORY = 20;

/**
 * Update partnership momentum from session signals.
 * mass = how much has been invested (turn count, roughly)
 * aliveRate = fraction of recent turns that were alive (0-1)
 * trustLevel = current trust level (0-1)
 */
export function update(mass: number, aliveRate: number, trustLevel: number): MomentumResult {
  // Velocity as 2D vector: [alive direction, trust direction]
  const velocity = [aliveRate, trustLevel];

  _current = Momentum.calculate(mass, velocity);

  _history.push(_current);
  if (_history.length > MAX_HISTORY) {
    _history.shift();
  }

  return _current;
}

/**
 * Apply force from a disagreement event.
 * Returns how much the trajectory changed.
 */
export function applyDisagreementForce(
  mass: number,
  forceStrength: number,
  forceDirection: [number, number] = [-0.3, -0.1], // disagreements pull alive down slightly, trust slightly
): MomentumResult | null {
  if (!_current) {
    return null;
  }

  const scaledForce = forceDirection.map((d) => d * forceStrength);
  _current = Momentum.applyForce(_current, scaledForce, mass);

  _history.push(_current);
  if (_history.length > MAX_HISTORY) {
    _history.shift();
  }

  return _current;
}

export function getCurrent(): MomentumResult | null {
  return _current;
}

export function getHealth(): { healthy: boolean; diagnosis: string } | null {
  if (!_current) {
    return null;
  }
  return Momentum.health(_current);
}

export function getTrend(): "building" | "fading" | "stable" {
  return Momentum.trend(_history);
}

export function getEnergy(mass: number): number {
  if (!_current) {
    return 0;
  }
  return Momentum.energy(_current, mass);
}

export function reset(): void {
  _current = null;
  _history.length = 0;
}
