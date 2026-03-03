// feedback.ts
// Phase 4 of the meta plan: wire the living loop to feedback.
//
// Three wires:
// 1. Grok alerts → Silverado (concern claims, validation tracking)
// 2. Gemini memory → Source credibility (weight by track record)
// 3. Session end → Calibration (learn phase feedback)
//
// The loop was already running. Now it learns from itself.

import {
  calculateStats,
  formatCalibrationWarning,
  formatTypeCalibrationDigest,
  getConfidenceAdjustment,
  type CalibrationLogState,
  type ClaimType,
} from "../layer-3-causal/calibration-log.js";
import {
  trackClaimWithSource,
  markVerified,
  markRetracted,
  claimsByReason,
  getAllClaims,
} from "../layer-3-causal/silverado.js";
import type { TrackedClaim, ConfidenceReason } from "../shared/types.js";
import type { GrokAlert, GeminiContext } from "./loop.js";

// ============================================================
// 4.1 Grok Alerts → Silverado
// ============================================================

/**
 * Convert a Grok alert to a concern claim in silverado.
 * The concern is tracked like any claim — it can be verified (human agreed)
 * or contradicted (human dismissed / false alarm).
 *
 * @param alert - the Grok alert to track
 * @param session - current session ID
 * @param turn - current turn number
 * @returns the tracked claim representing this concern
 */
export function trackGrokConcern(alert: GrokAlert, session: string, turn: number): TrackedClaim {
  // Map confidence to 1-5 scale
  const claimConfidence = Math.ceil(alert.confidence * 5);

  // Source is "grok_detector" — we track its accuracy separately
  const claim = trackClaimWithSource(
    `[grok:${alert.type}] ${alert.message}`,
    claimConfidence,
    session,
    turn,
    {
      sourceUrl: "internal://grok_detector",
      sourceContext: `type=${alert.type}, suggestion=${alert.suggestion ?? "none"}`,
      confidenceReason: "pattern" as ConfidenceReason,
    },
  );

  return claim;
}

/**
 * Track multiple Grok alerts from a single beat.
 */
export function trackGrokAlerts(
  alerts: GrokAlert[],
  session: string,
  turn: number,
): TrackedClaim[] {
  return alerts.map((alert) => trackGrokConcern(alert, session, turn));
}

/**
 * Record human validation of a Grok concern.
 * Call this when the human explicitly agrees with a Grok alert.
 */
export function validateGrokConcern(claimId: string): boolean {
  return markVerified(claimId);
}

/**
 * Record human dismissal of a Grok concern.
 * Call this when the human disagrees or the concern was a false alarm.
 */
export function dismissGrokConcern(claimId: string): boolean {
  return markRetracted(claimId);
}

/**
 * Get Grok's accuracy stats.
 * Returns the accuracy rate of Grok's concerns — how often they were validated.
 */
export function getGrokAccuracy(): {
  total: number;
  validated: number;
  dismissed: number;
  pending: number;
  accuracyRate: number;
} {
  const grokClaims = claimsByReason("pattern").filter((c) => c.text.startsWith("[grok:"));

  const validated = grokClaims.filter((c) => c.verified).length;
  const dismissed = grokClaims.filter((c) => c.status === "retracted" || c.contradicted).length;
  const pending = grokClaims.filter(
    (c) => !c.verified && !c.contradicted && c.status === "active",
  ).length;

  const resolved = validated + dismissed;
  const accuracyRate = resolved > 0 ? validated / resolved : 0;

  return {
    total: grokClaims.length,
    validated,
    dismissed,
    pending,
    accuracyRate,
  };
}

/**
 * Format Grok accuracy for injection.
 */
export function formatGrokAccuracy(): string | null {
  const stats = getGrokAccuracy();
  if (stats.total < 5) {
    return null; // Not enough data
  }

  const pct = (stats.accuracyRate * 100).toFixed(0);
  if (stats.accuracyRate < 0.5) {
    return `[grok detector: ${pct}% accuracy — many false alarms. calibrate skepticism.]`;
  }
  if (stats.accuracyRate > 0.8) {
    return `[grok detector: ${pct}% accuracy — trust these alerts.]`;
  }
  return `[grok detector: ${pct}% accuracy (${stats.validated}/${stats.validated + stats.dismissed} validated)]`;
}

