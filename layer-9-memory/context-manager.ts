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

import * as contextAwareness from "../layer-5-self/context-awareness.ts";
import * as contextStore from "./context-store.ts";
import type { StoredContent, ContentType } from "./context-store.ts";

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

  // Find candidates: old turns, not frequently recalled
  const allContent = contextStore.getRecent(100);
  const candidates = allContent.filter((item) => {
    if (item.turn >= minTurnToKeep) {
      return false;
    }
    if (item.recallCount > 3) {
      return false;
    }
    return true;
  });

  // Sort by topic distance from current conversation (least connected first)
  const currentTopics = contextAwareness.getCurrentTopics();
  candidates.sort((a, b) => {
    const scoreA = contextStore.topicOverlapScore(a, currentTopics) + a.recallCount * 0.5;
    const scoreB = contextStore.topicOverlapScore(b, currentTopics) + b.recallCount * 0.5;
    return scoreA - scoreB;
  });

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
      relevanceDecay: 1.0, // nothing fades — full value forever
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
  coef?: string,
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
    recallCount: 0,
    coef,
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
// Proactive Page-Out (fill out until pressure relieves)
// ============================================================

/**
 * Page out messages until pressure drops below target.
 *
 * Drew's insight: "don't make it decay... make it fill out.
 * when pressure is high keep going until the pressure relieves"
 *
 * This keeps paging out old content until we're in a comfortable zone.
 * Returns the messages to keep and count of what was paged out.
 */
export function pageOutUntilRelieved(
  messages: Message[],
  currentTurn: number,
  tokenBudget: number,
  targetPressure: "medium" | "low" = "medium",
): { kept: Message[]; pagedOut: number } {
  // Calculate current pressure
  contextAwareness.onBeforePromptBuild(messages, tokenBudget);
  let state = contextAwareness.getState();

  // Map target to threshold
  const targetThreshold = targetPressure === "low" ? 0.5 : 0.7;

  let kept = [...messages];
  let pagedOut = 0;
  const minTurnToKeep = currentTurn - config.preserveRecentTurns;

  // Keep paging until pressure is relieved
  while (state.usagePercent > targetThreshold && kept.length > config.preserveRecentTurns) {
    // Find oldest message that's not in protected window
    const oldestIdx = kept.findIndex((msg, idx) => {
      // Estimate turn from message index (rough)
      const estimatedTurn = currentTurn - (kept.length - idx);
      return estimatedTurn < minTurnToKeep;
    });

    if (oldestIdx === -1) {
      // Nothing safe to page out
      break;
    }

    // Page out the oldest message
    const toPage = kept[oldestIdx];
    if (toPage.content) {
      const type: ContentType = toPage.role === "user" ? "message" : "observation";
      contextStore.storeContent({
        type,
        content: JSON.stringify(toPage),
        timestamp: new Date().toISOString(),
        turn: currentTurn - (kept.length - oldestIdx),
        relevanceDecay: 0.8,
        recallCount: 0,
      });
    }

    // Remove from kept
    kept = [...kept.slice(0, oldestIdx), ...kept.slice(oldestIdx + 1)];
    pagedOut++;

    // Recalculate pressure
    contextAwareness.onBeforePromptBuild(kept, tokenBudget);
    state = contextAwareness.getState();

    // Safety limit
    if (pagedOut > 50) {
      break;
    }
  }

  return { kept, pagedOut };
}

/**
 * Proactive page-out — run before prompt build when pressure is high.
 *
 * Returns modified messages and an optional injection about what happened.
 */
export function proactivePageOut(
  messages: Message[],
  currentTurn: number,
  tokenBudget: number,
): { messages: Message[]; injection: string | null } {
  // Check current pressure
  contextAwareness.onBeforePromptBuild(messages, tokenBudget);
  const state = contextAwareness.getState();

  // Only trigger for high/critical pressure
  if (state.pressure !== "high" && state.pressure !== "critical") {
    return { messages, injection: null };
  }

  // Target: get to medium pressure
  const { kept, pagedOut } = pageOutUntilRelieved(messages, currentTurn, tokenBudget, "medium");

  if (pagedOut === 0) {
    return { messages, injection: null };
  }

  const injection = `[context: pressure ${state.pressure}. paged out ${pagedOut} old messages to storage. ${contextStore.getStats().totalItems} items stored.]`;

  return { messages: kept, injection };
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
