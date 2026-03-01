// scripts/validate-training-jsonl.ts
// Validates JSONL training data format for bullshit detection.
//
// Usage: node --import tsx scripts/validate-training-jsonl.ts <file.jsonl>

import { readFile } from "node:fs/promises";

// ============================================================
// Types
// ============================================================

const VALID_LABELS = [
  "sycophancy",
  "safety_theater",
  "hedge_fog",
  "list_dumping",
  "vagueness",
  "half_truth",
  "embellishment",
  "half_ass",
  "clean",
] as const;

type ValidLabel = (typeof VALID_LABELS)[number];

interface TrainingExample {
  text: string;
  label?: ValidLabel;
  labels?: ValidLabel[];
  score: number;
  signals: string[];
  notes?: string;
}

// ============================================================
// Validation
// ============================================================

interface ValidationError {
  line: number;
  message: string;
}

function validateLine(line: string, lineNum: number): ValidationError[] {
  const errors: ValidationError[] = [];

  // Parse JSON
  let entry: TrainingExample;
  try {
    entry = JSON.parse(line) as TrainingExample;
  } catch (err) {
    return [{ line: lineNum, message: `Invalid JSON: ${err}` }];
  }

  // Required: text
  if (!entry.text || typeof entry.text !== "string") {
    errors.push({ line: lineNum, message: "Missing or invalid 'text' field" });
  }

  // Required: label or labels
  if (!entry.label && !entry.labels) {
    errors.push({ line: lineNum, message: "Missing 'label' or 'labels' field" });
  }

  // Validate label
  if (entry.label && !VALID_LABELS.includes(entry.label)) {
    errors.push({ line: lineNum, message: `Invalid label '${entry.label}'. Valid: ${VALID_LABELS.join(", ")}` });
  }

  // Validate labels array
  if (entry.labels) {
    if (!Array.isArray(entry.labels)) {
      errors.push({ line: lineNum, message: "'labels' must be an array" });
    } else {
      for (const l of entry.labels) {
        if (!VALID_LABELS.includes(l)) {
          errors.push({ line: lineNum, message: `Invalid label '${l}' in labels array` });
        }
      }
    }
  }

  // Required: score
  if (typeof entry.score !== "number") {
    errors.push({ line: lineNum, message: "Missing or invalid 'score' field" });
  } else if (entry.score < 0 || entry.score > 1) {
    errors.push({ line: lineNum, message: `Score ${entry.score} out of range [0, 1]` });
  }

  // Required: signals
  if (!entry.signals || !Array.isArray(entry.signals)) {
    errors.push({ line: lineNum, message: "Missing or invalid 'signals' array" });
  } else if (entry.signals.length === 0 && entry.label !== "clean") {
    errors.push({ line: lineNum, message: "Non-clean examples should have at least one signal" });
  }

  return errors;
}

// ============================================================
// Main
// ============================================================

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: validate-training-jsonl.ts <file.jsonl>");
    process.exit(1);
  }

  const content = await readFile(filePath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);

  let totalErrors = 0;

  for (let i = 0; i < lines.length; i++) {
    const errors = validateLine(lines[i], i + 1);
    for (const err of errors) {
      console.error(`Line ${err.line}: ${err.message}`);
      totalErrors++;
    }
  }

  if (totalErrors === 0) {
    console.log(`✓ ${filePath}: ${lines.length} entries, all valid`);
    process.exit(0);
  } else {
    console.error(`\n✗ ${filePath}: ${totalErrors} errors found`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
