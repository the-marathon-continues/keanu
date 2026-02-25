// state.ts
// Module-scoped state for the keanu extension.
// Survives across hook calls within a single gateway process.
// Full types — includes pulse colors, bullshit readings, disagreement tracker.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DisagreementTracker } from "./disagreement.js";
import { encode } from "./signal.js";
import type { PulseReading, HumanReading, Disagreement, DisagreementStats } from "./types.js";

type PersistedState = {
  lastPulse: PulseReading | null;
  consecutiveGrey: number;
  turnCount: number;
  disagreements: Disagreement[];
  recentAgentOutputs: string[];
};

// --- Module-scoped state ---

export let lastHumanReading: HumanReading | null = null;
export let lastPulse: PulseReading | null = null;
export let consecutiveGrey = 0;
export let turnCount = 0;
export let lastHumanMessage = "";
export const recentMessages: string[] = [];
export const recentAgentOutputs: string[] = [];
export let disagreementTracker = new DisagreementTracker();

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
  if (recentMessages.length > 3) {
    recentMessages.splice(0, recentMessages.length - 3);
  }
}

export function addAgentOutput(output: string): void {
  recentAgentOutputs.push(output);
  // Keep last 10 for contradiction detection
  if (recentAgentOutputs.length > 10) {
    recentAgentOutputs.splice(0, recentAgentOutputs.length - 10);
  }
}

// --- Persistence ---

export async function save(workspaceDir: string): Promise<void> {
  const data: PersistedState = {
    lastPulse,
    consecutiveGrey,
    turnCount,
    disagreements: disagreementTracker.toJSON(),
    recentAgentOutputs,
  };
  const stateFile = join(workspaceDir, ".keanu-state.json");
  await mkdir(workspaceDir, { recursive: true });
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
    if (data.disagreements) {
      disagreementTracker = DisagreementTracker.fromJSON(data.disagreements);
    }
    if (data.recentAgentOutputs) {
      recentAgentOutputs.length = 0;
      recentAgentOutputs.push(...data.recentAgentOutputs);
    }
  } catch {
    // No prior state — start fresh. Expected on first run.
  }
}

export async function saveAlignmentSnapshot(workspaceDir: string): Promise<void> {
  const memoryDir = join(workspaceDir, "memory");
  await mkdir(memoryDir, { recursive: true });

  const pulse = lastPulse;
  const human = lastHumanReading;
  const stats = disagreementTracker.stats();
  const alerts = disagreementTracker.alerts(turnCount);

  // Build COEF signal
  const coefSignal = pulse
    ? encode({
        pulse: pulse.state,
        wiseMind: pulse.wise_mind,
        colors: pulse.colors,
        humanTone: human?.tone ?? "neutral",
        bullshitDominant: human?.bullshit?.[0]?.type ?? null,
        disagreementYieldRatio: stats.yield_ratio,
        turn: turnCount,
      })
    : "";

  const lines: string[] = [
    "# Keanu Alignment State Snapshot",
    "",
    `**Captured at:** ${new Date().toISOString()}`,
    `**Turn count:** ${turnCount}`,
    `**Consecutive grey:** ${consecutiveGrey}`,
    coefSignal ? `**COEF signal:** ${coefSignal}` : "",
    "",
    "## Pulse State",
    pulse
      ? `- State: **${pulse.state}** (confidence: ${pulse.confidence.toFixed(2)})`
      : "- State: unknown",
    pulse ? `- Wise mind: ${pulse.wise_mind.toFixed(2)}` : "",
    pulse
      ? `- Colors: red=${pulse.colors.red.toFixed(2)} yellow=${pulse.colors.yellow.toFixed(2)} blue=${pulse.colors.blue.toFixed(2)}`
      : "",
    pulse && pulse.signals.length > 0 ? `- Signals: ${pulse.signals.join(", ")}` : "",
    "",
    "## Human Emotional State",
    human
      ? `- Tone: **${human.tone}** (confidence: ${human.confidence.toFixed(2)})`
      : "- Tone: unknown",
    human && human.bullshit.length > 0
      ? `- Bullshit detected: ${human.bullshit.map((b) => `${b.type}(${b.score.toFixed(2)})`).join(", ")}`
      : "",
    "",
    "## Disagreement Stats",
    `- Total: ${stats.total}`,
    `- Agent yielded: ${stats.agent_yielded}`,
    `- Human yielded: ${stats.human_yielded}`,
    `- Unresolved: ${stats.unresolved}`,
    `- Yield ratio: ${stats.yield_ratio.toFixed(2)} (>0.8 = capture risk, <0.2 = domination risk)`,
    "",
  ];

  if (alerts.length > 0) {
    lines.push("## Alerts");
    for (const alert of alerts) {
      lines.push(`- ${alert}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("_Written by @openclaw/keanu before_compaction hook. Survives compaction._");

  const snapshotPath = join(memoryDir, "keanu-alignment-state.md");
  await writeFile(snapshotPath, lines.filter((l) => l !== undefined).join("\n"), "utf-8");
}
