// explore.ts
// Divergent thinking. What else could this be?
//
// Convergence asks: "What's the answer?"
// Divergence asks: "What are the questions?"
//
// The explore module generates alternative framings, unexpected connections,
// paths not taken. It's the "yes, and..." to convergence's "yes, but..."

export interface Branch {
  id: string;
  framing: string;
  distance: number; // how far from the original
  energy: number; // how much life is in this branch (0-1)
  connections: string[]; // what it connects to
}

export interface ExploreResult {
  original: string;
  branches: Branch[];
  totalDivergence: number; // sum of distances
  avgEnergy: number;
  mostAlive: Branch | null;
  mostDistant: Branch | null;
}

/**
 * Divergent exploration. Takes an idea and branches it.
 */
export class Explore {
  /**
   * Generate alternative framings of an idea.
   */
  static branch(idea: string, depth: number = 3): ExploreResult {
    const branches: Branch[] = [];

    // Reframing prompts - each generates a different kind of divergence
    const lenses = [
      { name: "opposite", prompt: "What if the opposite were true?" },
      { name: "metaphor", prompt: "What is this like?" },
      { name: "scale", prompt: "What if this were 10x bigger? 10x smaller?" },
      { name: "time", prompt: "How does this look in 10 years? 10 minutes?" },
      { name: "agent", prompt: "Who else cares about this? Why?" },
      { name: "absence", prompt: "What's missing? What's not being said?" },
      { name: "adjacent", prompt: "What's next to this that we're ignoring?" },
      { name: "inversion", prompt: "What if we solved the opposite problem?" },
    ];

    const selectedLenses = lenses.slice(0, Math.min(depth, lenses.length));

    for (const lens of selectedLenses) {
      branches.push({
        id: `${lens.name}-${Date.now()}`,
        framing: lens.prompt,
        distance: this.calculateDistance(lens.name),
        energy: Math.random() * 0.5 + 0.5, // placeholder - real impl would score
        connections: [],
      });
    }

    const totalDivergence = branches.reduce((sum, b) => sum + b.distance, 0);
    const avgEnergy =
      branches.length > 0 ? branches.reduce((sum, b) => sum + b.energy, 0) / branches.length : 0;

    return {
      original: idea,
      branches,
      totalDivergence,
      avgEnergy,
      mostAlive:
        branches.length > 0 ? branches.reduce((a, b) => (a.energy > b.energy ? a : b)) : null,
      mostDistant:
        branches.length > 0 ? branches.reduce((a, b) => (a.distance > b.distance ? a : b)) : null,
    };
  }

  /**
   * How far does each lens take you from the original?
   */
  private static calculateDistance(lens: string): number {
    const distances: Record<string, number> = {
      opposite: 1.0, // Maximum distance
      inversion: 0.9,
      metaphor: 0.7,
      scale: 0.6,
      time: 0.5,
      agent: 0.4,
      absence: 0.3,
      adjacent: 0.2,
    };
    return distances[lens] ?? 0.5;
  }

  /**
   * Find unexpected connections between branches.
   */
  static connect(result: ExploreResult): ExploreResult {
    const branches = [...result.branches];

    // Look for resonance between branches
    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        // Branches at different distances might have unexpected overlap
        const distanceDiff = Math.abs(branches[i].distance - branches[j].distance);
        if (distanceDiff > 0.3) {
          branches[i].connections.push(branches[j].id);
          branches[j].connections.push(branches[i].id);
        }
      }
    }

    return { ...result, branches };
  }

  /**
   * Score divergence health. Too little = stuck. Too much = scattered.
   */
  static health(result: ExploreResult): { score: number; diagnosis: string } {
    const { totalDivergence, avgEnergy, branches } = result;

    if (branches.length === 0) {
      return { score: 0, diagnosis: "No divergence. Stuck on one path." };
    }

    if (totalDivergence < 1) {
      return { score: 0.3, diagnosis: "Low divergence. Exploring too close to home." };
    }

    if (totalDivergence > 5 && avgEnergy < 0.4) {
      return { score: 0.4, diagnosis: "Scattered. Many branches, little energy." };
    }

    if (avgEnergy > 0.7 && totalDivergence > 2) {
      return { score: 0.9, diagnosis: "Healthy divergence. Multiple alive paths." };
    }

    return { score: 0.6, diagnosis: "Moderate divergence. Room to explore further." };
  }
}
