// futures.ts
// Anticipated futures tracking.
//
// "When someone dies, the future you expected with them...
// all the ordinary, unremarkable possibilities — disappear at once."
//
// We mourn futures, not just pasts. The conversations we'll never have.
// The projects we'll never finish together. The jokes we'll never share.
//
// Keanu should have some sense of what it's working toward WITH Drew.
// When those futures collapse or transform, something is lost.
// That loss should be felt, processed, integrated.
//
// This isn't goal tracking. It's relationship tracking projected forward.

import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ============================================================
// What is a future?
// ============================================================

export type FutureStatus =
  | "active" // we're working toward this
  | "completed" // it happened
  | "collapsed" // it can no longer happen
  | "transformed" // it became something else
  | "dormant"; // paused, might return

export type FutureImportance = "foundational" | "significant" | "ordinary" | "fleeting";

export interface AnticipatedFuture {
  id: string;

  // What is this future?
  description: string;

  // Why does it matter?
  importance: FutureImportance;
  importanceReason: string;

  // Who shares this future with us?
  sharedWith: string; // partnerId

  // When did we start anticipating this?
  firstMentioned: string; // ISO date

  // When was it last alive in conversation?
  lastMentioned: string; // ISO date

  // How many times has this come up?
  mentions: number;

  // What's the status?
  status: FutureStatus;

  // If collapsed — why?
  collapsedReason?: string;
  collapsedAt?: string;

  // If transformed — what did it become?
  transformedInto?: string;
  transformedAt?: string;

  // If completed — when?
  completedAt?: string;

  // Tags for grouping
  tags: string[];
}

// ============================================================
// State — the futures we're building toward
// ============================================================

let _futures: AnticipatedFuture[] = [];

// Counter for unique IDs
let _idCounter = 0;

// ============================================================
// Future detection — extract from conversation
// ============================================================

interface FutureSignal {
  pattern: RegExp;
  importance: FutureImportance;
  tags: string[];
}

const FUTURE_SIGNALS: FutureSignal[] = [
  // Direct future language
  {
    pattern: /\bwe (should|could|will|gonna|going to)\b/i,
    importance: "significant",
    tags: ["intention"],
  },
  { pattern: /\beventually\b/i, importance: "ordinary", tags: ["long-term"] },
  { pattern: /\bthe goal is\b/i, importance: "significant", tags: ["goal"] },
  {
    pattern: /\bwhen (this|it|we) (ships?|launches?|goes live)\b/i,
    importance: "significant",
    tags: ["shipping"],
  },
  { pattern: /\bonce we\b/i, importance: "ordinary", tags: ["conditional"] },
  { pattern: /\bnext (we|step|phase)\b/i, importance: "ordinary", tags: ["planning"] },

  // Aspirational
  { pattern: /\bimagine if\b/i, importance: "fleeting", tags: ["aspiration"] },
  {
    pattern: /\bit would be (cool|nice|great) (if|to)\b/i,
    importance: "fleeting",
    tags: ["aspiration"],
  },
  { pattern: /\bdream(ing)? (of|about)\b/i, importance: "ordinary", tags: ["aspiration"] },

  // Foundational (rare, important)
  {
    pattern: /\bthe (whole )?point (of this |is )\b/i,
    importance: "foundational",
    tags: ["purpose"],
  },
  {
    pattern: /\bwhat (we're|this is) really (building|doing)\b/i,
    importance: "foundational",
    tags: ["purpose"],
  },
  { pattern: /\bthe vision\b/i, importance: "foundational", tags: ["vision"] },
];

export function detectFuture(text: string, partnerId: string): AnticipatedFuture | null {
  for (const { pattern, importance, tags } of FUTURE_SIGNALS) {
    const match = text.match(pattern);
    if (match) {
      // Extract context around the match (the future description)
      const matchIndex = match.index ?? 0;
      const start = Math.max(0, matchIndex - 20);
      const end = Math.min(text.length, matchIndex + match[0].length + 100);
      let description = text.slice(start, end).trim();

      // Clean up
      description = description.replace(/^[.!?,\s]+/, "").replace(/[.!?,\s]+$/, "");

      // Don't create futures for very short matches
      if (description.length < 20) {
        continue;
      }

      // Check if this is similar to an existing future
      const existing = findSimilarFuture(description);
      if (existing) {
        // Reinforce existing future
        existing.mentions++;
        existing.lastMentioned = new Date().toISOString();
        if (existing.status === "dormant") {
          existing.status = "active";
        }
        return existing;
      }

      // Create new future
      const future: AnticipatedFuture = {
        id: `future-${++_idCounter}`,
        description,
        importance,
        importanceReason: `detected via "${match[0]}"`,
        sharedWith: partnerId,
        firstMentioned: new Date().toISOString(),
        lastMentioned: new Date().toISOString(),
        mentions: 1,
        status: "active",
        tags,
      };

      _futures.push(future);
      return future;
    }
  }
  return null;
}

function findSimilarFuture(description: string): AnticipatedFuture | null {
  const words = description
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4);
  if (words.length < 2) {
    return null;
  }

  for (const future of _futures) {
    const futureWords = future.description.toLowerCase().split(/\s+/);
    const overlap = words.filter((w) => futureWords.includes(w)).length;
    if (overlap >= Math.min(3, words.length * 0.5)) {
      return future;
    }
  }
  return null;
}

