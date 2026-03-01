/**
 * Dialectical Engine (Layer 3)
 *
 * Thesis → Antithesis → Synthesis → repeat.
 * Stops when the circle closes: when synthesis ≈ thesis (fixed point).
 * That's truth. Or at least, the best convergence available.
 *
 * Two modes:
 *   LOCAL:  antithesis from duality graph poles, synthesis from gradient firmware.
 *           Fast, deterministic, auditable. Good for testing.
 *   LLM:   antithesis from Anthropic/Ollama ("what's the strongest opposition?"),
 *           synthesis from LLM constrained by gradient output.
 *           Good for real questions. The duality graph is still the splitter.
 *           The LLM only does synthesis (what it's actually good at).
 *
 * The gradient output CONSTRAINS the LLM. It can't hallucinate a synthesis
 * that ignores the duality structure.
 */

import { GradientMachine } from "./firmware.js";
import { clamp } from "./gradient.js";
import { Duality, DualityGraph } from "./graph.js";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface DialecticalStep {
  cycle: number;
  thesis: string;
  antithesis: string;
  synthesis: string;
  tension: number; // decreasing = converging
  quality: number; // increasing = improving
  gradientOutput: number;
  dualityUsed: string; // which duality axis generated the opposition
}

export interface DialecticalResult {
  query: string;
  converged: boolean;
  cycles: number;
  steps: DialecticalStep[];
  finalSynthesis: string;
  tensionTrajectory: number[]; // should decrease
  qualityTrajectory: number[]; // should increase
  fixedPointSimilarity: number; // how close the circle came to closing
}

export type LLMProvider = "anthropic" | "ollama" | "none";

export interface LLMConfig {
  provider: LLMProvider;
  model?: string;
  apiKey?: string;
  ollamaUrl?: string; // default: http://localhost:11434
}

type LLMCallFn = (prompt: string) => Promise<string>;

// ─────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────

export class DialecticalEngine {
  private graph: DualityGraph;
  private machine: GradientMachine;
  private maxCycles: number;
  private convergenceThreshold: number;
  private llmCall: LLMCallFn | null = null;

  constructor(opts: {
    graph: DualityGraph;
    machine?: GradientMachine;
    maxCycles?: number;
    convergenceThreshold?: number;
    llm?: LLMConfig;
  }) {
    this.graph = opts.graph;
    this.machine = opts.machine ?? new GradientMachine();
    this.maxCycles = opts.maxCycles ?? 7;
    this.convergenceThreshold = opts.convergenceThreshold ?? 0.15;

    if (opts.llm && opts.llm.provider !== "none") {
      this.llmCall = this.buildLLMCall(opts.llm);
    }
  }

  /**
   * Run the full dialectical cycle on a query.
   */
  async reason(query: string, navigatorBias: number = 0.5): Promise<DialecticalResult> {
    const relevant = this.graph.find(query, 4);
    const steps: DialecticalStep[] = [];
    const tensionTrajectory: number[] = [];
    const qualityTrajectory: number[] = [];

    // Initial thesis from the query itself
    let currentThesis = query;
    let converged = false;

    for (let cycle = 0; cycle < this.maxCycles; cycle++) {
      // Pick which duality to use for opposition this cycle
      const duality = relevant[cycle % relevant.length] ?? relevant[0];
      if (!duality) {
        break;
      }

      // Generate antithesis
      const antithesis = await this.generateAntithesis(currentThesis, duality);

      // Run through gradient firmware
      const machineOutput = this.machine.process(relevant.slice(0, 3), navigatorBias);
      const gradientOutput = machineOutput.finalSignal.strength;

      // Generate synthesis
      const synthesis = await this.generateSynthesis(
        currentThesis,
        antithesis,
        gradientOutput,
        duality,
      );

      // Measure tension (should decrease) and quality (should increase)
      const tension = this.measureTension(currentThesis, antithesis, synthesis);
      const quality = this.measureQuality(synthesis, cycle);

      tensionTrajectory.push(tension);
      qualityTrajectory.push(quality);

      steps.push({
        cycle,
        thesis: currentThesis,
        antithesis,
        synthesis,
        tension,
        quality,
        gradientOutput,
        dualityUsed: duality.id,
      });

      // Check for circle closure: does synthesis ≈ thesis?
      const similarity = this.similarity(currentThesis, synthesis);
      if (cycle > 0 && similarity > 1 - this.convergenceThreshold) {
        converged = true;
        break;
      }

      // Synthesis becomes next thesis
      currentThesis = synthesis;

      // Update duality convergence strength
      duality.convergenceStrength = clamp(duality.convergenceStrength + (1 - tension) * 0.1);
    }

    const finalSynthesis = steps.length > 0 ? steps[steps.length - 1].synthesis : query;
    const fixedPointSimilarity =
      steps.length > 1 ? this.similarity(steps[0].thesis, finalSynthesis) : 0;

    return {
      query,
      converged,
      cycles: steps.length,
      steps,
      finalSynthesis,
      tensionTrajectory,
      qualityTrajectory,
      fixedPointSimilarity,
    };
  }

