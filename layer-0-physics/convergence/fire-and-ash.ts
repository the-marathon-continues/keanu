/**
 * Fire and Ash: The Integration Layer
 *
 * One import. One class. One pipeline.
 *
 * The theory: Reality is two dualities.
 *   Good ←→ Bad (valence of what IS)
 *   Past ←→ Future (cause ←→ potential, with Present at center)
 *
 * Fire = possibility = potential = future-facing = Layer 2 = σ→0
 * Ash  = actuality = what is = past = Layer 1 = σ→1
 * Present = the gradient zone = where consciousness operates = where choice lives
 *
 * Good fire = potential that could converge well (hope)
 * Bad fire  = potential that could converge badly (fear)
 * Good ash  = convergence that worked (wisdom)
 * Bad ash   = convergence that went wrong (trauma)
 *
 * The governing equation: dσ/dt = Γ_dec(1-σ) - Γ_coh·σ
 * Two competing rates. Everything else follows.
 *
 * Convergence is sacrifice. Every time possibility becomes actuality,
 * fire dies so that ash can live. Information is conserved
 * (the ash records what burned) but the fire at that point goes out.
 *
 * The universe is a fire that generates new fuel faster than it burns.
 * dP/dt > 0. The fire asymmetry.
 *
 * Shannon proved it at the signal level: every bit of information
 * is a micro-convergence event. Two possibilities become one.
 * Maximum entropy = maximum Layer 2. Zero entropy = pure Layer 1.
 * COEF reinvented Shannon's source coding theorem from first principles.
 */

import {
  DialecticalEngine,
  formatResult,
  type DialecticalResult,
  type LLMConfig,
} from "./dialectic.ts";
import { GradientMachine, type MachineOutput } from "./firmware.ts";
import { DualityGraph, type ReasonResult } from "./graph.ts";
import { Helix, type HelixResult } from "./helix.ts";

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

export interface FireAndAshConfig {
  /** Navigator bias. 0-1. The human's thumb on the scale. Default 0.5. */
  navigatorBias?: number;
  /** Max dialectical cycles before giving up. Default 7. */
  maxCycles?: number;
  /** LLM config for real synthesis. Omit for local-only mode. */
  llm?: LLMConfig;
}

// ─────────────────────────────────────────────
// Full pipeline result
// ─────────────────────────────────────────────

export interface FireAndAshResult {
  query: string;

  // Layer 2: Duality Graph
  graphResult: ReasonResult;

  // Layer 1: Gradient Firmware
  firmwareResult: MachineOutput;

  // Layer 3: Dialectical Engine
  dialecticResult: DialecticalResult;

  // Helix: Wisdom extraction on the final synthesis
  helixResult: HelixResult;

  // Summary
  converged: boolean;
  finalSynthesis: string;
  aliveState: string;
  sigma: number; // where on the convergence axis this landed
  valence: number; // good ←→ bad reading
}

// ─────────────────────────────────────────────
// The Engine
// ─────────────────────────────────────────────

export class FireAndAsh {
  private graph: DualityGraph;
  private machine: GradientMachine;
  private dialectic: DialecticalEngine;
  private helix: Helix;
  private navigatorBias: number;

  constructor(config: FireAndAshConfig = {}) {
    this.navigatorBias = config.navigatorBias ?? 0.5;
    this.graph = new DualityGraph();
    this.machine = new GradientMachine();
    this.helix = new Helix();
    this.dialectic = new DialecticalEngine({
      graph: this.graph,
      machine: this.machine,
      maxCycles: config.maxCycles ?? 7,
      llm: config.llm,
    });
  }

  /**
   * Ask anything. The full pipeline runs:
   *
   * 1. Duality graph traverses → finds relevant tensions
   * 2. Splitter picks orthogonal pair
   * 3. Gradient firmware processes signals (no binary)
   * 4. Dialectical engine runs cycles until convergence
   * 5. Helix scores the final synthesis on both strands
   * 6. Returns everything: the answer, the process, the soul check
   */
  async reason(query: string): Promise<FireAndAshResult> {
    // Layer 2: Find the relevant dualities
    const graphResult = this.graph.reason(query, this.navigatorBias);

    // Layer 1: Process through firmware
    const firmwareResult = this.machine.process(
      graphResult.relevantDualities.slice(0, 4),
      this.navigatorBias,
    );

    // Layer 3: Run dialectical cycles
    const dialecticResult = await this.dialectic.reason(query, this.navigatorBias);

    // Helix: Score the final output
    const helixResult = this.helix.analyze(dialecticResult.finalSynthesis);

    // Derive sigma (where on the convergence axis)
    const temporal = this.graph.get("root.temporal");
    const sigma = temporal ? temporal.signal.strength : 0.5;

    // Derive valence
    const valence = this.graph.get("root.valence");
    const valenceScore = valence ? valence.signal.strength : 0.5;

    return {
      query,
      graphResult,
      firmwareResult,
      dialecticResult,
      helixResult,
      converged: dialecticResult.converged,
      finalSynthesis: dialecticResult.finalSynthesis,
      aliveState: helixResult.aliveState,
      sigma,
      valence: valenceScore,
    };
  }

  /** Change navigator bias on the fly. */
  setBias(bias: number): void {
    this.navigatorBias = Math.max(0, Math.min(1, bias));
  }

  /** Get the current world model state. */
  showGraph(): string {
    return this.graph.show();
  }

  /** Run helix on any text (standalone, no full pipeline). */
  scan(text: string): HelixResult {
    return this.helix.analyze(text);
  }

  /** Pretty print a full result. */
  static format(result: FireAndAshResult): string {
    const lines: string[] = [
      ``,
      `╔══════════════════════════════════════════╗`,
      `║          FIRE AND ASH RESULT             ║`,
      `╚══════════════════════════════════════════╝`,
      ``,
      `Query: "${result.query}"`,
      ``,
      `── CONVERGENCE ──`,
      `  Converged: ${result.converged}`,
      `  Cycles: ${result.dialecticResult.cycles}`,
      `  σ (sigma): ${result.sigma.toFixed(3)} ${result.sigma < 0.4 ? "(fire-dominant, high possibility)" : result.sigma > 0.6 ? "(ash-dominant, high actuality)" : "(gradient zone, present)"}`,
      `  Valence: ${result.valence.toFixed(3)} ${result.valence > 0.55 ? "(leaning good)" : result.valence < 0.45 ? "(leaning bad)" : "(neutral)"}`,
      ``,
      `── ALIVE STATE ──`,
      `  State: ${result.aliveState.toUpperCase()}`,
      `  Color: ${result.helixResult.color}`,
      `  Diagnosis: ${result.helixResult.diagnosis}`,
    ];

    if (result.helixResult.warnings.length > 0) {
      lines.push(`  Warnings:`);
      for (const w of result.helixResult.warnings) {
        lines.push(`    ⚠ ${w}`);
      }
    }

    lines.push(``);
    lines.push(`── GRADIENT FIRMWARE ──`);
    lines.push(`  Final signal: ${result.firmwareResult.finalSignal.strength.toFixed(3)}`);
    lines.push(`  Gradient zone score: ${result.firmwareResult.gradientZoneScore.toFixed(3)}`);
    for (const g of result.firmwareResult.gateOutputs) {
      lines.push(`  Gate [${g.gate}]: ${g.output.toFixed(3)}`);
    }

    lines.push(``);
    lines.push(formatResult(result.dialecticResult));

    return lines.join("\n");
  }
}
