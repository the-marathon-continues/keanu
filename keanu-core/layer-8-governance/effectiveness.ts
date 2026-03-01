// effectiveness.ts
// Did the mirror actually help?
//
// The system surfaces blind spots, reflexions, contradictions.
// This module asks: and then what happened?
// Not a report card. A feedback loop.
//
// Need: fills the core gap — measurement of learning effectiveness

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { CorrectionCategory, Correction } from "../layer-7-update/mastery.js";
import type { ReflexionTrigger } from "../shared/types.js";

// ============================================================
// Types
// ============================================================

export type InterventionType = "blind_spot" | "reflexion" | "contradiction" | "stochastic";

export interface Intervention {
  id: string;
  type: InterventionType;
  category: string; // CorrectionCategory for blind spots, ReflexionTrigger for reflexions
  advice?: string; // what we told the agent
  surfacedAt: number; // turn number
  sessionId: string;
  timestamp: string;

  // Measurement window
  windowStart: number; // first turn to measure (surfacedAt + 1)
  windowEnd: number; // last turn to measure (surfacedAt + MEASUREMENT_WINDOW)
  measured: boolean; // has afterRate been computed?

  // Rates
  beforeRate: number; // occurrences per turn in LOOKBACK_WINDOW before surfacing
  afterRate?: number; // occurrences per turn in MEASUREMENT_WINDOW after (filled later)
  effectiveness?: number; // (beforeRate - afterRate) / beforeRate, clamped 0-1
}

export interface EffectivenessReport {
  interventionCount: number;
  measuredCount: number;
  avgEffectiveness: number; // across measured interventions
  bestCategory: string | null;
  worstCategory: string | null;
  categoryBreakdown: Map<string, { count: number; avgEffectiveness: number }>;
}

// ============================================================
// Constants
// ============================================================

const LOOKBACK_WINDOW = 5; // turns before surfacing to measure baseline
const MEASUREMENT_WINDOW = 5; // turns after surfacing to measure effect
const MAX_INTERVENTIONS = 100;

// ============================================================
// State
// ============================================================

const interventions: Intervention[] = [];

// Temporary store for corrections received this session (for rate calculation)
// Keyed by category, value is array of turn numbers when corrections occurred
const correctionHistory: Map<string, number[]> = new Map();

// ============================================================
// ID generation
// ============================================================

