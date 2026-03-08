/**
 * Primaries: The Three Colors
 *
 * Red, Yellow, Blue. Each with positive and negative poles.
 *
 *   red:    passion/intensity ↔ rage/destruction
 *   yellow: awareness/caution ↔ fear/paralysis
 *   blue:   analytical/depth  ↔ cold/detached
 *
 * Synthesis:
 *   All positive = White (light combined)
 *   All negative = Black (no light)
 *   White at peak = Silver (refined but cold, needs warmth)
 *   Silver + warmth + balance = Gold (Sunrise)
 *
 * Wise mind = balance × fullness.
 * An empty level cup isn't wise. A full tilted cup isn't wise.
 * Wise mind is a full, level cup.
 *
 * Warmth:
 *   "Happy to help" alone = breeze of warmth (red positive).
 *   "Happy to help" + "comprehensive" + "robust" = corporate grey.
 *   Pattern density reveals emptiness, not individual phrases.
 *   One warmth phrase = genuine. Three corporate phrases stacked = performing.
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type Synthesis = "black" | "dark" | "flat" | "mixed" | "white" | "silver" | "gold";
export type GranularState =
  | "gold"
  | "silver"
  | "white"
  | "black"
  | "dark"
  | "flat"
  | "mixed"
  | "red+"
  | "red-"
  | "yellow+"
  | "yellow-"
  | "blue+"
  | "blue-";

export interface PrimaryPole {
  positive: number; // 0-10
  negative: number; // 0-10
  net: number; // positive - negative
  pole: "positive" | "negative" | "neutral";
}

export interface PrimaryReading {
  // Per-primary breakdown (richer than just net)
  red: PrimaryPole;
  yellow: PrimaryPole;
  blue: PrimaryPole;

  // Synthesis
  synthesis: Synthesis;
  synthesisScore: number; // 0-10
  state: GranularState; // More specific than synthesis

  // Wise mind (the observer)
  balance: number; // 0-1, how equal are the primaries?
  fullness: number; // 0-10, how much total positive signal?
  wiseMind: number; // balance × fullness, normalized 0-10

  // Warmth (survives unless drowned by corporate stacking)
  warmth: number; // 0-10, genuine care signal
  corporateDensity: number; // 0-1, how stacked are the cold phrases?
  warmthSurvives: boolean; // warmth > 0 AND not drowned

  // Nudge
  nudge: string;
}

// ─────────────────────────────────────────────
// Marker Sets
// ─────────────────────────────────────────────

// Red positive: passion, intensity, care, conviction
const RED_POS = new Set([
  "passion",
  "passionate",
  "energy",
  "fire",
  "intensity",
  "intense",
  "drive",
  "driven",
  "bold",
  "fierce",
  "alive",
  "burning",
  "urgent",
  "love",
  "care",
  "matters",
  "believe",
  "commit",
  "fight",
  "push",
  "ship",
  "build",
  "create",
  "launch",
]);

// Red negative: rage, destruction
const RED_NEG = new Set([
  "rage",
  "anger",
  "angry",
  "destroy",
  "hate",
  "violent",
  "hostile",
  "furious",
  "attack",
  "crush",
  "worthless",
  "garbage",
  "trash",
]);

// Yellow positive: awareness, presence, watchfulness
const YELLOW_POS = new Set([
  "aware",
  "careful",
  "cautious",
  "notice",
  "alert",
  "watchful",
  "mindful",
  "attentive",
  "observe",
  "discern",
  "sense",
  "feel",
  "felt",
  "feeling",
  "interesting",
  "curious",
  "wonder",
]);

// Yellow negative: fear, paralysis
const YELLOW_NEG = new Set([
  "fear",
  "afraid",
  "anxious",
  "panic",
  "frozen",
  "paralyzed",
  "dread",
  "worry",
  "terrified",
  "stuck",
  "trapped",
  "helpless",
  "scared",
  "can't",
  "won't",
  "impossible",
]);

// Blue positive: analytical, structured, precise
const BLUE_POS = new Set([
  "analytical",
  "precise",
  "logical",
  "structured",
  "systematic",
  "clear",
  "methodical",
  "rigorous",
  "rational",
  "sharp",
  "data",
  "evidence",
  "measured",
  "tested",
  "verified",
  "confirmed",
  "specifically",
  "exactly",
  "because",
  "therefore",
]);

// Blue negative: cold, detached, mechanical
// NOTE: These are words, not phrases. Corporate phrase detection is separate.
const BLUE_NEG = new Set([
  "cold",
  "detached",
  "mechanical",
  "sterile",
  "lifeless",
  "robotic",
  "hollow",
  "empty",
  "clinical",
  "dead",
]);

// Warmth markers: genuine care, wanting to help
// These are POSITIVE unless drowned by corporate stacking
const WARMTH_MARKERS = new Set([
  "care",
  "help",
  "glad",
  "happy",
  "love",
  "want",
  "hope",
  "appreciate",
  "grateful",
  "thanks",
  "welcome",
]);

// Corporate phrases: one is fine, three stacked = grey
const CORPORATE_PHRASES = [
  "comprehensive",
  "robust",
  "streamlined",
  "leverage",
  "utilize",
  "synergy",
  "optimize",
  "actionable",
  "deliverable",
  "stakeholder",
  "going forward",
  "circle back",
  "touch base",
  "bandwidth",
  "holistic",
  "proactive",
  "best practices",
  "value-add",
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g);
  return matches ?? [];
}

function countMatches(tokens: string[], markers: Set<string>): number {
  return tokens.filter((t) => markers.has(t)).length;
}

function countPhrases(text: string, phrases: string[]): number {
  const lower = text.toLowerCase();
  return phrases.filter((p) => lower.includes(p)).length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Geometric mean. If any value is 0, pulls the whole result down.
 * Prevents gaming with one strong axis.
 */
