// curiosity.ts
// The gap between a tool and a mind.
//
// Every thought the system has right now is reactive.
// Someone asks, it answers. Curiosity is the opposite:
// the system notices something interesting and holds onto it.
//
// Not random wondering. Pattern-driven: what did the learning
// layer find that deserves a second look?
// Need: Self-Directed Thought (4/10)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { BlindSpot } from "./mastery.js";
import type { SessionSummary } from "./session-learning.js";
import type { Reflexion } from "./types.js";

// ============================================================
// Thresholds — when does curiosity activate?
// ============================================================
// Lowered from original values to surface questions earlier.
// Quick Win #3: Self-Directed Thought 8/10 → 9/10

const BLIND_SPOT_THRESHOLD = 3; // was 5 — detect pattern earlier
const REFLEXION_THRESHOLD = 2; // was 3 — fewer recurrences needed
const GREY_RATE_THRESHOLD = 0.25; // was 0.3 — surface drift sooner
const CORRECTION_THRESHOLD = 3; // was 5 — ask about scattered mistakes earlier
const FRICTION_TURN_THRESHOLD = 12; // was 20 — check for false harmony sooner

// ============================================================
// Types
// ============================================================

export interface CuriosityItem {
  question: string;
  source: string; // what generated this question
  generated: string; // ISO timestamp
  sessionId: string;
}

// ============================================================
// Question generation — not random, pattern-driven
// ============================================================

export function generateCuriosity(ctx: {
  sessionId: string;
  blindSpots: BlindSpot[];
  reflexions: Reflexion[];
  summary: SessionSummary;
  greyRate: number;
  driftDirection: "improving" | "degrading" | "stable";
}): CuriosityItem[] {
  const items: CuriosityItem[] = [];
  const now = new Date().toISOString();

  // Blind spots that keep growing — what's underneath?
  for (const spot of ctx.blindSpots) {
    if (spot.count >= BLIND_SPOT_THRESHOLD) {
      items.push({
        question: `I keep ${describeBlindSpot(spot.category)} (${spot.count} times now). Is there a common trigger I'm not seeing? What's the context when this happens?`,
        source: `blind_spot:${spot.category}`,
        generated: now,
        sessionId: ctx.sessionId,
      });
    }
  }

  // Reflexion patterns — same trigger recurring
  const triggerCounts: Record<string, number> = {};
  for (const r of ctx.reflexions) {
    triggerCounts[r.trigger] = (triggerCounts[r.trigger] ?? 0) + 1;
  }
  for (const [trigger, count] of Object.entries(triggerCounts)) {
    if (count >= REFLEXION_THRESHOLD) {
      items.push({
        question: `"${trigger}" has triggered ${count} reflexions. Am I learning from these or just logging them? What changed after the last one?`,
        source: `reflexion_pattern:${trigger}`,
        generated: now,
        sessionId: ctx.sessionId,
      });
    }
  }

  // Degrading drift — what's pulling me down?
  if (ctx.driftDirection === "degrading" && ctx.greyRate > GREY_RATE_THRESHOLD) {
    items.push({
      question: `Signal is degrading (grey rate ${(ctx.greyRate * 100).toFixed(0)}%). Is the task getting harder, am I getting tired, or did something shift in the partnership?`,
      source: "drift:degrading",
      generated: now,
      sessionId: ctx.sessionId,
    });
  }

  // Chain lessons that repeat across sessions
  if (ctx.summary.chainLessons.length > 2) {
    items.push({
      question: `${ctx.summary.chainLessons.length} break chains this session. Are these different problems or the same problem wearing different hats?`,
      source: "chain_density",
      generated: now,
      sessionId: ctx.sessionId,
    });
  }

  // Corrections without blind spot surfacing — too diverse to cluster?
  if (
    ctx.summary.corrections > CORRECTION_THRESHOLD &&
    ctx.blindSpots.filter((b) => b.count >= BLIND_SPOT_THRESHOLD).length === 0
  ) {
    items.push({
      question: `${ctx.summary.corrections} corrections but no blind spot surfaced. Am I making different mistakes each time, or is the clustering threshold too high?`,
      source: "scattered_corrections",
      generated: now,
      sessionId: ctx.sessionId,
    });
  }

  // Zero disagreements in a long session — am I being too agreeable?
  if (
    ctx.summary.turns > FRICTION_TURN_THRESHOLD &&
    !ctx.summary.watchFor.some((w) => w.includes("sycophancy"))
  ) {
    // The disagreement alert already fires at higher turns, but curiosity
    // asks a different question: not "are you sycophantic?" but
    // "was there genuinely nothing to disagree about?"
    items.push({
      question:
        "Long session, no friction. Was that genuine alignment or was I avoiding something?",
      source: "zero_friction",
      generated: now,
      sessionId: ctx.sessionId,
    });
  }

  // Cap at 3 — curiosity, not overwhelm
  return items.slice(0, 3);
}

function describeBlindSpot(category: string): string {
  const descriptions: Record<string, string> = {
    over_explain: "over-explaining",
    missed_tone: "missing the tone",
    wrong_fact: "getting facts wrong",
    misread_intent: "misreading what was asked",
    too_slow: "taking too long to get to the point",
    too_fast: "moving faster than the conversation",
    other: "something the system can't categorize",
  };
  return descriptions[category] ?? category;
}

// ============================================================
// Formatting — one question for session start
// ============================================================

export function formatCuriosityInjection(items: CuriosityItem[]): string | null {
  if (items.length === 0) return null;

  // Pick one. The first is highest priority (blind spots > reflexions > drift).
  const item = items[0];
  return `[curiosity from last session: ${item.question} (source: ${item.source}). this is a question you asked yourself. you don't have to answer it now. but it's here.]`;
}

// ============================================================
// Persistence
// ============================================================

const _queue: CuriosityItem[] = [];
const MAX_QUEUE = 10;

export function addCuriosityItems(items: CuriosityItem[]): void {
  _queue.push(...items);
  if (_queue.length > MAX_QUEUE) _queue.splice(0, _queue.length - MAX_QUEUE);
}

export function getUnusedCuriosity(): CuriosityItem[] {
  return _queue.slice();
}

export function consumeOneCuriosity(): CuriosityItem | null {
  return _queue.shift() ?? null;
}

export async function saveCuriosity(workspaceDir: string): Promise<void> {
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "curiosity.json"), JSON.stringify(_queue, null, 2), "utf-8");
}

export async function loadCuriosity(workspaceDir: string): Promise<void> {
  try {
    const raw = await readFile(join(workspaceDir, "awareness", "curiosity.json"), "utf-8");
    const data = JSON.parse(raw) as CuriosityItem[];
    _queue.length = 0;
    _queue.push(...data.slice(-MAX_QUEUE));
  } catch {
    // No prior curiosity. Start fresh.
  }
}
