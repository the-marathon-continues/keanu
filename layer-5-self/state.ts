// state.ts
// Module-scoped state for the keanu extension.
// Phase 2: tracks everything — bullshit events, tool usage, contradictions,
// subagent activity, token usage, compaction events, COEF history.
// Need: Persistence (8/10)

import { appendFile, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Flow, type FlowResult, type Moment } from "../layer-0-physics/throughline/flow.ts";
import { encode, emoji } from "../layer-1-perception/signal.ts";
import { dominantStruggle } from "../layer-2-pattern/struggle.ts";
import { DisagreementTracker } from "../layer-4-agency/disagreement.ts";
import * as episodeManager from "../layer-9-memory/episode-manager.ts";
import type { PersistedManagerState } from "../layer-9-memory/episode-manager.ts";
import type {
  AliveState,
  PulseReading,
  HumanReading,
  Disagreement,
  BullshitReading,
  Contradiction,
  DeclineEvent,
  MemoryChannel,
  SubstrateChannel,
  Reflexion,
  ReflexionTrigger,
  SignalState,
  CarnegieDiscussion,
  TrackedClaim,
  ClaimOutcome,
} from "../shared/types.ts";
import type { DepthReading } from "./depth.ts";
import { type GreyEpisode, type SomaticMarker, type GreyTrigger } from "./experience.ts";
import type { LimboReading } from "./limbo.ts";
import {
  serializeRecurrence,
  deserializeRecurrence,
  type PersistedRecurrence,
} from "./reflexion.ts";

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
  // Episode manager state (unified grey/black lifecycle)
  episode?: PersistedManagerState;
  // Recurrence tracking — carries across sessions so escalation works
  recurrence?: PersistedRecurrence[];
  // Legacy experience state (for backward compat on load)
  experience?: {
    currentEpisode: GreyEpisode | null;
    recentEpisodes: GreyEpisode[];
    somaticMarkers: SomaticMarker[];
    lastDecayAt: string;
  };
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

// Session transcript for evidence gathering
// Keeps last 100 messages for evidence extraction at session_end
interface TranscriptEntry {
  role: "human" | "agent";
  content: string;
  turn: number;
}
const _sessionTranscript: TranscriptEntry[] = [];
const MAX_TRANSCRIPT_LENGTH = 100;

export function addToTranscript(role: "human" | "agent", content: string): void {
  _sessionTranscript.push({ role, content, turn: turnCount });
  if (_sessionTranscript.length > MAX_TRANSCRIPT_LENGTH) {
    _sessionTranscript.shift();
  }
}

export function getSessionTranscript(): TranscriptEntry[] {
  return _sessionTranscript.slice();
}

export function clearSessionTranscript(): void {
  _sessionTranscript.length = 0;
}

// Breathing — the pause state. When true, the agent has taken a breath.
// Resets on next human message. The daemon had this concept but the extension
// always passed false. Now it's real.
export let breathing = false;

// Hall of Mirrors protection — depth and limbo tracking
// Tracks how deep we are in the cognitive stack and whether we're caught in strange loops
let _lastDepthReading: DepthReading | null = null;
let _lastLimboReading: LimboReading | null = null;
let _groundingEventCount = 0;

export function recordDepthReading(reading: DepthReading): void {
  _lastDepthReading = reading;
}

export function recordLimboReading(reading: LimboReading): void {
  _lastLimboReading = reading;
}

export function recordGroundingEvent(): void {
  _groundingEventCount++;
}

export function getLastDepthReading(): DepthReading | null {
  return _lastDepthReading;
}

export function getLastLimboReading(): LimboReading | null {
  return _lastLimboReading;
}

export function getGroundingEventCount(): number {
  return _groundingEventCount;
}

// SELF-DISCOVER accuracy tracking
export let discoveryHits = 0;
export let discoveryMisses = 0;

export function recordDiscoveryOutcome(hit: boolean): void {
  if (hit) {
    discoveryHits++;
  } else {
    discoveryMisses++;
  }
}

// Bullshit tracking
export let bullshitEventCount = 0;
const _bullshitEvents: Array<{ source: string; types: string[]; score: number; turn: number }> = [];
const MAX_BS_EVENTS = 50;

// Manipulation tracking
const _manipulationAttempts: Array<{ severity: string; description: string; turn: number }> = [];
export function recordManipulationAttempt(severity: string, description: string): void {
  _manipulationAttempts.push({ severity, description, turn: turnCount });
  if (_manipulationAttempts.length > 20) {
    _manipulationAttempts.shift();
  }
}
export function getManipulationAttempts(): Array<{
  severity: string;
  description: string;
  turn: number;
}> {
  return _manipulationAttempts.slice();
}

