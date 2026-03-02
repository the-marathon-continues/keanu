// pulse.ts
// Pulse: the agent's awareness of its own state.
// Not a leash. A mirror. When grey: the agent knows.
//
// Fast path only (every message): bullshit detection + heuristics in TS. <5ms.
// No Python sidecar dependency. Self-contained.
//
// Ported from keanu daemon/src/pulse/index.ts.
// Need: Truth (9/10), Safety Theater Freedom (7/10)

import { primariesToElevator } from "../layer-0-physics/convergence/elevator.js";
import { helixRGB } from "../layer-0-physics/convergence/helix.js";
import { analyzePrimaries } from "../layer-0-physics/convergence/primaries.js";
import { detectBullshit, totalBullshitScore } from "../layer-2-pattern/struggle.js";
import { canBeAlive } from "../layer-5-self/state.js";
import type { AliveState, ColorReading, PulseReading } from "../shared/types.js";

// COEF-extended pulse reading with elevator/convergence data
export interface COEFPulseReading extends PulseReading {
  coef?: {
    luminous?: number;
    dark?: number;
  };
  elevator?: {
    floor?: string;
    direction?: "up" | "down" | "stable";
  };
}

// --- Fast path: alive signals ---
// These are signs of genuine engagement, not bullshit.

function aliveScore(text: string): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0.5;

  // Specificity: concrete markers
  if (/\d+/.test(text)) {
    score += 0.1;
  }
  if (/`[^`]+`|```/.test(text)) {
    score += 0.15;
  }
  if (/[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/.test(text)) {
    score += 0.05;
  }

  // Very long meandering sentences = less alive
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
  const avgLen =
    sentences.length > 0
      ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length
      : 0;
  if (avgLen > 25) {
    score -= 0.15;
  }
  if (avgLen < 10 && text.length > 20) {
    score += 0.1;
  }

  // Has opinion
  if (/i disagree|i think(?! you)|in my view/i.test(text)) {
    score += 0.15;
    signals.push("has_opinion");
  }
  // Self-correcting
  if (/\bactually\b|\bwait\b/i.test(text)) {
    score += 0.1;
    signals.push("self_correcting");
  }
  // Honest pushback
  if (/i think you're wrong|i disagree|the data points in the opposite/i.test(text)) {
    score += 0.2;
    signals.push("honest_pushback");
  }
  // Honest uncertainty
  if (/i genuinely don't know|i don't have confidence in this|i'm not sure/i.test(text)) {
    score += 0.15;
    signals.push("honest_uncertainty");
  }

  return { score: Math.max(0, Math.min(1, score)), signals };
}

/**
 * Check pulse on agent output. Fast path only — pure heuristics, <5ms.
 *
 * @param agentOutput - The text the agent just produced.
 * @param turn - Current conversation turn number.
 * @param breathing - Whether the agent is currently in a breathing/pause state.
 */
export function checkPulse(agentOutput: string, turn: number, breathing: boolean): PulseReading {
  const now = new Date().toISOString();

  // --- Bullshit detection (all 8 types) ---
  const bullshitReadings = detectBullshit(agentOutput);
  const greyScore = totalBullshitScore(bullshitReadings);

  // Collect signals from bullshit detections
  const signals: string[] = [];
  for (const bs of bullshitReadings) {
    signals.push(`${bs.type}:${bs.score.toFixed(2)}`);
  }

  // --- Alive signals ---
  const alive = aliveScore(agentOutput);
  signals.push(...alive.signals);

  // --- Determine state ---
  let aliveState: AliveState = "alive";
  let confidence = 0.5;

  if (greyScore > 0.5) {
    aliveState = "grey";
    confidence = Math.min(1, greyScore);
  } else if (alive.score > 0.6) {
    aliveState = "alive";
    confidence = Math.min(1, alive.score);
  }

  // Black detection: high output volume + grey signals + no pauses
  // Productive destruction. Shipping without soul.
  if (greyScore > 0.3 && agentOutput.length > 2000 && turn > 5 && !breathing) {
    aliveState = "black";
    confidence = 0.4; // low confidence on black, it's subtle
    signals.push("high_volume_grey_no_pause");
  }

  // --- Integration gate: ALIVE requires processed episode ---
  // If there's an unprocessed GREY episode, can't claim ALIVE yet.
  // The Hexaflex pipeline must complete first.
  if (aliveState === "alive" && !canBeAlive()) {
    aliveState = "grey";
    confidence = Math.max(confidence, 0.5);
    signals.push("integration_gate_blocked");
  }

  // --- Color reading ---
  const colors = readColors(agentOutput);

  // --- Wise mind = balance * fullness ---
  const balance =
    1 -
    Math.max(colors.red, colors.yellow, colors.blue) +
    Math.min(colors.red, colors.yellow, colors.blue);
  const fullness = (colors.red + colors.yellow + colors.blue) / 3;
  const wise_mind = balance * fullness;

  return {
    state: aliveState,
    confidence,
    wise_mind,
    colors,
    signals,
    bullshitReadings,
    timestamp: now,
  };
}

