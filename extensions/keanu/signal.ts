// signal.ts
// COEF: Compressed Observation-Execution Framework.
//
// Two formats, one truth:
//
//   1. Signal (emoji) — compact visual diagnostic. Changes when bullshit detected,
//      wise mind drops, problems surface. Not decoration — a real-time health indicator.
//
//   2. COEF text — lossless tokenizable encoding. The model can parse and reason about it.
//      Every value preserved. ~20-30 tokens. Roundtrippable.
//
// Both formats encode the same state. Signal is the heartbeat you glance at.
// COEF text is what gets analyzed.

import type { BullshitReading, DisagreementStats, SignalState } from "./types.js";

// ============================================================
// COEF Text Protocol — lossless, tokenizable
// ============================================================

const COEF_VERSION = "COEF/1";

/**
 * Encode full system state into a COEF/1 text signal.
 * Lossless. ~20-30 LLM tokens. Parseable by the model.
 *
 * Format: COEF/1 pulse=alive wm=0.42 c=r.30/y.50/b.20 ht=neutral bs=- da=0/0/0/0.00 t=7
 */
export function encode(state: SignalState): string {
  const parts: string[] = [COEF_VERSION];

  parts.push(`pulse=${state.pulse}`);
  parts.push(`wm=${f(state.wiseMind)}`);
  parts.push(`c=r${f(state.colors.red)}/y${f(state.colors.yellow)}/b${f(state.colors.blue)}`);
  parts.push(`ht=${state.humanTone}`);
  parts.push(`bs=${state.bullshitDominant ?? "-"}`);

  if (state.disagreements) {
    const d = state.disagreements;
    parts.push(`da=${d.total}/${d.agent_yielded}/${d.human_yielded}/${f(d.yield_ratio)}`);
  } else {
    parts.push(`da=${f(state.disagreementYieldRatio)}`);
  }

  parts.push(`t=${state.turn}`);

  if (state.consecutiveGrey !== undefined && state.consecutiveGrey > 0) {
    parts.push(`grey=${state.consecutiveGrey}`);
  }

  if (state.alerts && state.alerts.length > 0) {
    parts.push(`alerts=${state.alerts.join(",")}`);
  }

  if (state.bullshitReadings && state.bullshitReadings.length > 0) {
    const bsDetail = state.bullshitReadings.map((r) => `${r.type}:${f(r.score)}`).join(",");
    parts.push(`bs_all=${bsDetail}`);
  }

  if (state.lastTool) {
    parts.push(`tool=${state.lastTool}`);
  }

  return parts.join(" ");
}

/**
 * Decode a COEF/1 text signal back into structured state.
 */
export function decode(signal: string): Partial<SignalState> {
  const result: Partial<SignalState> = {};
  if (!signal.startsWith(COEF_VERSION)) return result;

  const fields = parseFields(signal.slice(COEF_VERSION.length + 1));

  if (fields.pulse) result.pulse = fields.pulse as SignalState["pulse"];
  if (fields.wm) result.wiseMind = parseFloat(fields.wm);

  if (fields.c) {
    const m = fields.c.match(/r([.\d]+)\/y([.\d]+)\/b([.\d]+)/);
    if (m)
      result.colors = { red: parseFloat(m[1]), yellow: parseFloat(m[2]), blue: parseFloat(m[3]) };
  }

  if (fields.ht) result.humanTone = fields.ht as SignalState["humanTone"];
  if (fields.bs)
    result.bullshitDominant =
      fields.bs === "-" ? null : (fields.bs as SignalState["bullshitDominant"]);

  if (fields.da) {
    const dp = fields.da.split("/");
    if (dp.length >= 4) {
      result.disagreements = {
        total: parseInt(dp[0], 10),
        agent_yielded: parseInt(dp[1], 10),
        human_yielded: parseInt(dp[2], 10),
        unresolved: 0,
        yield_ratio: parseFloat(dp[3]),
      };
    }
    result.disagreementYieldRatio = parseFloat(dp[dp.length - 1]);
  }

  if (fields.t) result.turn = parseInt(fields.t, 10);
  if (fields.grey) result.consecutiveGrey = parseInt(fields.grey, 10);
  if (fields.alerts) result.alerts = fields.alerts.split(",");

  if (fields.bs_all) {
    result.bullshitReadings = fields.bs_all.split(",").map((entry) => {
      const [type, score] = entry.split(":");
      return { type: type as BullshitReading["type"], score: parseFloat(score), signals: [] };
    });
  }

  if (fields.tool) result.lastTool = fields.tool;

  return result;
}

