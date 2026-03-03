// =============================================================================
// Baby Saver: Find what's genuinely original in a source
// =============================================================================
//
// You're not steelmanning. You're not summarizing. You're rescuing.
//
// This source has something nobody else said. Maybe it's a specific number.
// Maybe it's a case study that didn't make it into the consensus view.
// Maybe it's a framing that clicks in a way the standard argument doesn't.
//
// Find the babies. The genuinely original observations. The things that would
// be lost if this source disappeared and we only had "what everyone agrees on."

import Anthropic from "@anthropic-ai/sdk";
import type { Baby, Source } from "../shared/types.js";

// =============================================================================
// The Prompt
// =============================================================================

const BABY_SAVING_PROMPT = `You're not steelmanning. You're not summarizing. You're rescuing.

This source has something nobody else said. Maybe it's a specific number. Maybe it's a case study that didn't make it into the consensus view. Maybe it's a framing that clicks in a way the standard argument doesn't.

Find the babies. The genuinely original observations. The things that would be lost if this source disappeared and we only had "what everyone agrees on."

A baby is grounded — data, experience, specific mechanism. Not abstract. Not "this position argues that..." but "this source specifically observed that..."

For each baby:
- What's the observation?
- Is this actually original, or just a good version of a common argument?
- What grounds it? (data / theory / experience / definition)
- How distinctive? (0-1, where 1 = "I've never seen this anywhere else")
- Why did you save this one?

Return JSON. Be stingy. Better to save 2 real babies than 10 dressed-up arguments.

Format:
{
  "babies": [
    {
      "observation": "the specific insight",
      "isOriginal": true,
      "evidenceBasis": "empirical" | "theoretical" | "experiential" | "definitional",
      "distinctiveness": 0.0 to 1.0,
      "reasoning": "why this one was worth saving"
    }
  ]
}`;

// =============================================================================
// Baby Extraction
// =============================================================================

interface RawBaby {
  observation: string;
  isOriginal: boolean;
  evidenceBasis: "empirical" | "theoretical" | "experiential" | "definitional";
  distinctiveness: number;
  reasoning: string;
}

interface BabySaverResponse {
  babies: RawBaby[];
}

/**
 * Extract babies from a source.
 *
 * @param source - The source to extract from
 * @param side - Whether this is thesis or antithesis
 * @param apiKey - Anthropic API key
 * @returns Array of saved babies
 */
export async function saveBabies(
  source: Source,
  side: "thesis" | "antithesis",
  apiKey: string,
): Promise<Baby[]> {
  const client = new Anthropic({ apiKey });

  // Truncate content if too long (Claude has context limits)
  const maxContentLength = 50000;
  const content =
    source.content.length > maxContentLength
      ? source.content.slice(0, maxContentLength) + "\n\n[Content truncated...]"
      : source.content;

  const userMessage = `Source URL: ${source.url}
Source Title: ${source.title}

Content:
${content}

Find the babies in this source. What does it observe that nobody else does?`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: BABY_SAVING_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // Extract text from response
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Parse JSON from response
    const parsed = parseJSON<BabySaverResponse>(text);

    if (!parsed?.babies) {
      console.warn("[baby-saver] No babies found in response");
      return [];
    }

    // Convert to Baby type with IDs and metadata
    return parsed.babies.map(
      (raw): Baby => ({
        id: crypto.randomUUID(),
        observation: raw.observation,
        sourceUrl: source.url,
        sourceTitle: source.title,
        isOriginal: raw.isOriginal,
        distinctiveness: clamp(raw.distinctiveness, 0, 1),
        evidenceBasis: raw.evidenceBasis,
        side,
        reasoning: raw.reasoning,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("[baby-saver] Failed to extract babies:", error);
    return [];
  }
}

/**
 * Filter babies to only keep the genuinely original ones.
 * Sometimes the LLM marks things as original that aren't.
 */
export function filterGenuineBabies(babies: Baby[]): Baby[] {
  return babies.filter((baby) => {
    // Must be marked original
    if (!baby.isOriginal) return false;

    // Must have some distinctiveness
    if (baby.distinctiveness < 0.3) return false;

    // Must be grounded (empirical or experiential are strongest)
    // Theoretical and definitional are weaker but still valid
    return true;
  });
}

/**
 * Sort babies by distinctiveness (most unique first).
 */
export function sortByDistinctiveness(babies: Baby[]): Baby[] {
  return [...babies].sort((a, b) => b.distinctiveness - a.distinctiveness);
}

// =============================================================================
// Helpers
// =============================================================================

function parseJSON<T>(text: string): T | null {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
