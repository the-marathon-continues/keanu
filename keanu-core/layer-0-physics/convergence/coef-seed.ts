/**
 * COEF Seed Layer
 *
 * The barcode. Every reading gets compressed into a seed.
 * Every seed can be decoded back. Every transition has a receipt.
 *
 *   text -> helix + primaries -> Seed (compact) -> transmission -> decode -> verify
 *
 * The seed carries:
 *   - The helix strand scores (factual, felt)
 *   - The color primaries (R, Y, B)
 *   - The synthesis state
 *   - The content hash (receipt)
 *   - A seed hash (integrity check)
 *
 * Compression ratio: 500-word text becomes ~120 char seed.
 * Verification: decode the seed, compare content_hash. If match, lossless.
 */

import { createHash } from "crypto";
import { primariesToElevator, type ElevatorFloor } from "./elevator.js";
import type { HelixResult } from "./helix.js";
import type { PrimaryReading, Synthesis } from "./primaries.js";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface COEFSeed {
  // from helix
  factual: number;
  felt: number;
  wise: number; // min(factual, felt) - the floor
  // from primaries
  red: number;
  yellow: number;
  blue: number;
  synthesis: Synthesis;
  synthesisScore: number;
  // from elevator
  elevatorFloor: ElevatorFloor;
  // flags (from helix alive state)
  blackFlag: boolean;
  greyFlag: boolean;
  // verification
  contentHash: string;
  seedHash: string;
  nudge: string;
  version: string;
}

// ─────────────────────────────────────────────
// Encoding / Decoding
// ─────────────────────────────────────────────

const VERSION = "1.0";

/**
 * Encode a seed to transmission format (the barcode).
 *
 * Format: COEF:v1.0:F{f}E{e}W{w}:R{r}Y{y}B{b}:{synth}{score}:{flags}:{hash16}:{seed8}
 *
 * ~100-120 chars. That's the barcode.
 */
export function encode(seed: COEFSeed): string {
  let flags = "";
  if (seed.blackFlag) {
    flags += "BK";
  }
  if (seed.greyFlag) {
    flags += "GR";
  }
  if (!flags) {
    flags = "OK";
  }

  const f = seed.factual.toFixed(1);
  const e = seed.felt.toFixed(1);
  const w = seed.wise.toFixed(1);
  const r = (seed.red >= 0 ? "+" : "") + seed.red.toFixed(1);
  const y = (seed.yellow >= 0 ? "+" : "") + seed.yellow.toFixed(1);
  const b = (seed.blue >= 0 ? "+" : "") + seed.blue.toFixed(1);
  const ss = seed.synthesisScore.toFixed(1);

  return (
    `COEF:v${seed.version}` +
    `:F${f}E${e}W${w}` +
    `:R${r}Y${y}B${b}` +
    `:${seed.synthesis}${ss}` +
    `:FL${seed.elevatorFloor}` +
    `:${flags}` +
    `:${seed.contentHash.slice(0, 16)}` +
    `:${seed.seedHash.slice(0, 8)}`
  );
}

/**
 * Decode a transmitted seed string back to its components.
 *
 * Input: COEF:v1.0:F7.2E3.1W3.1:R+2.0Y+1.5B+4.3:white3.2:OK:a1b2c3d4e5f67890:ab12cd34
 * Output: Partial seed (hashes are truncated)
 */
export function decode(encoded: string): Partial<COEFSeed> {
  const parts = encoded.split(":");
  if (parts[0] !== "COEF") {
    throw new Error(`Not a COEF seed: ${encoded.slice(0, 20)}`);
  }

  const version = parts[1].replace("v", "");

  // parse triple mind: F7.2E3.1W3.1
  const tripleMatch = parts[2].match(/F([\d.]+)E([\d.]+)W([\d.]+)/);
  if (!tripleMatch) {
    throw new Error(`Bad triple mind segment: ${parts[2]}`);
  }
  const factual = parseFloat(tripleMatch[1]);
  const felt = parseFloat(tripleMatch[2]);
  const wise = parseFloat(tripleMatch[3]);

  // parse primaries: R+2.0Y+1.5B+4.3
  const primaryMatch = parts[3].match(/R([+-]?[\d.]+)Y([+-]?[\d.]+)B([+-]?[\d.]+)/);
  if (!primaryMatch) {
    throw new Error(`Bad primaries segment: ${parts[3]}`);
  }
  const red = parseFloat(primaryMatch[1]);
  const yellow = parseFloat(primaryMatch[2]);
  const blue = parseFloat(primaryMatch[3]);

  // parse synthesis: white3.2
  const synthMatch = parts[4].match(/(black|dark|flat|mixed|white|silver|gold)([\d.]+)/);
  if (!synthMatch) {
    throw new Error(`Bad synthesis segment: ${parts[4]}`);
  }
  const synthesis = synthMatch[1] as Synthesis;
  const synthesisScore = parseFloat(synthMatch[2]);

  // parse elevator floor: FL7
  const floorMatch = parts[5].match(/FL(\d+)/);
  if (!floorMatch) {
    throw new Error(`Bad elevator floor segment: ${parts[5]}`);
  }
  const elevatorFloor = parseInt(floorMatch[1], 10) as ElevatorFloor;

  // flags
  const flags = parts[6];
  const blackFlag = flags.includes("BK");
  const greyFlag = flags.includes("GR");

  // hashes (truncated in transmission)
  const contentHashPrefix = parts[7];
  const seedHashPrefix = parts[8];

  return {
    version,
    factual,
    felt,
    wise,
    red,
    yellow,
    blue,
    synthesis,
    synthesisScore,
    elevatorFloor,
    blackFlag,
    greyFlag,
    // partial hashes - only prefixes available from transmission
    contentHash: contentHashPrefix,
    seedHash: seedHashPrefix,
    nudge: "", // not transmitted
  };
}

