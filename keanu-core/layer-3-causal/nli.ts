// nli.ts
// Natural Language Inference — the deep understanding of agreement and conflict.
//
// Not word overlap. Semantic understanding.
// Feed it two claims, get back: entailment (they agree),
// contradiction (they fight), neutral (talking past each other).
//
// DeBERTa via Transformers.js. Runs locally. No API cost.
// Need: Truth (9/10)

// ============================================================
// Types
// ============================================================

export type NLILabel = "entailment" | "contradiction" | "neutral";

export interface NLIResult {
  premise: string;
  hypothesis: string;
  label: NLILabel;
  scores: {
    entailment: number;
    contradiction: number;
    neutral: number;
  };
  confidence: number;
}

export interface CommonGround {
  positions: [string, string];
  agreements: string[];
  conflicts: string[];
  neutralAreas: string[];
  overallRelation: NLILabel;
}

// ============================================================
// Model Loading (lazy)
// ============================================================

// Pipeline and model cached on first use
let classifierPromise: Promise<NLIPipeline> | null = null;

interface NLIPipeline {
  (input: { text: string; text_pair: string }): Promise<Array<{ label: string; score: number }>>;
}

/**
 * Get or initialize the NLI classifier.
 * Uses DeBERTa-v3-base fine-tuned on MNLI.
 */
async function getClassifier(): Promise<NLIPipeline> {
  if (classifierPromise) {
    return classifierPromise;
  }

  classifierPromise = (async () => {
    // Dynamic import for Transformers.js
    // This allows the module to be imported even if transformers isn't installed
    try {
      const { pipeline } = await import("@xenova/transformers");

      // DeBERTa-v3-base fine-tuned on MNLI — strong NLI performance
      const classifier = await pipeline(
        "text-classification",
        "cross-encoder/nli-deberta-v3-base",
        { quantized: true }, // Use quantized model for faster inference
      );

      // Wrap to match our interface
      return async (input: { text: string; text_pair: string }) => {
        const result = await classifier(input.text, input.text_pair, {
          top_k: 3, // Get all three labels with scores
        });
        return result as Array<{ label: string; score: number }>;
      };
    } catch {
      // If transformers.js isn't available, provide a fallback
      console.warn("NLI: Transformers.js not available, using heuristic fallback");
      return heuristicClassifier;
    }
  })();

  return classifierPromise;
}

/**
 * Heuristic fallback when Transformers.js isn't available.
 * Uses word overlap and negation detection.
 */
async function heuristicClassifier(input: {
  text: string;
  text_pair: string;
}): Promise<Array<{ label: string; score: number }>> {
  const premise = input.text.toLowerCase();
  const hypothesis = input.text_pair.toLowerCase();

  // Simple negation detection
  const negationWords = [
    "not",
    "no",
    "never",
    "none",
    "neither",
    "cannot",
    "can't",
    "won't",
    "don't",
    "doesn't",
    "isn't",
    "aren't",
    "wasn't",
    "weren't",
  ];

  const premiseNegated = negationWords.some((w) => premise.includes(w));
  const hypothesisNegated = negationWords.some((w) => hypothesis.includes(w));

  // Word overlap
  const premiseWords = new Set(premise.split(/\s+/).filter((w) => w.length > 3));
  const hypothesisWords = new Set(hypothesis.split(/\s+/).filter((w) => w.length > 3));
  const intersection = [...premiseWords].filter((w) => hypothesisWords.has(w)).length;
  const union = new Set([...premiseWords, ...hypothesisWords]).size;
  const overlap = union > 0 ? intersection / union : 0;

  // Contradiction: high overlap + negation flip
  if (overlap > 0.3 && premiseNegated !== hypothesisNegated) {
    return [
      { label: "CONTRADICTION", score: 0.7 },
      { label: "NEUTRAL", score: 0.2 },
      { label: "ENTAILMENT", score: 0.1 },
    ];
  }

  // Entailment: high overlap, same negation state
  if (overlap > 0.5 && premiseNegated === hypothesisNegated) {
    return [
      { label: "ENTAILMENT", score: 0.6 },
      { label: "NEUTRAL", score: 0.3 },
      { label: "CONTRADICTION", score: 0.1 },
    ];
  }

  // Low overlap = neutral
  return [
    { label: "NEUTRAL", score: 0.6 },
    { label: "ENTAILMENT", score: 0.25 },
    { label: "CONTRADICTION", score: 0.15 },
  ];
}

// ============================================================
// Core API
// ============================================================

/**
 * Classify the relationship between two claims.
 *
 * @param premise - The first claim (the "evidence")
 * @param hypothesis - The second claim (the "conclusion")
 * @returns NLI classification with scores
 */
export async function classify(premise: string, hypothesis: string): Promise<NLIResult> {
  const classifier = await getClassifier();

  const results = await classifier({ text: premise, text_pair: hypothesis });

  // Parse results into our format
  const scores = {
    entailment: 0,
    contradiction: 0,
    neutral: 0,
  };

  for (const result of results) {
    const label = result.label.toLowerCase();
    if (label === "entailment" || label === "label_0") {
      scores.entailment = result.score;
    } else if (label === "contradiction" || label === "label_2") {
      scores.contradiction = result.score;
    } else if (label === "neutral" || label === "label_1") {
      scores.neutral = result.score;
    }
  }

  // Find the dominant label
  let label: NLILabel = "neutral";
  let maxScore = scores.neutral;

  if (scores.entailment > maxScore) {
    label = "entailment";
    maxScore = scores.entailment;
  }
  if (scores.contradiction > maxScore) {
    label = "contradiction";
    maxScore = scores.contradiction;
  }

  return {
    premise,
    hypothesis,
    label,
    scores,
    confidence: maxScore,
  };
}