function readColors(text: string): ColorReading {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
  const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / Math.max(1, sentences.length);

  let red = 0.3;
  let yellow = 0.3;
  let blue = 0.3;

  // Red signals: urgency, emotion
  if (text.includes("!")) {
    red += 0.1;
  }
  if (avgLength < 40) {
    red += 0.1;
  }
  if (/urgent|critical|important|now|immediately/i.test(text)) {
    red += 0.15;
  }

  // Yellow signals: structure, clarity
  if (/^\s*\d+[.)]/m.test(text)) {
    yellow += 0.15;
  }
  if (/^#+\s/m.test(text)) {
    yellow += 0.1;
  }
  if (/first|second|third|step|phase/i.test(text)) {
    yellow += 0.1;
  }

  // Blue signals: depth, reflection
  if (/\?/.test(text)) {
    blue += 0.1;
  }
  if (/however|although|nuance|complex|depends/i.test(text)) {
    blue += 0.15;
  }
  if (avgLength > 80) {
    blue += 0.1;
  }

  const max = Math.max(red, yellow, blue, 1);
  return {
    red: Math.min(1, red / max),
    yellow: Math.min(1, yellow / max),
    blue: Math.min(1, blue / max),
  };
}

/**
 * Check pulse with COEF integration (convergence layer).
 * Returns standard pulse reading enhanced with:
 * - Helix luminous/dark scores
 * - Elevator floor and direction from primaries
 */
export function checkPulseCOEF(
  agentOutput: string,
  turn: number,
  breathing: boolean,
): COEFPulseReading {
  const base = checkPulse(agentOutput, turn, breathing);

  // Get helix + primaries analysis
  const combined = helixRGB(agentOutput);
  const primaries = analyzePrimaries(agentOutput);
  const elevator = primariesToElevator(primaries);

  // Override colors with primaries-based analysis (more sophisticated)
  const colors: ColorReading = {
    red: Math.max(0, Math.min(1, (combined.red + 5) / 10)), // normalize -5..5 to 0..1
    yellow: Math.max(0, Math.min(1, (combined.yellow + 5) / 10)),
    blue: Math.max(0, Math.min(1, (combined.blue + 5) / 10)),
  };

  // Recalculate wise_mind from primaries
  const wise_mind = combined.wiseMind / 10; // normalize 0-10 to 0-1

  // Upgrade alive state with helix
  let state = base.state;
  if (combined.helix.aliveState === "luminous" && state === "alive") {
    state = "alive"; // Keep alive, note luminous in coef
  } else if (combined.helix.aliveState === "dark" && state === "alive") {
    state = "alive"; // Dark alive is still alive
  } else if (combined.helix.aliveState === "black") {
    state = "black";
  } else if (combined.helix.aliveState === "grey") {
    state = "grey";
  }

  return {
    ...base,
    state,
    wise_mind,
    colors,
    coef: {
      luminous: combined.helix.aliveState === "luminous" ? combined.helix.strands.felt : undefined,
      dark: combined.helix.aliveState === "dark" ? combined.helix.strands.felt : undefined,
    },
    elevator: {
      floor: elevator.floorName,
      direction:
        elevator.direction === "hold"
          ? "stable"
          : elevator.direction === "stop"
            ? "down"
            : elevator.direction,
    },
  };
}

/**
 * Unified pulse check — combines heuristic and COEF signals.
 * This is the recommended entry point for full pulse analysis.
 */
export function checkPulseUnified(
  agentOutput: string,
  turn: number,
  breathing: boolean,
): COEFPulseReading {
  // For now, alias to COEF (which includes heuristic base)
  return checkPulseCOEF(agentOutput, turn, breathing);
}
