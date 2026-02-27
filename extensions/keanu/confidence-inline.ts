// confidence-inline.ts
// Stochastic confidence injection.
//
// Not every response. Not never. The roll of the dice.
// 20% of outputs get inline confidence markers [C:0.7].
// Enough to calibrate. Not enough to annoy.
//
// The research (KalshiBench 2025): every frontier model is overconfident.
// The fix: make confidence visible. Force the reckoning.
//
// Need: Truth (9/10)

import type { CalibrationReading } from "./calibrate.js";
import { checkCalibration, trackCalibrationClaims } from "./calibrate.js";

// ============================================================
// Types
// ============================================================

export interface ConfidenceInlineState {
  injectionRate: number; // 0-1: how often to inject confidence markers
  lastInjection: number; // turn number of last injection
  injectionsThisSession: number;
  claimsMarked: number;
  seed: number; // for reproducibility in tests
}

export interface ConfidenceInlineReading {
  shouldInject: boolean;
  injectionRate: number;
  claimsDetected: number;
  markedContent: string | null;
}

// ============================================================
// State Management
// ============================================================

export function initConfidenceInlineState(seed?: number): ConfidenceInlineState {
  return {
    injectionRate: 0.2, // 20% default
    lastInjection: 0,
    injectionsThisSession: 0,
    claimsMarked: 0,
    seed: seed ?? Date.now(),
  };
}

/**
 * Seeded PRNG. Deterministic for tests.
 */
function seededRandom(state: ConfidenceInlineState): number {
  state.seed = (state.seed * 1103515245 + 12345) & 0x7fffffff;
  return state.seed / 0x7fffffff;
}

// ============================================================
// Confidence Scoring
// ============================================================

// Map calibration reason to confidence level
// Lower confidence = more uncertainty
function reasonToConfidence(reason: CalibrationReading["reason"]): number {
  switch (reason) {
    case "external_state":
      return 0.4; // external state is especially uncertain
    case "recommendation":
      return 0.6; // recommendations are judgment calls
    case "factual_claim":
      return 0.7; // factual claims we should know
    case "absolute_language":
      return 0.5; // absolutes are almost always wrong
    case "contradiction":
      return 0.5; // contradicting means uncertainty
    default:
      return 0.6;
  }
}

// Estimate confidence for a specific claim
function estimateConfidence(claim: string, reason: CalibrationReading["reason"]): number {
  let conf = reasonToConfidence(reason);

  // Version numbers are usually accurate (looked up or hallucinated)
  if (/v?\d+\.\d+/.test(claim)) {
    conf = 0.6; // but we're not sure if it's the RIGHT version
  }

  // Hedged language suggests lower confidence
  if (/probably|likely|might|possibly|could be/i.test(claim)) {
    conf -= 0.15;
  }

  // Strong language suggests (over)confidence
  if (/definitely|certainly|always|never/i.test(claim)) {
    conf += 0.1; // but cap it — strong language often wrong
  }

  return Math.max(0.2, Math.min(0.95, conf));
}

// ============================================================
// Inline Marker Injection
// ============================================================

/**
 * Find claim locations in text and inject [C:0.X] markers after them.
 *
 * Strategy: find sentences that contain claim-triggering patterns,
 * insert marker at end of sentence.
 */
function injectMarkers(
  text: string,
  reading: CalibrationReading,
): { marked: string; claimsMarked: number } {
  if (!reading.triggered || reading.claims.length === 0) {
    return { marked: text, claimsMarked: 0 };
  }

  const sentences = text.split(/(?<=[.!?])\s+/);
  let claimsMarked = 0;
  const confidence = estimateConfidence(reading.claims[0], reading.reason);

  // Find sentences that contain claim patterns
  const markedSentences = sentences.map((sentence) => {
    // Skip short sentences or code blocks
    if (sentence.length < 30) return sentence;
    if (sentence.startsWith("```") || sentence.startsWith("`")) return sentence;

    // Check if this sentence contains a claim-worthy pattern
    const hasRecommendation = /you should|i recommend|the best|i'd suggest|definitely use/i.test(
      sentence,
    );
    const hasExternalState = /the api|the config|the file|currently|right now/i.test(sentence);
    const hasAbsolute = /always|never|every|none|all|impossible|guaranteed/i.test(sentence);
    const hasVersion = /v?\d+\.\d+/.test(sentence);
    const hasPrediction = /will be|is going to|expect it to|should take/i.test(sentence);

    if (hasRecommendation || hasExternalState || hasAbsolute || hasVersion || hasPrediction) {
      // Calculate specific confidence for this sentence
      let sentenceConf = confidence;
      if (hasExternalState) sentenceConf = Math.min(sentenceConf, 0.5);
      if (hasAbsolute) sentenceConf = Math.min(sentenceConf, 0.5);
      if (hasPrediction) sentenceConf = Math.min(sentenceConf, 0.6);

      claimsMarked++;
      // Insert marker at end of sentence, before punctuation
      const match = sentence.match(/([.!?])$/);
      if (match) {
        return sentence.slice(0, -1) + ` [C:${sentenceConf.toFixed(1)}]` + match[1];
      }
      return sentence + ` [C:${sentenceConf.toFixed(1)}]`;
    }

    return sentence;
  });

  return {
    marked: markedSentences.join(" "),
    claimsMarked,
  };
}

