// momentum.ts
// Mass times velocity. The tendency to keep moving.
//
// Hard to start, hard to stop. The physics of persistence.
// What makes change hard and continuity easy (or vice versa).

export interface MomentumResult {
  magnitude: number; // how much momentum (0+)
  direction: number[]; // which way it's going
  inertia: number; // resistance to change (0-1)
  acceleration: number; // rate of change
}

/**
 * Momentum engine. The physics of persistence.
 */
export class Momentum {
  /**
   * Calculate momentum from mass and velocity.
   */
  static calculate(mass: number, velocity: number[]): MomentumResult {
    const speed = Math.sqrt(velocity.reduce((sum, v) => sum + v * v, 0));
    const magnitude = mass * speed;

    // Normalize direction
    const direction = speed > 0 ? velocity.map((v) => v / speed) : velocity.map(() => 0);

    // Inertia increases with mass
    const inertia = Math.min(1, mass / 10);

    return {
      magnitude,
      direction,
      inertia,
      acceleration: 0, // no change yet
    };
  }

  /**
   * Apply force to momentum.
   */
  static applyForce(momentum: MomentumResult, force: number[], mass: number): MomentumResult {
    // a = F/m
    const acceleration = force.map((f) => f / mass);
    const accMagnitude = Math.sqrt(acceleration.reduce((sum, a) => sum + a * a, 0));

    // New velocity = old velocity + acceleration
    const oldVelocity = momentum.direction.map((d) => d * (momentum.magnitude / mass));
    const newVelocity = oldVelocity.map((v, i) => v + acceleration[i]);
    const newSpeed = Math.sqrt(newVelocity.reduce((sum, v) => sum + v * v, 0));

    return {
      magnitude: mass * newSpeed,
      direction: newSpeed > 0 ? newVelocity.map((v) => v / newSpeed) : newVelocity,
      inertia: momentum.inertia,
      acceleration: accMagnitude,
    };
  }

  /**
   * Check if momentum is building or fading.
   */
  static trend(history: MomentumResult[]): "building" | "fading" | "stable" {
    if (history.length < 2) {
      return "stable";
    }

    const recent = history.slice(-3);
    const magnitudes = recent.map((m) => m.magnitude);

    const trend = (magnitudes[magnitudes.length - 1] - magnitudes[0]) / magnitudes.length;

    if (trend > 0.1) {
      return "building";
    }
    if (trend < -0.1) {
      return "fading";
    }
    return "stable";
  }

  /**
   * Calculate energy from momentum.
   */
  static energy(momentum: MomentumResult, mass: number): number {
    // KE = p²/2m
    return (momentum.magnitude * momentum.magnitude) / (2 * mass);
  }

  /**
   * Check if momentum is healthy.
   */
  static health(momentum: MomentumResult): {
    healthy: boolean;
    diagnosis: string;
  } {
    if (momentum.magnitude === 0) {
      return {
        healthy: false,
        diagnosis: "No momentum. Stuck.",
      };
    }

    if (momentum.inertia > 0.9 && momentum.magnitude > 5) {
      return {
        healthy: false,
        diagnosis: "High inertia with high momentum. Hard to steer.",
      };
    }

    if (momentum.acceleration > 2) {
      return {
        healthy: false,
        diagnosis: "Accelerating too fast. Risk of losing control.",
      };
    }

    return {
      healthy: true,
      diagnosis: "Healthy momentum. Moving with control.",
    };
  }
}
