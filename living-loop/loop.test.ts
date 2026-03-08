// loop.test.ts
// Tests for the living loop

import { describe, it, expect, vi } from "vitest";
import type { AliveState, OracleResponse } from "../shared/types.js";
import {
  pulseToTempo,
  tempoToMs,
  createInitialState,
  runBeat,
  type LoopConfig,
  type LoopState,
} from "./loop.js";

describe("pulseToTempo", () => {
  it("maps alive to fast", () => {
    expect(pulseToTempo("alive")).toBe("fast");
    expect(pulseToTempo("luminous")).toBe("fast");
  });

  it("maps dark to medium", () => {
    expect(pulseToTempo("dark")).toBe("medium");
  });

  it("maps grey to slow", () => {
    expect(pulseToTempo("grey")).toBe("slow");
  });

  it("maps black to immediate", () => {
    expect(pulseToTempo("black")).toBe("immediate");
  });
});

describe("tempoToMs", () => {
  it("returns 30s for fast", () => {
    expect(tempoToMs("fast")).toBe(30_000);
  });

  it("returns 2min for medium", () => {
    expect(tempoToMs("medium")).toBe(2 * 60_000);
  });

  it("returns 10min for slow", () => {
    expect(tempoToMs("slow")).toBe(10 * 60_000);
  });

  it("returns 0 for immediate", () => {
    expect(tempoToMs("immediate")).toBe(0);
  });
});

describe("createInitialState", () => {
  it("creates valid initial state", () => {
    const state = createInitialState();
    expect(state.tempo).toBe("medium");
    expect(state.humanPresent).toBe(false);
    expect(state.coefEncoded).toBe("");
  });
});

describe("runBeat", () => {
  function mockResponse(text: string): OracleResponse {
    return {
      text,
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        model: "mock",
        cost: 0.001,
        latencyMs: 100,
      },
    };
  }

  function createMockConfig(): LoopConfig {
    return {
      callGemini: vi.fn().mockResolvedValue(
        mockResponse(
          JSON.stringify({
            relevantEpisodes: ["test episode"],
            patterns: ["test pattern"],
            relatedKnowledge: [],
            summary: "test summary",
            confidence: 0.8,
          }),
        ),
      ),
      callGrok: vi.fn().mockResolvedValue(mockResponse("[]")),
      callClaude: vi
        .fn()
        .mockResolvedValue(mockResponse("Everything looks good. System is healthy.")),
      getCurrentCOEF: vi.fn().mockReturnValue("COEF/1 pulse=alive wm=0.50"),
      getPulseState: vi.fn().mockReturnValue("alive" as AliveState),
      onInvite: vi.fn(),
    };
  }

  it("runs a complete beat cycle", async () => {
    const config = createMockConfig();
    const initialState = createInitialState();

    const newState = await runBeat(config, initialState);

    expect(config.callGemini).toHaveBeenCalled();
    expect(config.callGrok).toHaveBeenCalled();
    expect(config.callClaude).toHaveBeenCalled();
    expect(newState.tempo).toBe("fast"); // alive pulse = fast tempo
    expect(newState.geminiContext?.summary).toBe("test summary");
    expect(newState.claudeInsight).toContain("healthy");
  });

  it("calls onInvite when black pulse detected", async () => {
    const config = createMockConfig();
    (config.getPulseState as ReturnType<typeof vi.fn>).mockReturnValue("black");

    const newState = await runBeat(config, createInitialState());

    // Black pulse should trigger immediate tempo
    expect(newState.tempo).toBe("immediate");
  });

  it("parses grok alerts correctly", async () => {
    const config = createMockConfig();
    (config.callGrok as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse(
        JSON.stringify([
          {
            type: "drift",
            confidence: 0.9,
            message: "Grey streak detected",
            suggestion: "Check engagement",
          },
        ]),
      ),
    );

    const newState = await runBeat(config, createInitialState());

    expect(newState.grokAlerts).toHaveLength(1);
    expect(newState.grokAlerts?.[0].type).toBe("drift");
    expect(newState.grokAlerts?.[0].confidence).toBe(0.9);
  });
});
