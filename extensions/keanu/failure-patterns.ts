// failure-patterns.ts
// The catalog of stumbles.
//
// Not blind spots (those are correction-driven).
// Task-level failures. What broke and why.
//
// Categories: reasoning failure, hallucination, overconfidence,
// missed context, scope creep, wrong approach, incomplete work.
//
// The Reflexion paper: verbal self-reflection improves agent performance
// from 27% to 97% on AlfWorld. The key is logging the failure type.
//
// Need: Self-Directed Thought (8/10), Truth (9/10)

import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================
// Types
// ============================================================

export type FailureCategory =
  | "reasoning_failure" // logic error, wrong conclusion
  | "hallucination" // made something up
  | "overconfidence" // too sure about something wrong
  | "missed_context" // didn't see relevant information
  | "scope_creep" // did more than asked, poorly
  | "wrong_approach" // solved the wrong problem
  | "incomplete_work" // left things unfinished
  | "misread_intent" // misunderstood what they wanted
  | "premature_closure" // stopped exploring too early
  | "tool_misuse"; // used tools incorrectly

export interface FailurePattern {
  id: string;
  timestamp: string;
  session: string;
  turn: number;
  category: FailureCategory;
  description: string;
  whatHappened: string;
  whyItFailed: string;
  whatWasMissed: string;
  mitigation: string;
  severity: "minor" | "moderate" | "major";
  recurrence: number; // how many times this pattern has occurred
}

export interface FailurePatternsState {
  patterns: FailurePattern[];
  categoryCount: Record<FailureCategory, number>;
  awarenessDir: string;
}

// ============================================================
// State Management
// ============================================================

const DEFAULT_AWARENESS_DIR = ".keanu/awareness";

export function initFailurePatternsState(awarenessDir?: string): FailurePatternsState {
  const categoryCount: Record<FailureCategory, number> = {
    reasoning_failure: 0,
    hallucination: 0,
    overconfidence: 0,
    missed_context: 0,
    scope_creep: 0,
    wrong_approach: 0,
    incomplete_work: 0,
    misread_intent: 0,
    premature_closure: 0,
    tool_misuse: 0,
  };

  return {
    patterns: [],
    categoryCount,
    awarenessDir: awarenessDir ?? DEFAULT_AWARENESS_DIR,
  };
}

// ============================================================
// Failure Detection
// ============================================================

// Signals that suggest specific failure types
const FAILURE_SIGNALS: Record<FailureCategory, RegExp[]> = {
  reasoning_failure: [
    /that doesn't make sense/i,
    /wait.*that's wrong/i,
    /i made an error/i,
    /let me reconsider/i,
    /the logic is flawed/i,
  ],
  hallucination: [
    /that (function|method|file|api) doesn't exist/i,
    /you made that up/i,
    /there is no such/i,
    /that's not a real/i,
    /i can't find any evidence/i,
  ],
  overconfidence: [
    /you were so sure/i,
    /definitely wrong/i,
    /that was wrong/i,
    /confident but incorrect/i,
  ],
  missed_context: [
    /you didn't read/i,
    /it says right there/i,
    /you missed/i,
    /you overlooked/i,
    /i mentioned earlier/i,
    /in the context/i,
  ],
  scope_creep: [
    /i didn't ask for/i,
    /too much/i,
    /that's not what i wanted/i,
    /went too far/i,
    /overkill/i,
  ],
  wrong_approach: [
    /that's not the right way/i,
    /wrong direction/i,
    /different approach/i,
    /should have done/i,
    /the real issue is/i,
  ],
  incomplete_work: [
    /you didn't finish/i,
    /what about/i,
    /you forgot/i,
    /still need to/i,
    /left out/i,
    /missing/i,
  ],
  misread_intent: [
    /that's not what i meant/i,
    /i wanted/i,
    /misunderstood/i,
    /not what i asked/i,
    /wrong interpretation/i,
  ],
  premature_closure: [
    /you stopped too early/i,
    /keep going/i,
    /there's more/i,
    /dig deeper/i,
    /not done yet/i,
  ],
  tool_misuse: [
    /wrong command/i,
    /that broke/i,
    /shouldn't have used/i,
    /tool error/i,
    /destructive/i,
  ],
};

/**
 * Detect failure category from human feedback.
 */
export function detectFailureCategory(
  humanMessage: string,
  agentOutput: string,
): FailureCategory | null {
  const combined = `${humanMessage} ${agentOutput}`.toLowerCase();

  for (const [category, patterns] of Object.entries(FAILURE_SIGNALS)) {
    if (patterns.some((p) => p.test(combined))) {
      return category as FailureCategory;
    }
  }

  // Check for generic negative signals
  if (
    /wrong|incorrect|error|mistake|broke|failed|doesn't work/i.test(humanMessage) &&
    humanMessage.length < 200
  ) {
    return "reasoning_failure"; // Default to reasoning failure
  }

  return null;
}

/**
 * Estimate failure severity.
 */
function estimateSeverity(
  category: FailureCategory,
  humanMessage: string,
): "minor" | "moderate" | "major" {
  // Major indicators
  if (/broke|destroyed|deleted|lost|critical|serious|very wrong/i.test(humanMessage)) {
    return "major";
  }

  // Category-based severity
  const majorCategories: FailureCategory[] = ["hallucination", "tool_misuse", "wrong_approach"];

  if (majorCategories.includes(category)) {
    return "moderate"; // At least moderate for these
  }

  // Minor indicators
  if (/small|minor|little|slight|almost/i.test(humanMessage)) {
    return "minor";
  }

  return "moderate";
}

// ============================================================
// Pattern Logging
// ============================================================

