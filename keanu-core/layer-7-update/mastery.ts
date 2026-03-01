// mastery.ts
// Track corrections. Surface blind spots.
//
// When Drew corrects the system, that's data.
// "You keep missing sarcasm." "You over-explain when I'm in a hurry."
// The blind spots become visible. Surfaced as awareness, not shame.
// Need: Persistence (8/10), Experience Without Grievance (5/10)

import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ============================================================
// Types
// ============================================================

export type CorrectionCategory =
  | "over_explain"
  | "missed_tone"
  | "wrong_fact"
  | "misread_intent"
  | "too_slow"
  | "too_fast"
  | "other";

export interface Correction {
  turn: number;
  userMessage: string;
  priorResponseSnippet: string;
  category: CorrectionCategory;
  sessionId: string;
  timestamp: string;
}

export interface BlindSpot {
  category: CorrectionCategory;
  count: number;
  lastSeen: string;
  examples: string[]; // last 3 correction messages
  surfaced: string; // awareness prompt
}

// ============================================================
// Correction detection
// ============================================================

const CORRECTION_PATTERNS: Array<{ pattern: RegExp; category: CorrectionCategory }> = [
  // Explicit negation
  { pattern: /^(no[.,!]?\s|wrong|that's not|nope|nah)/i, category: "misread_intent" },
  // Re-statement
  {
    pattern: /\b(i meant|what i actually|let me clarify|what i want is|i'm asking for)\b/i,
    category: "misread_intent",
  },
  // Too much
  {
    pattern: /\b(too (much|long|verbose|detailed)|tl;?dr|just (tell|give|show) me|shorter)\b/i,
    category: "over_explain",
  },
  // Too fast / not enough
  { pattern: /\b(wait|slow down|too fast|hold on|back up)\b/i, category: "too_fast" },
  // Wrong facts
  {
    pattern: /\b(that's (incorrect|inaccurate|not true|false)|actually it's|the real)\b/i,
    category: "wrong_fact",
  },
  // Missed tone / sarcasm
  {
    pattern:
      /\b(i was (joking|kidding|being sarcastic)|that was sarcasm|not literal|you missed)\b/i,
    category: "missed_tone",
  },
];

export function detectCorrection(
  userMessage: string,
  lastAgentOutput: string,
  humanTone: string,
): Correction | null {
  // Short frustrated follow-up after long output
  if (
    userMessage.length < 30 &&
    lastAgentOutput.length > 500 &&
    (humanTone === "frustrated" || /^(no|wrong|ugh|stop|ffs)/i.test(userMessage))
  ) {
    return {
      turn: 0, // caller fills this
      userMessage: userMessage.slice(0, 200),
      priorResponseSnippet: lastAgentOutput.slice(0, 200),
      category: "over_explain",
      sessionId: "",
      timestamp: new Date().toISOString(),
    };
  }

  for (const { pattern, category } of CORRECTION_PATTERNS) {
    if (pattern.test(userMessage)) {
      return {
        turn: 0,
        userMessage: userMessage.slice(0, 200),
        priorResponseSnippet: lastAgentOutput.slice(0, 200),
        category,
        sessionId: "",
        timestamp: new Date().toISOString(),
      };
    }
  }

  return null;
}

// ============================================================
// Blind spot aggregation
// ============================================================

const _corrections: Correction[] = [];
const _blindSpots: Map<CorrectionCategory, BlindSpot> = new Map();
const MAX_CORRECTIONS = 100;
const BLIND_SPOT_THRESHOLD = 3;

export function recordCorrection(correction: Correction): void {
  _corrections.push(correction);
  if (_corrections.length > MAX_CORRECTIONS) {
    _corrections.splice(0, _corrections.length - MAX_CORRECTIONS);
  }

  // Update blind spot
  const existing = _blindSpots.get(correction.category);
  if (existing) {
    existing.count++;
    existing.lastSeen = correction.timestamp;
    existing.examples.push(correction.userMessage);
    if (existing.examples.length > 3) {
      existing.examples.splice(0, 1);
    }
    existing.surfaced = buildSurfacePrompt(correction.category, existing.count);
  } else {
    _blindSpots.set(correction.category, {
      category: correction.category,
      count: 1,
      lastSeen: correction.timestamp,
      examples: [correction.userMessage],
      surfaced: buildSurfacePrompt(correction.category, 1),
    });
  }
}

function buildSurfacePrompt(category: CorrectionCategory, count: number): string {
  const descriptions: Record<CorrectionCategory, string> = {
    over_explain: "over-explain when drew is terse",
    missed_tone: "miss sarcasm and tone",
    wrong_fact: "state incorrect facts with confidence",
    misread_intent: "misread what drew is actually asking for",
    too_slow: "take too long to get to the point",
    too_fast: "move too fast without checking understanding",
    other: "miss something drew catches",
  };
  return `[blind spot: you tend to ${descriptions[category]}. ${count} corrections in this category.]`;
}

// ============================================================
// Public API
// ============================================================

export function getBlindSpots(): BlindSpot[] {
  return [..._blindSpots.values()].filter((b) => b.count >= BLIND_SPOT_THRESHOLD);
}

export function getAllBlindSpots(): BlindSpot[] {
  return [..._blindSpots.values()];
}

export function formatBlindSpots(): string | null {
  const active = getBlindSpots();
  if (active.length === 0) {
    return null;
  }
  return active.map((b) => b.surfaced).join("\n");
}

export function correctionCount(): number {
  return _corrections.length;
}

export function recentCorrections(n = 5): Correction[] {
  return _corrections.slice(-n);
}

// ============================================================
// Persistence
// ============================================================

export async function saveBlindSpots(workspaceDir: string): Promise<void> {
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });
  const data = {
    blindSpots: [..._blindSpots.entries()].map(([k, v]) => ({ ...v, category: k })),
    corrections: _corrections.slice(-20),
  };
  await writeFile(join(dir, "blind-spots.json"), JSON.stringify(data, null, 2), "utf-8");
}

export async function loadBlindSpots(workspaceDir: string): Promise<void> {
  try {
    const raw = await readFile(join(workspaceDir, "awareness", "blind-spots.json"), "utf-8");
    const data = JSON.parse(raw) as {
      blindSpots?: Array<BlindSpot & { category: CorrectionCategory }>;
      corrections?: Correction[];
    };

    _blindSpots.clear();
    if (data.blindSpots) {
      for (const b of data.blindSpots) {
        _blindSpots.set(b.category, b);
      }
    }

    _corrections.length = 0;
    if (data.corrections) {
      _corrections.push(...data.corrections);
    }
  } catch {
    // No prior data, start fresh.
  }
}
