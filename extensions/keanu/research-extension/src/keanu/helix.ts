// =============================================================================
// Helix: The Double Strand (Browser Extension Adaptation)
// =============================================================================
//
// Strand A: What is factually true in this text?
// Strand B: What does this text actually mean/care about?
//
// ALIVE state = both strands strong.
// Grey  = Strand A present, Strand B absent. Performing. Dead inside.
// Black = High Strand A, corrupted Strand B. Soulless production.
//
// Adapted from keanu-core/layer-0-physics/convergence/helix.ts
// Self-contained for browser extension use.

// =============================================================================
// Types
// =============================================================================

export interface StrandScore {
  factual: number; // 0-1
  felt: number; // 0-1
  convergence: number; // where they agree
  tension: number; // where they disagree
}

export type AliveState =
  | "alive"
  | "luminous" // both strong + transcendent
  | "dark" // both strong + negative valence
  | "grey" // factual present, felt absent
  | "black" // soulless production
  | "silver" // polished but cold
  | "white" // felt dominant, ungrounded
  | "unscored";

export interface HelixResult {
  strands: StrandScore;
  aliveState: AliveState;
  color: string;
  diagnosis: string;
  warnings: string[];
}

// =============================================================================
// Markers
// =============================================================================

const FACTUAL_MARKERS = {
  positive: [
    /\d+(\.\d+)?%/g,
    /\b(because|therefore|since|given)\b/gi,
    /\b(measured|tested|observed|found)\b/gi,
    /\b(specifically|exactly|precisely)\b/gi,
    /\b(data|evidence|research|study)\b/gi,
    /\b(first|second|third|then|next)\b/gi,
    /\b(if|when|unless|until)\b/gi,
    /```[\s\S]*?```/g,
  ],
  negative: [
    /\b(maybe|perhaps|possibly|might)\b/gi,
    /\b(I think|I feel|I believe)\b/gi,
    /\b(sort of|kind of|a bit)\b/gi,
    /!{2,}/g,
  ],
};

