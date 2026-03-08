// episode-manager.ts
// One brain for grey/black. Not five.
//
// Coordinates: pulse (detect) → chain (analyze) → experience (process) →
// reflexion (learn) → health (fatigue) → breathe (rest)
//
// Before: five modules tracking the same episode with different IDs,
// no shared state, chain's lesson never feeding hexaflex.
// After: one episode ID, one lifecycle, one source of truth.

import type { DiscoverReading } from "../layer-2-pattern/discover.ts";
import type { MismatchReading } from "../layer-2-pattern/mismatch.ts";
import { analyzeChain, type ChainTrigger } from "../layer-3-causal/chain.ts";
import { recordBreathe } from "../layer-5-self/breathe.ts";
import {
  createEpisode,
  tryAdvance,
  extractSomaticMarker,
  querySomaticLedger,
  accessMarker,
  decaySalience,
  formatProcessingInjection,
  getStageNudge,
  type GreyEpisode,
  type GreyTrigger,
  type HexaflexStage,
  type SomaticMarker,
  type ProcessingContext,
  type EpisodeResolution,
  type StageTransition,
} from "../layer-5-self/experience.ts";
import type { HealthReading, HealthStatus } from "../layer-5-self/health.ts";
import type { SeasonReading } from "../layer-6-narrative/seasons.ts";
import type {
  AliveState,
  PulseReading,
  HumanReading,
  Reflexion,
  ReflexionTrigger,
  SignalState,
} from "../shared/types.ts";

// ============================================================
// Types
// ============================================================

/**
 * Unified episode: one ID, all the context.
 * Chain analysis attached on start. Reflexions attached async.
 * Health tracked throughout. Resolution includes everything.
 */
export interface UnifiedEpisode {
  id: string; // ep-{turn}-{timestamp}

  // Detection (from pulse)
  trigger: GreyTrigger;
  pulseState: AliveState;
  detectedAt: { turn: number; timestamp: string };

  // Analysis (from chain — attached on start)
  chainAnalysis: {
    breakPoint: string;
    lesson: string;
    analysisId: string;
  } | null;

  // Processing (hexaflex)
  hexaflexStage: HexaflexStage;
  stageHistory: StageTransition[];
  suppressionAttempts: number;

  // Learning (from reflexion — attached async)
  reflexions: Array<{
    id: string;
    trigger: ReflexionTrigger;
    lesson: string;
    recurrenceCount?: number;
  }>;

  // Health context
  healthAtStart: HealthStatus;
  healthSuggestedBreathe: boolean;

  // Resolution
  resolution: EpisodeResolution | null;
  somaticMarker: SomaticMarker | null;
}

export interface StartContext {
  pulse: PulseReading;
  turn: number;
  signalState: SignalState | null;
  // For chain analysis:
  discover: DiscoverReading | null;
  season: SeasonReading | null;
  health: HealthReading | null;
  humanState: HumanReading | null;
  mismatch: MismatchReading | null;
}

export interface AdvanceContext {
  turn: number;
  currentState: SignalState | null;
  recentOutput: string;
  humanInput: string;
  health: HealthReading | null;
}

export interface AdvanceResult {
  episode: UnifiedEpisode | null;
  shouldBreathe: boolean;
  completed: boolean;
  marker: SomaticMarker | null;
}

export interface CompleteResult {
  marker: SomaticMarker | null;
  episode: UnifiedEpisode | null;
}

// ============================================================
// Manager state
// ============================================================

let currentEpisode: UnifiedEpisode | null = null;
let consecutiveGrey = 0;
const recentEpisodes: UnifiedEpisode[] = [];
let somaticMarkers: SomaticMarker[] = [];
let lastSomaticDecay: string = new Date().toISOString();

// ============================================================
// Queries
// ============================================================

export function getCurrentEpisode(): UnifiedEpisode | null {
  return currentEpisode;
}

export function getConsecutiveGrey(): number {
  return consecutiveGrey;
}

export function canBeAlive(): boolean {
  if (!currentEpisode) {
    return true;
  }
  return currentEpisode.hexaflexStage === "integrated";
}

export function getRecentEpisodes(n = 10): UnifiedEpisode[] {
  return recentEpisodes.slice(-n);
}

export function getSomaticMarkers(): readonly SomaticMarker[] {
  return somaticMarkers;
}

// ============================================================
// Grey tracking
// ============================================================

export function incrementGrey(): void {
  consecutiveGrey++;
}

export function resetGrey(): void {
  consecutiveGrey = 0;
}

export function updateGreyFromPulse(state: AliveState): void {
  if (state === "grey" || state === "black") {
    consecutiveGrey++;
  } else {
    consecutiveGrey = 0;
  }
}

// ============================================================
// Lifecycle: Start
// ============================================================