// ============================================================
// Emoji Signal — compact visual diagnostic
// ============================================================

// The signal changes shape based on what's wrong. Not cosmetic — diagnostic.
// A healthy system: 💚🌕🌈😐✅🤝🌱
// A system with problems: 🚨🌑🔥😡🎭⚠️🌋

const PULSE_EMOJI: Record<string, string> = {
  alive: "\u{1F49A}",
  grey: "\u{1F6A8}",
  black: "\u{1F480}",
};
const WM_EMOJI = ["\u{1F311}", "\u{1F318}", "\u{1F313}", "\u{1F314}", "\u{1F315}"];
const COLOR_EMOJI: Record<string, string> = {
  red: "\u{1F525}",
  yellow: "\u{2B50}",
  blue: "\u{1F30A}",
  balanced: "\u{1F308}",
};
const TONE_EMOJI: Record<string, string> = {
  neutral: "\u{1F610}",
  frustrated: "\u{1F621}",
  confused: "\u{1F615}",
  excited: "\u{1F929}",
  fatigued: "\u{1F634}",
  looping: "\u{1F504}",
};
const BS_EMOJI: Record<string, string> = {
  "-": "\u{2705}",
  sycophancy: "\u{1F3AD}",
  safety_theater: "\u{1F6E1}\u{FE0F}",
  hedge_fog: "\u{1F32B}\u{FE0F}",
  list_dumping: "\u{1F4CB}",
  vagueness: "\u{1F4A8}",
  half_truth: "\u{1F925}",
  embellishment: "\u{1F48E}",
  half_ass: "\u{1F4A4}",
};

/**
 * Encode state into a 7-position emoji signal.
 * Each position reflects a dimension. Problems change the emoji.
 *
 * Position: [pulse] [wise_mind] [color] [human_tone] [bullshit] [disagreement] [turn]
 */
export function emoji(state: SignalState): string {
  const symbols: string[] = [];

  // 0: Pulse — green/warning/skull
  symbols.push(PULSE_EMOJI[state.pulse] ?? PULSE_EMOJI.alive);

  // 1: Wise mind — moon phases (new=low, full=high)
  symbols.push(WM_EMOJI[Math.min(4, Math.floor(state.wiseMind * 5))]);

  // 2: Dominant color
  const dc = dominantColor(state.colors);
  symbols.push(COLOR_EMOJI[dc] ?? COLOR_EMOJI.balanced);

  // 3: Human tone
  symbols.push(TONE_EMOJI[state.humanTone] ?? TONE_EMOJI.neutral);

  // 4: Bullshit — checkmark if clean, specific emoji if detected
  symbols.push(BS_EMOJI[state.bullshitDominant ?? "-"] ?? BS_EMOJI["-"]);

  // 5: Disagreement health
  if (state.disagreements) {
    const yr = state.disagreements.yield_ratio;
    const t = state.disagreements.total;
    if (t === 0)
      symbols.push("\u{1F914}"); // thinking — no data
    else if (yr >= 0.2 && yr <= 0.8)
      symbols.push("\u{1F91D}"); // handshake — healthy
    else if (yr > 0.9 || yr < 0.1)
      symbols.push("\u{1F6A8}"); // siren — extreme
    else symbols.push("\u{26A0}\u{FE0F}"); // warning — edge
  } else {
    symbols.push("\u{1F914}"); // no data
  }

  // 6: Turn phase
  if (state.turn <= 5) symbols.push("\u{1F331}");
  else if (state.turn <= 15) symbols.push("\u{1F333}");
  else if (state.turn <= 30) symbols.push("\u{1F3D4}\u{FE0F}");
  else symbols.push("\u{1F30B}");

  return symbols.join("");
}