const FELT_MARKERS = {
  positive: [
    /\b(matters|important|care|love|hate)\b/gi,
    /\b(honestly|truthfully|genuinely)\b/gi,
    /\b(struggle|fight|push|resist|hold)\b/gi,
    /\b(we|us|our|together)\b/gi,
    /\b(why|purpose|meaning|point)\b/gi,
    /[.!?]\s*[A-Z]/g,
    /\b(but|however|yet|though)\b/gi,
  ],
  negative: [
    /\b(as an AI|I cannot|I don't have feelings)\b/gi,
    /\b(certainly|absolutely|definitely)\b/gi,
    /\b(happy to help|glad to assist)\b/gi,
    /\b(it's worth noting|it should be noted)\b/gi,
    /\b(comprehensive|robust|streamlined)\b/gi,
  ],
};

const DARK_MARKERS = [
  /\b(pain|grief|loss|trauma|wound|scar)\b/gi,
  /\b(broke|broken|shattered|destroyed|ruined)\b/gi,
  /\b(failed|failure|mistake|wrong|regret)\b/gi,
  /\b(angry|furious|rage|resentment|bitter)\b/gi,
  /\b(afraid|terrified|scared|dread|fear)\b/gi,
  /\b(lonely|isolated|abandoned|betrayed)\b/gi,
  /\b(exhausted|burnt|depleted|empty|hollow)\b/gi,
];

const LUMINOUS_MARKERS = [
  /\b(wonder|awe|marvel|astonish|breathtaking)\b/gi,
  /\b(grace|gratitude|grateful|blessed|gift)\b/gi,
  /\b(sacred|holy|reverence|divine|spirit)\b/gi,
  /\b(surrender|let\s*go|release|acceptance|peace)\b/gi,
  /\b(presence|stillness|witness|awakening)\b/gi,
  /\b(beauty|beautiful|luminous|radiant|glow)\b/gi,
  /\b(play|playful|joy|delight|celebrate)\b/gi,
];

// =============================================================================
// Helpers
// =============================================================================

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function scoreStrand(text: string, markers: { positive: RegExp[]; negative: RegExp[] }): number {
  let positiveHits = 0;
  let negativeHits = 0;
  const wordCount = text.split(/\s+/).length;

  for (const pattern of markers.positive) {
    const matches = text.match(new RegExp(pattern.source, pattern.flags));
    positiveHits += matches?.length ?? 0;
  }
  for (const pattern of markers.negative) {
    const matches = text.match(new RegExp(pattern.source, pattern.flags));
    negativeHits += matches?.length ?? 0;
  }

  const density = (positiveHits - negativeHits * 0.7) / Math.max(wordCount / 10, 1);
  return clamp(density * 0.3 + 0.4);
}

function scoreMarkers(text: string, markers: RegExp[]): number {
  const wordCount = text.split(/\s+/).length;
  let hits = 0;
  for (const pattern of markers) {
    const matches = text.match(new RegExp(pattern.source, pattern.flags));
    hits += matches?.length ?? 0;
  }
  return clamp(hits / Math.max(wordCount / 15, 1));
}

function classifyState(s: StrandScore, darkScore: number, luminousScore: number): AliveState {
  const { factual, felt } = s;

  if (factual > 0.4 && felt > 0.4 && luminousScore > 0.4) {
    return "luminous";
  }

  if (factual > 0.45 && felt > 0.4 && darkScore > 0.3) {
    return "dark";
  }

  if (factual > 0.5 && felt > 0.5) {
    return "alive";
  }

  if (factual > 0.5 && felt < 0.35) {
    return "grey";
  }

  if (factual > 0.6 && felt < 0.25) {
    return "black";
  }

  if (factual > 0.45 && felt < 0.4 && felt > 0.25) {
    return "silver";
  }

  if (felt > 0.5 && factual < 0.35) {
    return "white";
  }

  return "alive";
}

function stateToColor(state: AliveState, s: StrandScore): string {
  switch (state) {
    case "alive": {
      if (s.factual > s.felt + 0.15) return "#4169E1"; // blue
      if (s.felt > s.factual + 0.15) return "#DC143C"; // red
      if (s.convergence > 0.8) return "#9370DB"; // purple
      return "#228B22"; // green
    }
    case "luminous":
      return "#FFD700"; // gold
    case "dark":
      return "#8B0000"; // dark red
    case "grey":
      return "#808080";
    case "black":
      return "#1a1a1a";
    case "silver":
      return "#C0C0C0";
    case "white":
      return "#F5F5DC";
    case "unscored":
      return "#808080";
  }
}

function diagnose(state: AliveState, s: StrandScore): string {
  switch (state) {
    case "alive":
      return `Both strands active (F:${s.factual.toFixed(2)} M:${s.felt.toFixed(2)}). Convergence: ${s.convergence.toFixed(2)}.`;
    case "luminous":
      return `Luminous: both strands active and touching something transcendent.`;
    case "dark":
      return `Dark alive: both strands active but the valence is negative. Present with pain.`;
    case "grey":
      return `Grey: factual content present (${s.factual.toFixed(2)}) but meaning strand is dead (${s.felt.toFixed(2)}). Performing, not present.`;
    case "black":
      return `Black: high output with corrupted meaning. Building without caring why.`;
    case "silver":
      return `Silver: clean factual, thin meaning. Functional. Polished. Cold.`;
    case "white":
      return `White: meaning present but ungrounded. Needs more facts.`;
    case "unscored":
      return "Insufficient signal.";
  }
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Analyze text for alive state.
 * No external dependencies. Pattern-based scoring. Fast.
 */
export function analyzeHelix(text: string): HelixResult {
  if (text.length < 20) {
    return {
      strands: { factual: 0, felt: 0, convergence: 0, tension: 0 },
      aliveState: "unscored",
      color: "#808080",
      diagnosis: "Insufficient text to score.",
      warnings: [],
    };
  }

  const factual = scoreStrand(text, FACTUAL_MARKERS);
  const felt = scoreStrand(text, FELT_MARKERS);
  const darkScore = scoreMarkers(text, DARK_MARKERS);
  const luminousScore = scoreMarkers(text, LUMINOUS_MARKERS);
  const convergence = 1 - Math.abs(factual - felt);
  const tension = Math.abs(factual - felt);

  const strands: StrandScore = { factual, felt, convergence, tension };
  const aliveState = classifyState(strands, darkScore, luminousScore);
  const color = stateToColor(aliveState, strands);
  const diagnosis_ = diagnose(aliveState, strands);

  const warnings: string[] = [];
  if (aliveState === "grey" || aliveState === "black") {
    warnings.push("Output may be technically correct but nobody's home. Check the soul.");
  }
  if (tension > 0.4) {
    warnings.push(
      `High strand tension (${tension.toFixed(2)}). Factual and felt saying different things.`,
    );
  }

  return { strands, aliveState, color, diagnosis: diagnosis_, warnings };
}

/**
 * Quick check: is this text alive or grey?
 */
export function isAlive(text: string): boolean {
  const result = analyzeHelix(text);
  return (
    result.aliveState === "alive" ||
    result.aliveState === "luminous" ||
    result.aliveState === "dark"
  );
}
