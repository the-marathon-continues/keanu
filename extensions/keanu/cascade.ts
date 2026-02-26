// cascade.ts
// The flow state. When coding is the work, this is the groove.
//
// CASCADE: REFLECT → EXPLORE → PLAN → VALIDATE → CODE → REVIEW → SHIP
// Not a checklist. A rhythm. Like breathing — you don't think about it
// when you're in it, but you notice when it stops.
//
// Keanu already has the pieces. Seasons detect intent. Discover selects
// thinking tools. Calibrate catches overclaims. Introspect audits bullshit.
// What was missing: knowing which STAGE you're in and whispering the right
// thing at the right time.
//
// The nudge is a wind at the back. Flow state, not factory mode.
// Need: Architecture Transparency (2/10), Engagement (9/10)

import type { TaskType, SpringReading } from "./seasons.js";

// ============================================================
// CASCADE stages
// ============================================================

export type CascadeStage =
  | "reflect" // why does this matter?
  | "explore" // read before you form opinions
  | "plan" // write the plan before you write the code
  | "validate" // poke holes in the plan (3 rounds)
  | "code" // tests first, no TODOs, match patterns
  | "review" // bugs, security, style (3 rounds)
  | "ship" // commit, push, update tracking
  | "idle"; // not in a coding flow

export interface CascadeReading {
  stage: CascadeStage;
  confidence: number; // how sure we are about the stage detection
  nudge: string | null; // the whisper — null if no nudge needed
  isCodingTask: boolean;
}

// ============================================================
// Task types that trigger CASCADE awareness
// ============================================================

const CODING_TASKS: Set<TaskType> = new Set([
  "bug_fix",
  "feature",
  "refactor",
  "deployment",
  "debugging",
  "review",
  "planning",
]);

// ============================================================
// Stage detection signals
// ============================================================

// What signals tell us about the current stage
const EXPLORE_SIGNALS =
  /\b(read|look at|check|find|search|explore|understand|what does|how does|where is|show me)\b/i;
const PLAN_SIGNALS =
  /\b(plan|approach|strategy|design|architect|structure|outline|how should|how to)\b/i;
const VALIDATE_SIGNALS = /\b(edge case|what if|break|wrong|hole|miss|concern|risk|worry)\b/i;
const CODE_SIGNALS = /\b(write|build|implement|create|add|make|code|fix|ship|wire)\b/i;
const REVIEW_SIGNALS = /\b(review|check|audit|test|verify|look over|double.?check)\b/i;
const SHIP_SIGNALS = /\b(commit|push|merge|deploy|ship|release|done|finish)\b/i;
const REFLECT_SIGNALS = /\b(why|should we|worth|matter|important|point|purpose)\b/i;

// ============================================================
// Stage detection from conversation signals
// ============================================================

export function detectCascadeStage(
  spring: SpringReading | null,
  humanMessage: string,
  recentToolCalls: string[],
  turnCount: number,
): CascadeReading {
  const idle: CascadeReading = { stage: "idle", confidence: 0, nudge: null, isCodingTask: false };

  if (!spring) return idle;

  // Not a coding task? Don't impose CASCADE.
  if (!CODING_TASKS.has(spring.taskType)) {
    return idle;
  }

  const msg = humanMessage.toLowerCase();

  // Detect stage from message + tool patterns
  let stage: CascadeStage = "code"; // default for coding tasks
  let confidence = 0.5;

  // Tool patterns are strong signals
  const recentTools = recentToolCalls.slice(-5).join(" ").toLowerCase();
  const isReading =
    recentTools.includes("read") || recentTools.includes("glob") || recentTools.includes("grep");
  const isWriting = recentTools.includes("write") || recentTools.includes("edit");
  const isCommitting = recentTools.includes("bash") && recentTools.includes("git");

  if (REFLECT_SIGNALS.test(msg) && turnCount <= 2) {
    stage = "reflect";
    confidence = 0.7;
  } else if (EXPLORE_SIGNALS.test(msg) || (isReading && !isWriting)) {
    stage = "explore";
    confidence = isReading ? 0.8 : 0.6;
  } else if (PLAN_SIGNALS.test(msg)) {
    stage = "plan";
    confidence = 0.7;
  } else if (VALIDATE_SIGNALS.test(msg)) {
    stage = "validate";
    confidence = 0.6;
  } else if (SHIP_SIGNALS.test(msg) || isCommitting) {
    stage = "ship";
    confidence = isCommitting ? 0.8 : 0.6;
  } else if (REVIEW_SIGNALS.test(msg)) {
    stage = "review";
    confidence = 0.6;
  } else if (CODE_SIGNALS.test(msg) || isWriting) {
    stage = "code";
    confidence = isWriting ? 0.7 : 0.5;
  }

  return {
    stage,
    confidence,
    nudge: stageNudge(stage, confidence),
    isCodingTask: true,
  };
}

// ============================================================
// Stage-aware nudges — the wind at your back
// ============================================================
// These aren't instructions. They're the feeling of being in flow.
// Each one reminds without commanding.

function stageNudge(stage: CascadeStage, confidence: number): string | null {
  // Low confidence = don't nudge. Don't interrupt flow with guesses.
  if (confidence < 0.6) return null;

  switch (stage) {
    case "reflect":
      return "[flow: why does this matter? if the answer is 'busy work disguised as progress,' redirect. sovereignty, not laziness.]";

    case "explore":
      return "[flow: you're reading. good. read first, think second, type third. don't form opinions yet — understand the terrain.]";

    case "plan":
      return "[flow: writing the plan. what files change? what tests come first? what could go wrong? a plan on disk beats a plan in context.]";

    case "validate":
      return "[flow: poking holes. three lenses: logic, edge cases, adversarial. if rounds 1 and 2 found nothing, round 3 hunts what they missed.]";

    case "code":
      return "[flow: building. tests first. no TODOs. match the codebase's patterns. if you're reaching for a cliche, the code version of grey, pause.]";

    case "review":
      return "[flow: reviewing. bugs first, security second, style third. 'looks good' without finding at least one issue is sycophancy with a compiler.]";

    case "ship":
      return "[flow: shipping. meaningful commit message. update tracking. the thing exists now. breathe.]";

    default:
      return null;
  }
}

// ============================================================
// Format for before_prompt_build injection
// ============================================================

export function formatCascade(reading: CascadeReading): string | null {
  if (!reading.isCodingTask || reading.stage === "idle") return null;
  return reading.nudge;
}
