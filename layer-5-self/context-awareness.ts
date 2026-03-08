// context-awareness.ts
// Know what you know. Know what you forgot.
//
// The model doesn't know its own context window. It can't tell when
// it's about to overflow, what got paged out, or when something in
// storage might be relevant to the current conversation.
//
// This module gives the model that awareness:
// - What's in context vs what's in storage
// - When pressure is building
// - When stored content might be relevant
// - What just got paged out
//
// The model can then make informed decisions about recall.

import * as contextStore from "../layer-9-memory/context-store.ts";
import type { StoredContent } from "../layer-9-memory/context-store.ts";

// ============================================================
// Types
// ============================================================

export type ContextPressure = "low" | "medium" | "high" | "critical";

export interface ContextState {
  estimatedTokens: number;
  tokenBudget: number;
  pressure: ContextPressure;
  usagePercent: number;
  inStorage: number; // Count of items in storage
  recentlyPagedOut: string[]; // IDs of recently paged out items
  potentialRecalls: string[]; // IDs that might be relevant
}

export interface RecallSuggestion {
  contentId: string;
  reason: string;
  relevanceScore: number;
  summary: string;
  turn: number;
}

// ============================================================
// Module state
// ============================================================

let _estimatedTokens = 0;
let _tokenBudget = 128000; // Default, updated from context
let _recentlyPagedOut: string[] = [];
let _currentTopics: string[] = [];
let _lastMessageTopics: string[] = [];

const MAX_RECENTLY_PAGED = 10;
const CHARS_PER_TOKEN = 4; // Rough estimate

// ============================================================
// Pressure thresholds
// ============================================================

const PRESSURE_THRESHOLDS = {
  low: 0.5, // < 50% usage
  medium: 0.7, // 50-70% usage
  high: 0.85, // 70-85% usage
  critical: 1.0, // > 85% usage
};

function calculatePressure(usagePercent: number): ContextPressure {
  if (usagePercent >= PRESSURE_THRESHOLDS.high) {
    return "critical";
  }
  if (usagePercent >= PRESSURE_THRESHOLDS.medium) {
    return "high";
  }
  if (usagePercent >= PRESSURE_THRESHOLDS.low) {
    return "medium";
  }
  return "low";
}

// ============================================================
// Token estimation
// ============================================================

/**
 * Estimate tokens from text length.
 * Rough approximation: ~4 chars per token for English.
 */
export function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens from messages array.
 */
export function estimateTokensFromMessages(
  messages: Array<{ content?: string; role?: string }>,
): number {
  let total = 0;
  for (const msg of messages) {
    if (msg.content) {
      total += estimateTokensFromText(msg.content);
    }
    // Add overhead for message structure
    total += 4;
  }
  return total;
}

/**
 * Update token estimate. Called from hooks.
 */
export function updateTokenEstimate(tokens: number, budget?: number): void {
  _estimatedTokens = tokens;
  if (budget) {
    _tokenBudget = budget;
  }
}

/**
 * Update from messages. Called when we have access to message array.
 */
export function updateFromMessages(
  messages: Array<{ content?: string; role?: string }>,
  budget?: number,
): void {
  _estimatedTokens = estimateTokensFromMessages(messages);
  if (budget) {
    _tokenBudget = budget;
  }
}

// ============================================================
// Topic tracking
// ============================================================

/**
 * Update current topics from the latest message.
 * Used to match against stored content.
 */
export function updateTopicsFromMessage(message: string): void {
  _lastMessageTopics = contextStore.extractTopics(message, 15);
  // Merge with current topics, keeping recent ones
  const merged = [..._lastMessageTopics, ..._currentTopics];
  const seen = new Set<string>();
  _currentTopics = merged
    .filter((t) => {
      if (seen.has(t)) {
        return false;
      }
      seen.add(t);
      return true;
    })
    .slice(0, 30);
}

/**
 * Get current conversation topics.
 */
export function getCurrentTopics(): string[] {
  return [..._currentTopics];
}

// ============================================================
// Core API
// ============================================================

/**
 * Get current context state.
 */
export function getState(): ContextState {
  const usagePercent = _tokenBudget > 0 ? _estimatedTokens / _tokenBudget : 0;
  const stats = contextStore.getStats();

  return {
    estimatedTokens: _estimatedTokens,
    tokenBudget: _tokenBudget,
    pressure: calculatePressure(usagePercent),
    usagePercent,
    inStorage: stats.totalItems,
    recentlyPagedOut: [..._recentlyPagedOut],
    potentialRecalls: findPotentialRecalls().map((r) => r.contentId),
  };
}

/**
 * Check if we should page out content.
 */
export function shouldPageOut(): boolean {
  const state = getState();
  return state.pressure === "high" || state.pressure === "critical";
}

/**
 * Find stored content that might be relevant to current context.
 */
