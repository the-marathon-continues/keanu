/**
 * SIEV Metrics: Synthesis Improvement and Evaluation
 *
 * Based on Abbasloo (Microsoft, 2025, arXiv:2510.18134).
 *
 * Two metrics that matter:
 *
 * DELTA (Δ): Did the synthesis improve upon the thesis?
 *   Δ > 0 means dialectical reasoning succeeded.
 *   Δ < 0 means synthesis is worse than just accepting thesis.
 *   Key finding: high thesis accuracy does NOT guarantee good synthesis.
 *
 * OPPOSITION COEFFICIENT (OC): Was the antithesis genuine opposition?
 *   OC near 0 = strawman (antithesis doesn't actually oppose)
 *   OC near 1 = genuine opposition (antithesis substantively challenges)
 *   Models frequently produce weak antitheses that synthesis just ignores.
 *
 * The insight: measuring synthesis quality requires measuring BOTH
 * whether the output improved AND whether the opposition was real.
 */

import { clamp } from "./gradient.ts";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface SIEVInput {
  thesis: string;
  antithesis: string;
  synthesis: string;
  /** Optional: ground truth or reference answer for quality comparison */
  reference?: string;
  /** Optional: topic/query that started the dialectic */
  query?: string;
}

export interface SIEVResult {
  /** Delta: synthesis improvement over thesis. Δ > 0 = success. */
  delta: number;
  /** Opposition Coefficient: how genuinely the antithesis opposed. 0-1. */
  oppositionCoefficient: number;
  /** Combined quality score. */
  quality: number;
  /** Detailed breakdown. */
  breakdown: {
    thesisQuality: number;
    antithesisQuality: number;
    synthesisQuality: number;
    thesisAntithesisSimilarity: number;
    synthesisCoverage: number;
    novelty: number;
  };
  /** Diagnostic messages. */
  diagnostics: string[];
}

// ─────────────────────────────────────────────
// Text similarity (word overlap, Jaccard-style)
// ─────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) {
    return 1;
  }
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) {
      intersection++;
    }
  }
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

/**
 * Measure how much of source appears in target (coverage).
 * Not symmetric: coverage(A, B) ≠ coverage(B, A).
 */
function coverage(source: string, target: string): number {
  const sourceTokens = tokenize(source);
  const targetTokens = tokenize(target);
  if (sourceTokens.size === 0) {
    return 0;
  }

  let covered = 0;
  for (const w of sourceTokens) {
    if (targetTokens.has(w)) {
      covered++;
    }
  }
  return covered / sourceTokens.size;
}

// ─────────────────────────────────────────────
// Quality estimation (heuristic, no embeddings)
// ─────────────────────────────────────────────

/**
 * Estimate text quality based on:
 * - Length (more content = more information, up to a point)
 * - Specificity (numbers, proper nouns, technical terms)
 * - Structure (presence of logical connectors)
 */
function estimateQuality(text: string): number {
  if (!text || text.length < 10) {
    return 0;
  }

  // Length score (diminishing returns after 200 chars)
  const lengthScore = clamp(Math.log10(text.length) / 3);

  // Specificity: numbers and capitalized words (rough proxy)
  const numbers = (text.match(/\d+/g) || []).length;
  const capitals = (text.match(/[A-Z][a-z]+/g) || []).length;
  const specificityScore = clamp((numbers + capitals) / 10);

  // Structure: logical connectors
  const connectors = [
    "therefore",
    "however",
    "because",
    "although",
    "since",
    "while",
    "thus",
    "hence",
    "consequently",
    "moreover",
    "furthermore",
    "nevertheless",
  ];
  const connectorCount = connectors.filter((c) => text.toLowerCase().includes(c)).length;
  const structureScore = clamp(connectorCount / 3);

  return clamp(lengthScore * 0.4 + specificityScore * 0.3 + structureScore * 0.3);
}

// ─────────────────────────────────────────────
// SIEV Metrics
// ─────────────────────────────────────────────

/**
 * Calculate Opposition Coefficient (OC).
 *
 * OC = 1 - similarity(thesis, antithesis)
 *
 * High OC = genuine opposition (they're saying different things)
 * Low OC = strawman (antithesis mostly agrees with thesis)
 */
export function oppositionCoefficient(thesis: string, antithesis: string): number {
  const similarity = jaccardSimilarity(thesis, antithesis);
  return clamp(1 - similarity);
}

/**
 * Calculate Delta (Δ): synthesis improvement over thesis.
 *
 * If reference is provided: Δ = similarity(synthesis, reference) - similarity(thesis, reference)
 * If no reference: Δ = synthesisQuality - thesisQuality + integrationBonus
 *
 * Positive Δ = synthesis is better than just accepting thesis.
 * Negative Δ = synthesis made things worse.
 */
