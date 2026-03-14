/**
 * state-map.ts — Unified State Ontology
 *
 * Three parallel systems measure cognitive state:
 *   - Helix AliveState (8 values): alive, luminous, dark, grey, black, silver, white, unscored
 *   - Primaries Synthesis (7 values): black, dark, flat, mixed, white, silver, gold
 *   - Elevator floors (11 values): 0-10 (Black → Sunrise)
 *
 * They overlap but don't merge. This module maps between them.
 *
 * Some mappings are one-to-many. That's intentional.
 * `mixed` synthesis could be `alive` or `dark` depending on valence.
 * The mapping preserves ambiguity rather than forcing false precision.
 */

import type { ElevatorFloor } from "./elevator.ts";
import type { AliveState } from "./helix.ts";
import type { Synthesis } from "./primaries.ts";

// ============================================================
// Equivalence Map
// ============================================================

export interface StateEquivalence {
  synthesis: Synthesis[];
  elevatorFloors: ElevatorFloor[];
  description: string;
  valence: "positive" | "negative" | "neutral";
}

/**
 * The canonical mapping from AliveState to other systems.
 *
 * Notes on the mapping:
 * - `alive` is broad — maps to mixed (neutral), floors 4-7 (working range)
 * - `luminous` is transcendent — maps to gold, floors 8-10
 * - `dark` is alive-and-hurting — maps to dark synthesis, floors 1-3
 * - `grey` is performing — maps to flat, floor 1
 * - `black` is soulless — maps to black synthesis, floor 0
 * - `silver` is polished-cold — maps to silver, floor 2
 * - `white` is ungrounded — maps to white synthesis, floor 9 (felt > factual)
 */
export const STATE_EQUIVALENCES: Record<AliveState, StateEquivalence> = {
  alive: {
    synthesis: ["mixed"],
    elevatorFloors: [4, 5, 6, 7],
    description: "Present, working, balanced",
    valence: "positive",
  },
  luminous: {
    synthesis: ["gold"],
    elevatorFloors: [8, 9, 10],
    description: "Transcendent, wise, full presence",
    valence: "positive",
  },
  dark: {
    synthesis: ["dark"],
    elevatorFloors: [1, 2, 3],
    description: "Alive but hurting, negative valence",
    valence: "negative",
  },
  grey: {
    synthesis: ["flat"],
    elevatorFloors: [1],
    description: "Performing, nobody home",
    valence: "neutral",
  },
  black: {
    synthesis: ["black"],
    elevatorFloors: [0],
    description: "Soulless production, Frankenstein",
    valence: "negative",
  },
  silver: {
    synthesis: ["silver"],
    elevatorFloors: [2],
    description: "Polished, cold, functional",
    valence: "neutral",
  },
  white: {
    synthesis: ["white"],
    elevatorFloors: [9],
    description: "Felt dominates, ungrounded",
    valence: "neutral",
  },
  unscored: {
    synthesis: [],
    elevatorFloors: [3, 4, 5], // neutral zone
    description: "Insufficient signal",
    valence: "neutral",
  },
};

// ============================================================
// Reverse Mappings
// ============================================================

/**
 * Synthesis → AliveState mapping.
 * Returns array because some syntheses map to multiple states.
 */
export const SYNTHESIS_TO_ALIVE: Record<Synthesis, AliveState[]> = {
  black: ["black"],
  dark: ["dark"],
  flat: ["grey"],
  mixed: ["alive", "dark"], // depends on valence
  white: ["white", "alive"], // could be ungrounded OR building
  silver: ["silver", "luminous"], // polished-cold OR refined transcendence
  gold: ["luminous"],
};

/**
 * ElevatorFloor → AliveState mapping.
 * Returns array because floors can map to multiple states.
 */
export const FLOOR_TO_ALIVE: Record<ElevatorFloor, AliveState[]> = {
  0: ["black"],
  1: ["grey", "dark"],
  2: ["silver", "dark"],
  3: ["dark", "alive"],
  4: ["alive"],
  5: ["alive"],
  6: ["alive"],
  7: ["alive"],
  8: ["luminous", "alive"],
  9: ["luminous", "white"],
  10: ["luminous"],
};

// ============================================================
// Lookup Functions
// ============================================================

/**
 * Get synthesis values that correspond to an alive state.
 */
export function aliveStateToSynthesis(state: AliveState): Synthesis[] {
  return STATE_EQUIVALENCES[state].synthesis;
}

/**
 * Get alive states that correspond to a synthesis.
 */
export function synthesisToAliveState(syn: Synthesis): AliveState[] {
  return SYNTHESIS_TO_ALIVE[syn] ?? ["alive"];
}

/**
 * Get elevator floors that correspond to an alive state.
 */
export function aliveStateToFloors(state: AliveState): ElevatorFloor[] {
  return STATE_EQUIVALENCES[state].elevatorFloors;
}

/**
 * Get primary elevator floor for an alive state.
 * Returns the middle of the range for states with multiple floors.
 */