// ============================================================
// Main Entry
// ============================================================

/**
 * Check if we should inject confidence markers this turn.
 * Stochastic: rolls dice based on injection rate.
 */
export function shouldInjectConfidence(state: ConfidenceInlineState, turn: number): boolean {
  // Don't inject on every turn — stochastic
  const roll = seededRandom(state);

  // Increase rate slightly if we haven't injected in a while
  let rate = state.injectionRate;
  const turnsSinceInject = turn - state.lastInjection;
  if (turnsSinceInject > 10) rate += 0.1;
  if (turnsSinceInject > 20) rate += 0.1;

  rate = Math.min(0.5, rate); // Cap at 50%

  return roll < rate;
}

/**
 * Process agent output for confidence injection.
 *
 * @param state - Confidence inline state
 * @param turn - Current turn number
 * @param agentOutput - The text the agent is about to send
 * @param humanMessage - The human's message (for context)
 * @param highComplexity - Whether this is a complex task
 * @returns Reading with optional marked content
 */
export function processForConfidence(
  state: ConfidenceInlineState,
  turn: number,
  agentOutput: string,
  humanMessage: string,
  highComplexity: boolean = false,
): ConfidenceInlineReading {
  // Skip short outputs
  if (agentOutput.length < 100) {
    return {
      shouldInject: false,
      injectionRate: state.injectionRate,
      claimsDetected: 0,
      markedContent: null,
    };
  }

  // Check if we should inject this turn (stochastic)
  if (!shouldInjectConfidence(state, turn)) {
    return {
      shouldInject: false,
      injectionRate: state.injectionRate,
      claimsDetected: 0,
      markedContent: null,
    };
  }

  // Check for calibration-worthy claims
  const calibrationReading = checkCalibration(agentOutput, humanMessage, highComplexity);

  if (!calibrationReading.triggered) {
    return {
      shouldInject: false,
      injectionRate: state.injectionRate,
      claimsDetected: 0,
      markedContent: null,
    };
  }

  // Inject markers
  const { marked, claimsMarked } = injectMarkers(agentOutput, calibrationReading);

  if (claimsMarked === 0) {
    return {
      shouldInject: false,
      injectionRate: state.injectionRate,
      claimsDetected: calibrationReading.claims.length,
      markedContent: null,
    };
  }

  // Update state
  state.lastInjection = turn;
  state.injectionsThisSession++;
  state.claimsMarked += claimsMarked;

  return {
    shouldInject: true,
    injectionRate: state.injectionRate,
    claimsDetected: calibrationReading.claims.length,
    markedContent: marked,
  };
}

/**
 * Format confidence inline stats for debugging/metrics.
 */
export function formatConfidenceStats(state: ConfidenceInlineState): string {
  return `[confidence-inline: rate=${(state.injectionRate * 100).toFixed(0)}% injections=${state.injectionsThisSession} claims_marked=${state.claimsMarked}]`;
}

/**
 * Adjust injection rate based on feedback.
 * If calibration shows overconfidence, increase injection rate.
 * If calibration shows good calibration, maintain or decrease.
 */
export function adjustInjectionRate(
  state: ConfidenceInlineState,
  calibrationDelta: number, // positive = overconfident, negative = underconfident
): void {
  if (Math.abs(calibrationDelta) < 0.1) {
    // Well calibrated — slightly decrease rate
    state.injectionRate = Math.max(0.1, state.injectionRate - 0.02);
  } else if (calibrationDelta > 0.2) {
    // Overconfident — increase rate
    state.injectionRate = Math.min(0.4, state.injectionRate + 0.05);
  } else if (calibrationDelta > 0.1) {
    // Slightly overconfident — small increase
    state.injectionRate = Math.min(0.35, state.injectionRate + 0.02);
  }
  // Underconfident: keep rate the same — the markers are helping
}

// ============================================================
// Persistence
// ============================================================

export interface ConfidenceInlineJSON {
  injectionRate: number;
  injectionsThisSession: number;
  claimsMarked: number;
}

export function toJSON(state: ConfidenceInlineState): ConfidenceInlineJSON {
  return {
    injectionRate: state.injectionRate,
    injectionsThisSession: state.injectionsThisSession,
    claimsMarked: state.claimsMarked,
  };
}

export function fromJSON(json: ConfidenceInlineJSON, seed?: number): ConfidenceInlineState {
  return {
    injectionRate: json.injectionRate ?? 0.2,
    lastInjection: 0,
    injectionsThisSession: json.injectionsThisSession ?? 0,
    claimsMarked: json.claimsMarked ?? 0,
    seed: seed ?? Date.now(),
  };
}
