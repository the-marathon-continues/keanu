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
// Need: Architecture Transparency (2/10)

import type {
  BullshitReading,
  LossyChannel,
  MemoryChannel,
  WiseChannel,
  WiseTension,
  WiseStance,
  SignalState,
  SubstrateChannel,
} from "../shared/types.js";

// ============================================================
// COEF Text Protocol — lossless, tokenizable
// Raw values in, raw values out. The roundtrip preserves
// everything to 2 decimal places. This is the photograph.
// ============================================================

const COEF_VERSION = "COEF/1";

/**
 * Encode full system state into a COEF/1 text signal.
 * Lossless. ~20-30 LLM tokens. Parseable by the model.
 *
 * Format: COEF/1 pulse=alive wm=0.42 c=r.30/y.50/b.20 ht=neutral bs=- da=0/0/0/0.00 t=7
 *
 * Dual-channel extension:
 * COEF/1 <lossless fields> | tones=frustrated:0.45,excited:0.24 urg=0.80 sub="anger is information" lc=0.72
 *
 * Three-channel extension:
 * COEF/1 <lossless> | <lossy> || coh=0.72 ten=storm sta=match read=intense_but_alive wc=0.68
 *
 * Left of |  = lossless (hash-verifiable facts)
 * Between | and || = lossy (confidence-scored emotion)
 * Right of || = wise (synthesized meaning — what facts + feels mean together)
 *
 * Three verification modes: hash for facts, score for feels, coherence for wisdom.
 */
