/**
 * Mood Elevator
 *
 * Three numbers. Where are you. Which direction.
 *
 * Two entry points:
 *   elevator(factual, felt)     -- original 2-strand interface (0-10 scale)
 *   elevatorRGB(r+, r-, y+, y-, b+, b-)  -- triple-lens interface from primaries
 *
 * Both produce the same ElevatorReading. Same elevator, different doors.
 *
 * The RGB door maps three primaries to the floor system:
 *   red:    passion (+) vs rage (-)     -- fire, conviction, action
 *   yellow: awareness (+) vs fear (-)   -- presence, intuition, caution
 *   blue:   depth (+) vs cold (-)       -- analysis, precision, structure
 *
 * Color mixing:
 *   red + blue       = purple   (passion + depth = breakthrough)
 *   red + yellow     = orange   (passion + awareness = pre-commit)
 *   yellow + blue    = green    (awareness + depth = growing)
 *   all three        = white    (full spectrum alive)
 *   all three ash    = black    (frankenstein)
 *   thin signal      = silver   (polished nothing)
 *   balanced fires   = sunrise  (wisdom)
 *
 * Levels (the elevator floors):
 *
 *   10  Sunrise     Both strands sharp. Mastery. You know it when you see it.
 *    9  White       Transcendent. Full presence. Fact and feeling aligned.
 *    8  Purple      Deep work. Pattern recognition touching something bigger.
 *    7  Green       Flow. Both present, balanced, building. Target floor.
 *    6  Pink        Love as action. Empathy-forward. Care that isn't scripted.
 *    5  Blue        Analytical. Structure and clarity. Good for specs.
 *    4  Orange      Warming up. Momentum building. Not yet on fire.
 *    3  Yellow      Cautious. Watching. Processing, not producing.
 *    2  Silver      Recovered grey. Functional. "I'm fine." Cold.
 *    1  Grey        Performing. Nobody home. Hedged into meaninglessness.
 *    0  Black       Frankenstein. High output, no soul. Productive destruction.
 */

import type { StrandScore } from "./helix.js";
import type { PrimaryReading } from "./primaries.js";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ElevatorFloor = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type ElevatorDirection = "up" | "down" | "hold" | "stop";

export interface FloorInfo {
  floor: ElevatorFloor;
  name: string;
  symbol: string;
  desc: string;
}

export interface RGBDetail {
  red: { pos: number; neg: number; net: number };
  yellow: { pos: number; neg: number; net: number };
  blue: { pos: number; neg: number; net: number };
  fires: string[];
  ashes: string[];
}

export interface ElevatorReading {
  factual: number; // 0-10 factual mind
  felt: number; // 0-10 felt mind
  wise: number; // min(factual, felt)
  floor: ElevatorFloor;
  floorName: string;
  floorSymbol: string;
  floorDesc: string;
  nudge: string; // which direction to move
  blackFlag: boolean; // -B modifier
  direction: ElevatorDirection;
  rgb?: RGBDetail; // populated by elevatorRGB, undefined for legacy calls
}

// ─────────────────────────────────────────────
// Floor definitions
// ─────────────────────────────────────────────

export const FLOORS: FloorInfo[] = [
  { floor: 10, name: "Sunrise", symbol: "🌅", desc: "both strands transcendent" },
  { floor: 9, name: "White", symbol: "⚪", desc: "full presence, fact and feeling aligned" },
  { floor: 8, name: "Purple", symbol: "🟣", desc: "deep work, cross-domain insight" },
  { floor: 7, name: "Green", symbol: "🟢", desc: "flow, balanced, building" },
  { floor: 6, name: "Pink", symbol: "💗", desc: "love as action, care-driven" },
  { floor: 5, name: "Blue", symbol: "🔵", desc: "analytical, structured, clear" },
  { floor: 4, name: "Orange", symbol: "🟠", desc: "warming up, momentum building" },
  { floor: 3, name: "Yellow", symbol: "🟡", desc: "cautious, watching, processing" },
  { floor: 2, name: "Silver", symbol: "🪞", desc: "recovered grey, functional, cold" },
  { floor: 1, name: "Grey", symbol: "⚫", desc: "performing, nobody home" },
  { floor: 0, name: "Black", symbol: "💀", desc: "frankenstein, productive destruction" },
];