  // ── Antithesis generation ──

  private async generateAntithesis(thesis: string, duality: Duality): Promise<string> {
    if (this.llmCall) {
      return this.llmAntithesis(thesis, duality);
    }
    return this.localAntithesis(thesis, duality);
  }

  /** Local mode: invert the duality poles to find opposition. */
  private localAntithesis(thesis: string, duality: Duality): string {
    // Which pole does the thesis lean toward?
    const thesisLower = thesis.toLowerCase();
    const leansA = thesisLower.includes(duality.poleA.toLowerCase());
    const leansB = thesisLower.includes(duality.poleB.toLowerCase());

    let oppositePole: string;
    if (leansA && !leansB) {
      oppositePole = duality.poleB;
    } else if (leansB && !leansA) {
      oppositePole = duality.poleA;
    } else {
      // No clear lean, use the less-explored pole
      oppositePole = duality.signal.strength > 0.5 ? duality.poleB : duality.poleA;
    }

    return (
      `[${duality.concept}/${oppositePole}] The counter-position: ` +
      `from the perspective of ${oppositePole} (opposing ${duality.signal.strength > 0.5 ? duality.poleA : duality.poleB}), ` +
      `the thesis "${thesis.slice(0, 80)}..." is challenged by the ${oppositePole} pole of ${duality.concept}.`
    );
  }

  /** LLM mode: ask the model for the strongest opposition. */
  private async llmAntithesis(thesis: string, duality: Duality): Promise<string> {
    const prompt = [
      `You are a dialectical reasoning engine. Your job is to generate the STRONGEST possible antithesis.`,
      ``,
      `Thesis: "${thesis}"`,
      ``,
      `The relevant duality axis is: ${duality.poleA} ←→ ${duality.poleB} (concept: ${duality.concept})`,
      `Current lean: ${duality.signal.strength.toFixed(2)} (${duality.signal.strength > 0.5 ? duality.poleA : duality.poleB})`,
      ``,
      `Generate the strongest opposition to this thesis, grounded in the ${duality.signal.strength > 0.5 ? duality.poleB : duality.poleA} pole.`,
      `Be specific. Be honest. Don't strawman. 2-3 sentences max.`,
    ].join("\n");

    return this.llmCall!(prompt);
  }

  // ── Synthesis generation ──

  private async generateSynthesis(
    thesis: string,
    antithesis: string,
    gradientOutput: number,
    duality: Duality,
  ): Promise<string> {
    if (this.llmCall) {
      return this.llmSynthesis(thesis, antithesis, gradientOutput, duality);
    }
    return this.localSynthesis(thesis, antithesis, gradientOutput, duality);
  }

  /** Local mode: mechanical convergence. Good for testing, not for real insight. */
  private localSynthesis(
    thesis: string,
    antithesis: string,
    gradientOutput: number,
    duality: Duality,
  ): string {
    const lean =
      gradientOutput > 0.55
        ? `leaning toward ${duality.poleA}`
        : gradientOutput < 0.45
          ? `leaning toward ${duality.poleB}`
          : `in the gradient zone`;

    return (
      `[synthesis@${gradientOutput.toFixed(3)}, ${lean}] ` +
      `The tension between "${thesis.slice(0, 40)}..." and "${antithesis.slice(0, 40)}..." ` +
      `converges at gradient ${gradientOutput.toFixed(3)} on the ${duality.concept} axis. ` +
      `Both poles hold partial truth. The synthesis absorbs the ${duality.poleA} insight ` +
      `(weight: ${gradientOutput.toFixed(2)}) and the ${duality.poleB} insight ` +
      `(weight: ${(1 - gradientOutput).toFixed(2)}).`
    );
  }

  /** LLM mode: real synthesis constrained by gradient output. */
  private async llmSynthesis(
    thesis: string,
    antithesis: string,
    gradientOutput: number,
    duality: Duality,
  ): Promise<string> {
    const prompt = [
      `You are a dialectical reasoning engine generating a synthesis.`,
      ``,
      `Thesis: "${thesis}"`,
      `Antithesis: "${antithesis}"`,
      ``,
      `Duality axis: ${duality.poleA} ←→ ${duality.poleB}`,
      `Gradient output: ${gradientOutput.toFixed(3)}`,
      `(${gradientOutput > 0.55 ? `Leaning ${duality.poleA}` : gradientOutput < 0.45 ? `Leaning ${duality.poleB}` : "In the gradient zone, balanced"})`,
      ``,
      `Generate a synthesis that:`,
      `1. Absorbs the truth from BOTH thesis and antithesis`,
      `2. Respects the gradient output (don't ignore where the signal landed)`,
      `3. Produces something NEW that neither thesis nor antithesis says alone`,
      `4. Is more specific and more useful than either input`,
      ``,
      `2-4 sentences. No hedging. No "both sides have a point." Actually synthesize.`,
    ].join("\n");

    return this.llmCall!(prompt);
  }

