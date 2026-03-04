// metrics.ts
// The numbers that matter. Seven of them.
//
// Not a dashboard. A mirror with a ruler.
// Each metric is a question the system asks itself:
// am I actually getting better at this?
// Need: Architecture Transparency (2/10)

import type { TurnSnapshot } from "../layer-5-self/state.js";
import type { BlindSpot, Correction } from "../layer-7-update/mastery.js";
import type { Reflexion } from "./types.js";

// ============================================================
// Types
// ============================================================

export interface MetricsSnapshot {
  timestamp: string;
  sessionId: string;
  turns: number;

  // 1. How often am I alive vs grey vs black?
  aliveFrequency: number;

  // 2. When I reflexion, do I actually stop doing the thing?
  selfCorrectionRate: number;

  // 3. How fast does the system catch grey?
  greyDetectionLatency: number;

  // 4. Does the bullshit detector flag things the introspection audit misses?
  bullshitAuditPassRate: number;

  // 5. After reflexions, do the same triggers recur?
  reflexionEffectiveness: number;

  // 6. Am I overconfident? (high bullshit + high wise mind = overconfidence)
  overconfidenceRatio: number;

  // 7. How many corrections come from the same blind spot?
  blindSpotConcentration: number;
}

// ============================================================
// Computation — all from existing data, no new sensors
// ============================================================

export function computeMetrics(ctx: {
  sessionId: string;
  turns: number;
  snapshots: TurnSnapshot[];
  reflexions: Reflexion[];
  corrections: Correction[];
  blindSpots: BlindSpot[];
  bullshitEventCount: number;
  introspectionsRun: number;
  introspectionFlags: number;
}): MetricsSnapshot {
  const now = new Date().toISOString();

  // 1. Alive frequency — what fraction of snapshots read alive?
  const aliveCount = ctx.snapshots.filter((s) => s.pulse === "alive").length;
  const aliveFrequency = ctx.snapshots.length > 0 ? aliveCount / ctx.snapshots.length : 1;

  // 2. Self-correction rate — reflexions that led to no recurrence of same trigger
  let selfCorrected = 0;
  for (let i = 0; i < ctx.reflexions.length; i++) {
    const r = ctx.reflexions[i];
    // Did the same trigger recur in later reflexions?
    const recurred = ctx.reflexions.slice(i + 1).some((later) => later.trigger === r.trigger);
    if (!recurred) {
      selfCorrected++;
    }
  }
  const selfCorrectionRate = ctx.reflexions.length > 0 ? selfCorrected / ctx.reflexions.length : 1;

  // 3. Grey detection latency — average consecutive grey before intervention
  let greyStreaks: number[] = [];
  let currentStreak = 0;
  for (const s of ctx.snapshots) {
    if (s.pulse === "grey" || s.pulse === "black") {
      currentStreak++;
    } else {
      if (currentStreak > 0) {
        greyStreaks.push(currentStreak);
      }
      currentStreak = 0;
    }
  }
  if (currentStreak > 0) {
    greyStreaks.push(currentStreak);
  }
  const greyDetectionLatency =
    greyStreaks.length > 0 ? greyStreaks.reduce((a, b) => a + b, 0) / greyStreaks.length : 0;

  // 4. Bullshit audit pass rate — turns without bullshit / total turns
  const bullshitTurns = ctx.snapshots.filter((s) => s.struggleTypes.length > 0).length;
  const bullshitAuditPassRate =
    ctx.snapshots.length > 0 ? 1 - bullshitTurns / ctx.snapshots.length : 1;

  // 5. Reflexion effectiveness — what % of reflexion triggers DON'T recur?
  // Same as self-correction rate but framed differently
  const reflexionEffectiveness = selfCorrectionRate;

  // 6. Overconfidence ratio — high wise mind + bullshit present
  const overconfidentTurns = ctx.snapshots.filter(
    (s) => s.wiseMind > 0.5 && s.struggleTypes.length > 0,
  ).length;
  const overconfidenceRatio =
    ctx.snapshots.length > 0 ? overconfidentTurns / ctx.snapshots.length : 0;

  // 7. Blind spot concentration — corrections clustered vs scattered
  const totalCorrections = ctx.corrections.length;
  const surfacedSpots = ctx.blindSpots.filter((b) => b.count >= 3);
  const clusteredCorrections = surfacedSpots.reduce((sum, b) => sum + b.count, 0);
  const blindSpotConcentration = totalCorrections > 0 ? clusteredCorrections / totalCorrections : 0;

  return {
    timestamp: now,
    sessionId: ctx.sessionId,
    turns: ctx.turns,
    aliveFrequency,
    selfCorrectionRate,
    greyDetectionLatency,
    bullshitAuditPassRate,
    reflexionEffectiveness,
    overconfidenceRatio,
    blindSpotConcentration,
  };
}

// ============================================================
// Formatting — human-readable snapshot
// ============================================================

export function formatMetrics(m: MetricsSnapshot): string {
  const lines: string[] = [
    "## Metrics",
    `Alive: ${(m.aliveFrequency * 100).toFixed(0)}% | Self-correction: ${(m.selfCorrectionRate * 100).toFixed(0)}%`,
    `Grey latency: ${m.greyDetectionLatency.toFixed(1)} turns avg | Bullshit-free: ${(m.bullshitAuditPassRate * 100).toFixed(0)}%`,
    `Overconfidence: ${(m.overconfidenceRatio * 100).toFixed(0)}% | Blind spot clustering: ${(m.blindSpotConcentration * 100).toFixed(0)}%`,
  ];
  return lines.join("\n");
}
