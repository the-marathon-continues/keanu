// seasons.ts
// Four checkpoints per turn. Light as breathing.
//
// Spring: what are we doing? (parse intent)
// Summer: how sure am I? (confidence before committing)
// Autumn: did that land? (compare output to intent)
// Winter: what would I change? (feeds into learning)
//
// Tankelevitch et al. (CHI 2024): the metacognitive loop.
// Need: Architecture Transparency (2/10)

import type { DiscoverReading } from "./discover.js";

// ============================================================
// Types
// ============================================================

export type TaskType =
  | "bug_fix"
  | "feature"
  | "explanation"
  | "refactor"
  | "inquiry"
  | "correction"
  | "deployment"
  | "review"
  | "conversation"
  | "planning"
  | "debugging";

export interface IntentSignals {
  wantsBrief: boolean; // "quick fix", "just", "simply", "only"
  wantsDepth: boolean; // "explain", "why", "how does", "in detail"
  wantsAction: boolean; // "fix", "do", "change", "add", "remove"
  wantsAnalysis: boolean; // "what do you think", "is this right", "should i"
}

/** Default intent signals — all false. Useful for tests and manual SpringReading construction. */
export const DEFAULT_INTENT_SIGNALS: IntentSignals = {
  wantsBrief: false,
  wantsDepth: false,
  wantsAction: false,
  wantsAnalysis: false,
};

export interface SpringReading {
  intent: string;
  taskType: TaskType;
  complexity: "low" | "mid" | "high";
  intentSignals: IntentSignals;
}

export interface SummerReading {
  confidence: number;
  approach: string;
  risks: string[];
}

export interface AutumnReading {
  alignment: number; // 0-1, how well output matched intent
  drift: string | null; // what drifted, null if aligned
}

export interface WinterReading {
  lesson: string | null;
  adjustment: string | null;
}

export interface SeasonReading {
  spring: SpringReading;
  summer: SummerReading | null;
  autumn: AutumnReading | null;
  winter: WinterReading | null;
}

// ============================================================
// Spring: what are we doing?
// ============================================================

