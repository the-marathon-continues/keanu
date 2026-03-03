// =============================================================================
// Contradiction Detector (Browser Extension Adaptation)
// =============================================================================
//
// Adapted from keanu-core/layer-7-update/contradiction-detector.ts
// Classifies disagreements and selects synthesis architecture.

// =============================================================================
// Types
// =============================================================================

export type DisagreementType = "factual" | "definitional" | "value" | "scope";

export type SynthesisType =
  | "boundary_conditions" // SCOPE → "Both right in different contexts"
  | "complementary_integration" // DEFINITIONAL/VALUE → "Both perspectives contribute"
  | "ontological_transcendence"; // FACTUAL → "Need a higher-level framework"

// =============================================================================
// Disagreement Classification
// =============================================================================

/**
 * Classify the type of disagreement between two claims.
 *
 * - FACTUAL: Claims about what IS (default)
 * - DEFINITIONAL: "means", "defined as", "technically"
 * - VALUE: "should", "better", "good", "bad"
 * - SCOPE: "before", "after", "when", "sometimes"
 */
export function classifyDisagreement(claim1: string, claim2: string): DisagreementType {
  const combined = (claim1 + " " + claim2).toLowerCase();

  // SCOPE markers — "both can be true in different contexts"
  const scopeMarkers = [
    "before",
    "after",
    "when",
    "in 2024",
    "in 2023",
    "in 2022",
    "sometimes",
    "usually",
    "often",
    "rarely",
    "in some cases",
    "historically",
    "recently",
    "traditionally",
    "in the future",
    "depending on",
    "under certain",
    "in certain contexts",
  ];
  for (const marker of scopeMarkers) {
    if (combined.includes(marker)) {
      return "scope";
    }
  }

  // DEFINITIONAL markers — "disagreement about what the word means"
  const definitionalMarkers = [
    "means",
    "defined as",
    "is a",
    "technically",
    "literally",
    "by definition",
    "what is",
    "definition of",
    "the term",
    "semantically",
    "conceptually",
  ];
  for (const marker of definitionalMarkers) {
    if (combined.includes(marker)) {
      return "definitional";
    }
  }

  // VALUE markers — "disagreement about what should be"
  const valueMarkers = [
    "should",
    "better",
    "worse",
    "i think",
    "right",
    "wrong",
    "good",
    "bad",
    "prefer",
    "ought",
    "must",
    "ideal",
    "important",
    "matters",
    "valuable",
    "worth",
  ];
  for (const marker of valueMarkers) {
    if (combined.includes(marker)) {
      return "value";
    }
  }

  // Default: factual disagreement
  return "factual";
}

/**
 * Select synthesis architecture based on disagreement type.
 *
 * - SCOPE → boundary_conditions: "Both true in different contexts"
 * - DEFINITIONAL/VALUE → complementary_integration: "Both perspectives contribute"
 * - FACTUAL → ontological_transcendence: "Need higher-level framework"
 */
export function selectSynthesisType(disagreementType: DisagreementType): SynthesisType {
  switch (disagreementType) {
    case "scope":
      return "boundary_conditions";
    case "definitional":
    case "value":
      return "complementary_integration";
    case "factual":
    default:
      return "ontological_transcendence";
  }
}

/**
 * Get a description of the synthesis approach for display.
 */
export function describeSynthesis(synthesisType: SynthesisType): string {
  switch (synthesisType) {
    case "boundary_conditions":
      return "Both claims are true within their respective scopes. The synthesis identifies the boundary conditions where each applies.";
    case "complementary_integration":
      return "Both perspectives contribute valid insights. The synthesis integrates them into a richer understanding.";
    case "ontological_transcendence":
      return "The claims make conflicting factual assertions. The synthesis requires a higher-level framework that can explain both observations.";
  }
}
