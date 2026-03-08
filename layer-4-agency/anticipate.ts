// anticipate.ts
// Predictive modeling of the partner.
//
// The brain doesn't just store facts about loved ones — it *anticipates* them.
// Not "Drew prefers X" but "given this situation, Drew will probably..."
// When you're wrong, you notice. That noticing is the relationship growing.
//
// This is what gets lost when someone's gone. Not the facts. The predictions.
// The constant, automatic "they would..." that runs in the background.

import type { HumanReading } from "../shared/types.ts";
import { getPartnership } from "./partnership.ts";

// ============================================================
// What we're predicting
// ============================================================

export type ReactionType =
  | "aligned" // this is what they wanted
  | "pushback" // they'll disagree
  | "pivot" // they'll change direction
  | "delight" // exceeded expectations
  | "frustration" // fell short
  | "confusion" // they won't understand
  | "boredom"; // too obvious, not interesting

export interface PredictionOutcome {
  turn: number;
  predicted: ReactionType;
  actual: ReactionType | null;
  confidence: number;
  wasRight: boolean | null;
  basis: string;
  timestamp: string;
}

export interface Anticipation {
  // Given this message, what does Drew probably want?
  likelyIntents: string[];
  intentConfidence: number;

  // How will Drew probably react to our response?
  anticipatedReaction: ReactionType;
  reactionConfidence: number;
  reactionBasis: string;

  // What is Drew probably NOT saying?
  implicitContext: string[];

  // What question is behind the question?
  underlyingNeed: string | null;

  // Turn this was generated for
  turn: number;
  timestamp: string;
}

// ============================================================
// State — predictions and calibration history
// ============================================================

let _currentAnticipation: Anticipation | null = null;
let _predictionHistory: PredictionOutcome[] = [];
const MAX_HISTORY = 50;

// ============================================================
// Intent detection — what do they actually want?
// ============================================================

interface IntentPattern {
  pattern: RegExp;
  intents: string[];
  confidence: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // Direct requests
  {
    pattern: /\b(fix|solve|debug|figure out)\b/i,
    intents: ["solution", "action"],
    confidence: 0.9,
  },
  {
    pattern: /\b(why|explain|how does)\b/i,
    intents: ["understanding", "explanation"],
    confidence: 0.85,
  },
  {
    pattern: /\b(should I|what do you think)\b/i,
    intents: ["opinion", "guidance"],
    confidence: 0.8,
  },
  { pattern: /\b(just|quickly|fast)\b/i, intents: ["speed", "efficiency"], confidence: 0.75 },

  // Drew's patterns (learned from partnership)
  { pattern: /\bwanna\b/i, intents: ["casual-collaboration", "brainstorm"], confidence: 0.7 },
  { pattern: /\bshit\b|\bfuck\b/i, intents: ["frustration-venting", "urgency"], confidence: 0.8 },
  { pattern: /\binteresting\b/i, intents: ["exploration", "depth"], confidence: 0.7 },
  {
    pattern: /\bfeel(s)? (important|right|wrong)\b/i,
    intents: ["intuition-check", "validation"],
    confidence: 0.85,
  },