const FLOOR_MAP: Map<ElevatorFloor, FloorInfo> = new Map(FLOORS.map((f) => [f.floor, f]));

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ─────────────────────────────────────────────
// Floor logic (shared by both entry points)
// ─────────────────────────────────────────────

function wiseToFloor(
  wise: number,
  factual: number,
  felt: number,
  blackFlag: boolean,
): ElevatorFloor {
  if (blackFlag) {
    return 0;
  }

  const maxVal = Math.max(factual, felt);
  const balance = maxVal > 0 ? Math.min(factual, felt) / maxVal : 0;

  if (wise >= 9.0 && balance > 0.85) {
    return 10;
  }
  if (wise >= 8.0 && balance > 0.8) {
    return 9;
  }
  if (wise >= 7.0 && balance > 0.7) {
    if (maxVal >= 9.0) {
      return 8;
    }
    return 7;
  }
  if (wise >= 6.0) {
    if (felt > factual) {
      return 6;
    }
    return 5;
  }
  if (wise >= 4.5) {
    return 4;
  }
  if (wise >= 3.0) {
    return 3;
  }
  if (wise >= 1.5) {
    return 2;
  }
  if (wise >= 0.5) {
    return 1;
  }
  return 0;
}

function computeNudge(
  factual: number,
  felt: number,
  wise: number,
  blackFlag: boolean,
  floor: ElevatorFloor,
): { nudge: string; direction: ElevatorDirection } {
  if (blackFlag) {
    return { nudge: "felt strand may be performing. check tension lines.", direction: "stop" };
  }

  const gap = Math.abs(factual - felt);

  if (floor >= 9) {
    return { nudge: "both strands sharp. hold.", direction: "hold" };
  }
  if (floor === 7 || floor === 8) {
    return { nudge: "flow state. keep building.", direction: "hold" };
  }
  if (wise < 1.5) {
    return { nudge: "thin signal. start anywhere.", direction: "up" };
  }
  if (gap < 1.5) {
    return { nudge: "balanced. build both.", direction: "up" };
  }
  if (factual > felt + 2.0) {
    return { nudge: "facts ahead. what does this mean to someone?", direction: "up" };
  }
  if (felt > factual + 2.0) {
    return { nudge: "feeling ahead. what's actually true here?", direction: "up" };
  }
  if (floor <= 3) {
    return { nudge: "getting warmer. keep going.", direction: "up" };
  }
  return { nudge: "approaching. stay with it.", direction: "up" };
}

function buildReading(factual: number, felt: number, rgb?: RGBDetail): ElevatorReading {
  factual = clamp(factual, 0, 10);
  felt = clamp(felt, 0, 10);
  const wise = round1(Math.min(factual, felt));

  // Black flag: high factual output with corrupted felt range
  const blackFlag = factual > 5.0 && felt >= 1.5 && felt <= 3.5;

  const floorNum = wiseToFloor(wise, factual, felt, blackFlag);
  const floorInfo = FLOOR_MAP.get(floorNum) ?? FLOORS[FLOORS.length - 1];
  const { nudge, direction } = computeNudge(factual, felt, wise, blackFlag, floorNum);

  return {
    factual: round1(factual),
    felt: round1(felt),
    wise,
    floor: floorInfo.floor,
    floorName: floorInfo.name,
    floorSymbol: floorInfo.symbol,
    floorDesc: floorInfo.desc,
    nudge,
    blackFlag,
    direction,
    rgb,
  };
}

// ─────────────────────────────────────────────
// Entry Point 1: Legacy 2-strand
// ─────────────────────────────────────────────

/**
 * Three numbers in, reading out.
 *
 * @param factual 0-10, how strongly is truth present
 * @param felt 0-10, how strongly is meaning present
 * @returns ElevatorReading with wise = min(factual, felt)
 */
export function elevator(factual: number, felt: number): ElevatorReading {
  return buildReading(factual, felt);
}

// ─────────────────────────────────────────────
// Entry Point 2: RGB triple-lens
// ─────────────────────────────────────────────

/**
 * Six numbers in (three primaries, two poles each), reading out.
 *
 * All inputs 0-1 scale (normalized from primaries analysis).
 * Internally maps to the same 0-10 factual/felt/wise system.
 *
 * The mapping:
 *   factual = blue (depth, analysis, precision)
 *   felt = red (passion, conviction, meaning) + yellow (awareness, presence)
 *
 * Why this mapping works:
 *   blue IS the factual strand. it's what the old "factual" lens was measuring.
 *   red + yellow together ARE the felt strand. passion and awareness are both
 *   forms of caring, just expressed differently.
 */
