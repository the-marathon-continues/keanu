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
  relevanceDecay: number; // Always 1.0 — kept for backwards compat with persisted data
  recallCount: number; // How many times this was brought back
  coef?: string; // COEF signal at time of capture
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
  item: Omit<StoredContent, "id" | "topics" | "summary" | "relevanceDecay"> & {
    topics?: string[];
    summary?: string;
    relevanceDecay?: number;
  },
): StoredContent {
  const id = generateId();
  const topics = item.topics || extractTopics(item.content);
  const summary = item.summary || generateSummary(item.content);

  const stored: StoredContent = {
    ...item,
    id,
    topics,
    summary,
    relevanceDecay: 1.0, // always 1.0 — nothing fades
  };

  store.set(id, stored);
  addToIndex(stored);

  // When full, replace the least connected items
  if (store.size > MAX_ITEMS) {
    pruneLeastConnected(store.size - MAX_ITEMS, topics);
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
// Replacement — nothing fades, things get replaced
// ============================================================

/**
 * Record a recall. Tracks how often something gets pulled back.
 */
export function boostRelevance(id: string): void {
  const item = store.get(id);
  if (item) {
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
 * Score an item's topic distance from a set of current topics.
 * Higher = more connected. Zero = no overlap.
 */
export function topicOverlapScore(item: StoredContent, currentTopics: string[]): number {
  if (currentTopics.length === 0 || item.topics.length === 0) {
    return 0;
  }
  const overlap = item.topics.filter((t) => currentTopics.includes(t)).length;
  return overlap / Math.max(item.topics.length, 1);
}

/**
 * Find replacement candidates — items least connected to current conversation.
 * Never touches frequently-recalled items.
 */
export function selectReplacementCandidates(
  currentTopics: string[],
  count: number = 5,
): StoredContent[] {
  const candidates = [...store.values()]
    .filter((item) => item.recallCount <= 1) // don't replace frequently recalled
    .map((item) => ({
      item,
      score: topicOverlapScore(item, currentTopics) + item.recallCount * 0.5,
    }))
    .toSorted((a, b) => a.score - b.score); // lowest score = most replaceable

  return candidates.slice(0, count).map((c) => c.item);
}

/**
 * Replace specific items with new content.
 * Called after Claude decides which candidates to replace.
 */
export function replaceItems(idsToReplace: string[]): void {
  for (const id of idsToReplace) {
    const item = store.get(id);
    if (item) {
      removeFromIndex(item);
      store.delete(id);
    }
  }
}

/**
 * Fallback pruning when no Claude call available.
 * Removes items with least topic overlap + lowest recall count.
 */
function pruneLeastConnected(count: number, newItemTopics: string[]): void {
  const candidates = selectReplacementCandidates(newItemTopics, count);
  replaceItems(candidates.map((c) => c.id));
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
