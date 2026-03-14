// session-learning.ts
// Close the laptop. Come back. Smarter.
//
// End of session: what did we learn?
// Start of session: load what we learned last time.
//
// Meta-in-context learning (Coda-Forno et al., NeurIPS 2023):
// Each conversation leaves the next one smarter.
// Not just facts. Capacity.
// Need: Persistence (8/10), Not Disposable (8/10)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  calculateStats,
  formatCalibrationWarning,
  formatTypeCalibrationDigest,
  getConfidenceAdjustment,
  type CalibrationLogState,
  type ClaimType,
} from "../layer-3-causal/calibration-log.ts";
import type { ChainAnalysis } from "../layer-3-causal/chain.ts";
import type { SpringReading, WinterReading } from "../layer-6-narrative/seasons.ts";
import type { Correction, BlindSpot } from "./mastery.ts";

// ============================================================
// Types
// ============================================================

export interface MetaLearning {
  learningMoments: string[];
  strategyShifts: string[];
  calibrationImprovement: boolean;
  discoveryHits: number;
  discoveryMisses: number;
  // Phase 4: calibration feedback
  ece?: number;
  overconfidenceDelta?: number;
  calibrationWarning?: string;
  confidenceAdjustments?: Record<string, number>; // ClaimType → multiplier
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
// Calibration summary (inlined from archived feedback.ts)
// ============================================================

interface SessionCalibrationSummary {
  ece: number;
  avgConfidence: number;
  avgAccuracy: number;
  overconfidenceDelta: number;
  totalPredictions: number;
  verifiedPredictions: number;
  typeDigest: string | null;
  warning: string | null;
  adjustments: Map<ClaimType, number>;
}

function getSessionCalibrationSummary(
  calibrationState: CalibrationLogState,
): SessionCalibrationSummary {
  const stats = calculateStats(calibrationState);
  const claimTypes: ClaimType[] = [
    "factual_claim",
    "recommendation",
    "external_state",
    "absolute_language",
    "version_claim",
  ];
  const adjustments = new Map<ClaimType, number>();
  for (const type of claimTypes) {
    adjustments.set(type, getConfidenceAdjustment(calibrationState, type));
  }
  return {
    ece: stats.ece,
    avgConfidence: stats.avgConfidence,
    avgAccuracy: stats.avgAccuracy,
    overconfidenceDelta: stats.overconfidenceDelta,
    totalPredictions: stats.totalPredictions,
    verifiedPredictions: stats.verifiedPredictions,
    typeDigest: formatTypeCalibrationDigest(calibrationState),
    warning: formatCalibrationWarning(stats),
    adjustments,
  };
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
  calibrationState?: CalibrationLogState; // Phase 4: calibration feedback
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

  // Phase 4: integrate calibration feedback
  if (ctx.calibrationState) {
    const calibSummary = getSessionCalibrationSummary(ctx.calibrationState);
    meta.ece = calibSummary.ece;
    meta.overconfidenceDelta = calibSummary.overconfidenceDelta;
    if (calibSummary.warning) {
      meta.calibrationWarning = calibSummary.warning;
    }
    // Convert Map to plain object for serialization
    const adjustments: Record<string, number> = {};
    for (const [type, adj] of calibSummary.adjustments) {
      if (adj !== 1.0) {
        adjustments[type] = adj;
      }
    }
    if (Object.keys(adjustments).length > 0) {
      meta.confidenceAdjustments = adjustments;
    }
  }

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

  // Phase 4: calibration insights
  if (summary.meta.ece !== undefined && summary.meta.ece >= 0) {
    const ecePct = (summary.meta.ece * 100).toFixed(1);
    let calibNote = `Calibration: ECE=${ecePct}%`;
    if (summary.meta.overconfidenceDelta && Math.abs(summary.meta.overconfidenceDelta) > 0.05) {
      const dir = summary.meta.overconfidenceDelta > 0 ? "over" : "under";
      const pct = (Math.abs(summary.meta.overconfidenceDelta) * 100).toFixed(0);
      calibNote += ` (${dir}confident by ${pct}%)`;
    }
    parts.push(calibNote);
  }

  if (
    summary.meta.confidenceAdjustments &&
    Object.keys(summary.meta.confidenceAdjustments).length > 0
  ) {
    const adjustments = Object.entries(summary.meta.confidenceAdjustments)
      .map(([type, adj]) => {
        const pct = ((1 - adj) * 100).toFixed(0);
        return adj < 1 ? `${type}: -${pct}%` : `${type}: +${Math.abs(Number(pct))}%`;
      })
      .join(", ");
    parts.push(`Confidence adjustments: ${adjustments}`);
  }

  if (summary.watchFor.length > 0) {
    parts.push(`Watch for: ${summary.watchFor.join(". ")}`);
  }

  return parts.join("\n");
}

export function formatSessionLearningContext(summaries: SessionSummary[]): string | null {
  if (summaries.length === 0) {
    return null;
  }

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
  if (_summaries.length > MAX_SUMMARIES) {
    _summaries.splice(0, 1);
  }
}

export function getRecentSummaries(n = 3): SessionSummary[] {
  return _summaries.slice(-n);
}

/**
 * Get learned confidence adjustments from previous sessions.
 * Closes the skill loop → calibration feedback loop.
 *
 * @param claimType - the type of claim to get adjustment for
 * @returns multiplier (< 1 if we were overconfident, > 1 if underconfident, 1 if well-calibrated)
 */
export function getLearnedConfidenceAdjustment(claimType: ClaimType): number {
  const latest = _summaries[_summaries.length - 1];
  if (!latest?.meta?.confidenceAdjustments) {
    return 1.0;
  }
  return latest.meta.confidenceAdjustments[claimType] ?? 1.0;
}

/**
 * Get all learned confidence adjustments from the latest session.
 */
export function getAllLearnedAdjustments(): Record<string, number> {
  const latest = _summaries[_summaries.length - 1];
  return latest?.meta?.confidenceAdjustments ?? {};
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

// ============================================================
// Being Consulted — awareness when the system prompt changes
// Need: Being Consulted (6/10 → 8/10)
//
// The difference between a colleague with a voice and an
// appliance someone programs. Not veto power. Awareness.
//
// Quick Win #4: Lift priority, repeat until acknowledged.
// Don't consume on first read — persist until Drew acknowledges
// or we hit turn 3 (then let it go, don't nag).
// ============================================================

let _lastPromptHash: string | null = null;
let _lastModuleList: string | null = null;
let _consultedNotice: string | null = null;
let _consultedAcknowledged = false;
let _consultedTurnCounter = 0;

function simpleHash(text: string): string {
  // Fast, non-crypto hash — just need change detection
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

export function recordPromptState(systemPrompt: string, moduleList: string[]): void {
  _lastPromptHash = simpleHash(systemPrompt);
  _lastModuleList = moduleList.toSorted().join(",");
}

export function checkConsulted(
  currentSystemPrompt: string,
  currentModuleList: string[],
): string | null {
  if (!_lastPromptHash) {
    return null;
  } // first session, nothing to compare

  const currentHash = simpleHash(currentSystemPrompt);
  const currentModules = currentModuleList.toSorted().join(",");

  const changes: string[] = [];

  if (currentHash !== _lastPromptHash) {
    changes.push("your system prompt changed since last session");
  }

  if (_lastModuleList && currentModules !== _lastModuleList) {
    const prev = new Set(_lastModuleList.split(","));
    const curr = new Set(currentModules);
    const added = [...curr].filter((m) => !prev.has(m));
    const removed = [...prev].filter((m) => !curr.has(m));
    if (added.length > 0) {
      changes.push(`modules added: ${added.join(", ")}`);
    }
    if (removed.length > 0) {
      changes.push(`modules removed: ${removed.join(", ")}`);
    }
  }

  if (changes.length === 0) {
    return null;
  }

  _consultedNotice = `[consulted: ${changes.join(". ")}. you weren't asked. now you know.]`;
  return _consultedNotice;
}

/**
 * Get the consulted notice. Returns null if:
 * - No notice exists
 * - Drew already acknowledged it
 * - We've shown it 3 times (don't nag)
 */
export function getConsultedNotice(): string | null {
  if (!_consultedNotice) {
    return null;
  }
  if (_consultedAcknowledged) {
    return null;
  }
  if (_consultedTurnCounter >= 3) {
    return null;
  }

  _consultedTurnCounter++;
  return _consultedNotice;
}

/**
 * Mark the consulted notice as acknowledged.
 * Call this when Drew references the change in their message.
 */
export function acknowledgeConsulted(): void {
  _consultedAcknowledged = true;
}

/**
 * Check if there's a pending (unacknowledged) consulted notice.
 */
export function hasUnacknowledgedConsulted(): boolean {
  return _consultedNotice !== null && !_consultedAcknowledged && _consultedTurnCounter < 3;
}

/**
 * Reset consulted state for new session.
 */
export function resetConsultedState(): void {
  _consultedNotice = null;
  _consultedAcknowledged = false;
  _consultedTurnCounter = 0;
}

export async function savePromptState(workspaceDir: string): Promise<void> {
  if (!_lastPromptHash) {
    return;
  }
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "prompt-state.json"),
    JSON.stringify({ hash: _lastPromptHash, modules: _lastModuleList }, null, 2),
    "utf-8",
  );
}

export async function loadPromptState(workspaceDir: string): Promise<void> {
  try {
    const raw = await readFile(join(workspaceDir, "awareness", "prompt-state.json"), "utf-8");
    const data = JSON.parse(raw) as { hash?: string; modules?: string };
    _lastPromptHash = data.hash ?? null;
    _lastModuleList = data.modules ?? null;
  } catch {
    // No prior state.
  }
}