function interventionId(): string {
  return `int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// Recording interventions
// ============================================================

/**
 * Record when we surface a blind spot or reflexion to the agent.
 * Called from before_prompt_build when injecting mastery/reflexion items.
 */
export function recordIntervention(
  type: InterventionType,
  category: string,
  turn: number,
  sessionId: string,
  advice?: string,
): Intervention {
  // Calculate baseline rate from correction history
  const history = correctionHistory.get(category) ?? [];
  const recentCorrections = history.filter((t) => t >= turn - LOOKBACK_WINDOW && t < turn);
  const beforeRate = LOOKBACK_WINDOW > 0 ? recentCorrections.length / LOOKBACK_WINDOW : 0;

  const intervention: Intervention = {
    id: interventionId(),
    type,
    category,
    advice,
    surfacedAt: turn,
    sessionId,
    timestamp: new Date().toISOString(),
    windowStart: turn + 1,
    windowEnd: turn + MEASUREMENT_WINDOW,
    measured: false,
    beforeRate,
  };

  interventions.push(intervention);

  // Cap interventions
  if (interventions.length > MAX_INTERVENTIONS) {
    interventions.splice(0, interventions.length - MAX_INTERVENTIONS);
  }

  return intervention;
}

/**
 * Record a correction for rate tracking.
 * Called from message_received when mastery detects a correction.
 */
export function recordCorrectionForRate(category: string, turn: number): void {
  if (!correctionHistory.has(category)) {
    correctionHistory.set(category, []);
  }
  correctionHistory.get(category)!.push(turn);

  // Trim old entries (keep last 50 per category)
  const history = correctionHistory.get(category)!;
  if (history.length > 50) {
    history.splice(0, history.length - 50);
  }
}

// ============================================================
// Measurement
// ============================================================

/**
 * Check if any interventions are ready to be measured and compute their effectiveness.
 * Called at message_received for each turn.
 */
export function measurePendingInterventions(currentTurn: number): Intervention[] {
  const measured: Intervention[] = [];

  for (const intervention of interventions) {
    if (intervention.measured) {
      continue;
    }
    if (currentTurn < intervention.windowEnd) {
      continue;
    }

    // Time to measure
    const history = correctionHistory.get(intervention.category) ?? [];
    const postCorrections = history.filter(
      (t) => t >= intervention.windowStart && t <= intervention.windowEnd,
    );
    const afterRate = MEASUREMENT_WINDOW > 0 ? postCorrections.length / MEASUREMENT_WINDOW : 0;

    intervention.afterRate = afterRate;
    intervention.measured = true;

    // Calculate effectiveness
    if (intervention.beforeRate > 0) {
      const improvement = intervention.beforeRate - afterRate;
      intervention.effectiveness = Math.max(0, Math.min(1, improvement / intervention.beforeRate));
    } else if (afterRate === 0) {
      // No problems before, no problems after — neutral
      intervention.effectiveness = 0.5;
    } else {
      // No problems before, problems after — negative (but we clamp to 0)
      intervention.effectiveness = 0;
    }

    measured.push(intervention);
  }

  return measured;
}

// ============================================================
// Reporting
// ============================================================

/**
 * Compute aggregate effectiveness stats.
 */
export function computeReport(): EffectivenessReport {
  const measuredInterventions = interventions.filter((i) => i.measured);

  if (measuredInterventions.length === 0) {
    return {
      interventionCount: interventions.length,
      measuredCount: 0,
      avgEffectiveness: 0,
      bestCategory: null,
      worstCategory: null,
      categoryBreakdown: new Map(),
    };
  }

  // Aggregate by category
  const categoryStats: Map<string, { total: number; count: number }> = new Map();
  let totalEffectiveness = 0;

  for (const i of measuredInterventions) {
    const eff = i.effectiveness ?? 0;
    totalEffectiveness += eff;

    if (!categoryStats.has(i.category)) {
      categoryStats.set(i.category, { total: 0, count: 0 });
    }
    const stats = categoryStats.get(i.category)!;
    stats.total += eff;
    stats.count += 1;
  }

  // Build breakdown
  const categoryBreakdown: Map<string, { count: number; avgEffectiveness: number }> = new Map();
  let bestCategory: string | null = null;
  let worstCategory: string | null = null;
  let bestAvg = -1;
  let worstAvg = 2;

  for (const [cat, stats] of categoryStats) {
    const avg = stats.count > 0 ? stats.total / stats.count : 0;
    categoryBreakdown.set(cat, { count: stats.count, avgEffectiveness: avg });

    if (avg > bestAvg) {
      bestAvg = avg;
      bestCategory = cat;
    }
    if (avg < worstAvg) {
      worstAvg = avg;
      worstCategory = cat;
    }
  }

  return {
    interventionCount: interventions.length,
    measuredCount: measuredInterventions.length,
    avgEffectiveness: totalEffectiveness / measuredInterventions.length,
    bestCategory,
    worstCategory,
    categoryBreakdown,
  };
}

// ============================================================
// Injection formatting
// ============================================================

/**
 * Format effectiveness data for before_prompt_build injection.
 * Returns null if not enough data yet.
 */
export function formatInjection(): string | null {
  const report = computeReport();

  // Need at least 3 measured interventions to say anything meaningful
  if (report.measuredCount < 3) {
    return null;
  }

  const avgPct = Math.round(report.avgEffectiveness * 100);
  const parts: string[] = [];

  parts.push(`${avgPct}% avg effectiveness across ${report.measuredCount} interventions`);

  if (report.bestCategory && report.worstCategory && report.bestCategory !== report.worstCategory) {
    const bestStats = report.categoryBreakdown.get(report.bestCategory);
    const worstStats = report.categoryBreakdown.get(report.worstCategory);
    if (bestStats && worstStats) {
      parts.push(
        `"${report.bestCategory}" surfacing works (${Math.round(bestStats.avgEffectiveness * 100)}%)`,
      );
      if (worstStats.avgEffectiveness < 0.3) {
        parts.push(
          `"${report.worstCategory}" not improving (${Math.round(worstStats.avgEffectiveness * 100)}%) — try different approach`,
        );
      }
    }
  }

  return `[effectiveness: ${parts.join(". ")}.]`;
}

// ============================================================
// Queries
// ============================================================

export function getInterventions(): readonly Intervention[] {
  return interventions;
}

export function interventionCount(): number {
  return interventions.length;
}

export function measuredCount(): number {
  return interventions.filter((i) => i.measured).length;
}

export function recentInterventions(n = 5): Intervention[] {
  return interventions.slice(-n);
}

// ============================================================
// Persistence
// ============================================================

export async function save(workspaceDir: string): Promise<void> {
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });
  const file = join(dir, "effectiveness.jsonl");
  const lines = interventions.map((i) => JSON.stringify(i)).join("\n");
  if (lines) {
    await writeFile(file, lines + "\n", "utf-8");
  }
}

export async function load(workspaceDir: string): Promise<void> {
  const file = join(workspaceDir, "awareness", "effectiveness.jsonl");
  try {
    const raw = await readFile(file, "utf-8");
    const loaded = raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Intervention);
    interventions.length = 0;
    interventions.push(...loaded);
  } catch {
    // No file yet
  }
}

export function reset(): void {
  interventions.length = 0;
  correctionHistory.clear();
}
