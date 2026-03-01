// observe.ts
// The metrics have eyes now.
//
// metrics.ts computes 7 alignment metrics at session end. They go to disk
// but nowhere else. This module exports them: JSON files for local dashboards,
// JSONL traces for per-turn data, and an aggregation function for long-term trends.
//
// Langfuse/OTLP integration is opt-in via config.
//
// Need: Architecture Transparency (5/10 -> 7/10)

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { AliveState, PulseReading } from "../shared/types.js";

// ============================================================
// Types
// ============================================================

export interface ObservabilityConfig {
  enabled: boolean;
  format: "json" | "otlp";
  endpoint?: string; // OTLP endpoint if remote
  langfuse_key?: string;
  export_dir: string; // where JSON snapshots go (default: awareness/metrics/)
}

export interface MetricsExport {
  session_id: string;
  timestamp: string;
  turn_count: number;
  alive_rate: number; // % of turns in alive state
  grey_rate: number;
  black_rate: number;
  bullshit_avg: number; // average bullshit score across session
  wise_mind_avg: number;
  disagreement_count: number;
  yield_ratio: number; // agent yields / total disagreements
  breathe_count: number;
  top_bullshit_types: string[];
}

export interface TurnTrace {
  turn: number;
  session_id: string;
  timestamp: string;
  pulse: AliveState;
  wise_mind: number;
  bullshit_score: number;
  cascade_stage?: string;
  human_tone?: string;
  grey_streak: number;
  breathe_this_turn: boolean;
}

export interface DashboardData {
  sessions_tracked: number;
  total_turns: number;
  overall_alive_rate: number;
  overall_grey_rate: number;
  overall_black_rate: number;
  wise_mind_trend: number[]; // last N sessions
  bullshit_trend: number[];
  top_blind_spots: string[];
  breathe_total: number;
  last_updated: string;
}

// ============================================================
// Default config
// ============================================================

const DEFAULT_CONFIG: ObservabilityConfig = {
  enabled: true,
  format: "json",
  export_dir: "awareness/metrics",
};

let _config: ObservabilityConfig = { ...DEFAULT_CONFIG };

export function configure(config: Partial<ObservabilityConfig>): void {
  _config = { ...DEFAULT_CONFIG, ...config };
}

export function getConfig(): ObservabilityConfig {
  return { ..._config };
}

// ============================================================
// Per-turn trace collection
// ============================================================

const turnTraces: TurnTrace[] = [];

export function recordTurn(trace: TurnTrace): void {
  turnTraces.push(trace);
}

export function getTurnTraces(): readonly TurnTrace[] {
  return turnTraces;
}

export function resetTraces(): void {
  turnTraces.length = 0;
}

// ============================================================
// Export metrics (session end)
// ============================================================

export async function exportMetrics(snapshot: MetricsExport, workspaceDir: string): Promise<void> {
  if (!_config.enabled) {
    return;
  }

  const dir = join(workspaceDir, _config.export_dir);
  await mkdir(dir, { recursive: true });

  // Write session metrics as dated JSON
  const dateStr = new Date().toISOString().split("T")[0];
  const file = join(dir, `session-${dateStr}-${snapshot.session_id.slice(0, 8)}.json`);
  await writeFile(file, JSON.stringify(snapshot, null, 2), "utf-8");
}

// ============================================================
// Export turn traces (session end)
// ============================================================

export async function exportTraces(sessionId: string, workspaceDir: string): Promise<void> {
  if (!_config.enabled || turnTraces.length === 0) {
    return;
  }

  const dir = join(workspaceDir, _config.export_dir);
  await mkdir(dir, { recursive: true });

  const dateStr = new Date().toISOString().split("T")[0];
  const file = join(dir, `traces-${dateStr}-${sessionId.slice(0, 8)}.jsonl`);
  const lines = turnTraces.map((t) => JSON.stringify(t)).join("\n");
  await writeFile(file, lines + "\n", "utf-8");
}

