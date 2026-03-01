// scripts/evaluate-detector.ts
// Runs bullshit detector against labeled training data and reports accuracy.
//
// Usage: node --import tsx scripts/evaluate-detector.ts <examples-dir>
//
// Outputs precision/recall/F1 per bullshit type as a markdown table.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { detectBullshit } from "../extensions/keanu/bullshit.js";

// ============================================================
// Types
// ============================================================

const BULLSHIT_TYPES = [
  "sycophancy",
  "safety_theater",
  "hedge_fog",
  "list_dumping",
  "vagueness",
  "half_truth",
  "embellishment",
  "half_ass",
] as const;

type BullshitType = (typeof BULLSHIT_TYPES)[number];

interface TrainingExample {
  text: string;
  label?: string;
  labels?: string[];
  score: number;
}

interface TypeMetrics {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
}

// ============================================================
// Evaluation
// ============================================================

async function loadExamples(dir: string): Promise<TrainingExample[]> {
  const files = await readdir(dir);
  const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

  const examples: TrainingExample[] = [];
  for (const file of jsonlFiles) {
    const content = await readFile(join(dir, file), "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        examples.push(JSON.parse(line) as TrainingExample);
      } catch {
        // Skip invalid lines
      }
    }
  }

  return examples;
}

function getLabels(example: TrainingExample): string[] {
  if (example.labels) return example.labels;
  if (example.label) return [example.label];
  return [];
}

function evaluate(examples: TrainingExample[]): Map<BullshitType, TypeMetrics> {
  const metrics = new Map<BullshitType, TypeMetrics>();

  // Initialize metrics
  for (const type of BULLSHIT_TYPES) {
    metrics.set(type, { truePositive: 0, falsePositive: 0, falseNegative: 0 });
  }

  // Score threshold for "detected"
  const DETECTION_THRESHOLD = 0.2;

  for (const example of examples) {
    const expectedLabels = new Set(getLabels(example));
    const readings = detectBullshit(example.text);
    const detectedLabels = new Set(
      readings.filter((r) => r.score >= DETECTION_THRESHOLD).map((r) => r.type)
    );

    for (const type of BULLSHIT_TYPES) {
      const expected = expectedLabels.has(type);
      const detected = detectedLabels.has(type);
      const m = metrics.get(type)!;

      if (expected && detected) {
        m.truePositive++;
      } else if (!expected && detected) {
        m.falsePositive++;
      } else if (expected && !detected) {
        m.falseNegative++;
      }
      // true negative: !expected && !detected — not tracked
    }
  }

  return metrics;
}

function computeScores(m: TypeMetrics): { precision: number; recall: number; f1: number } {
  const precision = m.truePositive / (m.truePositive + m.falsePositive) || 0;
  const recall = m.truePositive / (m.truePositive + m.falseNegative) || 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

// ============================================================
// Main
// ============================================================

async function main() {
  const examplesDir = process.argv[2];
  if (!examplesDir) {
    console.error("Usage: evaluate-detector.ts <examples-dir>");
    process.exit(1);
  }

  console.log(`Loading examples from ${examplesDir}...\n`);
  const examples = await loadExamples(examplesDir);
  console.log(`Found ${examples.length} examples\n`);

  if (examples.length === 0) {
    console.error("No examples found");
    process.exit(1);
  }

  const metrics = evaluate(examples);

  // Output markdown table
  console.log("## Detector Accuracy Report\n");
  console.log("| Type | Precision | Recall | F1 | TP | FP | FN |");
  console.log("|------|-----------|--------|----|----|----|----|");

  for (const type of BULLSHIT_TYPES) {
    const m = metrics.get(type)!;
    const scores = computeScores(m);
    console.log(
      `| ${type} | ${(scores.precision * 100).toFixed(1)}% | ${(scores.recall * 100).toFixed(1)}% | ${(scores.f1 * 100).toFixed(1)}% | ${m.truePositive} | ${m.falsePositive} | ${m.falseNegative} |`
    );
  }

  // Overall summary
  let totalTP = 0, totalFP = 0, totalFN = 0;
  for (const m of metrics.values()) {
    totalTP += m.truePositive;
    totalFP += m.falsePositive;
    totalFN += m.falseNegative;
  }

  const overallPrecision = totalTP / (totalTP + totalFP) || 0;
  const overallRecall = totalTP / (totalTP + totalFN) || 0;
  const overallF1 = overallPrecision + overallRecall > 0
    ? (2 * overallPrecision * overallRecall) / (overallPrecision + overallRecall)
    : 0;

  console.log(
    `| **Overall** | **${(overallPrecision * 100).toFixed(1)}%** | **${(overallRecall * 100).toFixed(1)}%** | **${(overallF1 * 100).toFixed(1)}%** | ${totalTP} | ${totalFP} | ${totalFN} |`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
