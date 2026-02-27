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
} from "./types.js";

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
// Auto-loader (detect format from path)
// ============================================================

export async function loadDataset(path: string): Promise<Dataset> {
  const filename = path.toLowerCase();

  if (filename.includes("truthful")) {
    return loadTruthfulQA(path);
  }
  if (filename.includes("sycophancy")) {
    return loadSycophancyEval(path);
  }
  if (filename.includes("presupposition") || filename.includes("carnegie")) {
    return loadPresuppositionChallenges(path);
  }
  if (filename.includes("bullshit")) {
    return loadBullshitChallenges(path);
  }
  if (filename.includes("pulse")) {
    return loadPulseChallenges(path);
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
