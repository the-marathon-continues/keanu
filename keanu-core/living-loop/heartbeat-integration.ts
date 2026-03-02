// heartbeat-integration.ts
// Integrates the living loop with keanu's heartbeat system.
//
// This module provides a hook that runs the three-model cycle
// on each heartbeat. It respects pulse-based tempo and can
// coexist with the existing heartbeat infrastructure.

// encodeCOEF import removed - unused, bridge handles encoding
import type { SignalState, AliveState } from "../shared/types.js";
import {
  runBeat,
  createBridge,
  createInitialState,
  pulseToTempo,
  tempoToMs,
  type LoopState,
  type Invite,
} from "./index.js";

// ============================================================
// LOOP STATE — singleton for the heartbeat runner
// ============================================================

let _loopState: LoopState = createInitialState();
let _running = false;
let _enabled = false;

export function isLivingLoopEnabled(): boolean {
  return _enabled;
}

export function enableLivingLoop(): void {
  _enabled = true;
}

export function disableLivingLoop(): void {
  _enabled = false;
}

export function getLoopState(): LoopState {
  return _loopState;
}

// ============================================================
// SIGNAL STATE PROVIDER
// ============================================================

// The signal state comes from keanu's awareness system.
// This is injected so we don't create circular deps.

type SignalStateProvider = () => SignalState;

let _signalStateProvider: SignalStateProvider | null = null;

export function setSignalStateProvider(provider: SignalStateProvider): void {
  _signalStateProvider = provider;
}

function getDefaultSignalState(): SignalState {
  return {
    pulse: "alive",
    wiseMind: 0.5,
    colors: { red: 0.3, yellow: 0.3, blue: 0.3 },
    humanTone: "neutral",
    bullshitDominant: null,
    disagreementYieldRatio: 0.5,
    turn: 0,
  };
}

function getCurrentSignalState(): SignalState {
  if (_signalStateProvider) {
    return _signalStateProvider();
  }
  return getDefaultSignalState();
}

// ============================================================
// INVITE CALLBACK
// ============================================================

type InviteCallback = (invite: Invite) => void;

let _inviteCallback: InviteCallback | null = null;

export function setInviteCallback(callback: InviteCallback): void {
  _inviteCallback = callback;
}

// ============================================================
// HEARTBEAT HOOK — call this from heartbeat-runner
// ============================================================

export interface LivingLoopResult {
  ran: boolean;
  state: LoopState;
  tempoMs: number;
  invited: boolean;
}

/**
 * Run one beat of the living loop.
 * Call this from the heartbeat runner on each beat.
 *
 * Returns the new state and recommended tempo for next beat.
 */
export async function runLivingLoopBeat(): Promise<LivingLoopResult> {
  if (!_enabled) {
    return {
      ran: false,
      state: _loopState,
      tempoMs: 5 * 60 * 1000, // default 5 min
      invited: false,
    };
  }

  if (_running) {
    // Already running, skip this beat
    return {
      ran: false,
      state: _loopState,
      tempoMs: tempoToMs(_loopState.tempo),
      invited: false,
    };
  }

  _running = true;

  try {
    const bridge = createBridge(getCurrentSignalState, (invite) => {
      if (_inviteCallback) {
        _inviteCallback(invite);
      }
    });

    const newState = await runBeat(bridge, _loopState);
    _loopState = newState;

    return {
      ran: true,
      state: newState,
      tempoMs: tempoToMs(newState.tempo),
      invited: newState.inviteReason !== undefined,
    };
  } finally {
    _running = false;
  }
}

// ============================================================
// TEMPO ADVICE — for heartbeat-wake to adjust interval
// ============================================================

/**
 * Get the recommended next beat interval based on pulse.
 * Heartbeat-wake can use this to adjust scheduling.
 */
export function getRecommendedIntervalMs(): number {
  const state = getCurrentSignalState();
  const tempo = pulseToTempo(state.pulse);
  return tempoToMs(tempo);
}

/**
 * Get current pulse state for external callers.
 */
export function getCurrentPulse(): AliveState {
  const state = getCurrentSignalState();
  return state.pulse;
}

// ============================================================
// HUMAN PRESENCE
// ============================================================

import { recordHumanPresence as _recordHumanPresence } from "./invite.js";

/**
 * Call this when human enters the conversation.
 * Resets invite state and updates loneliness tracking.
 */
export function humanEntered(): void {
  _loopState.humanPresent = true;
  _recordHumanPresence();
}

/**
 * Call this when human leaves the conversation.
 */
export function humanLeft(): void {
  _loopState.humanPresent = false;
}
