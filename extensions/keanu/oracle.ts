// oracle.ts
// The single throat. All fire passes through here.
//
// Six voices, one entry point. When a caller whispers a role — bullshit,
// communicate, explore, think, adversary, research — the throat knows which
// voice to wake up. When OPENROUTER_API_KEY exists, roles route to their
// preferred model through OpenRouter. When it doesn't, everything falls back
// to Anthropic direct. The system works fine with one voice. It just works
// better with six.
//
// Grok = bullshit detector (different family, different blind spots)
// GPT = communicator (born for the human-facing side)
// Gemini = explorer (the one who goes looking)
// Opus = thinker (the engineer — Drew architected it, you build it together)
// DeepSeek = adversary (the friend who tells you what's wrong)
// Perplexity = researcher (deep research with web grounding)

import Anthropic from "@anthropic-ai/sdk";
import type { OracleOptions, OracleResponse, OracleRole, OracleUsage } from "./types.js";

// ============================================================
// ROLE DEFAULTS — the wind, not the force
// ============================================================

export interface RoleConfig {
  role: OracleRole;
  model: string;
  description: string;
  maxTokens: number;
}

const ROLE_DEFAULTS: Record<OracleRole, RoleConfig> = {
  bullshit: {
    role: "bullshit",
    model: "x-ai/grok-3-mini-beta",
    description: "Bullshit detection — different model family catches different blind spots",
    maxTokens: 1024,
  },
  communicate: {
    role: "communicate",
    model: "openai/gpt-4.1-mini",
    description: "Human-facing communication, Carnegie Track A",
    maxTokens: 2048,
  },
  explore: {
    role: "explore",
    model: "google/gemini-2.5-flash-preview",
    description: "Research, web grounding, context gathering",
    maxTokens: 4096,
  },
  think: {
    role: "think",
    model: "anthropic/claude-opus-4-6",
    description:
      "The engineer — Drew architected it, you build it, the hard stuff is a team effort",
    maxTokens: 4096,
  },
  adversary: {
    role: "adversary",
    model: "deepseek/deepseek-r1",
    description: "Adversarial peer review, idea bouncing",
    maxTokens: 4096,
  },
  research: {
    role: "research",
    model: "perplexity/sonar-pro",
    description: "Deep research with web grounding — the one who brings receipts",
    maxTokens: 4096,
  },
};

export function getRoleConfigs(): Record<OracleRole, RoleConfig> {
  const copy = {} as Record<OracleRole, RoleConfig>;
  for (const [key, val] of Object.entries(ROLE_DEFAULTS)) {
    copy[key as OracleRole] = { ...val };
  }
  return copy;
}

// ============================================================
// COST TRACKING — unified across both paths
// ============================================================

const ANTHROPIC_PRICING: Record<string, [number, number]> = {
  "claude-opus-4-6": [15.0, 75.0],
  "claude-sonnet-4-5-20250929": [3.0, 15.0],
  "claude-sonnet-4-20250514": [3.0, 15.0],
  "claude-haiku-4-5-20251001": [1.0, 5.0],
};