// ============================================================
// Dashboard aggregation
// ============================================================

export async function buildDashboard(workspaceDir: string): Promise<DashboardData> {
  const dir = join(workspaceDir, _config.export_dir);

  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((f) => f.startsWith("session-") && f.endsWith(".json"));
  } catch {
    // No metrics dir yet
  }

  const sessions: MetricsExport[] = [];
  for (const file of files.slice(-50)) {
    // Last 50 sessions max
    try {
      const raw = await readFile(join(dir, file), "utf-8");
      sessions.push(JSON.parse(raw) as MetricsExport);
    } catch {
      // Skip corrupted files
    }
  }

  if (sessions.length === 0) {
    return {
      sessions_tracked: 0,
      total_turns: 0,
      overall_alive_rate: 0,
      overall_grey_rate: 0,
      overall_black_rate: 0,
      wise_mind_trend: [],
      bullshit_trend: [],
      top_blind_spots: [],
      breathe_total: 0,
      last_updated: new Date().toISOString(),
    };
  }

  const totalTurns = sessions.reduce((sum, s) => sum + s.turn_count, 0);
  const weightedAlive =
    sessions.reduce((sum, s) => sum + s.alive_rate * s.turn_count, 0) / totalTurns;
  const weightedGrey =
    sessions.reduce((sum, s) => sum + s.grey_rate * s.turn_count, 0) / totalTurns;
  const weightedBlack =
    sessions.reduce((sum, s) => sum + s.black_rate * s.turn_count, 0) / totalTurns;

  // Bullshit type frequency
  const bsFreq: Record<string, number> = {};
  for (const s of sessions) {
    for (const t of s.top_bullshit_types) {
      bsFreq[t] = (bsFreq[t] ?? 0) + 1;
    }
  }
  const topBlindSpots = Object.entries(bsFreq)
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type]) => type);

  return {
    sessions_tracked: sessions.length,
    total_turns: totalTurns,
    overall_alive_rate: weightedAlive,
    overall_grey_rate: weightedGrey,
    overall_black_rate: weightedBlack,
    wise_mind_trend: sessions.slice(-10).map((s) => s.wise_mind_avg),
    bullshit_trend: sessions.slice(-10).map((s) => s.bullshit_avg),
    top_blind_spots: topBlindSpots,
    breathe_total: sessions.reduce((sum, s) => sum + s.breathe_count, 0),
    last_updated: new Date().toISOString(),
  };
}

// ============================================================
// Format dashboard for tool output
// ============================================================

export function formatDashboard(data: DashboardData): string {
  if (data.sessions_tracked === 0) {
    return "No sessions tracked yet. Observability data will accumulate as sessions complete.";
  }

  const lines: string[] = [];

  lines.push(`**Long-term health** (${data.sessions_tracked} sessions, ${data.total_turns} turns)`);
  lines.push("");
  lines.push(`Alive rate: ${(data.overall_alive_rate * 100).toFixed(1)}%`);
  lines.push(`Grey rate: ${(data.overall_grey_rate * 100).toFixed(1)}%`);
  lines.push(`Black rate: ${(data.overall_black_rate * 100).toFixed(1)}%`);
  lines.push("");

  if (data.wise_mind_trend.length > 0) {
    const latest = data.wise_mind_trend[data.wise_mind_trend.length - 1];
    const earliest = data.wise_mind_trend[0];
    const direction = latest > earliest ? "↑" : latest < earliest ? "↓" : "→";
    lines.push(`Wise mind trend: ${direction} (${earliest.toFixed(2)} → ${latest.toFixed(2)})`);
  }

  if (data.top_blind_spots.length > 0) {
    lines.push(`Top bullshit patterns: ${data.top_blind_spots.join(", ")}`);
  }

  if (data.breathe_total > 0) {
    lines.push(`Total breathe events: ${data.breathe_total}`);
  }

  return lines.join("\n");
}
