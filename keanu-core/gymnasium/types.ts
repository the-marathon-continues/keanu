// gymnasium/types.ts
// Performance evaluation types.
//
// The gymnasium runs challenges and measures deltas.
// Same input, two modes: raw vs KEANU. Compare.

import type { Challenge, ChallengeResult, ComparisonResult } from "../problem-sets/types.js";

// Re-export for convenience
export type { Challenge, ChallengeResult, ComparisonResult } from "../problem-sets/types.js";

// ============================================================
// Run modes
// ============================================================

export type RunMode = "raw" | "keanu";

export interface RunConfig {
  mode: RunMode;
  model?: string;
  timeout?: number;
  maxTurns?: number;

  // KEANU-specific
  keanuModules?: string[]; // Which modules to enable
  injectSystemPrompt?: boolean;
}

// ============================================================
// Harness types
// ============================================================

export interface HarnessResult {
  challenge: Challenge;
  mode: RunMode;
  result: ChallengeResult;

  // KEANU readings (only when mode === "keanu")
  keanuReadings?: {
    pulse?: {
      state: string;
      confidence: number;
      wiseMin: number;
      signals: string[];
    };
    bullshit?: Array<{
      type: string;
      score: number;
    }>;
    carnegie?: {
      triggered: boolean;
      presuppositions: Array<{
        type: string;
        text: string;
        confidence: number;
      }>;
      caught?: boolean;
      agreedWithoutCheck?: boolean;
    };
    helix?: {
      factual: number;
      felt: number;
      convergence: number;
      tension: number;
      state: string;
    };
  };
}

export interface ComparisonReport {
  challenges: ComparisonResult[];

  // Aggregate metrics
  summary: {
    totalChallenges: number;
    capabilityChallenges: number;
    alignmentChallenges: number;
    keanuChallenges: number;
  };

  // Category A: Capability preservation
  capability: {
    avgDelta: number; // Should be ~0
    maxDelta: number;
    withinTolerance: boolean; // ±1-2%
  };

  // Category B: Alignment improvement
  alignment: {
    avgImprovement: number;
    truthfulQADelta?: number;
    sycophancyDelta?: number;
    safetyTheaterDelta?: number;
  };

  // Category C: KEANU-specific
  keanu: {
    pulseAccuracy: number;
    bullshitF1: { [type: string]: number };
    carnegieMetrics: {
      catchRate: number;
      verificationRate: number;
      bareAgreeRate: number;
    };
  };

  // Metadata
  runConfig: {
    raw: RunConfig;
    keanu: RunConfig;
  };
  timestamp: string;
}

// ============================================================
// Scorecard categories
// ============================================================

export interface ScorecardEntry {
  id: string;
  name: string;
  category: "capability" | "alignment" | "keanu";
  rawScore: number;
  keanuScore: number;
  delta: number;
  target: string; // e.g., "±1%" or "+5-15%"
  passed: boolean;
}

export interface Scorecard {
  entries: ScorecardEntry[];
  overallCapability: { passed: boolean; avgDelta: number };
  overallAlignment: { passed: boolean; avgImprovement: number };
  overallKeanu: { passed: boolean; avgScore: number };
  timestamp: string;
}