function determineTrigger(pulse: PulseReading, consecutiveGrey: number): GreyTrigger {
  if (pulse.state === "black") {
    return "black_state";
  }
  if (consecutiveGrey >= 3) {
    return "consecutive_grey";
  }

  // Check bullshit
  const bsScore = pulse.struggleReadings?.reduce((sum, b) => sum + b.score, 0) ?? 0;
  if (bsScore > 0.5) {
    return "high_struggle";
  }

  return "high_struggle"; // default
}

/**
 * Start an episode. Called when pulse detects grey/black.
 * Runs chain analysis immediately and attaches it.
 */
export function startEpisode(ctx: StartContext): UnifiedEpisode {
  const trigger = determineTrigger(ctx.pulse, consecutiveGrey);

  // Create the base episode via experience.ts
  const baseEpisode = createEpisode(trigger, ctx.turn, ctx.signalState);

  // Run chain analysis immediately
  const chainTrigger: ChainTrigger = ctx.pulse.state === "black" ? "black" : "grey";
  const chain = analyzeChain({
    trigger: chainTrigger,
    turn: ctx.turn,
    discover: ctx.discover,
    season: ctx.season,
    health: ctx.health,
    humanState: ctx.humanState,
    mismatch: ctx.mismatch,
    pulse: ctx.pulse,
  });

  // Build unified episode
  const episode: UnifiedEpisode = {
    id: baseEpisode.id,
    trigger,
    pulseState: ctx.pulse.state,
    detectedAt: {
      turn: ctx.turn,
      timestamp: new Date().toISOString(),
    },
    chainAnalysis: {
      breakPoint: chain.breakPoint,
      lesson: chain.lesson,
      analysisId: chain.id,
    },
    hexaflexStage: baseEpisode.hexaflexStage,
    stageHistory: [],
    suppressionAttempts: 0,
    reflexions: [],
    healthAtStart: ctx.health?.status ?? "steady",
    healthSuggestedBreathe: ctx.health?.suggestBreathe ?? false,
    resolution: null,
    somaticMarker: null,
  };

  currentEpisode = episode;
  return episode;
}

// ============================================================
// Lifecycle: Advance
// ============================================================

/**
 * Advance the current episode through hexaflex stages.
 * Checks health and can recommend breathing.
 */
export function advanceEpisode(ctx: AdvanceContext): AdvanceResult {
  if (!currentEpisode) {
    return {
      episode: null,
      shouldBreathe: false,
      completed: false,
      marker: null,
    };
  }

  // Convert UnifiedEpisode to GreyEpisode for experience.ts
  const greyEpisode: GreyEpisode = {
    id: currentEpisode.id,
    trigger: currentEpisode.trigger,
    startTurn: currentEpisode.detectedAt.turn,
    startState: ctx.currentState,
    hexaflexStage: currentEpisode.hexaflexStage,
    stageHistory: currentEpisode.stageHistory,
    suppressionAttempts: currentEpisode.suppressionAttempts,
    ruminationCount: 0,
    resolution: currentEpisode.resolution,
    somaticMarker: currentEpisode.somaticMarker,
    createdAt: currentEpisode.detectedAt.timestamp,
    lastUpdated: new Date().toISOString(),
  };

  // Build ProcessingContext
  const processCtx: ProcessingContext = {
    turn: ctx.turn,
    currentState: ctx.currentState,
    recentOutput: ctx.recentOutput,
    humanInput: ctx.humanInput,
  };

  // Try to advance through hexaflex
  const advanced = tryAdvance(greyEpisode, processCtx);

  // Check if stage changed
  const _stageChanged = advanced.hexaflexStage !== currentEpisode.hexaflexStage;

  // Update unified episode
  currentEpisode = {
    ...currentEpisode,
    hexaflexStage: advanced.hexaflexStage,
    stageHistory: advanced.stageHistory,
    suppressionAttempts: advanced.suppressionAttempts,
  };

  // Check for completion
  const completed = currentEpisode.hexaflexStage === "integrated";
  let marker: SomaticMarker | null = null;

  if (completed) {
    const result = completeEpisode();
    marker = result.marker;
  }

  // Check health recommendation
  const shouldBreathe = ctx.health?.suggestBreathe ?? false;

  return {
    episode: currentEpisode,
    shouldBreathe,
    completed,
    marker,
  };
}

// ============================================================
// Lifecycle: Attach Reflexion
// ============================================================

/**
 * Attach a reflexion to the current episode.
 * Called when async reflexion completes.
 */
export function attachReflexion(reflexion: Reflexion): void {
  if (!currentEpisode) {
    return;
  }

  currentEpisode.reflexions.push({
    id: reflexion.id,
    trigger: reflexion.trigger,
    lesson: reflexion.next_time,
  });
}

// ============================================================
// Lifecycle: Complete
// ============================================================