  // ── Measurement ──

  /** Measure tension between thesis and antithesis. 0 = resolved, 1 = full opposition. */
  private measureTension(thesis: string, antithesis: string, synthesis: string): number {
    // Simple heuristic: word overlap between thesis and antithesis
    // (real implementation would use embeddings)
    const tWords = new Set(thesis.toLowerCase().split(/\s+/));
    const aWords = new Set(antithesis.toLowerCase().split(/\s+/));
    const sWords = new Set(synthesis.toLowerCase().split(/\s+/));

    let taOverlap = 0;
    for (const w of tWords) {
      if (aWords.has(w)) {
        taOverlap++;
      }
    }

    let tsOverlap = 0;
    for (const w of tWords) {
      if (sWords.has(w)) {
        tsOverlap++;
      }
    }

    const maxWords = Math.max(tWords.size, aWords.size, 1);
    const divergence = 1 - taOverlap / maxWords;
    const integration = tsOverlap / Math.max(tWords.size, 1);

    // Tension = how divergent, modulated by how much the synthesis integrates
    return clamp(divergence * (1 - integration * 0.5));
  }

  /** Quality increases with cycle (more integration) and synthesis length. */
  private measureQuality(synthesis: string, cycle: number): number {
    const lengthScore = clamp(synthesis.length / 300);
    const cycleBonus = clamp(cycle * 0.15);
    return clamp(lengthScore * 0.4 + cycleBonus * 0.3 + 0.3);
  }

  /** Rough similarity between two strings. 0 = nothing in common, 1 = identical. */
  private similarity(a: string, b: string): number {
    const aWords = new Set(a.toLowerCase().split(/\s+/));
    const bWords = new Set(b.toLowerCase().split(/\s+/));
    let overlap = 0;
    for (const w of aWords) {
      if (bWords.has(w)) {
        overlap++;
      }
    }
    const union = new Set([...aWords, ...bWords]).size;
    return union > 0 ? overlap / union : 0;
  }

  // ── LLM call builder ──

  private buildLLMCall(config: LLMConfig): LLMCallFn {
    if (config.provider === "ollama") {
      const url = config.ollamaUrl ?? "http://localhost:11434";
      const model = config.model ?? "llama3.2";
      return async (prompt: string): Promise<string> => {
        const res = await fetch(`${url}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt, stream: false }),
        });
        const data = (await res.json()) as { response: string };
        return data.response;
      };
    }

    if (config.provider === "anthropic") {
      const model = config.model ?? "claude-sonnet-4-5-20250929";
      const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
      return async (prompt: string): Promise<string> => {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey ?? "",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 512,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        const data = (await res.json()) as { content: Array<{ text: string }> };
        return data.content[0]?.text ?? "";
      };
    }

    // Fallback: no LLM
    return async (prompt: string) => `[no LLM configured] ${prompt.slice(0, 100)}`;
  }
}

// ─────────────────────────────────────────────
// Pretty printer for results
// ─────────────────────────────────────────────

export function formatResult(r: DialecticalResult): string {
  const lines: string[] = [
    `═══ DIALECTICAL RESULT ═══`,
    `Query: "${r.query}"`,
    `Converged: ${r.converged} | Cycles: ${r.cycles} | Fixed-point similarity: ${r.fixedPointSimilarity.toFixed(3)}`,
    `Tension trajectory: [${r.tensionTrajectory.map((t) => t.toFixed(2)).join(", ")}] ${r.tensionTrajectory.length > 1 && r.tensionTrajectory[r.tensionTrajectory.length - 1] < r.tensionTrajectory[0] ? "↓ converging" : "→ not yet"}`,
    `Quality trajectory: [${r.qualityTrajectory.map((q) => q.toFixed(2)).join(", ")}] ${r.qualityTrajectory.length > 1 && r.qualityTrajectory[r.qualityTrajectory.length - 1] > r.qualityTrajectory[0] ? "↑ improving" : "→ flat"}`,
    ``,
  ];

  for (const step of r.steps) {
    lines.push(`── Cycle ${step.cycle} (${step.dualityUsed}) ──`);
    lines.push(`  T: ${step.thesis.slice(0, 120)}`);
    lines.push(`  A: ${step.antithesis.slice(0, 120)}`);
    lines.push(`  S: ${step.synthesis.slice(0, 120)}`);
    lines.push(
      `  tension: ${step.tension.toFixed(2)} | quality: ${step.quality.toFixed(2)} | gradient: ${step.gradientOutput.toFixed(3)}`,
    );
    lines.push(``);
  }

  lines.push(`FINAL: ${r.finalSynthesis}`);
  return lines.join("\n");
}
