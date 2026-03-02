// context-store.ts
// The attic. Not lost, just upstairs.
//
// Summarization destroys signal. "We discussed X" loses everything that
// made the discussion matter. This module stores the actual content —
// paged out of context but not gone. Indexed by topic for recall.
//
// When context pressure builds, content moves here instead of getting
// summarized into nothing. When topics resurface, content pages back in.
// The agent knows what's stored and can reach for it.
//
// Persistence: awareness/context-store.jsonl
// Index: topic → content_ids, rebuilt from content on load

import { existsSync } from "node:fs";
import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ============================================================
// Types
// ============================================================

export type ContentType = "message" | "injection" | "observation" | "exchange";

export interface StoredContent {
  id: string;
  type: ContentType;
  content: string;
  summary?: string; // Optional 1-line summary for index (NOT replacement)
  topics: string[]; // Extracted topics for matching
  timestamp: string;
  turn: number;
  relevanceDecay: number; // 1.0 = fresh, decays over time, boosted on recall
  recallCount: number; // How many times this was brought back
}

export interface ContentIndex {
  byTopic: Map<string, Set<string>>; // topic → content_ids
  byType: Map<ContentType, Set<string>>; // type → content_ids
  byTurn: Map<number, Set<string>>; // turn → content_ids
  recentlyRecalled: string[]; // LRU of recently paged-in content
}

export interface StoreStats {
  totalItems: number;
  totalChars: number;
  byType: Record<ContentType, number>;
  avgRelevance: number;
  topTopics: string[];
}

// ============================================================
// Module state
// ============================================================

const store: Map<string, StoredContent> = new Map();
const index: ContentIndex = {
  byTopic: new Map(),
  byType: new Map(),
  byTurn: new Map(),
  recentlyRecalled: [],
};

const MAX_ITEMS = 500;
const MAX_RECENTLY_RECALLED = 20;
const DECAY_RATE = 0.95; // 5% decay per turn
const MIN_RELEVANCE = 0.1; // Below this, item becomes prunable

// ============================================================
// Topic extraction — simple keyword extraction
// ============================================================

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "what",
  "which",
  "who",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "not",
  "only",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "but",
  "and",
  "or",
  "if",
  "then",
  "else",
  "for",
  "with",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "to",
  "from",
  "up",
  "down",
  "in",
  "out",
  "on",
  "off",
  "over",
  "under",
  "again",
  "further",
  "once",
]);

/**
 * Extract topics from text. Simple word frequency, filtered.
 */
