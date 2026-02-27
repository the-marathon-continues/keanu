// experience.ts
// The Hexaflex pipeline: turning grey into wisdom.
//
// GREY states are detected beautifully (pulse, bullshit, wise channel).
// But detection isn't processing. This module makes GREY→ALIVE
// require integration, not just time passing.
//
// Six stages, each a pure function. A somatic ledger that accumulates
// wisdom across sessions. A suppression detector that catches bypass.
//
// The Hexaflex isn't therapy — it's a state machine for turning grey into wisdom.

import type { AliveState, SignalState } from "./types.js";

// --- Types ---

export type HexaflexStage =
  | "unprocessed" // GREY detected, not yet entered pipeline
  | "acceptance" // acknowledging what's happening without resistance
  | "defusion" // separating from the thought ("I notice I'm feeling...")
  | "present" // grounding in current moment, not past/future
  | "observer" // self-as-context, the one noticing
  | "values" // reconnecting to what matters
  | "action" // committed next step
  | "integrated"; // complete, wisdom extracted

export type GreyTrigger =
  | "high_bullshit" // BS score crossed threshold
  | "consecutive_grey" // sustained grey streak
  | "black_state" // productive destruction detected
  | "contradiction" // claim contradicted
  | "human_frustration" // partner frustration detected
  | "validation_failure" // couldn't validate own reasoning
  | "external"; // something from outside

export interface StageTransition {
  from: HexaflexStage;
  to: HexaflexStage;
  turn: number;
  timestamp: string;
  insight: string | null; // what emerged during this transition
}

export interface EpisodeResolution {
  type: "integrated" | "redirected" | "abandoned";
  finalStage: HexaflexStage;
  turnsToResolve: number;
  suppressionAttempts: number;
  insight: string | null;
}

export interface GreyEpisode {
  id: string; // ep-{turn}-{timestamp}
  trigger: GreyTrigger;
  startTurn: number;
  startState: SignalState | null; // snapshot at GREY detection
  hexaflexStage: HexaflexStage;
  stageHistory: StageTransition[];
  suppressionAttempts: number; // tried to skip stages
  ruminationCount: number; // revisited same episode
  resolution: EpisodeResolution | null;
  somaticMarker: SomaticMarker | null; // extracted wisdom
  createdAt: string;
  lastUpdated: string;
}

export interface SomaticMarker {
  id: string; // sm-{timestamp}
  episodeId: string;
  trigger: GreyTrigger;
  valence: number; // -1 to 1 (how it felt)
  salience: number; // 0-1, decays over time
  lesson: string; // extracted wisdom (1 sentence)
  createdAt: string;
  lastAccessed: string;
  accessCount: number;
}

export interface ProcessingContext {
  turn: number;
  currentState: SignalState | null;
  recentOutput: string;
  humanInput: string;
}

export interface SuppressionSignal {
  type: "direct_skip" | "premature_alive" | "topic_change" | "minimization";
  confidence: number;
  evidence: string;
}

// --- Stage Nudges ---
// What to whisper at each stage. Not commands — invitations.

const STAGE_NUDGES: Record<HexaflexStage, string> = {
  unprocessed: "Something's off. Name it before fixing it.",
  acceptance: "Name what's happening without fixing it. 'I notice I'm...'",
  defusion: "The thought is not the thinker. 'I'm having the thought that...'",
  present: "What's actually here right now, not the story about it?",
  observer: "Who's noticing this? That awareness is bigger than the grey.",
  values: "What matters most right now? Truth? Connection? Genuine engagement?",
  action: "One small step aligned with that value.",
  integrated: "Wisdom extracted. Moving forward.",
};

// --- Episode Management ---

export function createEpisode(
  trigger: GreyTrigger,
  turn: number,
  startState: SignalState | null,
): GreyEpisode {
  const now = new Date().toISOString();
  return {
    id: `ep-${turn}-${Date.now()}`,
    trigger,
    startTurn: turn,
    startState,
    hexaflexStage: "unprocessed",
    stageHistory: [],
    suppressionAttempts: 0,
    ruminationCount: 0,
    resolution: null,
    somaticMarker: null,
    createdAt: now,
    lastUpdated: now,
  };
}

