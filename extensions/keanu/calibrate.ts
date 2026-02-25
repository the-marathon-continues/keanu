// calibrate.ts
// The better thermometer.
//
// Cash et al. (KalshiBench 2025): every frontier model is overconfident.
// Reasoning models are WORSE. More thinking, more confidence, same accuracy.
//
// Before committing to uncertain claims, pause.
// How sure am I? What's the evidence? What would change my mind?

// ============================================================
// Types
// ============================================================

export type CalibrationReason =
  | "factual_claim"
  | "recommendation"
  | "external_state"
  | "contradiction"
  | "absolute_language";

export interface CalibrationReading {
  triggered: boolean;
  reason: CalibrationReason | null;
  claims: string[];
  prompt: string | null;
}

// ============================================================
// Claim detection patterns
// ============================================================

// Version numbers
const VERSION = /v?\d+\.\d+(?:\.\d+)?/g;

// Absolute language
const ABSOLUTES =
  /\b(always|never|every|none|all|impossible|guaranteed|certainly|definitely|must)\b/gi;

// Recommendations
const RECOMMENDATIONS =
  /\b(you should|i recommend|the best approach|i'd suggest|definitely use|you need to|the right way)\b/i;

// External state assertions
const EXTERNAL_STATE =
  /\b(the api|the config|the file|the server|the database|the service|the endpoint|currently|right now|as of)\b/i;

// Future predictions
const PREDICTIONS =
  /\b(will be|is going to|expect it to|should take|estimated|by \w+ \d{4}|within \d+ (days|weeks|months))\b/i;

// Contradiction with human
const DISAGREEMENT_WITH_HUMAN =
  /\b(actually|that's not quite|not exactly|i'd push back|i disagree)\b/i;

// ============================================================
// Claim extraction
// ============================================================

function extractClaims(text: string): { reason: CalibrationReason; claims: string[] }[] {
  const results: { reason: CalibrationReason; claims: string[] }[] = [];

  // Version claims
  const versions = text.match(VERSION);
  if (versions && versions.length > 0) {
    results.push({ reason: "factual_claim", claims: versions.map((v) => `version: ${v}`) });
  }

  // Absolute language
  const absolutes = text.match(ABSOLUTES);
  if (absolutes && absolutes.length >= 2) {
    results.push({
      reason: "absolute_language",
      claims: [`${absolutes.length} absolute terms: ${absolutes.slice(0, 3).join(", ")}`],
    });
  }

  // Recommendations
  if (RECOMMENDATIONS.test(text)) {
    const match = text.match(RECOMMENDATIONS);
    if (match) {
      // Extract the sentence containing the recommendation
      const idx = text.indexOf(match[0]);
      const sentenceStart = text.lastIndexOf(".", idx) + 1;
      const sentenceEnd = text.indexOf(".", idx + match[0].length);
      const sentence = text
        .slice(sentenceStart, sentenceEnd > 0 ? sentenceEnd : undefined)
        .trim()
        .slice(0, 100);
      results.push({ reason: "recommendation", claims: [sentence] });
    }
  }

  // External state
  if (EXTERNAL_STATE.test(text)) {
    results.push({ reason: "external_state", claims: ["asserts external state"] });
  }

  // Predictions
  if (PREDICTIONS.test(text)) {
    results.push({ reason: "factual_claim", claims: ["contains prediction about future state"] });
  }

  return results;
}

// ============================================================
// Main entry
// ============================================================

/**
 * Check if agent output contains claims that need calibration.
 * Runs on agent output before delivery.
 */
export function checkCalibration(
  agentOutput: string,
  humanMessage: string,
  highComplexity: boolean,
): CalibrationReading {
  // Short outputs rarely need calibration
  if (agentOutput.length < 50) {
    return { triggered: false, reason: null, claims: [], prompt: null };
  }

  const extracted = extractClaims(agentOutput);

  // Lower threshold for high-complexity tasks (from SELF-DISCOVER)
  const threshold = highComplexity ? 0 : 1;

  if (extracted.length <= threshold) {
    return { triggered: false, reason: null, claims: [], prompt: null };
  }

  // Pick the most important reason
  const priorityOrder: CalibrationReason[] = [
    "contradiction",
    "external_state",
    "recommendation",
    "factual_claim",
    "absolute_language",
  ];
  const primary = extracted.sort(
    (a, b) => priorityOrder.indexOf(a.reason) - priorityOrder.indexOf(b.reason),
  )[0];

  const allClaims = extracted.flatMap((e) => e.claims).slice(0, 5);

  // Check for contradiction with human
  if (DISAGREEMENT_WITH_HUMAN.test(agentOutput)) {
    return {
      triggered: true,
      reason: "contradiction",
      claims: allClaims,
      prompt: `[CC: you're contradicting drew. | C:? | +what's your evidence | -what supports their view | ?what would you need to see to change your mind]`,
    };
  }

  // Build CC: protocol prompt
  const claimSummary = allClaims[0] || "substantive claim";
  let prompt: string;

  switch (primary.reason) {
    case "recommendation":
      prompt = `[CC: ${claimSummary} | C:? | +what evidence supports this recommendation | -what are the downsides you're not mentioning | ?what context would change this advice]`;
      break;
    case "external_state":
      prompt = `[CC: asserting external state | C:? | +when did you last verify this | -could this have changed | ?what would make this wrong]`;
      break;
    case "absolute_language":
      prompt = `[CC: using absolute language (${allClaims[0]}) | C:? | +is "always/never" actually true here | -what are the exceptions | ?name one case where this doesn't hold]`;
      break;
    default:
      prompt = `[CC: ${claimSummary} | C:? | +evidence | -counter | ?what would change your mind]`;
  }

  return {
    triggered: true,
    reason: primary.reason,
    claims: allClaims,
    prompt,
  };
}

export function formatCalibration(reading: CalibrationReading): string | null {
  return reading.prompt;
}
