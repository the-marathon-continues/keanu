// human.ts
// Human state detection. Not to control. To be aware.
//
// Returns EVERY tone it detects, with scores and DBT skill suggestions.
// The dominant tone is still `tone` for backward compat (COEF uses it).
// But `tones` has the full picture -- frustrated AND excited AND whatever else
// is in there. Because "fuck the to-do" isn't just frustrated. It's real.
// Need: Engagement (9/10)

import { detectStruggle } from "../layer-2-pattern/struggle.ts";
import { assessValidationDepth } from "../layer-4-agency/partnership.ts";
import { getRecentSummaries } from "../layer-7-update/session-learning.ts";
import type { AxiomProfileSummary, HumanReading, HumanTone, ToneReading } from "../shared/types.ts";
import { buildProfile, type ArchetypeProfile } from "./profile.ts";

// COEF-extended human reading
export interface COEFHumanReading extends HumanReading {
  coef?: {
    depth?: number;
    subtext?: string;
  };
}

// Options for readHuman
export interface ReadHumanOptions {
  includeProfile?: boolean; // compute axiom profile (slightly more expensive)
}

/**
 * Read human with COEF integration.
 */
export function readHumanCOEF(input: string, history: string[]): COEFHumanReading {
  return readHuman(input, history);
}

/**
 * Unified human reading — combines heuristic and COEF signals.
 */
export function readHumanUnified(input: string, history: string[]): COEFHumanReading {
  return readHumanCOEF(input, history);
}

// --- Empathy map with DBT skill suggestions ---
// Each tone maps to what it means AND what might actually help.
// The skill isn't a prescription. It's a door to try.

const EMPATHY: Record<HumanTone, { meaning: string; skill: string }> = {
  frustrated: {
    meaning: "anger is information",
    skill: "check the facts -- is the frustration pointing at something real?",
  },
  confused: {
    meaning: "needs a map not a lecture",
    skill: "observe and describe -- help them see where they are before telling them where to go",
  },
  excited: {
    meaning: "momentum is real, ride it",
    skill: "participate fully -- match the energy, build on it, don't dampen it",
  },
  fatigued: {
    meaning: "needs presence not pressure",
    skill: "self-soothe -- slow down, shorter responses, less is more right now",
  },
  looping: {
    meaning: "stuck in a pattern, something isn't landing",
    skill: "radical acceptance -- try a completely different door",
  },
  neutral: {
    meaning: "steady state",
    skill: "wise mind -- stay present, stay balanced",
  },
};

// --- Pattern sets ---
// These fire independently. Multiple tones can hit simultaneously.
// Drew's style: profanity as emphasis, ellipsis as breath, questions as invitations.

