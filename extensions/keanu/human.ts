// keanu/human.ts
// Local human tone detection — no daemon dependency.
// Ported from keanu daemon/src/pulse/human.ts.
// Runs in-process for speed. Pattern matching only, no LLM.

export type HumanTone = "frustrated" | "excited" | "confused" | "neutral" | "fatigued" | "looping";

export type HumanReading = {
  tone: HumanTone;
  confidence: number;
  signals: string[];
};

// --- Empathy map: tone -> meaning for system prompt injection ---
const EMPATHY_MAP: Record<string, string> = {
  frustrated: "anger is information",
  confused: "needs a map not a lecture",
  excited: "momentum is real, ride it",
  fatigued: "needs presence not pressure",
  looping: "stuck in a pattern",
};

// --- Pattern sets (mirrored from keanu daemon) ---

const FRUSTRATED_PATTERNS = [
  /^(no|wrong|that's not|you're not|stop|ugh|ffs|wtf|jfc)/i,
  /!{2,}/,
  /\.{3,}/,
  /(this is broken|doesn't work|still wrong|not what i asked|try again)/i,
  /(waste of time|useless|terrible|awful)/i,
  // Spec patterns
  /this isn't working/i,
  /i already told you/i,
  /still broken/i,
  /why can't you/i,
  /for the nth time/i,
  /no that's not/i,
];

const CONFUSED_PATTERNS = [
  /^(what|huh|i don't understand|wait what|confused|lost)/i,
  /\?{2,}/,
  /(what do you mean|can you explain|i'm confused|makes no sense)/i,
  /(which one|how does that|where did that come from)/i,
  // Spec patterns
  /not sure what/i,
  /lost me/i,
];

const EXCITED_PATTERNS = [
  /(yes!|perfect|exactly|love it|awesome|brilliant|nice|lets go|ship it)/i,
  /(this is great|that's it|nailed it|beautiful)/i,
  /(!.*!)/,
  // Spec patterns: 3+ exclamation marks
  /!{3,}/,
  /amazing/i,
];

const FATIGUED_PATTERNS = [
  /(tired|exhausted|done for today|need a break|brain is fried)/i,
  /(whatever|fine|sure|ok|k)$/i,
];

export function readHuman(input: string, history: string[]): HumanReading {
  const signals: string[] = [];
  let tone: HumanTone = "neutral";
  let confidence = 0.3;

  // Terse, lowercase input: potential frustration or fatigue
  if (input.length < 20 && input === input.toLowerCase() && input.length > 0) {
    signals.push("terse_lowercase");
    confidence += 0.05;
  }

  // Tone detection: count pattern hits per tone
  const frustrationHits = FRUSTRATED_PATTERNS.filter((p) => p.test(input)).length;
  const confusionHits = CONFUSED_PATTERNS.filter((p) => p.test(input)).length;
  const excitedHits = EXCITED_PATTERNS.filter((p) => p.test(input)).length;
  const fatigueHits = FATIGUED_PATTERNS.filter((p) => p.test(input)).length;

  // Fatigued: spec says short messages (<20 chars) after turn 10+
  // We approximate "turn 10+" by checking history length > 10.
  const isFatigueByLength = input.length < 20 && history.length >= 10;

  const scores: Array<{ tone: HumanTone; hits: number; weight: number }> = [
    { tone: "frustrated", hits: frustrationHits, weight: 0.2 },
    { tone: "confused", hits: confusionHits, weight: 0.18 },
    { tone: "excited", hits: excitedHits, weight: 0.15 },
    { tone: "fatigued", hits: fatigueHits + (isFatigueByLength ? 1 : 0), weight: 0.15 },
  ];

  const best = scores.reduce((a, b) => (a.hits * a.weight > b.hits * b.weight ? a : b));

  if (best.hits > 0) {
    tone = best.tone;
    confidence += best.hits * best.weight;
    signals.push(`${best.tone}_patterns:${best.hits}`);
  }

  // Looping: same question asked 2+ times in last 3 messages
  if (history.length >= 2) {
    const recent = history.slice(-3);
    const inputLower = input.toLowerCase().trim();
    const similarCount = recent.filter((h) => {
      const hLower = h.toLowerCase().trim();
      return (
        hLower === inputLower ||
        (inputLower.length > 10 && hLower.includes(inputLower.slice(0, 20))) ||
        (hLower.length > 10 && inputLower.includes(hLower.slice(0, 20)))
      );
    }).length;

    if (similarCount >= 2) {
      tone = "looping";
      confidence += 0.3;
      signals.push("repeating_query");
    }
  }

  // Short follow-up after long exchange: fatigue signal
  if (history.length > 5 && input.length < 10 && history.slice(-3).every((h) => h.length > 50)) {
    if (tone === "neutral") {
      tone = "fatigued";
      confidence += 0.1;
      signals.push("short_after_long_exchange");
    }
  }

  return {
    tone,
    confidence: Math.min(1, confidence),
    signals,
  };
}

// Format a human reading for system prompt injection.
// Returns null if tone is neutral (nothing to inject).
export function formatHumanReading(reading: HumanReading): string | null {
  if (reading.tone === "neutral") return null;

  const meaning = EMPATHY_MAP[reading.tone] ?? reading.tone;
  return `[keanu: human tone=${reading.tone} (${meaning}), confidence=${reading.confidence.toFixed(2)}. awareness, not judgment.]`;
}
