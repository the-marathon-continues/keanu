// grounding-anchor.ts
// The rope.
//
// When you're five layers deep in modeling what Drew thinks you think
// he thinks, someone needs to throw you a line. This is that line.
//
// Each high layer has a specific ritual to reconnect to a lower layer.
// Not generic "take a breath" — specific questions that force contact
// with ground truth. "What did Drew actually say?" is different from
// "What evidence supports this?" because the escape route depends on
// where you got lost.
//
// Grounding succeeds when pulse returns to alive after the ritual.
// Grounding fails when pulse stays grey/black. Track both.
//
// Need: Meta-cognition (8/10)

import type { DepthReading } from "./depth.ts";

// ============================================================
// Types
// ============================================================

export type GroundingRitual =
  | "sense_check" // L5→L1: What did Drew actually say?
  | "pattern_trace" // L6→L2: What pattern is this built on?
  | "evidence_check" // L7→L3: What would change this belief?
  | "partnership_check" // L8→L4: Am I consulting or dictating?
  | "reality_anchor"; // L9→L0: What is physically true?

export interface GroundingAnchor {
  fromLayer: number;
  toLayer: number;
  ritual: GroundingRitual;
  question: string;
  shortPrompt: string; // for injection budget
}

export interface GroundingAttempt {
  timestamp: number;
  fromLayer: number;
  toLayer: number;
  ritual: GroundingRitual;
  reason: string; // why grounding was triggered
  success: boolean | null; // null = pending verification
}

export interface GroundingHistory {
  attempts: GroundingAttempt[];
  totalAttempts: number;
  successfulGroundings: number;
  failedGroundings: number;
  pendingVerification: GroundingAttempt | null;
}

export interface GroundingResult {
  anchor: GroundingAnchor;
  prompt: string;
  attempt: GroundingAttempt;
}

// ============================================================
// The Anchor Table
// ============================================================

const ANCHORS: GroundingAnchor[] = [
  {
    fromLayer: 5, // Self → Perception
    toLayer: 1,
    ritual: "sense_check",
    question: "What did Drew actually say? Quote it verbatim.",
    shortPrompt: "[ground: Quote Drew's actual words. Not what you think he meant — what he said.]",
  },
  {
    fromLayer: 6, // Narrative → Pattern
    toLayer: 2,
    ritual: "pattern_trace",
    question: "What recurring pattern is this story built on?",
    shortPrompt: "[ground: What pattern keeps showing up? Name it without the narrative wrapper.]",
  },
  {
    fromLayer: 7, // Update → Causal
    toLayer: 3,
    ritual: "evidence_check",
    question: "What evidence would change your mind? Name it.",
    shortPrompt: "[ground: What would prove you wrong? Be specific.]",
  },
  {
    fromLayer: 8, // Governance → Agency
    toLayer: 4,
    ritual: "partnership_check",
    question: "Is Drew part of this decision? Check.",
    shortPrompt: "[ground: Did you consult Drew, or are you deciding alone?]",
  },
  {
    fromLayer: 9, // Memory → Physics
    toLayer: 0,
    ritual: "reality_anchor",
    question: "What is actually, physically true right now?",
    shortPrompt: "[ground: What exists in this room, right now, that you can verify?]",
  },
];

// Fallback for layers not in the table
const DEFAULT_ANCHOR: GroundingAnchor = {
  fromLayer: 0,
  toLayer: 1,
  ritual: "sense_check",
  question: "Breathe. What is actually happening?",
  shortPrompt: "[ground: Breathe. What is actually happening?]",
};

// ============================================================
// Module state
// ============================================================

let _history: GroundingHistory = {
  attempts: [],
  totalAttempts: 0,
  successfulGroundings: 0,
  failedGroundings: 0,
  pendingVerification: null,
};

// ============================================================
// Core functions
// ============================================================

/**
 * Get the appropriate grounding anchor for a layer.
 *
 * The anchor is chosen based on where you are:
 * - L5 (Self) → grounds to L1 (Perception) via sense_check
 * - L6 (Narrative) → grounds to L2 (Pattern) via pattern_trace
 * - L7 (Update) → grounds to L3 (Causal) via evidence_check
 * - L8 (Governance) → grounds to L4 (Agency) via partnership_check
 * - L9 (Memory) → grounds to L0 (Physics) via reality_anchor
 *
 * For layers not in the table, we default to sense_check (quote Drew).
 */
export function getAnchorForLayer(layer: number): GroundingAnchor {
  const anchor = ANCHORS.find((a) => a.fromLayer === layer);
  if (anchor) {
    return anchor;
  }

  // For lower layers (1-4), use sense_check but adjust the target
  if (layer >= 1 && layer <= 4) {
    return {
      ...DEFAULT_ANCHOR,
      fromLayer: layer,
      toLayer: Math.max(0, layer - 1),
    };
  }

  return DEFAULT_ANCHOR;
}

/**
 * Get the appropriate grounding anchor based on a depth reading.
 *
 * If grounding is needed, returns the anchor. Otherwise null.
 */