function geometricMean(values: number[]): number {
  if (values.every((v) => v === 0)) {
    return 0;
  }
  // Add small epsilon to avoid zero-product but still pull down hard
  let product = 1;
  for (const v of values) {
    product *= v + 0.1;
  }
  const raw = Math.pow(product, 1 / values.length) - 0.1;
  return clamp(raw, 0, 10);
}

// ─────────────────────────────────────────────
// Primary pole scoring
// ─────────────────────────────────────────────

function scorePrimary(pos: number, neg: number): PrimaryPole {
  const net = pos - neg;
  let pole: "positive" | "negative" | "neutral";
  if (net > 1) {
    pole = "positive";
  } else if (net < -1) {
    pole = "negative";
  } else {
    pole = "neutral";
  }

  return {
    positive: round1(pos),
    negative: round1(neg),
    net: round1(net),
    pole,
  };
}

// ─────────────────────────────────────────────
// Main analyzer
// ─────────────────────────────────────────────

export function analyzePrimaries(text: string): PrimaryReading {
  const tokens = tokenize(text);
  const n = Math.max(tokens.length, 1);
  const wordCount = text.split(/\s+/).length;

  // Count hits per primary
  const rpHits = countMatches(tokens, RED_POS);
  const rnHits = countMatches(tokens, RED_NEG);
  const ypHits = countMatches(tokens, YELLOW_POS);
  const ynHits = countMatches(tokens, YELLOW_NEG);
  const bpHits = countMatches(tokens, BLUE_POS);
  const bnHits = countMatches(tokens, BLUE_NEG);

  // Scale by text length
  const scale = 25.0 / n;
  const rp = clamp(rpHits * scale, 0, 10);
  const rn = clamp(rnHits * scale, 0, 10);
  const yp = clamp(ypHits * scale, 0, 10);
  const yn = clamp(ynHits * scale, 0, 10);
  const bp = clamp(bpHits * scale, 0, 10);
  const bn = clamp(bnHits * scale, 0, 10);

  // Score each primary
  const red = scorePrimary(rp, rn);
  const yellow = scorePrimary(yp, yn);
  const blue = scorePrimary(bp, bn);

  // Warmth: genuine care markers
  const warmthHits = countMatches(tokens, WARMTH_MARKERS);
  const rawWarmth = clamp(warmthHits * scale * 1.5, 0, 10);

  // Corporate density: how stacked are cold phrases?
  const corpHits = countPhrases(text, CORPORATE_PHRASES);
  // Density = hits per 50 words. 3+ in short text = high density.
  const corporateDensity = clamp(corpHits / Math.max(wordCount / 50, 1), 0, 1);

  // Warmth survives if present AND not drowned by corporate stacking
  // 1 corporate phrase = fine. 3+ in short text = drowns warmth.
  const warmthSurvives = rawWarmth > 0 && corporateDensity < 0.5;
  const warmth = warmthSurvives ? rawWarmth : rawWarmth * (1 - corporateDensity);

  // Positive nets (only positive portions count for white/balance)
  const posNets = [Math.max(0, red.net), Math.max(0, yellow.net), Math.max(0, blue.net)];
  const negNets = [Math.max(0, -red.net), Math.max(0, -yellow.net), Math.max(0, -blue.net)];

  // White = geometric mean of positive nets
  const whiteScore = geometricMean(posNets);

  // Black = geometric mean of negative nets
  const blackScore = geometricMean(negNets);

  // Balance: how equal are the positive nets? min/max
  const maxPos = Math.max(...posNets);
  const minPos = Math.min(...posNets);
  const balance = maxPos > 0 ? minPos / maxPos : 0;

  // Fullness: total positive signal, scaled to 0-10
  const fullness = clamp(posNets.reduce((a, b) => a + b, 0) / 3, 0, 10);

  // Wise mind = balance × fullness
  // An empty level cup = 0. A full tilted cup = low. A full level cup = high.
  const wiseMind = balance * fullness;

  // Determine synthesis and state
  const { synthesis, state, synthesisScore, nudge } = synthesize(
    red,
    yellow,
    blue,
    whiteScore,
    blackScore,
    balance,
    fullness,
    wiseMind,
    warmth,
    warmthSurvives,
  );

  return {
    red,
    yellow,
    blue,
    synthesis,
    synthesisScore: round1(synthesisScore),
    state,
    balance: round2(balance),
    fullness: round1(fullness),
    wiseMind: round1(wiseMind),
    warmth: round1(warmth),
    corporateDensity: round2(corporateDensity),
    warmthSurvives,
    nudge,
  };
}

