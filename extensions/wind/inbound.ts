/**
 * inbound.ts
 * Knowledge flows from world-book (L7-L9) to keanu (L1-L6).
 *
 * L7-L9 process outbound learnings and produce:
 * - Updated governance rules (L8)
 * - Memory updates (L9)
 * - Revision guidance (L7)
 *
 * Wind injects this back into the prompt via before_prompt_build.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ============================================================
// Types
// ============================================================

export interface InboundPayload {
  timestamp: string;
  source: "L7" | "L8" | "L9";
  type: "guidance" | "rule" | "memory";
  content: string;
  priority: "high" | "medium" | "low";
  ttl?: number; // turns until expiration
}

interface InboundState {
  items: InboundPayload[];
  lastUpdated: string;
}

// ============================================================
// State
// ============================================================

let state: InboundState = {
  items: [],
  lastUpdated: new Date().toISOString(),
};

// ============================================================
// Inbound flow
// ============================================================

/**
 * Load inbound state from disk.
 */
async function load(workspaceDir: string): Promise<void> {
  const file = join(workspaceDir, "awareness", "wind-inbound.json");
  try {
    const raw = await readFile(file, "utf-8");
    state = JSON.parse(raw);

    // Expire old items
    const now = Date.now();
    state.items = state.items.filter((item) => {
      if (!item.ttl) return true;
      const age = (now - new Date(item.timestamp).getTime()) / (1000 * 60 * 60);
      return age < item.ttl * 24; // ttl is in days
    });
  } catch {
    // No prior state
    state = { items: [], lastUpdated: new Date().toISOString() };
  }
}

/**
 * Save inbound state to disk.
 */
async function save(workspaceDir: string): Promise<void> {
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });

  const file = join(dir, "wind-inbound.json");
  state.lastUpdated = new Date().toISOString();
  await writeFile(file, JSON.stringify(state, null, 2));
}

/**
 * Add an inbound item (called by L7-L9 pipelines).
 */
function addItem(item: InboundPayload): void {
  state.items.push(item);
}

/**
 * Get injection for before_prompt_build.
 * Returns formatted string if there's something to inject.
 */
function getInjection(): string | null {
  if (state.items.length === 0) return null;

  // Priority order: high first
  const sorted = [...state.items].sort((a, b) => {
    const priority = { high: 0, medium: 1, low: 2 };
    return priority[a.priority] - priority[b.priority];
  });

  // Take top 3 items
  const top = sorted.slice(0, 3);
  if (top.length === 0) return null;

  const items = top.map((item) => {
    const source =
      item.source === "L7" ? "revision" : item.source === "L8" ? "governance" : "memory";
    return `[${source}] ${item.content}`;
  });

  return `[wind: ${items.join(" | ")}]`;
}

/**
 * Clear all inbound items.
 */
function clear(): void {
  state.items = [];
}

/**
 * Get current items (for debugging/inspection).
 */
function getItems(): readonly InboundPayload[] {
  return state.items;
}

export const inboundFlow = {
  load,
  save,
  addItem,
  getInjection,
  clear,
  getItems,
};