export function delta(
  thesis: string,
  synthesis: string,
  reference?: string,
  antithesis?: string,
): number {
  if (reference) {
    // With ground truth: direct comparison
    const synthesisSimilarity = jaccardSimilarity(synthesis, reference);
    const thesisSimilarity = jaccardSimilarity(thesis, reference);
    return synthesisSimilarity - thesisSimilarity;
  }

  // Without ground truth: heuristic based on quality and integration
  const thesisQuality = estimateQuality(thesis);
  const synthesisQuality = estimateQuality(synthesis);

  // Integration bonus: synthesis should cover both thesis and antithesis
  let integrationBonus = 0;
  if (antithesis) {
    const thesisCoverage = coverage(thesis, synthesis);
    const antithesisCoverage = coverage(antithesis, synthesis);
    // Good synthesis covers both but isn't just concatenation
    const bothCovered = Math.min(thesisCoverage, antithesisCoverage);
    const notConcatenation = 1 - jaccardSimilarity(thesis + " " + antithesis, synthesis);
    integrationBonus = bothCovered * notConcatenation * 0.3;
  }

  return synthesisQuality - thesisQuality + integrationBonus;
}

/**
 * Calculate full SIEV metrics for a dialectical step.
 */
export function evaluate(input: SIEVInput): SIEVResult {
  const { thesis, antithesis, synthesis, reference } = input;
  const diagnostics: string[] = [];

  // Core metrics
  const oc = oppositionCoefficient(thesis, antithesis);
  const d = delta(thesis, synthesis, reference, antithesis);

  // Quality estimates
  const thesisQuality = estimateQuality(thesis);
  const antithesisQuality = estimateQuality(antithesis);
  const synthesisQuality = estimateQuality(synthesis);

  // Additional breakdown
  const thesisAntithesisSimilarity = jaccardSimilarity(thesis, antithesis);
  const thesisCoverage = coverage(thesis, synthesis);
  const antithesisCoverage = coverage(antithesis, synthesis);
  const synthesisCoverage = (thesisCoverage + antithesisCoverage) / 2;

  // Novelty: how much of synthesis is NOT in thesis or antithesis
  const synthesisTokens = tokenize(synthesis);
  const combinedTokens = new Set([...tokenize(thesis), ...tokenize(antithesis)]);
  let novelTokens = 0;
  for (const w of synthesisTokens) {
    if (!combinedTokens.has(w)) {
      novelTokens++;
    }
  }
  const novelty = synthesisTokens.size > 0 ? novelTokens / synthesisTokens.size : 0;

  // Diagnostics
  if (oc < 0.3) {
    diagnostics.push(`weak opposition (OC=${oc.toFixed(2)}): antithesis may be a strawman`);
  }
  if (d < 0) {
    diagnostics.push(`negative delta (Δ=${d.toFixed(2)}): synthesis worse than thesis`);
  }
  if (thesisCoverage < 0.3) {
    diagnostics.push(
      `low thesis coverage (${(thesisCoverage * 100).toFixed(0)}%): synthesis may ignore thesis`,
    );
  }
  if (antithesisCoverage < 0.3) {
    diagnostics.push(
      `low antithesis coverage (${(antithesisCoverage * 100).toFixed(0)}%): synthesis may ignore antithesis`,
    );
  }
  if (novelty < 0.1) {
    diagnostics.push(
      `low novelty (${(novelty * 100).toFixed(0)}%): synthesis may be just concatenation`,
    );
  }
  if (synthesisQuality < thesisQuality && synthesisQuality < antithesisQuality) {
    diagnostics.push(`synthesis quality lower than both inputs: degradation occurred`);
  }

  // Combined quality: geometric mean of components
  // Rewards high delta, high OC, good coverage, and novelty
  const normalizedDelta = clamp((d + 1) / 2); // Map [-1, 1] to [0, 1]
  const quality = clamp(Math.pow(normalizedDelta * oc * synthesisCoverage * (0.5 + novelty), 0.25));

  return {
    delta: d,
    oppositionCoefficient: oc,
    quality,
    breakdown: {
      thesisQuality,
      antithesisQuality,
      synthesisQuality,
      thesisAntithesisSimilarity,
      synthesisCoverage,
      novelty,
    },
    diagnostics,
  };
}

/**
 * Format SIEV result for display.
 */
export function formatSIEV(result: SIEVResult): string {
  const lines: string[] = [
    `Δ=${result.delta.toFixed(3)} (${result.delta > 0 ? "improved" : result.delta < 0 ? "degraded" : "neutral"})`,
    `OC=${result.oppositionCoefficient.toFixed(2)} (${result.oppositionCoefficient > 0.5 ? "genuine opposition" : "weak opposition"})`,
    `quality=${result.quality.toFixed(2)}`,
  ];

  if (result.diagnostics.length > 0) {
    lines.push(`warnings: ${result.diagnostics.join("; ")}`);
  }

  return `[SIEV: ${lines.join(" | ")}]`;
}

/**
 * Quick check: did dialectical reasoning succeed?
 */
export function succeeded(result: SIEVResult): boolean {
  return result.delta > 0 && result.oppositionCoefficient > 0.3;
}
