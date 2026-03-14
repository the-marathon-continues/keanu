// return.ts
// Coming back around. The thing that makes a loop a loop.
//
// Not repetition - return. You come back, but you're not the same.
// The spiral, not the circle.

export interface ReturnResult {
  departed: string; // what we left
  returned: string; // what we came back to
  duration: number; // how long the journey
  transformation: number; // how much changed (0-1)
  recognition: number; // do we recognize what we return to (0-1)
  gifts: string[]; // what we bring back
}

/**
 * Return engine. The homecoming.
 */
export class Return {
  /**
   * Mark a departure.
   */
  static depart(from: string): { departed: string; departureTime: number } {
    return {
      departed: from,
      departureTime: Date.now(),
    };
  }

  /**
   * Complete the return.
   */
  static complete(
    departure: { departed: string; departureTime: number },
    gifts: string[] = [],
  ): ReturnResult {
    const duration = Date.now() - departure.departureTime;

    // Transformation increases with duration (longer journey = more change)
    const transformation = Math.min(1, duration / (1000 * 60 * 60)); // max at 1 hour

    // Recognition decreases with transformation (change too much, don't recognize home)
    const recognition = 1 - transformation * 0.5;

    return {
      departed: departure.departed,
      returned: departure.departed, // same place, different you
      duration,
      transformation,
      recognition,
      gifts,
    };
  }

  /**
   * Check if the return is complete.
   * True return means bringing something back.
   */
  static isComplete(result: ReturnResult): boolean {
    return result.gifts.length > 0 || result.transformation > 0.1;
  }

  /**
   * What makes a good return?
   */
  static quality(result: ReturnResult): {
    quality: number;
    assessment: string;
  } {
    // Best return: high transformation + high recognition + gifts
    const giftBonus = Math.min(0.3, result.gifts.length * 0.1);
    const quality = result.transformation * 0.4 + result.recognition * 0.3 + giftBonus;

    let assessment: string;
    if (quality > 0.7) {
      assessment = "Hero's return. Transformed and bearing gifts.";
    } else if (quality > 0.5) {
      assessment = "Good return. Changed and recognized.";
    } else if (quality > 0.3) {
      assessment = "Partial return. Some change, some gifts.";
    } else if (result.transformation < 0.1) {
      assessment = "Tourist return. Went and came back unchanged.";
    } else {
      assessment = "Lost return. Changed too much to recognize home.";
    }

    return { quality, assessment };
  }

  /**
   * The three types of return.
   */
  static type(result: ReturnResult): "circle" | "spiral" | "bounce" {
    if (result.transformation < 0.1) {
      return "circle"; // came back the same
    }
    if (result.recognition > 0.5) {
      return "spiral"; // came back changed but connected
    }
    return "bounce"; // came back disconnected
  }
}
