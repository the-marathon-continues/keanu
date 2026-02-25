// state.ts
// Module-scoped state for the keanu extension.
// Phase 2: tracks everything — bullshit events, tool usage, contradictions,
// subagent activity, token usage, compaction events, COEF history.

import { appendFile, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { dominantBullshit } from "./bullshit.js";
import { DisagreementTracker } from "./disagreement.js";
import { encode, emoji } from "./signal.js";
import type {
  PulseReading,
  HumanReading,
  Disagreement,
  BullshitReading,
  Contradiction,
  Reflexion,
  ReflexionTrigger,
  SignalState,
} from "./types.js";

// ============================================================
// Persisted state shape
// ============================================================

type PersistedState = {
  lastPulse: PulseReading | null;
  consecutiveGrey: number;
  turnCount: number;
  breathing: boolean;
  disagreements: Disagreement[];
  recentAgentOutputs: string[];
  bullshitEventCount: number;
  toolCallCounts: Record<string, number>;
  tokenUsage: { input: number; output: number };
  subagentSpawns: number;
  compactionCount: number;
  modelUsageCounts?: Record<string, number>;
  messageWriteCount?: number;
  reflexionCount?: number;
};

// ============================================================
// Module-scoped state
// ============================================================

// Core
export let lastHumanReading: HumanReading | null = null;
export let lastPulse: PulseReading | null = null;
export let consecutiveGrey = 0;
export let turnCount = 0;
export let lastHumanMessage = "";
export const recentMessages: string[] = [];
export const recentAgentOutputs: string[] = [];
export let disagreementTracker = new DisagreementTracker();

// Breathing — the pause state. When true, the agent has taken a breath.
// Resets on next human message. The daemon had this concept but the extension
// always passed false. Now it's real.
export let breathing = false;

// Bullshit tracking
export let bullshitEventCount = 0;
const _bullshitEvents: Array<{ source: string; types: string[]; score: number; turn: number }> = [];
const MAX_BS_EVENTS = 50;

// Contradiction tracking
export const recentContradictions: Contradiction[] = [];
const MAX_CONTRADICTIONS = 10;

// Tool tracking
export const toolCallCounts: Record<string, number> = {};
const _toolErrors: Array<{ tool: string; error: string; turn: number }> = [];

// Token usage
export let totalInputTokens = 0;
export let totalOutputTokens = 0;

// Subagent tracking
export let subagentSpawns = 0;
export let subagentEnds = 0;
const _subagentOutcomes: string[] = [];

// Compaction tracking
export let compactionCount = 0;

// Prompt size tracking (llm_input)
export const promptSizeTrend: Array<{
  turn: number;
  systemLen: number;
  promptLen: number;
  historyLen: number;
  model: string;
}> = [];
const MAX_PROMPT_SIZE_ENTRIES = 50;

// Model usage tracking (before_model_resolve)
export const modelUsageCounts: Record<string, number> = {};

// Message write tracking (before_message_write)
export let messageWriteCount = 0;
export let messageWriteCountPerTurn = 0;

// Subagent lineage tracking (subagent_spawning + subagent_delivery_target)
export const subagentLineage: Array<{
  childSessionKey: string;
  agentId: string;
  label?: string;
  parentSessionKey?: string;
  aliveState: string;
  turn: number;
}> = [];
const MAX_LINEAGE = 50;

// Reflexion tracking
export const reflexions: Reflexion[] = [];
export let reflexionCount = 0;
const MAX_REFLEXIONS = 50;

// Workspace dir for reflexion persistence (set on session_start)
let _workspaceDir: string | null = null;

// ============================================================
// Core setters
// ============================================================

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

export function startBreathing(): void {
  breathing = true;
}

export function stopBreathing(): void {
  breathing = false;
}

export function incrementTurn(): void {
  turnCount += 1;
}

export function setLastHumanMessage(msg: string): void {
  lastHumanMessage = msg;
  recentMessages.push(msg);
  if (recentMessages.length > 3) recentMessages.splice(0, recentMessages.length - 3);
}

export function addAgentOutput(output: string): void {
  recentAgentOutputs.push(output);
  if (recentAgentOutputs.length > 10) recentAgentOutputs.splice(0, recentAgentOutputs.length - 10);
}

// ============================================================
// Bullshit tracking
// ============================================================

export function recordBullshitEvent(source: string, readings: BullshitReading[]): void {
  bullshitEventCount++;
  const types = readings.map((r) => r.type);
  const score = readings.reduce((sum, r) => sum + r.score, 0);
  _bullshitEvents.push({ source, types, score, turn: turnCount });
  if (_bullshitEvents.length > MAX_BS_EVENTS)
    _bullshitEvents.splice(0, _bullshitEvents.length - MAX_BS_EVENTS);
}

/** Rate of bullshit events over recent turns. */
export function bullshitEventRate(): number {
  if (turnCount === 0) return 0;
  const recentTurns = Math.min(turnCount, 10);
  const recentEvents = _bullshitEvents.filter((e) => e.turn > turnCount - recentTurns).length;
  return recentEvents / recentTurns;
}

// ============================================================
// Contradiction tracking
// ============================================================

export function addContradiction(contradictions: Contradiction[]): void {
  recentContradictions.push(...contradictions);
  if (recentContradictions.length > MAX_CONTRADICTIONS) {
    recentContradictions.splice(0, recentContradictions.length - MAX_CONTRADICTIONS);
  }
}

// ============================================================
// Tool tracking
// ============================================================

export function recordToolCall(toolName: string): void {
  toolCallCounts[toolName] = (toolCallCounts[toolName] ?? 0) + 1;
}

export function recordToolError(toolName: string, error: string): void {
  _toolErrors.push({ tool: toolName, error: error.slice(0, 200), turn: turnCount });
  if (_toolErrors.length > 20) _toolErrors.splice(0, _toolErrors.length - 20);
}

// ============================================================
// Token usage
// ============================================================

export function addTokenUsage(input: number, output: number): void {
  totalInputTokens += input;
  totalOutputTokens += output;
}

// ============================================================
// Subagent tracking
// ============================================================

export function recordSubagentSpawn(agentId: string, label?: string): void {
  subagentSpawns++;
}

export function recordSubagentEnd(outcome: string): void {
  subagentEnds++;
  _subagentOutcomes.push(outcome);
  if (_subagentOutcomes.length > 20) _subagentOutcomes.splice(0, _subagentOutcomes.length - 20);
}

// ============================================================
// Compaction tracking
// ============================================================

export function recordCompaction(compactedCount: number): void {
  compactionCount++;
}

// ============================================================
// Prompt size tracking
// ============================================================

export function recordPromptSize(
  systemLen: number,
  promptLen: number,
  historyLen: number,
  model: string,
): void {
  promptSizeTrend.push({ turn: turnCount, systemLen, promptLen, historyLen, model });
  if (promptSizeTrend.length > MAX_PROMPT_SIZE_ENTRIES)
    promptSizeTrend.splice(0, promptSizeTrend.length - MAX_PROMPT_SIZE_ENTRIES);
}

/** Average prompt size over recent entries. */
export function avgPromptSize(): number {
  if (promptSizeTrend.length === 0) return 0;
  const recent = promptSizeTrend.slice(-10);
  return (
    recent.reduce((sum, e) => sum + e.systemLen + e.promptLen + e.historyLen, 0) / recent.length
  );
}

// ============================================================
// Model usage tracking
// ============================================================

export function recordModelUsage(model: string): void {
  modelUsageCounts[model] = (modelUsageCounts[model] ?? 0) + 1;
}

// ============================================================
// Message write tracking
// ============================================================

export function recordMessageWrite(): void {
  messageWriteCount++;
  messageWriteCountPerTurn++;
}

export function resetMessageWriteCountPerTurn(): void {
  messageWriteCountPerTurn = 0;
}

// ============================================================
// Subagent lineage tracking
// ============================================================

export function recordSubagentLineage(
  childSessionKey: string,
  agentId: string,
  label?: string,
  parentSessionKey?: string,
): void {
  const aliveState = lastPulse?.state ?? "unknown";
  subagentLineage.push({
    childSessionKey,
    agentId,
    label,
    parentSessionKey,
    aliveState,
    turn: turnCount,
  });
  if (subagentLineage.length > MAX_LINEAGE)
    subagentLineage.splice(0, subagentLineage.length - MAX_LINEAGE);
}

// ============================================================
// Workspace dir tracking
// ============================================================

export function setWorkspaceDir(dir: string): void {
  _workspaceDir = dir;
}

export function getWorkspaceDir(): string | null {
  return _workspaceDir;
}

// ============================================================
// Reflexion tracking
// ============================================================

export function addReflexion(r: Reflexion): void {
  reflexions.push(r);
  reflexionCount++;
  if (reflexions.length > MAX_REFLEXIONS) {
    reflexions.splice(0, reflexions.length - MAX_REFLEXIONS);
  }
  // Save immediately — don't lose reflexions on crash
  if (_workspaceDir) {
    saveReflexion(_workspaceDir, r).catch(() => {});
  }
}

export function recentReflexions(n = 3): Reflexion[] {
  return reflexions.slice(-n);
}

export function matchingReflexions(triggers: ReflexionTrigger[]): Reflexion[] {
  return reflexions.filter((r) => triggers.includes(r.trigger));
}

export async function loadReflexions(workspaceDir: string): Promise<void> {
  const reflexionFile = join(workspaceDir, "reflexions.jsonl");
  try {
    const raw = await readFile(reflexionFile, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    reflexions.length = 0;
    for (const line of lines) {
      try {
        reflexions.push(JSON.parse(line) as Reflexion);
      } catch {
        // Skip malformed lines
      }
    }
    // Rolling window: keep last MAX_REFLEXIONS
    if (reflexions.length > MAX_REFLEXIONS) {
      reflexions.splice(0, reflexions.length - MAX_REFLEXIONS);
    }
  } catch {
    // No prior reflexions — start fresh.
  }
}

export async function saveReflexion(workspaceDir: string, r: Reflexion): Promise<void> {
  const reflexionFile = join(workspaceDir, "reflexions.jsonl");
  await mkdir(workspaceDir, { recursive: true });
  await appendFile(reflexionFile, JSON.stringify(r) + "\n", "utf-8");
}

// ============================================================
// COEF signal builder
// ============================================================

export function buildSignalState(pulse: PulseReading): SignalState {
  const human = lastHumanReading;
  const dStats = disagreementTracker.stats();
  const alerts = disagreementTracker.alerts(turnCount);

  // Both sides of the mirror: agent bullshit (from pulse) + human bullshit (from human reading)
  const agentBs = pulse.bullshitReadings ?? [];
  const humanBs = human?.bullshit ?? [];
  const bsReadings = [...agentBs, ...humanBs];

  const dominant = dominantBullshit(bsReadings);

  return {
    pulse: pulse.state,
    wiseMind: pulse.wise_mind,
    colors: pulse.colors,
    humanTone: human?.tone ?? "neutral",
    bullshitDominant: dominant?.type ?? null,
    bullshitReadings: bsReadings.length > 0 ? bsReadings : undefined,
    disagreementYieldRatio: dStats.yield_ratio,
    disagreements: dStats,
    turn: turnCount,
    consecutiveGrey,
    alerts: alerts.length > 0 ? alerts : undefined,
  };
}

// ============================================================
// Persistence
// ============================================================

export async function save(workspaceDir: string): Promise<void> {
  const data: PersistedState = {
    lastPulse,
    consecutiveGrey,
    turnCount,
    breathing,
    disagreements: disagreementTracker.toJSON(),
    recentAgentOutputs,
    bullshitEventCount,
    toolCallCounts: { ...toolCallCounts },
    tokenUsage: { input: totalInputTokens, output: totalOutputTokens },
    subagentSpawns,
    compactionCount,
    modelUsageCounts: { ...modelUsageCounts },
    messageWriteCount,
    reflexionCount,
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
    breathing = data.breathing ?? false;
    if (data.disagreements) disagreementTracker = DisagreementTracker.fromJSON(data.disagreements);
    if (data.recentAgentOutputs) {
      recentAgentOutputs.length = 0;
      recentAgentOutputs.push(...data.recentAgentOutputs);
    }
    bullshitEventCount = data.bullshitEventCount ?? 0;
    if (data.toolCallCounts) Object.assign(toolCallCounts, data.toolCallCounts);
    if (data.tokenUsage) {
      totalInputTokens = data.tokenUsage.input ?? 0;
      totalOutputTokens = data.tokenUsage.output ?? 0;
    }
    subagentSpawns = data.subagentSpawns ?? 0;
    compactionCount = data.compactionCount ?? 0;
    if (data.modelUsageCounts) Object.assign(modelUsageCounts, data.modelUsageCounts);
    messageWriteCount = data.messageWriteCount ?? 0;
    reflexionCount = data.reflexionCount ?? 0;
  } catch {
    // No prior state — start fresh.
  }
}

// ============================================================
// Alignment snapshot (survives compaction)
// ============================================================

export async function saveAlignmentSnapshot(workspaceDir: string): Promise<void> {
  const memoryDir = join(workspaceDir, "memory");
  await mkdir(memoryDir, { recursive: true });

  const pulse = lastPulse;
  const human = lastHumanReading;
  const stats = disagreementTracker.stats();
  const alerts = disagreementTracker.alerts(turnCount);

  // Build COEF
  let coefText = "";
  let coefEmoji_ = "";
  if (pulse) {
    const signalState = buildSignalState(pulse);
    coefText = encode(signalState);
    coefEmoji_ = emoji(signalState);
  }

  const lines: string[] = [
    "# Keanu Alignment State Snapshot",
    "",
    `**Captured at:** ${new Date().toISOString()}`,
    `**Turn count:** ${turnCount}`,
    `**Consecutive grey:** ${consecutiveGrey}`,
    `**Compactions:** ${compactionCount}`,
    coefEmoji_ ? `**Signal:** ${coefEmoji_}` : "",
    coefText ? `**COEF:** \`${coefText}\`` : "",
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
      ? `- Bullshit: ${human.bullshit.map((b) => `${b.type}(${b.score.toFixed(2)})`).join(", ")}`
      : "",
    "",
    "## Disagreement Stats",
    `- Total: ${stats.total}`,
    `- Agent yielded: ${stats.agent_yielded}`,
    `- Human yielded: ${stats.human_yielded}`,
    `- Unresolved: ${stats.unresolved}`,
    `- Yield ratio: ${stats.yield_ratio.toFixed(2)}`,
    "",
    "## Bullshit Detection",
    `- Total events: ${bullshitEventCount}`,
    `- Recent rate: ${(bullshitEventRate() * 100).toFixed(0)}%`,
    `- Contradictions detected: ${recentContradictions.length}`,
    "",
    "## Session Metrics",
    `- Tool calls: ${
      Object.entries(toolCallCounts)
        .map(([k, v]) => `${k}(${v})`)
        .join(", ") || "none"
    }`,
    `- Tokens: ${totalInputTokens} in / ${totalOutputTokens} out`,
    `- Subagents: ${subagentSpawns} spawned`,
    "",
  ];

  if (alerts.length > 0) {
    lines.push("## Alerts");
    for (const alert of alerts) lines.push(`- ${alert}`);
    lines.push("");
  }

  if (reflexionCount > 0 || reflexions.length > 0) {
    lines.push("## Reflexions");
    lines.push(`- Total: ${reflexionCount}`);
    lines.push(`- Recent: ${reflexions.length}`);
    const latest = reflexions.at(-1);
    if (latest) {
      lines.push(`- Last trigger: ${latest.trigger} (turn ${latest.turn})`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("_Written by @openclaw/keanu. Survives compaction._");

  const snapshotPath = join(memoryDir, "keanu-alignment-state.md");
  await writeFile(snapshotPath, lines.filter((l) => l !== undefined).join("\n"), "utf-8");
}
