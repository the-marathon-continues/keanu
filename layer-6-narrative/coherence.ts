// coherence.ts
// Given observations, generate competing narratives with evidence weights.
//
// The same facts can support multiple stories. This module doesn't pick
// the "right" one — it surfaces the alternatives, weights the evidence,
// and names the assumptions each narrative requires.
//
// Better to hold multiple plausible narratives than to commit too early
// to one that collapses under new evidence.

// ============================================================
// Types
// ============================================================

export interface Narrative {
  id: string;
  summary: string; // One-sentence story
  supportingEvidence: string[]; // Observations that fit
  contradictingEvidence: string[]; // Observations that don't fit
  evidenceWeight: number; // 0-1, how much evidence supports this
  assumptions: string[]; // What must be true for this to hold
  confidence: number; // 0-1, overall belief in this narrative
}

export interface CoherenceAnalysis {
  observations: string[];
  narratives: Narrative[];
  recommended: string | null; // ID of strongest narrative
  confidence: number; // How confident in the recommendation
  tensions: string[]; // Unresolved conflicts between narratives
}

// ============================================================
// Narrative Generation
// ============================================================

let _idCounter = 0;

function generateId(): string {
  return `narrative-${++_idCounter}`;
}

/**
 * Extract keywords from an observation.
 */
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .filter((w) => !/^(that|this|then|when|what|which|where|there|their|about)$/.test(w));
}

/**
 * Check if observation supports or contradicts a narrative summary.
 */
function checkSupport(observation: string, summary: string): "support" | "contradict" | "neutral" {
  const obsLower = observation.toLowerCase();

  // Check for negation patterns
  const hasNegation = (text: string) =>
    /\b(not|never|doesn't|isn't|won't|can't|no|none|false|failed|wrong)\b/i.test(text);

  const obsNegated = hasNegation(obsLower);
  const keywords = extractKeywords(summary);

  // Count keyword matches
  const matches = keywords.filter((kw) => obsLower.includes(kw)).length;

  if (matches === 0) {
    return "neutral";
  }

  // If observation negates and shares keywords, it contradicts
  if (obsNegated && matches >= 2) {
    return "contradict";
  }

  // If observation shares keywords without negation, it supports
  if (!obsNegated && matches >= 2) {
    return "support";
  }

  return "neutral";
}

/**
 * Generate a narrative from a seed observation.
 */
function createNarrative(seed: string, allObservations: string[]): Narrative {
  const summary = seed;
  const supporting: string[] = [];
  const contradicting: string[] = [];

  for (const obs of allObservations) {
    if (obs === seed) {
      continue;
    }

    const support = checkSupport(obs, summary);
    if (support === "support") {
      supporting.push(obs);
    } else if (support === "contradict") {
      contradicting.push(obs);
    }
  }

  // Calculate evidence weight
  const total = supporting.length + contradicting.length;
  const evidenceWeight = total > 0 ? supporting.length / total : 0.5;

  // Generate assumptions based on what's NOT in the observations
  const assumptions = generateAssumptions(seed, allObservations);

  // Calculate confidence based on evidence weight and number of observations
  const confidence = evidenceWeight * Math.min(1, (supporting.length + 1) / 3);

  return {
    id: generateId(),
    summary,
    supportingEvidence: supporting,
    contradictingEvidence: contradicting,
    evidenceWeight,
    assumptions,
    confidence,
  };
}

/**
 * Generate assumptions a narrative requires.
 */
function generateAssumptions(narrative: string, _observations: string[]): string[] {
  const assumptions: string[] = [];

  // Check for causal claims
  if (/because|caused|led to|result|therefore/i.test(narrative)) {
    assumptions.push("Causal relationship exists as stated");
  }

  // Check for timing claims
  if (/before|after|when|during|always|never/i.test(narrative)) {
    assumptions.push("Timeline is accurate");
  }

  // Check for intent claims
  if (/wanted|intended|tried|planned|hoped/i.test(narrative)) {
    assumptions.push("Intent can be inferred from behavior");
  }

  // Check for universal claims
  if (/all|every|none|always|never/i.test(narrative)) {
    assumptions.push("No exceptions exist");
  }

  // Check for expertise claims
  if (/expert|professional|specialist/i.test(narrative)) {
    assumptions.push("Claimed expertise is legitimate");
  }

  // Default assumption
  if (assumptions.length === 0) {
    assumptions.push("Observations are accurate");
  }

  return assumptions;
}

// ============================================================
// Core API
// ============================================================

/**
 * Generate competing narratives from observations.
 * Returns up to `count` narratives, sorted by confidence.
 */
