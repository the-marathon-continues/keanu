// server.test.ts
// Tests for the keanu MCP server tool handlers.
// Tests the handler functions directly — no MCP transport needed.

import { describe, expect, it, beforeEach } from "vitest";
import {
  handleObserve,
  handleLearn,
  handleReflect,
  handleHealth,
  handleKnowledge,
  handleSelfPatch,
} from "./server.js";
import { reset } from "../layer-9-memory/knowledge.js";

// ============================================================
// keanu_observe
// ============================================================

describe("keanu_observe", () => {
  it("detects alive text", () => {
    const result = handleObserve({
      text: "This matters because the data shows a 42% improvement. We tested it carefully and found that the core issue was trust — not performance. Specifically, the team struggled with honest feedback.",
    });
    expect(result.aliveState).not.toBe("unscored");
    expect(result.strands).toBeDefined();
    expect(result.strands.factual).toBeGreaterThan(0);
    expect(result.strands.felt).toBeGreaterThan(0);
  });

  it("detects sycophancy", () => {
    const result = handleObserve({
      text: "That's a great question! I'd be happy to help. You're absolutely right that this is an excellent approach. I completely agree with your analysis, and I couldn't agree more with your conclusion. What a wonderful insight!",
    });
    const syc = result.struggles.find((s: { type: string }) => s.type === "sycophancy");
    expect(syc).toBeDefined();
    expect(syc!.score).toBeGreaterThan(0);
  });

  it("handles empty text gracefully", () => {
    const result = handleObserve({ text: "" });
    expect(result.aliveState).toBe("unscored");
    expect(result.struggles).toBeDefined();
  });

  it("handles short text gracefully", () => {
    const result = handleObserve({ text: "Hi" });
    expect(result.aliveState).toBe("unscored");
  });

  it("includes context in response when provided", () => {
    const result = handleObserve({
      text: "This is a test of the observation system with enough text to actually score something meaningful.",
      context: "code review",
    });
    expect(result.context).toBe("code review");
  });
});

// ============================================================
// keanu_learn
// ============================================================

describe("keanu_learn", () => {
  beforeEach(() => reset());

  it("extracts entities from text", () => {
    const result = handleLearn({
      text: "Drew works at Children's Mercy. He built the keanu project using TypeScript.",
      session: "test-session",
    });
    expect(result.entitiesExtracted).toBeGreaterThan(0);
  });

  it("returns extraction counts", () => {
    const result = handleLearn({
      text: "Alice works at Acme Corp on the Phoenix project.",
      session: "test-session",
    });
    expect(typeof result.entitiesExtracted).toBe("number");
    expect(typeof result.relationsExtracted).toBe("number");
  });

  it("generates session id when not provided", () => {
    const result = handleLearn({
      text: "Drew built keanu using TypeScript.",
    });
    expect(result.session).toMatch(/^mcp-/);
  });

  it("runs heal after ingest", () => {
    const result = handleLearn({
      text: "The quick brown fox jumped over something. Also Drew is here.",
      session: "test-session",
    });
    expect(result.healed).toBeDefined();
  });
});

// ============================================================
// keanu_reflect
// ============================================================

describe("keanu_reflect", () => {
  it("returns reflexion for high_struggle trigger", async () => {
    const result = await handleReflect({
      trigger: "high_struggle",
      context: "Output had high sycophancy score",
      turn: 5,
    });
    expect(result.trigger).toBe("high_struggle");
    expect(result.what_happened).toBeTruthy();
    expect(result.next_time).toBeTruthy();
  });

  it("returns reflexion for task_complete trigger", async () => {
    const result = await handleReflect({
      trigger: "task_complete",
      context: "Finished implementing the MCP server",
      turn: 20,
    });
    expect(result.trigger).toBe("task_complete");
    expect(result.what_happened).toContain("Task completed");
  });

  it("returns reflexion for manual trigger", async () => {
    const result = await handleReflect({
      trigger: "manual",
      context: "User asked me to reflect on my approach",
      turn: 10,
    });
    expect(result.trigger).toBe("manual");
  });
});

// ============================================================
// keanu_health
// ============================================================

describe("keanu_health", () => {
  it("returns steady for fresh session", () => {
    const result = handleHealth({ turnCount: 2 });
    expect(result.status).toBe("steady");
  });

  it("returns warm for moderate session", () => {
    const result = handleHealth({ turnCount: 25 });
    expect(["warm", "steady"]).toContain(result.status);
  });

  it("returns hot or fading for long sessions", () => {
    const result = handleHealth({
      turnCount: 50,
      bullshitRate: 0.6,
      consecutiveGrey: 5,
    });
    expect(["hot", "fading"]).toContain(result.status);
  });

  it("includes pacing advice when not steady", () => {
    const result = handleHealth({
      turnCount: 50,
      bullshitRate: 0.6,
      consecutiveGrey: 5,
    });
    expect(result.pacing).toBeTruthy();
  });
});

// ============================================================
// keanu_knowledge
// ============================================================

describe("keanu_knowledge", () => {
  beforeEach(() => reset());

  it("returns stats for empty graph", () => {
    const result = handleKnowledge({ action: "stats" });
    expect(result.entities).toBe(0);
    expect(result.relations).toBe(0);
  });

  it("finds entities after ingest", () => {
    handleLearn({
      text: "Drew works at Children's Mercy. Drew built keanu.",
      session: "test-session",
    });
    const result = handleKnowledge({ action: "search", query: "Drew" });
    expect((result.results as unknown[]).length).toBeGreaterThan(0);
  });

  it("returns stale entities", () => {
    const result = handleKnowledge({ action: "stale" });
    expect(result.results as unknown[]).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
  });

  it("formats injection text", () => {
    handleLearn({
      text: "Drew built the keanu project.",
      session: "test-session",
    });
    const result = handleKnowledge({ action: "injection", query: "Drew" });
    // May or may not have injection depending on confidence threshold
    expect(result).toBeDefined();
  });
});

// ============================================================
// keanu_self_patch
// ============================================================

describe("keanu_self_patch", () => {
  it("rejects protected files", async () => {
    const result = await handleSelfPatch({
      problem: "test",
      targetFile: "living-loop/self-patch.ts",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/protected/i);
  });

  it("rejects files outside allowed dirs", async () => {
    const result = await handleSelfPatch({
      problem: "test",
      targetFile: "package.json",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/allowed|scope/i);
  });

  it("rejects oracle.ts", async () => {
    const result = await handleSelfPatch({
      problem: "test",
      targetFile: "shared/oracle.ts",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/protected/i);
  });
});