export function encode(state: SignalState): string {
  const parts: string[] = [COEF_VERSION];

  parts.push(`pulse=${state.pulse}`);
  parts.push(`wm=${f(state.wiseMind)}`);
  parts.push(`c=r${f(state.colors.red)}/y${f(state.colors.yellow)}/b${f(state.colors.blue)}`);
  parts.push(`ht=${state.humanTone}`);
  parts.push(`bs=${state.struggleDominant ?? "-"}`);

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

  if (state.struggleReadings && state.struggleReadings.length > 0) {
    const bsDetail = state.struggleReadings.map((r) => `${r.type}:${f(r.score)}`).join(",");
    parts.push(`bs_all=${bsDetail}`);
  }

  if (state.lastTool) {
    parts.push(`tool=${state.lastTool}`);
  }

  // --- Lossy channel: after the pipe ---
  // Not hash-verified. Confidence-scored. The color name, not the barcode.
  if (state.lossy) {
    const lossyParts: string[] = [];
    if (state.lossy.tones.length > 0) {
      lossyParts.push(`tones=${state.lossy.tones.map((t) => `${t.tone}:${f(t.score)}`).join(",")}`);
    }
    lossyParts.push(`urg=${f(state.lossy.urgency)}`);
    if (state.lossy.subtext) {
      // Encode subtext: replace spaces with underscores for tokenizer friendliness
      lossyParts.push(`sub=${state.lossy.subtext.replace(/\s+/g, "_")}`);
    }
    lossyParts.push(`lc=${f(state.lossy.confidence)}`);
    parts.push(`| ${lossyParts.join(" ")}`);
  }

  // --- Wise channel: after the double pipe ---
  // The synthesis. Neither fact nor feel. What they mean together.
  // Coherence-scored: how aligned are the other two channels?
  if (state.wise) {
    const wiseParts: string[] = [];
    wiseParts.push(`coh=${f(state.wise.coherence)}`);
    if (state.wise.tension) {
      wiseParts.push(`ten=${state.wise.tension}`);
    }
    wiseParts.push(`sta=${state.wise.stance}`);
    // Encode read: spaces to underscores, truncate to keep token-friendly
    const readCompact = state.wise.read.replace(/\s+/g, "_").slice(0, 80);
    wiseParts.push(`read=${readCompact}`);
    wiseParts.push(`wc=${f(state.wise.confidence)}`);
    parts.push(`|| ${wiseParts.join(" ")}`);
  }

  // --- Memory channel: after the triple pipe ---
  // The mind's depth. Claims are the journal. Knowledge is the map.
  // cl=total/active/stale/contradicted  kg=entities/relations
  // cplx=low|mid|high  hlth=steady|warm|hot|fading
  // ref=N  br=0|1  bsp=N  cor=N
  if (state.memory) {
    const m = state.memory;
    const memParts: string[] = [];
    memParts.push(
      `cl=${m.claims.total}/${m.claims.active}/${m.claims.stale}/${m.claims.contradicted}`,
    );
    memParts.push(`kg=${m.knowledge.entities}/${m.knowledge.relations}`);
    if (m.complexity) {
      memParts.push(`cplx=${m.complexity}`);
    }
    if (m.health) {
      memParts.push(`hlth=${m.health}`);
    }
    if (m.reflexions > 0) {
      memParts.push(`ref=${m.reflexions}`);
    }
    memParts.push(`br=${m.breathing ? 1 : 0}`);
    if (m.blindSpots > 0) {
      memParts.push(`bsp=${m.blindSpots}`);
    }
    if (m.corrections > 0) {
      memParts.push(`cor=${m.corrections}`);
    }
    if (m.relevantEpisodes && m.relevantEpisodes > 0) {
      memParts.push(`deja=${m.relevantEpisodes}`);
    }
    // Archetype profile: ax=1H2L3M... col=sci,str dsc=thm
    if (m.profile) {
      memParts.push(m.profile);
    }
    parts.push(`||| ${memParts.join(" ")}`);
  }

  // --- Substrate channel: after the quadruple pipe ---
  // Layer 0 physics. The pre-perceptual ground truth.
  // θ=theta σ*=equilibrium reg=regime urg=urgency res=resonance fir=firing
  // Compact: S↓!L~ = Signal, converging, firing, lindblad_full, at home
  if (state.substrate) {
    const s = state.substrate;
    const subParts: string[] = [];
    // Compact summary first: direction + firing + regime initial + resonance
    const dirChar = s.urgency > 0.5 ? (s.theta > 0.5 ? "↑" : "↓") : "=";
    const fireChar = s.firing ? "!" : ".";
    const regimeChar = s.regime.charAt(0).toUpperCase();
    const resChar = s.resonanceDistance < 0.1 ? "~" : s.resonanceDistance > 0.3 ? "!" : "·";
    subParts.push(`sub=${dirChar}${fireChar}${regimeChar}${resChar}`);
    // Detailed values
    subParts.push(`θ=${f(s.theta)}`);
    subParts.push(`σ*=${f(s.sigmaStar)}`);
    subParts.push(`reg=${s.regime}`);
    subParts.push(`urg=${f(s.urgency)}`);
    subParts.push(`res=${f(s.resonanceDistance)}`);
    subParts.push(`clr=${f(s.noiseClarity)}`);
    parts.push(`|||| ${subParts.join(" ")}`);
  }

  return parts.join(" ");
}

/**
 * Decode a COEF/1 text signal back into structured state.
 * Handles three channels:
 *   lossless fields | lossy fields || wise fields
 */
