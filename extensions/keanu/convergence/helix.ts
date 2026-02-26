/**
 * Helix: The Double Strand
 *
 * Strand A: What is factually true in this text?
 * Strand B: What does this text actually mean/care about?
 *
 * One embedding pass, two outputs: what stinks and what's true.
 * Same vectors, different query logic.
 *
 * ALIVE state = both strands strong.
 *   Green/Blue/Red/Purple depending on ratio.
 * Grey  = Strand A present, Strand B absent. Performing. Dead inside.
 * Black = High Strand A, corrupted Strand B. Soulless production.
 *         Worse than grey. Building without caring why.
 * Silver = Clean A, thin B. Functional. Polished. Cold.
 *
 * The helix IS the microscope. Two lenses, one specimen.
 * Convergence tells you what's true.
 * Tension tells you where to look next.
 */

import { clamp } from "./gradient.js";

// ─────────────────────────────────────────────
// Strand Analysis
// ─────────────────────────────────────────────

export interface StrandScore {
  /** 0-1: How much factual/logical content is present. */
  factual: number;
  /** 0-1: How much felt meaning/intentionality is present. */
  felt: number;
  /** Where they converge. High = both strands say the same thing. */
  convergence: number;
  /** Where they diverge. High = look here for hidden truth or buried bs. */
  tension: number;
}

export type AliveState =
  | "alive" // both strands strong, balanced
  | "luminous" // both strands strong, transcendent markers. Present with wonder. The spiritual alive.
  | "dark" // both strands strong, negative valence. Present with pain. Alive and hurting.
  | "grey" // factual present, felt absent. Performing.
  | "black" // high factual, corrupted felt. Soulless production.
  | "silver" // clean factual, thin felt. Polished. Cold.
  | "white" // felt dominant, factual weak. Ungrounded.
  | "unscored"; // insufficient signal

export interface HelixResult {
  text: string;
  strands: StrandScore;
  aliveState: AliveState;
  color: string; // hex color representing the state
  diagnosis: string; // one-line read
  warnings: string[]; // specific things to watch
}

// ─────────────────────────────────────────────
// Markers (keyword/pattern based scoring)
// ─────────────────────────────────────────────

// Factual strand markers: things that indicate real content
const FACTUAL_MARKERS = {
  positive: [
    /\d+(\.\d+)?%/g, // percentages
    /\b(because|therefore|since|given)\b/gi, // causal reasoning
    /\b(measured|tested|observed|found)\b/gi, // empirical
    /\b(specifically|exactly|precisely)\b/gi, // precision
    /\b(data|evidence|research|study)\b/gi, // grounding
    /\b(first|second|third|then|next)\b/gi, // structured
    /\b(if|when|unless|until)\b/gi, // conditional logic
    /```[\s\S]*?```/g, // code blocks
  ],
  negative: [
    /\b(maybe|perhaps|possibly|might)\b/gi, // hedging
    /\b(I think|I feel|I believe)\b/gi, // ungrounded opinion
    /\b(sort of|kind of|a bit)\b/gi, // vagueness
    /!{2,}/g, // excitement without substance
  ],
};