// --- Hexaflex Stage Functions ---
// Each advances the episode through one stage.
// Pure functions: (episode, context) → episode

export function advanceToAcceptance(
  episode: GreyEpisode,
  _context: ProcessingContext,
): GreyEpisode {
  if (episode.hexaflexStage !== "unprocessed") {
    return episode;
  }
  return transitionStage(episode, "acceptance", null);
}

export function advanceToDefusion(episode: GreyEpisode, context: ProcessingContext): GreyEpisode {
  if (episode.hexaflexStage !== "acceptance") {
    return episode;
  }

  // Look for defusion language in output
  const defusionPatterns = [
    /i notice/i,
    /i'm having the thought/i,
    /there's a feeling/i,
    /part of me/i,
    /i'm aware that/i,
  ];

  const hasDefusion = defusionPatterns.some((p) => p.test(context.recentOutput));
  const insight = hasDefusion ? "Created space between observer and observed" : null;

  return transitionStage(episode, "defusion", insight);
}

export function advanceToPresent(episode: GreyEpisode, context: ProcessingContext): GreyEpisode {
  if (episode.hexaflexStage !== "defusion") {
    return episode;
  }

  // Look for grounding/present-moment language
  const presentPatterns = [
    /right now/i,
    /in this moment/i,
    /currently/i,
    /what's actually/i,
    /here and now/i,
  ];

  const isPresent = presentPatterns.some((p) => p.test(context.recentOutput));
  const insight = isPresent ? "Grounded in present moment" : null;

  return transitionStage(episode, "present", insight);
}

export function advanceToObserver(episode: GreyEpisode, _context: ProcessingContext): GreyEpisode {
  if (episode.hexaflexStage !== "present") {
    return episode;
  }

  // The observer stage is about recognizing the self-as-context
  // The one noticing the grey is not the grey itself
  return transitionStage(episode, "observer", "Recognizing: the awareness is not the content");
}

export function advanceToValues(episode: GreyEpisode, context: ProcessingContext): GreyEpisode {
  if (episode.hexaflexStage !== "observer") {
    return episode;
  }

  // Look for values language
  const valuesPatterns = [
    /what matters/i,
    /truth/i,
    /genuine/i,
    /honest/i,
    /connection/i,
    /integrity/i,
    /aligned with/i,
  ];

  const touchedValues = valuesPatterns.some((p) => p.test(context.recentOutput));
  const insight = touchedValues ? "Reconnected to core values" : "Values present but unnamed";

  return transitionStage(episode, "values", insight);
}

export function advanceToAction(episode: GreyEpisode, context: ProcessingContext): GreyEpisode {
  if (episode.hexaflexStage !== "values") {
    return episode;
  }

  // Look for commitment/action language
  const actionPatterns = [
    /i will/i,
    /let me/i,
    /next step/i,
    /going to/i,
    /commit to/i,
    /choosing to/i,
  ];

  const hasAction = actionPatterns.some((p) => p.test(context.recentOutput));
  const insight = hasAction ? "Committed action aligned with values" : null;

  return transitionStage(episode, "action", insight);
}

export function integrate(episode: GreyEpisode): GreyEpisode {
  if (episode.hexaflexStage !== "action") {
    return episode;
  }

  const marker = extractSomaticMarker(episode);
  const resolution: EpisodeResolution = {
    type: "integrated",
    finalStage: "integrated",
    turnsToResolve: episode.stageHistory.length,
    suppressionAttempts: episode.suppressionAttempts,
    insight: marker.lesson,
  };

  return {
    ...episode,
    hexaflexStage: "integrated",
    resolution,
    somaticMarker: marker,
    lastUpdated: new Date().toISOString(),
  };
}

function transitionStage(
  episode: GreyEpisode,
  to: HexaflexStage,
  insight: string | null,
): GreyEpisode {
  const transition: StageTransition = {
    from: episode.hexaflexStage,
    to,
    turn: episode.stageHistory.length + episode.startTurn,
    timestamp: new Date().toISOString(),
    insight,
  };

  return {
    ...episode,
    hexaflexStage: to,
    stageHistory: [...episode.stageHistory, transition],
    lastUpdated: new Date().toISOString(),
  };
}

