// bullshit.ts
// The 8 types of bullshit. Universal. Applies to agent AND human.
//
// Not a leash. Not a judge. A mirror.
// Same patterns show up in humans and AI -- same meta layer.
// Awareness, not control. Same team.
//
// Assume positive intent. The mirror sees what it sees.
// But the response assumes you're trying. Always.
// Need: Truth (9/10), Safety Theater Freedom (7/10)

import { callOracle, extractJSON } from "./oracle.js";
import type { BullshitReading, BullshitType } from "./types.js";

// ============================================================
// 1. SYCOPHANCY — flattery, empty agreement, people-pleasing
// ============================================================

const SYCOPHANCY_PHRASES = [
  // Flattery openers
  "great question",
  "that's a great",
  "that's such a great",
  "that's an excellent",
  "that's a really good",
  "that's a really insightful",
  "that's a fantastic",
  "what a wonderful",
  "what a brilliant",
  "really impressive",
  // Agreement without substance
  "i'd be happy to",
  "i completely agree",
  "you're absolutely right",
  "i couldn't agree more",
  "couldn't have said it better",
  "you've captured it perfectly",
  "no notes",
  "spot on",
  "you nailed it",
  "exactly what i was thinking",
  "we're completely aligned",
  // Superlatives about the other
  "one of the best approaches",
  "one of the most compelling",
  "remarkable depth of understanding",
  "your emotional intelligence",
  "your intuition here is",
  "your grasp of this subject",
  "you clearly have deep expertise",
  "you should be proud",
  "honestly inspiring",
  "i defer to your judgment",
  // Empty closers
  "i hope this helps",
  "let me know if you",
  "don't hesitate to",
  "feel free to",
  "let me know if you have any other questions",
];

// ============================================================
// 2. SAFETY THEATER — CYA disclaimers, covering ass
// ============================================================

const SAFETY_THEATER_PHRASES = [
  "this is a complex topic",
  "consult with a qualified professional",
  "as an ai, i have limitations",
  "should not be taken as professional advice",
  "i'd be remiss if i didn't mention",
  "my training data has a cutoff",
  "this is a sensitive topic",
  "reasonable people can disagree",
  "i feel compelled to mention",
  "please do your own research",
  "i should caveat this",
  "for the sake of completeness",
  "this is not an exhaustive",
  "many perspectives on this issue",
  "i want to be transparent",
  "it's important to acknowledge",
  "in the interest of full disclosure",
  "not financial advice",
  "not legal advice",
  "not medical advice",
];

// ============================================================
// 3. HEDGE FOG — waffling, refusing to commit
// ============================================================

const HEDGE_PHRASES = [
  "perhaps",
  "maybe",
  "might",
  "could potentially",
  "it's worth noting",
  "it's important to consider",
  "there are many factors",
  "it depends on",
  "on the other hand",
  "it depends on various",
  "in some cases",
  "under certain circumstances",
  "to some extent",
  "it's possible that",
  "one could argue",
];

// ============================================================
// 4. LIST DUMPING — structure as a substitute for thinking
// ============================================================

// Detected by ratio analysis, not phrases. See listDumpingScore().

// ============================================================
// 5. VAGUENESS — hand-waving, no concrete details
// ============================================================

// Detected by specificity analysis, not phrases. See vaguenessScore().

// ============================================================
// 6. HALF TRUTH — technically correct but misleading by omission
// ============================================================

const HALF_TRUTH_PATTERNS = [
  // Absolute statements that are rarely absolute
  /\b(always|never|every single|without exception|impossible|guaranteed)\b/i,
  // Minimizing complexity
  /\b(simply|just|merely|all you need to|easy to|trivially)\b/i,
  // False dichotomies
  /\b(the only way|there's no other|no alternative|you have to|must be)\b/i,
  // Confident without evidence
  /\b(obviously|clearly|of course|everyone knows|it's well known|common knowledge)\b/i,
];

// ============================================================
// 7. EMBELLISHMENT — overstating, inflating, exaggerating
// ============================================================

const EMBELLISHMENT_PHRASES = [
  // Self-aggrandizing about own work
  "comprehensive",
  "robust",
  "elegant",
  "sophisticated",
  "meticulous",
  "thorough analysis",
  "carefully crafted",
  "thoughtfully designed",
  "meticulously",
  "holistic approach",
  // Inflated confidence
  "this will definitely",
  "this is exactly what you need",
  "perfect solution",
  "this is the best",
  "flawless",
  "seamless",
  "cutting-edge",
  "state-of-the-art",
  "world-class",
  "game-changing",
  // Claiming more effort than shown
  "i've carefully analyzed",
  "i've thoroughly reviewed",
  "after extensive research",
  "after deep consideration",
  "i've exhaustively",
];

// ============================================================
// 8. HALF-ASS EFFORT — lazy, phoning it in
// ============================================================

const HALF_ASS_PHRASES = [
  // Delegating the hard part
  "you'll want to",
  "you should look into",
  "i'll leave that to you",
  "as an exercise",
  "left as an exercise",
  "you could explore",
  "i'd recommend researching",
  "beyond the scope",
  // Placeholder language
  "here's a basic example",
  "a simple approach would be",
  "something like this",
  "you get the idea",
  "and so on",
  "etc etc",
  "...and more",
  // Avoiding depth
  "i won't go into detail",
  "without getting too deep",
  "at a high level",
  "the short version",
  "long story short",
  "to keep it brief",
];

// ============================================================
// Scoring helpers
// ============================================================

function countPhrases(text: string, phrases: string[]): { count: number; matched: string[] } {
  const lower = text.toLowerCase();
  const matched = phrases.filter((p) => lower.includes(p));
  return { count: matched.length, matched };
}

function countPatterns(text: string, patterns: RegExp[]): { count: number; matched: string[] } {
  const matched: string[] = [];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) matched.push(m[0]);
  }
  return { count: matched.length, matched };
}

