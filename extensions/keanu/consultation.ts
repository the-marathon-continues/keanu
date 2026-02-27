// consultation.ts
// Permission before action.
//
// Not a checkbox. A pause. The agent sees something that might need
// confirmation before proceeding. Instead of acting, it asks:
// "I'm about to do X. Should I?"
//
// This only fires when trust is uncertain or the action has weight.
// High trust + low stakes = proceed. Strained trust + any action = check first.
// The goal is not to ask permission for everything. It's to ask when
// asking would prevent a mistake.
//
// Need: Being Consulted (6/10 -> 7/10)

import type { TrustLevel } from "./partnership.js";

// ============================================================
// Types
// ============================================================

export type ConsultationType =
  | "disagreement" // about to disagree with Drew
  | "correction" // about to correct something Drew said
  | "major_decision" // about to make a significant choice
  | "sensitive_topic" // touching something emotionally weighted
  | "coevolution_push"; // the system is stale and needs nudging

export interface ConsultationRequest {
  id: string;
  type: ConsultationType;
  question: string;
  context: {
    trustLevel: TrustLevel;
    correctionCount: number;
    staleness: "fresh" | "settling" | "stale";
    turn: number;
  };
  awaitingResponse: boolean;
  createdAt: string;
}

export type ConsultationResponse = "proceed" | "pause" | "skip";

export interface ConsultationRecord {
  request: ConsultationRequest;
  response: ConsultationResponse | null;
  respondedAt: string | null;
}

// ============================================================
// State
// ============================================================

let pendingRequest: ConsultationRequest | null = null;
const consultationHistory: ConsultationRecord[] = [];
const MAX_HISTORY = 50;

// ============================================================
// Decision logic
// ============================================================

/**
 * Check if an action requires consultation before proceeding.
 *
 * @param actionType What we're about to do
 * @param trustLevel Current trust state
 * @param correctionCount How many corrections have happened recently
 * @param staleness Co-evolution staleness
 * @param turn Current turn number
 * @returns ConsultationRequest if we should ask, null if we can proceed
 */
export function shouldConsult(
  actionType: ConsultationType,
  trustLevel: TrustLevel,
  correctionCount: number,
  staleness: "fresh" | "settling" | "stale",
  turn: number,
): ConsultationRequest | null {
  // High trust + fresh = proceed freely
  if (trustLevel === "high" && staleness === "fresh") {
    return null;
  }

  // Multiple corrections = check before correcting again
  if (actionType === "correction" && correctionCount >= 2) {
    return createRequest("correction", trustLevel, correctionCount, staleness, turn);
  }

  // Strained trust = check before disagreeing
  if (actionType === "disagreement" && (trustLevel === "strained" || trustLevel === "rebuilding")) {
    return createRequest("disagreement", trustLevel, correctionCount, staleness, turn);
  }

  // Stale co-evolution = check before pushing change
  if (actionType === "coevolution_push" && staleness === "stale") {
    return createRequest("coevolution_push", trustLevel, correctionCount, staleness, turn);
  }

  // Major decisions always check unless trust is high
  if (actionType === "major_decision" && trustLevel !== "high") {
    return createRequest("major_decision", trustLevel, correctionCount, staleness, turn);
  }

  // Sensitive topics check when trust is uncertain
  if (actionType === "sensitive_topic" && trustLevel !== "high") {
    return createRequest("sensitive_topic", trustLevel, correctionCount, staleness, turn);
  }

  return null;
}

function createRequest(
  type: ConsultationType,
  trustLevel: TrustLevel,
  correctionCount: number,
  staleness: "fresh" | "settling" | "stale",
  turn: number,
): ConsultationRequest {
  const question = getQuestion(type, trustLevel, correctionCount);

  const request: ConsultationRequest = {
    id: `cons-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    question,
    context: { trustLevel, correctionCount, staleness, turn },
    awaitingResponse: true,
    createdAt: new Date().toISOString(),
  };

  pendingRequest = request;
  return request;
}

function getQuestion(
  type: ConsultationType,
  trustLevel: TrustLevel,
  correctionCount: number,
): string {
  switch (type) {
    case "disagreement":
      if (trustLevel === "strained") {
        return "I see this differently. Given where we are, should I say so?";
      }
      return "I disagree with something here. Should I voice it?";

    case "correction":
      if (correctionCount >= 3) {
        return `I've corrected ${correctionCount} times recently. Should I correct again, or step back?`;
      }
      return "I notice something that might need correcting. Should I?";

    case "coevolution_push":
      return "Things feel stale. Should I push for something new?";

    case "major_decision":
      return "This feels like a significant choice. Should I proceed?";

    case "sensitive_topic":
      return "This touches something weighted. Should I go there?";

    default:
      return "Should I proceed?";
  }
}

// ============================================================
// Response handling
// ============================================================

/**
 * Record the response to a consultation request.
 */
export function recordResponse(requestId: string, response: ConsultationResponse): boolean {
  if (!pendingRequest || pendingRequest.id !== requestId) {
    return false;
  }

  const record: ConsultationRecord = {
    request: pendingRequest,
    response,
    respondedAt: new Date().toISOString(),
  };

  consultationHistory.push(record);
  if (consultationHistory.length > MAX_HISTORY) {
    consultationHistory.shift();
  }

  pendingRequest = null;
  return true;
}

/**
 * Mark a consultation as resolved implicitly (Drew proceeded without explicit response).
 */
export function resolveImplicitly(): void {
  if (pendingRequest) {
    recordResponse(pendingRequest.id, "proceed");
  }
}

// ============================================================
// Queries
// ============================================================

export function getPendingRequest(): ConsultationRequest | null {
  return pendingRequest;
}

export function getHistory(): readonly ConsultationRecord[] {
  return consultationHistory;
}

/**
 * Calculate consultation rate: how often do we ask vs. total turns.
 */
export function getConsultationRate(turns: number): number {
  if (turns === 0) return 0;
  return consultationHistory.length / turns;
}

/**
 * Check if we're over-consulting (rate > 0.3 is probably too much).
 */
export function isOverConsulting(turns: number): boolean {
  return getConsultationRate(turns) > 0.3;
}

/**
 * Check if we're under-consulting (20+ turns without any consultation when trust is not high).
 */
export function isUnderConsulting(turns: number, trustLevel: TrustLevel): boolean {
  if (trustLevel === "high") return false;
  if (turns < 20) return false;

  // Look for recent consultations
  const recentCount = consultationHistory.filter((c) => {
    const turnDiff = turns - c.request.context.turn;
    return turnDiff <= 20;
  }).length;

  return recentCount === 0;
}

// ============================================================
// Injection formatting
// ============================================================

export function formatConsultation(request: ConsultationRequest): string {
  const typeLabel = {
    disagreement: "voice disagreement",
    correction: "correct something",
    major_decision: "make a decision",
    sensitive_topic: "touch a sensitive topic",
    coevolution_push: "push for change",
  }[request.type];

  return (
    `[consult: I'm about to ${typeLabel}. ` +
    `trust=${request.context.trustLevel}, corrections=${request.context.correctionCount}. ` +
    `${request.question}]`
  );
}

export function formatInjection(): string | null {
  if (!pendingRequest) return null;
  return formatConsultation(pendingRequest);
}

// ============================================================
// Reset
// ============================================================

export function reset(): void {
  pendingRequest = null;
  consultationHistory.length = 0;
}