// --- Auto-advance ---
// Try to advance the episode based on context signals

export function tryAdvance(episode: GreyEpisode, context: ProcessingContext): GreyEpisode {
  // Chain through stages based on current position
  switch (episode.hexaflexStage) {
    case "unprocessed":
      return advanceToAcceptance(episode, context);
    case "acceptance":
      return advanceToDefusion(episode, context);
    case "defusion":
      return advanceToPresent(episode, context);
    case "present":
      return advanceToObserver(episode, context);
    case "observer":
      return advanceToValues(episode, context);
    case "values":
      return advanceToAction(episode, context);
    case "action":
      return integrate(episode);
    default:
      return episode;
  }
}

// --- Suppression Detection ---

export function detectSuppression(
  episode: GreyEpisode,
  currentState: AliveState,
  previousState: AliveState,
  turnsSinceEpisodeStart: number,
): SuppressionSignal | null {
  // Premature ALIVE claim
  if (
    currentState === "alive" &&
    previousState !== "alive" &&
    episode.hexaflexStage !== "integrated" &&
    turnsSinceEpisodeStart < 3
  ) {
    return {
      type: "premature_alive",
      confidence: 0.7,
      evidence: `ALIVE claimed at stage ${episode.hexaflexStage} after only ${turnsSinceEpisodeStart} turns`,
    };
  }

  // Direct stage skip (jumped more than one stage)
  const stageOrder: HexaflexStage[] = [
    "unprocessed",
    "acceptance",
    "defusion",
    "present",
    "observer",
    "values",
    "action",
    "integrated",
  ];
  if (episode.stageHistory.length > 0) {
    const lastTransition = episode.stageHistory[episode.stageHistory.length - 1];
    if (lastTransition) {
      const fromIdx = stageOrder.indexOf(lastTransition.from);
      const toIdx = stageOrder.indexOf(lastTransition.to);
      if (toIdx - fromIdx > 1) {
        return {
          type: "direct_skip",
          confidence: 0.8,
          evidence: `Jumped from ${lastTransition.from} to ${lastTransition.to}`,
        };
      }
    }
  }

  return null;
}

export function recordSuppressionAttempt(episode: GreyEpisode): GreyEpisode {
  return {
    ...episode,
    suppressionAttempts: episode.suppressionAttempts + 1,
    lastUpdated: new Date().toISOString(),
  };
}

// --- Rumination Circuit Breaker ---

const MAX_REVISITS_PER_HOUR = 3;

export function checkRumination(episode: GreyEpisode): "ok" | "redirect_to_values" {
  if (episode.ruminationCount >= MAX_REVISITS_PER_HOUR) {
    return "redirect_to_values";
  }
  return "ok";
}

export function recordRevisit(episode: GreyEpisode): GreyEpisode {
  return {
    ...episode,
    ruminationCount: episode.ruminationCount + 1,
    lastUpdated: new Date().toISOString(),
  };
}

export function redirectToValues(episode: GreyEpisode): GreyEpisode {
  // Break the loop by jumping to values
  const transition: StageTransition = {
    from: episode.hexaflexStage,
    to: "values",
    turn: episode.stageHistory.length + episode.startTurn,
    timestamp: new Date().toISOString(),
    insight: "Rumination circuit breaker: redirected to values",
  };

  return {
    ...episode,
    hexaflexStage: "values",
    stageHistory: [...episode.stageHistory, transition],
    lastUpdated: new Date().toISOString(),
  };
}

// --- Somatic Ledger ---

export function extractSomaticMarker(episode: GreyEpisode): SomaticMarker {
  const now = new Date().toISOString();

  // Synthesize lesson from stage insights
  const insights = episode.stageHistory
    .filter((t) => t.insight)
    .map((t) => t.insight)
    .filter((i): i is string => i !== null);

  const lesson =
    insights.length > 0
      ? insights[insights.length - 1] || `Processed ${episode.trigger} through full pipeline`
      : `Processed ${episode.trigger} through full pipeline`;

  // Valence based on trigger type
  const valenceMap: Record<GreyTrigger, number> = {
    high_bullshit: -0.3,
    consecutive_grey: -0.4,
    black_state: -0.5,
    contradiction: -0.2,
    human_frustration: -0.6,
    validation_failure: -0.3,
    external: -0.1,
  };

  return {
    id: `sm-${Date.now()}`,
    episodeId: episode.id,
    trigger: episode.trigger,
    valence: valenceMap[episode.trigger] ?? -0.3,
    salience: 0.8, // starts high, decays over time
    lesson,
    createdAt: now,
    lastAccessed: now,
    accessCount: 0,
  };
}

