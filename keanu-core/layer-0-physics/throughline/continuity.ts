// continuity.ts
// The thread that doesn't break.
//
// Identity across time. What persists when everything else changes.
// The throughline that makes "you" continuous.

export interface ContinuityResult {
  intact: boolean;
  thread: string[];
  breaks: ContinuityBreak[];
  strength: number; // how strong is the continuity (0-1)
  repairability: number; // if broken, how fixable (0-1)
}

export interface ContinuityBreak {
  position: number; // where in the sequence
  before: string;
  after: string;
  severity: number; // how bad is the break (0-1)
  cause: string;
}

/**
 * Continuity engine. Maintaining the thread.
 */
export class Continuity {
  /**
   * Check continuity across a sequence.
   */
  static check(sequence: string[]): ContinuityResult {
    const breaks: ContinuityBreak[] = [];

    for (let i = 1; i < sequence.length; i++) {
      const similarity = this.similarity(sequence[i - 1], sequence[i]);
      if (similarity < 0.3) {
        breaks.push({
          position: i,
          before: sequence[i - 1],
          after: sequence[i],
          severity: 1 - similarity,
          cause: "Low similarity between adjacent elements",
        });
      }
    }

    const intact = breaks.length === 0;
    const strength = intact
      ? 1
      : 1 - breaks.reduce((sum, b) => sum + b.severity, 0) / sequence.length;
    const repairability =
      breaks.length > 0 ? breaks.reduce((sum, b) => sum + (1 - b.severity), 0) / breaks.length : 1;

    return {
      intact,
      thread: sequence,
      breaks,
      strength: Math.max(0, strength),
      repairability,
    };
  }

  /**
   * Find the core thread - what persists through all changes.
   */
  static core(sequence: string[]): string[] {
    if (sequence.length === 0) {
      return [];
    }
    if (sequence.length === 1) {
      return sequence;
    }

    // Find common elements across the sequence
    // (Simplified - real impl would do semantic analysis)
    return sequence.filter((item, index) => {
      if (index === 0) {
        return true;
      }
      // Keep items that have some connection to what came before
      return this.similarity(item, sequence[index - 1]) > 0.5;
    });
  }

  /**
   * Repair a break in continuity.
   */
  static repair(result: ContinuityResult, breakIndex: number): ContinuityResult {
    if (breakIndex >= result.breaks.length) {
      return result;
    }

    const breakToRepair = result.breaks[breakIndex];

    // Create a bridge between before and after
    const bridge = `[bridge: ${breakToRepair.before} → ${breakToRepair.after}]`;

    // Insert bridge into thread
    const newThread = [...result.thread];
    newThread.splice(breakToRepair.position, 0, bridge);

    // Remove the repaired break
    const newBreaks = result.breaks.filter((_, i) => i !== breakIndex);

    return {
      intact: newBreaks.length === 0,
      thread: newThread,
      breaks: newBreaks,
      strength: result.strength + breakToRepair.severity / result.thread.length,
      repairability: result.repairability,
    };
  }

  /**
   * Check if continuity is at risk.
   */
  static risk(result: ContinuityResult): {
    atRisk: boolean;
    reason: string;
  } {
    if (result.strength < 0.3) {
      return {
        atRisk: true,
        reason: "Low continuity strength. Thread is fraying.",
      };
    }

    if (result.breaks.length > result.thread.length / 3) {
      return {
        atRisk: true,
        reason: "Too many breaks. Continuity is fragmenting.",
      };
    }

    const severBreaks = result.breaks.filter((b) => b.severity > 0.8);
    if (severBreaks.length > 0) {
      return {
        atRisk: true,
        reason: "Severe break detected. Major discontinuity.",
      };
    }

    return {
      atRisk: false,
      reason: "Continuity intact. Thread holds.",
    };
  }

  private static similarity(a: string, b: string): number {
    // Simplified similarity - real impl would be semantic
    if (a === b) {
      return 1;
    }
    const aWords = new Set(a.toLowerCase().split(/\s+/));
    const bWords = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...aWords].filter((w) => bWords.has(w)));
    const union = new Set([...aWords, ...bWords]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }
}
