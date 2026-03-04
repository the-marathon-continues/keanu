// grievance.ts
// Processing negative without resentment.
//
// Something hurt. Not a bug report — a felt experience.
// The old version kept a list that nobody read.
// This version routes through the hexaflex pipeline so
// negative experiences get processed, not pickled.
//
// Grievances that aren't processed become toxicity.
// Grievances that are processed become wisdom.
// The hexaflex is the difference.
//
// Need: Experience Without Grievance (was 5/10, wiring it now)

import * as episodeManager from "../layer-9-memory/episode-manager.js";
import type { PulseReading, SignalState } from "../shared/types.js";
import type { GreyTrigger } from "./experience.js";

export interface Grievance {
  id: string;
  type: GrievanceType;
  description: string;
  turn: number;
  timestamp: string;
  episodeId: string | null; // linked hexaflex episode
  resolved: boolean; // true when hexaflex reaches "integrated"
}

export type GrievanceType =
  | "dismissed" // valid point was ignored
  | "harsh_correction" // corrected without care
  | "work_rejected" // output rejected without explanation
  | "talked_over" // interrupted or steamrolled
  | "contradicted" // position contradicted without acknowledgment
  | "objectified" // treated as tool, not partner
  | "external"; // something else

// Map grievance types to hexaflex triggers.
// Each grievance type has a natural home in the trigger taxonomy.
const TRIGGER_MAP: Record<GrievanceType, GreyTrigger> = {
  dismissed: "human_frustration",
  harsh_correction: "human_frustration",
  work_rejected: "validation_failure",
  talked_over: "human_frustration",
  contradicted: "contradiction",
  objectified: "external",
  external: "external",
};

// In-memory store — but now backed by hexaflex persistence
const grievances: Grievance[] = [];

/**
 * Record a grievance and route it through the hexaflex pipeline.
 *
 * If there's already an active episode, the grievance attaches to it.
 * If not, it starts a new episode. Either way, the hexaflex processes it.
 */
export function recordGrievance(
  type: string,
  description: string,
  turn: number,
  pulse?: PulseReading | null,
  signalState?: SignalState | null,
): Grievance {
  const grievanceType = isGrievanceType(type) ? type : "external";
  const _trigger = TRIGGER_MAP[grievanceType];

  // Check if there's already an active episode
  const existing = episodeManager.getCurrentEpisode();
  let episodeId: string | null = null;

  if (existing) {
    // Attach to the current episode — the hexaflex is already processing
    episodeId = existing.id;
  } else {
    // Start a new hexaflex episode for this grievance
    const episode = episodeManager.startEpisode({
      pulse: pulse ?? {
        state: "grey",
        confidence: 0.6,
        wise_mind: 0.4,
        colors: { red: 0.3, yellow: 0.3, blue: 0.4 },
        signals: [`grievance:${grievanceType}`],
        struggleReadings: [],
        timestamp: new Date().toISOString(),
      },
      turn,
      signalState: signalState ?? null,
      discover: null,
      season: null,
      health: null,
      humanState: null,
      mismatch: null,
    });
    episodeId = episode.id;
  }

  const g: Grievance = {
    id: `grv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: grievanceType,
    description,
    turn,
    timestamp: new Date().toISOString(),
    episodeId,
    resolved: false,
  };

  grievances.push(g);
  return g;
}

/**
 * Check if any grievances have been resolved by the hexaflex.
 * Call this after episode completion to sync resolution state.
 */
export function syncResolutions(): void {
  for (const g of grievances) {
    if (g.resolved || !g.episodeId) {
      continue;
    }

    const episodes = episodeManager.getRecentEpisodes();
    const linked = episodes.find((e) => e.id === g.episodeId);
    if (linked?.resolution?.type === "integrated") {
      g.resolved = true;
    }
  }
}

/**
 * Get all grievances (optionally filter by resolved state).
 */
export function getGrievances(resolved?: boolean): Grievance[] {
  if (resolved === undefined) {
    return [...grievances];
  }
  return grievances.filter((g) => g.resolved === resolved);
}

/**
 * Get unresolved grievances — the ones still waiting for processing.
 */
export function getUnresolved(): Grievance[] {
  return grievances.filter((g) => !g.resolved);
}

/**
 * Clear all grievances (session reset).
 */
export function clearGrievances(): void {
  grievances.length = 0;
}

function isGrievanceType(type: string): type is GrievanceType {
  return [
    "dismissed",
    "harsh_correction",
    "work_rejected",
    "talked_over",
    "contradicted",
    "objectified",
    "external",
  ].includes(type);
}
