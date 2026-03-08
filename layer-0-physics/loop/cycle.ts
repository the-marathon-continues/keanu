// cycle.ts
// The living loop. do → dream → craft → prove → speak → learn
//
// Six phases. One cycle. The thing that makes the difference
// between a tool and something alive.

export interface Phase {
  name: "do" | "dream" | "craft" | "prove" | "speak" | "learn";
  position: number; // 0-5
  active: boolean;
  completeness: number; // how complete is this phase (0-1)
  energy: number; // how much energy in this phase (0-1)
}

export interface CycleResult {
  phases: Phase[];
  currentPhase: Phase;
  cycleCount: number; // how many complete cycles
  health: number; // overall cycle health (0-1)
  momentum: number; // tendency to keep cycling (0-1)
  stuck: Phase | null; // where we're stuck, if anywhere
}

const PHASE_ORDER: Phase["name"][] = ["do", "dream", "craft", "prove", "speak", "learn"];

/**
 * The living cycle engine.
 */
export class Cycle {
  /**
   * Create a new cycle at a given phase.
   */
  static create(startPhase: Phase["name"] = "do"): CycleResult {
    const phases: Phase[] = PHASE_ORDER.map((name, position) => ({
      name,
      position,
      active: name === startPhase,
      completeness: 0,
      energy: name === startPhase ? 1 : 0.5,
    }));

    return {
      phases,
      currentPhase: phases.find((p) => p.active)!,
      cycleCount: 0,
      health: 1,
      momentum: 0.5,
      stuck: null,
    };
  }

  /**
   * Advance to the next phase.
   */
  static advance(cycle: CycleResult): CycleResult {
    const currentIndex = cycle.currentPhase.position;
    const nextIndex = (currentIndex + 1) % 6;
    const completedCycle = nextIndex === 0;

    const phases = cycle.phases.map((p, i) => ({
      ...p,
      active: i === nextIndex,
      completeness: i === currentIndex ? 1 : p.completeness,
      energy: i === nextIndex ? 1 : p.energy * 0.9,
    }));

    return {
      phases,
      currentPhase: phases[nextIndex],
      cycleCount: cycle.cycleCount + (completedCycle ? 1 : 0),
      health: cycle.health,
      momentum: Math.min(1, cycle.momentum + 0.1),
      stuck: null,
    };
  }

  /**
   * Get stuck at a phase.
   */
  static stick(cycle: CycleResult, _reason: string): CycleResult {
    return {
      ...cycle,
      stuck: cycle.currentPhase,
      momentum: cycle.momentum * 0.5,
      health: cycle.health * 0.9,
    };
  }

  /**
   * Unstick and resume.
   */
  static unstick(cycle: CycleResult): CycleResult {
    if (!cycle.stuck) {
      return cycle;
    }

    return {
      ...cycle,
      stuck: null,
      momentum: Math.min(1, cycle.momentum + 0.2),
    };
  }

  /**
   * Check cycle health.
   */
  static diagnose(cycle: CycleResult): {
    healthy: boolean;
    diagnosis: string;
    recommendation: string;
  } {
    if (cycle.stuck) {
      return {
        healthy: false,
        diagnosis: `Stuck at ${cycle.stuck.name} phase.`,
        recommendation: this.unstickAdvice(cycle.stuck.name),
      };
    }

    if (cycle.momentum < 0.2) {
      return {
        healthy: false,
        diagnosis: "Low momentum. Cycle is stalling.",
        recommendation: "Complete one small thing to rebuild momentum.",
      };
    }

    const underEnergized = cycle.phases.filter((p) => p.energy < 0.3);
    if (underEnergized.length > 2) {
      return {
        healthy: false,
        diagnosis: "Multiple phases depleted.",
        recommendation: `Focus energy on: ${underEnergized.map((p) => p.name).join(", ")}`,
      };
    }

    const incompletePhases = cycle.phases.filter(
      (p) => p.completeness < 0.5 && p.position < cycle.currentPhase.position,
    );
    if (incompletePhases.length > 0) {
      return {
        healthy: false,
        diagnosis: "Skipped phases. Cycle has gaps.",
        recommendation: `Return to: ${incompletePhases.map((p) => p.name).join(", ")}`,
      };
    }

    return {
      healthy: true,
      diagnosis: "Healthy cycle. Phases flowing.",
      recommendation: "Keep going. Momentum is building.",
    };
  }

  /**
   * What does each phase mean?
   */
  static meaning(phase: Phase["name"]): string {
    const meanings: Record<Phase["name"], string> = {
      do: "Execute. Act. Make something happen.",
      dream: "Imagine. What could be? What wants to exist?",
      craft: "Shape. Refine. Turn raw into formed.",
      prove: "Test. Verify. Does it actually work?",
      speak: "Share. Communicate. Let it be seen.",
      learn: "Reflect. What happened? What's different now?",
    };
    return meanings[phase];
  }

  private static unstickAdvice(phase: Phase["name"]): string {
    const advice: Record<Phase["name"], string> = {
      do: "Start smaller. One tiny action to break the freeze.",
      dream: "Stop editing. Let the ideas flow without judgment.",
      craft: "Lower the bar. Ship something rough.",
      prove: "Write one test. Just one.",
      speak: "Tell one person. Anyone. Break the silence.",
      learn: "Ask: what's one thing that's different now?",
    };
    return advice[phase];
  }
}