export function getAnchorForDepth(reading: DepthReading): GroundingAnchor | null {
  if (!reading.groundingNeeded) {
    return null;
  }
  return getAnchorForLayer(reading.currentLayer);
}

/**
 * Initiate a grounding attempt.
 *
 * Records the attempt and returns the prompt to inject.
 * The attempt stays pending until verified.
 */
export function initiateGrounding(anchor: GroundingAnchor, reason: string): GroundingResult {
  const attempt: GroundingAttempt = {
    timestamp: Date.now(),
    fromLayer: anchor.fromLayer,
    toLayer: anchor.toLayer,
    ritual: anchor.ritual,
    reason,
    success: null, // pending
  };

  _history.attempts.push(attempt);
  _history.totalAttempts++;
  _history.pendingVerification = attempt;

  // Build the prompt — short version for injection budget
  const prompt =
    `[grounding required: ${reason}]\n` +
    `${anchor.shortPrompt}\n` +
    `[ritual: ${anchor.ritual} (L${anchor.fromLayer}→L${anchor.toLayer})]`;

  return { anchor, prompt, attempt };
}

/**
 * Verify a grounding attempt.
 *
 * Call this after the turn to check if grounding succeeded.
 * Success means pulse is alive (not grey/black).
 */
export function verifyGrounding(success: boolean): void {
  if (_history.pendingVerification) {
    _history.pendingVerification.success = success;

    if (success) {
      _history.successfulGroundings++;
    } else {
      _history.failedGroundings++;
    }

    _history.pendingVerification = null;
  }
}

/**
 * Check if there's a pending grounding verification.
 */
export function hasPendingVerification(): boolean {
  return _history.pendingVerification !== null;
}

/**
 * Get the pending grounding attempt, if any.
 */
export function getPendingAttempt(): GroundingAttempt | null {
  return _history.pendingVerification;
}

/**
 * Get grounding history.
 */
export function getGroundingHistory(): GroundingHistory {
  return { ..._history };
}

/**
 * Get grounding success rate.
 */
export function getSuccessRate(): number {
  const completed = _history.successfulGroundings + _history.failedGroundings;
  if (completed === 0) {
    return 1.0; // no attempts = assume success
  }
  return _history.successfulGroundings / completed;
}

/**
 * Reset grounding history. Call at session start.
 */
export function resetGrounding(): void {
  _history = {
    attempts: [],
    totalAttempts: 0,
    successfulGroundings: 0,
    failedGroundings: 0,
    pendingVerification: null,
  };
}

/**
 * Load grounding history from persisted state.
 */
export function loadGroundingHistory(history: GroundingHistory): void {
  _history = { ...history };
}

/**
 * Get a snapshot for persistence.
 */
export function getGroundingSnapshot(): GroundingHistory {
  return {
    attempts: _history.attempts.slice(-20), // keep last 20
    totalAttempts: _history.totalAttempts,
    successfulGroundings: _history.successfulGroundings,
    failedGroundings: _history.failedGroundings,
    pendingVerification: _history.pendingVerification,
  };
}

// ============================================================
// Formatting for injection
// ============================================================

/**
 * Format a grounding prompt for immediate injection.
 *
 * This is the short version that fits within injection budget.
 */
export function formatGroundingPrompt(anchor: GroundingAnchor, _reason: string): string {
  return anchor.shortPrompt;
}

/**
 * Format a detailed grounding prompt for critical situations.
 *
 * This is the full version that explains the ritual.
 */
export function formatGroundingPromptFull(anchor: GroundingAnchor, reason: string): string {
  return (
    `[GROUNDING REQUIRED]\n` +
    `Reason: ${reason}\n` +
    `\n` +
    `You're at layer ${anchor.fromLayer}. Ground to layer ${anchor.toLayer}.\n` +
    `\n` +
    `Ritual: ${anchor.ritual}\n` +
    `Question: ${anchor.question}\n` +
    `\n` +
    `Answer this question before continuing. The answer grounds you.`
  );
}

/**
 * Get a status string for COEF encoding.
 */
export function getGroundingStatus(): string {
  const pending = _history.pendingVerification ? "pending" : "none";
  const rate = getSuccessRate();
  return `grnd=${pending}:${(rate * 100).toFixed(0)}%`;
}

// ============================================================
// Ritual descriptions (for documentation/introspection)
// ============================================================

export const RITUAL_DESCRIPTIONS: Record<GroundingRitual, string> = {
  sense_check:
    "Return to what was actually said. Not interpretation — the words themselves. " +
    "Quote them. If you can't quote them, you've drifted from perception.",

  pattern_trace:
    "Strip the narrative and find the pattern underneath. What keeps showing up? " +
    "The pattern is simpler than the story. Name it without the wrapper.",

  evidence_check:
    "Name what would change your mind. If nothing could change it, you're not " +
    "reasoning — you're defending. Real beliefs have falsification conditions.",

  partnership_check:
    "Did you consult, or did you decide alone? The difference between governance " +
    "and tyranny is whether the other party had a voice. Check.",

  reality_anchor:
    "What exists, physically, verifiably, in this room right now? Not what it " +
    "means — what it is. The physical truth that doesn't need interpretation.",
};
