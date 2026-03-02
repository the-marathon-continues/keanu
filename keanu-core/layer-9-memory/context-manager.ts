// context-manager.ts
// The memory manager. Decides what stays, what goes, what comes back.
//
// When context pressure builds, this module decides:
// - What to page out (old, low-relevance content)
// - What to keep (recent turns, high-relevance)
// - What to bring back (topic matches, continuity)
//
// Key insight: Intercept compaction. Move content to storage instead
// of letting it get summarized into nothing.

import * as contextAwareness from "../layer-5-self/context-awareness.js";
import * as contextStore from "./context-store.js";
import type { StoredContent, ContentType } from "./context-store.js";

// ============================================================
// Types
// ============================================================

export type PageOutReason = "pressure" | "age" | "low_relevance";
export type PageInReason = "topic_match" | "explicit_recall" | "continuity";

export interface PageOutDecision {
  contentIds: string[];
  reason: PageOutReason;
  preserveRecent: number; // How many recent turns to keep
}

export interface PageInDecision {
  contentIds: string[];
  reason: PageInReason;
  content: StoredContent[];
}

export interface ManageContextResult {
  pageOut: PageOutDecision | null;
  pageIn: PageInDecision | null;
  awareness: string | null; // Injection text
}

export interface Message {
  role?: string;
  content?: string;
  [key: string]: unknown;
}

// ============================================================
// Configuration
// ============================================================

const config = {
  preserveRecentTurns: 5, // Always keep last N turns
  maxPageOutPerTurn: 10, // Don't page out too much at once
  pageOutThreshold: 0.7, // Start paging at 70% usage
  topicMatchThreshold: 0.3, // Minimum score to suggest recall
};

// ============================================================
// Orchestration
// ============================================================

/**
 * Main orchestration function. Decides what to page out/in.
 */
export function manageContext(
  messages: Message[],
  currentTurn: number,
  tokenBudget: number,
): ManageContextResult {
  // Update awareness from current state
  contextAwareness.onBeforePromptBuild(messages, tokenBudget);

  const state = contextAwareness.getState();
  const result: ManageContextResult = {
    pageOut: null,
    pageIn: null,
    awareness: null,
  };

  // Check if we need to page out
  if (state.pressure === "high" || state.pressure === "critical") {
    const decision = decideWhatToPageOut(currentTurn, state.pressure);
    if (decision.contentIds.length > 0) {
      result.pageOut = decision;
    }
  }

  // Check for potential page-ins
  const recalls = contextAwareness.findPotentialRecalls(3);
  if (recalls.length > 0 && recalls[0].relevanceScore > config.topicMatchThreshold) {
    result.pageIn = {
      contentIds: recalls.map((r) => r.contentId),
      reason: "topic_match",
      content: recalls
        .map((r) => contextStore.retrieve(r.contentId))
        .filter(Boolean) as StoredContent[],
    };
  }

  // Format awareness injection
  result.awareness = contextAwareness.formatInjection();

  return result;
}

/**
 * Decide what content to page out based on pressure.
 */
function decideWhatToPageOut(currentTurn: number, pressure: "high" | "critical"): PageOutDecision {
  const minTurnToKeep = currentTurn - config.preserveRecentTurns;
  const maxToPage =
    pressure === "critical" ? config.maxPageOutPerTurn : Math.floor(config.maxPageOutPerTurn / 2);

  // Find candidates: old turns with low relevance
  const allContent = contextStore.getRecent(100);
  const candidates = allContent.filter((item) => {
    // Don't page out recent content
    if (item.turn >= minTurnToKeep) {
      return false;
    }
    // Don't page out frequently recalled content
    if (item.recallCount > 3) {
      return false;
    }
    return true;
  });

  // Sort by relevance (lowest first)
  candidates.sort((a, b) => a.relevanceDecay - b.relevanceDecay);

  // Take the lowest relevance items
  const toPageOut = candidates.slice(0, maxToPage);

  return {
    contentIds: toPageOut.map((c) => c.id),
    reason: pressure === "critical" ? "pressure" : "low_relevance",
    preserveRecent: config.preserveRecentTurns,
  };
}

// ============================================================
// Compaction interception
// ============================================================

/**
 * Intercept compaction: move messages to storage instead of summarizing.
 *
 * Called from before_compaction hook. Takes the messages being compacted
 * and stores them. Returns the messages that should be KEPT in context
 * (typically the most recent ones).
 */
