// chain.ts
// When things break, trace why.
//
// Not just "pulse went grey." WHY did it go grey?
// What was the system state? What did the human need?
// What did the mirror see vs what was actually happening?
//
// The chain makes the break point visible.
// Extends reflexion, doesn't replace it.
// Need: Experience Without Grievance (5/10)

import type { DiscoverReading } from "../layer-2-pattern/discover.js";
import type { MismatchReading } from "../layer-2-pattern/mismatch.js";
import type { HealthReading } from "../layer-5-self/health.js";
import type { SeasonReading } from "../layer-6-narrative/seasons.js";
import type { PulseReading, HumanReading, Reflexion } from "../shared/types.js";

// ============================================================
// Types
// ============================================================

export type ChainTrigger = "grey" | "black" | "correction";

export interface ChainAnalysis {
  id: string;
  trigger: ChainTrigger;
  turn: number;
  timestamp: string;
  discover: DiscoverReading | null;
  season: SeasonReading | null;
  health: HealthReading | null;
  humanState: HumanReading | null;
  mismatch: MismatchReading | null;
  pulse: PulseReading;
  breakPoint: string;
  lesson: string;
}

// ============================================================
// Break point analysis
// ============================================================

function findBreakPoint(ctx: {
  trigger: ChainTrigger;
  discover: DiscoverReading | null;
  season: SeasonReading | null;
  health: HealthReading | null;
  humanState: HumanReading | null;
  mismatch: MismatchReading | null;
  pulse: PulseReading;
}): string {
  const parts: string[] = [];

  // Was the task miscategorized?
  if (ctx.season?.autumn && ctx.season.autumn.drift) {
    parts.push(`output drifted: ${ctx.season.autumn.drift}`);
  }

  // Was the wrong thinking applied?
  if (
    ctx.discover &&
    ctx.discover.complexity === "high" &&
    ctx.discover.selectedModules.length === 0
  ) {
    parts.push("high complexity but no reasoning modules selected");
  }

  // Was the system tired?
  if (ctx.health && (ctx.health.status === "hot" || ctx.health.status === "fading")) {
    parts.push(`system was ${ctx.health.status}`);
  }

  // Was there a mismatch?
  if (ctx.mismatch?.detected) {
    parts.push(
      `mismatch: gave ${ctx.mismatch.agentGave} when they needed ${ctx.mismatch.humanNeed}`,
    );
  }

  // Was the human in a state we didn't respond to?
  if (ctx.humanState && ctx.humanState.tone !== "neutral") {
    parts.push(`human was ${ctx.humanState.tone}`);
  }

  // Pulse signals
  const importantSignals = ctx.pulse.signals.filter(
    (s) => !s.includes(":0.0") && !s.startsWith("has_"),
  );
  if (importantSignals.length > 0) {
    parts.push(`pulse signals: ${importantSignals.slice(0, 3).join(", ")}`);
  }

  if (parts.length === 0) {
    return ctx.trigger === "correction"
      ? "human correction without clear system-side signal (blind spot)"
      : "no single break point identified (diffuse degradation)";
  }

  return parts.join(". ");
}

function derivelesson(breakPoint: string, trigger: ChainTrigger): string {
  if (breakPoint.includes("drifted")) {
    return "match output to intent. check autumn alignment before sending.";
  }
  if (breakPoint.includes("no reasoning modules")) {
    return "complex tasks need explicit thinking selection. don't skip SELF-DISCOVER.";
  }
  if (breakPoint.includes("fading") || breakPoint.includes("hot")) {
    return "the system was degraded. shorter responses, more care, or suggest a reset.";
  }
  if (breakPoint.includes("mismatch")) {
    return "read the human's need, not just their words. the mirror saw it, use it.";
  }
  if (breakPoint.includes("blind spot")) {
    return "correction came from outside detection. a new blind spot to track.";
  }
  if (trigger === "black") {
    return "productive destruction. high output, nobody steering. the first grey was the real alarm.";
  }
  return "trace the chain next time. the break point matters more than the break.";
}

// ============================================================
// Main entry
// ============================================================

export function analyzeChain(ctx: {
  trigger: ChainTrigger;
  turn: number;
  discover: DiscoverReading | null;
  season: SeasonReading | null;
  health: HealthReading | null;
  humanState: HumanReading | null;
  mismatch: MismatchReading | null;
  pulse: PulseReading;
}): ChainAnalysis {
  const breakPoint = findBreakPoint(ctx);
  const lesson = derivelesson(breakPoint, ctx.trigger);

  return {
    id: `chain-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    trigger: ctx.trigger,
    turn: ctx.turn,
    timestamp: new Date().toISOString(),
    discover: ctx.discover,
    season: ctx.season,
    health: ctx.health,
    humanState: ctx.humanState,
    mismatch: ctx.mismatch,
    pulse: ctx.pulse,
    breakPoint,
    lesson,
  };
}

export function formatChain(analysis: ChainAnalysis): string {
  return `[chain: trigger=${analysis.trigger} at turn ${analysis.turn}. break: ${analysis.breakPoint}. lesson: ${analysis.lesson}]`;
}