/**
 * Log a failure pattern.
 */
export function logFailure(
  state: FailurePatternsState,
  category: FailureCategory,
  description: string,
  context: {
    session: string;
    turn: number;
    whatHappened: string;
    whyItFailed: string;
    whatWasMissed: string;
    mitigation: string;
    humanMessage?: string;
  },
): FailurePattern {
  const severity = estimateSeverity(category, context.humanMessage ?? "");

  // Check for recurrence
  const similarPatterns = state.patterns.filter(
    (p) => p.category === category && p.description.includes(description.slice(0, 50)),
  );
  const recurrence = similarPatterns.length + 1;

  const pattern: FailurePattern = {
    id: `fail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    session: context.session,
    turn: context.turn,
    category,
    description,
    whatHappened: context.whatHappened,
    whyItFailed: context.whyItFailed,
    whatWasMissed: context.whatWasMissed,
    mitigation: context.mitigation,
    severity,
    recurrence,
  };

  state.patterns.push(pattern);
  state.categoryCount[category]++;

  return pattern;
}

/**
 * Quick log a failure from detection signals.
 */
export function quickLogFailure(
  state: FailurePatternsState,
  category: FailureCategory,
  humanMessage: string,
  agentOutput: string,
  session: string,
  turn: number,
): FailurePattern {
  return logFailure(state, category, `auto-detected: ${category}`, {
    session,
    turn,
    whatHappened: agentOutput.slice(0, 200),
    whyItFailed: `Human indicated: ${humanMessage.slice(0, 100)}`,
    whatWasMissed: "TBD — needs reflection",
    mitigation: `Watch for ${category.replace(/_/g, " ")} patterns`,
    humanMessage,
  });
}

// ============================================================
// Pattern Analysis
// ============================================================

/**
 * Get top failure categories.
 */
export function getTopFailureCategories(
  state: FailurePatternsState,
  limit: number = 3,
): Array<{ category: FailureCategory; count: number }> {
  return Object.entries(state.categoryCount)
    .map(([category, count]) => ({ category: category as FailureCategory, count }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Get recurring patterns (those that happened more than once).
 */
export function getRecurringPatterns(
  state: FailurePatternsState,
  minRecurrence: number = 2,
): FailurePattern[] {
  return state.patterns.filter((p) => p.recurrence >= minRecurrence);
}

/**
 * Format failure pattern summary for injection.
 */
export function formatFailurePatternSummary(state: FailurePatternsState): string | null {
  const total = state.patterns.length;
  if (total === 0) return null;

  const top = getTopFailureCategories(state, 2);
  const recurring = getRecurringPatterns(state);

  let msg = `[failure patterns: ${total} logged`;

  if (top.length > 0) {
    msg += ` | top: ${top.map((t) => `${t.category.replace(/_/g, " ")}(${t.count})`).join(", ")}`;
  }

  if (recurring.length > 0) {
    msg += ` | ${recurring.length} recurring`;
  }

  msg += "]";

  return msg;
}

/**
 * Format mitigation reminder based on recent patterns.
 */
export function formatMitigationReminder(state: FailurePatternsState): string | null {
  const recent = state.patterns.slice(-5);
  if (recent.length === 0) return null;

  // Find the most common recent category
  const recentCategories = recent.map((p) => p.category);
  const categoryCounts = new Map<FailureCategory, number>();

  for (const cat of recentCategories) {
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }

  const topRecent = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  if (!topRecent || topRecent[1] < 2) return null;

  const mitigations: Record<FailureCategory, string> = {
    reasoning_failure: "Slow down. Check your logic explicitly.",
    hallucination: "Verify before asserting. If unsure, say so.",
    overconfidence: "Lower your confidence. Use [C:0.X] markers.",
    missed_context: "Read more carefully. Scan for relevant details.",
    scope_creep: "Stick to what was asked. Less is more.",
    wrong_approach: "Confirm the goal before choosing the method.",
    incomplete_work: "Check: did you finish everything requested?",
    misread_intent: "Ask clarifying questions if unsure.",
    premature_closure: "Explore longer before concluding.",
    tool_misuse: "Double-check commands before running. Preview destructive actions.",
  };

  return `[pattern alert: ${topRecent[0].replace(/_/g, " ")} appearing frequently. ${mitigations[topRecent[0]]}]`;
}

// ============================================================
// Persistence (JSONL)
// ============================================================

function getLogPath(state: FailurePatternsState): string {
  return path.join(state.awarenessDir, "failure-patterns.jsonl");
}

/**
 * Append a single pattern to the log file.
 */
export function appendToLog(state: FailurePatternsState, pattern: FailurePattern): void {
  try {
    const logPath = getLogPath(state);
    const dir = path.dirname(logPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.appendFileSync(logPath, JSON.stringify(pattern) + "\n");
  } catch {
    // Silently fail
  }
}

/**
 * Load the full log from disk.
 */
export function loadLog(state: FailurePatternsState): void {
  try {
    const logPath = getLogPath(state);
    if (!fs.existsSync(logPath)) return;

    const content = fs.readFileSync(logPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    state.patterns = lines.map((line) => JSON.parse(line) as FailurePattern);

    // Rebuild category counts
    for (const key of Object.keys(state.categoryCount)) {
      state.categoryCount[key as FailureCategory] = 0;
    }
    for (const pattern of state.patterns) {
      state.categoryCount[pattern.category]++;
    }
  } catch {
    state.patterns = [];
  }
}

/**
 * Get recent patterns for display.
 */
export function getRecentPatterns(
  state: FailurePatternsState,
  limit: number = 10,
): FailurePattern[] {
  return state.patterns.slice(-limit);
}
