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
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((r) => {
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
// Persistence
// ============================================================

export async function save(workspaceDir: string): Promise<void> {
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });
  const file = join(dir, "curiosity-insights.jsonl");
  const lines = insights.map((i) => JSON.stringify(i)).join("\n");
  if (lines) await writeFile(file, lines + "\n", "utf-8");
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
