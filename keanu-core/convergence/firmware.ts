/**
 * Gradient Firmware (Layer 1)
 *
 * Signal processing. Everything stays continuous until explicit readout.
 * No booleans in the pipeline. No if/else on truth values.
 *
 * GradientGate: takes two inputs, outputs weighted convergence
 * DualityProcessor: takes a Duality, outputs gradient position
 * GradientMachine: chains gates and processors into a pipeline
 *
 * The navigator bias (A(σ) > 0) is the only external input.
 * That's the human. The part that can't be coded.
 */

import { Signal, clamp } from "./gradient.js";
import { Duality, ConvergenceOps } from "./graph.js";

// ─────────────────────────────────────────────
// GradientGate
// ─────────────────────────────────────────────

export class GradientGate {
  name: string;
  private weight: number;

  constructor(name: string, weight: number = 0.5) {
    this.name = name;
    this.weight = clamp(weight);
  }

  /** Two signals in, one signal out. Weighted convergence. */
  process(a: Signal, b: Signal): Signal {
    return ConvergenceOps.converge(a, b, this.weight);
  }

  /** Adjust the gate's weight. Learning. */
  tune(delta: number): void {
    this.weight = clamp(this.weight + delta);
  }

  get currentWeight(): number {
    return this.weight;
  }
}

// ─────────────────────────────────────────────
// DualityProcessor
// ─────────────────────────────────────────────

export class DualityProcessor {
  /**
   * Process a duality into a gradient reading.
   * Returns the signal position modulated by tension and conviction.
   *
   * High tension + high conviction = strong, unresolved force
   * Low tension + high conviction = settled truth
   * High tension + low conviction = open question
   * Low tension + low conviction = irrelevant
   */
  process(d: Duality): GradientReading {
    const position = d.signal.strength;
    const tension = d.tension;
    const conviction = d.signal.conviction;
    const stability = d.signal.stability;

    // Force = how much this duality PUSHES on the system
    const force = tension * conviction;

    // Clarity = how readable this signal is
    const clarity = stability * (1 - tension * 0.5);

    // Zone classification (analog, not binary)
    // 0.0-0.3 = pole_b dominant
    // 0.3-0.7 = gradient zone (where the interesting stuff lives)
    // 0.7-1.0 = pole_a dominant
    const inGradientZone = 1 - Math.abs(position - 0.5) * 2;

    return {
      dualityId: d.id,
      position,
      force,
      clarity,
      inGradientZone,
      poleA: d.poleA,
      poleB: d.poleB,
      leaningToward: position > 0.55 ? d.poleA : position < 0.45 ? d.poleB : "center",
    };
  }
}

export interface GradientReading {
  dualityId: string;
  position: number; // 0-1 on the gradient
  force: number; // how hard this pushes
  clarity: number; // how readable the signal is
  inGradientZone: number; // 0-1, how much in the middle
  poleA: string;
  poleB: string;
  leaningToward: string;
}

// ─────────────────────────────────────────────
// GradientMachine
// ─────────────────────────────────────────────

export interface MachineOutput {
  finalSignal: Signal;
  readings: GradientReading[];
  gateOutputs: Array<{ gate: string; output: number }>;
  navigatorBias: number;
  /** The gradient zone score: how much of the output lives in the interesting middle. */
  gradientZoneScore: number;
}

export class GradientMachine {
  private processor = new DualityProcessor();
  private gates: GradientGate[] = [];

  constructor() {
    // Default gates for the two-duality system
    this.gates = [
      new GradientGate("valence-temporal", 0.5), // balance between the two axes
      new GradientGate("navigator", 0.5), // human bias input
    ];
  }

  /**
   * Run dualities through the firmware.
   * All signals stay analog. No thresholds. No booleans.
   */
  process(dualities: Duality[], navigatorBias: number = 0.5): MachineOutput {
    // Phase 1: Read each duality
    const readings = dualities.map((d) => this.processor.process(d));

    // Phase 2: Converge pairs through gates
    const gateOutputs: Array<{ gate: string; output: number }> = [];
    let currentSignal = new Signal(0.5);

    for (let i = 0; i < readings.length; i++) {
      const reading = readings[i];
      const readingSignal = new Signal(reading.position);
      const gateIndex = Math.min(i, this.gates.length - 1);
      const gate = this.gates[gateIndex];
      currentSignal = gate.process(currentSignal, readingSignal);
      gateOutputs.push({ gate: gate.name, output: currentSignal.strength });
    }

    // Phase 3: Apply navigator bias
    const navigatorGate = this.gates[this.gates.length - 1];
    navigatorGate.tune(navigatorBias - navigatorGate.currentWeight);
    const finalSignal = navigatorGate.process(currentSignal, new Signal(navigatorBias));
    gateOutputs.push({ gate: "navigator-final", output: finalSignal.strength });

    const gradientZoneScore = 1 - Math.abs(finalSignal.strength - 0.5) * 2;

    return {
      finalSignal,
      readings,
      gateOutputs,
      navigatorBias,
      gradientZoneScore,
    };
  }
}
