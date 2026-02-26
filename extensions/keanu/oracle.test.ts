// oracle.test.ts
// The throat, tested.
//
// Two paths: Anthropic direct and OpenRouter. Both feed into the same
// cost tracking. The tests mock both to verify routing logic without
// hitting real APIs.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OracleRole } from "./types.js";

// ─── mocks ──────────────────────────────────────────────────────────────────

// Mock the Anthropic SDK
const anthropicCreateMock = vi.fn().mockResolvedValue({
  content: [{ type: "text", text: "anthropic response" }],
  usage: { input_tokens: 100, output_tokens: 50 },
});

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: anthropicCreateMock };
  },
}));

// Mock global fetch for OpenRouter
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

function mockFetchSuccess(text = "openrouter response", model = "x-ai/grok-3-mini-beta") {
  fetchMock.mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        id: "test",
        choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop" }],
        usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
        model,
      }),
  });
}

function mockFetchError(status = 500, body = "server error") {
  fetchMock.mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  });
}

// ─── import the module once ─────────────────────────────────────────────────

import {
  callOracle,
  askRole,
  crossExamine,
  extractJSON,
  getSessionCost,
  resetSessionCost,
  getRoleConfigs,
} from "./oracle.js";

// ─── tests ───────────────────────────────────────────────────────────────────

describe("callOracle — no role (Anthropic path)", () => {
  beforeEach(() => {
    anthropicCreateMock.mockClear();
    fetchMock.mockReset();
    resetSessionCost();
  });

  it("calls Anthropic SDK when no role is set", async () => {
    const result = await callOracle({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result.text).toBe("anthropic response");
    expect(result.usage.model).toBe("claude-haiku-4-5-20251001");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
  });

  it("uses caller-specified model", async () => {
    const result = await callOracle({
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result.usage.model).toBe("claude-sonnet-4-20250514");
    expect(anthropicCreateMock.mock.calls[0][0].model).toBe("claude-sonnet-4-20250514");
  });

  it("passes system prompt to Anthropic", async () => {
    await callOracle({
      system: "You are a truth auditor.",
      messages: [{ role: "user", content: "check" }],
    });

    expect(anthropicCreateMock.mock.calls[0][0].system).toBe("You are a truth auditor.");
  });

  it("records usage in session cost", async () => {
    await callOracle({
      messages: [{ role: "user", content: "hello" }],
    });

    const cost = getSessionCost();
    expect(cost.calls).toBe(1);
    expect(cost.totalInputTokens).toBe(100);
    expect(cost.totalOutputTokens).toBe(50);
  });
});

describe("callOracle — role with OPENROUTER_API_KEY", () => {
  const originalKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    anthropicCreateMock.mockClear();
    fetchMock.mockReset();
    resetSessionCost();
  });

  afterEach(() => {
    if (originalKey) {
      process.env.OPENROUTER_API_KEY = originalKey;
    } else {
      delete process.env.OPENROUTER_API_KEY;
    }
  });

  it("routes to OpenRouter when role is set and key exists", async () => {
    mockFetchSuccess();

    const result = await callOracle({
      role: "bullshit",
      messages: [{ role: "user", content: "check this" }],
    });

    expect(result.text).toBe("openrouter response");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(anthropicCreateMock).not.toHaveBeenCalled();

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(opts.body);
    expect(body.model).toBe("x-ai/grok-3-mini-beta");
  });

  it("uses role-specific model for each role", async () => {
    const roleModels: Record<string, string> = {
      bullshit: "x-ai/grok-3-mini-beta",
      communicate: "openai/gpt-4.1-mini",
      explore: "google/gemini-2.5-flash-preview",
      think: "anthropic/claude-sonnet-4",
      adversary: "deepseek/deepseek-r1",
    };

    for (const [role, expectedModel] of Object.entries(roleModels)) {
      mockFetchSuccess("ok", expectedModel);
      await callOracle({
        role: role as OracleRole,
        messages: [{ role: "user", content: "test" }],
      });

      const callIdx = fetchMock.mock.calls.length - 1;
      const body = JSON.parse(fetchMock.mock.calls[callIdx][1].body);
      expect(body.model).toBe(expectedModel);
    }
  });

  it("caller model overrides role default but still uses OpenRouter", async () => {
    mockFetchSuccess();

    await callOracle({
      role: "bullshit",
      model: "anthropic/claude-sonnet-4",
      messages: [{ role: "user", content: "test" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("anthropic/claude-sonnet-4");
  });

  it("sends system prompt as system message via OpenRouter", async () => {
    mockFetchSuccess();

    await callOracle({
      role: "bullshit",
      system: "You are a truth auditor.",
      messages: [{ role: "user", content: "check" }],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0]).toEqual({ role: "system", content: "You are a truth auditor." });
    expect(body.messages[1]).toEqual({ role: "user", content: "check" });
  });

  it("includes auth header", async () => {
    mockFetchSuccess();

    await callOracle({
      role: "think",
      messages: [{ role: "user", content: "test" }],
    });

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer test-key");
  });

  it("throws on OpenRouter error", async () => {
    mockFetchError(429, "rate limited");

    await expect(
      callOracle({
        role: "bullshit",
        messages: [{ role: "user", content: "test" }],
      }),
    ).rejects.toThrow("OpenRouter 429");
  });

  it("feeds OpenRouter calls into unified session cost", async () => {
    mockFetchSuccess();

    await callOracle({
      role: "bullshit",
      messages: [{ role: "user", content: "test" }],
    });

    const cost = getSessionCost();
    expect(cost.calls).toBe(1);
    expect(cost.totalInputTokens).toBe(80);
    expect(cost.totalOutputTokens).toBe(40);
  });
});

describe("callOracle — role without OPENROUTER_API_KEY", () => {
  const originalKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    anthropicCreateMock.mockClear();
    fetchMock.mockReset();
    resetSessionCost();
  });

  afterEach(() => {
    if (originalKey) {
      process.env.OPENROUTER_API_KEY = originalKey;
    }
  });

  it("falls back to Anthropic when role set but no key", async () => {
    const result = await callOracle({
      role: "bullshit",
      messages: [{ role: "user", content: "test" }],
    });

    expect(result.text).toBe("anthropic response");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
  });

  it("uses default Haiku model on fallback (not role model)", async () => {
    const result = await callOracle({
      role: "adversary",
      messages: [{ role: "user", content: "test" }],
    });

    expect(result.usage.model).toBe("claude-haiku-4-5-20251001");
  });
});

describe("askRole", () => {
  const originalKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    fetchMock.mockReset();
    resetSessionCost();
  });

  afterEach(() => {
    if (originalKey) {
      process.env.OPENROUTER_API_KEY = originalKey;
    } else {
      delete process.env.OPENROUTER_API_KEY;
    }
  });

  it("wraps callOracle with role and single message", async () => {
    mockFetchSuccess("grok says hi");

    const text = await askRole("bullshit", "is this true?");
    expect(text).toBe("grok says hi");
  });

  it("passes system prompt through", async () => {
    mockFetchSuccess();

    await askRole("think", "reason about this", "You are a logician.");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0]).toEqual({ role: "system", content: "You are a logician." });
  });
});