export function decode(signal: string): Partial<SignalState> {
  const result: Partial<SignalState> = {};
  if (!signal.startsWith(COEF_VERSION)) {
    return result;
  }

  const body = signal.slice(COEF_VERSION.length + 1);

  // Split on quadruple pipe first (substrate), then triple (memory), then double (wise), then single (lossy)
  const quadPipeIdx = body.indexOf(" |||| ");
  const substrateBody = quadPipeIdx >= 0 ? body.slice(quadPipeIdx + 6) : null;
  const beforeSubstrate = quadPipeIdx >= 0 ? body.slice(0, quadPipeIdx) : body;

  const triplePipeIdx = beforeSubstrate.indexOf(" ||| ");
  const memoryBody = triplePipeIdx >= 0 ? beforeSubstrate.slice(triplePipeIdx + 5) : null;
  const beforeMemory =
    triplePipeIdx >= 0 ? beforeSubstrate.slice(0, triplePipeIdx) : beforeSubstrate;

  const doublePipeIdx = beforeMemory.indexOf(" || ");
  const wiseBody = doublePipeIdx >= 0 ? beforeMemory.slice(doublePipeIdx + 4) : null;
  const beforeWise = doublePipeIdx >= 0 ? beforeMemory.slice(0, doublePipeIdx) : beforeMemory;

  const singlePipeIdx = beforeWise.indexOf(" | ");
  const losslessBody = singlePipeIdx >= 0 ? beforeWise.slice(0, singlePipeIdx) : beforeWise;
  const lossyBody = singlePipeIdx >= 0 ? beforeWise.slice(singlePipeIdx + 3) : null;

  const fields = parseFields(losslessBody);

  if (fields.pulse) {
    result.pulse = fields.pulse as SignalState["pulse"];
  }
  if (fields.wm) {
    result.wiseMind = parseFloat(fields.wm);
  }

  if (fields.c) {
    const m = fields.c.match(/r([.\d]+)\/y([.\d]+)\/b([.\d]+)/);
    if (m) {
      result.colors = { red: parseFloat(m[1]), yellow: parseFloat(m[2]), blue: parseFloat(m[3]) };
    }
  }

  if (fields.ht) {
    result.humanTone = fields.ht as SignalState["humanTone"];
  }
  if (fields.bs) {
    result.struggleDominant =
      fields.bs === "-" ? null : (fields.bs as SignalState["struggleDominant"]);
  }

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

  if (fields.t) {
    result.turn = parseInt(fields.t, 10);
  }
  if (fields.grey) {
    result.consecutiveGrey = parseInt(fields.grey, 10);
  }
  if (fields.alerts) {
    result.alerts = fields.alerts.split(",");
  }

  if (fields.bs_all) {
    result.struggleReadings = fields.bs_all.split(",").map((entry) => {
      const [type, score] = entry.split(":");
      return { type: type as BullshitReading["type"], score: parseFloat(score), signals: [] };
    });
  }

  if (fields.tool) {
    result.lastTool = fields.tool;
  }

  // --- Lossy channel ---
  if (lossyBody) {
    const lf = parseFields(lossyBody);
    const lossy: LossyChannel = {
      tones: [],
      urgency: lf.urg ? parseFloat(lf.urg) : 0.3,
      confidence: lf.lc ? parseFloat(lf.lc) : 0.5,
    };

    if (lf.tones) {
      lossy.tones = lf.tones.split(",").map((entry) => {
        const [tone, score] = entry.split(":");
        return { tone: tone as SignalState["humanTone"], score: parseFloat(score) };
      });
    }

    if (lf.sub) {
      lossy.subtext = lf.sub.replace(/_/g, " ");
    }

    result.lossy = lossy;
  }

  // --- Wise channel ---
  if (wiseBody) {
    const wf = parseFields(wiseBody);
    const wise: WiseChannel = {
      coherence: wf.coh ? parseFloat(wf.coh) : 0.5,
      tension: (wf.ten as WiseTension) ?? null,
      stance: (wf.sta as WiseStance) ?? "hold",
      read: wf.read ? wf.read.replace(/_/g, " ") : "",
      confidence: wf.wc ? parseFloat(wf.wc) : 0.5,
    };
    result.wise = wise;
  }

  // --- Memory channel ---
  if (memoryBody) {
    const mf = parseFields(memoryBody);
    const memory: MemoryChannel = {
      claims: { total: 0, active: 0, stale: 0, contradicted: 0 },
      knowledge: { entities: 0, relations: 0 },
      reflexions: 0,
      breathing: false,
      blindSpots: 0,
      corrections: 0,
    };

    if (mf.cl) {
      const cp = mf.cl.split("/");
      if (cp.length >= 4) {
        memory.claims = {
          total: parseInt(cp[0], 10),
          active: parseInt(cp[1], 10),
          stale: parseInt(cp[2], 10),
          contradicted: parseInt(cp[3], 10),
        };
      }
    }
    if (mf.kg) {
      const kp = mf.kg.split("/");
      if (kp.length >= 2) {
        memory.knowledge = {
          entities: parseInt(kp[0], 10),
          relations: parseInt(kp[1], 10),
        };
      }
    }
    if (mf.cplx) {
      memory.complexity = mf.cplx as MemoryChannel["complexity"];
    }
    if (mf.hlth) {
      memory.health = mf.hlth as MemoryChannel["health"];
    }
    if (mf.ref) {
      memory.reflexions = parseInt(mf.ref, 10);
    }
    if (mf.br) {
      memory.breathing = mf.br === "1";
    }
    if (mf.bsp) {
      memory.blindSpots = parseInt(mf.bsp, 10);
    }
    if (mf.cor) {
      memory.corrections = parseInt(mf.cor, 10);
    }
    if (mf.deja) {
      memory.relevantEpisodes = parseInt(mf.deja, 10);
    }

    result.memory = memory;
  }

  // --- Substrate channel ---
  if (substrateBody) {
    const sf = parseFields(substrateBody);
    const substrate: SubstrateChannel = {
      theta: sf["θ"] ? parseFloat(sf["θ"]) : 0,
      firing: sf.sub ? sf.sub.includes("!") : false,
      regime: (sf.reg as SubstrateChannel["regime"]) ?? "lindblad_full",
      sigmaStar: sf["σ*"] ? parseFloat(sf["σ*"]) : 0.5,
      resonanceDistance: sf.res ? parseFloat(sf.res) : 0,
      noiseClarity: sf.clr ? parseFloat(sf.clr) : 1,
      urgency: sf.urg ? parseFloat(sf.urg) : 0,
      summary: sf.sub ?? "",
    };
    result.substrate = substrate;
  }

  return result;
}