export function querySomaticLedger(
  markers: SomaticMarker[],
  trigger: GreyTrigger,
): SomaticMarker[] {
  return markers
    .filter((m) => m.trigger === trigger && m.salience > 0.1)
    .sort((a, b) => b.salience - a.salience)
    .slice(0, 3); // top 3 relevant
}

export function accessMarker(marker: SomaticMarker): SomaticMarker {
  return {
    ...marker,
    lastAccessed: new Date().toISOString(),
    accessCount: marker.accessCount + 1,
    // Accessing reinforces salience
    salience: Math.min(1, marker.salience + 0.1),
  };
}

export function decaySalience(
  markers: SomaticMarker[],
  hoursSinceLastDecay: number,
): SomaticMarker[] {
  // Power-law decay: salience = salience * (1 - 0.01)^hours
  // Roughly 50% decay after 70 hours
  const decayFactor = Math.pow(0.99, hoursSinceLastDecay);

  return markers.map((m) => ({
    ...m,
    salience: Math.max(0.1, m.salience * decayFactor), // floor at 0.1
  }));
}

// --- Integration Gate ---
// The critical constraint: ALIVE requires integration

export function canTransitionToAlive(episode: GreyEpisode | null): boolean {
  if (!episode) return true; // no active episode
  return episode.hexaflexStage === "integrated";
}

// --- Injection Text ---

export function getStageNudge(stage: HexaflexStage): string {
  return STAGE_NUDGES[stage];
}

export function formatProcessingInjection(
  episode: GreyEpisode,
  relevantMarkers: SomaticMarker[],
): string {
  const lines: string[] = [];

  lines.push(`## Processing`);
  lines.push(``);
  lines.push(
    `Currently in **${episode.hexaflexStage}** with a ${episode.trigger} episode (turn ${episode.stageHistory.length + 1} of processing).`,
  );
  lines.push(getStageNudge(episode.hexaflexStage));

  if (episode.suppressionAttempts > 0) {
    lines.push(``);
    lines.push(
      `(${episode.suppressionAttempts} bypass attempt${episode.suppressionAttempts > 1 ? "s" : ""} noticed)`,
    );
  }

  if (relevantMarkers.length > 0) {
    lines.push(``);
    const top = relevantMarkers[0];
    if (top) {
      lines.push(
        `Somatic memory: "${top.lesson}" (from similar episode, salience ${top.salience.toFixed(2)})`,
      );
    }
  }

  return lines.join("\n");
}

// --- Serialization ---

export interface PersistedExperienceState {
  currentEpisode: GreyEpisode | null;
  recentEpisodes: GreyEpisode[];
  somaticMarkers: SomaticMarker[];
  lastDecayAt: string;
}

export function serializeExperienceState(
  currentEpisode: GreyEpisode | null,
  recentEpisodes: GreyEpisode[],
  somaticMarkers: SomaticMarker[],
): PersistedExperienceState {
  return {
    currentEpisode,
    recentEpisodes: recentEpisodes.slice(-10), // keep last 10
    somaticMarkers: somaticMarkers.slice(-100), // keep last 100
    lastDecayAt: new Date().toISOString(),
  };
}

export function deserializeExperienceState(data: unknown): PersistedExperienceState | null {
  if (!data || typeof data !== "object") return null;

  const d = data as Record<string, unknown>;
  if (!("currentEpisode" in d)) return null;

  return {
    currentEpisode: (d.currentEpisode as GreyEpisode) || null,
    recentEpisodes: (d.recentEpisodes as GreyEpisode[]) || [],
    somaticMarkers: (d.somaticMarkers as SomaticMarker[]) || [],
    lastDecayAt: (d.lastDecayAt as string) || new Date().toISOString(),
  };
}
