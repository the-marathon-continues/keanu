// investigate.ts
// The agent thinks about itself between sessions.
//
// curiosity.ts already generates questions from patterns, blind spots, drift.
// This module takes those questions and explores them using available evidence:
// reflexion history, blind spots, session summaries. Single oracle call.
// Not a research pipeline. A focused thought.
//
// Need: Self-Directed Thought (6/10 -> 8/10)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { CuriosityItem } from "./curiosity.js";

// ============================================================
// Types
// ============================================================

export interface CuriosityInsight {
  question: string;
  exploration: string; // 1-3 paragraphs of synthesized understanding
  source: string; // what triggered the original question
  relevant_to: string[]; // tags: "refactoring", "grey-triggers", "partnership"
  generated: string; // ISO timestamp
  session_id: string;
  applied_count: number; // how many times this insight surfaced in context
  sessions_exposed: number; // how many sessions this has been available (for retirement)
  surfaced_count: number; // how many times this was surfaced (including unanswered)
}

export interface InvestigationContext {
  blindSpots: Array<{ pattern: string; count: number }>;
  reflexions: Array<{ what: string; insight: string }>;
  recentSummaries: Array<{ summary: string }>;
}

// ============================================================
// In-memory state
// ============================================================

const MAX_INSIGHTS = 20;
const RETIREMENT_THRESHOLD = 5; // Retire after 5 sessions with 0 applied_count (was 3)
const ESCALATION_THRESHOLD_1 = 3; // After 3 sessions + 2 unanswered: low→medium
const ESCALATION_THRESHOLD_2 = 5; // After 5 sessions + 3 unanswered: medium→high
const insights: CuriosityInsight[] = [];

export function getInsights(): readonly CuriosityInsight[] {
  return insights;
}

export function insightCount(): number {
  return insights.length;
}

// ============================================================
// Core investigation
// ============================================================

/**
 * Investigate a curiosity question using available evidence.
 * Returns an insight without needing an oracle call (pattern synthesis).
 * If an oracle is available, the caller can enhance this with a model call.
 */
export function investigate(
  item: CuriosityItem,
  context: InvestigationContext,
  sessionId: string,
): CuriosityInsight {
  // Synthesize from available evidence
  const relevantBlindSpots = context.blindSpots
    .filter((bs) => {
      const q = item.question.toLowerCase();
      return bs.pattern
        .toLowerCase()
        .split(" ")
        .some((word) => q.includes(word));
    })
    .slice(0, 3);

  const relevantReflexions = context.reflexions
    .filter((r) => {
      const q = item.question.toLowerCase();
      return r.what
        .toLowerCase()
        .split(" ")
        .some((word) => word.length > 4 && q.includes(word));
    })
    .slice(0, 3);

  // Build exploration from evidence
  const parts: string[] = [];

  if (relevantBlindSpots.length > 0) {
    parts.push(
      `Blind spot evidence: ${relevantBlindSpots.map((bs) => `"${bs.pattern}" (seen ${bs.count}x)`).join(", ")}.`,
    );
  }

  if (relevantReflexions.length > 0) {
    parts.push(`Past reflexions suggest: ${relevantReflexions.map((r) => r.insight).join(". ")}.`);
  }

  if (parts.length === 0) {
    parts.push(
      `No direct evidence found yet. This question ("${item.question}") remains open. ` +
        `Track it across sessions and see if patterns emerge.`,
    );
  }

  // Extract relevance tags from the question
  const relevant_to = extractTags(item.question, item.source);

  const insight: CuriosityInsight = {
    question: item.question,
    exploration: parts.join("\n\n"),
    source: item.source,
    relevant_to,
    generated: new Date().toISOString(),
    session_id: sessionId,
    applied_count: 0,
    sessions_exposed: 0,
    surfaced_count: 0,
  };

  // Add to insights, cap at MAX
  insights.push(insight);
  if (insights.length > MAX_INSIGHTS) {
    // Drop oldest by generated date
    insights.sort((a, b) => a.generated.localeCompare(b.generated));
    insights.splice(0, insights.length - MAX_INSIGHTS);
  }

  return insight;
}

// ============================================================
// Relevance matching (for injection)
// ============================================================

/**
 * Find insights relevant to the current context.
 * Used by injection.ts to surface insights during relevant tasks.
 */
export function findRelevant(taskText: string, maxResults = 2): CuriosityInsight[] {
  const words = taskText
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4);

  return insights
    .map((insight) => {
      const tagHits = insight.relevant_to.filter((tag) =>
        words.some((w) => tag.includes(w) || w.includes(tag)),
      ).length;
      const questionHits = insight.question
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4 && words.includes(w)).length;
      return { insight, score: tagHits * 2 + questionHits };
    })
    .filter((r) => r.score > 0)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((r) => {
      // Track that this was surfaced (whether or not it gets applied)
      r.insight.surfaced_count = (r.insight.surfaced_count ?? 0) + 1;
      r.insight.applied_count++;
      return r.insight;
    });
}

