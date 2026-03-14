// loop.test.ts
// Tests for the living loop

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInitialState, runBeat, type LoopState, type LoopConfig } from "./loop.js";
import { reset as resetKnowledge } from "../layer-9-memory/knowledge.js";
import { reset as resetClaims } from "../layer-3-causal/silverado.js";

// Mock the oracle so tests don't hit real APIs
vi.mock("../shared/oracle.ts", () => ({
  callOracle: vi.fn().mockResolvedValue({
    text: "The system just started. No prior context. Curious what will happen next.",
    usage: { inputTokens: 100, outputTokens: 50, model: "mock", cost: 0.001, latencyMs: 100 },
  }),
  getSessionCost: vi.fn().mockReturnValue({ calls: 3, totalInputTokens: 300, totalOutputTokens: 150, totalCost: 0.003 }),
}));

describe("createInitialState", () => {
  it("starts at beat 0 with empty state", () => {
    const state = createInitialState();
    expect(state.beatCount).toBe(0);
    expect(state.grokAlerts).toEqual([]);
    expect(state.struggles).toEqual([]);
    expect(state.claudeInsight).toBeUndefined();
    expect(state.intervalMs).toBe(30_000);
  });
});

describe("runBeat", () => {
  const tmpDir = "/tmp/keanu-test-loop";

  beforeEach(() => {
    resetKnowledge();
    resetClaims();
  });

  it("runs a complete beat and increments count", async () => {
    const state = createInitialState();
    const config: LoopConfig = {
      workspaceDir: tmpDir,
      session: "test-session",
    };

    const next = await runBeat(config, state);

    expect(next.beatCount).toBe(1);
    expect(next.lastBeatAt).toBeGreaterThan(0);
    expect(next.claudeInsight).toBeDefined();
    expect(next.geminiSummary).toBeDefined();
    expect(next.helix).toBeDefined();
    expect(next.intervalMs).toBeGreaterThan(0);
  });

  it("runs helix and struggle on Claude's output", async () => {
    const state = createInitialState();
    const config: LoopConfig = {
      workspaceDir: tmpDir,
      session: "test-session",
    };

    const next = await runBeat(config, state);

    // Helix should have analyzed Claude's output
    expect(next.helix).toBeDefined();
    expect(next.helix!.aliveState).toBeDefined();
    expect(next.helix!.strands.factual).toBeGreaterThanOrEqual(0);
    expect(next.helix!.strands.felt).toBeGreaterThanOrEqual(0);

    // Struggle detector ran (may or may not find anything)
    expect(Array.isArray(next.struggles)).toBe(true);
  });

  it("calls onLog during execution", async () => {
    const logs: string[] = [];
    const config: LoopConfig = {
      workspaceDir: tmpDir,
      session: "test-session",
      onLog: (prefix, msg) => logs.push(`${prefix}: ${msg}`),
    };

    await runBeat(config, createInitialState());

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.includes("load"))).toBe(true);
    expect(logs.some((l) => l.includes("gemini"))).toBe(true);
    expect(logs.some((l) => l.includes("grok"))).toBe(true);
    expect(logs.some((l) => l.includes("claude"))).toBe(true);
  });

  it("passes previous insight to next beat's context", async () => {
    const { callOracle } = await import("../shared/oracle.js");
    const mockCallOracle = callOracle as ReturnType<typeof vi.fn>;

    const config: LoopConfig = {
      workspaceDir: tmpDir,
      session: "test-session",
    };

    // First beat
    const first = await runBeat(config, createInitialState());
    expect(first.claudeInsight).toBeDefined();

    // Second beat — should reference first beat's insight in context
    mockCallOracle.mockClear();
    await runBeat(config, first);

    // Claude's call should have received context that includes previous insight
    const claudeCall = mockCallOracle.mock.calls.find(
      (call: unknown[]) => (call[0] as { role: string }).role === "think",
    );
    expect(claudeCall).toBeDefined();
    expect((claudeCall![0] as { messages: Array<{ content: string }> }).messages[0].content).toContain("Last insight");
  });
});