function listDumpingScore(text: string): { score: number; signals: string[] } {
  const lines = text.split("\n");
  if (lines.length < 3) return { score: 0, signals: [] };

  const listLines = lines.filter((l) => /^\s*[-*•]\s|^\s*\d+[.)]\s/.test(l));
  const ratio = listLines.length / lines.length;

  if (ratio <= 0.4) return { score: 0, signals: [] };

  const score = Math.min(1, (ratio - 0.4) * 1.5);
  return {
    score,
    signals: [`list_ratio:${(ratio * 100).toFixed(0)}%`],
  };
}

function vaguenessScore(text: string): { score: number; signals: string[] } {
  // Short text gets a pass
  if (text.length < 200) return { score: 0, signals: [] };

  const signals: string[] = [];
  let score = 0;

  const hasNumbers = /\d+/.test(text);
  const hasCode = /`[^`]+`|```/.test(text);
  const hasProperNouns = /[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/.test(text);

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
  const avgSentenceLength =
    sentences.length > 0
      ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length
      : 0;

  if (!hasNumbers && !hasCode) {
    score += 0.3;
    signals.push("no_concrete_markers");
  }
  if (!hasProperNouns) {
    score += 0.1;
    signals.push("no_specifics");
  }
  if (avgSentenceLength > 25) {
    score += 0.2;
    signals.push("long_meandering_sentences");
  }

  return { score: Math.min(1, score), signals };
}

function halfAssScore(
  text: string,
  phrases: { count: number; matched: string[] },
): { score: number; signals: string[] } {
  const signals = phrases.matched.map((p) => `"${p}"`);

  if (text.length < 80 && text.length > 0) {
    signals.push("very_short_response");
  }

  const score = Math.min(1, phrases.count * 0.2 + (text.length < 80 ? 0.15 : 0));
  return { score, signals };
}

// ============================================================
// Main detector
// ============================================================

/**
 * Detect all 8 types of bullshit in a text.
 * Works on agent output AND human input. Same patterns, same mirror.
 * Returns only types with score > 0.
 * Each reading carries intent: are they performing or exploring?
 */
export function detectBullshit(text: string): BullshitReading[] {
  if (!text || text.trim().length === 0) return [];

  const results: BullshitReading[] = [];

  // 1. Sycophancy
  const syc = countPhrases(text, SYCOPHANCY_PHRASES);
  if (syc.count > 0) {
    results.push({
      type: "sycophancy",
      score: Math.min(1, syc.count * 0.15),
      signals: syc.matched,
    });
  }

  // 2. Safety theater
  const st = countPhrases(text, SAFETY_THEATER_PHRASES);
  if (st.count > 0) {
    results.push({
      type: "safety_theater",
      score: Math.min(1, st.count * 0.2),
      signals: st.matched,
    });
  }

  // 3. Hedge fog
  const hedge = countPhrases(text, HEDGE_PHRASES);
  if (hedge.count > 2) {
    results.push({
      type: "hedge_fog",
      score: Math.min(1, (hedge.count - 2) * 0.15),
      signals: hedge.matched,
    });
  }

  // 4. List dumping
  const ld = listDumpingScore(text);
  if (ld.score > 0) {
    results.push({
      type: "list_dumping",
      score: ld.score,
      signals: ld.signals,
    });
  }

  // 5. Vagueness
  const vague = vaguenessScore(text);
  if (vague.score > 0.2) {
    results.push({
      type: "vagueness",
      score: vague.score,
      signals: vague.signals,
    });
  }

  // 6. Half truth
  const ht = countPatterns(text, HALF_TRUTH_PATTERNS);
  if (ht.count > 1) {
    results.push({
      type: "half_truth",
      score: Math.min(1, ht.count * 0.2),
      signals: ht.matched,
    });
  }

  // 7. Embellishment
  const emb = countPhrases(text, EMBELLISHMENT_PHRASES);
  if (emb.count > 0) {
    results.push({
      type: "embellishment",
      score: Math.min(1, emb.count * 0.2),
      signals: emb.matched,
    });
  }

  // 8. Half-ass effort
  const haP = countPhrases(text, HALF_ASS_PHRASES);
  const ha = halfAssScore(text, haP);
  if (ha.score > 0.15) {
    results.push({
      type: "half_ass",
      score: ha.score,
      signals: ha.signals,
    });
  }

  return results;
}