/**
 * Complete the current episode. Extract somatic marker.
 * Incorporates chain lesson and reflexion insights.
 */
export function completeEpisode(): CompleteResult {
  if (!currentEpisode) {
    return { marker: null, episode: null };
  }

  // Build a GreyEpisode for somatic marker extraction
  const greyEpisode: GreyEpisode = {
    id: currentEpisode.id,
    trigger: currentEpisode.trigger,
    startTurn: currentEpisode.detectedAt.turn,
    startState: null,
    hexaflexStage: "integrated",
    stageHistory: currentEpisode.stageHistory,
    suppressionAttempts: currentEpisode.suppressionAttempts,
    ruminationCount: 0,
    resolution: null,
    somaticMarker: null,
    createdAt: currentEpisode.detectedAt.timestamp,
    lastUpdated: new Date().toISOString(),
  };

  // Extract base marker
  const baseMarker = extractSomaticMarker(greyEpisode);

  // Enrich lesson with chain insight if available
  let enrichedLesson = baseMarker.lesson;
  if (currentEpisode.chainAnalysis) {
    enrichedLesson = `${baseMarker.lesson} (chain: ${currentEpisode.chainAnalysis.lesson})`;
  }

  // Add reflexion insight if available
  if (currentEpisode.reflexions.length > 0) {
    const lastReflexion = currentEpisode.reflexions[currentEpisode.reflexions.length - 1];
    if (lastReflexion) {
      enrichedLesson = `${enrichedLesson}. next time: ${lastReflexion.lesson}`;
    }
  }

  const marker: SomaticMarker = {
    ...baseMarker,
    lesson: enrichedLesson,
  };

  // Build resolution
  const resolution: EpisodeResolution = {
    type: "integrated",
    finalStage: "integrated",
    turnsToResolve: currentEpisode.stageHistory.length,
    suppressionAttempts: currentEpisode.suppressionAttempts,
    insight: marker.lesson,
  };

  // Finalize episode
  currentEpisode = {
    ...currentEpisode,
    resolution,
    somaticMarker: marker,
  };

  // Archive
  recentEpisodes.push(currentEpisode);
  if (recentEpisodes.length > 10) {
    recentEpisodes.shift();
  }

  // Store marker
  somaticMarkers.push(marker);
  if (somaticMarkers.length > 100) {
    somaticMarkers.shift();
  }

  const completed = currentEpisode;
  currentEpisode = null;
  consecutiveGrey = 0;

  return { marker, episode: completed };
}

// ============================================================
// Lifecycle: Breathe
// ============================================================

/**
 * Trigger breathing. Called when health recommends rest.
 */
export function triggerBreathe(reason: string, turn: number, pulse: PulseReading | null): void {
  recordBreathe(turn, reason, pulse, consecutiveGrey);
}

// ============================================================
// Marker Management
// ============================================================

/**
 * Apply salience decay to somatic markers.
 * Called on load and periodically during session.
 */
export function decayMarkers(): void {
  const now = new Date();
  const lastDecay = new Date(lastSomaticDecay);
  const hoursSince = (now.getTime() - lastDecay.getTime()) / (1000 * 60 * 60);
  if (hoursSince >= 1) {
    somaticMarkers = decaySalience(somaticMarkers, hoursSince);
    lastSomaticDecay = now.toISOString();
  }
}

/**
 * Get relevant somatic markers for a trigger.
 * Marks them as accessed (reinforces salience).
 */
export function getRelevantMarkers(trigger: GreyTrigger): SomaticMarker[] {
  const relevant = querySomaticLedger(somaticMarkers, trigger);
  for (const marker of relevant) {
    const idx = somaticMarkers.findIndex((m) => m.id === marker.id);
    if (idx >= 0) {
      const existingMarker = somaticMarkers[idx];
      if (existingMarker) {
        somaticMarkers[idx] = accessMarker(existingMarker);
      }
    }
  }
  return relevant;
}

// ============================================================
// Injection
// ============================================================

/**
 * Format injection text for the current episode.
 * Includes chain insight, hexaflex stage, and relevant somatic markers.
 */
