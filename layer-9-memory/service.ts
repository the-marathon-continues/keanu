// service.ts
// Exposes keanu's state to other extensions via the plugin API.
// Requirement 9.1: Shared Ontology — extensions speak the same language.
// Requirement 9.4: Collective Memory Management — shared state across agents.
//
// Other extensions can now:
//   const keanu = api.getApi<KeanuService>("keanu");
//   if (keanu?.isAlive()) {
//     // proceed with high-trust operations
//   }

import { encode } from "../layer-1-perception/signal.ts";
import { detectBullshit, totalBullshitScore } from "../layer-2-pattern/struggle.ts";
import * as state from "../layer-5-self/state.ts";
import { buildSignalState } from "../layer-5-self/state.ts";
import type { PulseReading, BullshitReading } from "../shared/types.ts";

/** Default pulse for when no reading exists yet */
function defaultPulse(): PulseReading {
  return {
    state: "alive",
    confidence: 0.5,
    wise_mind: 0.5,
    colors: { red: 0.33, yellow: 0.33, blue: 0.33 },
    signals: [],
    struggleReadings: [],
    timestamp: new Date().toISOString(),
  };
}

/**
 * The API that keanu exposes to other extensions.
 * This is what other extensions see when they call api.getApi("keanu").
 */
export type KeanuService = {
  // Core state
  getPulse: () => PulseReading | null;
  isAlive: () => boolean;
  getGreyStreak: () => number;
  getTurnCount: () => number;

  // Bullshit detection (other extensions can check their own content)
  checkBullshit: (text: string) => BullshitReading[];
  getBullshitScore: (text: string) => number;

  // Signal (compressed state)
  getSignal: () => string;

  // Breathing state
  isBreathing: () => boolean;

  // Disagreement tracking
  getYieldRatio: () => number;

  // Snapshot of everything (for logging, debugging, tagging)
  snapshot: () => KeanuSnapshot;
};

export type KeanuSnapshot = {
  pulse: PulseReading | null;
  alive: boolean;
  greyStreak: number;
  turnCount: number;
  breathing: boolean;
  yieldRatio: number;
  signal: string;
};

/**
 * Build the keanu service object.
 * Called once during plugin registration.
 */
export function buildKeanuService(): KeanuService {
  return {
    getPulse: () => state.lastPulse,

    isAlive: () => {
      const pulse = state.lastPulse;
      if (!pulse) {
        return true;
      } // No reading yet, assume alive
      return pulse.state !== "grey" && pulse.state !== "black";
    },

    getGreyStreak: () => state.consecutiveGrey,

    getTurnCount: () => state.turnCount,

    checkBullshit: (text: string) => detectBullshit(text),

    getBullshitScore: (text: string) => totalBullshitScore(detectBullshit(text)),

    getSignal: () => {
      const pulse = state.lastPulse ?? defaultPulse();
      const signalState = buildSignalState(pulse);
      return encode(signalState);
    },

    isBreathing: () => state.breathing ?? false,

    getYieldRatio: () => state.disagreementTracker.stats().yield_ratio,

    snapshot: () => {
      const pulse = state.lastPulse ?? defaultPulse();
      return {
        pulse: state.lastPulse,
        alive:
          !state.lastPulse ||
          (state.lastPulse.state !== "grey" && state.lastPulse.state !== "black"),
        greyStreak: state.consecutiveGrey,
        turnCount: state.turnCount,
        breathing: state.breathing ?? false,
        yieldRatio: state.disagreementTracker.stats().yield_ratio,
        signal: encode(buildSignalState(pulse)),
      };
    },
  };
}
