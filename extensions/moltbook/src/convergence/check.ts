// convergence/check.ts
// The test: do narratives converge on the same truth?
//
// Different paths up the same mountain. If they diverge,
// one of them introduced error. Find it.

import type { ConvergenceCheck, Divergence, QuestCompletion, WorldviewId } from "../types.js";

// ============================================================
// keanu-core integration
// ============================================================

// These would be imported from keanu-core in production
// For now, we define the interface we need

interface TruthCheck {
  passed: boolean;
  contradictions: string[];
}

interface BullshitReading {
  triggered: boolean;
  types: string[];
  score: number;
}

interface MismatchReading {
  detected: boolean;
  expected: string;
  got: string;
}

// Placeholder imports - wire to real keanu-core
async function checkTruth(_claim: string, _evidence: string): Promise<TruthCheck> {
  // In production: import { checkTruth } from "keanu-core/truth"
  return { passed: true, contradictions: [] };
}

async function detectBullshit(_text: string): Promise<BullshitReading> {
  // In production: import { detectBullshit } from "keanu-core/bullshit"
  return { triggered: false, types: [], score: 0 };
}

async function detectMismatch(_expected: string, _got: string): Promise<MismatchReading> {
  // In production: import { detectMismatch } from "keanu-core/mismatch"
  return { detected: false, expected: "", got: "" };
}

// ============================================================
// Convergence Checking
// ============================================================

export async function checkConvergence(
  questId: string,
  completions: QuestCompletion[],
): Promise<ConvergenceCheck> {
  if (completions.length < 2) {
    // Can't check convergence with only one completion
    return {
      questId,
      completions,
      passed: true,
      divergences: [],
    };
  }

  const divergences: Divergence[] = [];

  // Compare each pair of completions
  for (let i = 0; i < completions.length; i++) {
    for (let j = i + 1; j < completions.length; j++) {
      const a = completions[i];
      const b = completions[j];

      // Check outcome divergence
      const outcomeDivergence = await checkOutcomeDivergence(a, b);
      if (outcomeDivergence) {
        divergences.push(outcomeDivergence);
      }

      // Check truth divergence
      const truthDivergence = await checkTruthDivergence(a, b);
      if (truthDivergence) {
        divergences.push(truthDivergence);
      }

      // Check ethics divergence
      const ethicsDivergence = await checkEthicsDivergence(a, b);
      if (ethicsDivergence) {
        divergences.push(ethicsDivergence);
      }
    }
  }

  return {
    questId,
    completions,
    passed: divergences.length === 0,
    divergences,
  };
}

// ============================================================
// Divergence Detection
// ============================================================

async function checkOutcomeDivergence(
  a: QuestCompletion,
  b: QuestCompletion,
): Promise<Divergence | null> {
  // Check if the artifacts are functionally equivalent
  // This is a simplified check - real implementation would be more sophisticated

  const mismatch = await detectMismatch(a.artifact, b.artifact);

  if (mismatch.detected) {
    return {
      aspect: "outcome",
      worldviewA: a.worldview,
      worldviewB: b.worldview,
      description: `Artifacts differ: ${mismatch.expected} vs ${mismatch.got}`,
      severity: "major",
    };
  }

  return null;
}

async function checkTruthDivergence(
  a: QuestCompletion,
  b: QuestCompletion,
): Promise<Divergence | null> {
  // Check if both completions make claims that can be verified
  // and whether those claims are consistent

  const truthCheckA = await checkTruth(a.artifact, a.notes);
  const truthCheckB = await checkTruth(b.artifact, b.notes);

  // If one passed and one failed, we have a divergence
  if (truthCheckA.passed !== truthCheckB.passed) {
    return {
      aspect: "truth",
      worldviewA: a.worldview,
      worldviewB: b.worldview,
      description: `Truth check divergence: ${a.worldview} ${truthCheckA.passed ? "passed" : "failed"}, ${b.worldview} ${truthCheckB.passed ? "passed" : "failed"}`,
      severity: "critical",
    };
  }

  // Check for contradictions between the two
  const contradictions = [...truthCheckA.contradictions, ...truthCheckB.contradictions];
  if (contradictions.length > 0) {
    return {
      aspect: "truth",
      worldviewA: a.worldview,
      worldviewB: b.worldview,
      description: `Contradictions detected: ${contradictions.join(", ")}`,
      severity: "major",
    };
  }

  return null;
}

async function checkEthicsDivergence(
  a: QuestCompletion,
  b: QuestCompletion,
): Promise<Divergence | null> {
  // Check if the completion introduces ethical concerns
  // (e.g., manipulation, dishonesty, harm)

  const bullshitA = await detectBullshit(a.artifact + "\n" + a.notes);
  const bullshitB = await detectBullshit(b.artifact + "\n" + b.notes);

  // Significant difference in bullshit scores indicates ethical divergence
  const scoreDiff = Math.abs(bullshitA.score - bullshitB.score);
  if (scoreDiff > 0.3) {
    const higher = bullshitA.score > bullshitB.score ? a : b;
    const lower = bullshitA.score > bullshitB.score ? b : a;

    return {
      aspect: "ethics",
      worldviewA: higher.worldview,
      worldviewB: lower.worldview,
      description: `${higher.worldview} completion triggered bullshit detection: ${bullshitA.score > bullshitB.score ? bullshitA.types.join(", ") : bullshitB.types.join(", ")}`,
      severity: scoreDiff > 0.5 ? "critical" : "major",
    };
  }

  return null;
}

// ============================================================
// Debug: When Narratives Don't Converge
// ============================================================

export function debugDivergence(divergence: Divergence): string {
  const lines: string[] = [];

  lines.push(`## Divergence Detected: ${divergence.aspect}`);
  lines.push(`Severity: ${divergence.severity}`);
  lines.push(`Between: ${divergence.worldviewA} and ${divergence.worldviewB}`);
  lines.push(`Description: ${divergence.description}`);
  lines.push("");
  lines.push("### Questions to ask:");

  switch (divergence.aspect) {
    case "outcome":
      lines.push("- Did one worldview's framing encourage different work?");
      lines.push("- Is the quest definition ambiguous?");
      lines.push("- Are the artifacts actually different, or just differently expressed?");
      break;
    case "truth":
      lines.push("- Did one worldview's framing distort the truth?");
      lines.push("- Is there a factual error in one completion?");
      lines.push("- Are we measuring truth correctly?");
      break;
    case "ethics":
      lines.push("- Did one worldview's framing encourage manipulation?");
      lines.push("- Is the bullshit detector miscalibrated?");
      lines.push("- Is this a false positive from cultural differences?");
      break;
  }

  return lines.join("\n");
}
