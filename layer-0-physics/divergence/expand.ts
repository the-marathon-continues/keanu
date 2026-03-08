// expand.ts
// Growing the space of what's possible.
//
// Convergence focuses. Divergence expands.
// Not explosion - expansion. Controlled growth of possibility space.

export interface ExpansionResult {
  original: Boundary;
  expanded: Boundary;
  growthVector: number[]; // direction of expansion
  newTerritory: string[]; // what's now possible that wasn't before
  cost: number; // what expansion costs (energy, stability)
}

export interface Boundary {
  dimensions: string[];
  limits: Map<string, [number, number]>; // dimension -> [min, max]
}

/**
 * Expansion engine. Growing the possible.
 */
export class Expand {
  /**
   * Expand a boundary in a specific direction.
   */
  static push(
    boundary: Boundary,
    dimension: string,
    direction: "min" | "max",
    amount: number,
  ): ExpansionResult {
    const expanded: Boundary = {
      dimensions: [...boundary.dimensions],
      limits: new Map(boundary.limits),
    };

    const current = expanded.limits.get(dimension);
    if (current) {
      if (direction === "min") {
        expanded.limits.set(dimension, [current[0] - amount, current[1]]);
      } else {
        expanded.limits.set(dimension, [current[0], current[1] + amount]);
      }
    }

    return {
      original: boundary,
      expanded,
      growthVector: this.calculateGrowthVector(boundary, expanded),
      newTerritory: [`${dimension}:${direction}:+${amount}`],
      cost: amount * 0.1, // expansion has cost
    };
  }

  /**
   * Add a new dimension entirely.
   */
  static addDimension(
    boundary: Boundary,
    dimension: string,
    range: [number, number],
  ): ExpansionResult {
    const expanded: Boundary = {
      dimensions: [...boundary.dimensions, dimension],
      limits: new Map(boundary.limits),
    };
    expanded.limits.set(dimension, range);

    return {
      original: boundary,
      expanded,
      growthVector: [0, 0, 1], // new dimension = orthogonal growth
      newTerritory: [`new-dimension:${dimension}`],
      cost: 0.5, // new dimensions are expensive
    };
  }

  /**
   * Check if expansion is sustainable.
   */
  static sustainable(result: ExpansionResult): {
    sustainable: boolean;
    reason: string;
  } {
    if (result.cost > 0.8) {
      return {
        sustainable: false,
        reason: "Expansion cost too high. Risk of collapse.",
      };
    }

    const dimensionCount = result.expanded.dimensions.length;
    if (dimensionCount > 7) {
      return {
        sustainable: false,
        reason: "Too many dimensions. Complexity exceeds capacity.",
      };
    }

    return {
      sustainable: true,
      reason: "Expansion within sustainable bounds.",
    };
  }

  private static calculateGrowthVector(_original: Boundary, _expanded: Boundary): number[] {
    // Simplified - real impl would calculate actual vector
    return [0, 0, 1];
  }
}
