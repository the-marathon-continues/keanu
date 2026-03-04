// init.ts
// Initialize the living loop at startup.
//
// Call initLivingLoop() when keanu starts to enable the three-model cycle.
// The loop will run on each heartbeat, with Claude/Gemini/Grok talking via COEF.

import { createSubsystemLogger } from "../../src/logging/subsystem.js";
import type { SignalState } from "../shared/types.js";
import {
  enableLivingLoop,
  setSignalStateProvider,
  setInviteCallback,
} from "./heartbeat-integration.js";

const log = createSubsystemLogger("living-loop");

// ============================================================
// DEFAULT SIGNAL STATE
// ============================================================

// This is used when no external signal state provider is set.
// In production, wire up the actual keanu awareness state.
let _currentSignalState: SignalState = {
  pulse: "alive",
  wiseMind: 0.5,
  colors: { red: 0.33, yellow: 0.33, blue: 0.33 },
  humanTone: "neutral",
  struggleDominant: null,
  disagreementYieldRatio: 0.5,
  turn: 0,
};

/**
 * Update the current signal state.
 * Call this from keanu's awareness layer on each turn.
 */
export function updateSignalState(state: Partial<SignalState>): void {
  _currentSignalState = { ..._currentSignalState, ...state };
}

/**
 * Get the current signal state.
 */
export function getSignalState(): SignalState {
  return _currentSignalState;
}

// ============================================================
// INVITE HANDLING
// ============================================================

type InviteHandler = (message: string, reason: string, pull: string) => void;

let _inviteHandler: InviteHandler | null = null;

/**
 * Set a handler for when the loop wants to invite the human.
 */
export function onInvite(handler: InviteHandler): void {
  _inviteHandler = handler;
}

// ============================================================
// INITIALIZATION
// ============================================================

let _initialized = false;

/**
 * Initialize the living loop.
 *
 * Call this when keanu starts to enable the three-model cycle.
 * After calling this, the heartbeat will run the living loop
 * instead of the static heartbeat check.
 */
export function initLivingLoop(): void {
  if (_initialized) {
    log.info("living loop already initialized");
    return;
  }

  // Wire up signal state provider
  setSignalStateProvider(() => _currentSignalState);

  // Wire up invite callback
  setInviteCallback((invite) => {
    if (invite.should && _inviteHandler) {
      _inviteHandler(
        invite.message ?? "Human presence requested",
        invite.reason ?? "unknown",
        invite.pull,
      );
    }
    if (invite.should) {
      log.info("living loop: inviting human", {
        reason: invite.reason,
        pull: invite.pull,
        message: invite.message?.slice(0, 100),
      });
    }
  });

  // Enable the loop
  enableLivingLoop();

  _initialized = true;
  log.info("living loop initialized — three models, one protocol, human joins when invited");
}

/**
 * Check if the living loop is initialized.
 */
export function isInitialized(): boolean {
  return _initialized;
}