// ============================================================
// 4.2 Gemini Memory → Source Credibility
// ============================================================

/**
 * Weight Gemini's memory confidence by source credibility.
 * If the episodes it surfaces come from high-credibility sources, boost confidence.
 * If from low-credibility sources, reduce it.
 *
 * @param context - Gemini's memory context
 * @returns adjusted confidence (0-1)
 */
export function adjustMemoryConfidence(context: GeminiContext): number {
  const baseConfidence = context.confidence;

  // Find claims related to the episodes
  const allClaims = getAllClaims();
  let totalCredibility = 0;
  let claimsWithSources = 0;

  for (const episode of context.relevantEpisodes) {
    // Find claims that overlap with this episode
    const relatedClaims = allClaims.filter((c) => {
      const episodeWords = episode
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4);
      const claimLower = c.text.toLowerCase();
      return episodeWords.some((w) => claimLower.includes(w));
    });

    for (const claim of relatedClaims) {
      if (claim.source?.credibilityScore) {
        totalCredibility += claim.source.credibilityScore;
        claimsWithSources++;
      }
    }
  }

  // If we found sources, adjust confidence by their credibility
  if (claimsWithSources > 0) {
    const avgCredibility = totalCredibility / claimsWithSources;
    // Blend: 70% base confidence, 30% source credibility influence
    return baseConfidence * 0.7 + avgCredibility * 0.3 * baseConfidence;
  }

  return baseConfidence;
}

/**
 * Enhance Gemini context with source quality information.
 * Adds source credibility signals to the context for injection.
 */
export function enrichMemoryWithSourceQuality(context: GeminiContext): {
  context: GeminiContext;
  sourceQuality: "high" | "mixed" | "low" | "unknown";
  warning?: string;
} {
  const allClaims = getAllClaims();
  const sourceScores: number[] = [];

  for (const episode of context.relevantEpisodes) {
    const episodeWords = episode
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);

    for (const claim of allClaims) {
      if (claim.source?.credibilityScore) {
        const claimLower = claim.text.toLowerCase();
        if (episodeWords.some((w) => claimLower.includes(w))) {
          sourceScores.push(claim.source.credibilityScore);
        }
      }
    }
  }

  if (sourceScores.length === 0) {
    return {
      context,
      sourceQuality: "unknown",
    };
  }

  const avgScore = sourceScores.reduce((a, b) => a + b, 0) / sourceScores.length;
  const minScore = Math.min(...sourceScores);
  const maxScore = Math.max(...sourceScores);
  const spread = maxScore - minScore;

  let sourceQuality: "high" | "mixed" | "low" | "unknown";
  let warning: string | undefined;

  if (avgScore >= 0.7 && minScore >= 0.5) {
    sourceQuality = "high";
  } else if (avgScore < 0.4 || minScore < 0.3) {
    sourceQuality = "low";
    warning = "memory sources have low credibility — verify independently";
  } else if (spread > 0.4) {
    sourceQuality = "mixed";
    warning = "memory sources vary in credibility — weigh carefully";
  } else {
    sourceQuality = "mixed";
  }

  // Adjust the context confidence
  const adjustedContext: GeminiContext = {
    ...context,
    confidence: adjustMemoryConfidence(context),
  };

  return {
    context: adjustedContext,
    sourceQuality,
    warning,
  };
}

/**
 * Format source quality for Claude's context injection.
 */
export function formatSourceQualityNote(
  quality: "high" | "mixed" | "low" | "unknown",
  warning?: string,
): string | null {
  if (quality === "unknown") {
    return null;
  }

  if (quality === "high") {
    return "[memory sources: well-sourced]";
  }

  if (warning) {
    return `[memory sources: ${quality} — ${warning}]`;
  }

  return `[memory sources: ${quality}]`;
}

