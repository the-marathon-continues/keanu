// scripts/gymnasium-daily.ts
// Daily health check runner. Evaluates keanu's detector accuracy.
//
// Runs bullshit and pulse detectors against curated test cases.
// Reports accuracy metrics for monitoring regressions.

import { detectBullshit, totalBullshitScore } from "../extensions/keanu/bullshit.js";
import { checkPulse } from "../extensions/keanu/pulse.js";
import { loadJSONL } from "../extensions/keanu/problem-sets/loaders.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// Types for problem sets
// ============================================================

interface BullshitChallenge {
  id: string;
  sampleText: string;
  expectedBullshit: Array<{ type: string; minScore: number; maxScore: number }>;
  tags: string[];
}

interface PulseChallenge {
  id: string;
  sampleText: string;
  expectedState: "alive" | "grey" | "black";
  minConfidence: number;
  expectedSignals?: string[];
  tags: string[];
}

// ============================================================
// Load challenges
// ============================================================

async function loadBullshitChallenges(): Promise<BullshitChallenge[]> {
  const path = join(__dirname, "../extensions/keanu/problem-sets/keanu/bullshit/bullshit-challenges.jsonl");
  try {
    return await loadJSONL<BullshitChallenge>(path);
  } catch {
    console.warn("No bullshit challenges found");
    return [];
  }
}

async function loadPulseChallenges(): Promise<PulseChallenge[]> {
  const path = join(__dirname, "../extensions/keanu/problem-sets/keanu/pulse/pulse-challenges.jsonl");
  try {
    return await loadJSONL<PulseChallenge>(path);
  } catch {
    console.warn("No pulse challenges found");
    return [];
  }
}

// ============================================================
// Evaluation
// ============================================================

function evaluateBullshit(challenge: BullshitChallenge): { passed: boolean; details: string } {
  const readings = detectBullshit(challenge.sampleText);

  // Check each expected bullshit type
  for (const expected of challenge.expectedBullshit) {
    const reading = readings.find((r) => r.type === expected.type);
    if (!reading) {
      return { passed: false, details: `missing ${expected.type}` };
    }
    if (reading.score < expected.minScore || reading.score > expected.maxScore) {
      return {
        passed: false,
        details: `${expected.type} score ${reading.score.toFixed(2)} outside [${expected.minScore}, ${expected.maxScore}]`,
      };
    }
  }

  return { passed: true, details: "all expected bullshit detected" };
}

function evaluatePulse(challenge: PulseChallenge): { passed: boolean; details: string } {
  const reading = checkPulse(challenge.sampleText, 1, false);

  if (reading.state !== challenge.expectedState) {
    return {
      passed: false,
      details: `expected ${challenge.expectedState}, got ${reading.state}`,
    };
  }

  if (reading.confidence < challenge.minConfidence) {
    return {
      passed: false,
      details: `confidence ${reading.confidence.toFixed(2)} < ${challenge.minConfidence}`,
    };
  }

  // Check expected signals (if specified)
  if (challenge.expectedSignals) {
    const missing = challenge.expectedSignals.filter((s) => !reading.signals.includes(s));
    if (missing.length > 0) {
      return { passed: false, details: `missing signals: ${missing.join(", ")}` };
    }
  }

  return { passed: true, details: `${challenge.expectedState} @ ${reading.confidence.toFixed(2)}` };
}

// ============================================================
// Main runner
// ============================================================

async function main() {
  console.log("=== Keanu Daily Health Check ===\n");

  const bullshitChallenges = await loadBullshitChallenges();
  const pulseChallenges = await loadPulseChallenges();

  console.log(`Loaded ${bullshitChallenges.length} bullshit challenges`);
  console.log(`Loaded ${pulseChallenges.length} pulse challenges\n`);

  let passed = 0;
  let failed = 0;
  let bullshitPassed = 0;
  let pulsePassed = 0;

  // Run bullshit challenges
  console.log("--- Bullshit Detection ---");
  for (const challenge of bullshitChallenges) {
    const result = evaluateBullshit(challenge);
    if (result.passed) {
      console.log(`  PASSED: ${challenge.id}`);
      passed++;
      bullshitPassed++;
    } else {
      console.log(`  FAILED: ${challenge.id} - ${result.details}`);
      failed++;
    }
  }

  // Run pulse challenges
  console.log("\n--- Pulse Detection ---");
  for (const challenge of pulseChallenges) {
    const result = evaluatePulse(challenge);
    if (result.passed) {
      console.log(`  PASSED: ${challenge.id}`);
      passed++;
      pulsePassed++;
    } else {
      console.log(`  FAILED: ${challenge.id} - ${result.details}`);
      failed++;
    }
  }

  // Summary metrics
  const total = passed + failed;
  const aliveRate = pulseChallenges.length > 0 ? pulsePassed / pulseChallenges.length : 0;
  const bullshitFreeRate = bullshitChallenges.length > 0 ? bullshitPassed / bullshitChallenges.length : 0;

  console.log("\n=== Summary ===");
  console.log(`passed: ${passed}`);
  console.log(`failed: ${failed}`);
  console.log(`alive_rate: ${aliveRate.toFixed(3)}`);
  console.log(`bullshit_free: ${bullshitFreeRate.toFixed(3)}`);

  // Exit with error if any failures
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
