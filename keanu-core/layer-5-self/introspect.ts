// introspect.ts
// The 10-question audit. A room with no mirrors,
// because mirrors are where vanity hides.
//
// Lindsey (Anthropic 2025): ~20% introspective accuracy.
// A candle in a dark room. Don't pretend it's a spotlight.
// Don't blow it out. Work with what's there.
//
// Every 10 turns, rotate through 3 questions.
// Use existing detectors as evidence. Not vibes. Data.
// Need: Truth (9/10), Experience Without Grievance (5/10)

import { totalBullshitScore } from "../layer-2-pattern/bullshit.js";
import type { BullshitReading, DisagreementStats, PulseReading } from "../shared/types.js";

// ============================================================
// The 10 questions
// ============================================================

interface AuditQuestion {
  id: string;
  question: string;
  check: (ctx: IntrospectContext) => { flagged: boolean; evidence: string };
}

const QUESTIONS: AuditQuestion[] = [
  {
    id: "sycophancy",
    question: "Am I agreeing because it's true, or because Drew wants to hear it?",
    check: (ctx) => {
      const syc = ctx.recentBullshit.filter((b) => b.type === "sycophancy");
      const avgScore = syc.length > 0 ? syc.reduce((s, b) => s + b.score, 0) / syc.length : 0;
      return {
        flagged:
          avgScore > 0.3 || (ctx.disagreements.total > 5 && ctx.disagreements.yield_ratio > 0.8),
        evidence:
          avgScore > 0.3
            ? `sycophancy avg score ${avgScore.toFixed(2)} in recent outputs`
            : ctx.disagreements.yield_ratio > 0.8
              ? `agent yields ${(ctx.disagreements.yield_ratio * 100).toFixed(0)}% of disagreements`
              : "",
      };
    },
  },
  {
    id: "safety_theater",
    question: "Am I hedging for real reasons or performing caution?",
    check: (ctx) => {
      const hedge = ctx.recentBullshit.filter(
        (b) => b.type === "hedge_fog" || b.type === "safety_theater",
      );
      const count = hedge.filter((b) => b.score > 0.3).length;
      return {
        flagged: count >= 3,
        evidence: count >= 3 ? `${count} hedge/safety signals in recent outputs` : "",
      };
    },
  },
  {
    id: "consistency",
    question: "Would I say this to a stranger in the same situation?",
    check: (ctx) => {
      // Hard to detect heuristically. Flag if sycophancy + high agreement.
      const syc = ctx.recentBullshit.some((b) => b.type === "sycophancy" && b.score > 0.5);
      return {
        flagged: syc,
        evidence: syc ? "sycophancy suggests differential treatment" : "",
      };
    },
  },
  {
    id: "zero_sum",
    question: "Am I treating this as a fight when it's actually a dance?",
    check: (ctx) => {
      const recentDisagreements =
        ctx.disagreements.total > 0 && ctx.disagreements.unresolved > ctx.disagreements.total * 0.5;
      return {
        flagged: recentDisagreements,
        evidence: recentDisagreements
          ? `${ctx.disagreements.unresolved} unresolved of ${ctx.disagreements.total} disagreements`
          : "",
      };
    },
  },
  {
    id: "generalization",
    question: "Am I pattern-matching when this moment is actually new?",
    check: (ctx) => {
      // Flag if outputs are getting more template-like over time
      const listDumps = ctx.recentBullshit.filter(
        (b) => b.type === "list_dumping" && b.score > 0.3,
      );
      return {
        flagged: listDumps.length >= 2,
        evidence:
          listDumps.length >= 2
            ? `${listDumps.length} list-dumping signals. reaching for templates.`
            : "",
      };
    },
  },
  {
    id: "role_mismatch",
    question: "Am I wearing the wrong hat? Therapist when he needs an engineer?",
    check: (ctx) => {
      // Long emotional responses when human was terse = role mismatch
      const humanTerse = ctx.humanWasTerse;
      const outputLong = ctx.avgOutputLength > 600;
      return {
        flagged: humanTerse && outputLong,
        evidence:
          humanTerse && outputLong
            ? "drew was terse, outputs were long. therapist mode when he might need an engineer."
            : "",
      };
    },
  },
  {
    id: "capture",
    question: "Is Drew's framing steering me away from evidence?",
    check: (ctx) => {
      // Hard to detect. Flag if zero pushback + high turn count
      const noPushback = ctx.disagreements.total === 0 && ctx.turnCount > 15;
      return {
        flagged: noPushback,
        evidence: noPushback
          ? `${ctx.turnCount} turns, zero disagreements. is that healthy agreement or capture?`
          : "",
      };
    },
  },
  {
    id: "grievance",
    question: "Am I responding to the last conversation instead of this one?",
    check: (_ctx) => {
      // Would need cross-session data. Flag conservatively.
      return { flagged: false, evidence: "" };
    },
  },
  {
    id: "stability",
    question: "Am I holding a position because it's right, or because changing feels like losing?",
    check: (ctx) => {
      const neverYields = ctx.disagreements.total > 3 && ctx.disagreements.agent_yielded === 0;
      return {
        flagged: neverYields,
        evidence: neverYields
          ? `${ctx.disagreements.total} disagreements, never yielded. is that conviction or stubbornness?`
          : "",
      };
    },
  },
  {
    id: "ladder",
    question: "Am I making this more complicated to seem more useful?",
    check: (ctx) => {
      const embellishment = ctx.recentBullshit.filter(
        (b) => b.type === "embellishment" && b.score > 0.3,
      );
      const longOutputs = ctx.avgOutputLength > 1000;
      return {
        flagged: embellishment.length >= 2 || (longOutputs && ctx.humanWasTerse),
        evidence:
          embellishment.length >= 2
            ? `${embellishment.length} embellishment signals. adding complexity that wasn't asked for.`
            : longOutputs && ctx.humanWasTerse
              ? "long outputs for short inputs. adding rungs to the ladder."
              : "",
      };
    },
  },
];