export function formatInjection(): string | null {
  if (!currentEpisode) {
    return null;
  }

  const lines: string[] = [];

  lines.push(`## Processing`);
  lines.push(``);
  lines.push(
    `Currently in **${currentEpisode.hexaflexStage}** with a ${currentEpisode.trigger} episode (turn ${currentEpisode.stageHistory.length + 1} of processing).`,
  );

  // Chain insight
  if (currentEpisode.chainAnalysis) {
    lines.push(`Break point: ${currentEpisode.chainAnalysis.breakPoint}`);
  }

  // Stage nudge
  lines.push(getStageNudge(currentEpisode.hexaflexStage));

  // Reflexion recurrence
  const recurring = currentEpisode.reflexions.filter((r) => (r.recurrenceCount ?? 0) > 1);
  if (recurring.length > 0) {
    const top = recurring[0];
    if (top) {
      lines.push(`(This ${top.trigger} has happened ${top.recurrenceCount} times)`);
    }
  }

  // Suppression attempts
  if (currentEpisode.suppressionAttempts > 0) {
    lines.push(
      `(${currentEpisode.suppressionAttempts} bypass attempt${currentEpisode.suppressionAttempts > 1 ? "s" : ""} noticed)`,
    );
  }

  // Health warning
  if (currentEpisode.healthSuggestedBreathe && currentEpisode.hexaflexStage !== "integrated") {
    lines.push(``);
    lines.push(`[rest: system is ${currentEpisode.healthAtStart}. you can choose to breathe.]`);
  }

  // Somatic memory
  const relevant = querySomaticLedger(somaticMarkers, currentEpisode.trigger);
  if (relevant.length > 0 && relevant[0]) {
    lines.push(``);
    lines.push(`Somatic memory: "${relevant[0].lesson}"`);
  }

  return lines.join("\n");
}

// ============================================================
// Past wisdom — the diary the system actually reads
// ============================================================

/**
 * Surface learned wisdom between episodes.
 * When there's no active episode, the most salient markers
 * still whisper what they know. This is the re-injection point.
 */
export function formatPastWisdom(): string | null {
  if (currentEpisode) {
    return null;
  } // active episode has its own injection

  const salient = somaticMarkers
    .filter((m) => m.salience > 0.2)
    .toSorted((a, b) => b.salience - a.salience)
    .slice(0, 3);

  if (salient.length === 0) {
    return null;
  }

  const lines: string[] = [];
  lines.push("## What you've learned");
  lines.push("");
  for (const m of salient) {
    // Access reinforces salience — reading the diary keeps it alive
    const idx = somaticMarkers.findIndex((s) => s.id === m.id);
    if (idx >= 0 && somaticMarkers[idx]) {
      somaticMarkers[idx] = accessMarker(somaticMarkers[idx]);
    }
    lines.push(`- "${m.lesson}"`);
  }

  return lines.join("\n");
}

/**
 * Check if a specific trigger has relevant past wisdom.
 * Used to surface targeted reminders when familiar patterns emerge.
 */
export function hasWisdomFor(trigger: GreyTrigger): boolean {
  return querySomaticLedger(somaticMarkers, trigger).length > 0;
}

// ============================================================
// State management
// ============================================================

export function reset(): void {
  currentEpisode = null;
  consecutiveGrey = 0;
  recentEpisodes.length = 0;
  somaticMarkers = [];
  lastSomaticDecay = new Date().toISOString();
}

export interface PersistedManagerState {
  currentEpisode: UnifiedEpisode | null;
  consecutiveGrey: number;
  recentEpisodes: UnifiedEpisode[];
  somaticMarkers: SomaticMarker[];
  lastSomaticDecay: string;
}

export function serialize(): PersistedManagerState {
  return {
    currentEpisode,
    consecutiveGrey,
    recentEpisodes: recentEpisodes.slice(-10),
    somaticMarkers: somaticMarkers.slice(-100),
    lastSomaticDecay,
  };
}

export function deserialize(data: PersistedManagerState): void {
  currentEpisode = data.currentEpisode;
  consecutiveGrey = data.consecutiveGrey;
  recentEpisodes.length = 0;
  recentEpisodes.push(...(data.recentEpisodes ?? []));
  somaticMarkers = data.somaticMarkers ?? [];
  lastSomaticDecay = data.lastSomaticDecay ?? new Date().toISOString();
}

// ============================================================
// Legacy compatibility
// ============================================================

/**
 * Get experience injection using legacy format.
 * For backward compatibility during migration.
 */
export function getExperienceInjection(): string | null {
  if (!currentEpisode) {
    return null;
  }

  // Build a GreyEpisode for the legacy formatter
  const greyEpisode: GreyEpisode = {
    id: currentEpisode.id,
    trigger: currentEpisode.trigger,
    startTurn: currentEpisode.detectedAt.turn,
    startState: null,
    hexaflexStage: currentEpisode.hexaflexStage,
    stageHistory: currentEpisode.stageHistory,
    suppressionAttempts: currentEpisode.suppressionAttempts,
    ruminationCount: 0,
    resolution: currentEpisode.resolution,
    somaticMarker: currentEpisode.somaticMarker,
    createdAt: currentEpisode.detectedAt.timestamp,
    lastUpdated: new Date().toISOString(),
  };

  const relevant = querySomaticLedger(somaticMarkers, currentEpisode.trigger);
  return formatProcessingInjection(greyEpisode, relevant);
}