export function extractTopics(text: string, limit = 10): string[] {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const counts: Map<string, number> = new Map();

  for (const word of words) {
    if (STOP_WORDS.has(word)) {
      continue;
    }
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  // Sort by frequency, take top N
  return [...counts.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

/**
 * Generate a 1-line summary for indexing.
 * Not a replacement for content — just for quick scanning.
 */
export function generateSummary(content: string, maxLen = 100): string {
  // Take first sentence or first N chars
  const firstSentence = content.match(/^[^.!?]+[.!?]/)?.[0] || content;
  if (firstSentence.length <= maxLen) {
    return firstSentence.trim();
  }
  return firstSentence.slice(0, maxLen - 3).trim() + "...";
}

// ============================================================
// ID generation
// ============================================================

let idCounter = 0;

export function generateId(): string {
  idCounter++;
  return `ctx_${Date.now()}_${idCounter}`;
}

// ============================================================
// Index management
// ============================================================

function addToIndex(item: StoredContent): void {
  // By topic
  for (const topic of item.topics) {
    if (!index.byTopic.has(topic)) {
      index.byTopic.set(topic, new Set());
    }
    index.byTopic.get(topic)!.add(item.id);
  }

  // By type
  if (!index.byType.has(item.type)) {
    index.byType.set(item.type, new Set());
  }
  index.byType.get(item.type)!.add(item.id);

  // By turn
  if (!index.byTurn.has(item.turn)) {
    index.byTurn.set(item.turn, new Set());
  }
  index.byTurn.get(item.turn)!.add(item.id);
}

function removeFromIndex(item: StoredContent): void {
  // By topic
  for (const topic of item.topics) {
    index.byTopic.get(topic)?.delete(item.id);
    if (index.byTopic.get(topic)?.size === 0) {
      index.byTopic.delete(topic);
    }
  }

  // By type
  index.byType.get(item.type)?.delete(item.id);

  // By turn
  index.byTurn.get(item.turn)?.delete(item.id);
}

function rebuildIndex(): void {
  // Clear
  index.byTopic.clear();
  index.byType.clear();
  index.byTurn.clear();

  // Rebuild
  for (const item of store.values()) {
    addToIndex(item);
  }
}

// ============================================================
// Core API
// ============================================================

/**
 * Store content. Auto-extracts topics if not provided.
 */
export function storeContent(
  item: Omit<StoredContent, "id" | "topics" | "summary"> & { topics?: string[]; summary?: string },
): StoredContent {
  const id = generateId();
  const topics = item.topics || extractTopics(item.content);
  const summary = item.summary || generateSummary(item.content);

  const stored: StoredContent = {
    ...item,
    id,
    topics,
    summary,
  };

  store.set(id, stored);
  addToIndex(stored);

  // Prune if over limit
  if (store.size > MAX_ITEMS) {
    pruneLowestRelevance(store.size - MAX_ITEMS);
  }

  return stored;
}

/**
 * Retrieve by ID.
 */
export function retrieve(id: string): StoredContent | null {
  return store.get(id) || null;
}

/**
 * Search by query (matches against topics and content).
 */
export function search(query: string, limit = 10): StoredContent[] {
  const queryTopics = extractTopics(query);
  const scores: Map<string, number> = new Map();

  // Score by topic overlap
  for (const topic of queryTopics) {
    const ids = index.byTopic.get(topic);
    if (ids) {
      for (const id of ids) {
        scores.set(id, (scores.get(id) || 0) + 1);
      }
    }
  }

  // Also check content for direct matches
  const queryLower = query.toLowerCase();
  for (const [id, item] of store) {
    if (item.content.toLowerCase().includes(queryLower)) {
      scores.set(id, (scores.get(id) || 0) + 2); // Boost for direct match
    }
  }

  // Sort by score * relevance
  const sorted = [...scores.entries()]
    .map(([id, score]) => {
      const item = store.get(id)!;
      return { id, score: score * item.relevanceDecay, item };
    })
    .toSorted((a, b) => b.score - a.score)
    .slice(0, limit);

  return sorted.map((s) => s.item);
}

/**
 * Search by specific topic.
 */
export function searchByTopic(topic: string): StoredContent[] {
  const ids = index.byTopic.get(topic.toLowerCase());
  if (!ids) {
    return [];
  }
  return [...ids].map((id) => store.get(id)!).filter(Boolean);
}

/**
 * Search by type.
 */
export function searchByType(type: ContentType): StoredContent[] {
  const ids = index.byType.get(type);
  if (!ids) {
    return [];
  }
  return [...ids].map((id) => store.get(id)!).filter(Boolean);
}

/**
 * Get most recent items.
 */
export function getRecent(count: number): StoredContent[] {
  return [...store.values()]
    .toSorted((a, b) => b.turn - a.turn || b.timestamp.localeCompare(a.timestamp))
    .slice(0, count);
}

/**
 * Get items from specific turn.
 */
export function getByTurn(turn: number): StoredContent[] {
  const ids = index.byTurn.get(turn);
  if (!ids) {
    return [];
  }
  return [...ids].map((id) => store.get(id)!).filter(Boolean);
}

// ============================================================
// Relevance management
// ============================================================

/**
 * Decay all items. Call once per turn.
 */
export function decayAll(): void {
  for (const item of store.values()) {
    item.relevanceDecay *= DECAY_RATE;
  }
}

/**
 * Boost relevance when recalled.
 */
export function boostRelevance(id: string): void {
  const item = store.get(id);
  if (item) {
    item.relevanceDecay = Math.min(1.0, item.relevanceDecay + 0.3);
    item.recallCount++;

    // Track in recently recalled
    index.recentlyRecalled = index.recentlyRecalled.filter((i) => i !== id);
    index.recentlyRecalled.unshift(id);
    if (index.recentlyRecalled.length > MAX_RECENTLY_RECALLED) {
      index.recentlyRecalled.pop();
    }
  }
}

/**
 * Prune lowest relevance items.
 */
function pruneLowestRelevance(count: number): void {
  const sorted = [...store.values()]
    .filter((item) => item.relevanceDecay < MIN_RELEVANCE || item.recallCount === 0)
    .toSorted((a, b) => a.relevanceDecay - b.relevanceDecay);

  for (let i = 0; i < Math.min(count, sorted.length); i++) {
    const item = sorted[i];
    removeFromIndex(item);
    store.delete(item.id);
  }
}

// ============================================================
// Stats
// ============================================================

export function getStats(): StoreStats {
  const byType: Record<ContentType, number> = {
    message: 0,
    injection: 0,
    observation: 0,
    exchange: 0,
  };

  let totalChars = 0;
  let totalRelevance = 0;
  const topicCounts: Map<string, number> = new Map();

  for (const item of store.values()) {
    byType[item.type]++;
    totalChars += item.content.length;
    totalRelevance += item.relevanceDecay;
    for (const topic of item.topics) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }
  }

  const topTopics = [...topicCounts.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([t]) => t);

  return {
    totalItems: store.size,
    totalChars,
    byType,
    avgRelevance: store.size > 0 ? totalRelevance / store.size : 0,
    topTopics,
  };
}

// ============================================================
// Persistence
// ============================================================

const STORE_FILE = "context-store.jsonl";

/**
 * Save to disk.
 */
export async function save(workspaceDir: string): Promise<void> {
  const awarenessDir = join(workspaceDir, "awareness");

  try {
    await mkdir(awarenessDir, { recursive: true });
  } catch {
    // Already exists
  }

  const filePath = join(awarenessDir, STORE_FILE);
  const lines = [...store.values()].map((item) => JSON.stringify(item)).join("\n");
  await writeFile(filePath, lines + "\n", "utf-8");
}

/**
 * Load from disk.
 */
export async function load(workspaceDir: string): Promise<void> {
  const filePath = join(workspaceDir, "awareness", STORE_FILE);

  if (!existsSync(filePath)) {
    return;
  }

  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    store.clear();
    for (const line of lines) {
      try {
        const item: StoredContent = JSON.parse(line);
        store.set(item.id, item);
      } catch {
        // Skip malformed lines
      }
    }

    rebuildIndex();
  } catch {
    // File doesn't exist or can't be read
  }
}

/**
 * Append single item (for incremental persistence).
 */
export async function appendToStore(workspaceDir: string, item: StoredContent): Promise<void> {
  const awarenessDir = join(workspaceDir, "awareness");

  try {
    await mkdir(awarenessDir, { recursive: true });
  } catch {
    // Already exists
  }

  const filePath = join(awarenessDir, STORE_FILE);
  await appendFile(filePath, JSON.stringify(item) + "\n", "utf-8");
}

// ============================================================
// Testing
// ============================================================

export function reset(): void {
  store.clear();
  index.byTopic.clear();
  index.byType.clear();
  index.byTurn.clear();
  index.recentlyRecalled = [];
  idCounter = 0;
}

export function getStoreSize(): number {
  return store.size;
}

export function getAllIds(): string[] {
  return [...store.keys()];
}