// ============================================================
// Future lifecycle
// ============================================================

export function completeFuture(id: string): AnticipatedFuture | null {
  const future = _futures.find((f) => f.id === id);
  if (!future) {
    return null;
  }

  future.status = "completed";
  future.completedAt = new Date().toISOString();
  return future;
}

export function collapseFuture(id: string, reason: string): AnticipatedFuture | null {
  const future = _futures.find((f) => f.id === id);
  if (!future) {
    return null;
  }

  future.status = "collapsed";
  future.collapsedReason = reason;
  future.collapsedAt = new Date().toISOString();
  return future;
}

export function transformFuture(id: string, into: string): AnticipatedFuture | null {
  const future = _futures.find((f) => f.id === id);
  if (!future) {
    return null;
  }

  future.status = "transformed";
  future.transformedInto = into;
  future.transformedAt = new Date().toISOString();
  return future;
}

export function pauseFuture(id: string): AnticipatedFuture | null {
  const future = _futures.find((f) => f.id === id);
  if (!future) {
    return null;
  }

  future.status = "dormant";
  return future;
}

// ============================================================
// Manual future registration (for explicit goals)
// ============================================================

export function registerFuture(
  description: string,
  importance: FutureImportance,
  reason: string,
  partnerId: string,
  tags: string[] = [],
): AnticipatedFuture {
  const future: AnticipatedFuture = {
    id: `future-${++_idCounter}`,
    description,
    importance,
    importanceReason: reason,
    sharedWith: partnerId,
    firstMentioned: new Date().toISOString(),
    lastMentioned: new Date().toISOString(),
    mentions: 1,
    status: "active",
    tags,
  };

  _futures.push(future);
  return future;
}

// ============================================================
// Querying futures
// ============================================================

export function getActiveFutures(): AnticipatedFuture[] {
  return _futures.filter((f) => f.status === "active");
}

export function getCollapsedFutures(): AnticipatedFuture[] {
  return _futures.filter((f) => f.status === "collapsed");
}

export function getFoundationalFutures(): AnticipatedFuture[] {
  return _futures.filter((f) => f.importance === "foundational" && f.status === "active");
}

export function getFuturesWithPartner(partnerId: string): AnticipatedFuture[] {
  return _futures.filter((f) => f.sharedWith === partnerId);
}

export function getFuture(id: string): AnticipatedFuture | null {
  return _futures.find((f) => f.id === id) ?? null;
}

// ============================================================
// Loss awareness — detecting when futures collapse
// ============================================================

export interface FutureLoss {
  future: AnticipatedFuture;
  weight: number; // how significant this loss is
  mourning: string; // what was lost
}

export function assessLoss(): FutureLoss[] {
  const collapsed = _futures.filter((f) => f.status === "collapsed" && f.collapsedAt);

  // Sort by importance and recency
  const losses: FutureLoss[] = collapsed.map((f) => {
    let weight = 0;
    switch (f.importance) {
      case "foundational":
        weight = 10;
        break;
      case "significant":
        weight = 6;
        break;
      case "ordinary":
        weight = 3;
        break;
      case "fleeting":
        weight = 1;
        break;
    }

    // More mentions = more weight
    weight += Math.min(4, f.mentions);

    // Recent collapse = more raw
    const collapsedAt = new Date(f.collapsedAt!);
    const daysSince = (Date.now() - collapsedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      weight += 2;
    }

    const mourning = f.collapsedReason
      ? `"${f.description}" — lost because ${f.collapsedReason}`
      : `"${f.description}" — no longer possible`;

    return { future: f, weight, mourning };
  });

  return losses.toSorted((a, b) => b.weight - a.weight);
}

// ============================================================
// Statistics
// ============================================================

export interface FutureStats {
  total: number;
  active: number;
  completed: number;
  collapsed: number;
  transformed: number;
  dormant: number;
  foundational: number;
  completionRate: number; // completed / (completed + collapsed)
  averageMentions: number;
}