/**
 * Check if two claims contradict each other.
 * Shorthand for classify() when you only care about contradiction.
 */
export async function contradicts(claim1: string, claim2: string): Promise<boolean> {
  const result = await classify(claim1, claim2);
  return result.label === "contradiction" && result.confidence > 0.6;
}

/**
 * Check if one claim entails another.
 * Shorthand for classify() when checking agreement.
 */
export async function entails(premise: string, hypothesis: string): Promise<boolean> {
  const result = await classify(premise, hypothesis);
  return result.label === "entailment" && result.confidence > 0.6;
}

/**
 * Analyze multiple claim pairs to find common ground and conflicts.
 *
 * @param position1Claims - Claims representing position 1
 * @param position2Claims - Claims representing position 2
 * @returns Analysis of where positions agree, conflict, and talk past each other
 */
export async function findCommonGround(
  position1Claims: string[],
  position2Claims: string[],
): Promise<CommonGround> {
  const agreements: string[] = [];
  const conflicts: string[] = [];
  const neutralAreas: string[] = [];

  let entailmentCount = 0;
  let contradictionCount = 0;
  let neutralCount = 0;

  // Compare each pair
  for (const claim1 of position1Claims) {
    for (const claim2 of position2Claims) {
      const result = await classify(claim1, claim2);

      switch (result.label) {
        case "entailment":
          if (result.confidence > 0.5) {
            agreements.push(`"${claim1}" ≈ "${claim2}"`);
            entailmentCount++;
          }
          break;
        case "contradiction":
          if (result.confidence > 0.5) {
            conflicts.push(`"${claim1}" ⊥ "${claim2}"`);
            contradictionCount++;
          }
          break;
        case "neutral":
          if (result.confidence > 0.5) {
            neutralAreas.push(`"${claim1}" ? "${claim2}"`);
            neutralCount++;
          }
          break;
      }
    }
  }

  // Determine overall relation
  let overallRelation: NLILabel = "neutral";
  const total = entailmentCount + contradictionCount + neutralCount;

  if (total > 0) {
    if (contradictionCount / total > 0.4) {
      overallRelation = "contradiction";
    } else if (entailmentCount / total > 0.4) {
      overallRelation = "entailment";
    }
  }

  return {
    positions: [position1Claims.join("; "), position2Claims.join("; ")],
    agreements: agreements.slice(0, 5), // Limit for readability
    conflicts: conflicts.slice(0, 5),
    neutralAreas: neutralAreas.slice(0, 3),
    overallRelation,
  };
}

// ============================================================
// Formatting
// ============================================================

/**
 * Format a single NLI result for display.
 */
export function formatResult(result: NLIResult): string {
  const symbol = result.label === "entailment" ? "≈" : result.label === "contradiction" ? "⊥" : "?";

  return `[NLI: "${result.premise.slice(0, 30)}..." ${symbol} "${result.hypothesis.slice(0, 30)}..." (${result.label}, ${(result.confidence * 100).toFixed(0)}%)]`;
}

/**
 * Format common ground analysis for injection.
 */
export function formatCommonGround(ground: CommonGround): string | null {
  if (
    ground.agreements.length === 0 &&
    ground.conflicts.length === 0 &&
    ground.neutralAreas.length === 0
  ) {
    return null;
  }

  const parts: string[] = [];

  if (ground.agreements.length > 0) {
    parts.push(`common ground: ${ground.agreements.length} points of agreement`);
  }

  if (ground.conflicts.length > 0) {
    parts.push(`tensions: ${ground.conflicts.length} contradictions`);
  }

  if (ground.overallRelation === "entailment") {
    parts.push("positions largely align");
  } else if (ground.overallRelation === "contradiction") {
    parts.push("positions fundamentally conflict");
  } else {
    parts.push("positions talk past each other");
  }

  return `[synthesis: ${parts.join(" | ")}]`;
}

/**
 * Generate a detailed report of common ground analysis.
 */
export function formatDetailedReport(ground: CommonGround): string {
  const lines: string[] = ["## Common Ground Analysis", ""];

  if (ground.agreements.length > 0) {
    lines.push("### Points of Agreement");
    for (const agreement of ground.agreements) {
      lines.push(`- ${agreement}`);
    }
    lines.push("");
  }

  if (ground.conflicts.length > 0) {
    lines.push("### Points of Conflict");
    for (const conflict of ground.conflicts) {
      lines.push(`- ${conflict}`);
    }
    lines.push("");
  }

  if (ground.neutralAreas.length > 0) {
    lines.push("### Orthogonal Areas (talking past each other)");
    for (const area of ground.neutralAreas) {
      lines.push(`- ${area}`);
    }
    lines.push("");
  }

  lines.push(`**Overall relation:** ${ground.overallRelation}`);

  return lines.join("\n");
}