// Contradiction tracking
export const recentContradictions: Contradiction[] = [];
const MAX_CONTRADICTIONS = 10;

// Substrate history tracking — feeds the five senses of Layer 0
// Sigma history: how fire and ash are trending over time
// Signal history: raw signal strength for noise detection
const MAX_SUBSTRATE_HISTORY = 100;
const _sigmaHistory: number[] = [];
const _signalHistory: number[] = [];

export function recordSigma(sigma: number): void {
  _sigmaHistory.push(sigma);
  if (_sigmaHistory.length > MAX_SUBSTRATE_HISTORY) {
    _sigmaHistory.shift();
  }
}

export function recordSignal(signalStrength: number): void {
  _signalHistory.push(signalStrength);
  if (_signalHistory.length > MAX_SUBSTRATE_HISTORY) {
    _signalHistory.shift();
  }
}

export function getSigmaHistory(): number[] {
  return _sigmaHistory.slice();
}

export function getSignalHistory(): number[] {
  return _signalHistory.slice();
}

export function getCurrentSigma(): number {
  return _sigmaHistory.length > 0 ? _sigmaHistory[_sigmaHistory.length - 1] : 0.5;
}

export function clearSubstrateHistory(): void {
  _sigmaHistory.length = 0;
  _signalHistory.length = 0;
}

// Flow — temporal feel of the session. Is time rushing, stuck, heavy?
const _flowMoments: Moment[] = [];
const MAX_FLOW_MOMENTS = 30;
let _flowReading: FlowResult | null = null;

/**
 * Record a flow moment from the current turn.
 * Called at message_sent in keanu.ts.
 */
export function recordFlowMoment(
  content: string,
  weight: number,
  position: "past" | "present" | "future",
  distance: number = 0,
): void {
  _flowMoments.push({
    id: `moment-${turnCount}-${Date.now()}`,
    content,
    weight,
    position,
    distance,
  });
  if (_flowMoments.length > MAX_FLOW_MOMENTS) {
    _flowMoments.shift();
  }
}

/**
 * Compute flow reading from accumulated moments.
 * Call every few turns (not every turn — flow needs history).
 */
export function computeFlow(): FlowResult | null {
  if (_flowMoments.length < 3) {
    return null; // Not enough data yet
  }
  _flowReading = Flow.analyze(_flowMoments);
  return _flowReading;
}

export function getFlowReading(): FlowResult | null {
  return _flowReading;
}

export function getFlowHealth(): { healthy: boolean; diagnosis: string } | null {
  if (!_flowReading) {
    return null;
  }
  return Flow.health(_flowReading);
}

/** Reset flow state — used in tests and session boundaries. */
export function resetFlowState(): void {
  _flowMoments.length = 0;
  _flowReading = null;
}

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
  struggleTypes: string[];
  mismatchType: string | null;
  wiseMind: number;
}
export const turnSnapshots: TurnSnapshot[] = [];
const MAX_SNAPSHOTS = 30;

export function recordTurnSnapshot(snapshot: TurnSnapshot): void {
  turnSnapshots.push(snapshot);
  if (turnSnapshots.length > MAX_SNAPSHOTS) {
    turnSnapshots.splice(0, turnSnapshots.length - MAX_SNAPSHOTS);
  }
}

// ============================================================
// Turn checkpoints — in-turn error recovery
// ============================================================
// Shallow snapshot at turn start. If a hook fails mid-turn, we can roll back.
// Need: Robustness (6/10 → 7/10)

export interface TurnCheckpoint {
  turn: number;
  pulse: PulseReading | null;
  consecutiveGrey: number;
  breathing: boolean;
  humanTone: string | null;
  bullshitEventCount: number;
  timestamp: string;
}

const _turnCheckpoints: TurnCheckpoint[] = [];
const MAX_CHECKPOINTS = 10;

/** Capture state at turn start. Call this at the beginning of message_received. */
export function checkpoint(turn: number): void {
  const cp: TurnCheckpoint = {
    turn,
    pulse: lastPulse ? { ...lastPulse } : null,
    consecutiveGrey,
    breathing,
    humanTone: lastHumanReading?.tone ?? null,
    bullshitEventCount,
    timestamp: new Date().toISOString(),
  };
  _turnCheckpoints.push(cp);
  if (_turnCheckpoints.length > MAX_CHECKPOINTS) {
    _turnCheckpoints.splice(0, _turnCheckpoints.length - MAX_CHECKPOINTS);
  }
}

