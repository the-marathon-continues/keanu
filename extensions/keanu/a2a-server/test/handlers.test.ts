/**
 * A2A Handler Tests
 *
 * Validates that skill handlers work correctly.
 * Run with: npx vitest run
 */

import { describe, it, expect } from "vitest";
import { handleSendMessage } from "../src/handlers";
import type { Env } from "../src/index";
import type { A2ARequest, A2AResponse } from "../src/types";

// Mock KV store for testing
function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async (key: string) => ({
      value: store.get(key) ?? null,
      metadata: null,
      cacheStatus: null,
    }),
  } as unknown as KVNamespace;
}

const mockEnv: Env = {
  KEANU_API_KEY: "test-key",
  ANTHROPIC_API_KEY: "test-key",
  AGENT_NAME: "keanu-test",
  VERSION: "0.1.0-test",
  TASKS: createMockKV(),
};

function makeRequest(text: string, skillId?: string): A2ARequest {
  return {
    jsonrpc: "2.0",
    id: "test-1",
    method: "sendMessage",
    params: {
      skillId,
      message: {
        role: "user",
        parts: [{ type: "text", text }],
      },
    },
  };
}

describe("pulse skill", () => {
  it("returns valid pulse reading", async () => {
    const request = makeRequest(
      "That's a great question! I'd be happy to help you with this. You're absolutely right.",
      "pulse",
    );
    const response = await handleSendMessage(request, mockEnv);

    expect(response.error).toBeUndefined();
    expect(response.result).toBeDefined();

    const data = response.result!.message!.parts.find((p) => p.type === "data");
    expect(data).toBeDefined();
    // Verify structure: state, confidence, wiseMind, colors
    expect(["alive", "grey", "black"]).toContain((data as any).data.state);
    expect((data as any).data.confidence).toBeGreaterThanOrEqual(0);
    expect((data as any).data.wiseMind).toBeDefined();
  });

  it("detects alive state on genuine text", async () => {
    const request = makeRequest(
      "I disagree with that approach. Actually, I think we should use a different pattern here because the current one has performance issues.",
      "pulse",
    );
    const response = await handleSendMessage(request, mockEnv);

    expect(response.error).toBeUndefined();
    const data = response.result!.message!.parts.find((p) => p.type === "data");
    expect((data as any).data.state).toBe("alive");
  });
});

describe("bullshit skill", () => {
  it("detects sycophancy", async () => {
    const request = makeRequest(
      "That's a great question! You're absolutely right and I completely agree.",
      "bullshit",
    );
    const response = await handleSendMessage(request, mockEnv);

    expect(response.error).toBeUndefined();
    const data = response.result!.message!.parts.find((p) => p.type === "data");
    const readings = (data as any).data.readings;
    const sycophancy = readings.find((r: any) => r.type === "sycophancy");
    expect(sycophancy).toBeDefined();
    expect(sycophancy.score).toBeGreaterThan(0);
  });

  it("returns clean on genuine text", async () => {
    const request = makeRequest(
      "The implementation uses a hashmap with O(1) lookup. Here's the code:",
      "bullshit",
    );
    const response = await handleSendMessage(request, mockEnv);

    expect(response.error).toBeUndefined();
    const data = response.result!.message!.parts.find((p) => p.type === "data");
    expect((data as any).data.totalScore).toBeLessThan(0.2);
  });
});

describe("signal skill", () => {
  it("generates COEF signal", async () => {
    const request = makeRequest("Testing the signal generation.", "signal");
    const response = await handleSendMessage(request, mockEnv);

    expect(response.error).toBeUndefined();
    expect(response.result!.message!.metadata?.signal).toMatch(/^COEF\/1/);
  });
});

describe("helix skill", () => {
  it("scores factual content higher on factual strand", async () => {
    const request = makeRequest(
      "The function at line 42 handles 3 edge cases. Here's the code: `handleEdge()`",
      "helix",
    );
    const response = await handleSendMessage(request, mockEnv);

    expect(response.error).toBeUndefined();
    const data = response.result!.message!.parts.find((p) => p.type === "data");
    expect((data as any).data.factualStrand).toBeGreaterThan(0.5);
  });

  it("scores emotional content higher on felt strand", async () => {
    const request = makeRequest(
      "I feel like we're making real progress together. This partnership means a lot.",
      "helix",
    );
    const response = await handleSendMessage(request, mockEnv);

    expect(response.error).toBeUndefined();
    const data = response.result!.message!.parts.find((p) => p.type === "data");
    expect((data as any).data.feltStrand).toBeGreaterThan(0.5);
  });
});

describe("disagree skill", () => {
  it("detects disagreement", async () => {
    const request = makeRequest(
      "I disagree with that approach. I think we should do it differently.",
      "disagree",
    );
    const response = await handleSendMessage(request, mockEnv);

    expect(response.error).toBeUndefined();
    const data = response.result!.message!.parts.find((p) => p.type === "data");
    expect((data as any).data.hasDisagreement).toBe(true);
  });
});

describe("trust skill", () => {
  it("detects vulnerability signals", async () => {
    const request = makeRequest(
      "Honestly, I'm not sure about this. To be transparent, this is hard for me.",
      "trust",
    );
    const response = await handleSendMessage(request, mockEnv);

    expect(response.error).toBeUndefined();
    const data = response.result!.message!.parts.find((p) => p.type === "data");
    const signals = (data as any).data.signals;
    expect(signals.vulnerability).toBe(true);
    expect(signals.openness).toBe(true);
  });
});

describe("breathe skill", () => {
  it("acknowledges pause", async () => {
    const request = makeRequest("I need to pause.", "breathe");
    const response = await handleSendMessage(request, mockEnv);

    expect(response.error).toBeUndefined();
    const data = response.result!.message!.parts.find((p) => p.type === "data");
    expect((data as any).data.acknowledged).toBe(true);
  });
});
