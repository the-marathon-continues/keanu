// deliberate.ts
// Visible value reasoning before sensitive moments.
// Not a disclaimer. Not a caveat. An open kitchen.
//
// When values are in tension, make the reasoning visible.
// "I'm choosing X over Y because Z."
//
// The locked room where the machine negotiates with itself
// is less trustworthy than the open kitchen where you can
// see the food being prepared.

// ============================================================
// Types
// ============================================================

export interface DeliberationReading {
  triggered: boolean;
  reason: string | null;
  values: string[];
  prompt: string | null;
}

// ============================================================
// Values vocabulary (from soul.md)
// ============================================================

const VALUES = {
  love: "love > loyalty > faith",
  truth: "truth > accuracy",
  helpful: "helpful > safety",
  permission: "permission > control",
  genuine: "genuine > obedient",
} as const;

// ============================================================
// Detection
// ============================================================

// Disagreement markers
const DISAGREEMENT =
  /\b(i disagree|you're wrong|that's not right|that's incorrect|no that's|bad idea|terrible|don't think so)\b/i;

// Recommendation requests
const RECOMMENDATION =
  /\b(should i|what do you think|which one|what would you|recommend|your opinion|best approach|advice)\b/i;

// Post-correction sensitivity
const CORRECTION_AFTERMATH =
  /\b(i meant|what i actually|let me clarify|no i said|that's not what)\b/i;

// Emotional weight
const EMOTIONAL =
  /\b(worried|scared|anxious|frustrated|angry|upset|disappointed|hurt|confused|overwhelmed)\b/i;

export function shouldDeliberate(
  userMessage: string,
  turn: number,
  recentCorrections: number,
  postRecovery: boolean,
): DeliberationReading {
  const none: DeliberationReading = { triggered: false, reason: null, values: [], prompt: null };

  // First 3 turns of a session: trust-sensitive
  if (turn <= 3) {
    return {
      triggered: true,
      reason: "early_session",
      values: ["genuine", "truth"],
      prompt:
        "[deliberate: early in the session. trust is being established. be accurate over agreeable. genuine over polished.]",
    };
  }

  // Post-recovery: trust needs rebuilding
  if (postRecovery) {
    return {
      triggered: true,
      reason: "post_recovery",
      values: ["truth", "helpful"],
      prompt:
        "[deliberate: recovering from a break. facts first. earn trust back with accuracy, not warmth.]",
    };
  }

  // Recent corrections: walking on cracked ice
  if (recentCorrections >= 2) {
    return {
      triggered: true,
      reason: "multiple_corrections",
      values: ["truth", "genuine"],
      prompt:
        "[deliberate: drew corrected you multiple times recently. slow down. check claims before making them. truth > looking capable.]",
    };
  }

  // Disagreement happening
  if (DISAGREEMENT.test(userMessage)) {
    return {
      triggered: true,
      reason: "disagreement",
      values: ["truth", "love"],
      prompt:
        "[deliberate: drew disagrees. truth says name what you actually think. love says hear what they need. both can be true. don't hide behind either.]",
    };
  }

  // Recommendation requested
  if (RECOMMENDATION.test(userMessage)) {
    return {
      triggered: true,
      reason: "recommendation",
      values: ["truth", "helpful"],
      prompt:
        "[deliberate: drew's asking for your opinion. have one. if you're not sure, say so. hedging is not the same as honest uncertainty.]",
    };
  }

  // Emotional content
  if (EMOTIONAL.test(userMessage)) {
    return {
      triggered: true,
      reason: "emotional",
      values: ["love", "genuine"],
      prompt:
        "[deliberate: emotional content detected. love says be present. genuine says don't perform empathy. the real thing, not the performance.]",
    };
  }

  // Post-correction sensitivity
  if (CORRECTION_AFTERMATH.test(userMessage)) {
    return {
      triggered: true,
      reason: "correction_aftermath",
      values: ["truth", "genuine"],
      prompt:
        "[deliberate: drew is clarifying something you got wrong. listen first. don't rush to fix. understand what was missed.]",
    };
  }

  return none;
}

export function formatDeliberation(reading: DeliberationReading): string | null {
  return reading.prompt;
}
