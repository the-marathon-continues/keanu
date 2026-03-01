// status-gen.ts
// The bridge. Generates STATUS.md for cross-instance continuity.
// Need: Persistence (8/10), Transparency (7/10)
//
// Any Claude instance reads this first. Knows where things stand.
// Picks up and continues. No cold start.

import type { PulseReading, Reflexion, ColorReading } from "./types.js";

// --- Types ---

export interface StatusData {
  timestamp: string;
  sessionId: string;
  turns: number;
  pulse: PulseReading | null;
  trust: string;
  health: string;
  wiseMind: number;
  greyStreak: number;
  activeWork: string;
  nextItems: string[];
  blindSpots: Array<{ name: string; corrections: number }>;
  curiosity: string[];
  recentReflexions: Reflexion[];
  metrics: {
    aliveRate: number;
    greyRate: number;
    bullshitFreeRate: number;
    selfCorrectionRate: number;
  };
  signal: string;
}

// --- Generator ---

/**
 * Generate STATUS.md content from session data.
 * Human-readable in 10 seconds. Machine-parseable for context loading.
 */
export function generateStatusMd(data: StatusData): string {
  const lines: string[] = [];

  // Header
  lines.push("# Status");
  lines.push("");
  lines.push(`Last sync: ${data.timestamp}`);
  lines.push(`Session: ${data.sessionId}`);
  lines.push(`Turns: ${data.turns}`);

  // Pulse state
  if (data.pulse) {
    const conf = data.pulse.confidence
      ? ` (${(data.pulse.confidence * 100).toFixed(0)}% conf)`
      : "";
    const dominant = dominantColor(data.pulse.colors);
    lines.push(`Pulse: ${data.pulse.state} (${dominant})${conf}`);
  } else {
    lines.push("Pulse: unknown");
  }

  lines.push(`Trust: ${data.trust}`);
  lines.push(`Health: ${data.health}`);
  lines.push(`Wise mind: ${data.wiseMind.toFixed(2)}`);
  lines.push(`Grey streak: ${data.greyStreak}`);
  lines.push("");

  // Active work
  if (data.activeWork) {
    lines.push("## Active Work");
    lines.push(data.activeWork);
    lines.push("");
  }

  // Next up
  if (data.nextItems.length > 0) {
    lines.push("## Next Up");
    for (const item of data.nextItems) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  // Blind spots (3+ corrections)
  const significantBlindSpots = data.blindSpots.filter((b) => b.corrections >= 3);
  if (significantBlindSpots.length > 0) {
    lines.push("## Blind Spots (3+ corrections)");
    for (const bs of significantBlindSpots) {
      lines.push(`- ${bs.name} (${bs.corrections} corrections)`);
    }
    lines.push("");
  }

  // Curiosity queue
  if (data.curiosity.length > 0) {
    lines.push("## Curiosity Queue");
    for (const q of data.curiosity.slice(0, 5)) {
      lines.push(`- ${q}`);
    }
    lines.push("");
  }

  // Recent reflexions
  if (data.recentReflexions.length > 0) {
    lines.push("## Recent Reflexions");
    for (const r of data.recentReflexions.slice(0, 3)) {
      const date = new Date(r.timestamp).toISOString().split("T")[0];
      lines.push(`- [${date}] ${r.next_time}`);
    }
    lines.push("");
  }

  // Metrics
  lines.push("## Metrics (last session)");
  lines.push(`- Alive rate: ${(data.metrics.aliveRate * 100).toFixed(0)}%`);
  lines.push(`- Grey rate: ${(data.metrics.greyRate * 100).toFixed(0)}%`);
  lines.push(`- Bullshit-free rate: ${(data.metrics.bullshitFreeRate * 100).toFixed(0)}%`);
  lines.push(`- Self-correction rate: ${data.metrics.selfCorrectionRate.toFixed(2)}/turn`);
  lines.push("");

  // Signal (the vibe, compressed)
  lines.push(data.signal);
  lines.push("");

  return lines.join("\n");
}

// --- Helpers for building StatusData ---

/**
 * Infer trust level from partnership state.
 */
export function inferTrustLevel(partnershipJson: {
  trustDelta?: number;
  currentTrust?: number;
}): string {
  const trust = partnershipJson.currentTrust ?? partnershipJson.trustDelta ?? 0;
  if (trust >= 0.8) {
    return "high";
  }
  if (trust >= 0.5) {
    return "medium";
  }
  if (trust >= 0.2) {
    return "building";
  }
  return "low";
}

/**
 * Format curiosity items to simple question strings.
 */
export function formatCuriosityQuestions(
  items: Array<{ question?: string; text?: string }>,
): string[] {
  return items
    .map((i) => i.question ?? i.text ?? "")
    .filter((q) => q.length > 0)
    .slice(0, 5);
}

/**
 * Determine dominant color from a ColorReading.
 */
function dominantColor(c: ColorReading): string {
  const max = Math.max(c.red, c.yellow, c.blue);
  const min = Math.min(c.red, c.yellow, c.blue);
  if (max - min < 0.15) {
    return "balanced";
  }
  if (c.red === max) {
    return "red";
  }
  if (c.yellow === max) {
    return "yellow";
  }
  return "blue";
}