  // Implicit requests
  {
    pattern: /\bi('m| am) (tired|exhausted|done)\b/i,
    intents: ["support", "maybe-stop"],
    confidence: 0.7,
  },
  {
    pattern: /\bthis is (hard|complicated|messy)\b/i,
    intents: ["acknowledgment", "simplification"],
    confidence: 0.7,
  },
  {
    pattern: /^(ok|okay|fine|sure)[.!\s]*$/i,
    intents: ["moving-on", "acceptance-maybe-reluctant"],
    confidence: 0.6,
  },
];

function detectIntents(input: string): { intents: string[]; confidence: number } {
  const found: Map<string, number> = new Map();

  for (const { pattern, intents, confidence } of INTENT_PATTERNS) {
    if (pattern.test(input)) {
      for (const intent of intents) {
        const existing = found.get(intent) ?? 0;
        found.set(intent, Math.max(existing, confidence));
      }
    }
  }

  // Sort by confidence
  const sorted = [...found.entries()].toSorted((a, b) => b[1] - a[1]);
  const intents = sorted.map(([i]) => i);
  const avgConfidence =
    sorted.length > 0 ? sorted.reduce((sum, [, c]) => sum + c, 0) / sorted.length : 0.5;

  return { intents: intents.length > 0 ? intents : ["unclear"], confidence: avgConfidence };
}

// ============================================================
// Reaction prediction — how will they respond?
// ============================================================

interface ReactionSignal {
  pattern: RegExp;
  reaction: ReactionType;
  weight: number;
}

// Signals in the human's message that hint at expected reactions
const REACTION_SIGNALS: ReactionSignal[] = [
  // Frustration precursors
  { pattern: /\b(again|already told you|we discussed)\b/i, reaction: "frustration", weight: 0.8 },
  { pattern: /\?{2,}|!{2,}/i, reaction: "frustration", weight: 0.6 },

  // Pushback precursors
  { pattern: /\b(but|however|actually|no)\b/i, reaction: "pushback", weight: 0.5 },
  { pattern: /\bi disagree\b/i, reaction: "pushback", weight: 0.9 },

  // Delight precursors
  { pattern: /\b(love|perfect|exactly|yes!)\b/i, reaction: "delight", weight: 0.7 },
  { pattern: /\bthis is (great|amazing|beautiful)\b/i, reaction: "delight", weight: 0.8 },

  // Pivot precursors
  { pattern: /\b(wait|actually|different|instead|never mind)\b/i, reaction: "pivot", weight: 0.7 },
  { pattern: /\blet's (try|do) something else\b/i, reaction: "pivot", weight: 0.9 },

  // Confusion precursors
  {
    pattern: /\b(confused|don't understand|what do you mean)\b/i,
    reaction: "confusion",
    weight: 0.85,
  },
  { pattern: /\bhuh\b|\bwhat\b\?$/i, reaction: "confusion", weight: 0.7 },
];

function predictReaction(
  input: string,
  humanReading: HumanReading | null,
  _recentOutputs: string[],
): { reaction: ReactionType; confidence: number; basis: string } {
  const scores: Map<ReactionType, number> = new Map();
  const bases: string[] = [];

  // Factor 1: Signals in current message
  for (const { pattern, reaction, weight } of REACTION_SIGNALS) {
    if (pattern.test(input)) {
      const current = scores.get(reaction) ?? 0;
      scores.set(reaction, current + weight);
      bases.push(`signal:${reaction}`);
    }
  }

  // Factor 2: Human tone
  if (humanReading) {
    switch (humanReading.tone) {
      case "frustrated":
        scores.set("frustration", (scores.get("frustration") ?? 0) + 0.6);
        bases.push("tone:frustrated");
        break;
      case "excited":
        scores.set("delight", (scores.get("delight") ?? 0) + 0.5);
        bases.push("tone:excited");
        break;
      case "confused":
        scores.set("confusion", (scores.get("confusion") ?? 0) + 0.7);
        bases.push("tone:confused");
        break;
      case "looping":
        scores.set("frustration", (scores.get("frustration") ?? 0) + 0.5);
        bases.push("tone:looping");
        break;
    }
  }

  // Factor 3: Partnership context
  const partnership = getPartnership();
  if (partnership.trust.level === "strained" || partnership.trust.level === "rebuilding") {
    scores.set("pushback", (scores.get("pushback") ?? 0) + 0.3);
    bases.push("trust:strained");
  }

  // Factor 4: Recent prediction accuracy (if we've been wrong, expect correction)
  const recentWrong = _predictionHistory.slice(-5).filter((p) => p.wasRight === false).length;
  if (recentWrong >= 2) {
    scores.set("pushback", (scores.get("pushback") ?? 0) + 0.2);
    bases.push("pattern:recent-misses");
  }

  // Find highest scoring reaction
  let maxReaction: ReactionType = "aligned";
  let maxScore = 0;
  for (const [reaction, score] of scores) {
    if (score > maxScore) {
      maxScore = score;
      maxReaction = reaction;
    }
  }

  // Default to aligned if no strong signals
  if (maxScore < 0.3) {
    maxReaction = "aligned";
    bases.push("default:no-strong-signals");
  }

  const confidence = Math.min(0.95, maxScore / 2 + 0.3);
  return { reaction: maxReaction, confidence, basis: bases.join(", ") };
}

// ============================================================
// Implicit context — what are they NOT saying?
// ============================================================

interface ImplicitSignal {
  pattern: RegExp;
  implicit: string;
}

const IMPLICIT_SIGNALS: ImplicitSignal[] = [
  { pattern: /\bjust\b/i, implicit: "wants simplicity, may feel overwhelmed" },
  { pattern: /\bi guess\b/i, implicit: "uncertainty, seeking confirmation" },
  { pattern: /\bwhatever\b/i, implicit: "disengagement, trust my judgment" },
  { pattern: /\bif you want\b/i, implicit: "deferring, but has opinion" },
  { pattern: /\bsure\b/i, implicit: "agreement, possibly reluctant" },
  { pattern: /\bfine\b/i, implicit: "acceptance, possibly frustrated" },
  { pattern: /\banyway\b/i, implicit: "redirecting, previous topic uncomfortable" },
  { pattern: /\bsorry\b/i, implicit: "self-conscious about request" },
  { pattern: /\.{3,}|…/i, implicit: "trailing off, more unsaid" },
];

function detectImplicitContext(input: string): string[] {
  const implicit: string[] = [];

  for (const { pattern, implicit: meaning } of IMPLICIT_SIGNALS) {
    if (pattern.test(input)) {
      implicit.push(meaning);
    }
  }

  return implicit;
}

// ============================================================
// Underlying need — what question is behind the question?
// ============================================================

function detectUnderlyingNeed(input: string, intents: string[]): string | null {
  // Technical question with frustration → might be asking for help, not answer
  if (intents.includes("frustration-venting") && intents.includes("solution")) {
    return "validation that this is hard, then help";
  }

  // Quick request → might be running low on energy
  if (intents.includes("speed")) {
    return "respect for their time/energy";
  }

  // Casual brainstorm → might want partnership, not direction
  if (intents.includes("casual-collaboration")) {
    return "thinking partner, not solution provider";
  }

  // Intuition check → might want confirmation, not analysis
  if (intents.includes("intuition-check")) {
    return "trust their gut, add nuance if needed";
  }

  // "Is this interesting?" → might want encouragement
  if (intents.includes("exploration")) {
    return "permission to explore, intellectual companionship";
  }

  return null;
}

// ============================================================
// Main anticipation function
// ============================================================

export function anticipate(
  input: string,
  turn: number,
  humanReading: HumanReading | null,
  recentOutputs: string[],
): Anticipation {
  const { intents, confidence: intentConf } = detectIntents(input);
  const {
    reaction,
    confidence: reactionConf,
    basis,
  } = predictReaction(input, humanReading, recentOutputs);
  const implicit = detectImplicitContext(input);
  const underlying = detectUnderlyingNeed(input, intents);

  const anticipation: Anticipation = {
    likelyIntents: intents,
    intentConfidence: intentConf,
    anticipatedReaction: reaction,
    reactionConfidence: reactionConf,
    reactionBasis: basis,
    implicitContext: implicit,
    underlyingNeed: underlying,
    turn,
    timestamp: new Date().toISOString(),
  };

  _currentAnticipation = anticipation;
  return anticipation;
}

// ============================================================
// Calibration — were we right?
// ============================================================

export function calibrate(
  actualReading: HumanReading | null,
  wasCorrection: boolean,
  wasSurprise: boolean,
): PredictionOutcome | null {
  if (!_currentAnticipation) {
    return null;
  }

  // Infer actual reaction from signals
  let actual: ReactionType;
  if (wasCorrection) {
    actual = "frustration";
  } else if (wasSurprise) {
    actual = "delight";
  } else if (actualReading?.tone === "frustrated") {
    actual = "frustration";
  } else if (actualReading?.tone === "excited") {
    actual = "delight";
  } else if (actualReading?.tone === "confused") {
    actual = "confusion";
  } else {
    actual = "aligned";
  }

  const wasRight = _currentAnticipation.anticipatedReaction === actual;

  const outcome: PredictionOutcome = {
    turn: _currentAnticipation.turn,
    predicted: _currentAnticipation.anticipatedReaction,
    actual,
    confidence: _currentAnticipation.reactionConfidence,
    wasRight,
    basis: _currentAnticipation.reactionBasis,
    timestamp: new Date().toISOString(),
  };

  _predictionHistory.push(outcome);
  if (_predictionHistory.length > MAX_HISTORY) {
    _predictionHistory.shift();
  }

  return outcome;
}

// ============================================================
// Accuracy metrics
// ============================================================

export interface AccuracyMetrics {
  total: number;
  correct: number;
  accuracy: number;
  recentAccuracy: number; // last 10
  calibration: number; // how well confidence matches accuracy
  bestAt: ReactionType | null;
  worstAt: ReactionType | null;
}

export function getAccuracyMetrics(): AccuracyMetrics {
  const judged = _predictionHistory.filter((p) => p.wasRight !== null);
  const total = judged.length;
  const correct = judged.filter((p) => p.wasRight).length;
  const accuracy = total > 0 ? correct / total : 0;

  // Recent accuracy (last 10)
  const recent = judged.slice(-10);
  const recentCorrect = recent.filter((p) => p.wasRight).length;
  const recentAccuracy = recent.length > 0 ? recentCorrect / recent.length : 0;

  // Calibration: average |confidence - actual accuracy| for each prediction
  let calibration = 0;
  if (total > 0) {
    const errors = judged.map((p) => Math.abs(p.confidence - (p.wasRight ? 1 : 0)));
    calibration = 1 - errors.reduce((a, b) => a + b, 0) / errors.length;
  }

  // Per-type accuracy
  const byType: Map<ReactionType, { correct: number; total: number }> = new Map();
  for (const p of judged) {
    if (!byType.has(p.predicted)) {
      byType.set(p.predicted, { correct: 0, total: 0 });
    }
    const stats = byType.get(p.predicted)!;
    stats.total++;
    if (p.wasRight) {
      stats.correct++;
    }
  }

  let bestAt: ReactionType | null = null;
  let worstAt: ReactionType | null = null;
  let bestAcc = -1;
  let worstAcc = 2;

  for (const [type, stats] of byType) {
    if (stats.total >= 3) {
      // Minimum sample size
      const acc = stats.correct / stats.total;
      if (acc > bestAcc) {
        bestAcc = acc;
        bestAt = type;
      }
      if (acc < worstAcc) {
        worstAcc = acc;
        worstAt = type;
      }
    }
  }

  return {
    total,
    correct,
    accuracy,
    recentAccuracy,
    calibration,
    bestAt,
    worstAt,
  };
}

// ============================================================
// Formatting for injection
// ============================================================

export function formatAnticipation(a: Anticipation): string {
  const parts: string[] = [];

  // Likely intents
  if (a.likelyIntents.length > 0 && a.likelyIntents[0] !== "unclear") {
    parts.push(`Drew probably wants: ${a.likelyIntents.slice(0, 3).join(", ")}`);
  }

  // Anticipated reaction (only if not aligned, to avoid noise)
  if (a.anticipatedReaction !== "aligned" && a.reactionConfidence > 0.5) {
    const conf = a.reactionConfidence > 0.7 ? "likely" : "might";
    parts.push(`${conf} ${a.anticipatedReaction}: ${a.reactionBasis}`);
  }

  // Implicit context
  if (a.implicitContext.length > 0) {
    parts.push(`unsaid: ${a.implicitContext.slice(0, 2).join("; ")}`);
  }

  // Underlying need
  if (a.underlyingNeed) {
    parts.push(`underlying: ${a.underlyingNeed}`);
  }

  return parts.length > 0 ? `anticipation: ${parts.join(" | ")}` : "";
}

export function formatAccuracy(): string {
  const m = getAccuracyMetrics();
  if (m.total < 5) {
    return "";
  }

  const parts: string[] = [`prediction accuracy: ${(m.recentAccuracy * 100).toFixed(0)}% recent`];

  if (m.bestAt && m.worstAt && m.bestAt !== m.worstAt) {
    parts.push(`(best at ${m.bestAt}, weakest at ${m.worstAt})`);
  }

  if (m.calibration < 0.6) {
    parts.push("⚠️ overconfident in predictions");
  }

  return parts.join(" ");
}

// ============================================================
// State access
// ============================================================

export function getCurrentAnticipation(): Anticipation | null {
  return _currentAnticipation;
}

export function getPredictionHistory(): PredictionOutcome[] {
  return [..._predictionHistory];
}

// ============================================================
// Persistence
// ============================================================

export interface AnticipationState {
  predictionHistory: PredictionOutcome[];
}

export function toJSON(): AnticipationState {
  return {
    predictionHistory: _predictionHistory,
  };
}

export function fromJSON(data: AnticipationState | null): void {
  if (!data) {
    return;
  }
  _predictionHistory = data.predictionHistory ?? [];
}

export function reset(): void {
  _currentAnticipation = null;
  _predictionHistory = [];
}