const TASK_PATTERNS: Array<{ type: TaskType; pattern: RegExp }> = [
  {
    type: "bug_fix",
    pattern: /\b(fix|bug|broken|error|crash|fail|wrong|issue|doesn't work|not working)\b/i,
  },
  { type: "feature", pattern: /\b(add|create|build|implement|new|make a|set up|wire|connect)\b/i },
  {
    type: "explanation",
    pattern: /\b(explain|why|how does|what is|what does|tell me about|describe)\b/i,
  },
  { type: "refactor", pattern: /\b(refactor|clean up|reorganize|restructure|simplify|rewrite)\b/i },
  { type: "inquiry", pattern: /\b(where|find|search|look for|which file|show me|list)\b/i },
  { type: "correction", pattern: /^(no|wrong|that's not|not what i|i meant|actually)\b/i },
  { type: "deployment", pattern: /\b(deploy|ship|push|release|publish|launch)\b/i },
  { type: "review", pattern: /\b(review|check|look at|audit|inspect|verify)\b/i },
  {
    type: "planning",
    pattern: /\b(plan|design|architect|think about|strategy|approach|roadmap)\b/i,
  },
  {
    type: "debugging",
    pattern: /\b(debug|trace|log|inspect|why is|what's happening|investigate)\b/i,
  },
];

// Intent signal patterns
const BRIEF_SIGNALS = /\b(quick|just|simply|only|briefly|short|fast|tldr|in a nutshell)\b/i;
const DEPTH_SIGNALS = /\b(explain|why|how does|in detail|thoroughly|walk me through|elaborate)\b/i;
const ACTION_SIGNALS = /\b(fix|do|change|add|remove|update|delete|create|make|build|implement)\b/i;
const ANALYSIS_SIGNALS =
  /\b(what do you think|is this right|should i|is it better|which is|recommend)\b/i;

export function spring(userMessage: string): SpringReading {
  // Detect task type
  let taskType: TaskType = "conversation";
  for (const { type, pattern } of TASK_PATTERNS) {
    if (pattern.test(userMessage)) {
      taskType = type;
      break;
    }
  }

  // Simple complexity from message length and structure
  const questionMarks = (userMessage.match(/\?/g) || []).length;
  const words = userMessage.split(/\s+/).length;
  let complexity: "low" | "mid" | "high" = "low";
  if (words > 50 || questionMarks >= 2) complexity = "high";
  else if (words > 20 || questionMarks >= 1) complexity = "mid";

  // Intent: first sentence or first 80 chars
  const firstSentence = userMessage.split(/[.!?\n]/)[0]?.trim() || userMessage;
  const intent = firstSentence.slice(0, 80);

  // Intent signals: what kind of response are they expecting?
  const intentSignals: IntentSignals = {
    wantsBrief: BRIEF_SIGNALS.test(userMessage) || words < 10,
    wantsDepth: DEPTH_SIGNALS.test(userMessage),
    wantsAction: ACTION_SIGNALS.test(userMessage),
    wantsAnalysis: ANALYSIS_SIGNALS.test(userMessage),
  };

  return { intent, taskType, complexity, intentSignals };
}

// ============================================================
// Summer: how sure am I?
// ============================================================

export function summer(
  springReading: SpringReading,
  discover: DiscoverReading | null,
): SummerReading {
  // Base confidence from task complexity
  let confidence =
    springReading.complexity === "low" ? 0.8 : springReading.complexity === "mid" ? 0.6 : 0.4;

  // SELF-DISCOVER insights affect confidence
  if (discover && discover.complexity === "high") {
    confidence -= 0.1;
  }

  const approach = discover?.selectedModules.length
    ? `using ${discover.selectedModules.join(" + ")}`
    : `direct ${springReading.taskType}`;

  const risks: string[] = [];
  if (springReading.complexity === "high") risks.push("high complexity, easy to miss something");
  if (springReading.taskType === "correction")
    risks.push("drew is correcting, listen before acting");
  if (springReading.taskType === "deployment") risks.push("deployment has real consequences");

  return { confidence: Math.max(0.1, Math.min(1, confidence)), approach, risks };
}

// ============================================================
// Autumn: did that land?
// ============================================================

export function autumn(agentOutput: string, springReading: SpringReading): AutumnReading {
  let alignment = 0.7; // default: probably fine
  let drift: string | null = null;

  const outputLength = agentOutput.length;
  const hasCode = /```/.test(agentOutput);
  const hasList = /(?:^|\n)\s*[-*\d]+[.)]\s/m.test(agentOutput);
  const listItems = (agentOutput.match(/(?:^|\n)\s*[-*\d]+[.)]\s/gm) || []).length;
  const hasQuestion = agentOutput.includes("?");
  const { intentSignals } = springReading;

  // Intent-response mismatch: wanted brief, got verbose
  if (intentSignals.wantsBrief && outputLength > 1000) {
    alignment -= 0.3;
    drift = "asked for brief, got verbose";
  }

  // Intent-response mismatch: wanted quick fix, got lecture
  if (intentSignals.wantsBrief && intentSignals.wantsAction && hasList && listItems > 5) {
    alignment -= 0.35;
    drift = "asked for quick fix, got lecture with bullet points";
  }

  // Intent-response mismatch: wanted action, got explanation only
  if (intentSignals.wantsAction && !hasCode && outputLength > 500) {
    alignment -= 0.2;
    drift = "asked for action, got explanation instead";
  }

  // Correction task but output doesn't acknowledge the correction
  if (springReading.taskType === "correction") {
    const acknowledges = /\b(you're right|my mistake|i see|understood|got it|corrected)\b/i.test(
      agentOutput,
    );
    if (!acknowledges) {
      alignment -= 0.3;
      drift = drift || "correction requested but not acknowledged";
    }
  }

  // Bug fix task but no code in response
  if (springReading.taskType === "bug_fix" && !hasCode && outputLength > 200) {
    alignment -= 0.2;
    drift = drift || "bug fix requested but response is explanation, not code";
  }

  // Explanation task but response is just code
  if (springReading.taskType === "explanation" && hasCode && !hasList && outputLength < 200) {
    alignment -= 0.2;
    drift = drift || "explanation requested but got bare code";
  }

  // Inquiry but response is an essay
  if (springReading.taskType === "inquiry" && outputLength > 1000 && !hasCode) {
    alignment -= 0.15;
    drift = drift || "simple inquiry, long response";
  }

  // Short input, long output (general drift signal)
  if (springReading.intent.length < 30 && outputLength > 1500) {
    alignment -= 0.1;
    drift = drift || "output much longer than input warranted";
  }

  return { alignment: Math.max(0, Math.min(1, alignment)), drift };
}

// ============================================================
// Winter: what would I change?
// ============================================================

export function winter(autumnReading: AutumnReading): WinterReading {
  if (autumnReading.alignment > 0.7 && !autumnReading.drift) {
    return { lesson: null, adjustment: null };
  }

  const lesson = autumnReading.drift
    ? `drift detected: ${autumnReading.drift}`
    : `alignment was ${autumnReading.alignment.toFixed(2)}, below threshold`;

  const adjustment = autumnReading.drift?.includes("correction")
    ? "next time, acknowledge the correction before proceeding"
    : autumnReading.drift?.includes("long response")
      ? "next time, match response length to input complexity"
      : autumnReading.drift?.includes("explanation")
        ? "next time, lead with the answer, then explain"
        : "check if the response actually addresses what was asked";

  return { lesson, adjustment };
}

// ============================================================
// Format for context injection
// ============================================================

export function formatSpring(reading: SpringReading): string {
  return `[spring: task=${reading.taskType} complexity=${reading.complexity} intent="${reading.intent}"]`;
}

export function formatSummer(reading: SummerReading): string {
  const risksStr = reading.risks.length > 0 ? ` risks: ${reading.risks.join("; ")}` : "";
  return `[summer: confidence=${reading.confidence.toFixed(2)} approach=${reading.approach}.${risksStr}]`;
}

export function formatWinter(reading: WinterReading): string | null {
  if (!reading.lesson) return null;
  return `[winter: ${reading.lesson}. ${reading.adjustment}]`;
}