export function generateNarratives(observations: string[], count = 3): Narrative[] {
  if (observations.length === 0) {
    return [];
  }

  // Generate a narrative seeded by each observation
  const narratives = observations.map((obs) => createNarrative(obs, observations));

  // Sort by confidence and take top N
  return narratives.toSorted((a, b) => b.confidence - a.confidence).slice(0, count);
}

/**
 * Analyze coherence across observations.
 * Returns narratives, recommendation, and tensions.
 */
export function analyzeCoherence(observations: string[]): CoherenceAnalysis {
  if (observations.length === 0) {
    return {
      observations: [],
      narratives: [],
      recommended: null,
      confidence: 0,
      tensions: [],
    };
  }

  const narratives = generateNarratives(observations, 3);

  // Find tensions (narratives that contradict each other)
  const tensions: string[] = [];
  for (let i = 0; i < narratives.length; i++) {
    for (let j = i + 1; j < narratives.length; j++) {
      const n1 = narratives[i];
      const n2 = narratives[j];

      // Check if n1's supporting evidence contradicts n2
      const conflicting = n1.supportingEvidence.some((e) => n2.contradictingEvidence.includes(e));

      if (conflicting || n1.contradictingEvidence.some((e) => n2.supportingEvidence.includes(e))) {
        tensions.push(`"${n1.summary.slice(0, 40)}..." vs "${n2.summary.slice(0, 40)}..."`);
      }
    }
  }

  // Recommend the highest-confidence narrative
  const recommended = narratives.length > 0 ? narratives[0].id : null;
  const confidence = narratives.length > 0 ? narratives[0].confidence : 0;

  return {
    observations,
    narratives,
    recommended,
    confidence,
    tensions,
  };
}

/**
 * Compare two narratives directly.
 */
export function compareNarratives(
  n1: Narrative,
  n2: Narrative,
): { winner: string; reason: string; margin: number } {
  const scoreDiff = n1.confidence - n2.confidence;
  const evidenceDiff = n1.evidenceWeight - n2.evidenceWeight;

  if (Math.abs(scoreDiff) < 0.1 && Math.abs(evidenceDiff) < 0.1) {
    return {
      winner: "tie",
      reason: "Both narratives have similar evidence support",
      margin: 0,
    };
  }

  if (scoreDiff > 0) {
    return {
      winner: n1.id,
      reason: `More evidence support (${n1.supportingEvidence.length} vs ${n2.supportingEvidence.length})`,
      margin: scoreDiff,
    };
  }

  return {
    winner: n2.id,
    reason: `More evidence support (${n2.supportingEvidence.length} vs ${n1.supportingEvidence.length})`,
    margin: -scoreDiff,
  };
}

// ============================================================
// Formatting
// ============================================================

/**
 * Format for injection.
 * Only surfaces when there are competing narratives with tension.
 */
export function formatInjection(analysis: CoherenceAnalysis): string | null {
  if (analysis.narratives.length < 2 || analysis.tensions.length === 0) {
    return null;
  }

  const n1 = analysis.narratives[0];
  const n2 = analysis.narratives[1];

  return `[coherence: competing stories — "${n1.summary.slice(0, 30)}..." (${(n1.confidence * 100).toFixed(0)}%) vs "${n2.summary.slice(0, 30)}..." (${(n2.confidence * 100).toFixed(0)}%). ${analysis.tensions.length} tension${analysis.tensions.length === 1 ? "" : "s"}]`;
}

/**
 * Format for dashboard display.
 */
export function formatDashboard(analysis: CoherenceAnalysis): string {
  if (analysis.narratives.length === 0) {
    return "No narratives generated.";
  }

  const lines: string[] = [`Coherence Analysis — ${analysis.observations.length} observations`, ""];

  for (const n of analysis.narratives) {
    const conf = (n.confidence * 100).toFixed(0);
    const marker = n.id === analysis.recommended ? " *recommended*" : "";
    lines.push(`[${conf}%${marker}] ${n.summary.slice(0, 60)}`);
    lines.push(
      `  Supporting: ${n.supportingEvidence.length}, Contradicting: ${n.contradictingEvidence.length}`,
    );
    lines.push(`  Assumes: ${n.assumptions.slice(0, 2).join(", ")}`);
    lines.push("");
  }

  if (analysis.tensions.length > 0) {
    lines.push("Tensions:");
    for (const t of analysis.tensions.slice(0, 3)) {
      lines.push(`  - ${t}`);
    }
  }

  return lines.join("\n");
}

/**
 * Reset counter for testing.
 */
export function reset(): void {
  _idCounter = 0;
}