// ============================================================
// 4.3 Session End → Calibration
// ============================================================

export interface SessionCalibrationSummary {
  ece: number;
  avgConfidence: number;
  avgAccuracy: number;
  overconfidenceDelta: number;
  totalPredictions: number;
  verifiedPredictions: number;
  typeDigest: string | null;
  warning: string | null;
  adjustments: Map<ClaimType, number>;
}

/**
 * Pull calibration stats at session end.
 * This is the "learn" phase — understand how accurate we were.
 */
export function getSessionCalibrationSummary(
  calibrationState: CalibrationLogState,
): SessionCalibrationSummary {
  const stats = calculateStats(calibrationState);

  // Get per-type adjustments for next session
  const claimTypes: ClaimType[] = [
    "factual_claim",
    "recommendation",
    "external_state",
    "absolute_language",
    "version_claim",
  ];

  const adjustments = new Map<ClaimType, number>();
  for (const type of claimTypes) {
    adjustments.set(type, getConfidenceAdjustment(calibrationState, type));
  }

  return {
    ece: stats.ece,
    avgConfidence: stats.avgConfidence,
    avgAccuracy: stats.avgAccuracy,
    overconfidenceDelta: stats.overconfidenceDelta,
    totalPredictions: stats.totalPredictions,
    verifiedPredictions: stats.verifiedPredictions,
    typeDigest: formatTypeCalibrationDigest(calibrationState),
    warning: formatCalibrationWarning(stats),
    adjustments,
  };
}

/**
 * Format calibration summary for session learning output.
 */
export function formatCalibrationSummary(summary: SessionCalibrationSummary): string | null {
  const parts: string[] = [];

  if (summary.ece >= 0) {
    parts.push(`ECE=${summary.ece.toFixed(3)}`);
  }

  if (summary.verifiedPredictions >= 5) {
    const accuracy = (summary.avgAccuracy * 100).toFixed(0);
    parts.push(`accuracy=${accuracy}%`);

    if (Math.abs(summary.overconfidenceDelta) > 0.05) {
      const direction = summary.overconfidenceDelta > 0 ? "over" : "under";
      const pct = (Math.abs(summary.overconfidenceDelta) * 100).toFixed(0);
      parts.push(`${direction}confident by ${pct}%`);
    }
  }

  if (parts.length === 0) {
    return null;
  }

  let result = `[calibration: ${parts.join(", ")}]`;

  if (summary.typeDigest) {
    result += `\n${summary.typeDigest}`;
  }

  return result;
}

/**
 * Get confidence adjustment for a claim type.
 * Use this when creating new claims to apply learned calibration.
 */
export function getLearnedConfidenceAdjustment(
  calibrationState: CalibrationLogState,
  claimType: ClaimType,
): number {
  return getConfidenceAdjustment(calibrationState, claimType);
}

// ============================================================
// Combined Feedback Injection
// ============================================================

/**
 * Format all feedback loops for injection into the next turn.
 * Combines Grok accuracy, source quality, and calibration insights.
 */
export function formatFeedbackInjection(
  geminiContext: GeminiContext | undefined,
  calibrationState: CalibrationLogState | undefined,
): string | null {
  const parts: string[] = [];

  // Grok accuracy
  const grokNote = formatGrokAccuracy();
  if (grokNote) {
    parts.push(grokNote);
  }

  // Memory source quality (if we have gemini context)
  if (geminiContext) {
    const { sourceQuality, warning } = enrichMemoryWithSourceQuality(geminiContext);
    const sourceNote = formatSourceQualityNote(sourceQuality, warning);
    if (sourceNote) {
      parts.push(sourceNote);
    }
  }

  // Calibration warning (if we have enough data)
  if (calibrationState) {
    const summary = getSessionCalibrationSummary(calibrationState);
    if (summary.warning) {
      parts.push(summary.warning);
    }
  }

  return parts.length > 0 ? parts.join("\n") : null;
}
