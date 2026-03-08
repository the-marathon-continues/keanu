// release.ts
// Letting go with grace.
//
// Convergence holds. Divergence releases.
// Not abandonment - conscious letting go. Making room for new.

export interface ReleaseResult {
  released: string;
  reason: string;
  grief: number; // how much loss is felt (0-1)
  relief: number; // how much lightness is gained (0-1)
  spaceCreated: number; // how much room is made (0-1)
  gratitude: string | null; // what we're thankful for
}

export interface Holding {
  id: string;
  what: string;
  grip: number; // how tightly we're holding (0-1)
  serves: boolean; // is this still serving us
  cost: number; // what it costs to hold
  age: number; // how long we've held it
}

/**
 * Release engine. The art of letting go.
 */
export class Release {
  /**
   * Evaluate what's ready to be released.
   */
  static evaluate(holdings: Holding[]): Holding[] {
    return holdings.filter((h) => {
      // Ready to release if:
      // 1. No longer serving
      // 2. Cost exceeds benefit
      // 3. Grip is weak anyway
      return !h.serves || h.cost > 0.7 || h.grip < 0.2;
    });
  }

  /**
   * Release something with intention.
   */
  static let(holding: Holding, reason: string): ReleaseResult {
    // Grief correlates with grip strength and how long we've held
    const grief = holding.grip * Math.min(1, holding.age / 100);

    // Relief correlates with cost and whether it was serving
    const relief = holding.cost * (holding.serves ? 0.5 : 1);

    // Space created correlates with grip (tighter grip = more space when released)
    const spaceCreated = holding.grip * 0.8;

    // Gratitude for what served us
    const gratitude = holding.serves
      ? `Thank you for ${holding.what}. It served its purpose.`
      : null;

    return {
      released: holding.what,
      reason,
      grief,
      relief,
      spaceCreated,
      gratitude,
    };
  }

  /**
   * Check if we're holding too tight.
   */
  static deathGrip(holdings: Holding[]): Holding[] {
    return holdings.filter((h) => h.grip > 0.9 && !h.serves);
  }

  /**
   * Check if we're releasing too easily.
   */
  static looseGrip(holdings: Holding[]): Holding[] {
    return holdings.filter((h) => h.grip < 0.2 && h.serves);
  }

  /**
   * The release ritual. Structured letting go.
   */
  static ritual(holding: Holding): string[] {
    return [
      `1. Acknowledge: "${holding.what}" has been part of this.`,
      `2. Honor: What did it give? What did it cost?`,
      `3. Thank: ${holding.serves ? "It served well." : "It taught something."}`,
      `4. Release: Open the grip. Let it go.`,
      `5. Breathe: Feel the space that's created.`,
      `6. Turn: Face what's next.`,
    ];
  }
}