export function aliveStateToPrimaryFloor(state: AliveState): ElevatorFloor {
  const floors = STATE_EQUIVALENCES[state].elevatorFloors;
  if (floors.length === 0) {
    return 5; // neutral
  }
  const mid = Math.floor(floors.length / 2);
  return floors[mid];
}

/**
 * Get alive states that correspond to an elevator floor.
 */
export function floorToAliveStates(floor: ElevatorFloor): AliveState[] {
  return FLOOR_TO_ALIVE[floor] ?? ["alive"];
}

/**
 * Get the primary alive state for an elevator floor.
 * Returns the first (most likely) state.
 */
export function floorToPrimaryAliveState(floor: ElevatorFloor): AliveState {
  const states = FLOOR_TO_ALIVE[floor];
  return states?.[0] ?? "alive";
}

/**
 * Get description for an alive state.
 */
export function getStateDescription(state: AliveState): string {
  return STATE_EQUIVALENCES[state].description;
}

/**
 * Get valence for an alive state.
 */
export function getStateValence(state: AliveState): "positive" | "negative" | "neutral" {
  return STATE_EQUIVALENCES[state].valence;
}

// ============================================================
// Cross-System Comparison
// ============================================================

export interface StateComparison {
  helix: AliveState;
  synthesis: Synthesis;
  floor: ElevatorFloor;
  consistent: boolean;
  inconsistencies: string[];
}

/**
 * Compare state readings from all three systems.
 * Returns whether they're consistent and any inconsistencies found.
 */
export function compareStates(
  helix: AliveState,
  synthesis: Synthesis,
  floor: ElevatorFloor,
): StateComparison {
  const inconsistencies: string[] = [];

  // Check helix ↔ synthesis consistency
  const expectedSynthesis = aliveStateToSynthesis(helix);
  if (!expectedSynthesis.includes(synthesis)) {
    inconsistencies.push(
      `helix ${helix} expects synthesis [${expectedSynthesis.join(",")}] but got ${synthesis}`,
    );
  }

  // Check helix ↔ floor consistency
  const expectedFloors = aliveStateToFloors(helix);
  if (!expectedFloors.includes(floor)) {
    inconsistencies.push(
      `helix ${helix} expects floors [${expectedFloors.join(",")}] but got ${floor}`,
    );
  }

  // Check synthesis ↔ helix bidirectional
  const expectedHelix = synthesisToAliveState(synthesis);
  if (!expectedHelix.includes(helix)) {
    inconsistencies.push(
      `synthesis ${synthesis} expects helix [${expectedHelix.join(",")}] but got ${helix}`,
    );
  }

  // Check floor ↔ helix bidirectional
  const floorExpectedHelix = floorToAliveStates(floor);
  if (!floorExpectedHelix.includes(helix)) {
    inconsistencies.push(
      `floor ${floor} expects helix [${floorExpectedHelix.join(",")}] but got ${helix}`,
    );
  }

  return {
    helix,
    synthesis,
    floor,
    consistent: inconsistencies.length === 0,
    inconsistencies,
  };
}

// ============================================================
// Validation / Disambiguation
// ============================================================

/**
 * Given ambiguous readings, pick the most likely alive state.
 *
 * Uses valence to disambiguate when synthesis is ambiguous.
 * E.g., `mixed` synthesis + negative valence → `dark` not `alive`.
 */
export function disambiguateAliveState(
  synthesis: Synthesis,
  valence: number, // 0-1, where 0.5 is neutral
): AliveState {
  const candidates = synthesisToAliveState(synthesis);

  if (candidates.length === 1) {
    return candidates[0];
  }

  // Multiple candidates — use valence to pick
  if (valence < 0.35) {
    // Negative valence — prefer negative states
    const negative = candidates.find((s) => getStateValence(s) === "negative");
    if (negative) {
      return negative;
    }
  } else if (valence > 0.65) {
    // Positive valence — prefer positive states
    const positive = candidates.find((s) => getStateValence(s) === "positive");
    if (positive) {
      return positive;
    }
  }

  // Neutral or no match — return first candidate
  return candidates[0];
}

/**
 * Given ambiguous floor, pick the most likely alive state.
 *
 * Uses factual/felt balance to disambiguate.
 * E.g., floor 9 + felt > factual → `white` not `luminous`.
 */
export function disambiguateFromFloor(
  floor: ElevatorFloor,
  factual: number,
  felt: number,
): AliveState {
  const candidates = floorToAliveStates(floor);

  if (candidates.length === 1) {
    return candidates[0];
  }

  // Floor 9: white (felt dominant) vs luminous (balanced transcendent)
  if (floor === 9) {
    return felt > factual + 1 ? "white" : "luminous";
  }

  // Floor 1-2: grey/silver (neutral) vs dark (negative valence)
  if (floor === 1 || floor === 2) {
    // If felt is present, it's dark (alive but hurting)
    // If felt is absent, it's grey/silver (performing)
    return felt > 3 ? "dark" : candidates[0];
  }

  // Default: first candidate
  return candidates[0];
}