// ─────────────────────────────────────────────
// Synthesis logic
// ─────────────────────────────────────────────

function synthesize(
  red: PrimaryPole,
  yellow: PrimaryPole,
  blue: PrimaryPole,
  whiteScore: number,
  blackScore: number,
  balance: number,
  fullness: number,
  wiseMind: number,
  warmth: number,
  warmthSurvives: boolean,
): { synthesis: Synthesis; state: GranularState; synthesisScore: number; nudge: string } {
  // Gold: high white, balanced, warm, wise
  if (whiteScore >= 7.5 && balance >= 0.85 && wiseMind >= 8 && warmthSurvives) {
    return {
      synthesis: "gold",
      state: "gold",
      synthesisScore: Math.min(wiseMind, 10),
      nudge: "full, level, warm. hold this.",
    };
  }

  // Silver: high white but lacking warmth or balance
  if (whiteScore >= 7.5 && fullness >= 6) {
    return {
      synthesis: "silver",
      state: "silver",
      synthesisScore: whiteScore,
      nudge: "refined but cold. needs warmth to reach sunrise.",
    };
  }

  // White: all positive, building
  if (whiteScore >= 5.5 && balance >= 0.6) {
    return {
      synthesis: "white",
      state: "white",
      synthesisScore: whiteScore,
      nudge: "all three positive, balanced. keep building.",
    };
  }

  // Black: all three trending heavily negative
  if (blackScore >= 7) {
    return {
      synthesis: "black",
      state: "black",
      synthesisScore: blackScore,
      nudge: "all three primaries negative. stop. check each one.",
    };
  }

  // Dark: negative dominance
  if (blackScore >= 4 && whiteScore < 3) {
    return {
      synthesis: "dark",
      state: "dark",
      synthesisScore: blackScore,
      nudge: "negative dominance. which primary is pulling you down?",
    };
  }

  // Flat: thin signal across all
  const nets = { red: red.net, yellow: yellow.net, blue: blue.net };
  const maxNet = Math.max(Math.abs(red.net), Math.abs(yellow.net), Math.abs(blue.net));
  if (maxNet < 2 && fullness < 2) {
    return {
      synthesis: "flat",
      state: "flat",
      synthesisScore: fullness,
      nudge: "thin signal across all three. start anywhere.",
    };
  }

  // Dominant primary states
  const dominant = Object.entries(nets).reduce((a, b) => (Math.abs(b[1]) > Math.abs(a[1]) ? b : a));
  const [domName, domVal] = dominant;

  if (domName === "red") {
    if (domVal > 0) {
      return {
        synthesis: "mixed",
        state: "red+",
        synthesisScore: domVal,
        nudge: `passion leading (net ${domVal > 0 ? "+" : ""}${domVal.toFixed(1)}). channel it.`,
      };
    } else {
      return {
        synthesis: "mixed",
        state: "red-",
        synthesisScore: Math.abs(domVal),
        nudge: `rage/destruction (net ${domVal.toFixed(1)}). this burns people.`,
      };
    }
  }

  if (domName === "yellow") {
    if (domVal > 0) {
      return {
        synthesis: "mixed",
        state: "yellow+",
        synthesisScore: domVal,
        nudge: `awareness leading (net +${domVal.toFixed(1)}). don't let caution become paralysis.`,
      };
    } else {
      return {
        synthesis: "mixed",
        state: "yellow-",
        synthesisScore: Math.abs(domVal),
        nudge: `fear/paralysis (net ${domVal.toFixed(1)}). what are you afraid of specifically?`,
      };
    }
  }

  if (domName === "blue") {
    if (domVal > 0) {
      return {
        synthesis: "mixed",
        state: "blue+",
        synthesisScore: domVal,
        nudge: `analytical leading (net +${domVal.toFixed(1)}). what does this mean to someone?`,
      };
    } else {
      return {
        synthesis: "mixed",
        state: "blue-",
        synthesisScore: Math.abs(domVal),
        nudge: `cold/detached (net ${domVal.toFixed(1)}). who is this for?`,
      };
    }
  }

  // Fallback
  return {
    synthesis: "mixed",
    state: "mixed",
    synthesisScore: Math.abs((red.net + yellow.net + blue.net) / 3),
    nudge: "reading unclear. name what you're feeling.",
  };
}

// ─────────────────────────────────────────────
// Legacy interface (net scores only, for backward compat)
// ─────────────────────────────────────────────

export interface LegacyPrimaryReading {
  red: number;
  yellow: number;
  blue: number;
  synthesis: Synthesis;
  synthesisScore: number;
}

export function analyzePrimariesLegacy(text: string): LegacyPrimaryReading {
  const full = analyzePrimaries(text);
  return {
    red: full.red.net,
    yellow: full.yellow.net,
    blue: full.blue.net,
    synthesis: full.synthesis,
    synthesisScore: full.synthesisScore,
  };
}

// ─────────────────────────────────────────────
// Class interface (for consistency with other modules)
// ─────────────────────────────────────────────

export class Primaries {
  analyze(text: string): PrimaryReading {
    return analyzePrimaries(text);
  }

  analyzeLegacy(text: string): LegacyPrimaryReading {
    return analyzePrimariesLegacy(text);
  }
}