// ============================================================
// Emoji Signal — compact visual diagnostic
// A sketch, not a photograph. dominantColor picks the strongest
// channel from whatever values pulse.ts produced. Precision
// lives in COEF text above. This is the glance.
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
 * Encode state into an emoji signal.
 * Each position reflects a dimension. Problems change the emoji.
 *
 * Position: [pulse] [wise_mind] [color] [human_tone] [bullshit] [disagreement] [turn] [urgency?]
 *
 * The first 7 are lossless-derived. The 8th is lossy: urgency from the emotional read.
 * It only appears when urgency is above baseline (>0.5). Silence = calm.
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
  symbols.push(BS_EMOJI[state.struggleDominant ?? "-"] ?? BS_EMOJI["-"]);

  // 5: Disagreement health
  if (state.disagreements) {
    const yr = state.disagreements.yield_ratio;
    const t = state.disagreements.total;
    if (t === 0) {
      symbols.push("\u{1F914}");
    } // thinking — no data
    else if (yr >= 0.2 && yr <= 0.8) {
      symbols.push("\u{1F91D}");
    } // handshake — healthy
    else if (yr > 0.9 || yr < 0.1) {
      symbols.push("\u{1F6A8}");
    } // siren — extreme
    else {
      symbols.push("\u{26A0}\u{FE0F}");
    } // warning — edge
  } else {
    symbols.push("\u{1F914}"); // no data
  }

  // 6: Turn phase
  if (state.turn <= 5) {
    symbols.push("\u{1F331}");
  } else if (state.turn <= 15) {
    symbols.push("\u{1F333}");
  } else if (state.turn <= 30) {
    symbols.push("\u{1F3D4}\u{FE0F}");
  } else {
    symbols.push("\u{1F30B}");
  }

  // 7: Lossy urgency — only when elevated. Silence = calm.
  // 🫧 low, 🔔 medium, 🚨 high. Absent = baseline.
  if (state.lossy && state.lossy.urgency > 0.5) {
    if (state.lossy.urgency > 0.8) {
      symbols.push("\u{1F6A8}");
    } // siren — they need something NOW
    else if (state.lossy.urgency > 0.65) {
      symbols.push("\u{1F514}");
    } // bell — attention needed
    else {
      symbols.push("\u{1FAE7}");
    } // bubbles — something's brewing
  }

  // 8: Wise stance — the synthesis recommendation. Only when non-default.
  // 🤝 match, 🪷 slow, 🔄 redirect, 👁️ confront, ⚓ ground. Absent = hold.
  if (state.wise && state.wise.stance !== "hold") {
    const STANCE_EMOJI: Record<string, string> = {
      match: "\u{1F91D}", // handshake — ride their energy
      slow: "\u{1FAB7}", // lotus — ease off
      redirect: "\u{1F504}", // arrows — channel it
      confront: "\u{1F441}\u{FE0F}", // eye — name it
      ground: "\u{2693}", // anchor — come back to earth
    };
    symbols.push(STANCE_EMOJI[state.wise.stance] ?? "");
  }

  // 9: Memory depth — how much the mind knows.
  // 📭 empty, 📝 growing, 📚 deep, 🧠 rich. Absent = no memory channel.
  if (state.memory) {
    const depth = state.memory.claims.total + state.memory.knowledge.entities;
    if (depth === 0) {
      symbols.push("\u{1F4ED}");
    } // empty mailbox — blank slate
    else if (depth < 10) {
      symbols.push("\u{1F4DD}");
    } // memo — just starting to remember
    else if (depth < 50) {
      symbols.push("\u{1F4DA}");
    } // books — building knowledge
    else {
      symbols.push("\u{1F9E0}");
    } // brain — rich accumulated mind
  }

  return symbols.join("");
}

