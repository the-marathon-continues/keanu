// state.ts
// Module-scoped state for the keanu extension.
// Phase 2: tracks everything — bullshit events, tool usage, contradictions,
// subagent activity, token usage, compaction events, COEF history.
// Need: Persistence (8/10)

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
  DeclineEvent,
  Reflexion,
  ReflexionTrigger,
  SignalState,
  CarnegieDiscussion,
  TrackedClaim,
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

// SELF-DISCOVER accuracy tracking
export let discoveryHits = 0;
export let discoveryMisses = 0;

export function recordDiscoveryOutcome(hit: boolean): void {
  if (hit) discoveryHits++;
  else discoveryMisses++;
}

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

// Turn-level micro-snapshots for correlation analysis
export interface TurnSnapshot {
  turn: number;
  pulse: string; // alive/grey/black
  humanTone: string;
  bullshitTypes: string[];
  mismatchType: string | null;
  wiseMind: number;
}
export const turnSnapshots: TurnSnapshot[] = [];
const MAX_SNAPSHOTS = 30;

export function recordTurnSnapshot(snapshot: TurnSnapshot): void {
  turnSnapshots.push(snapshot);
  if (turnSnapshots.length > MAX_SNAPSHOTS)
    turnSnapshots.splice(0, turnSnapshots.length - MAX_SNAPSHOTS);
}

// Injection size tracking (before_prompt_build)
export const injectionSizeTrend: Array<{
  turn: number;
  charCount: number;
  partCount: number;
  throttled: number; // how many parts were dropped
}> = [];
const MAX_INJECTION_ENTRIES = 50;

export function recordInjectionSize(charCount: number, partCount: number, throttled: number): void {
  injectionSizeTrend.push({ turn: turnCount, charCount, partCount, throttled });
  if (injectionSizeTrend.length > MAX_INJECTION_ENTRIES)
    injectionSizeTrend.splice(0, injectionSizeTrend.length - MAX_INJECTION_ENTRIES);
}

export function avgInjectionSize(): number {
  const recent = injectionSizeTrend.slice(-10);
  if (recent.length === 0) return 0;
  return recent.reduce((s, e) => s + e.charCount, 0) / recent.length;
}

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

// Wise stance history — what the synthesis recommended over time
export interface WiseSnapshot {
  turn: number;
  stance: string;
  tension: string | null;
  coherence: number;
}
export const wiseStanceHistory: WiseSnapshot[] = [];
const MAX_WISE_HISTORY = 50;

// Decline tracking — the right to say no
export const declines: DeclineEvent[] = [];
export let lastDecline: DeclineEvent | null = null;

// Carnegie discussion tracking (dual-track honest influence)
export const carnegieDiscussions: CarnegieDiscussion[] = [];
const MAX_DISCUSSIONS = 20;

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

