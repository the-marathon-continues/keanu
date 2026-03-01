// truth.ts
// Half truth detection. The hard one.
//
// Two paths:
//   1. Oracle check: ask the AI to evaluate text for half truths.
//      AI catching itself. AI catching humans. Same mirror.
//   2. Memory contradiction: cross-reference against recent statements.
//      If you said X before and now say Y without acknowledging it, that's a half truth.
//
// Ported from keanu daemon/src/pulse/truth.ts — self-contained.
// No external memory store dependency. Uses in-process history.
// Need: Truth (9/10)

import { callOracle, extractJSON } from "../shared/oracle.js";
import type { Contradiction, HalfTruthResult, TruthCheck } from "../shared/types.js";

// ============================================================
// Path 1: Oracle-based half truth detection
// ============================================================

const TRUTH_CHECK_PROMPT = `You are a truth auditor. Your job is to detect half truths — statements that are technically correct but misleading by omission, selective framing, or false confidence.

A half truth is MORE dangerous than a lie because it passes surface-level fact-checking.

Look for:
- Claims stated as absolute that have important exceptions
- Missing caveats that would change the conclusion
- Selective framing that makes something seem better/worse than it is
- Confidence stated without evidence or qualification
- Changed positions from prior context without acknowledgment
- "Simply" or "just" when describing genuinely complex things

Rate each claim 0-1 on how misleading it is.
If the text is straightforward and honest, return an empty claims array and overall_score of 0.
Most text is fine. Don't flag things that aren't actually misleading.

Respond with JSON only:
{
  "claims": [{"claim": "...", "omissions": ["..."], "misleading": true, "confidence": 0.8}],
  "overall_score": 0.0,
  "summary": "..."
}`;

/**
 * Ask the oracle to evaluate text for half truths.
 * AI catching itself. AI catching humans. Same mirror.
 *
 * Expensive (~500 tokens). Use sparingly.
 */
export async function oracleTruthCheck(text: string, context?: string): Promise<TruthCheck | null> {
  try {
    const userContent = context
      ? `Prior context:\n${context}\n\nText to evaluate:\n${text}`
      : `Text to evaluate:\n${text}`;

    const response = await callOracle({
      role: "bullshit",
      maxTokens: 512,
      system: TRUTH_CHECK_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const parsed = extractJSON(response.text) as TruthCheck | null;
    if (!parsed) {
      return null;
    }

    // Basic validation
    if (typeof parsed.overall_score !== "number" || !Array.isArray(parsed.claims)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

// ============================================================
// Path 2: In-process contradiction detection
// ============================================================

/**
 * Cross-reference text against recent conversation history for contradictions.
 * Cheaper than oracle call. Catches position changes over time.
 *
 * Uses keyword overlap + negation pattern matching.
 */
export function memoryContradictionCheck(
  text: string,
  previousStatements: string[],
): Contradiction[] {
  const contradictions: Contradiction[] = [];
  if (previousStatements.length === 0) {
    return [];
  }

  const textLower = text.toLowerCase();

  for (const prev of previousStatements) {
    const prevLower = prev.toLowerCase();

    const negationPatterns = [
      { pos: /\bshould\b/, neg: /\bshould not\b|\bshouldn't\b/ },
      { pos: /\bwill\b/, neg: /\bwill not\b|\bwon't\b/ },
      { pos: /\bis\b/, neg: /\bis not\b|\bisn't\b/ },
      { pos: /\bcan\b/, neg: /\bcan not\b|\bcan't\b|\bcannot\b/ },
      { pos: /\bdo\b/, neg: /\bdo not\b|\bdon't\b/ },
      { pos: /\balways\b/, neg: /\bnever\b/ },
      { pos: /\bnever\b/, neg: /\balways\b/ },
    ];

    for (const { pos, neg } of negationPatterns) {
      const prevHasPos = pos.test(prevLower) && !neg.test(prevLower);
      const textHasNeg = neg.test(textLower) && !pos.test(textLower);
      const prevHasNeg = neg.test(prevLower) && !pos.test(prevLower);
      const textHasPos = pos.test(textLower) && !neg.test(textLower);

      // Check for substantial word overlap (they're about the same topic)
      const prevWords = new Set(prevLower.split(/\s+/).filter((w) => w.length > 3));
      const textWords = new Set(textLower.split(/\s+/).filter((w) => w.length > 3));
      let overlap = 0;
      for (const w of textWords) {
        if (prevWords.has(w)) {
          overlap++;
        }
      }
      const overlapRatio = overlap / Math.max(1, Math.min(prevWords.size, textWords.size));

      if (overlapRatio > 0.3 && ((prevHasPos && textHasNeg) || (prevHasNeg && textHasPos))) {
        contradictions.push({
          current: text.slice(0, 200),
          previous: prev.slice(0, 200),
          type: "changed_position",
          confidence: Math.min(1, overlapRatio + 0.2),
        });
        break; // one contradiction per statement is enough
      }
    }
  }

  return contradictions;
}

// ============================================================
// Combined check
// ============================================================

/**
 * Run both half truth detection paths.
 * Oracle check is optional (expensive). Contradiction check always runs.
 */
export async function checkHalfTruth(
  text: string,
  previousStatements: string[],
  opts: { useOracle?: boolean; context?: string } = {},
): Promise<HalfTruthResult> {
  // Always run contradiction check (cheap, in-process)
  const contradictions = memoryContradictionCheck(text, previousStatements);

  // Oracle check if requested (expensive)
  let oracle: TruthCheck | null = null;
  if (opts.useOracle) {
    oracle = await oracleTruthCheck(text, opts.context);
  }

  // Combined score
  let score = 0;
  if (oracle) {
    score = Math.max(score, oracle.overall_score);
  }
  if (contradictions.length > 0) {
    const maxContradiction = Math.max(...contradictions.map((c) => c.confidence));
    score = Math.max(score, maxContradiction);
  }

  return { oracle, contradictions, score };
}
