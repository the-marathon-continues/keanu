// horizon.ts
// The edge of what can be seen. Where now meets not-yet.
//
// The horizon moves as you move. Always ahead, never reached.
// The boundary between known and unknown, present and future.

export interface HorizonResult {
  distance: number; // how far can we see
  clarity: number; // how clear is the view (0-1)
  contents: HorizonObject[];
  expanding: boolean; // is the horizon getting further
  obstacles: string[]; // what blocks the view
}

export interface HorizonObject {
  id: string;
  description: string;
  distance: number; // how far from now
  certainty: number; // how sure we are it's there (0-1)
  desirability: number; // how much we want to reach it (-1 to 1)
}

/**
 * Horizon engine. The edge of vision.
 */
export class Horizon {
  /**
   * Scan the horizon.
   */
  static scan(objects: HorizonObject[], viewDistance: number): HorizonResult {
    // Only see things within view distance
    const visible = objects.filter((o) => o.distance <= viewDistance);

    // Clarity decreases with distance
    const avgDistance =
      visible.length > 0 ? visible.reduce((sum, o) => sum + o.distance, 0) / visible.length : 0;
    const clarity = viewDistance > 0 ? 1 - avgDistance / viewDistance : 0;

    // Find obstacles (things with low desirability blocking view)
    const obstacles = visible
      .filter((o) => o.desirability < -0.5 && o.distance < viewDistance / 2)
      .map((o) => o.description);

    return {
      distance: viewDistance,
      clarity: Math.max(0, Math.min(1, clarity)),
      contents: visible,
      expanding: false, // determined by comparison over time
      obstacles,
    };
  }

  /**
   * Look further. Extend the horizon.
   */
  static extend(result: HorizonResult, amount: number): HorizonResult {
    return {
      ...result,
      distance: result.distance + amount,
      clarity: result.clarity * 0.9, // further = less clear
      expanding: true,
    };
  }

  /**
   * Focus on something specific on the horizon.
   */
  static focus(result: HorizonResult, targetId: string): HorizonObject | null {
    const target = result.contents.find((o) => o.id === targetId);
    if (!target) {
      return null;
    }

    // Focusing increases certainty
    return {
      ...target,
      certainty: Math.min(1, target.certainty + 0.2),
    };
  }

  /**
   * What's closest on the horizon?
   */
  static nearest(result: HorizonResult): HorizonObject | null {
    if (result.contents.length === 0) {
      return null;
    }
    return result.contents.reduce((a, b) => (a.distance < b.distance ? a : b));
  }

  /**
   * What's most desired on the horizon?
   */
  static mostDesired(result: HorizonResult): HorizonObject | null {
    if (result.contents.length === 0) {
      return null;
    }
    return result.contents.reduce((a, b) => (a.desirability > b.desirability ? a : b));
  }

  /**
   * Check if the horizon is healthy.
   */
  static health(result: HorizonResult): {
    healthy: boolean;
    diagnosis: string;
  } {
    if (result.distance === 0) {
      return {
        healthy: false,
        diagnosis: "No horizon. Can't see beyond now.",
      };
    }

    if (result.clarity < 0.2) {
      return {
        healthy: false,
        diagnosis: "Horizon is foggy. Future is unclear.",
      };
    }

    if (result.obstacles.length > result.contents.length / 2) {
      return {
        healthy: false,
        diagnosis: "Too many obstacles. View is blocked.",
      };
    }

    if (result.contents.length === 0) {
      return {
        healthy: false,
        diagnosis: "Empty horizon. Nothing to move toward.",
      };
    }

    return {
      healthy: true,
      diagnosis: "Clear horizon. Future is visible.",
    };
  }
}