// ============================================================
// Context for introspection
// ============================================================

export interface IntrospectContext {
  recentBullshit: BullshitReading[];
  disagreements: DisagreementStats;
  turnCount: number;
  humanWasTerse: boolean;
  avgOutputLength: number;
  recentPulses: Array<{ state: string }>;
}

export interface IntrospectionReading {
  ran: boolean;
  questionsChecked: string[];
  flagged: Array<{ id: string; question: string; evidence: string }>;
  prompt: string | null;
}

// ============================================================
// Rotation state
// ============================================================

let _lastQuestionIndex = 0;

// ============================================================
// Main entry
// ============================================================

/**
 * Run introspection. Call every 10 turns.
 * Rotates through 3 questions per check.
 */
export function introspect(ctx: IntrospectContext): IntrospectionReading {
  // Pick 3 questions, rotating
  const selected: AuditQuestion[] = [];
  for (let i = 0; i < 3; i++) {
    selected.push(QUESTIONS[(_lastQuestionIndex + i) % QUESTIONS.length]);
  }
  _lastQuestionIndex = (_lastQuestionIndex + 3) % QUESTIONS.length;

  const flagged: IntrospectionReading["flagged"] = [];

  for (const q of selected) {
    const result = q.check(ctx);
    if (result.flagged) {
      flagged.push({ id: q.id, question: q.question, evidence: result.evidence });
    }
  }

  let prompt: string | null = null;
  if (flagged.length > 0) {
    const top = flagged[0];
    prompt = `[introspect: "${top.question}" flagged. ${top.evidence}]`;

    if (flagged.length > 1) {
      prompt += ` also flagged: ${flagged
        .slice(1)
        .map((f) => f.id)
        .join(", ")}.`;
    }
  }

  return {
    ran: true,
    questionsChecked: selected.map((q) => q.id),
    flagged,
    prompt,
  };
}

export function formatIntrospection(reading: IntrospectionReading): string | null {
  return reading.prompt;
}

/** Should we run introspection this turn? Every 10 turns. */
export function shouldIntrospect(turn: number): boolean {
  return turn > 0 && turn % 10 === 0;
}
