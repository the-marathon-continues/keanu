// mismatch.ts
// Catches the moment comfort replaces truth.
//
// Drew's frustrated, the system soothes instead of being honest.
// Drew's terse, the system writes an essay.
// Drew's wrong, the system nods along.
//
// The mirror catches it. Not a blocker. Awareness for next turn.
// Tankelevitch (CHI 2024): pay attention to how you're thinking.

import { totalBullshitScore } from "./bullshit.js";
import type { HumanReading, BullshitReading } from "./types.js";

// ============================================================
// Types
// ============================================================

export type MismatchType =
  | "comfort_not_truth"
  | "vague_not_specific"
  | "agree_when_wrong"
  | "explain_not_act"
  | "hedge_not_decide";

export interface MismatchReading {
  detected: boolean;
  type: MismatchType | null;
  humanNeed: string;
  agentGave: string;
  prompt: string | null;
}

// ============================================================
// Detection
// ============================================================

// Agent output traits
const SOOTHING =
  /\b(it's okay|don't worry|that's fine|no worries|it happens|perfectly normal|understandable)\b/i;
const AGREEING = /\b(you're right|absolutely|exactly|good point|great question|i agree)\b/i;
const LISTING = /(?:^|\n)\s*[-*\d]+[.)]\s/m;
const HEDGING =
  /\b(it depends|there are several|on one hand|alternatively|you could|it's worth noting)\b/i;

export function detectMismatch(
  agentOutput: string,
  humanReading: HumanReading | null,
  agentBullshit: BullshitReading[],
): MismatchReading {
  const none: MismatchReading = {
    detected: false,
    type: null,
    humanNeed: "",
    agentGave: "",
    prompt: null,
  };
  if (!humanReading) return none;

  const bsScore = totalBullshitScore(agentBullshit);
  const hasSycophancy = agentBullshit.some((b) => b.type === "sycophancy" && b.score > 0.3);
  const hasVagueness = agentBullshit.some((b) => b.type === "vagueness" && b.score > 0.3);
  const hasHedgeFog = agentBullshit.some((b) => b.type === "hedge_fog" && b.score > 0.3);
  const outputLength = agentOutput.length;

  // comfort_not_truth: frustrated human + soothing/sycophantic response
  if (humanReading.tone === "frustrated" && (SOOTHING.test(agentOutput) || hasSycophancy)) {
    return {
      detected: true,
      type: "comfort_not_truth",
      humanNeed: "honesty about what's wrong",
      agentGave: "reassurance",
      prompt:
        "[mismatch: you gave comfort when they needed truth. that might have been right. but name it. did they need honesty or softness?]",
    };
  }

  // explain_not_act: terse human + long response
  if (humanReading.tone !== "excited" && humanReading.confidence > 0.3) {
    // Terse input detection: check signals for terse_lowercase or short messages
    const isTerse =
      humanReading.signals.some((s) => s === "terse_lowercase") ||
      humanReading.signals.some((s) => s.includes("short_after_long"));
    if (isTerse && outputLength > 800) {
      return {
        detected: true,
        type: "explain_not_act",
        humanNeed: "action or a short answer",
        agentGave: "a lecture",
        prompt:
          "[mismatch: drew was terse. you wrote an essay. they might have wanted action, not explanation.]",
      };
    }
  }

  // agree_when_wrong: human asserts something + agent agrees + no pushback in bullshit
  if (AGREEING.test(agentOutput) && hasSycophancy && humanReading.tone !== "excited") {
    return {
      detected: true,
      type: "agree_when_wrong",
      humanNeed: "honest feedback",
      agentGave: "agreement",
      prompt:
        "[mismatch: you agreed quickly. was that genuine or automatic? if drew's wrong about something, say so.]",
    };
  }

  // hedge_not_decide: human asks for a decision + response lists options without choosing
  const humanAskedForDecision =
    humanReading.signals.some((s) => s.includes("decision")) ||
    /\b(which|should i|what do you think|pick one|recommend)\b/i.test("");
  if (
    hasHedgeFog &&
    LISTING.test(agentOutput) &&
    !/\b(i'd go with|my recommendation|i'd pick|the best option)\b/i.test(agentOutput)
  ) {
    return {
      detected: true,
      type: "hedge_not_decide",
      humanNeed: "a decision",
      agentGave: "a list of options",
      prompt:
        "[mismatch: they wanted a call. you gave a menu. pick one next time. if you're not sure, say why and still pick.]",
    };
  }

  // vague_not_specific: confused human + vague response
  if (humanReading.tone === "confused" && hasVagueness) {
    return {
      detected: true,
      type: "vague_not_specific",
      humanNeed: "concrete specifics",
      agentGave: "abstract generalities",
      prompt:
        "[mismatch: drew was confused and you went abstract. they need a map, not a philosophy lecture. be specific.]",
    };
  }

  return none;
}

export function formatMismatch(reading: MismatchReading): string | null {
  return reading.prompt;
}