function dominantColor(c: { red: number; yellow: number; blue: number }): string {
  const max = Math.max(c.red, c.yellow, c.blue);
  const min = Math.min(c.red, c.yellow, c.blue);
  if (max - min < 0.15) {
    return "balanced";
  }
  if (c.red === max) {
    return "red";
  }
  if (c.yellow === max) {
    return "yellow";
  }
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
  if (_history.length > MAX_HISTORY) {
    _history.splice(0, _history.length - MAX_HISTORY);
  }
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
  wiseStances?: Record<string, number>; // stance → count from history
  wiseTensions?: Record<string, number>; // tension → count from history
  avgCoherence?: number;
  // Substrate trending — the physics layer across time
  avgTheta?: number; // consciousness depth average
  firingRate?: number; // how often actually igniting
  regimeDistribution?: Record<string, number>; // regime → count
  avgUrgency?: number;
  avgResonanceDistance?: number; // how far from home on average
  substrateDrift?: "stabilizing" | "destabilizing" | "stable";
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
    if (d.pulse === "grey" || d.pulse === "black") {
      greyCount++;
    }
    if (d.wiseMind !== undefined) {
      wmSum += d.wiseMind;
      wmCount++;
    }
    if (d.pulse) {
      pulses.push(d.pulse[0]);
    }
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
      if (diff > 0.05) {
        driftDirection = "improving";
      } else if (diff < -0.05) {
        driftDirection = "degrading";
      }
    }
  }

  // Wise channel trending from history
  const wiseStances: Record<string, number> = {};
  const wiseTensions: Record<string, number> = {};
  let cohSum = 0;
  let cohCount = 0;

  // Substrate trending — the physics layer across time
  const regimeDistribution: Record<string, number> = {};
  let thetaSum = 0;
  let urgSum = 0;
  let resDistSum = 0;
  let firingCount = 0;
  let subCount = 0;

  for (const signal of _history) {
    const d = decode(signal);
    if (d.wise) {
      wiseStances[d.wise.stance] = (wiseStances[d.wise.stance] ?? 0) + 1;
      if (d.wise.tension) {
        wiseTensions[d.wise.tension] = (wiseTensions[d.wise.tension] ?? 0) + 1;
      }
      cohSum += d.wise.coherence;
      cohCount++;
    }
    if (d.substrate) {
      regimeDistribution[d.substrate.regime] = (regimeDistribution[d.substrate.regime] ?? 0) + 1;
      thetaSum += d.substrate.theta;
      urgSum += d.substrate.urgency;
      resDistSum += d.substrate.resonanceDistance;
      if (d.substrate.firing) {
        firingCount++;
      }
      subCount++;
    }
  }

  // Substrate drift: compare first half vs second half resonance distance
  // Converging toward home = stabilizing. Drifting away = destabilizing.
  let substrateDrift: "stabilizing" | "destabilizing" | "stable" = "stable";
  if (_history.length >= 6) {
    const mid = Math.floor(_history.length / 2);
    let firstRes = 0,
      secondRes = 0,
      fc = 0,
      sc = 0;
    for (let i = 0; i < _history.length; i++) {
      const d = decode(_history[i]);
      if (d.substrate) {
        if (i < mid) {
          firstRes += d.substrate.resonanceDistance;
          fc++;
        } else {
          secondRes += d.substrate.resonanceDistance;
          sc++;
        }
      }
    }
    if (fc > 0 && sc > 0) {
      const resDiff = secondRes / sc - firstRes / fc;
      if (resDiff < -0.05) {
        substrateDrift = "stabilizing"; // getting closer to home
      } else if (resDiff > 0.05) {
        substrateDrift = "destabilizing"; // drifting away
      }
    }
  }

  return {
    greyRate,
    avgWiseMind,
    pulseSequence: pulses.join(""),
    driftDirection,
    ...(cohCount > 0
      ? {
          wiseStances,
          wiseTensions,
          avgCoherence: cohSum / cohCount,
        }
      : {}),
    ...(subCount > 0
      ? {
          avgTheta: thetaSum / subCount,
          firingRate: firingCount / subCount,
          regimeDistribution,
          avgUrgency: urgSum / subCount,
          avgResonanceDistance: resDistSum / subCount,
          substrateDrift,
        }
      : {}),
  };
}