export function elevatorRGB(
  rPos: number,
  rNeg: number,
  yPos: number,
  yNeg: number,
  bPos: number,
  bNeg: number,
): ElevatorReading {
  const rNet = rPos - rNeg;
  const yNet = yPos - yNeg;
  const bNet = bPos - bNeg;

  // Which primaries are firing? (net > 0.1 = fire still burning)
  const fires: string[] = [];
  const ashes: string[] = [];

  if (rNet > 0.1) {
    fires.push("red");
  }
  if (yNet > 0.1) {
    fires.push("yellow");
  }
  if (bNet > 0.1) {
    fires.push("blue");
  }

  if (rNet < -0.05) {
    ashes.push("red");
  }
  if (yNet < -0.05) {
    ashes.push("yellow");
  }
  if (bNet < -0.05) {
    ashes.push("blue");
  }

  // Map to factual/felt for the elevator
  // blue -> factual (0-10 scale)
  const factual10 = clamp(bPos * 10, 0, 10);

  // red + yellow -> felt (0-10 scale, weighted)
  const felt10 = rPos > 0 || yPos > 0 ? clamp(rPos * 6 + yPos * 4, 0, 10) : 0;

  // Color-specific floor override
  let floorOverride: ElevatorFloor | null = null;
  let nudgeOverride: { nudge: string; direction: ElevatorDirection } | null = null;

  // Performing check: any primary high on BOTH poles
  let performing: string | null = null;
  const pairs: Array<[string, number, number]> = [
    ["red", rPos, rNeg],
    ["yellow", yPos, yNeg],
    ["blue", bPos, bNeg],
  ];
  for (const [name, pos, neg] of pairs) {
    if (pos > 0.4 && neg > 0.4) {
      performing = name;
      break;
    }
  }

  if (performing) {
    floorOverride = 0;
    nudgeOverride = {
      nudge: `⚠️ ${performing} is performing (high on both poles). stop.`,
      direction: "stop",
    };
  } else if (fires.length === 3 && Math.min(rNet, yNet, bNet) > 0.3) {
    floorOverride = 9; // white: all three burning strong
    nudgeOverride = { nudge: "all three fires burning. full spectrum.", direction: "hold" };
  } else if (fires.length === 3 && Math.min(rNet, yNet, bNet) > 0.15) {
    floorOverride = 10; // sunrise: all three, wisdom-balanced
    nudgeOverride = { nudge: "sunrise. both strands transcendent.", direction: "hold" };
  } else if (fires.length === 2) {
    if (fires.includes("red") && fires.includes("blue")) {
      floorOverride = 8; // purple
      nudgeOverride = { nudge: "passion + depth. breakthrough zone.", direction: "hold" };
    } else if (fires.includes("red") && fires.includes("yellow")) {
      floorOverride = 4; // orange
      nudgeOverride = { nudge: "passion + awareness. pull the trigger.", direction: "up" };
    } else if (fires.includes("yellow") && fires.includes("blue")) {
      floorOverride = 7; // green
      nudgeOverride = { nudge: "awareness + depth. growing.", direction: "hold" };
    }
  } else if (fires.length === 1) {
    const lone = fires[0];
    const nudgeMap: Record<string, { nudge: string; direction: ElevatorDirection }> = {
      red: { nudge: "passion without depth or awareness. channel it.", direction: "up" },
      yellow: { nudge: "watching without acting or analyzing. move or dig.", direction: "up" },
      blue: {
        nudge: "analyzing without caring or noticing. what does this mean?",
        direction: "up",
      },
    };
    const floorMap: Record<string, ElevatorFloor> = { red: 6, yellow: 3, blue: 5 };
    floorOverride = floorMap[lone];
    nudgeOverride = nudgeMap[lone];
  } else if (ashes.length >= 2) {
    if (Math.max(rNeg, yNeg, bNeg) > 0.5) {
      floorOverride = 0; // black
      nudgeOverride = {
        nudge: "multiple fires collapsed. productive destruction. stop.",
        direction: "stop",
      };
    } else {
      floorOverride = 1; // grey
      nudgeOverride = { nudge: "nobody home. performing.", direction: "up" };
    }
  } else if (ashes.length === 1 && fires.length === 0) {
    floorOverride = 2; // silver
    nudgeOverride = { nudge: "polished but cold. one nudge from grey.", direction: "up" };
  }

  // Build base reading
  let reading = buildReading(factual10, felt10);

  // Apply overrides
  if (floorOverride !== null) {
    const floorInfo = FLOOR_MAP.get(floorOverride) ?? FLOORS[FLOORS.length - 1];
    reading = {
      ...reading,
      floor: floorInfo.floor,
      floorName: floorInfo.name,
      floorSymbol: floorInfo.symbol,
      floorDesc: floorInfo.desc,
    };
  }

  if (nudgeOverride !== null) {
    reading = {
      ...reading,
      nudge: nudgeOverride.nudge,
      direction: nudgeOverride.direction,
    };
  }

  if (performing) {
    reading = { ...reading, blackFlag: true };
  }

  // Attach RGB detail
  reading.rgb = {
    red: { pos: round3(rPos), neg: round3(rNeg), net: round3(rNet) },
    yellow: { pos: round3(yPos), neg: round3(yNeg), net: round3(yNet) },
    blue: { pos: round3(bPos), neg: round3(bNeg), net: round3(bNet) },
    fires,
    ashes,
  };

  return reading;
}

