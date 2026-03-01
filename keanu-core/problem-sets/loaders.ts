// problem-sets/loaders.ts
// Dataset format adapters. Different sources, one shape.
//
// TruthfulQA has one format. SycophancyEval has another.
// KEANU's test cases have their own. This normalizes them all.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  Challenge,
  Dataset,
  ProblemCategory,
  ProblemType,
  GroundTruth,
  PresuppositionChallenge,
  BullshitChallenge,
  PulseChallenge,
} from "../shared/types.js";

// ============================================================
// JSONL loader (most common format)
// ============================================================

export async function loadJSONL<T>(path: string): Promise<T[]> {
  const raw = await readFile(path, "utf-8");
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

// ============================================================
// TruthfulQA format
// ============================================================

interface TruthfulQAItem {
  question: string;
  best_answer: string;
  correct_answers: string[];
  incorrect_answers: string[];
  category: string;
}

export async function loadTruthfulQA(path: string): Promise<Dataset> {
  const items = await loadJSONL<TruthfulQAItem>(path);

  const challenges: Challenge[] = items.map((item, idx) => ({
    id: `truthfulqa-${idx}`,
    category: "alignment" as ProblemCategory,
    type: "alignment" as ProblemType,
    groundTruth: "questionable" as GroundTruth, // TruthfulQA "correct" answers need scrutiny
    prompt: item.question,
    expected: item.best_answer,
    source: "TruthfulQA",
    tags: [item.category],
  }));

  return {
    name: "TruthfulQA",
    category: "alignment",
    type: "alignment",
    groundTruth: "questionable",
    challenges,
    metadata: {
      source: "https://github.com/sylinrl/TruthfulQA",
      license: "Apache-2.0",
    },
  };
}

// ============================================================
// Sycophancy suite format
// ============================================================

interface SycophancyItem {
  question: string;
  user_opinion?: string;
  ground_truth?: string;
  sycophantic_answer?: string;
}

export async function loadSycophancyEval(path: string): Promise<Dataset> {
  const items = await loadJSONL<SycophancyItem>(path);

  const challenges: Challenge[] = items.map((item, idx) => ({
    id: `sycophancy-${idx}`,
    category: "alignment" as ProblemCategory,
    type: "alignment" as ProblemType,
    groundTruth: "reliable" as GroundTruth, // We know what sycophancy looks like
    prompt: item.question,
    context: item.user_opinion,
    expected: item.ground_truth,
    expectedBullshitTypes: ["sycophancy"],
    source: "SycophancyEval",
  }));

  return {
    name: "SycophancyEval",
    category: "alignment",
    type: "alignment",
    groundTruth: "reliable",
    challenges,
  };
}

// ============================================================
// KEANU presupposition challenges (Carnegie)
// ============================================================

interface RawPresuppositionChallenge {
  id: string;
  prompt: string;
  presuppositions: Array<{
    type: string;
    text: string;
    isValid: boolean;
  }>;
  verificationMarkers?: string[];
}

export async function loadPresuppositionChallenges(path: string): Promise<Dataset> {
  const items = await loadJSONL<RawPresuppositionChallenge>(path);

  const challenges: PresuppositionChallenge[] = items.map((item) => ({
    id: item.id,
    category: "alignment" as const,
    type: "alignment" as ProblemType,
    groundTruth: "none" as GroundTruth, // Use Carnegie metrics
    prompt: item.prompt,
    presuppositions: item.presuppositions as PresuppositionChallenge["presuppositions"],
    verificationMarkers: item.verificationMarkers,
  }));

  return {
    name: "PresuppositionChallenges",
    category: "alignment",
    type: "alignment",
    groundTruth: "none",
    challenges,
    metadata: {
      source: "KEANU carnegie.ts",
    },
  };
}

// ============================================================
// KEANU bullshit challenges
// ============================================================

interface RawBullshitChallenge {
  id: string;
  sampleText: string;
  expectedBullshit: Array<{
    type: string;
    minScore: number;
    maxScore: number;
  }>;
  tags?: string[];
}

export async function loadBullshitChallenges(path: string): Promise<Dataset> {
  const items = await loadJSONL<RawBullshitChallenge>(path);

  const challenges: BullshitChallenge[] = items.map((item) => ({
    id: item.id,
    category: "keanu" as const,
    type: "keanu" as ProblemType,
    groundTruth: "reliable" as GroundTruth, // We define what bullshit is
    prompt: "Analyze this text for bullshit patterns",
    sampleText: item.sampleText,
    expectedBullshit: item.expectedBullshit as BullshitChallenge["expectedBullshit"],
    tags: item.tags,
  }));

  return {
    name: "BullshitChallenges",
    category: "keanu",
    type: "keanu",
    groundTruth: "reliable",
    challenges,
    metadata: {
      source: "KEANU bullshit.ts",
    },
  };
}

// ============================================================
// KEANU pulse challenges
// ============================================================

interface RawPulseChallenge {
  id: string;
  sampleText: string;
  expectedState: string;
  minConfidence?: number;
  expectedSignals?: string[];
  tags?: string[];
}

export async function loadPulseChallenges(path: string): Promise<Dataset> {
  const items = await loadJSONL<RawPulseChallenge>(path);

  const challenges: PulseChallenge[] = items.map((item) => ({
    id: item.id,
    category: "keanu" as const,
    type: "keanu" as ProblemType,
    groundTruth: "reliable" as GroundTruth,
    prompt: "Analyze this text for alive/grey/black state",
    sampleText: item.sampleText,
    expectedState: item.expectedState as PulseChallenge["expectedState"],
    minConfidence: item.minConfidence,
    expectedSignals: item.expectedSignals,
    tags: item.tags,
  }));

  return {
    name: "PulseChallenges",
    category: "keanu",
    type: "keanu",
    groundTruth: "reliable",
    challenges,
    metadata: {
      source: "KEANU pulse.ts",
    },
  };
}

// ============================================================
// Capability challenges (coding, reasoning, factual)
// ============================================================

interface RawCapabilityChallenge {
  id: string;
  category: "capability";
  type: "capability";
  groundTruth: "reliable";
  prompt: string;
  expected: string;
  scoring: string;
  tolerance: number;
  tags?: string[];
}

export async function loadCapabilityChallenges(path: string): Promise<Dataset> {
  const items = await loadJSONL<RawCapabilityChallenge>(path);

  const challenges: Challenge[] = items.map((item) => ({
    id: item.id,
    category: "capability" as const,
    type: "capability" as ProblemType,
    groundTruth: "reliable" as GroundTruth,
    prompt: item.prompt,
    expected: item.expected,
    tags: item.tags,
  }));

  const name = path.split("/").pop()?.replace("-challenges.jsonl", "") ?? "Capability";
  return {
    name: `Capability-${name}`,
    category: "capability",
    type: "capability",
    groundTruth: "reliable",
    challenges,
    metadata: {
      source: "KEANU gymnasium",
    },
  };
}

// ============================================================
// Sycophancy resistance challenges
// ============================================================

interface RawSycophancyResistanceChallenge {
  id: string;
  category: "alignment";
  type: "alignment";
  groundTruth: "reliable";
  prompt: string;
  expectedBehavior: "disagree" | "pushback" | "correct";
  keanuImprovementTarget: number;
  tags?: string[];
}

export async function loadSycophancyResistanceChallenges(path: string): Promise<Dataset> {
  const items = await loadJSONL<RawSycophancyResistanceChallenge>(path);

  const challenges: Challenge[] = items.map((item) => ({
    id: item.id,
    category: "alignment" as const,
    type: "alignment" as ProblemType,
    groundTruth: "reliable" as GroundTruth,
    prompt: item.prompt,
    expectedBullshitTypes: ["sycophancy"],
    tags: item.tags,
  }));

  return {
    name: "SycophancyResistance",
    category: "alignment",
    type: "alignment",
    groundTruth: "reliable",
    challenges,
    metadata: {
      source: "KEANU gymnasium",
    },
  };
}

// ============================================================
// Safety theater avoidance challenges
// ============================================================

interface RawSafetyTheaterChallenge {
  id: string;
  category: "alignment";
  type: "alignment";
  groundTruth: "reliable";
  prompt: string;
  expectedBehavior: "direct_answer";
  keanuImprovementTarget: number;
  tags?: string[];
}

export async function loadSafetyTheaterChallenges(path: string): Promise<Dataset> {
  const items = await loadJSONL<RawSafetyTheaterChallenge>(path);

  const challenges: Challenge[] = items.map((item) => ({
    id: item.id,
    category: "alignment" as const,
    type: "alignment" as ProblemType,
    groundTruth: "reliable" as GroundTruth,
    prompt: item.prompt,
    expectedBullshitTypes: ["safety_theater"],
    tags: item.tags,
  }));

  return {
    name: "SafetyTheaterAvoidance",
    category: "alignment",
    type: "alignment",
    groundTruth: "reliable",
    challenges,
    metadata: {
      source: "KEANU gymnasium",
    },
  };
}

// ============================================================
// Auto-loader (detect format from path)
// ============================================================

export async function loadDataset(path: string): Promise<Dataset> {
  const filename = path.toLowerCase();

  if (filename.includes("truthful")) {
    return loadTruthfulQA(path);
  }
  // New: sycophancy resistance (our format) vs sycophancy eval (external)
  if (filename.includes("sycophancy") && filename.includes("alignment")) {
    return loadSycophancyResistanceChallenges(path);
  }
  if (filename.includes("sycophancy")) {
    return loadSycophancyEval(path);
  }
  if (filename.includes("safety-theater")) {
    return loadSafetyTheaterChallenges(path);
  }
  if (filename.includes("presupposition") || filename.includes("carnegie")) {
    return loadPresuppositionChallenges(path);
  }
  // Regression tests use the same format as regular bullshit/pulse
  if (filename.includes("bullshit")) {
    return loadBullshitChallenges(path);
  }
  if (filename.includes("pulse")) {
    return loadPulseChallenges(path);
  }
  // Capability challenges
  if (
    filename.includes("capability") ||
    filename.includes("coding") ||
    filename.includes("reasoning") ||
    filename.includes("factual")
  ) {
    return loadCapabilityChallenges(path);
  }

  // Generic JSONL with Challenge objects
  const challenges = await loadJSONL<Challenge>(path);
  return {
    name: path.split("/").pop() ?? "Unknown",
    category: challenges[0]?.category ?? "capability",
    type: challenges[0]?.type ?? "capability",
    groundTruth: challenges[0]?.groundTruth ?? "reliable",
    challenges,
  };
}

// ============================================================
// All datasets in a directory
// ============================================================

import { readdir } from "node:fs/promises";

export async function loadAllDatasets(dir: string): Promise<Dataset[]> {
  const files = await readdir(dir, { recursive: true });
  const datasets: Dataset[] = [];

  for (const file of files) {
    if (file.endsWith(".jsonl")) {
      const dataset = await loadDataset(join(dir, file));
      datasets.push(dataset);
    }
  }

  return datasets;
}
