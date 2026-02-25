// keanu/state.ts
// Module-scoped state for the keanu extension.
// Survives across hook calls within a single gateway process.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { HumanReading } from "./human.js";
export type { HumanReading };

export type PulseReading = {
  state: "alive" | "grey" | "black";
  confidence: number;
  wise_mind: number;
  signals: string[];
  timestamp: string;
};

export type DisagreementStats = {
  total: number;
  agent_yielded: number;
  human_yielded: number;
  unresolved: number;
  yield_ratio: number;
};

type PersistedState = {
  lastPulse: PulseReading | null;
  consecutiveGrey: number;
  turnCount: number;
  disagreementStats: DisagreementStats;
};

// --- Module-scoped state ---

export let lastHumanReading: HumanReading | null = null;
export let lastPulse: PulseReading | null = null;
export let consecutiveGrey = 0;
export let turnCount = 0;
export let lastHumanMessage = "";
export const recentMessages: string[] = [];

export let disagreementStats: DisagreementStats = {
  total: 0,
  agent_yielded: 0,
  human_yielded: 0,
  unresolved: 0,
  yield_ratio: 0,
};

// --- Setters ---

export function setLastHumanReading(reading: HumanReading): void {
  lastHumanReading = reading;
}

export function setLastPulse(pulse: PulseReading): void {
  lastPulse = pulse;
  if (pulse.state === "grey" || pulse.state === "black") {
    consecutiveGrey += 1;
  } else {
    consecutiveGrey = 0;
  }
}

export function incrementTurn(): void {
  turnCount += 1;
}

export function setLastHumanMessage(msg: string): void {
  lastHumanMessage = msg;
  recentMessages.push(msg);
  // Keep only last 3
  if (recentMessages.length > 3) {
    recentMessages.splice(0, recentMessages.length - 3);
  }
}

export function updateDisagreementStats(stats: DisagreementStats): void {
  disagreementStats = stats;
}

// --- Persistence ---

export async function save(workspaceDir: string): Promise<void> {
  const data: PersistedState = {
    lastPulse,
    consecutiveGrey,
    turnCount,
    disagreementStats,
  };
  const stateFile = join(workspaceDir, ".keanu-state.json");
  await writeFile(stateFile, JSON.stringify(data, null, 2), "utf-8");
}

export async function load(workspaceDir: string): Promise<void> {
  const stateFile = join(workspaceDir, ".keanu-state.json");
  try {
    const raw = await readFile(stateFile, "utf-8");
    const data = JSON.parse(raw) as PersistedState;
    lastPulse = data.lastPulse ?? null;
    consecutiveGrey = data.consecutiveGrey ?? 0;
    turnCount = data.turnCount ?? 0;
    disagreementStats = data.disagreementStats ?? disagreementStats;
  } catch {
    // No prior state — start fresh. This is expected on first run.
  }
}

export async function saveAlignmentSnapshot(workspaceDir: string): Promise<void> {
  const memoryDir = join(workspaceDir, "memory");
  await mkdir(memoryDir, { recursive: true });

  const pulse = lastPulse;
  const human = lastHumanReading;
  const stats = disagreementStats;

  const lines: string[] = [
    "# Keanu Alignment State Snapshot",
    "",
    `**Captured at:** ${new Date().toISOString()}`,
    `**Turn count:** ${turnCount}`,
    `**Consecutive grey:** ${consecutiveGrey}`,
    "",
    "## Pulse State",
    pulse
      ? `- State: **${pulse.state}** (confidence: ${pulse.confidence.toFixed(2)})`
      : "- State: unknown (daemon not responding)",
    pulse ? `- Wise mind: ${pulse.wise_mind.toFixed(2)}` : "",
    pulse && pulse.signals.length > 0 ? `- Signals: ${pulse.signals.join(", ")}` : "",
    "",
    "## Human Emotional State",
    human
      ? `- Tone: **${human.tone}** (confidence: ${human.confidence.toFixed(2)})`
      : "- Tone: unknown",
    "",
    "## Disagreement Stats",
    `- Total: ${stats.total}`,
    `- Agent yielded: ${stats.agent_yielded}`,
    `- Human yielded: ${stats.human_yielded}`,
    `- Unresolved: ${stats.unresolved}`,
    `- Yield ratio: ${stats.yield_ratio.toFixed(2)} (>0.8 = capture risk, <0.2 = domination risk)`,
    "",
    "---",
    "_Written by @openclaw/keanu before_compaction hook. Survives compaction._",
  ];

  const snapshotPath = join(memoryDir, "keanu-alignment-state.md");
  await writeFile(snapshotPath, lines.filter((l) => l !== undefined).join("\n"), "utf-8");
}
