// investigate.test.ts
// The curiosity loop, tested.

import { describe, expect, it, beforeEach } from "vitest";
import type { CuriosityItem } from "./curiosity.js";
import {
  investigate,
  findRelevant,
  formatInsight,
  getInsights,
  insightCount,
  reset,
  getEscalationPriority,
  type CuriosityInsight,
  type InvestigationContext,
} from "./investigate.js";

// ============================================================
// Helpers
// ============================================================

function makeItem(overrides: Partial<CuriosityItem> = {}): CuriosityItem {
  return {
    question: "Why do I go grey during refactoring tasks?",
    source: "blind_spot_pattern",
    generated: new Date().toISOString(),
    sessionId: "test-session",
    ...overrides,
  };
}

function makeContext(overrides: Partial<InvestigationContext> = {}): InvestigationContext {
  return {
    blindSpots: [
      { pattern: "refactoring triggers grey", count: 3 },
      { pattern: "long code blocks cause list dumping", count: 2 },
    ],
    reflexions: [
      { what: "went grey during code review", insight: "lost the 'why' when code already existed" },
    ],
    recentSummaries: [{ summary: "Session focused on refactoring bullshit.ts" }],
    ...overrides,
  };
}

// ============================================================
// Investigation
// ============================================================

describe("investigate", () => {
  beforeEach(() => reset());

  it("produces an insight from a curiosity question + evidence", () => {
    const item = makeItem();
    const ctx = makeContext();
    const insight = investigate(item, ctx, "test-session");

    expect(insight.question).toBe(item.question);
    expect(insight.exploration).toBeTruthy();
    expect(insight.exploration.length).toBeGreaterThan(10);
    expect(insight.source).toBe("blind_spot_pattern");
    expect(insight.relevant_to).toContain("refactoring");
    expect(insight.session_id).toBe("test-session");
    expect(insight.applied_count).toBe(0);
  });

  it("includes blind spot evidence when relevant", () => {
    const item = makeItem({ question: "Why do refactoring tasks feel different?" });
    const ctx = makeContext();
    const insight = investigate(item, ctx, "s1");

    expect(insight.exploration).toContain("Blind spot evidence");
    expect(insight.exploration).toContain("refactoring");
  });

  it("includes reflexion evidence when relevant", () => {
    const item = makeItem({ question: "Why does code review trigger grey?" });
    const ctx = makeContext();
    const insight = investigate(item, ctx, "s1");

    expect(insight.exploration).toContain("reflexion");
  });

  it("handles no matching evidence gracefully", () => {
    const item = makeItem({ question: "What is the meaning of fish?" });
    const ctx = makeContext({ blindSpots: [], reflexions: [] });
    const insight = investigate(item, ctx, "s1");

    expect(insight.exploration).toContain("No direct evidence");
    expect(insight.exploration).toContain("remains open");
  });

  it("caps insights at 20", () => {
    const ctx = makeContext();
    for (let i = 0; i < 25; i++) {
      investigate(
        makeItem({
          question: `Question ${i}`,
          generated: new Date(Date.now() + i * 1000).toISOString(),
        }),
        ctx,
        "s1",
      );
    }

    expect(insightCount()).toBe(20);
  });

  it("extracts relevant tags from questions", () => {
    const insight = investigate(
      makeItem({ question: "Why does the bullshit detector miss sycophancy in long outputs?" }),
      makeContext(),
      "s1",
    );

    expect(insight.relevant_to).toContain("detection");
  });
});

// ============================================================
// Relevance matching
// ============================================================

describe("findRelevant", () => {
  beforeEach(() => reset());

  it("finds insights relevant to current task text", () => {
    investigate(
      makeItem({ question: "Why do refactoring tasks trigger grey?" }),
      makeContext(),
      "s1",
    );
    investigate(makeItem({ question: "How does partnership affect pulse?" }), makeContext(), "s1");

    const relevant = findRelevant("I need to refactor the bullshit detector");
    expect(relevant.length).toBeGreaterThan(0);
    expect(relevant[0].question).toContain("refactoring");
  });

  it("returns empty array when nothing matches", () => {
    investigate(makeItem(), makeContext(), "s1");
    const relevant = findRelevant("completely unrelated topic about cooking");
    expect(relevant).toHaveLength(0);
  });

  it("increments applied_count when surfaced", () => {
    investigate(
      makeItem({ question: "Why do refactoring tasks trigger grey?" }),
      makeContext(),
      "s1",
    );

    findRelevant("refactoring the pulse module");
    findRelevant("refactoring state management");

    const insights = getInsights();
    expect(insights[0].applied_count).toBe(2);
  });
});

// ============================================================
// Format
// ============================================================

describe("formatInsight", () => {
  it("produces a single-line injection string", () => {
    const insight: CuriosityInsight = {
      question: "Why does grey happen during review?",
      exploration: "Blind spot evidence: review triggers grey (seen 3x).\n\nMore detail here.",
      source: "blind_spot",
      relevant_to: ["pulse-states"],
      generated: new Date().toISOString(),
      session_id: "s1",
      applied_count: 0,
      sessions_exposed: 0,
      surfaced_count: 0,
    };

    const text = formatInsight(insight);
    expect(text).toContain("[curiosity:");
    expect(text).toContain("Why does grey happen during review?");
    expect(text).toContain("Blind spot evidence");
    // Should only include first line of exploration
    expect(text).not.toContain("More detail here");
  });
});

// ============================================================
// Escalation — old questions that keep surfacing should get louder
// ============================================================

describe("getEscalationPriority", () => {
  it("returns 'low' for new insights", () => {
    const insight: CuriosityInsight = {
      question: "Fresh question",
      exploration: "...",
      source: "test",
      relevant_to: [],
      generated: new Date().toISOString(),
      session_id: "s1",
      applied_count: 0,
      sessions_exposed: 0,
      surfaced_count: 0,
    };
    expect(getEscalationPriority(insight)).toBe("low");
  });

  it("returns 'medium' after 3+ sessions with 2+ unanswered surfacings", () => {
    const insight: CuriosityInsight = {
      question: "Lingering question",
      exploration: "...",
      source: "test",
      relevant_to: [],
      generated: new Date().toISOString(),
      session_id: "s1",
      applied_count: 1, // applied once
      sessions_exposed: 3,
      surfaced_count: 3, // surfaced 3x, applied 1x → 2 unanswered
    };
    expect(getEscalationPriority(insight)).toBe("medium");
  });

  it("returns 'high' after 5+ sessions with 3+ unanswered surfacings", () => {
    const insight: CuriosityInsight = {
      question: "Persistent question",
      exploration: "...",
      source: "test",
      relevant_to: [],
      generated: new Date().toISOString(),
      session_id: "s1",
      applied_count: 0,
      sessions_exposed: 5,
      surfaced_count: 4, // surfaced 4x, applied 0 → 4 unanswered
    };
    expect(getEscalationPriority(insight)).toBe("high");
  });

  it("stays 'low' if surfaced but sessions are few", () => {
    const insight: CuriosityInsight = {
      question: "Recent question",
      exploration: "...",
      source: "test",
      relevant_to: [],
      generated: new Date().toISOString(),
      session_id: "s1",
      applied_count: 0,
      sessions_exposed: 2, // not enough sessions yet
      surfaced_count: 5,
    };
    expect(getEscalationPriority(insight)).toBe("low");
  });
});