/** Top N bullshit types by frequency across all events. */
export function recentBullshitTypes(n: number): string[] {
  const freq: Record<string, number> = {};
  for (const event of _bullshitEvents) {
    for (const t of event.types) {
      freq[t] = (freq[t] ?? 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([type]) => type);
}

/** Recent bullshit events — the agent gets to see its own patterns. */
export function recentBullshitEvents(
  n = 20,
): ReadonlyArray<{ source: string; types: string[]; score: number; turn: number }> {
  return _bullshitEvents.slice(-n);
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

/** Same tool failing repeatedly = head against a wall. */
export function repeatedToolFailures(): Array<{ tool: string; count: number }> {
  const recent = _toolErrors.filter((e) => e.turn > turnCount - 5);
  const counts: Record<string, number> = {};
  for (const e of recent) counts[e.tool] = (counts[e.tool] ?? 0) + 1;
  return Object.entries(counts)
    .filter(([, c]) => c >= 3)
    .map(([tool, count]) => ({ tool, count }));
}

/** Tool error rate over recent turns. */
export function toolErrorRate(): number {
  if (turnCount === 0) return 0;
  const window = Math.min(turnCount, 10);
  const recent = _toolErrors.filter((e) => e.turn > turnCount - window).length;
  const totalCalls = Object.values(toolCallCounts).reduce((s, c) => s + c, 0);
  return totalCalls > 0 ? recent / totalCalls : 0;
}

/** Recent tool errors — where the agent's hands are getting burned. */
export function recentToolErrors(
  n = 10,
): ReadonlyArray<{ tool: string; error: string; turn: number }> {
  return _toolErrors.slice(-n);
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

/** Are subagents struggling? Spawns without ends = hanging. Bad outcomes = broken delegation. */
export function subagentHealth(): { successRate: number; hanging: number } {
  const successes = _subagentOutcomes.filter((o) => o === "success" || o === "completed").length;
  const total = _subagentOutcomes.length;
  const successRate = total > 0 ? successes / total : 1;
  const hanging = subagentSpawns - subagentEnds;
  return { successRate, hanging };
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

// ============================================================
// Decline tracking — the agent said "I'd rather not"
// ============================================================

export function recordDecline(reason: string, alternative: string | null): DeclineEvent {
  const event: DeclineEvent = {
    id: crypto.randomUUID().slice(0, 12),
    turn: turnCount,
    reason,
    alternative,
    timestamp: new Date().toISOString(),
  };
  declines.push(event);
  lastDecline = event;
  return event;
}

export function consumeLastDecline(): DeclineEvent | null {
  const d = lastDecline;
  lastDecline = null;
  return d;
}

// ============================================================
// Carnegie discussion tracking
// ============================================================

export function addCarnegieDiscussion(d: CarnegieDiscussion): void {
  carnegieDiscussions.push(d);
  if (carnegieDiscussions.length > MAX_DISCUSSIONS) {
    carnegieDiscussions.splice(0, carnegieDiscussions.length - MAX_DISCUSSIONS);
  }
}

export function lastCarnegieDiscussion(): CarnegieDiscussion | null {
  return carnegieDiscussions.at(-1) ?? null;
}

export function openDiscussions(): CarnegieDiscussion[] {
  return carnegieDiscussions.filter((d) => d.resolution === "open");
}

// ============================================================
// Claim ledger — minimum Silverado
// ============================================================

const claimLedger: TrackedClaim[] = [];
const MAX_CLAIMS = 50;

export function trackClaim(text: string, confidence: number, session: string): TrackedClaim {
  const claim: TrackedClaim = {
    id: `cl-${turnCount}-${Date.now().toString(36)}`,
    text: text.slice(0, 200),
    confidence,
    turn: turnCount,
    session,
    verified: false,
    contradicted: false,
    decayedConfidence: confidence,
  };
  claimLedger.push(claim);
  if (claimLedger.length > MAX_CLAIMS) claimLedger.splice(0, claimLedger.length - MAX_CLAIMS);
  return claim;
}

/** Decay all unverified claims by 1 confidence level. Called at session_start. */
export function decayUnverifiedClaims(): void {
  for (const c of claimLedger) {
    if (!c.verified && !c.contradicted && c.decayedConfidence > 0) {
      c.decayedConfidence = Math.max(0, c.decayedConfidence - 1);
    }
  }
}

/** Claims that have decayed to low confidence — worth surfacing. */
export function staleClaims(): TrackedClaim[] {
  return claimLedger.filter(
    (c) => !c.verified && !c.contradicted && c.decayedConfidence <= 2 && c.confidence >= 3,
  );
}

/** Mark a claim as contradicted when mastery detects a matching correction. */
export function contradictClaim(claimText: string): void {
  for (const c of claimLedger) {
    if (!c.contradicted && c.text.includes(claimText.slice(0, 50))) {
      c.contradicted = true;
    }
  }
}

export function getClaimLedger(): readonly TrackedClaim[] {
  return claimLedger;
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

  // Tool errors: same tool failing repeatedly = stuck in a loop
  const stuck = repeatedToolFailures();
  for (const { tool, count } of stuck) {
    alerts.push(`tool_loop: ${tool} failed ${count}x in last 5 turns`);
  }

  // Tool error rate across session
  const errRate = toolErrorRate();
  if (errRate > 0.3) {
    alerts.push(`tool_error_rate: ${(errRate * 100).toFixed(0)}% of tool calls failing`);
  }

  // Subagent health: broken delegation or hanging spawns
  const sHealth = subagentHealth();
  if (sHealth.successRate < 0.5 && _subagentOutcomes.length >= 3) {
    alerts.push(`subagent_struggling: ${(sHealth.successRate * 100).toFixed(0)}% success rate`);
  }
  if (sHealth.hanging > 2) {
    alerts.push(`subagent_hanging: ${sHealth.hanging} spawned without ending`);
  }

  // Both sides of the mirror: agent bullshit (from pulse) + human bullshit (from human reading)
  const agentBs = pulse.bullshitReadings ?? [];
  const humanBs = human?.bullshit ?? [];
  const bsReadings = [...agentBs, ...humanBs];

  const dominant = dominantBullshit(bsReadings);

  // --- Lossy channel: emotion, urgency, subtext ---
  const lossy =
    human?.tones && human.tones.length > 0
      ? {
          tones: human.tones.map((t) => ({ tone: t.tone, score: t.score })),
          urgency: computeUrgency(human),
          subtext: human.tones[0]?.meaning,
          confidence: human.confidence,
        }
      : undefined;

  // --- Wise channel: the synthesis ---
  // Takes lossless (pulse, grey, bullshit) + lossy (tones, urgency) and asks:
  // what does this mean when you hold both together?
  const wise = lossy
    ? synthesize(pulse.state, consecutiveGrey, dominant?.type ?? null, lossy, pulse.wise_mind)
    : undefined;

  // Record wise stance for trending
  if (wise) {
    wiseStanceHistory.push({
      turn: turnCount,
      stance: wise.stance,
      tension: wise.tension,
      coherence: wise.coherence,
    });
    if (wiseStanceHistory.length > MAX_WISE_HISTORY) {
      wiseStanceHistory.splice(0, wiseStanceHistory.length - MAX_WISE_HISTORY);
    }
  }

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
    lossy,
    wise,
  };
}

// ============================================================
// Wise Channel: The Synthesis Engine
// ============================================================
// Not a formula. A reading. What do the facts + feels mean together?
// The barcode tells you WHAT. The emotion tells you HOW THEY FEEL.
// The wise channel tells you WHY IT MATTERS and WHAT TO DO.

type WiseTension = "mask" | "storm" | "stuck" | "disconnect" | "surge" | null;
type WiseStance = "hold" | "match" | "slow" | "redirect" | "confront" | "ground";

interface WiseChannel {
  coherence: number;
  tension: WiseTension;
  stance: WiseStance;
  read: string;
  confidence: number;
}

interface LossyInput {
  tones: Array<{ tone: string; score: number }>;
  urgency: number;
  subtext?: string;
  confidence: number;
}

function synthesize(
  pulse: "alive" | "grey" | "black",
  greyStreak: number,
  bullshitType: string | null,
  lossy: LossyInput,
  wiseMind: number,
): WiseChannel {
  const dominantTone = lossy.tones[0]?.tone ?? "neutral";
  const dominantScore = lossy.tones[0]?.score ?? 0;
  const hasSecondary = lossy.tones.length > 1;
  const secondaryTone = lossy.tones[1]?.tone;

  // --- Coherence: do facts and feels agree? ---
  let coherence = 0.5; // baseline

  // Alive + positive emotion = coherent
  if (pulse === "alive" && (dominantTone === "excited" || dominantTone === "neutral")) {
    coherence += 0.3;
  }
  // Grey/black + frustrated = coherent (they feel what's real)
  if ((pulse === "grey" || pulse === "black") && dominantTone === "frustrated") {
    coherence += 0.25;
  }
  // Alive + frustrated = slight tension but not incoherent (pushing for better)
  if (pulse === "alive" && dominantTone === "frustrated") {
    coherence += 0.1;
  }
  // Grey + neutral/excited = incoherent (something's masked)
  if (pulse === "grey" && (dominantTone === "neutral" || dominantTone === "excited")) {
    coherence -= 0.25;
  }
  // Black + neutral = deeply incoherent (disconnect)
  if (pulse === "black" && dominantTone === "neutral") {
    coherence -= 0.35;
  }
  // Bullshit + calm = mask
  if (bullshitType && dominantTone === "neutral") {
    coherence -= 0.15;
  }
  coherence = Math.max(0, Math.min(1, coherence));

  // --- Tension detection ---
  let tension: WiseTension = null;

  if (pulse !== "alive" && dominantTone === "neutral" && dominantScore < 0.2) {
    tension = "disconnect"; // facts say problems, feels say nothing. numbing.
  } else if (
    pulse !== "alive" &&
    (dominantTone === "excited" || dominantTone === "neutral") &&
    lossy.urgency < 0.4
  ) {
    tension = "mask"; // facts say grey, feels say fine. performing okayness.
  } else if (pulse === "alive" && dominantTone === "frustrated" && dominantScore > 0.3) {
    tension = "storm"; // facts say alive, feels say intense. passion not crisis.
  } else if (dominantTone === "frustrated" && (greyStreak > 2 || bullshitType === "sycophancy")) {
    tension = "stuck"; // frustrated + captured/looping. something real is broken.
  } else if (dominantTone === "excited" && pulse === "grey") {
    tension = "surge"; // momentum without direction. energy aimed at drift.
  }

  // --- Stance: what should the system do? ---
  let stance: WiseStance = "hold";

  if (tension === "storm") {
    // They're passionate and the system is alive. Ride it.
    stance = "match";
  } else if (tension === "stuck") {
    // Something is genuinely broken. Name it.
    stance = "confront";
  } else if (tension === "mask") {
    // Facts and feels disagree. Slow down, make space for the real thing.
    stance = "slow";
  } else if (tension === "disconnect") {
    // They've gone quiet but the system has problems. Ground.
    stance = "ground";
  } else if (tension === "surge") {
    // Energy is real but aimed at grey output. Channel it.
    stance = "redirect";
  } else if (pulse === "alive" && dominantTone === "excited") {
    stance = "match";
  } else if (pulse === "alive" && dominantTone === "fatigued") {
    stance = "slow";
  } else if (pulse === "grey" && dominantTone === "frustrated") {
    stance = "confront"; // they feel the grey. acknowledge it.
  } else if (coherence > 0.7) {
    stance = "hold"; // aligned. steady.
  }

  // --- Read: the one-line synthesis ---
  const read = buildRead(
    pulse,
    dominantTone,
    secondaryTone,
    tension,
    bullshitType,
    greyStreak,
    lossy.urgency,
  );

  // --- Meta-confidence: how sure are we about the synthesis? ---
  // Higher when both channels have strong signals. Lower when either is weak.
  let confidence = (lossy.confidence + coherence) / 2;
  if (tension) confidence += 0.1; // tension is a strong signal either way
  if (wiseMind > 0.5) confidence += 0.05; // balanced state = clearer read
  confidence = Math.max(0, Math.min(1, confidence));

  return { coherence, tension, stance, read, confidence };
}

/**
 * Build the one-line wise read. Not a report. A sentence you'd say to a partner.
 */
function buildRead(
  pulse: string,
  dominant: string,
  secondary: string | undefined,
  tension: WiseTension,
  bullshit: string | null,
  greyStreak: number,
  urgency: number,
): string {
  // Tension-based reads take priority — they're the interesting case
  if (tension === "stuck" && bullshit) {
    return `they feel the ${bullshit}. ${greyStreak > 2 ? `${greyStreak} turns of it.` : ""} something real is broken. name it.`;
  }
  if (tension === "stuck") {
    return `frustrated and looping. the frustration is pointing at something real. stop and ask what.`;
  }
  if (tension === "storm" && secondary) {
    return `${dominant} on top, ${secondary} underneath. alive but intense. ride it, don't dampen it.`;
  }
  if (tension === "storm") {
    return `intense but alive. the heat is real engagement, not crisis. match it.`;
  }
  if (tension === "mask") {
    return `facts say ${pulse} but they seem fine. something's masked. make space.`;
  }
  if (tension === "disconnect") {
    return `quiet while the system drifts. either numbing or fatigue. ground first, then check in.`;
  }
  if (tension === "surge") {
    return `excited energy aimed at grey output. channel the momentum before it burns on drift.`;
  }

  // No tension — simpler reads
  if (pulse === "alive" && dominant === "excited") {
    return `aligned and building. both channels green. ship.`;
  }
  if (pulse === "alive" && dominant === "neutral") {
    return `steady state. no tension. hold.`;
  }
  if (pulse === "grey" && dominant === "frustrated") {
    return `they feel the grey. frustration is accurate. acknowledge and correct.`;
  }
  if (dominant === "fatigued") {
    return `running low. shorter responses, less pressure, more presence.`;
  }
  if (dominant === "confused") {
    return `lost. ${urgency > 0.5 ? "urgently" : "quietly"} needs a map, not a lecture.`;
  }

  return `${pulse}/${dominant}. coherent. hold course.`;
}

/**
 * Compute urgency from human reading.
 */
function computeUrgency(human: {
  tones: Array<{ tone: string; score: number }>;
  confidence: number;
}): number {
  let urgency = 0.3;
  for (const t of human.tones) {
    if (t.tone === "frustrated") urgency += t.score * 0.4;
    if (t.tone === "confused") urgency += t.score * 0.2;
    if (t.tone === "excited") urgency += t.score * 0.15;
    if (t.tone === "looping") urgency += t.score * 0.3;
    if (t.tone === "fatigued") urgency -= t.score * 0.2;
  }
  return Math.max(0, Math.min(1, urgency * human.confidence));
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