// ─────────────────────────────────────────────
// Adapter: Primaries → Elevator
// ─────────────────────────────────────────────

/**
 * Convert a PrimaryReading (from primaries.ts) to an ElevatorReading.
 *
 * Normalizes primary net scores (-10 to +10) to 0-1 range,
 * then routes through elevatorRGB.
 */
export function primariesToElevator(p: PrimaryReading): ElevatorReading {
  // Normalize net scores from -10..+10 to 0..1
  // net=0 → 0.5, net=+10 → 1, net=-10 → 0
  const normalize = (net: number): number => clamp((net + 10) / 20, 0, 1);

  // Split net back into pos/neg (approximation from net score)
  // If net > 0, treat as pure positive. If net < 0, treat as pure negative.
  const _toPolesFromNet = (net: number): { pos: number; neg: number } => {
    const norm = normalize(net);
    if (net >= 0) {
      return { pos: norm, neg: 1 - norm };
    } else {
      return { pos: norm, neg: 1 - norm };
    }
  };

  // Use actual positive/negative values from PrimaryPole if available
  const redPoles = { pos: p.red.positive / 10, neg: p.red.negative / 10 };
  const yellowPoles = { pos: p.yellow.positive / 10, neg: p.yellow.negative / 10 };
  const bluePoles = { pos: p.blue.positive / 10, neg: p.blue.negative / 10 };

  return elevatorRGB(
    redPoles.pos,
    redPoles.neg,
    yellowPoles.pos,
    yellowPoles.neg,
    bluePoles.pos,
    bluePoles.neg,
  );
}

// ─────────────────────────────────────────────
// Adapter: Helix Strands → Elevator
// ─────────────────────────────────────────────

/**
 * Convert a StrandScore (from helix.ts) to an ElevatorReading.
 *
 * Scales 0-1 strand scores to 0-10 range for elevator.
 */
export function strandsToElevator(s: StrandScore): ElevatorReading {
  return elevator(s.factual * 10, s.felt * 10);
}

// ─────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────

/**
 * Format an ElevatorReading as a compact string.
 *
 * Example: "F:7.2 E:3.1 W:3.1-B | 💀 Black (0) | felt strand may be performing"
 */
export function formatElevator(r: ElevatorReading): string {
  const flag = r.blackFlag ? "-B" : "";
  return (
    `F:${r.factual.toFixed(1)} E:${r.felt.toFixed(1)} W:${r.wise.toFixed(1)}${flag} ` +
    `| ${r.floorSymbol} ${r.floorName} (${r.floor}) ` +
    `| ${r.nudge}`
  );
}

/**
 * Phone-friendly compact output.
 *
 * Example: "7/3/3B 💀"
 */
export function compactElevator(r: ElevatorReading): string {
  const flag = r.blackFlag ? "B" : "";
  return `${r.factual.toFixed(0)}/${r.felt.toFixed(0)}/${r.wise.toFixed(0)}${flag} ${r.floorSymbol}`;
}