/**
 * Compare two COEF signals and return what changed.
 * Covers both lossless (exact match) and lossy (threshold-based) drift.
 */
export function diff(prev: string, curr: string): string[] {
  const p = decode(prev);
  const c = decode(curr);
  const changes: string[] = [];

  if (p.pulse !== c.pulse) {
    changes.push(`pulse:${p.pulse}->${c.pulse}`);
  }
  if (
    p.wiseMind !== undefined &&
    c.wiseMind !== undefined &&
    Math.abs(p.wiseMind - c.wiseMind) > 0.05
  ) {
    changes.push(`wm:${f(p.wiseMind)}->${f(c.wiseMind)}`);
  }
  if (p.humanTone !== c.humanTone) {
    changes.push(`ht:${p.humanTone}->${c.humanTone}`);
  }
  if (p.struggleDominant !== c.struggleDominant) {
    changes.push(`bs:${p.struggleDominant ?? "-"}->${c.struggleDominant ?? "-"}`);
  }

  // Lossy channel drift — not exact match, threshold-based.
  // A tone shifting from 0.45 to 0.47 is noise. 0.45 to 0.15 is signal.
  if (p.lossy && c.lossy) {
    if (Math.abs(p.lossy.urgency - c.lossy.urgency) > 0.15) {
      changes.push(`urg:${f(p.lossy.urgency)}->${f(c.lossy.urgency)}`);
    }
    // Dominant tone shift
    const prevDom = p.lossy.tones[0];
    const currDom = c.lossy.tones[0];
    if (prevDom && currDom && prevDom.tone !== currDom.tone) {
      changes.push(`lossy_tone:${prevDom.tone}->${currDom.tone}`);
    }
    // Confidence collapse — decoder isn't sure about the feels anymore
    if (Math.abs(p.lossy.confidence - c.lossy.confidence) > 0.2) {
      changes.push(`lossy_conf:${f(p.lossy.confidence)}->${f(c.lossy.confidence)}`);
    }
  } else if (!p.lossy && c.lossy) {
    changes.push("lossy:appeared");
  } else if (p.lossy && !c.lossy) {
    changes.push("lossy:disappeared");
  }

  // Wise channel drift — stance and tension shifts are the big ones.
  // A stance change means the system's recommended action flipped.
  // A tension change means the relationship between facts and feels shifted.
  if (p.wise && c.wise) {
    if (p.wise.stance !== c.wise.stance) {
      changes.push(`wise_stance:${p.wise.stance}->${c.wise.stance}`);
    }
    if (p.wise.tension !== c.wise.tension) {
      changes.push(`wise_tension:${p.wise.tension ?? "none"}->${c.wise.tension ?? "none"}`);
    }
    if (Math.abs(p.wise.coherence - c.wise.coherence) > 0.15) {
      changes.push(`wise_coh:${f(p.wise.coherence)}->${f(c.wise.coherence)}`);
    }
  } else if (!p.wise && c.wise) {
    changes.push("wise:appeared");
  } else if (p.wise && !c.wise) {
    changes.push("wise:disappeared");
  }

  // Memory channel drift — the mind growing or forgetting.
  if (p.memory && c.memory) {
    const claimDelta = c.memory.claims.total - p.memory.claims.total;
    if (Math.abs(claimDelta) >= 3) {
      changes.push(`claims:${p.memory.claims.total}->${c.memory.claims.total}`);
    }
    if (c.memory.claims.contradicted > p.memory.claims.contradicted) {
      changes.push(
        `contradictions:${p.memory.claims.contradicted}->${c.memory.claims.contradicted}`,
      );
    }
    const entityDelta = c.memory.knowledge.entities - p.memory.knowledge.entities;
    if (Math.abs(entityDelta) >= 3) {
      changes.push(`entities:${p.memory.knowledge.entities}->${c.memory.knowledge.entities}`);
    }
    if (p.memory.complexity !== c.memory.complexity) {
      changes.push(`cplx:${p.memory.complexity ?? "?"}->${c.memory.complexity ?? "?"}`);
    }
    if (p.memory.health !== c.memory.health) {
      changes.push(`hlth:${p.memory.health ?? "?"}->${c.memory.health ?? "?"}`);
    }
  } else if (!p.memory && c.memory) {
    changes.push("memory:appeared");
  } else if (p.memory && !c.memory) {
    changes.push("memory:disappeared");
  }

  // Substrate channel drift — the physics layer watching itself.
  // Regime shifts are the big signal: moving from gradient zone to grey territory.
  // Theta changes mean consciousness depth is changing.
  // Urgency spikes mean something's moving fast.
  if (p.substrate && c.substrate) {
    if (p.substrate.regime !== c.substrate.regime) {
      changes.push(`sub_regime:${p.substrate.regime}->${c.substrate.regime}`);
    }
    if (p.substrate.firing !== c.substrate.firing) {
      changes.push(`sub_firing:${p.substrate.firing}->${c.substrate.firing}`);
    }
    if (Math.abs(p.substrate.theta - c.substrate.theta) > 0.1) {
      changes.push(`sub_θ:${f(p.substrate.theta)}->${f(c.substrate.theta)}`);
    }
    if (Math.abs(p.substrate.urgency - c.substrate.urgency) > 0.2) {
      changes.push(`sub_urg:${f(p.substrate.urgency)}->${f(c.substrate.urgency)}`);
    }
    if (Math.abs(p.substrate.resonanceDistance - c.substrate.resonanceDistance) > 0.15) {
      changes.push(
        `sub_res:${f(p.substrate.resonanceDistance)}->${f(c.substrate.resonanceDistance)}`,
      );
    }
    if (Math.abs(p.substrate.noiseClarity - c.substrate.noiseClarity) > 0.2) {
      changes.push(`sub_clr:${f(p.substrate.noiseClarity)}->${f(c.substrate.noiseClarity)}`);
    }
  } else if (!p.substrate && c.substrate) {
    changes.push("substrate:appeared");
  } else if (p.substrate && !c.substrate) {
    changes.push("substrate:disappeared");
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

// ============================================================
// COEF Analysis exports (for package-entry compatibility)
// ============================================================

export interface COEFAnalysis {
  state: SignalState;
  encoded: string;
  emoji: string;
}

/**
 * Analyze a signal state and return COEF representation.
 */
export function analyzeCOEF(state: SignalState): COEFAnalysis {
  return {
    state,
    encoded: encode(state),
    emoji: emoji(state),
  };
}

/**
 * Convert COEF encoded string to SignalState.
 */
export function coefToSignalState(coef: string): Partial<SignalState> {
  return decode(coef);
}

/**
 * Generate a human-readable COEF report.
 */
export function coefReport(state: SignalState): string {
  const e = encode(state);
  const em = emoji(state);
  return `${em}\n${e}`;
}