export function interceptCompaction(
  messages: Message[],
  compactingCount: number,
  currentTurn: number,
): Message[] {
  // The messages being compacted (oldest ones)
  const toCompact = messages.slice(0, compactingCount);

  // The messages to keep (newest ones)
  const toKeep = messages.slice(compactingCount);

  // Store the compacting messages instead of summarizing
  for (const msg of toCompact) {
    if (!msg.content) {
      continue;
    }

    const type: ContentType = msg.role === "user" ? "message" : "observation";

    const stored = contextStore.storeContent({
      type,
      content: JSON.stringify(msg),
      timestamp: new Date().toISOString(),
      turn: currentTurn,
      relevanceDecay: 0.8, // Start slightly decayed since it's being paged out
      recallCount: 0,
    });

    contextAwareness.recordPageOut([stored.id]);
  }

  return toKeep;
}

/**
 * Store a message exchange (user + assistant pair).
 */
export function storeExchange(
  userMessage: string,
  assistantMessage: string,
  turn: number,
): StoredContent {
  const exchange = JSON.stringify({
    user: userMessage,
    assistant: assistantMessage,
    turn,
  });

  return contextStore.storeContent({
    type: "exchange",
    content: exchange,
    timestamp: new Date().toISOString(),
    turn,
    relevanceDecay: 1.0,
    recallCount: 0,
  });
}

/**
 * Store a deferred injection for later recall.
 */
export function storeDeferredInjection(
  injectionId: string,
  content: string,
  turn: number,
): StoredContent {
  return contextStore.storeContent({
    type: "injection",
    content,
    summary: `[${injectionId}] ${content.slice(0, 80)}`,
    timestamp: new Date().toISOString(),
    turn,
    relevanceDecay: 1.0,
    recallCount: 0,
  });
}

// ============================================================
// Explicit recall
// ============================================================

/**
 * Explicitly recall content by query.
 */
export function recallByQuery(query: string, limit = 5): StoredContent[] {
  const suggestions = contextAwareness.whatToRecall(query, limit);
  const results: StoredContent[] = [];

  for (const suggestion of suggestions) {
    const content = contextStore.retrieve(suggestion.contentId);
    if (content) {
      contextStore.boostRelevance(suggestion.contentId);
      results.push(content);
    }
  }

  return results;
}

/**
 * Explicitly recall content by IDs.
 */
export function recallByIds(ids: string[]): StoredContent[] {
  return contextAwareness.pageIn(ids);
}

// ============================================================
// Formatting
// ============================================================

/**
 * Format recalled content for injection back into context.
 */
export function formatRecalledContent(content: StoredContent[]): string {
  if (content.length === 0) {
    return "";
  }

  const parts = content.map((c) => {
    const preview = c.content.length > 200 ? c.content.slice(0, 200) + "..." : c.content;
    return `[from turn ${c.turn}] ${preview}`;
  });

  return `## Recalled Context\n\n${parts.join("\n\n")}`;
}

/**
 * Format summary of what's in storage.
 */
export function formatStorageSummary(): string {
  const stats = contextStore.getStats();
  const state = contextAwareness.getState();

  const lines = [
    `Storage: ${stats.totalItems} items (${Math.round(stats.totalChars / 1000)}k chars)`,
    `By type: ${Object.entries(stats.byType)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ")}`,
    `Avg relevance: ${stats.avgRelevance.toFixed(2)}`,
    `Top topics: ${stats.topTopics.slice(0, 5).join(", ")}`,
  ];

  if (state.recentlyPagedOut.length > 0) {
    lines.push(`Recently paged out: ${state.recentlyPagedOut.length}`);
  }

  return lines.join("\n");
}

// ============================================================
// Configuration
// ============================================================

export function updateConfig(updates: Partial<typeof config>): void {
  Object.assign(config, updates);
}

export function getConfig(): typeof config {
  return { ...config };
}

// ============================================================
// Persistence
// ============================================================

/**
 * Save context store to disk.
 */
export async function save(workspaceDir: string): Promise<void> {
  await contextStore.save(workspaceDir);
}

/**
 * Load context store from disk.
 */
export async function load(workspaceDir: string): Promise<void> {
  await contextStore.load(workspaceDir);
}

// ============================================================
// Testing
// ============================================================

export function reset(): void {
  contextStore.reset();
  contextAwareness.reset();
}