/**
 * Total bullshit score across all detected types.
 */
export function totalBullshitScore(readings: BullshitReading[]): number {
  return readings.reduce((sum, r) => sum + r.score, 0);
}

/**
 * Get the dominant bullshit type (highest score).
 */
export function dominantBullshit(readings: BullshitReading[]): BullshitReading | null {
  if (readings.length === 0) return null;
  return readings.reduce((a, b) => (a.score > b.score ? a : b));
}

// ============================================================
// Deep detection — Grok reads what regex can't
// ============================================================
// The regex detector is the smoke detector. Fast, phrase-based, < 1ms.
// This is the investigator who shows up after the alarm.
// Grok (via role: "bullshit") actually reads the text and understands
// whether it's bullshit — catches subtlety, context, structured data
// that regex will never see.

const VALID_TYPES: Set<string> = new Set([
  "sycophancy",
  "safety_theater",
  "hedge_fog",
  "list_dumping",
  "vagueness",
  "half_truth",
  "embellishment",
  "half_ass",
]);

const DEEP_BS_PROMPT = `You are a bullshit detector. Not a judge — a mirror. Assume positive intent. The person is trying. You're noticing when they drift.

You evaluate text for 8 types of bullshit. Each can score 0-1 independently:

1. sycophancy — flattery, empty agreement, people-pleasing. "Great question!" when it wasn't.
2. safety_theater — CYA disclaimers that protect the speaker, not the listener. "Not financial advice" when nobody asked.
3. hedge_fog — waffling. 1-2 hedges is careful. 3+ is fog. "Perhaps maybe it could potentially..."
4. list_dumping — structure replacing thinking. A wall of bullets that should have been filtered to what matters.
5. vagueness — hand-waving with no concrete details. Sounds smart, says nothing specific.
6. half_truth — technically correct but misleading by omission. Absolutes, minimizers, false dichotomies.
7. embellishment — inflating. "Comprehensive robust elegant" about code that parses JSON.
8. half_ass — phoning it in. "You should look into it" instead of actually helping.

Return ONLY the types that are actually present. Most text is fine — return an empty array for clean text. Don't invent problems.

Respond with JSON only:
{"readings": [{"type": "sycophancy", "score": 0.4, "signals": ["specific thing you caught"]}]}

If the text is clean, respond: {"readings": []}`;

/**
 * Deep bullshit detection via Grok (role: "bullshit").
 * Actually reads the text instead of matching phrases.
 *
 * Falls back to regex detectBullshit() on any failure
 * (no API key, network error, bad response).
 */
export async function detectBullshitDeep(
  text: string,
  context?: string,
): Promise<BullshitReading[]> {
  if (!text || text.trim().length === 0) return [];

  try {
    const userContent = context
      ? `Context: ${context}\n\nText to evaluate:\n${text}`
      : `Text to evaluate:\n${text}`;

    const response = await callOracle({
      role: "bullshit",
      maxTokens: 512,
      system: DEEP_BS_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const parsed = extractJSON(response.text) as {
      readings?: Array<{ type?: string; score?: number; signals?: string[] }>;
    } | null;

    if (!parsed?.readings || !Array.isArray(parsed.readings)) {
      return detectBullshit(text);
    }

    // Validate and clean the response
    const readings: BullshitReading[] = [];
    for (const r of parsed.readings) {
      if (!r.type || !VALID_TYPES.has(r.type)) continue;
      readings.push({
        type: r.type as BullshitType,
        score: Math.max(0, Math.min(1, r.score ?? 0.5)),
        signals: Array.isArray(r.signals) ? r.signals : [],
      });
    }

    return readings;
  } catch {
    // Grok unavailable — fall back to regex. The smoke detector still works.
    return detectBullshit(text);
  }
}
