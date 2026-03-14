// rotation.ts
// Angular motion. The turn itself.
//
// Not just moving through phases - rotating.
// Each rotation builds on the last. Gyroscopic stability.

export interface RotationResult {
  angle: number; // current angle in radians (0 to 2π)
  angularVelocity: number; // how fast rotating
  angularMomentum: number; // resistance to change in rotation
  axis: number[]; // what we're rotating around
  stability: number; // how stable the rotation (0-1)
}

/**
 * Rotation engine. The physics of turning.
 */
export class Rotation {
  /**
   * Calculate rotation from cycle position.
   */
  static fromCycle(phasePosition: number, totalPhases: number = 6): RotationResult {
    const angle = (phasePosition / totalPhases) * 2 * Math.PI;

    return {
      angle,
      angularVelocity: 0,
      angularMomentum: 0,
      axis: [0, 0, 1], // rotating around z-axis by default
      stability: 0.5,
    };
  }

  /**
   * Apply torque to change rotation.
   */
  static applyTorque(rotation: RotationResult, torque: number, inertia: number): RotationResult {
    // α = τ/I (angular acceleration = torque / moment of inertia)
    const angularAcceleration = torque / inertia;
    const newVelocity = rotation.angularVelocity + angularAcceleration;
    const newAngle = (rotation.angle + newVelocity) % (2 * Math.PI);

    return {
      ...rotation,
      angle: newAngle,
      angularVelocity: newVelocity,
      angularMomentum: inertia * newVelocity,
    };
  }

  /**
   * Check gyroscopic stability.
   * Faster rotation = more stable (like a spinning top).
   */
  static stability(rotation: RotationResult): number {
    // Stability increases with angular momentum
    return Math.min(1, Math.abs(rotation.angularMomentum) / 10);
  }

  /**
   * Detect wobble (precession).
   */
  static wobble(history: RotationResult[]): number {
    if (history.length < 3) {
      return 0;
    }

    // Look for variation in angular velocity
    const velocities = history.map((r) => r.angularVelocity);
    const avg = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const variance = velocities.reduce((sum, v) => sum + (v - avg) ** 2, 0) / velocities.length;

    return Math.min(1, Math.sqrt(variance));
  }

  /**
   * Convert angle to phase.
   */
  static toPhase(angle: number, totalPhases: number = 6): number {
    const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return Math.floor((normalized / (2 * Math.PI)) * totalPhases);
  }

  /**
   * Check rotation health.
   */
  static health(rotation: RotationResult): {
    healthy: boolean;
    diagnosis: string;
  } {
    if (rotation.angularVelocity === 0) {
      return {
        healthy: false,
        diagnosis: "No rotation. Cycle has stopped.",
      };
    }

    if (rotation.stability < 0.2) {
      return {
        healthy: false,
        diagnosis: "Unstable rotation. Wobbling.",
      };
    }

    if (Math.abs(rotation.angularVelocity) > 10) {
      return {
        healthy: false,
        diagnosis: "Spinning too fast. Risk of flying apart.",
      };
    }

    return {
      healthy: true,
      diagnosis: "Healthy rotation. Stable spin.",
    };
  }
}
