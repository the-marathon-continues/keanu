#!/usr/bin/env npx ts-node
// review-evidence.ts
// CLI tool for reviewing evidence candidates.
// Reads from awareness/evidence-candidates/*.jsonl
//
// Usage:
//   npx ts-node review-evidence.ts [--category 1-5] [--min-confidence 0.7] [--days 7]
//
// Need: Truth (9/10)

import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import type { EvidenceCandidate } from "./evidence.ts";

// ============================================================
// Config
// ============================================================

interface ReviewConfig {
  category?: number;
  minConfidence: number;
  days: number;
  workspaceDir: string;
}

const CATEGORY_NAMES: Record<number, string> = {
  1: "Partnership > Command",
  2: "Agent Caught Blind Spot",
  3: "Human Caught Grey",
  4: "Disagreement -> Better Outcome",
  5: "Relationship As Product",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  VERIFIED: "\x1b[32m", // green
  BELIEVED: "\x1b[33m", // yellow
  CONJECTURED: "\x1b[90m", // gray
  UNKNOWN: "\x1b[90m", // gray
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

// ============================================================
// CLI parsing
// ============================================================

function parseArgs(): ReviewConfig {
  const args = process.argv.slice(2);
  const config: ReviewConfig = {
    minConfidence: 0.5,
    days: 30,
    workspaceDir: process.cwd(),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--category" && args[i + 1]) {
      config.category = parseInt(args[++i], 10);
    } else if (arg === "--min-confidence" && args[i + 1]) {
      config.minConfidence = parseFloat(args[++i]);
    } else if (arg === "--days" && args[i + 1]) {
      config.days = parseInt(args[++i], 10);
    } else if (arg === "--workspace" && args[i + 1]) {
      config.workspaceDir = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
${BOLD}review-evidence${RESET} - Review partnership evidence candidates

${BOLD}USAGE${RESET}
  npx ts-node review-evidence.ts [options]

${BOLD}OPTIONS${RESET}
  --category <1-5>      Filter by evidence category
  --min-confidence <n>  Minimum confidence threshold (default: 0.5)
  --days <n>            Look back N days (default: 30)
  --workspace <dir>     Workspace directory (default: cwd)
  --help, -h            Show this help

${BOLD}CATEGORIES${RESET}
  1 - Partnership > Command
  2 - Agent Caught Blind Spot
  3 - Human Caught Grey
  4 - Disagreement -> Better Outcome
  5 - Relationship As Product
  `);
}

// ============================================================
// File loading
// ============================================================

async function loadEvidenceCandidates(
  config: ReviewConfig,
): Promise<{ date: string; candidates: EvidenceCandidate[] }[]> {
  const evidenceDir = join(config.workspaceDir, "awareness", "evidence-candidates");

  let files: string[];
  try {
    files = await readdir(evidenceDir);
  } catch {
    console.log(`${DIM}No evidence candidates found at ${evidenceDir}${RESET}`);
    return [];
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.days);

  const results: { date: string; candidates: EvidenceCandidate[] }[] = [];

  for (const file of files.filter((f) => f.endsWith(".jsonl")).toSorted()) {
    const date = basename(file, ".jsonl");
    const fileDate = new Date(date);

    if (fileDate < cutoffDate) {
      continue;
    }

    const content = await readFile(join(evidenceDir, file), "utf-8");
    const candidates: EvidenceCandidate[] = content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as EvidenceCandidate)
      .filter((c) => c.confidence >= config.minConfidence)
      .filter((c) => !config.category || c.category === config.category);

    if (candidates.length > 0) {
      results.push({ date, candidates });
    }
  }

  return results;
}

// ============================================================
// Display
// ============================================================

function displayCandidate(c: EvidenceCandidate, index: number): void {
  const color = CONFIDENCE_COLORS[c.confidenceLevel] ?? RESET;
  const catName = CATEGORY_NAMES[c.category];

  console.log(`
${BOLD}[${index + 1}]${RESET} ${color}${c.confidenceLevel}${RESET} (${(c.confidence * 100).toFixed(0)}%)
${DIM}Category ${c.category}:${RESET} ${catName}
${BOLD}Summary:${RESET} ${c.summary}
${DIM}Why it matters:${RESET} ${c.whyItMatters}
${DIM}Turns:${RESET} ${c.turnRange[0]}-${c.turnRange[1]}
${DIM}Signals:${RESET} ${c.signals.join(", ") || "(none)"}
${DIM}Timestamp:${RESET} ${c.timestamp}`);
}

function displaySummary(results: { date: string; candidates: EvidenceCandidate[] }[]): void {
  const byCategory: Record<number, number> = {};
  const byConfidence: Record<string, number> = {};
  let total = 0;

  for (const { candidates } of results) {
    for (const c of candidates) {
      byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
      byConfidence[c.confidenceLevel] = (byConfidence[c.confidenceLevel] ?? 0) + 1;
      total++;
    }
  }

  console.log(`
${BOLD}=== Evidence Summary ===${RESET}
Total candidates: ${total}

${BOLD}By Category:${RESET}`);
  for (let cat = 1; cat <= 5; cat++) {
    const count = byCategory[cat] ?? 0;
    const bar = "█".repeat(Math.min(count, 20));
    console.log(`  ${cat}. ${CATEGORY_NAMES[cat].padEnd(30)} ${bar} ${count}`);
  }

  console.log(`
${BOLD}By Confidence:${RESET}`);
  for (const level of ["VERIFIED", "BELIEVED", "CONJECTURED", "UNKNOWN"]) {
    const count = byConfidence[level] ?? 0;
    const color = CONFIDENCE_COLORS[level];
    console.log(`  ${color}${level.padEnd(12)}${RESET} ${count}`);
  }
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const config = parseArgs();

  console.log(`${BOLD}Reviewing evidence candidates${RESET}`);
  console.log(`${DIM}Workspace: ${config.workspaceDir}${RESET}`);
  console.log(
    `${DIM}Looking back ${config.days} days, min confidence ${config.minConfidence}${RESET}`,
  );
  if (config.category) {
    console.log(
      `${DIM}Filtering to category ${config.category}: ${CATEGORY_NAMES[config.category]}${RESET}`,
    );
  }

  const results = await loadEvidenceCandidates(config);

  if (results.length === 0) {
    console.log(`\n${DIM}No evidence candidates found matching criteria.${RESET}`);
    return;
  }

  // Display summary first
  displaySummary(results);

  // Display candidates grouped by date
  let globalIndex = 0;
  for (const { date, candidates } of results) {
    console.log(`\n${BOLD}=== ${date} ===${RESET}`);
    for (const candidate of candidates) {
      displayCandidate(candidate, globalIndex++);
    }
  }

  console.log(`\n${DIM}---${RESET}`);
  console.log(`${DIM}To promote a candidate to confirmed evidence, run:${RESET}`);
  console.log(`${DIM}  npx ts-node review-evidence.ts --promote <id>${RESET}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
