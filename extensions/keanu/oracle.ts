// oracle.ts
// The single throat. All fire passes through here.
//
// Every part of the system that needs to talk to an AI imports callOracle.
// Swap the provider, swap the model. Nothing else moves.
//
// Ported from keanu daemon/src/oracle.ts — self-contained.
// Uses ANTHROPIC_API_KEY env var. No daemon config dependency.

import Anthropic from "@anthropic-ai/sdk";
import type { OracleOptions, OracleResponse, OracleUsage } from "./types.js";

// ============================================================
// COST TRACKING
// ============================================================

const PRICING: Record<string, [number, number]> = {
  "claude-opus-4-6": [15.0, 75.0],
  "claude-sonnet-4-5-20250929": [3.0, 15.0],
  "claude-sonnet-4-20250514": [3.0, 15.0],
  "claude-haiku-4-5-20251001": [1.0, 5.0],
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  let pricing: [number, number] = [3.0, 15.0];
  for (const [prefix, p] of Object.entries(PRICING)) {
    if (model.startsWith(prefix)) {
      pricing = p;
      break;
    }
  }
  return (inputTokens / 1_000_000) * pricing[0] + (outputTokens / 1_000_000) * pricing[1];
}

export interface SessionCost {
  calls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
}

let _sessionCost: SessionCost = {
  calls: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCost: 0,
};

function recordUsage(usage: OracleUsage): void {
  _sessionCost.calls++;
  _sessionCost.totalInputTokens += usage.inputTokens;
  _sessionCost.totalOutputTokens += usage.outputTokens;
  _sessionCost.totalCost += usage.cost;
}

export function getSessionCost(): SessionCost {
  return _sessionCost;
}

export function resetSessionCost(): void {
  _sessionCost = { calls: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0 };
}

// ============================================================
// JSON EXTRACTION
// ============================================================

/**
 * Extract JSON from LLM response text. Handles markdown code fences,
 * extra prose, and nested braces.
 */
export function extractJSON(text: string): unknown | null {
  const cleaned = text.trim();

  // try ```json ... ``` first
  const fenceMatch = cleaned.match(/```json\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      /* fall through */
    }
  }

  // try ``` ... ``` (any language fence)
  const anyFence = cleaned.match(/```\s*([\s\S]*?)```/);
  if (anyFence) {
    try {
      return JSON.parse(anyFence[1].trim());
    } catch {
      /* fall through */
    }
  }

  // balanced brace matching
  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 1024;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

/**
 * Call the oracle. The one function. All fire passes through here.
 *
 * Uses ANTHROPIC_API_KEY from environment.
 * Defaults to Haiku for cost efficiency (internal alignment calls).
 */
export async function callOracle(opts: OracleOptions): Promise<OracleResponse> {
  const model = opts.model || DEFAULT_MODEL;
  const maxTokens = opts.maxTokens || DEFAULT_MAX_TOKENS;
  const startTime = Date.now();

  const client = getClient();

  const messages: Anthropic.MessageParam[] = opts.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const params: Anthropic.MessageCreateParams = {
    model,
    max_tokens: maxTokens,
    messages,
    ...(opts.system ? { system: opts.system } : {}),
  };

  const response = await client.messages.create(params);
  const latencyMs = Date.now() - startTime;

  // Extract text
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Build usage
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const cost = estimateCost(model, inputTokens, outputTokens);

  const usage: OracleUsage = { inputTokens, outputTokens, model, cost, latencyMs };
  recordUsage(usage);

  return { text, usage };
}