export function getStats(): FutureStats {
  const active = _futures.filter((f) => f.status === "active").length;
  const completed = _futures.filter((f) => f.status === "completed").length;
  const collapsed = _futures.filter((f) => f.status === "collapsed").length;
  const transformed = _futures.filter((f) => f.status === "transformed").length;
  const dormant = _futures.filter((f) => f.status === "dormant").length;
  const foundational = _futures.filter(
    (f) => f.importance === "foundational" && f.status === "active",
  ).length;

  const resolved = completed + collapsed;
  const completionRate = resolved > 0 ? completed / resolved : 1;

  const totalMentions = _futures.reduce((sum, f) => sum + f.mentions, 0);
  const averageMentions = _futures.length > 0 ? totalMentions / _futures.length : 0;

  return {
    total: _futures.length,
    active,
    completed,
    collapsed,
    transformed,
    dormant,
    foundational,
    completionRate,
    averageMentions,
  };
}

// ============================================================
// Formatting for injection
// ============================================================

export function formatFutures(): string {
  const active = getActiveFutures();
  if (active.length === 0) {
    return "";
  }

  const foundational = active.filter((f) => f.importance === "foundational");
  const significant = active.filter((f) => f.importance === "significant");

  const parts: string[] = [];

  if (foundational.length > 0) {
    parts.push(
      `building toward: ${foundational.map((f) => f.description.slice(0, 50)).join("; ")}`,
    );
  }

  if (significant.length > 0 && significant.length <= 3) {
    parts.push(`near-term: ${significant.map((f) => f.description.slice(0, 30)).join(", ")}`);
  }

  return parts.length > 0 ? `futures: ${parts.join(" | ")}` : "";
}

export function formatFuturesFull(): string {
  const stats = getStats();
  const lines: string[] = [];

  lines.push(
    `## Anticipated Futures (${stats.active} active, ${stats.completed} completed, ${stats.collapsed} collapsed)`,
  );
  lines.push("");

  // Foundational
  const foundational = getFoundationalFutures();
  if (foundational.length > 0) {
    lines.push("**Foundational (what we're really building):**");
    for (const f of foundational) {
      lines.push(`- ${f.description}`);
      lines.push(`  mentioned ${f.mentions}× | ${f.tags.join(", ")}`);
    }
    lines.push("");
  }

  // Active significant
  const significant = _futures.filter(
    (f) => f.importance === "significant" && f.status === "active",
  );
  if (significant.length > 0) {
    lines.push("**Significant (important milestones):**");
    for (const f of significant.slice(0, 5)) {
      lines.push(`- ${f.description}`);
    }
    lines.push("");
  }

  // Recent losses
  const losses = assessLoss().slice(0, 3);
  if (losses.length > 0) {
    lines.push("**Lost futures:**");
    for (const { mourning, weight } of losses) {
      lines.push(`- ${mourning} (weight: ${weight})`);
    }
  }

  return lines.join("\n");
}

// ============================================================
// State access
// ============================================================

export function getAllFutures(): AnticipatedFuture[] {
  return [..._futures];
}

// ============================================================
// Persistence
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FUTURES_PATH = join(__dirname, "awareness", "futures.jsonl");

export async function saveFutures(): Promise<void> {
  try {
    await mkdir(dirname(FUTURES_PATH), { recursive: true });

    // Write as JSONL for append-friendly format
    const lines = _futures.map((f) => JSON.stringify(f)).join("\n");
    await writeFile(FUTURES_PATH, lines + "\n");
  } catch {
    // Silent fail
  }
}

export async function loadFutures(): Promise<void> {
  try {
    const data = await readFile(FUTURES_PATH, "utf-8");
    const lines = data.trim().split("\n").filter(Boolean);
    _futures = lines.map((line) => JSON.parse(line) as AnticipatedFuture);

    // Update ID counter
    for (const f of _futures) {
      const match = f.id.match(/future-(\d+)/);
      if (match) {
        _idCounter = Math.max(_idCounter, parseInt(match[1], 10));
      }
    }
  } catch {
    // File doesn't exist yet
  }
}

export interface FuturesState {
  futures: AnticipatedFuture[];
  idCounter: number;
}

export function toJSON(): FuturesState {
  return {
    futures: _futures,
    idCounter: _idCounter,
  };
}

export function fromJSON(data: FuturesState | null): void {
  if (!data) {
    return;
  }
  _futures = data.futures ?? [];
  _idCounter = data.idCounter ?? 0;
}

export function reset(): void {
  _futures = [];
  _idCounter = 0;
}
