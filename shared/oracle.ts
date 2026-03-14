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
import type {
  OracleContentBlock,
  OracleOptions,
  OracleResponse,
  OracleRole,
  OracleToolDef,
  OracleToolOptions,
  OracleToolResponse,
  OracleUsage,
} from "./types.ts";

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
  struggle: {
    role: "struggle",
    model: "x-ai/grok-3-mini-beta",
    description:
      "Struggle detection — assumes positive intent, different family catches different blind spots",
    maxTokens: 1024,
  },
  bullshit: {
    role: "bullshit", // deprecated alias for struggle
    model: "x-ai/grok-3-mini-beta",
    description: "Struggle detection — different model family catches different blind spots",
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
    model: "google/gemini-2.5-flash",
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
  "google/gemini-2.5-flash": [0.15, 0.6],
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
export function extractJSON(text: string): unknown {
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
  if (start === -1) {
    return null;
  }

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
    if (inString) {
      continue;
    }
    if (ch === "{") {
      depth++;
    }
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
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
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

// 30 second timeout for LLM calls — long enough for complex reasoning, short enough to fail fast
const OPENROUTER_TIMEOUT_MS = 30_000;

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
    signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const latencyMs = Date.now() - startTime;

  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text && data.choices?.length) {
    console.debug(`[keanu/oracle] OpenRouter returned empty content for model=${model}`);
  }
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
  if (!_client) {
    _client = new Anthropic();
  }
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
// STREAMING — tokens flow as they arrive
// ============================================================

export interface OracleStreamOptions extends OracleOptions {
  onDelta: (text: string) => void;
}

async function callAnthropicStream(
  model: string,
  maxTokens: number,
  opts: OracleOptions,
  onDelta: (text: string) => void,
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

  const stream = client.messages.stream(params);
  let fullText = "";

  stream.on("text", (delta) => {
    fullText += delta;
    onDelta(delta);
  });

  const finalMessage = await stream.finalMessage();
  const latencyMs = Date.now() - startTime;

  const inputTokens = finalMessage.usage?.input_tokens ?? 0;
  const outputTokens = finalMessage.usage?.output_tokens ?? 0;
  const cost = estimateCost(model, inputTokens, outputTokens);

  const usage: OracleUsage = { inputTokens, outputTokens, model, cost, latencyMs };
  recordUsage(usage);

  return { text: fullText, usage };
}

async function callOpenRouterStream(
  apiKey: string,
  model: string,
  maxTokens: number,
  messages: OpenRouterMessage[],
  onDelta: (text: string) => void,
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
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, stream: true }),
    signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter stream ${response.status}: ${body.slice(0, 200)}`);
  }

  let fullText = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) {
        continue;
      }
      const data = line.slice(6);
      if (data === "[DONE]") {
        continue;
      }
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          onDelta(delta);
        }
        if (parsed.usage) {
          inputTokens = parsed.usage.prompt_tokens ?? 0;
          outputTokens = parsed.usage.completion_tokens ?? 0;
        }
      } catch {
        /* skip malformed SSE lines */
      }
    }
  }

  const latencyMs = Date.now() - startTime;

  // Fallback: estimate tokens from text if usage missing from stream
  if (outputTokens === 0 && fullText.length > 0) {
    outputTokens = Math.ceil(fullText.length / 4);
  }

  const cost = estimateCost(model, inputTokens, outputTokens);
  const usage: OracleUsage = { inputTokens, outputTokens, model, cost, latencyMs };
  recordUsage(usage);

  return { text: fullText, usage };
}

function buildOpenRouterMessages(opts: OracleOptions): OpenRouterMessage[] {
  const messages: OpenRouterMessage[] = [];
  if (opts.system) {
    messages.push({ role: "system", content: opts.system });
  }
  for (const m of opts.messages) {
    messages.push({ role: m.role, content: m.content });
  }
  return messages;
}

/**
 * Call the oracle with streaming. Tokens flow through onDelta as they arrive.
 * Returns the complete response + usage after the stream ends.
 */
export async function callOracleStream(opts: OracleStreamOptions): Promise<OracleResponse> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const role = opts.role;
  const roleConfig = role ? ROLE_DEFAULTS[role] : undefined;

  if (role && openRouterKey && roleConfig) {
    const model = opts.model || roleConfig.model;
    const maxTokens = opts.maxTokens || roleConfig.maxTokens;
    const messages = buildOpenRouterMessages(opts);
    return callOpenRouterStream(openRouterKey, model, maxTokens, messages, opts.onDelta);
  }

  const model = opts.model || DEFAULT_MODEL;
  const maxTokens = opts.maxTokens || DEFAULT_MAX_TOKENS;
  return callAnthropicStream(model, maxTokens, opts, opts.onDelta);
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

  // Route through OpenRouter when: role is set + key exists + role config exists
  // Caller's explicit model overrides the role default but still uses OpenRouter
  if (role && openRouterKey && roleConfig) {
    const model = opts.model || roleConfig.model;
    const maxTokens = opts.maxTokens || roleConfig.maxTokens;

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

// ============================================================
// OPENROUTER TOOL PATH
// ============================================================

// OpenRouter uses OpenAI-style tool definitions on the wire regardless of model.
// Callers speak Anthropic-style (input_schema). We translate before the fetch.
interface OpenRouterToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
}

function toOpenRouterTool(tool: OracleToolDef): OpenRouterToolDef {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  };
}

interface OpenRouterToolResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

async function callOpenRouterWithTools(
  apiKey: string,
  model: string,
  maxTokens: number,
  messages: OpenRouterMessage[],
  tools: OracleToolDef[],
): Promise<OracleToolResponse> {
  const startTime = Date.now();

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/the-marathon-continues/keanu",
      "X-Title": "Keanu Alignment Mirror",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      tools: tools.map(toOpenRouterTool),
    }),
    signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as OpenRouterToolResponse;
  const latencyMs = Date.now() - startTime;

  const choice = data.choices?.[0];
  const content: OracleContentBlock[] = [];

  // Text content from message.content
  if (choice?.message?.content) {
    content.push({ type: "text", text: choice.message.content });
  }

  // Tool use blocks from tool_calls
  for (const tc of choice?.message?.tool_calls ?? []) {
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(tc.function.arguments) as Record<string, unknown>;
    } catch {
      input = { _raw: tc.function.arguments };
    }
    content.push({
      type: "tool_use",
      id: tc.id,
      name: tc.function.name,
      input,
    });
  }

  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const outputTokens = data.usage?.completion_tokens ?? 0;
  const cost = estimateCost(model, inputTokens, outputTokens);

  const usage: OracleUsage = { inputTokens, outputTokens, model, cost, latencyMs };
  recordUsage(usage);

  return {
    content,
    usage,
    stopReason: choice?.finish_reason ?? "unknown",
  };
}

// ============================================================
// ANTHROPIC TOOL PATH
// ============================================================

async function callAnthropicWithTools(
  model: string,
  maxTokens: number,
  opts: OracleToolOptions,
): Promise<OracleToolResponse> {
  const startTime = Date.now();
  const client = getClient();

  const messages: Anthropic.MessageParam[] = opts.messages.map((m) => {
    // String content — plain message
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content } as Anthropic.MessageParam;
    }

    // Array content — either content blocks (assistant) or tool results (user)
    const blocks = m.content as Array<Record<string, unknown>>;
    if (blocks.length > 0 && blocks[0].type === "tool_result") {
      // Tool result blocks → Anthropic user message with tool_result content
      return {
        role: "user" as const,
        content: blocks.map((b) => ({
          type: "tool_result" as const,
          tool_use_id: b.tool_use_id as string,
          content: b.content as string,
        })),
      } as Anthropic.MessageParam;
    }

    // Content blocks (text + tool_use) → Anthropic assistant message
    return {
      role: "assistant" as const,
      content: blocks.map((b) => {
        if (b.type === "tool_use") {
          return {
            type: "tool_use" as const,
            id: b.id as string,
            name: b.name as string,
            input: b.input as Record<string, unknown>,
          };
        }
        return { type: "text" as const, text: (b.text as string) ?? "" };
      }),
    } as Anthropic.MessageParam;
  });

  // Cast to the SDK's Tool type — input_schema is unknown in OracleToolDef but the
  // SDK accepts it as Record<string, unknown>. The cast is safe: we're forwarding
  // the caller's schema verbatim.
  const tools = (opts.tools ?? []).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Record<string, unknown>,
  })) as Anthropic.Tool[];

  const params: Anthropic.MessageCreateParams = {
    model,
    max_tokens: maxTokens,
    messages,
    tools,
    ...(opts.system ? { system: opts.system } : {}),
  };

  const response = await client.messages.create(params);
  const latencyMs = Date.now() - startTime;

  // SDK returns content blocks natively — text and tool_use arrive typed.
  const content: OracleContentBlock[] = response.content.map((block) => {
    if (block.type === "tool_use") {
      return {
        type: "tool_use" as const,
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      };
    }
    // Text block (the only other type the SDK returns in practice)
    return {
      type: "text" as const,
      text: (block as Anthropic.TextBlock).text,
    };
  });

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const cost = estimateCost(model, inputTokens, outputTokens);

  const usage: OracleUsage = { inputTokens, outputTokens, model, cost, latencyMs };
  recordUsage(usage);

  return {
    content,
    usage,
    stopReason: response.stop_reason ?? "unknown",
  };
}

// ============================================================
// TOOL-AWARE ENTRY POINT
// ============================================================

/**
 * Call the oracle with tools. Same routing logic as callOracle — OpenRouter
 * when a role + key exist, Anthropic direct otherwise. Returns raw content blocks
 * (text and tool_use) instead of flattening to a string.
 *
 * callOracle strips tool_use blocks. This function keeps them.
 * Use this when you need to drive an agentic loop.
 */
export async function callOracleWithTools(opts: OracleToolOptions): Promise<OracleToolResponse> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const role = opts.role;
  const roleConfig = role ? ROLE_DEFAULTS[role] : undefined;

  // OpenRouter path: role set + key present + role config found
  if (role && openRouterKey && roleConfig) {
    const model = opts.model || roleConfig.model;
    const maxTokens = opts.maxTokens || roleConfig.maxTokens;

    const messages: OpenRouterMessage[] = [];
    if (opts.system) {
      messages.push({ role: "system", content: opts.system });
    }
    for (const m of opts.messages) {
      if (typeof m.content === "string") {
        messages.push({ role: m.role, content: m.content });
      } else {
        // Structured content — translate to OpenRouter format
        const blocks = m.content as Array<Record<string, unknown>>;
        if (blocks.length > 0 && blocks[0].type === "tool_result") {
          // Tool results → individual "tool" role messages (OpenAI format)
          for (const b of blocks) {
            messages.push({
              role: "tool",
              content: b.content as string,
              tool_call_id: b.tool_use_id as string,
            });
          }
        } else {
          // Assistant content blocks (text + tool_use) → assistant with tool_calls
          const textParts: string[] = [];
          const toolCalls: OpenRouterMessage["tool_calls"] = [];
          for (const b of blocks) {
            if (b.type === "tool_use") {
              toolCalls.push({
                id: b.id as string,
                type: "function",
                function: {
                  name: b.name as string,
                  arguments: JSON.stringify(b.input),
                },
              });
            } else if (b.type === "text") {
              textParts.push(b.text as string);
            }
          }
          messages.push({
            role: "assistant",
            content: textParts.join("") || "",
            ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
          });
        }
      }
    }

    return callOpenRouterWithTools(openRouterKey, model, maxTokens, messages, opts.tools ?? []);
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
  return callAnthropicWithTools(model, maxTokens, opts);
}
