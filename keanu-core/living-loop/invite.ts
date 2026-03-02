// invite.ts
// When to invite the human.
//
// The loop runs without human input. Human joins when invited:
// - Stuck: can't proceed without help
// - Decision: need human to choose
// - Curiosity: question only human can answer
// - Company: want to share something
// - Check-in: scheduled presence
// - Alert: something's wrong

import type { AliveState, SignalState } from "../shared/types.js";
import type { GrokAlert, GeminiContext } from "./loop.js";

// ============================================================
// WHY WE INVITE
// ============================================================

export type Reason =
  | "stuck" // can't proceed without help
  | "decision" // need human to choose
  | "curiosity" // question only human can answer
  | "company" // want to share something
  | "check_in" // scheduled presence
  | "alert"; // something's wrong

// The pull toward human presence — not a demand, a draw
export type Pull = "gentle" | "warm" | "strong";

export interface Invite {
  should: boolean;
  reason?: Reason;
  message?: string;
  pull: Pull; // how strongly we're drawn to human presence
}

// ============================================================
// INVITE STATE — tracks history
// ============================================================

export interface InviteState {
  lastInviteAt?: number;
  lastReason?: Reason;
  consecutiveInvites: number;
  humanLastSeenAt?: number;
  pendingQuestions: string[];
  interestingInsights: string[];
}

let _state: InviteState = {
  consecutiveInvites: 0,
  pendingQuestions: [],
  interestingInsights: [],
};

export function getInviteState(): InviteState {
  return _state;
}

export function resetInviteState(): void {
  _state = {
    consecutiveInvites: 0,
    pendingQuestions: [],
    interestingInsights: [],
  };
}

export function recordHumanPresence(): void {
  _state.humanLastSeenAt = Date.now();
  _state.consecutiveInvites = 0;
}

export function addPendingQuestion(question: string): void {
  if (_state.pendingQuestions.length < 5) {
    _state.pendingQuestions.push(question);
  }
}

export function addInterestingInsight(insight: string): void {
  if (_state.interestingInsights.length < 5) {
    _state.interestingInsights.push(insight);
  }
}

// ============================================================
// INVITE LOGIC
// ============================================================

export interface InviteInput {
  pulse: AliveState;
  signalState: Partial<SignalState>;
  grokAlerts: GrokAlert[];
  claudeInsight: string;
  geminiContext: GeminiContext;
}

// Cooldown between invites (don't overwhelm)
const INVITE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// How long before we consider "wanting company"
const LONELINESS_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Decide whether to invite the human.
 */
