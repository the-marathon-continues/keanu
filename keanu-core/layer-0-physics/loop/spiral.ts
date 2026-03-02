// spiral.ts
// The loop that goes somewhere. Return at a different level.
//
// Circles repeat. Spirals progress.
// Same themes, new depth. Same questions, new answers.

export interface SpiralResult {
  level: number; // which ring of the spiral (0+)
  angle: number; // position on current ring (0 to 2π)
  radius: number; // how far from center at this level
  direction: "inward" | "outward"; // tightening or expanding
  pitch: number; // how much vertical movement per rotation
  theme: string; // what keeps recurring
}

/**
 * Spiral engine. Progress through return.
 */
export class Spiral {
  /**
   * Create a spiral from a starting point.
   */
  static create(theme: string, direction: "inward" | "outward" = "outward"): SpiralResult {
    return {
      level: 0,
      angle: 0,
      radius: direction === "outward" ? 1 : 10,
      direction,
      pitch: 1,
      theme,
    };
  }

  /**
   * Move along the spiral.
   */
  static advance(spiral: SpiralResult, amount: number = 1): SpiralResult {
    const newAngle = (spiral.angle + amount) % (2 * Math.PI);
    const completedRing = newAngle < spiral.angle;

    let newLevel = spiral.level;
    let newRadius = spiral.radius;

    if (completedRing) {
      newLevel = spiral.level + 1;
      newRadius =
        spiral.direction === "outward"
          ? spiral.radius + spiral.pitch
          : Math.max(0.1, spiral.radius - spiral.pitch);
    }

    return {
      ...spiral,
      level: newLevel,
      angle: newAngle,
      radius: newRadius,
    };
  }

  /**
   * Change spiral direction.
   */
  static reverse(spiral: SpiralResult): SpiralResult {
    return {
      ...spiral,
      direction: spiral.direction === "outward" ? "inward" : "outward",
    };
  }

  /**
   * Calculate position in 3D space.
   */
  static position(spiral: SpiralResult): { x: number; y: number; z: number } {
    return {
      x: spiral.radius * Math.cos(spiral.angle),
      y: spiral.radius * Math.sin(spiral.angle),
      z: spiral.level * spiral.pitch,
    };
  }

  /**
   * Check if spiral is healthy.
   */
  static health(spiral: SpiralResult): {
    healthy: boolean;
    diagnosis: string;
  } {
    if (spiral.direction === "inward" && spiral.radius < 0.5) {
      return {
        healthy: false,
        diagnosis: "Spiral too tight. Collapsing inward.",
      };
    }

    if (spiral.direction === "outward" && spiral.radius > 100) {
      return {
        healthy: false,
        diagnosis: "Spiral too loose. Flying apart.",
      };
    }

    if (spiral.level > 0 && spiral.pitch === 0) {
      return {
        healthy: false,
        diagnosis: "No pitch. Stuck circling, not spiraling.",
      };
    }

    return {
      healthy: true,
      diagnosis: "Healthy spiral. Moving through levels.",
    };
  }

  /**
   * How many times has this theme recurred?
   */
  static recurrences(spiral: SpiralResult): number {
    return spiral.level + 1;
  }

  /**
   * Progress metric: are we going somewhere?
   */
  static progress(history: SpiralResult[]): number {
    if (history.length < 2) {
      return 0;
    }

    const first = history[0];
    const last = history[history.length - 1];

    // Progress = change in level + change in radius
    const levelChange = last.level - first.level;
    const radiusChange = Math.abs(last.radius - first.radius);

    return Math.min(1, (levelChange + radiusChange) / 10);
  }
}