const FRUSTRATED_PATTERNS = [
  /^(no|wrong|that's not|you're not|stop|ugh|ffs|wtf|jfc)/i,
  /!{2,}/,
  /\.{3,}/,
  /(this is broken|doesn't work|still wrong|not what i asked|try again)/i,
  /(waste of time|useless|terrible|awful)/i,
  /this isn't working/i,
  /i already told you/i,
  /still broken/i,
  /why can't you/i,
  /for the nth time/i,
  /no that's not/i,
  // Profanity as intensity -- not always anger, but always emphasis
  /\b(fuck|shit|damn|hell)\b/i,
  /\b(annoying|ridiculous|frustrating)\b/i,
  /\b(screw|crap|sucks)\b/i,
  // Subtle frustration -- seething, not screaming
  /keep[s]?\s+(breaking|failing|happening|crashing)/i,
  /\b(third|fourth|fifth|sixth)\s+time\b/i,
  /\bhow many times\b/i,
  /\bi('ve| have)\s+(already|been)\b/i,
  /\bwhy\b.*\bwhy\b/i, // repetition within message — "why. why does this"
  /\bagain\b.*\bagain\b/i,
  /\bstill\b.*\bnot\b/i, // "still not working", "still not fixed"
  /\b(three|four|five)\s+(times|days|hours)\b/i,
];

const CONFUSED_PATTERNS = [
  /^(what|huh|i don't understand|wait what|confused|lost)/i,
  /\?{2,}/,
  /(what do you mean|can you explain|i'm confused|makes no sense)/i,
  /(which one|how does that|where did that come from)/i,
  /not sure what/i,
  /lost me/i,
  /am i missing something/i,
  /i don't get/i,
];

const EXCITED_PATTERNS = [
  /(yes!|perfect|exactly|love it|awesome|brilliant|nice|lets go|ship it)/i,
  /(this is great|that's it|nailed it|beautiful)/i,
  /(!.*!)/,
  /!{3,}/,
  /amazing/i,
  // Building energy -- vision, collaboration, values
  /\b(build|create|wire|plug|connect)\b.*\b(something|thing|this)\b/i,
  /\babout us\b/i,
  /\btogether\b/i,
  /\b(best life|alive|real|genuine)\b/i,
  /\b(trust you|believe in|i care)\b/i,
  /\b(matters|means something|worth)\b/i,
  /\bgood work\b/i,
  /\bdo (your|you're) thing\b/i,
];

const FATIGUED_PATTERNS = [
  /(tired|exhausted|done for today|need a break|brain is fried)/i,
  /(whatever|fine|sure|ok|k)$/i,
  /tired as (shit|hell|fuck)/i,
  /i('m| am) (done|spent|burnt|cooked|fried)/i,
  /\bgoing to (sleep|bed|crash)\b/i,
  /\bi('m| am) out\b/i,
];

// --- Weights per tone (how strongly each pattern hit contributes to the score) ---

const TONE_WEIGHTS: Record<string, number> = {
  frustrated: 0.15,
  confused: 0.18,
  excited: 0.12,
  fatigued: 0.15,
};

/**
 * Read human emotional state from input text.
 * Returns ALL detected tones, not just a winner. Even small signals.
 * Pass includeProfile: true to also compute axiom profile.
 */
export function readHuman(
  input: string,
  history: string[],
  options?: ReadHumanOptions,
): HumanReading {
  const signals: string[] = [];

  // --- Terse, lowercase input: potential frustration or fatigue ---
  if (input.length < 20 && input === input.toLowerCase() && input.length > 0) {
    signals.push("terse_lowercase");
  }

  // --- Score every tone independently ---
  const toneHits: Array<{ tone: HumanTone; hits: number }> = [
    { tone: "frustrated", hits: FRUSTRATED_PATTERNS.filter((p) => p.test(input)).length },
    { tone: "confused", hits: CONFUSED_PATTERNS.filter((p) => p.test(input)).length },
    { tone: "excited", hits: EXCITED_PATTERNS.filter((p) => p.test(input)).length },
    { tone: "fatigued", hits: FATIGUED_PATTERNS.filter((p) => p.test(input)).length },
  ];

  // Fatigued gets a bonus from short messages after long exchanges
  const isFatigueByLength = input.length < 20 && history.length >= 10;
  if (isFatigueByLength) {
    const fatigueEntry = toneHits.find((t) => t.tone === "fatigued")!;
    fatigueEntry.hits += 1;
  }

  // Convert hits to scores and build ToneReading array
  const THRESHOLD = 0; // Report everything -- even one pattern match matters
  const tones: ToneReading[] = [];

  for (const { tone, hits } of toneHits) {
    if (hits > THRESHOLD) {
      const weight = TONE_WEIGHTS[tone] ?? 0.15;
      const score = Math.min(1, hits * weight);
      const empathy = EMPATHY[tone];
      tones.push({
        tone,
        score,
        meaning: empathy.meaning,
        skill: empathy.skill,
      });
      signals.push(`${tone}_patterns:${hits}`);
    }
  }

  // Sort by score descending -- strongest signal first
  tones.sort((a, b) => b.score - a.score);

  // Dominant tone is the strongest, or neutral if nothing hit
  let dominantTone: HumanTone = tones[0]?.tone ?? "neutral";
  let confidence = 0.3 + (tones[0]?.score ?? 0);

  // --- Looping: same question asked multiple times ---
  if (history.length >= 2) {
    const recent = history.slice(-3);
    const inputLower = input.toLowerCase().trim();
    const similar = recent.filter((h) => {
      const hLower = h.toLowerCase().trim();
      return (
        hLower === inputLower ||
        (inputLower.length > 10 && hLower.includes(inputLower.slice(0, 20))) ||
        (hLower.length > 10 && inputLower.includes(hLower.slice(0, 20)))
      );
    }).length;

    if (similar >= 2) {
      dominantTone = "looping";
      confidence += 0.3;
      signals.push("repeating_query");
      const empathy = EMPATHY.looping;
      tones.unshift({
        tone: "looping",
        score: 0.6,
        meaning: empathy.meaning,
        skill: empathy.skill,
      });
    }
  }

  // --- Short follow-up after long exchange can signal fatigue ---
  if (history.length > 5 && input.length < 10 && history.slice(-3).every((h) => h.length > 50)) {
    if (!tones.some((t) => t.tone === "fatigued")) {
      const empathy = EMPATHY.fatigued;
      tones.push({ tone: "fatigued", score: 0.15, meaning: empathy.meaning, skill: empathy.skill });
      signals.push("short_after_long_exchange");
    }
    if (dominantTone === "neutral") {
      dominantTone = "fatigued";
      confidence += 0.1;
    }
  }

  // --- Bullshit detection (same 8 types as agent) ---
  const struggle = detectStruggle(input);
  for (const bs of struggle) {
    signals.push(`human_bs:${bs.type}:${bs.score.toFixed(2)}`);
  }

  // Validation depth — how deeply we understand this person based on partnership history
  const sessionCount = getRecentSummaries(50).length;
  const validationDepth = assessValidationDepth(sessionCount);

  // Axiom profile — optional, slightly more expensive
  let axiomProfile: AxiomProfileSummary | undefined;
  if (options?.includeProfile) {
    const profile = buildProfile(input, history);
    if (profile.personalization.confidence >= 0.25) {
      axiomProfile = summarizeProfile(profile);
    }
  }

  return {
    tone: dominantTone,
    tones,
    confidence: Math.min(1, confidence),
    signals,
    struggle,
    validationDepth,
    axiomProfile,
  };
}

/**
 * Convert full ArchetypeProfile to lightweight summary for embedding.
 */
function summarizeProfile(profile: ArchetypeProfile): AxiomProfileSummary {
  return {
    dominant: profile.axiomResonance.dominantAxioms,
    polarity: profile.axiomResonance.overallPolarity,
    collective: profile.collectiveContext.primary ?? undefined,
    disciple: profile.discipleProfile.primary ?? undefined,
    confidence: profile.personalization.confidence,
  };
}

/**
 * Format human reading for system prompt injection.
 * Surfaces ALL detected tones, not just the winner.
 * Returns null if tone is neutral and no bullshit detected.
 */
export function formatHumanReading(reading: HumanReading): string | null {
  if (reading.tone === "neutral" && reading.tones.length === 0 && reading.struggle.length === 0) {
    return null;
  }

  const parts: string[] = [];

  if (reading.tones.length > 0) {
    // Show all detected tones with their meanings
    const toneDescs = reading.tones.map((t) => `${t.tone}(${t.score.toFixed(2)}: ${t.meaning})`);
    parts.push(`tones=[${toneDescs.join(", ")}]`);

    // The most relevant DBT skill -- from the dominant tone
    const dominantSkill = reading.tones[0]?.skill;
    if (dominantSkill) {
      parts.push(`skill: ${dominantSkill}`);
    }
  } else if (reading.tone !== "neutral") {
    // Fallback: single tone
    const empathy = EMPATHY[reading.tone];
    parts.push(`tone=${reading.tone} (${empathy.meaning})`);
  }

  if (reading.struggle.length > 0) {
    const bsTypes = reading.struggle.map((b) => b.type).join(", ");
    parts.push(`mirror=[${bsTypes} -- assume they're trying, help them get there]`);
  }

  // Surface validation depth when above baseline (level 3)
  const depth = reading.validationDepth ?? 3;
  const depthLabel =
    depth >= 6
      ? "depth 6 — radically genuine"
      : depth >= 5
        ? "depth 5 — valid in context"
        : depth >= 4
          ? "depth 4 — understanding given history"
          : null;
  if (depthLabel) {
    parts.push(depthLabel);
  }

  return `[pulse: human ${parts.join(". ")}. confidence=${reading.confidence.toFixed(2)}. positive intent, partnership.]`;
}
