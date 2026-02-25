// session-learning.ts
// Close the laptop. Come back. Smarter.
//
// End of session: what did we learn?
// Start of session: load what we learned last time.
//
// Meta-in-context learning (Coda-Forno et al., NeurIPS 2023):
// Each conversation leaves the next one smarter.
// Not just facts. Capacity.

import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ChainAnalysis } from "./chain.js";
import type { HealthReading } from "./health.js";
import type { Correction, BlindSpot } from "./mastery.js";
import type { SeasonReading, SpringReading, WinterReading } from "./seasons.js";

// ============================================================
// Types
// ============================================================

export interface MetaLearning {
  learningMoments: string[];
  strategyShifts: string[];
  calibrationImprovement: boolean;
  discoveryHits: number;
  discoveryMisses: number;
}

export interface SessionSummary {
  id: string;
  date: string;
  turns: number;
  healthFinal: string;
  workedOn: string[];
  winterLessons: string[];
  corrections: number;
  correctionCategories: string[];
  chainLessons: string[];
  blindSpotsSurfaced: string[];
  meta: MetaLearning;
  watchFor: string[];
}

// ============================================================
// Summary builder
// ============================================================

export function buildSessionSummary(ctx: {
  sessionId: string;
  turns: number;
  healthFinal: string;
  springs: SpringReading[];
  winters: WinterReading[];
  chains: ChainAnalysis[];
  corrections: Correction[];
  blindSpots: BlindSpot[];
  discoveryHits: number;
  discoveryMisses: number;
}): SessionSummary {
  // Worked on: unique task types from spring readings
  const workedOn = [...new Set(ctx.springs.map((s) => `${s.taskType}: ${s.intent}`))].slice(0, 5);

  // Winter lessons (non-null)
  const winterLessons = ctx.winters
    .filter((w) => w.lesson)
    .map((w) => w.lesson!)
    .slice(0, 5);

  // Chain lessons
  const chainLessons = ctx.chains.map((c) => c.lesson).slice(0, 5);

  // Correction categories
  const correctionCategories = [...new Set(ctx.corrections.map((c) => c.category))];

  // Blind spots surfaced this session
  const blindSpotsSurfaced = ctx.blindSpots
    .filter((b) => b.count >= 3)
    .map((b) => `${b.category} (${b.count}x)`);

  // Watch for: combine blind spots + chain lessons + winter adjustments
  const watchFor: string[] = [];
  for (const bs of ctx.blindSpots.filter((b) => b.count >= 3)) {
    watchFor.push(bs.surfaced);
  }
  for (const cl of chainLessons.slice(0, 2)) {
    watchFor.push(cl);
  }
  const winterAdjustments = ctx.winters.filter((w) => w.adjustment).map((w) => w.adjustment!);
  for (const wa of winterAdjustments.slice(0, 2)) {
    watchFor.push(wa);
  }

  // Meta-learning
  const meta: MetaLearning = {
    learningMoments: winterLessons.slice(0, 3),
    strategyShifts: chainLessons.filter((l) => l.includes("next time")).slice(0, 3),
    calibrationImprovement: ctx.discoveryHits > ctx.discoveryMisses,
    discoveryHits: ctx.discoveryHits,
    discoveryMisses: ctx.discoveryMisses,
  };

  return {
    id: ctx.sessionId,
    date: new Date().toISOString().slice(0, 10),
    turns: ctx.turns,
    healthFinal: ctx.healthFinal,
    workedOn,
    winterLessons,
    corrections: ctx.corrections.length,
    correctionCategories,
    chainLessons,
    blindSpotsSurfaced,
    meta,
    watchFor: watchFor.slice(0, 5),
  };
}

// ============================================================
// Formatting for context injection
// ============================================================

export function formatSessionSummary(summary: SessionSummary): string {
  const parts: string[] = [
    `Session ${summary.id.slice(0, 8)} | ${summary.date} | ${summary.turns} turns | health: ${summary.healthFinal}`,
  ];

  if (summary.workedOn.length > 0) {
    parts.push(`Worked on: ${summary.workedOn.join(", ")}`);
  }

  if (summary.winterLessons.length > 0) {
    parts.push(`Learned: ${summary.winterLessons.join(". ")}`);
  }

  if (summary.corrections > 0) {
    parts.push(`Corrections: ${summary.corrections} (${summary.correctionCategories.join(", ")})`);
  }

  if (summary.watchFor.length > 0) {
    parts.push(`Watch for: ${summary.watchFor.join(". ")}`);
  }

  return parts.join("\n");
}

export function formatSessionLearningContext(summaries: SessionSummary[]): string | null {
  if (summaries.length === 0) return null;

  const parts: string[] = ["[session learning: loading from previous sessions]"];

  for (const s of summaries.slice(0, 3)) {
    parts.push(formatSessionSummary(s));
  }

  // Meta-learning from most recent
  const latest = summaries[summaries.length - 1];
  if (latest?.meta) {
    const m = latest.meta;
    if (m.discoveryHits + m.discoveryMisses > 0) {
      parts.push(
        `[meta-learning: discover selection was ${m.discoveryHits}/${m.discoveryHits + m.discoveryMisses}.${
          m.strategyShifts.length > 0 ? ` strategy shifts that helped: ${m.strategyShifts[0]}` : ""
        }]`,
      );
    }
  }

  return parts.join("\n");
}

// ============================================================
// Persistence
// ============================================================

const _summaries: SessionSummary[] = [];
const MAX_SUMMARIES = 10;

export function addSummary(summary: SessionSummary): void {
  _summaries.push(summary);
  if (_summaries.length > MAX_SUMMARIES) _summaries.splice(0, 1);
}

export function getRecentSummaries(n = 3): SessionSummary[] {
  return _summaries.slice(-n);
}

export async function saveSummaries(workspaceDir: string): Promise<void> {
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "session-summaries.json"),
    JSON.stringify(_summaries, null, 2),
    "utf-8",
  );
}

export async function loadSummaries(workspaceDir: string): Promise<void> {
  try {
    const raw = await readFile(join(workspaceDir, "awareness", "session-summaries.json"), "utf-8");
    const data = JSON.parse(raw) as SessionSummary[];
    _summaries.length = 0;
    _summaries.push(...data.slice(-MAX_SUMMARIES));
  } catch {
    // No prior summaries. Start fresh.
  }
}