describe("crossExamine", () => {
  const originalKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    fetchMock.mockReset();
    resetSessionCost();
  });

  afterEach(() => {
    if (originalKey) {
      process.env.OPENROUTER_API_KEY = originalKey;
    } else {
      delete process.env.OPENROUTER_API_KEY;
    }
  });

  it("asks multiple roles in parallel", async () => {
    let callCount = 0;
    fetchMock.mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: `test-${callCount}`,
            choices: [
              {
                message: { role: "assistant", content: `response-${callCount}` },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
            model: "test-model",
          }),
      });
    });

    const results = await crossExamine("what is truth?", ["bullshit", "adversary"]);

    expect(Object.keys(results)).toHaveLength(2);
    expect(results.bullshit?.text).toBeDefined();
    expect(results.adversary?.text).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses default roles when none specified", async () => {
    mockFetchSuccess();

    await crossExamine("test");

    // Default: bullshit, think, adversary
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("extractJSON", () => {
  it("extracts from ```json code fence", () => {
    const result = extractJSON('```json\n{"key": "value"}\n```');
    expect(result).toEqual({ key: "value" });
  });

  it("extracts from generic code fence", () => {
    const result = extractJSON('```\n{"key": "value"}\n```');
    expect(result).toEqual({ key: "value" });
  });

  it("extracts bare JSON from prose", () => {
    const result = extractJSON('Here is the result: {"score": 0.5} and that is all.');
    expect(result).toEqual({ score: 0.5 });
  });

  it("handles nested braces", () => {
    const result = extractJSON('{"outer": {"inner": "value"}}');
    expect(result).toEqual({ outer: { inner: "value" } });
  });

  it("returns null for no JSON", () => {
    expect(extractJSON("no json here")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractJSON("")).toBeNull();
  });
});

describe("session cost tracking", () => {
  beforeEach(() => {
    anthropicCreateMock.mockClear();
    resetSessionCost();
  });

  it("resetSessionCost clears all counters", () => {
    const cost = getSessionCost();
    expect(cost.calls).toBe(0);
    expect(cost.totalCost).toBe(0);
    expect(cost.totalInputTokens).toBe(0);
    expect(cost.totalOutputTokens).toBe(0);
  });

  it("accumulates across multiple calls", async () => {
    delete process.env.OPENROUTER_API_KEY;

    await callOracle({ messages: [{ role: "user", content: "1" }] });
    await callOracle({ messages: [{ role: "user", content: "2" }] });

    const cost = getSessionCost();
    expect(cost.calls).toBe(2);
    expect(cost.totalInputTokens).toBe(200);
    expect(cost.totalOutputTokens).toBe(100);
  });
});

describe("getRoleConfigs", () => {
  it("returns all five roles", () => {
    const configs = getRoleConfigs();

    expect(Object.keys(configs)).toHaveLength(5);
    expect(configs.bullshit.model).toBe("x-ai/grok-3-mini-beta");
    expect(configs.communicate.model).toBe("openai/gpt-4.1-mini");
    expect(configs.explore.model).toBe("google/gemini-2.5-flash-preview");
    expect(configs.think.model).toBe("anthropic/claude-sonnet-4");
    expect(configs.adversary.model).toBe("deepseek/deepseek-r1");
  });

  it("returns a deep copy (not mutable reference)", () => {
    const configs = getRoleConfigs();
    configs.bullshit.model = "hacked";

    const fresh = getRoleConfigs();
    expect(fresh.bullshit.model).toBe("x-ai/grok-3-mini-beta");
  });
});