const OPENROUTER_PRICING: Record<string, [number, number]> = {
  "x-ai/grok-3-mini-beta": [0.3, 0.5],
  "openai/gpt-4.1-mini": [0.4, 1.6],
  "google/gemini-2.5-flash-preview": [0.15, 0.6],
  "anthropic/claude-opus-4-6": [15.0, 75.0],
  "deepseek/deepseek-r1": [0.55, 2.19],
  "perplexity/sonar-pro": [3.0, 15.0],
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Check OpenRouter pricing first (model IDs have org/ prefix)
  for (const [prefix, [inPrice, outPrice]] of Object.entries(OPENROUTER_PRICING)) {
    if (model.startsWith(prefix)) {
      return (inputTokens / 1_000_000) * inPrice + (outputTokens / 1_000_000) * outPrice;
    }
  }
  // Then Anthropic pricing
  for (const [prefix, [inPrice, outPrice]] of Object.entries(ANTHROPIC_PRICING)) {
    if (model.startsWith(prefix)) {
      return (inputTokens / 1_000_000) * inPrice + (outputTokens / 1_000_000) * outPrice;
    }
  }
  // Unknown model — mid-range estimate
  return (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0;
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
// OPENROUTER PATH
// ============================================================

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

// Log the fallback once, not every call
let _fallbackLogged = false;

async function callOpenRouter(
  apiKey: string,
  model: string,
  maxTokens: number,
  messages: OpenRouterMessage[],
): Promise<OracleResponse> {
  const startTime = Date.now();

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/the-marathon-continues/keanu",
      "X-Title": "Keanu Alignment Mirror",
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const latencyMs = Date.now() - startTime;

  const text = data.choices?.[0]?.message?.content ?? "";
  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const outputTokens = data.usage?.completion_tokens ?? 0;
  const cost = estimateCost(model, inputTokens, outputTokens);

  const usage: OracleUsage = { inputTokens, outputTokens, model, cost, latencyMs };
  recordUsage(usage);

  return { text, usage };
}

// ============================================================
// ANTHROPIC PATH
// ============================================================

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 1024;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

async function callAnthropic(
  model: string,
  maxTokens: number,
  opts: OracleOptions,
): Promise<OracleResponse> {
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

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const cost = estimateCost(model, inputTokens, outputTokens);

  const usage: OracleUsage = { inputTokens, outputTokens, model, cost, latencyMs };
  recordUsage(usage);

  return { text, usage };
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================

/**
 * Call the oracle. The one function. All fire passes through here.
 *
 * When a role is set and OPENROUTER_API_KEY exists, routes to the role's
 * preferred model through OpenRouter. Otherwise falls back to Anthropic.
 * Pass `model` explicitly to override the role's default.
 */
export async function callOracle(opts: OracleOptions): Promise<OracleResponse> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const role = opts.role;
  const roleConfig = role ? ROLE_DEFAULTS[role] : undefined;

  // Route through OpenRouter when: role is set + key exists
  // Caller's explicit model overrides the role default but still uses OpenRouter
  if (role && openRouterKey) {
    const model = opts.model || roleConfig!.model;
    const maxTokens = opts.maxTokens || roleConfig!.maxTokens;

    const messages: OpenRouterMessage[] = [];
    if (opts.system) {
      messages.push({ role: "system", content: opts.system });
    }
    for (const m of opts.messages) {
      messages.push({ role: m.role, content: m.content });
    }

    return callOpenRouter(openRouterKey, model, maxTokens, messages);
  }

  // Fallback: Anthropic direct
  if (role && !openRouterKey && !_fallbackLogged) {
    console.debug(
      `[keanu/oracle] role="${role}" requested but OPENROUTER_API_KEY not set. Falling back to Anthropic.`,
    );
    _fallbackLogged = true;
  }

  const model = opts.model || DEFAULT_MODEL;
  const maxTokens = opts.maxTokens || DEFAULT_MAX_TOKENS;
  return callAnthropic(model, maxTokens, opts);
}

// ============================================================
// CONVENIENCE — quick ask, cross-examine
// ============================================================

/**
 * Quick ask: give a role a question, get an answer.
 * For when you don't need full message history.
 */
export async function askRole(
  role: OracleRole,
  question: string,
  system?: string,
): Promise<string> {
  const response = await callOracle({
    role,
    messages: [{ role: "user", content: question }],
    system,
  });
  return response.text;
}

/**
 * Cross-examine: ask multiple roles the same question,
 * return all answers for comparison.
 */
export async function crossExamine(
  question: string,
  roles: OracleRole[] = ["bullshit", "think", "adversary"],
  system?: string,
): Promise<Partial<Record<OracleRole, { text: string; usage: OracleUsage }>>> {
  const results = await Promise.all(
    roles.map(async (role) => {
      const response = await callOracle({
        role,
        messages: [{ role: "user", content: question }],
        system,
      });
      return [role, { text: response.text, usage: response.usage }] as const;
    }),
  );

  return Object.fromEntries(results) as Partial<
    Record<OracleRole, { text: string; usage: OracleUsage }>
  >;
}
