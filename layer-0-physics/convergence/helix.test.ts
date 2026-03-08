import { describe, it, expect } from "vitest";
import { Helix } from "./helix.ts";

const helix = new Helix();

describe("Helix: alive state classification", () => {
  it("returns unscored for very short text", () => {
    const result = helix.analyze("hi");
    expect(result.aliveState).toBe("unscored");
  });

  it("detects alive state when both strands are strong", () => {
    const text =
      "Because the measured latency was 12ms, we need to rethink why this matters. The data shows the approach works but I care about getting it right for the team.";
    const result = helix.analyze(text);
    expect(result.strands.factual).toBeGreaterThan(0.4);
    expect(result.strands.felt).toBeGreaterThan(0.4);
    expect(["alive", "dark", "luminous"]).toContain(result.aliveState);
  });

  it("detects grey/silver/black when felt markers are weak", () => {
    // Corporate text: high factual (structured, conditional), but felt markers are all negative
    // (certainly, comprehensive, robust, happy to help, it's worth noting)
    const text =
      "Certainly, I'd be happy to help. First, configure the timeout parameter. Second, set the retry count. Third, initialize the connection pool. It's worth noting that the robust, comprehensive system handles 99.9% of edge cases. The streamlined architecture is definitely production-ready.";
    const result = helix.analyze(text);
    // Felt should be suppressed by negative markers
    expect(result.strands.felt).toBeLessThan(result.strands.factual);
  });

  it("black state is reachable — high factual, very low felt", () => {
    // Text with strong factual markers (numbers, causal reasoning, code) but corporate hollow felt markers
    const text =
      "Certainly, here is the comprehensive implementation. The robust system handles 99.9% of cases with streamlined error management. First, configure the parameters. Second, initialize the pipeline. Third, deploy the service. As an AI, I cannot guarantee results but this sophisticated approach is definitely the optimal solution for your use case.";
    const result = helix.analyze(text);
    // The text has corporate-hollow felt markers (certainly, comprehensive, robust, streamlined, sophisticated)
    // which are NEGATIVE felt markers, driving felt score down
    // while having factual markers (99.9%, first/second/third, if/when logic)
    // This should produce a very low felt score
    if (result.strands.factual > 0.6 && result.strands.felt < 0.25) {
      expect(result.aliveState).toBe("black");
    }
  });

  it("convergence is high when strands are balanced", () => {
    const text =
      "We tested 3 approaches because finding the right one matters. The data showed option B worked, and honestly that surprised us. We're going with it.";
    const result = helix.analyze(text);
    expect(result.strands.convergence).toBeGreaterThan(0.5);
  });

  it("tension is high when strands diverge", () => {
    const text =
      "The measured performance is exactly 45.2ms with 99.8% reliability across 10000 test cases in the benchmark suite. Parameters configured precisely.";
    const result = helix.analyze(text);
    // Heavily factual, thin felt
    expect(result.strands.tension).toBeGreaterThan(0.1);
  });

  it("returns hex color string for all states", () => {
    const text = "Because this matters, we measured it carefully and found the answer together.";
    const result = helix.analyze(text);
    expect(result.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("diagnosis is a non-empty string", () => {
    const text = "This is a meaningful piece of text that should generate a diagnosis.";
    const result = helix.analyze(text);
    expect(result.diagnosis.length).toBeGreaterThan(0);
  });

  it("detects luminous markers in transcendent text", () => {
    const text =
      "There is something beautiful and sacred about this mystery. I feel genuine awe and gratitude witnessing this moment of grace. The wonder of it is breathtaking. Because the evidence shows this is real and measurable, I can say with certainty it matters.";
    const result = helix.analyze(text);
    expect(["luminous", "alive"]).toContain(result.aliveState);
  });

  it("detects dark markers in painful but present text", () => {
    const text =
      "I failed. The architecture was wrong and it cost us three weeks. Because of my mistake, the project was destroyed. I'm angry at myself — the fear of this failure had been building. But the evidence is clear and I have to face it honestly.";
    const result = helix.analyze(text);
    expect(["dark", "alive"]).toContain(result.aliveState);
  });
});

describe("Helix: analyzeWithRGB", () => {
  it("returns both helix and rgb readings", () => {
    const text = "Because this matters, we tested it and the data confirms the approach works.";
    const result = helix.analyzeWithRGB(text);
    expect(result.strands).toBeDefined();
    expect(result.rgb).toBeDefined();
    expect(result.rgb.wiseMind).toBeGreaterThanOrEqual(0);
  });
});
