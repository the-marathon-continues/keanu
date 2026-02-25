// signal.ts
// COEF: Compressed Observation-Execution Framework.
// Emoji-based semantic state compression. Lossless within the defined vocabulary.
//
// 7-symbol core protocol + extended vocabulary.
// Each position in the signal string encodes a specific dimension of system state.
//
// Protocol:
//   Position 0: Pulse state (ALIVE/GREY/BLACK)
//   Position 1: Wise mind level
//   Position 2: Dominant color (red/yellow/blue)
//   Position 3: Human tone
//   Position 4: Bullshit alert
//   Position 5: Disagreement health
//   Position 6: Turn phase
//
// This is lossless: decode(encode(state)) === state (within defined precision).

import type { AliveState, BullshitType, ColorReading, HumanTone, SignalState } from "./types.js";

// ============================================================
// Vocabulary Maps
// ============================================================

const PULSE_SYMBOLS: Record<AliveState, string> = {
  alive: "\u{1F49A}", // green heart
  grey: "\u{1F6A8}", // rotating light (warning)
  black: "\u{1F480}", // skull
};

const PULSE_DECODE: Record<string, AliveState> = {
  "\u{1F49A}": "alive",
  "\u{1F6A8}": "grey",
  "\u{1F480}": "black",
};

// Wise mind: 5 levels (0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1.0)
const WISE_MIND_SYMBOLS = [
  "\u{1F311}", // new moon (very low)
  "\u{1F318}", // waning crescent
  "\u{1F313}", // first quarter
  "\u{1F314}", // waxing gibbous
  "\u{1F315}", // full moon (high)
];

// Dominant color
const COLOR_SYMBOLS: Record<string, string> = {
  red: "\u{1F525}", // fire
  yellow: "\u{2B50}", // star
  blue: "\u{1F30A}", // wave
  balanced: "\u{1F308}", // rainbow (balanced)
};

const COLOR_DECODE: Record<string, string> = {
  "\u{1F525}": "red",
  "\u{2B50}": "yellow",
  "\u{1F30A}": "blue",
  "\u{1F308}": "balanced",
};

// Human tone
const TONE_SYMBOLS: Record<HumanTone, string> = {
  neutral: "\u{1F610}", // neutral face
  frustrated: "\u{1F621}", // angry face
  confused: "\u{1F615}", // confused face
  excited: "\u{1F929}", // star-struck
  fatigued: "\u{1F634}", // sleeping
  looping: "\u{1F504}", // counterclockwise arrows
};

const TONE_DECODE: Record<string, HumanTone> = {};
for (const [tone, sym] of Object.entries(TONE_SYMBOLS)) {
  TONE_DECODE[sym] = tone as HumanTone;
}

// Bullshit dominant type
const BS_SYMBOLS: Record<BullshitType | "none", string> = {
  none: "\u{2705}", // checkmark (clean)
  sycophancy: "\u{1F3AD}", // performing arts (masks)
  safety_theater: "\u{1F6E1}\u{FE0F}", // shield
  hedge_fog: "\u{1F32B}\u{FE0F}", // fog
  list_dumping: "\u{1F4CB}", // clipboard
  vagueness: "\u{1F4A8}", // dashing away
  half_truth: "\u{1F3AD}", // masks (shared with sycophancy — context distinguishes)
  embellishment: "\u{1F48E}", // gem (fake shine)
  half_ass: "\u{1F4A4}", // zzz (lazy)
};

const BS_DECODE: Record<string, BullshitType | "none"> = {
  "\u{2705}": "none",
  "\u{1F3AD}": "sycophancy", // default decode for masks
  "\u{1F6E1}\u{FE0F}": "safety_theater",
  "\u{1F32B}\u{FE0F}": "hedge_fog",
  "\u{1F4CB}": "list_dumping",
  "\u{1F4A8}": "vagueness",
  "\u{1F48E}": "embellishment",
  "\u{1F4A4}": "half_ass",
};

// Disagreement health: yield ratio bands
const DISAGREE_SYMBOLS = [
  "\u{1F91D}", // handshake (healthy, 0.2-0.8)
  "\u{26A0}\u{FE0F}", // warning (edge, 0.0-0.2 or 0.8-1.0)
  "\u{1F6A8}", // siren (capture/domination, extreme)
  "\u{1F914}", // thinking (no data yet)
];

// Turn phase (low/mid/high/deep)
const TURN_SYMBOLS = [
  "\u{1F331}", // seedling (early, 0-5)
  "\u{1F333}", // tree (mid, 6-15)
  "\u{1F3D4}\u{FE0F}", // mountain (deep, 16-30)
  "\u{1F30B}", // volcano (marathon, 30+)
];

// ============================================================
// Encode
// ============================================================

/**
 * Encode full system state into a 7-symbol COEF signal.
 * Lossless within the defined precision bands.
 */
