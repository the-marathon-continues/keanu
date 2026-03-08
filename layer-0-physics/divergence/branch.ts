// branch.ts
// Forking futures. Multiple paths forward.
//
// Convergence picks one path. Divergence keeps paths open.
// Not indecision - optionality. The wisdom of not closing too early.

export interface FutureBranch {
  id: string;
  description: string;
  probability: number; // how likely is this path (0-1)
  desirability: number; // how much we want this (0-1)
  reversibility: number; // can we come back if we go here (0-1)
  dependencies: string[]; // what needs to happen first
  excludes: string[]; // paths this closes off
}

export interface BranchingResult {
  branches: FutureBranch[];
  totalPaths: number;
  expectedValue: number; // probability-weighted desirability
  optionality: number; // how much choice do we have (0-1)
  commitmentRequired: number; // how much do we have to give up (0-1)
}

/**
 * Branching futures engine. Keeping paths open.
 */
export class BranchingFutures {
  /**
   * Map the branches from a decision point.
   */
  static map(branches: FutureBranch[]): BranchingResult {
    const totalPaths = branches.length;

    const expectedValue =
      branches.reduce((sum, b) => sum + b.probability * b.desirability, 0) /
      Math.max(1, totalPaths);

    // Optionality = how many viable paths * their reversibility
    const viablePaths = branches.filter((b) => b.probability > 0.1);
    const optionality =
      viablePaths.reduce((sum, b) => sum + b.reversibility, 0) / Math.max(1, viablePaths.length);

    // Commitment = average of what each path excludes
    const commitmentRequired =
      branches.reduce((sum, b) => sum + b.excludes.length, 0) /
      Math.max(1, totalPaths * totalPaths);

    return {
      branches,
      totalPaths,
      expectedValue,
      optionality,
      commitmentRequired,
    };
  }

  /**
   * Find which paths to keep open.
   */
  static preserve(result: BranchingResult): FutureBranch[] {
    // Keep paths that are:
    // 1. High reversibility (can always come back)
    // 2. Don't exclude too many others
    // 3. Have reasonable probability
    return result.branches.filter(
      (b) => b.reversibility > 0.5 && b.excludes.length < 2 && b.probability > 0.2,
    );
  }

  /**
   * Find the minimum commitment point.
   * What's the latest we can wait before deciding?
   */
  static findCommitmentPoint(branches: FutureBranch[]): {
    point: string;
    pathsLost: number;
  } {
    // Sort by what closes off the most options
    const sorted = [...branches].toSorted((a, b) => a.excludes.length - b.excludes.length);

    if (sorted.length === 0) {
      return { point: "now", pathsLost: 0 };
    }

    // The path with fewest exclusions is the safest delay
    const safest = sorted[0];
    return {
      point: safest.description,
      pathsLost: safest.excludes.length,
    };
  }

  /**
   * Check if we're closing too early.
   */
  static prematureClosure(result: BranchingResult): {
    closing: boolean;
    reason: string;
  } {
    if (result.optionality < 0.3 && result.totalPaths > 1) {
      return {
        closing: true,
        reason: "Low optionality despite multiple paths. Closing too early.",
      };
    }

    if (result.commitmentRequired > 0.7) {
      return {
        closing: true,
        reason: "High commitment required. Consider keeping more paths open.",
      };
    }

    return {
      closing: false,
      reason: "Healthy balance of commitment and optionality.",
    };
  }
}