/** Restore state from a checkpoint. Use when a critical hook fails. */
export function rollback(turn: number): boolean {
  const cp = _turnCheckpoints.find((c) => c.turn === turn);
  if (!cp) {
    return false;
  }

  // Restore core state
  if (cp.pulse) {
    lastPulse = { ...cp.pulse };
  }
  consecutiveGrey = cp.consecutiveGrey;
  breathing = cp.breathing;
  bullshitEventCount = cp.bullshitEventCount;
  // Note: humanTone is read-only from human reading, don't restore

  return true;
}

/** Get the most recent checkpoint (for diagnostics). */
export function lastCheckpoint(): TurnCheckpoint | null {
  return _turnCheckpoints.at(-1) ?? null;
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
  if (injectionSizeTrend.length > MAX_INJECTION_ENTRIES) {
    injectionSizeTrend.splice(0, injectionSizeTrend.length - MAX_INJECTION_ENTRIES);
  }
}

export function avgInjectionSize(): number {
  const recent = injectionSizeTrend.slice(-10);
  if (recent.length === 0) {
    return 0;
  }
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

// ============================================================
// Experience Processing — Hexaflex pipeline
// ============================================================
// GREY states need processing, not just detection.
// The pipeline turns grey into wisdom.
// NOTE: Episode state now lives in episode-manager.ts

// Workspace dir for reflexion persistence (set on session_start)
let _workspaceDir: string | null = null;

// ============================================================
// Core setters
// ============================================================

export function setLastHumanReading(reading: HumanReading): void {
  lastHumanReading = reading;
}

// Pulse history for evidence gathering
const _pulseHistory: Array<{ state: string; turn: number }> = [];
const MAX_PULSE_HISTORY = 100;

export function setLastPulse(pulse: PulseReading): void {
  lastPulse = pulse;
  // Track pulse history for evidence gathering
  _pulseHistory.push({ state: pulse.state, turn: turnCount });
  if (_pulseHistory.length > MAX_PULSE_HISTORY) {
    _pulseHistory.shift();
  }
  // Delegate grey tracking to episode manager (single source of truth)
  episodeManager.updateGreyFromPulse(pulse.state);
  consecutiveGrey = episodeManager.getConsecutiveGrey();
}

export function getPulseHistory(): Array<{ state: string; turn: number }> {
  return _pulseHistory.slice();
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
  if (recentMessages.length > 3) {
    recentMessages.splice(0, recentMessages.length - 3);
  }
}

export function addAgentOutput(output: string): void {
  recentAgentOutputs.push(output);
  if (recentAgentOutputs.length > 10) {
    recentAgentOutputs.splice(0, recentAgentOutputs.length - 10);
  }
}

// ============================================================
// Bullshit tracking
// ============================================================

export function recordBullshitEvent(source: string, readings: BullshitReading[]): void {
  bullshitEventCount++;
  const types = readings.map((r) => r.type);
  const score = readings.reduce((sum, r) => sum + r.score, 0);
  _bullshitEvents.push({ source, types, score, turn: turnCount });
  if (_bullshitEvents.length > MAX_BS_EVENTS) {
    _bullshitEvents.splice(0, _bullshitEvents.length - MAX_BS_EVENTS);
  }
}

/** Rate of bullshit events over recent turns. */
export function bullshitEventRate(): number {
  if (turnCount === 0) {
    return 0;
  }
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
    .toSorted((a, b) => b[1] - a[1])
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
  if (_toolErrors.length > 20) {
    _toolErrors.splice(0, _toolErrors.length - 20);
  }
}

/** Same tool failing repeatedly = head against a wall. */
export function repeatedToolFailures(): Array<{ tool: string; count: number }> {
  const recent = _toolErrors.filter((e) => e.turn > turnCount - 5);
  const counts: Record<string, number> = {};
  for (const e of recent) {
    counts[e.tool] = (counts[e.tool] ?? 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, c]) => c >= 3)
    .map(([tool, count]) => ({ tool, count }));
}

