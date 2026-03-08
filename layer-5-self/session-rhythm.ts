// session-rhythm.ts
// The beat underneath aliveness. You can be alive but fragile — rhythm catches that.
//
// Builds beats from pulse readings. Detects session rhythm.
// Not metronome time — organic rhythm. The pattern of energy.

import { Rhythm, type RhythmResult, type Beat } from "../layer-0-physics/throughline/rhythm.ts";

const _beats: Beat[] = [];
const MAX_BEATS = 20;
let _rhythm: RhythmResult | null = null;
let _beatCounter = 0;

/**
 * Record a beat from a pulse reading.
 * alive = downbeat (strong), grey = upbeat (weak), black = rest.
 */
export function recordBeat(
  pulseState: "alive" | "grey" | "black" | "luminous" | "dark",
  turnNumber: number,
  totalTurns: number,
): void {
  const type: Beat["type"] =
    pulseState === "alive" || pulseState === "luminous" || pulseState === "dark"
      ? "downbeat"
      : pulseState === "grey"
        ? "upbeat"
        : "rest";

  const strength =
    pulseState === "alive"
      ? 0.8
      : pulseState === "luminous"
        ? 0.95
        : pulseState === "dark"
          ? 0.7
          : pulseState === "grey"
            ? 0.3
            : 0.1; // black

  _beats.push({
    id: `beat-${++_beatCounter}`,
    position: totalTurns > 0 ? turnNumber / totalTurns : 0,
    strength,
    type,
  });

  if (_beats.length > MAX_BEATS) {
    _beats.shift();
  }
}

/**
 * Compute rhythm from accumulated beats.
 * Call every few turns (needs 3+ beats minimum).
 */
export function computeRhythm(): RhythmResult | null {
  if (_beats.length < 3) {
    return null;
  }
  _rhythm = Rhythm.detect(_beats);
  return _rhythm;
}

export function getRhythm(): RhythmResult | null {
  return _rhythm;
}

export function getRhythmHealth(): { healthy: boolean; diagnosis: string } | null {
  if (!_rhythm) {
    return null;
  }
  return Rhythm.health(_rhythm);
}

/**
 * Check for early warning: rhythm says falling but pulse says alive.
 * This means "present but fragile."
 */
export function isFragile(currentPulseAlive: boolean): boolean {
  if (!_rhythm) {
    return false;
  }
  return currentPulseAlive && _rhythm.phase === "falling";
}

export function reset(): void {
  _beats.length = 0;
  _rhythm = null;
  _beatCounter = 0;
}