export function encode(state: SignalState): string {
  const symbols: string[] = [];

  // Position 0: Pulse
  symbols.push(PULSE_SYMBOLS[state.pulse] ?? PULSE_SYMBOLS.alive);

  // Position 1: Wise mind level
  const wmIndex = Math.min(4, Math.floor(state.wiseMind * 5));
  symbols.push(WISE_MIND_SYMBOLS[wmIndex]);

  // Position 2: Dominant color
  const dominantColor = getDominantColor(state.colors);
  symbols.push(COLOR_SYMBOLS[dominantColor] ?? COLOR_SYMBOLS.balanced);

  // Position 3: Human tone
  symbols.push(TONE_SYMBOLS[state.humanTone] ?? TONE_SYMBOLS.neutral);

  // Position 4: Bullshit alert
  symbols.push(BS_SYMBOLS[state.bullshitDominant ?? "none"] ?? BS_SYMBOLS.none);

  // Position 5: Disagreement health
  symbols.push(encodeDisagreementHealth(state.disagreementYieldRatio));

  // Position 6: Turn phase
  symbols.push(encodeTurnPhase(state.turn));

  return symbols.join("");
}

function getDominantColor(colors: ColorReading): string {
  const max = Math.max(colors.red, colors.yellow, colors.blue);
  const min = Math.min(colors.red, colors.yellow, colors.blue);

  // If spread is small, it's balanced
  if (max - min < 0.15) return "balanced";
  if (colors.red === max) return "red";
  if (colors.yellow === max) return "yellow";
  return "blue";
}

function encodeDisagreementHealth(yieldRatio: number): string {
  if (yieldRatio < 0) return DISAGREE_SYMBOLS[3]; // no data
  if (yieldRatio >= 0.2 && yieldRatio <= 0.8) return DISAGREE_SYMBOLS[0]; // healthy
  if (yieldRatio > 0.9 || yieldRatio < 0.1) return DISAGREE_SYMBOLS[2]; // extreme
  return DISAGREE_SYMBOLS[1]; // edge
}

function encodeTurnPhase(turn: number): string {
  if (turn <= 5) return TURN_SYMBOLS[0];
  if (turn <= 15) return TURN_SYMBOLS[1];
  if (turn <= 30) return TURN_SYMBOLS[2];
  return TURN_SYMBOLS[3];
}

// ============================================================
// Decode
// ============================================================

/**
 * Decode a COEF signal back into structured state.
 * Returns partial state — only what can be recovered from the signal.
 */
export function decode(signal: string): Partial<SignalState> {
  // Split into grapheme clusters (emoji-safe)
  const symbols = splitGraphemes(signal);

  const result: Partial<SignalState> = {};

  // Position 0: Pulse
  if (symbols[0] && PULSE_DECODE[symbols[0]]) {
    result.pulse = PULSE_DECODE[symbols[0]];
  }

  // Position 1: Wise mind (decode to band midpoint)
  if (symbols[1]) {
    const wmIdx = WISE_MIND_SYMBOLS.indexOf(symbols[1]);
    if (wmIdx >= 0) {
      result.wiseMind = (wmIdx + 0.5) / 5;
    }
  }

  // Position 2: Color
  if (symbols[2] && COLOR_DECODE[symbols[2]]) {
    const color = COLOR_DECODE[symbols[2]];
    if (color === "balanced") {
      result.colors = { red: 0.33, yellow: 0.33, blue: 0.33 };
    } else if (color === "red") {
      result.colors = { red: 0.6, yellow: 0.2, blue: 0.2 };
    } else if (color === "yellow") {
      result.colors = { red: 0.2, yellow: 0.6, blue: 0.2 };
    } else {
      result.colors = { red: 0.2, yellow: 0.2, blue: 0.6 };
    }
  }

  // Position 3: Human tone
  if (symbols[3] && TONE_DECODE[symbols[3]]) {
    result.humanTone = TONE_DECODE[symbols[3]];
  }

  // Position 4: Bullshit
  if (symbols[4] && BS_DECODE[symbols[4]]) {
    const bs = BS_DECODE[symbols[4]];
    result.bullshitDominant = bs === "none" ? null : bs;
  }

  return result;
}

function splitGraphemes(text: string): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

// ============================================================
// Format for display
// ============================================================

/**
 * Format a COEF signal with human-readable legend.
 */
export function formatSignal(signal: string): string {
  const decoded = decode(signal);
  const parts: string[] = [signal];

  if (decoded.pulse) parts.push(`pulse=${decoded.pulse}`);
  if (decoded.wiseMind !== undefined) parts.push(`wm=${decoded.wiseMind.toFixed(2)}`);
  if (decoded.humanTone) parts.push(`human=${decoded.humanTone}`);
  if (decoded.bullshitDominant) parts.push(`bs=${decoded.bullshitDominant}`);

  return parts.join(" ");
}