// ─────────────────────────────────────────────
// Verification
// ─────────────────────────────────────────────

/**
 * Hash text to SHA-256 hex string.
 */
export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Compute seed hash for integrity verification.
 */
function computeSeedHash(seedData: Omit<COEFSeed, "seedHash">): string {
  const sorted = Object.keys(seedData)
    .toSorted()
    .reduce(
      (acc, key) => {
        acc[key] = seedData[key as keyof typeof seedData];
        return acc;
      },
      {} as Record<string, unknown>,
    );
  const canonical = JSON.stringify(sorted);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Verify a seed against original text. The receipt check.
 */
export function verify(seed: COEFSeed, originalText: string): boolean {
  const expectedHash = hashText(originalText);
  return seed.contentHash === expectedHash;
}

/**
 * Verify a transmitted seed hasn't been corrupted.
 */
export function verifyTransmission(encoded: string, seed: COEFSeed): boolean {
  const decoded = decode(encoded);
  return (
    decoded.contentHash === seed.contentHash.slice(0, 16) &&
    decoded.seedHash === seed.seedHash.slice(0, 8)
  );
}

// ─────────────────────────────────────────────
// Vector representation
// ─────────────────────────────────────────────

const SYNTH_MAP: Record<Synthesis, number> = {
  black: -1.0,
  dark: -0.5,
  flat: 0.0,
  mixed: 0.1,
  white: 0.3,
  silver: 0.6,
  gold: 1.0,
};

/**
 * Flatten seed to pure numbers. No words survive.
 * This is the input to the vector layer.
 *
 * 11 dimensions:
 *   [factual, felt, wise, red, yellow, blue,
 *    synthesisScore, synthValue, elevatorFloor, blackFlag, greyFlag]
 */
export function toNumericArray(seed: COEFSeed): number[] {
  return [
    seed.factual,
    seed.felt,
    seed.wise,
    seed.red,
    seed.yellow,
    seed.blue,
    seed.synthesisScore,
    SYNTH_MAP[seed.synthesis] ?? 0.0,
    seed.elevatorFloor,
    seed.blackFlag ? 1.0 : 0.0,
    seed.greyFlag ? 1.0 : 0.0,
  ];
}

// ─────────────────────────────────────────────
// Seed creation from helix + primaries
// ─────────────────────────────────────────────

/**
 * Create a seed from helix result and primaries reading.
 *
 * This is the main entry point for creating seeds.
 */
export function createSeed(helix: HelixResult, primaries: PrimaryReading, text: string): COEFSeed {
  // scale helix strands from 0-1 to 0-10
  const factual = Math.round(helix.strands.factual * 100) / 10;
  const felt = Math.round(helix.strands.felt * 100) / 10;
  const wise = Math.min(factual, felt);

  // compute elevator floor from primaries
  const elevator = primariesToElevator(primaries);

  const seedData = {
    factual,
    felt,
    wise,
    // primaries now have PrimaryPole objects, extract .net for the seed
    red: primaries.red.net,
    yellow: primaries.yellow.net,
    blue: primaries.blue.net,
    synthesis: primaries.synthesis,
    synthesisScore: primaries.synthesisScore,
    elevatorFloor: elevator.floor,
    blackFlag: helix.aliveState === "black" || elevator.blackFlag,
    greyFlag: helix.aliveState === "grey",
    contentHash: hashText(text),
    nudge: elevator.nudge || helix.diagnosis,
    version: VERSION,
  };

  return {
    ...seedData,
    seedHash: computeSeedHash(seedData),
  };
}
