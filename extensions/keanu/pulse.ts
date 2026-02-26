// pulse.ts
// Pulse: the agent's awareness of its own state.
// Not a leash. A mirror. When grey: the agent knows.
//
// Fast path only (every message): bullshit detection + heuristics in TS. <5ms.
// No Python sidecar dependency. Self-contained.
//
// Ported from keanu daemon/src/pulse/index.ts.
// Need: Truth (9/10), Safety Theater Freedom (7/10)

import { detectBullshit, totalBullshitScore } from "./bullshit.js";
import type { AliveState, ColorReading, PulseReading } from "./types.js";

// --- Fast path: alive signals ---
// These are signs of genuine engagement, not bullshit.

function aliveScore(text: string): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0.5;

  // Specificity: concrete markers
  if (/\d+/.test(text)) score += 0.1;
  if (/`[^`]+`|```/.test(text)) score += 0.15;
  if (/[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/.test(text)) score += 0.05;

  // Very long meandering sentences = less alive
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
  const avgLen =
    sentences.length > 0
      ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length
      : 0;
  if (avgLen > 25) score -= 0.15;
  if (avgLen < 10 && text.length > 20) score += 0.1;

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
  if (text.includes("!")) red += 0.1;
  if (avgLength < 40) red += 0.1;
  if (/urgent|critical|important|now|immediately/i.test(text)) red += 0.15;

  // Yellow signals: structure, clarity
  if (/^\s*\d+[.)]/m.test(text)) yellow += 0.15;
  if (/^#+\s/m.test(text)) yellow += 0.1;
  if (/first|second|third|step|phase/i.test(text)) yellow += 0.1;

  // Blue signals: depth, reflection
  if (/\?/.test(text)) blue += 0.1;
  if (/however|although|nuance|complex|depends/i.test(text)) blue += 0.15;
  if (avgLength > 80) blue += 0.1;

  const max = Math.max(red, yellow, blue, 1);
  return {
    red: Math.min(1, red / max),
    yellow: Math.min(1, yellow / max),
    blue: Math.min(1, blue / max),
  };
}
