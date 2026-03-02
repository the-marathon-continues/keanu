// space.ts
// The container. Room to breathe.
//
// Convergence fills space. Divergence creates it.
// Negative space isn't empty - it's potential.

export interface SpaceResult {
  totalVolume: number;
  filledVolume: number;
  emptyVolume: number;
  ratio: number; // filled/total
  breathability: number; // how much room to move (0-1)
  potential: number; // how much could grow here (0-1)
}

export interface SpaceRegion {
  id: string;
  type: "filled" | "empty" | "transitional";
  size: number;
  neighbors: string[];
}

/**
 * Space management. The art of emptiness.
 */
export class Space {
  /**
   * Analyze the space around something.
   */
  static analyze(filled: number, total: number): SpaceResult {
    const empty = total - filled;
    const ratio = total > 0 ? filled / total : 0;

    // Breathability peaks at ~30-40% filled
    // Too empty = lost, too full = cramped
    const breathability = 1 - Math.abs(ratio - 0.35) * 2;

    // Potential is inverse of filled
    const potential = 1 - ratio;

    return {
      totalVolume: total,
      filledVolume: filled,
      emptyVolume: empty,
      ratio,
      breathability: Math.max(0, Math.min(1, breathability)),
      potential: Math.max(0, Math.min(1, potential)),
    };
  }

  /**
   * Find where space is needed.
   */
  static findGaps(regions: SpaceRegion[]): SpaceRegion[] {
    return regions.filter((r) => {
      // A region needs space if:
      // 1. It's filled and all neighbors are filled
      // 2. It's transitional and mostly surrounded by filled
      if (r.type === "filled") {
        const filledNeighbors = r.neighbors.filter((id) =>
          regions.find((region) => region.id === id && region.type === "filled"),
        );
        return filledNeighbors.length === r.neighbors.length;
      }
      return false;
    });
  }

  /**
   * Create breathing room.
   */
  static breathe(result: SpaceResult, amount: number): SpaceResult {
    // Can't create more total space, but can reduce filled
    const newFilled = Math.max(0, result.filledVolume - amount);
    return this.analyze(newFilled, result.totalVolume);
  }

  /**
   * Check if space is healthy.
   */
  static health(result: SpaceResult): {
    healthy: boolean;
    diagnosis: string;
  } {
    if (result.ratio > 0.8) {
      return {
        healthy: false,
        diagnosis: "Overcrowded. Need to release or expand.",
      };
    }

    if (result.ratio < 0.1) {
      return {
        healthy: false,
        diagnosis: "Too sparse. Need more substance.",
      };
    }

    if (result.breathability < 0.3) {
      return {
        healthy: false,
        diagnosis: "Low breathability. Things feel cramped.",
      };
    }

    return {
      healthy: true,
      diagnosis: "Healthy space. Room to breathe and grow.",
    };
  }
}
