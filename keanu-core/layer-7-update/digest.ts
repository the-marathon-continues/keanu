// digest.ts
// Formats learning into something Drew can actually read.
//
// The digest is the mirror held up at session end. It shows:
// - What worked (don't lose these)
// - What broke (known blind spots vs new surprises)
// - What changed (confidence up or down)
// - Partnership health (the relationship, not just the work)
// - What's curious (unanswered questions to carry forward)
//
// Need: Transparency (7/10), Experience Without Grievance (5/10)

import type { PatternLifecycle, PromotionRecord } from "./promote.js";

// ============================================================
// Types
// ============================================================

export interface BrokeItem {
  description: string;
  isBlindSpot: boolean;
  occurrences?: number;
  category?: string;
}

export interface ConfidenceChange {
  pattern: string;
  direction: "up" | "down";
  oldConfidence: number;
  newConfidence: number;
  reason: string;
}

export interface PartnershipHealth {
  trustStatus: "building" | "calibrating" | "stable" | "strained";
  greyRate: number; // 0-100
  aliveMoments: number;
  corrections: number;
  disagreementsResolved: number;
}

export interface DigestInput {
  sessionId: string;
  workedItems: string[];
  brokeItems: BrokeItem[];
  confidenceChanges: ConfidenceChange[];
  partnershipHealth: PartnershipHealth;
  curiosityQuestions: string[];
  promotions: PromotionRecord[];
  demotions: PromotionRecord[];
  coefEmoji: string;
}

export interface Digest {
  markdown: string;
  summary: string; // one-line for logging
  sections: {
    worked: string;
    broke: string;
    confidence: string;
    health: string;
    curiosity: string;
  };
}

// ============================================================
// Formatting
// ============================================================

function formatWorked(items: string[]): string {
  if (items.length === 0) {
    return "- (nothing logged)";
  }
  return items.map((item) => `- ${item}`).join("\n");
}

function formatBroke(items: BrokeItem[]): string {
  if (items.length === 0) {
    return "- (nothing broke)";
  }
  return items
    .map((item) => {
      const blindSpotMarker = item.isBlindSpot
        ? ` (blind spot, ${item.occurrences ?? "?"}x)`
        : " (new)";
      return `- ${item.description}${blindSpotMarker}`;
    })
    .join("\n");
}

function formatConfidenceChanges(changes: ConfidenceChange[]): string {
  if (changes.length === 0) {
    return "- (no changes)";
  }
  return changes
    .map((c) => {
      const arrow = c.direction === "up" ? "↑" : "↓";
      const oldPct = (c.oldConfidence * 100).toFixed(0);
      const newPct = (c.newConfidence * 100).toFixed(0);
      return `- ${arrow} "${c.pattern}" ${oldPct}% → ${newPct}% (${c.reason})`;
    })
    .join("\n");
}

function formatHealth(health: PartnershipHealth): string {
  const lines = [
    `- Trust: ${health.trustStatus}`,
    `- Grey rate: ${health.greyRate.toFixed(0)}%`,
    `- Alive moments: ${health.aliveMoments}`,
  ];

  if (health.corrections > 0 || health.disagreementsResolved > 0) {
    lines.push(
      `- Corrections: ${health.corrections}, Disagreements resolved: ${health.disagreementsResolved}`,
    );
  }

  return lines.join("\n");
}

function formatCuriosity(questions: string[]): string {
  if (questions.length === 0) {
    return "- (no questions queued)";
  }
  return questions
    .slice(0, 3)
    .map((q) => `- ${q}`)
    .join("\n");
}

function formatPromotions(promotions: PromotionRecord[], demotions: PromotionRecord[]): string {
  const lines: string[] = [];

  for (const p of promotions) {
    lines.push(`- ⬆ ${p.from} → ${p.to}: ${p.reason}`);
  }

  for (const d of demotions) {
    lines.push(`- ⬇ ${d.from} → ${d.to}: ${d.reason}`);
  }

  if (lines.length === 0) {
    return "- (no lifecycle changes)";
  }

  return lines.join("\n");
}

// ============================================================
// Main Formatter
// ============================================================

export function formatDigest(input: DigestInput): Digest {
  const worked = formatWorked(input.workedItems);
  const broke = formatBroke(input.brokeItems);
  const confidence = formatConfidenceChanges(input.confidenceChanges);
  const health = formatHealth(input.partnershipHealth);
  const curiosity = formatCuriosity(input.curiosityQuestions);
  const lifecycle = formatPromotions(input.promotions, input.demotions);

  const markdown = `
## Learn Digest — Session ${input.sessionId}

### What Worked
${worked}

### What Broke
${broke}

### Confidence Changes
${confidence}

### Pattern Lifecycle
${lifecycle}

### Partnership Health
${health}

### Curiosity
${curiosity}

${input.coefEmoji}
`.trim();

  // One-line summary for logs
  const brokeCount = input.brokeItems.length;
  const workedCount = input.workedItems.length;
  const changeCount = input.confidenceChanges.length;
  const summary = `Learn: ${workedCount} worked, ${brokeCount} broke, ${changeCount} confidence changes, grey ${input.partnershipHealth.greyRate.toFixed(0)}%`;

  return {
    markdown,
    summary,
    sections: {
      worked,
      broke,
      confidence,
      health,
      curiosity,
    },
  };
}

// ============================================================
// Quick Digest — minimal version for mid-session checks
// ============================================================

export interface QuickDigestInput {
  corrections: number;
  greyRate: number;
  aliveMoments: number;
  recentPatterns: PatternLifecycle[];
}

export function formatQuickDigest(input: QuickDigestInput): string {
  const topPatterns = input.recentPatterns
    .filter((p) => p.stage !== "stale" && p.stage !== "contradicted")
    .slice(0, 3)
    .map((p) => `${p.description} (${p.stage}, ${(p.confidence * 100).toFixed(0)}%)`)
    .join("; ");

  return `Corrections: ${input.corrections} | Grey: ${input.greyRate.toFixed(0)}% | Alive: ${input.aliveMoments} | Patterns: ${topPatterns || "none"}`;
}