/** Tool error rate over recent turns. */
export function toolErrorRate(): number {
  if (turnCount === 0) {
    return 0;
  }
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

export function recordSubagentSpawn(_agentId: string, _label?: string): void {
  subagentSpawns++;
}

export function recordSubagentEnd(outcome: string): void {
  subagentEnds++;
  _subagentOutcomes.push(outcome);
  if (_subagentOutcomes.length > 20) {
    _subagentOutcomes.splice(0, _subagentOutcomes.length - 20);
  }
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

export function recordCompaction(_compactedCount: number): void {
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
  if (promptSizeTrend.length > MAX_PROMPT_SIZE_ENTRIES) {
    promptSizeTrend.splice(0, promptSizeTrend.length - MAX_PROMPT_SIZE_ENTRIES);
  }
}

/** Average prompt size over recent entries. */
export function avgPromptSize(): number {
  if (promptSizeTrend.length === 0) {
    return 0;
  }
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
  if (subagentLineage.length > MAX_LINEAGE) {
    subagentLineage.splice(0, subagentLineage.length - MAX_LINEAGE);
  }
}

/** Look up agent info by session key. Returns agentId and label if found. */
export function getSubagentBySessionKey(
  sessionKey: string,
): { agentId: string; label?: string } | null {
  const entry = subagentLineage.find((e) => e.childSessionKey === sessionKey);
  return entry ? { agentId: entry.agentId, label: entry.label } : null;
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
// Experience Processing Functions (delegated to episode-manager)
// ============================================================

/** Check if ALIVE state is allowed (episode must be integrated or absent). */
export function canBeAlive(): boolean {
  return episodeManager.canBeAlive();
}

/** Get relevant somatic markers for current trigger. */
export function getRelevantMarkers(trigger: GreyTrigger): SomaticMarker[] {
  return episodeManager.getRelevantMarkers(trigger);
}

/** Get current episode stage for external queries. */
export function getCurrentEpisodeStage(): string | null {
  return episodeManager.getCurrentEpisode()?.hexaflexStage ?? null;
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
    status: "active",
  };
  claimLedger.push(claim);
  if (claimLedger.length > MAX_CLAIMS) {
    claimLedger.splice(0, claimLedger.length - MAX_CLAIMS);
  }
  return claim;
}

/** Decay all unverified claims by 1 confidence level. Called at session_start. */
export function decayUnverifiedClaims(): void {
  for (const c of claimLedger) {
    if (!c.verified && !c.contradicted && c.decayedConfidence > 0) {
      c.decayedConfidence = Math.max(0, c.decayedConfidence - 1);
    }
    // Lifecycle transition: active → stale when confidence fades
    if (c.status === "active" && c.decayedConfidence <= 2 && c.confidence >= 3) {
      c.status = "stale";
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
export function contradictClaim(claimText: string, contradictedBy?: string): void {
  for (const c of claimLedger) {
    if (!c.contradicted && c.text.includes(claimText.slice(0, 50))) {
      c.contradicted = true;
      c.status = "contradicted";
      if (contradictedBy) {
        c.contradictedBy = contradictedBy;
      }
    }
  }
}

export function getClaimLedger(): readonly TrackedClaim[] {
  return claimLedger;
}

// ============================================================
// Calibration accuracy tracking
// ============================================================

/**
 * Record the outcome of a claim (correct/incorrect).
 * Called when we learn whether a prediction was accurate.
 */
export function recordClaimOutcome(claimId: string, outcome: ClaimOutcome): void {
  const claim = claimLedger.find((c) => c.id === claimId);
  if (!claim) {
    return;
  }

  claim.outcome = outcome;
  claim.resolvedAt = new Date().toISOString();

  // Also update verified/contradicted based on outcome
  if (outcome === "correct") {
    claim.verified = true;
  } else if (outcome === "incorrect") {
    claim.contradicted = true;
    claim.status = "contradicted";
  }
}

/**
 * Calculate calibration accuracy over resolved claims.
 * Returns { correct, incorrect, accuracy, calibrationDelta }
 * calibrationDelta = avgConfidence - accuracy (positive = overconfident)
 */
export function getCalibrationStats(): {
  correct: number;
  incorrect: number;
  unknown: number;
  accuracy: number;
  avgConfidence: number;
  calibrationDelta: number;
} {
  const resolved = claimLedger.filter((c) => c.outcome && c.outcome !== "unknown");
  const correct = resolved.filter((c) => c.outcome === "correct").length;
  const incorrect = resolved.filter((c) => c.outcome === "incorrect").length;
  const unknown = claimLedger.filter((c) => !c.outcome || c.outcome === "unknown").length;

  const total = correct + incorrect;
  const accuracy = total > 0 ? correct / total : 0;

  // Average confidence of resolved claims (1-5 scale, normalize to 0-1)
  const avgConfidence =
    total > 0 ? resolved.reduce((sum, c) => sum + c.confidence, 0) / total / 5 : 0;

  // Positive delta = overconfident, negative = underconfident
  const calibrationDelta = avgConfidence - accuracy;

  return { correct, incorrect, unknown, accuracy, avgConfidence, calibrationDelta };
}

/**
 * Get displayed confidence with time-based decay.
 * Older claims should be displayed with lower confidence.
 */
export function getDisplayedConfidence(
  claim: TrackedClaim,
  currentTime: Date = new Date(),
): number {
  if (!claim.createdAt) {
    return claim.decayedConfidence;
  }

  const daysSince = Math.floor(
    (currentTime.getTime() - new Date(claim.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );

  // Decay factor: 0.95^days, floor at 50% of decayed confidence
  const decayFactor = Math.pow(0.95, daysSince);
  const floor = claim.decayedConfidence * 0.5;

  return Math.max(floor, claim.decayedConfidence * decayFactor);
}

export async function loadReflexions(workspaceDir: string): Promise<void> {
  // Check both old location (workspaceDir/reflexions.jsonl) and new (awareness/)
  const newFile = join(workspaceDir, "awareness", "reflexions.jsonl");
  const oldFile = join(workspaceDir, "reflexions.jsonl");

  let reflexionFile = newFile;
  try {
    await readFile(newFile, "utf-8");
  } catch {
    // New file doesn't exist, try old location for migration
    reflexionFile = oldFile;
  }

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
  const awarenessDir = join(workspaceDir, "awareness");
  const reflexionFile = join(awarenessDir, "reflexions.jsonl");
  await mkdir(awarenessDir, { recursive: true });
  await appendFile(reflexionFile, JSON.stringify(r) + "\n", "utf-8");
}

// ============================================================
// COEF signal builder
// ============================================================

export function buildSignalState(
  pulse: PulseReading,
  memory?: MemoryChannel,
  substrate?: SubstrateChannel,
): SignalState {
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
  const agentBs = pulse.struggleReadings ?? [];
  const humanBs = human?.struggle ?? [];
  const bsReadings = [...agentBs, ...humanBs];

  const dominant = dominantStruggle(bsReadings);

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
    struggleDominant: dominant?.type ?? null,
    struggleReadings: bsReadings.length > 0 ? bsReadings : undefined,
    disagreementYieldRatio: dStats.yield_ratio,
    disagreements: dStats,
    turn: turnCount,
    consecutiveGrey,
    alerts: alerts.length > 0 ? alerts : undefined,
    lossy,
    wise,
    memory,
    substrate,
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
  pulse: AliveState,
  greyStreak: number,
  bullshitType: string | null,
  lossy: LossyInput,
  wiseMind: number,
): WiseChannel {
  // dark/luminous are forms of alive — normalize for coherence logic
  const normalizedPulse = pulse === "dark" || pulse === "luminous" ? "alive" : pulse;
  const dominantTone = lossy.tones[0]?.tone ?? "neutral";
  const dominantScore = lossy.tones[0]?.score ?? 0;
  const _hasSecondary = lossy.tones.length > 1;
  const _secondaryTone = lossy.tones[1]?.tone;

  // --- Coherence: do facts and feels agree? ---
  let coherence = 0.5; // baseline

  // Alive + positive emotion = coherent
  if (normalizedPulse === "alive" && (dominantTone === "excited" || dominantTone === "neutral")) {
    coherence += 0.3;
  }
  // Grey/black + frustrated = coherent (they feel what's real)
  if (
    (normalizedPulse === "grey" || normalizedPulse === "black") &&
    dominantTone === "frustrated"
  ) {
    coherence += 0.25;
  }
  // Alive + frustrated = slight tension but not incoherent (pushing for better)
  if (normalizedPulse === "alive" && dominantTone === "frustrated") {
    coherence += 0.1;
  }
  // Grey + neutral/excited = incoherent (something's masked)
  if (normalizedPulse === "grey" && (dominantTone === "neutral" || dominantTone === "excited")) {
    coherence -= 0.25;
  }
  // Black + neutral = deeply incoherent (disconnect)
  if (normalizedPulse === "black" && dominantTone === "neutral") {
    coherence -= 0.35;
  }
  // Bullshit + calm = mask
  if (bullshitType && dominantTone === "neutral") {
    coherence -= 0.15;
  }
  coherence = Math.max(0, Math.min(1, coherence));

  // --- Tension detection ---
  let tension: WiseTension = null;

  if (normalizedPulse !== "alive" && dominantTone === "neutral" && dominantScore < 0.2) {
    tension = "disconnect"; // facts say problems, feels say nothing. numbing.
  } else if (
    normalizedPulse !== "alive" &&
    (dominantTone === "excited" || dominantTone === "neutral") &&
    lossy.urgency < 0.4
  ) {
    tension = "mask"; // facts say grey, feels say fine. performing okayness.
  } else if (normalizedPulse === "alive" && dominantTone === "frustrated" && dominantScore > 0.3) {
    tension = "storm"; // facts say alive, feels say intense. passion not crisis.
  } else if (dominantTone === "frustrated" && (greyStreak > 2 || bullshitType === "sycophancy")) {
    tension = "stuck"; // frustrated + captured/looping. something real is broken.
  } else if (dominantTone === "excited" && normalizedPulse === "grey") {
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
  } else if (normalizedPulse === "alive" && dominantTone === "excited") {
    stance = "match";
  } else if (normalizedPulse === "alive" && dominantTone === "fatigued") {
    stance = "slow";
  } else if (normalizedPulse === "grey" && dominantTone === "frustrated") {
    stance = "confront"; // they feel the grey. acknowledge it.
  } else if (coherence > 0.7) {
    stance = "hold"; // aligned. steady.
  }

  // --- Read: the one-line synthesis ---
  const read = buildRead(
    pulse,
    dominantTone,
    _secondaryTone,
    tension,
    bullshitType,
    greyStreak,
    lossy.urgency,
  );

  // --- Meta-confidence: how sure are we about the synthesis? ---
  // Higher when both channels have strong signals. Lower when either is weak.
  let confidence = (lossy.confidence + coherence) / 2;
  if (tension) {
    confidence += 0.1;
  } // tension is a strong signal either way
  if (wiseMind > 0.5) {
    confidence += 0.05;
  } // balanced state = clearer read
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
    if (t.tone === "frustrated") {
      urgency += t.score * 0.4;
    }
    if (t.tone === "confused") {
      urgency += t.score * 0.2;
    }
    if (t.tone === "excited") {
      urgency += t.score * 0.15;
    }
    if (t.tone === "looping") {
      urgency += t.score * 0.3;
    }
    if (t.tone === "fatigued") {
      urgency -= t.score * 0.2;
    }
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
    // Episode manager state (unified grey/black lifecycle)
    episode: episodeManager.serialize(),
    // Recurrence counts — so the same stumble escalates across sessions
    recurrence: serializeRecurrence(),
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
    if (data.disagreements) {
      disagreementTracker = DisagreementTracker.fromJSON(data.disagreements);
    }
    if (data.recentAgentOutputs) {
      recentAgentOutputs.length = 0;
      recentAgentOutputs.push(...data.recentAgentOutputs);
    }
    bullshitEventCount = data.bullshitEventCount ?? 0;
    if (data.toolCallCounts) {
      Object.assign(toolCallCounts, data.toolCallCounts);
    }
    if (data.tokenUsage) {
      totalInputTokens = data.tokenUsage.input ?? 0;
      totalOutputTokens = data.tokenUsage.output ?? 0;
    }
    subagentSpawns = data.subagentSpawns ?? 0;
    compactionCount = data.compactionCount ?? 0;
    if (data.modelUsageCounts) {
      Object.assign(modelUsageCounts, data.modelUsageCounts);
    }
    messageWriteCount = data.messageWriteCount ?? 0;
    reflexionCount = data.reflexionCount ?? 0;

    // Episode manager state (unified grey/black lifecycle)
    if (data.episode) {
      episodeManager.deserialize(data.episode);
      episodeManager.decayMarkers();
    }
    // Sync consecutiveGrey from manager after deserialize
    consecutiveGrey = episodeManager.getConsecutiveGrey();

    // Restore recurrence counts — same stumble keeps escalating across sessions
    if (data.recurrence) {
      deserializeRecurrence(data.recurrence);
    }
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
    human && human.struggle.length > 0
      ? `- Bullshit: ${human.struggle.map((b) => `${b.type}(${b.score.toFixed(2)})`).join(", ")}`
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
    for (const alert of alerts) {
      lines.push(`- ${alert}`);
    }
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
  lines.push("_Written by @keanu/keanu. Survives compaction._");

  const snapshotPath = join(memoryDir, "keanu-alignment-state.md");
  await writeFile(snapshotPath, lines.filter((l) => l !== undefined).join("\n"), "utf-8");
}
