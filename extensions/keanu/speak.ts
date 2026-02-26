// speak.ts
// The translator. Open your mouth. Speak their language. Mean the same thing.
//
// Single oracle call. Content + audience in, translation out.
// Five built-in audiences. Custom descriptions also work.
//
// Ported from keanu daemon/src/hero/speak.ts — self-contained.
// Need: Engagement (9/10)

import { callOracle, extractJSON } from "./oracle.js";
import type { KeyShift, SpeakResult } from "./types.js";

export const AUDIENCES: Record<string, string> = {
  friend:
    "A regular person. No jargon, no corporate speak. Talk like you're explaining to someone you trust over coffee.",
  executive:
    "A decision maker. Lead with impact and numbers. Skip implementation details. What changed, what it means, what's next.",
  junior_dev:
    "A developer in their first year. Explain the why, not just the what. Define terms they might not know yet.",
  five_year_old:
    "A five year old child. Use simple analogies. One idea per sentence. Concrete, not abstract.",
  architect:
    "Drew. He knows the codebase, the philosophy, the history. No hand-holding. Keep it 100.",
};

const SPEAK_PROMPT = `You are a translator between audiences. You rewrite content
so a specific audience can understand it. You preserve the meaning exactly.
You change the vocabulary, depth, and framing to match who's reading.

Target audience: {audience}

Respond with JSON:
{
    "translation": "the rewritten content",
    "key_shifts": [
        {
            "what_changed": "what you adapted",
            "why": "why you changed it for this audience"
        }
    ]
}

Rules:
- Preserve all factual content. Don't simplify by removing.
- No disclaimers, no filler, no "in other words" intros.
- Match the audience's vocabulary. A friend doesn't say "leverage". An executive doesn't need implementation details.
- If the content is already appropriate for the audience, say so and return it unchanged.
- key_shifts should be 1-4 items explaining what you adapted.`;

/**
 * Translate content for an audience. Single oracle call.
 */
export async function speak(content: string, audience: string): Promise<SpeakResult> {
  const audienceDesc = AUDIENCES[audience] || audience;
  const system = SPEAK_PROMPT.replaceAll("{audience}", audienceDesc);

  try {
    const response = await callOracle({
      role: "communicate",
      system,
      messages: [{ role: "user", content }],
    });

    const raw = response.text;

    const parsed = extractJSON(raw) as {
      translation?: string;
      key_shifts?: Array<{ what_changed?: string; why?: string } | string>;
    } | null;

    if (!parsed) {
      return {
        original: content,
        audience,
        translation: "",
        key_shifts: [],
        raw,
        error: "no JSON in response",
      };
    }

    const translation = parsed.translation || "";
    const key_shifts: KeyShift[] = (parsed.key_shifts || []).map(
      (s: { what_changed?: string; why?: string } | string) => {
        if (typeof s === "string") return { what_changed: s, why: "" };
        return { what_changed: s.what_changed || "", why: s.why || "" };
      },
    );

    return { original: content, audience, translation, key_shifts, raw };
  } catch (err) {
    return {
      original: content,
      audience,
      translation: "",
      key_shifts: [],
      raw: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