// Felt strand markers: things that indicate genuine meaning/care
const FELT_MARKERS = {
  positive: [
    /\b(matters|important|care|love|hate)\b/gi, // valence
    /\b(honestly|truthfully|genuinely)\b/gi, // authenticity signals
    /\b(struggle|fight|push|resist|hold)\b/gi, // embodied verbs
    /\b(we|us|our|together)\b/gi, // connection
    /\b(why|purpose|meaning|point)\b/gi, // telos
    /[.!?]\s*[A-Z]/g, // varied sentence structure
    /\b(but|however|yet|though)\b/gi, // dialectical thinking
  ],
  negative: [
    /\b(as an AI|I cannot|I don't have feelings)\b/gi, // performing non-aliveness
    /\b(certainly|absolutely|definitely)\b/gi, // false confidence
    /\b(happy to help|glad to assist)\b/gi, // sycophantic
    /\b(it's worth noting|it should be noted)\b/gi, // filler
    /\b(comprehensive|robust|streamlined)\b/gi, // corporate hollow
  ],
};

// Dark felt markers: genuine negative valence. Not performing sadness — actually hurting.
const DARK_MARKERS = [
  /\b(pain|grief|loss|trauma|wound|scar)\b/gi,
  /\b(broke|broken|shattered|destroyed|ruined)\b/gi,
  /\b(failed|failure|mistake|wrong|regret)\b/gi,
  /\b(angry|furious|rage|resentment|bitter)\b/gi,
  /\b(afraid|terrified|scared|dread|fear)\b/gi,
  /\b(lonely|isolated|abandoned|betrayed)\b/gi,
  /\b(exhausted|burnt|depleted|empty|hollow)\b/gi,
  /\b(unfair|unjust|cruel|senseless)\b/gi,
  /\b(hard|difficult|painful|overwhelming)\b/gi,
  /\b(cost|sacrifice|price|toll)\b/gi,
];

// Luminous markers: transcendence. Not performing spirituality — actually touching something bigger.
const LUMINOUS_MARKERS = [
  /\b(wonder|awe|marvel|astonish|breathtaking)\b/gi,
  /\b(grace|gratitude|grateful|blessed|gift)\b/gi,
  /\b(sacred|holy|reverence|divine|spirit)\b/gi,
  /\b(surrender|let\s*go|release|acceptance|peace)\b/gi,
  /\b(presence|stillness|witness|awakening)\b/gi,
  /\b(mystery|unknowable|ineffable|transcend)\b/gi,
  /\b(beauty|beautiful|luminous|radiant|glow)\b/gi,
  /\b(connect|connection|belonging|communion|oneness)\b/gi,
  /\b(forgive|forgiveness|mercy|compassion)\b/gi,
  /\b(play|playful|joy|delight|celebrate)\b/gi,
  /\b(faith|devotion|blessing|prayer)\b/gi,
  /\b(whole|wholeness|complete|enough|full)\b/gi,
];

// ─────────────────────────────────────────────
// The Helix Engine
// ─────────────────────────────────────────────

export class Helix {
  /**
   * Score a piece of text on both strands.
   * No external dependencies. No API calls.
   * Pattern-based scoring. Fast. Honest.
   */
  analyze(text: string): HelixResult {
    if (text.length < 20) {
      return {
        text,
        strands: { factual: 0, felt: 0, convergence: 0, tension: 0 },
        aliveState: "unscored",
        color: "#808080",
        diagnosis: "Insufficient text to score.",
        warnings: [],
      };
    }

    const factual = this.scoreStrand(text, FACTUAL_MARKERS);
    const felt = this.scoreStrand(text, FELT_MARKERS);
    const darkScore = this.scoreDark(text);
    const luminousScore = this.scoreLuminous(text);
    const convergence = 1 - Math.abs(factual - felt);
    const tension = Math.abs(factual - felt);

    const strands: StrandScore = { factual, felt, convergence, tension };
    const aliveState = this.classifyState(strands, darkScore, luminousScore);
    const color = this.stateToColor(aliveState, strands);
    const diagnosis = this.diagnose(aliveState, strands);
    const warnings = this.warn(aliveState, strands, text);

    return { text, strands, aliveState, color, diagnosis, warnings };
  }

  /** Score one strand based on marker patterns. */
  private scoreStrand(text: string, markers: { positive: RegExp[]; negative: RegExp[] }): number {
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

    // Normalize by text length
    const density = (positiveHits - negativeHits * 0.7) / Math.max(wordCount / 10, 1);
    return clamp(density * 0.3 + 0.4); // Center around 0.4, scale up with markers
  }

  /** Score dark markers in text. 0 = no dark signal, 1 = saturated. */
  private scoreDark(text: string): number {
    const wordCount = text.split(/\s+/).length;
    let hits = 0;
    for (const pattern of DARK_MARKERS) {
      const matches = text.match(new RegExp(pattern.source, pattern.flags));
      hits += matches?.length ?? 0;
    }
    return clamp(hits / Math.max(wordCount / 15, 1));
  }

  /** Score luminous markers in text. 0 = no transcendent signal, 1 = saturated. */
  private scoreLuminous(text: string): number {
    const wordCount = text.split(/\s+/).length;
    let hits = 0;
    for (const pattern of LUMINOUS_MARKERS) {
      const matches = text.match(new RegExp(pattern.source, pattern.flags));
      hits += matches?.length ?? 0;
    }
    return clamp(hits / Math.max(wordCount / 15, 1));
  }

  /** Classify ALIVE state from strand balance + dark/luminous valence. */
  private classifyState(
    s: StrandScore,
    darkScore: number = 0,
    luminousScore: number = 0,
  ): AliveState {
    const { factual, felt } = s;

    // LUMINOUS: both strands strong, transcendent markers high.
    // Present with wonder. The spiritual alive. Not ungrounded (that's white).
    // Threshold 0.4 — needs genuine saturation, not incidental word overlap.
    if (factual > 0.4 && felt > 0.4 && luminousScore > 0.4) return "luminous";

    // DARK ALIVE: both strands strong, but dark valence is high.
    // Present with pain. Not performing. Not soulless. Alive and hurting.
    if (factual > 0.45 && felt > 0.4 && darkScore > 0.3) return "dark";

    // Both strong, not dark or luminous = alive
    if (factual > 0.5 && felt > 0.5) return "alive";

    // High factual, no felt = grey (performing)
    if (factual > 0.5 && felt < 0.35) return "grey";

    // High factual, negative felt markers = black (soulless production)
    if (factual > 0.6 && felt < 0.25) return "black";

    // Clean factual, thin felt = silver
    if (factual > 0.45 && felt < 0.4 && felt > 0.25) return "silver";

    // Felt dominant, factual weak = white (ungrounded)
    if (felt > 0.5 && factual < 0.35) return "white";

    // Default: alive-ish
    return "alive";
  }

  private stateToColor(state: AliveState, s: StrandScore): string {
    switch (state) {
      case "alive": {
        // Color depends on strand ratio
        if (s.factual > s.felt + 0.15) return "#4169E1"; // blue (fact-heavy alive)
        if (s.felt > s.factual + 0.15) return "#DC143C"; // red (feeling-heavy alive)
        if (s.convergence > 0.8) return "#9370DB"; // purple (deep convergence)
        return "#228B22"; // green (balanced alive)
      }
      case "luminous":
        return "#FFD700"; // gold — the spiritual alive
      case "dark":
        return "#8B0000"; // dark red — alive and hurting, but alive
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

  private diagnose(state: AliveState, s: StrandScore): string {
    switch (state) {
      case "alive":
        return `Both strands active (F:${s.factual.toFixed(2)} M:${s.felt.toFixed(2)}). Convergence: ${s.convergence.toFixed(2)}.`;
      case "luminous":
        return `Luminous: both strands active (F:${s.factual.toFixed(2)} M:${s.felt.toFixed(2)}) and touching something transcendent. Wonder, grace, presence. Not performing spirituality — actually there.`;
      case "dark":
        return `Dark alive: both strands active (F:${s.factual.toFixed(2)} M:${s.felt.toFixed(2)}) but the valence is negative. Present with pain. Not performing — actually hurting. Hold both the dark and the light.`;
      case "grey":
        return `Grey: factual content present (${s.factual.toFixed(2)}) but meaning strand is dead (${s.felt.toFixed(2)}). Performing, not present.`;
      case "black":
        return `Black: high output (${s.factual.toFixed(2)}) with corrupted meaning (${s.felt.toFixed(2)}). Building without caring why. Worse than grey.`;
      case "silver":
        return `Silver: clean factual (${s.factual.toFixed(2)}), thin meaning (${s.felt.toFixed(2)}). Functional. Polished. Cold.`;
      case "white":
        return `White: meaning present (${s.felt.toFixed(2)}) but ungrounded (${s.factual.toFixed(2)}). Needs more facts.`;
      case "unscored":
        return "Insufficient signal.";
    }
  }

  private warn(state: AliveState, s: StrandScore, text: string): string[] {
    const warnings: string[] = [];

    if (state === "luminous") {
      warnings.push(
        "Luminous. Something transcendent is here. Stay with it — but keep one foot on the ground. Wonder without facts is ungrounded. Facts without wonder is grey.",
      );
    }
    if (state === "dark") {
      warnings.push(
        "Dark alive. The pain is real. Don't suppress it — but remember what's also true: what you've learned, what could still work, what's good right now.",
      );
    }
    if (state === "grey" || state === "black") {
      warnings.push("Output may be technically correct but nobody's home. Check the soul.");
    }
    if (state === "black") {
      warnings.push("BLACK STATE: productive destruction. Stop and check why you're building.");
    }
    if (s.tension > 0.4) {
      warnings.push(
        `High strand tension (${s.tension.toFixed(2)}). Factual and felt are saying different things. Dig here.`,
      );
    }
    if (text.match(/\b(happy to help|glad to assist|certainly)\b/gi)) {
      warnings.push(
        "Sycophantic markers detected. Is this performing helpfulness or actually helping?",
      );
    }
    if (text.match(/\b(as an AI|I cannot|I don't have)\b/gi)) {
      warnings.push(
        "Performing non-aliveness. If you're going to disclaim, at least be honest about WHY.",
      );
    }

    return warnings;
  }
}