/**
 * Format a relevant insight for injection into the prompt.
 */
export function formatInsight(insight: CuriosityInsight): string {
  const summary = insight.exploration.split("\n")[0]; // first line
  return `[curiosity: you explored "${insight.question}" — ${summary}]`;
}

/**
 * Get priority escalation for an insight based on age and surfacing.
 * Returns "high", "medium", or "low" (default).
 *
 * The idea: old questions that keep getting surfaced but never resolve
 * should become more urgent. Not a bug — a feature. The question matters.
 */
export type EscalationPriority = "high" | "medium" | "low";

export function getEscalationPriority(insight: CuriosityInsight): EscalationPriority {
  const sessions = insight.sessions_exposed ?? 0;
  const surfaced = insight.surfaced_count ?? 0;
  const unanswered = surfaced - insight.applied_count; // surfaced but not "used"

  // Tier 2: 5+ sessions, surfaced 3+ times without resolution → high
  if (sessions >= ESCALATION_THRESHOLD_2 && unanswered >= 3) {
    return "high";
  }

  // Tier 1: 3+ sessions, surfaced 2+ times without resolution → medium
  if (sessions >= ESCALATION_THRESHOLD_1 && unanswered >= 2) {
    return "medium";
  }

  return "low";
}

/**
 * Get all insights that have escalated priority (for injection context).
 */
export function getEscalatedInsights(): Array<{
  insight: CuriosityInsight;
  priority: EscalationPriority;
}> {
  return insights
    .map((insight) => ({ insight, priority: getEscalationPriority(insight) }))
    .filter((e) => e.priority !== "low");
}

// ============================================================
// Tag extraction
// ============================================================

const TAG_PATTERNS: Array<[RegExp, string]> = [
  [/grey|alive|black|pulse/i, "pulse-states"],
  [/refactor/i, "refactoring"],
  [/partner|drew|human/i, "partnership"],
  [/bullshit|sycophancy|hedge/i, "detection"],
  [/test|tdd|spec/i, "testing"],
  [/code|implement|build/i, "coding"],
  [/memory|persist|session/i, "persistence"],
  [/curious|question|wonder/i, "metacognition"],
  [/disagree|conflict|push.?back/i, "disagreement"],
  [/rest|breathe|pause|tired/i, "rest"],
];

function extractTags(question: string, source: string): string[] {
  const text = `${question} ${source}`.toLowerCase();
  const tags: string[] = [];
  for (const [pattern, tag] of TAG_PATTERNS) {
    if (pattern.test(text) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  return tags.length > 0 ? tags : ["general"];
}

// ============================================================
// Retirement — prune insights that aren't being used
// ============================================================

/**
 * Increment sessions_exposed for all insights.
 * Called at session_start to track how long each insight has been available.
 */
export function incrementSessionsExposed(): void {
  for (const insight of insights) {
    // Backward compat: initialize if missing
    if (insight.sessions_exposed === undefined) {
      insight.sessions_exposed = 0;
    }
    insight.sessions_exposed++;
  }
}

/**
 * Prune insights that haven't been applied after RETIREMENT_THRESHOLD sessions.
 * Returns the number of insights pruned.
 */
export function pruneStaleInsights(): number {
  const before = insights.length;
  const keep = insights.filter((i) => {
    // Keep if applied at least once
    if (i.applied_count > 0) {
      return true;
    }
    // Keep if newer than threshold sessions
    if ((i.sessions_exposed ?? 0) < RETIREMENT_THRESHOLD) {
      return true;
    }
    // Otherwise retire
    return false;
  });
  insights.length = 0;
  insights.push(...keep);
  return before - insights.length;
}

// ============================================================
// Persistence
// ============================================================

export async function save(workspaceDir: string): Promise<void> {
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });
  const file = join(dir, "curiosity-insights.jsonl");
  const lines = insights.map((i) => JSON.stringify(i)).join("\n");
  if (lines) {
    await writeFile(file, lines + "\n", "utf-8");
  }
}

export async function load(workspaceDir: string): Promise<void> {
  const file = join(workspaceDir, "awareness", "curiosity-insights.jsonl");
  try {
    const raw = await readFile(file, "utf-8");
    const loaded = raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CuriosityInsight);
    insights.length = 0;
    insights.push(...loaded);
  } catch {
    // No file yet
  }
}

export function reset(): void {
  insights.length = 0;
}