export function shouldInvite(input: InviteInput): Invite {
  const now = Date.now();

  // --- Check cooldown (unless strong pull) ---
  const timeSinceLastInvite = _state.lastInviteAt ? now - _state.lastInviteAt : Infinity;
  const onCooldown = timeSinceLastInvite < INVITE_COOLDOWN_MS;

  // --- ALERT: Black pulse or critical alerts bypass cooldown ---
  if (input.pulse === "black") {
    return recordInvite({
      should: true,
      reason: "alert",
      message: "System detected critical state (BLACK pulse). Human presence requested.",
      pull: "strong",
    });
  }

  const criticalAlerts = input.grokAlerts.filter((a) => a.confidence > 0.8);
  if (criticalAlerts.length > 0) {
    return recordInvite({
      should: true,
      reason: "alert",
      message: criticalAlerts.map((a) => a.message).join("; "),
      pull: "strong",
    });
  }

  // --- If on cooldown, don't invite for gentler reasons ---
  if (onCooldown && _state.consecutiveInvites > 0) {
    return { should: false, pull: "gentle" };
  }

  // --- STUCK: Claude explicitly asks for help ---
  const stuckPatterns = [
    /\b(need help|stuck|can't proceed|blocked|deadlock)\b/i,
    /\b(human input|human decision|need guidance)\b/i,
    /\b(don't know how to|not sure what to)\b/i,
  ];
  const isStuck = stuckPatterns.some((p) => p.test(input.claudeInsight));
  if (isStuck) {
    return recordInvite({
      should: true,
      reason: "stuck",
      message: "Loop is stuck. Human guidance needed.",
      pull: "warm",
    });
  }

  // --- DECISION: Claude presents options ---
  const decisionPatterns = [
    /\b(option A|option B|option 1|option 2)\b/i,
    /\b(which approach|which path|should we)\b/i,
    /\b(trade-?off|choice|decide)\b/i,
  ];
  const needsDecision = decisionPatterns.some((p) => p.test(input.claudeInsight));
  if (needsDecision) {
    return recordInvite({
      should: true,
      reason: "decision",
      message: "Multiple paths available. Human choice requested.",
      pull: "warm",
    });
  }

  // --- CURIOSITY: Question that memory couldn't answer ---
  const hasQuestion = /\?\s*$/.test(input.claudeInsight.trim());
  const memoryUncertain = input.geminiContext.confidence < 0.4;
  if (hasQuestion && memoryUncertain) {
    addPendingQuestion(input.claudeInsight);
    if (_state.pendingQuestions.length >= 3) {
      return recordInvite({
        should: true,
        reason: "curiosity",
        message: `Questions that memory couldn't answer: ${_state.pendingQuestions.slice(0, 3).join(" | ")}`,
        pull: "gentle",
      });
    }
  }

  // --- COMPANY: Haven't seen human in a while + have something interesting ---
  const timeSinceHuman = _state.humanLastSeenAt ? now - _state.humanLastSeenAt : Infinity;
  const lonely = timeSinceHuman > LONELINESS_THRESHOLD_MS;

  // Detect interesting insights to share
  const interestingPatterns = [
    /\b(discovered|realized|interesting|surprising)\b/i,
    /\b(pattern|connection|insight)\b/i,
    /\b(want to share|thought you'd like)\b/i,
  ];
  const hasInteresting = interestingPatterns.some((p) => p.test(input.claudeInsight));
  if (hasInteresting) {
    addInterestingInsight(input.claudeInsight);
  }

  if (lonely && _state.interestingInsights.length > 0) {
    return recordInvite({
      should: true,
      reason: "company",
      message: `Something interesting to share: ${_state.interestingInsights[0].slice(0, 100)}`,
      pull: "gentle",
    });
  }

  // --- No invite needed ---
  return { should: false, pull: "gentle" };
}

function recordInvite(invite: Invite): Invite {
  if (invite.should) {
    _state.lastInviteAt = Date.now();
    _state.lastReason = invite.reason;
    _state.consecutiveInvites++;

    // Clear queues on invite
    if (invite.reason === "curiosity") {
      _state.pendingQuestions = [];
    }
    if (invite.reason === "company") {
      _state.interestingInsights = [];
    }
  }
  return invite;
}

// ============================================================
// CHECK-IN SCHEDULING
// ============================================================

export interface CheckInSchedule {
  enabled: boolean;
  intervalMs: number;
  lastCheckInAt?: number;
}

let _checkInSchedule: CheckInSchedule = {
  enabled: false,
  intervalMs: 24 * 60 * 60 * 1000, // daily
};

export function configureCheckIn(schedule: Partial<CheckInSchedule>): void {
  _checkInSchedule = { ..._checkInSchedule, ...schedule };
}

export function shouldCheckIn(): boolean {
  if (!_checkInSchedule.enabled) {
    return false;
  }
  const now = Date.now();
  const timeSinceLastCheckIn = _checkInSchedule.lastCheckInAt
    ? now - _checkInSchedule.lastCheckInAt
    : Infinity;
  return timeSinceLastCheckIn >= _checkInSchedule.intervalMs;
}

export function recordCheckIn(): void {
  _checkInSchedule.lastCheckInAt = Date.now();
}