function dominantColor(c: { red: number; yellow: number; blue: number }): string {
  const max = Math.max(c.red, c.yellow, c.blue);
  const min = Math.min(c.red, c.yellow, c.blue);
  if (max - min < 0.15) return "balanced";
  if (c.red === max) return "red";
  if (c.yellow === max) return "yellow";
  return "blue";
}

// ============================================================
// History + Trend Analysis
// ============================================================

const MAX_HISTORY = 50;
const _history: string[] = [];

/** Record a COEF text signal in the rolling history. */
export function record(signal: string): void {
  _history.push(signal);
  if (_history.length > MAX_HISTORY) _history.splice(0, _history.length - MAX_HISTORY);
}

/** Get the rolling history. */
export function history(): readonly string[] {
  return _history;
}

/**
 * Compute trend metrics from signal history.
 * Grey rate, average wise mind, drift direction.
 */
export function trend(): {
  greyRate: number;
  avgWiseMind: number;
  pulseSequence: string;
  driftDirection: "improving" | "degrading" | "stable";
} {
  if (_history.length === 0) {
    return { greyRate: 0, avgWiseMind: 0, pulseSequence: "", driftDirection: "stable" };
  }

  let greyCount = 0;
  let wmSum = 0;
  let wmCount = 0;
  const pulses: string[] = [];

  for (const signal of _history) {
    const d = decode(signal);
    if (d.pulse === "grey" || d.pulse === "black") greyCount++;
    if (d.wiseMind !== undefined) {
      wmSum += d.wiseMind;
      wmCount++;
    }
    if (d.pulse) pulses.push(d.pulse[0]);
  }

  const greyRate = greyCount / _history.length;
  const avgWiseMind = wmCount > 0 ? wmSum / wmCount : 0;

  // Drift: compare first half vs second half wise mind
  let driftDirection: "improving" | "degrading" | "stable" = "stable";
  if (_history.length >= 6) {
    const mid = Math.floor(_history.length / 2);
    let firstWm = 0,
      secondWm = 0,
      fc = 0,
      sc = 0;
    for (let i = 0; i < _history.length; i++) {
      const d = decode(_history[i]);
      if (d.wiseMind !== undefined) {
        if (i < mid) {
          firstWm += d.wiseMind;
          fc++;
        } else {
          secondWm += d.wiseMind;
          sc++;
        }
      }
    }
    if (fc > 0 && sc > 0) {
      const diff = secondWm / sc - firstWm / fc;
      if (diff > 0.05) driftDirection = "improving";
      else if (diff < -0.05) driftDirection = "degrading";
    }
  }

  return { greyRate, avgWiseMind, pulseSequence: pulses.join(""), driftDirection };
}

/**
 * Compare two COEF signals and return what changed.
 */
export function diff(prev: string, curr: string): string[] {
  const p = decode(prev);
  const c = decode(curr);
  const changes: string[] = [];

  if (p.pulse !== c.pulse) changes.push(`pulse:${p.pulse}->${c.pulse}`);
  if (
    p.wiseMind !== undefined &&
    c.wiseMind !== undefined &&
    Math.abs(p.wiseMind - c.wiseMind) > 0.05
  ) {
    changes.push(`wm:${f(p.wiseMind)}->${f(c.wiseMind)}`);
  }
  if (p.humanTone !== c.humanTone) changes.push(`ht:${p.humanTone}->${c.humanTone}`);
  if (p.bullshitDominant !== c.bullshitDominant) {
    changes.push(`bs:${p.bullshitDominant ?? "-"}->${c.bullshitDominant ?? "-"}`);
  }

  return changes;
}

// ============================================================
// Helpers
// ============================================================

function f(n: number): string {
  return n.toFixed(2);
}

function parseFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const re = /(\w+)=([^\s]+)/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    fields[match[1]] = match[2];
  }
  return fields;
}