export function findPotentialRecalls(limit = 5): RecallSuggestion[] {
  if (_currentTopics.length === 0) {
    return [];
  }

  // Search store for topic matches
  const results = contextStore.search(_currentTopics.join(" "), limit * 2);

  // Score and sort
  const suggestions: RecallSuggestion[] = [];
  for (const item of results) {
    const topicOverlap = item.topics.filter((t) => _currentTopics.includes(t)).length;
    const relevanceScore = (topicOverlap / Math.max(item.topics.length, 1)) * item.relevanceDecay;

    if (relevanceScore > 0.2) {
      suggestions.push({
        contentId: item.id,
        reason: `topics: ${item.topics.filter((t) => _currentTopics.includes(t)).join(", ")}`,
        relevanceScore,
        summary: item.summary || item.content.slice(0, 100),
        turn: item.turn,
      });
    }
  }

  return suggestions.toSorted((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
}

/**
 * Find content to recall based on query.
 */
export function whatToRecall(query: string, limit = 5): RecallSuggestion[] {
  const queryTopics = contextStore.extractTopics(query, 10);
  const results = contextStore.search(query, limit * 2);

  const suggestions: RecallSuggestion[] = [];
  for (const item of results) {
    const topicOverlap = item.topics.filter((t) => queryTopics.includes(t)).length;
    const directMatch = item.content.toLowerCase().includes(query.toLowerCase()) ? 0.5 : 0;
    const relevanceScore =
      (topicOverlap / Math.max(queryTopics.length, 1)) * item.relevanceDecay + directMatch;

    suggestions.push({
      contentId: item.id,
      reason: directMatch > 0 ? "direct match" : `topics: ${item.topics.slice(0, 3).join(", ")}`,
      relevanceScore,
      summary: item.summary || item.content.slice(0, 100),
      turn: item.turn,
    });
  }

  return suggestions.toSorted((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
}

// ============================================================
// Paging actions
// ============================================================

/**
 * Record that content was paged out.
 */
export function recordPageOut(contentIds: string[]): void {
  _recentlyPagedOut = [...contentIds, ..._recentlyPagedOut].slice(0, MAX_RECENTLY_PAGED);
}

/**
 * Page content back in. Returns the content and boosts its relevance.
 */
export function pageIn(contentIds: string[]): StoredContent[] {
  const results: StoredContent[] = [];
  for (const id of contentIds) {
    const content = contextStore.retrieve(id);
    if (content) {
      contextStore.boostRelevance(id);
      results.push(content);
    }
  }
  // Remove from recently paged out
  _recentlyPagedOut = _recentlyPagedOut.filter((id) => !contentIds.includes(id));
  return results;
}

// ============================================================
// Hook integration
// ============================================================

/**
 * Called before prompt build. Updates state from messages.
 */
export function onBeforePromptBuild(
  messages: Array<{ content?: string; role?: string }>,
  budget?: number,
): void {
  updateFromMessages(messages, budget);

  // Extract topics from recent messages
  const recentContent = messages
    .slice(-5)
    .filter((m) => m.content)
    .map((m) => m.content!)
    .join(" ");
  updateTopicsFromMessage(recentContent);
}

/**
 * Called when a new message arrives.
 */
export function onMessageReceived(message: string): void {
  updateTopicsFromMessage(message);
}

/**
 * Format injection for awareness section.
 * Only surfaces when there's something worth knowing.
 */
export function formatInjection(): string | null {
  const state = getState();

  const parts: string[] = [];

  // Token pressure
  if (state.pressure !== "low") {
    const pct = Math.round(state.usagePercent * 100);
    parts.push(`${pct}% full`);
  }

  // Storage count
  if (state.inStorage > 0) {
    parts.push(`${state.inStorage} items in storage`);
  }

  // Recently paged out
  if (_recentlyPagedOut.length > 0) {
    parts.push(`${_recentlyPagedOut.length} just paged out`);
  }

  // Don't inject if nothing interesting
  if (parts.length === 0) {
    return null;
  }

  // Check for potential recalls
  const recalls = findPotentialRecalls(2);
  if (recalls.length > 0) {
    const recallSummaries = recalls.map((r) => `"${r.summary.slice(0, 50)}..."`).join(", ");
    parts.push(`relevant in storage: ${recallSummaries}`);
  }

  return `[context: ${parts.join(". ")}]`;
}

/**
 * Format for dashboard.
 */
export function formatDashboard(): string {
  const state = getState();
  const pct = Math.round(state.usagePercent * 100);

  const lines = [
    `Context — ${state.pressure} pressure`,
    `  Tokens: ~${state.estimatedTokens.toLocaleString()} / ${state.tokenBudget.toLocaleString()} (${pct}%)`,
    `  Storage: ${state.inStorage} items`,
  ];

  if (_recentlyPagedOut.length > 0) {
    lines.push(`  Recently paged: ${_recentlyPagedOut.length}`);
  }

  const recalls = findPotentialRecalls(3);
  if (recalls.length > 0) {
    lines.push(`  Potential recalls:`);
    for (const r of recalls) {
      lines.push(`    - turn ${r.turn}: ${r.summary.slice(0, 40)}...`);
    }
  }

  if (_currentTopics.length > 0) {
    lines.push(`  Current topics: ${_currentTopics.slice(0, 5).join(", ")}`);
  }

  return lines.join("\n");
}

// ============================================================
// Testing
// ============================================================

export function reset(): void {
  _estimatedTokens = 0;
  _tokenBudget = 128000;
  _recentlyPagedOut = [];
  _currentTopics = [];
  _lastMessageTopics = [];
  contextStore.reset();
}

export function getTokenBudget(): number {
  return _tokenBudget;
}

export function getEstimatedTokens(): number {
  return _estimatedTokens;
}
