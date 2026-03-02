// flow.ts
// Time flowing. The river that carries everything.
//
// Not clock time - experienced time. Sometimes fast, sometimes slow.
// The throughline that connects who you were to who you're becoming.

export interface Moment {
  id: string;
  content: string;
  weight: number; // how significant (0-1)
  position: "past" | "present" | "future";
  distance: number; // how far from now
}

export interface FlowResult {
  moments: Moment[];
  direction: "forward" | "backward" | "still";
  velocity: number; // how fast time feels
  viscosity: number; // how thick/resistant the flow
  coherence: number; // how connected the moments feel
}

/**
 * Flow engine. Time as experienced.
 */
export class Flow {
  /**
   * Analyze the flow of time in a sequence.
   */
  static analyze(moments: Moment[]): FlowResult {
    if (moments.length === 0) {
      return {
        moments: [],
        direction: "still",
        velocity: 0,
        viscosity: 1,
        coherence: 0,
      };
    }

    // Sort by distance from present
    const sorted = [...moments].toSorted((a, b) => {
      const aPos = a.position === "past" ? -a.distance : a.distance;
      const bPos = b.position === "past" ? -b.distance : b.distance;
      return aPos - bPos;
    });

    // Direction based on weight distribution
    const pastWeight = moments
      .filter((m) => m.position === "past")
      .reduce((sum, m) => sum + m.weight, 0);
    const futureWeight = moments
      .filter((m) => m.position === "future")
      .reduce((sum, m) => sum + m.weight, 0);

    let direction: "forward" | "backward" | "still";
    if (futureWeight > pastWeight * 1.5) {
      direction = "forward";
    } else if (pastWeight > futureWeight * 1.5) {
      direction = "backward";
    } else {
      direction = "still";
    }

    // Velocity based on how spread out the moments are
    const totalDistance = moments.reduce((sum, m) => sum + m.distance, 0);
    const velocity = moments.length > 0 ? totalDistance / moments.length : 0;

    // Viscosity based on weight (heavier = thicker flow)
    const avgWeight = moments.reduce((sum, m) => sum + m.weight, 0) / moments.length;
    const viscosity = avgWeight;

    // Coherence based on how connected moments feel
    const coherence = this.calculateCoherence(sorted);

    return {
      moments: sorted,
      direction,
      velocity,
      viscosity,
      coherence,
    };
  }

  /**
   * Find the present moment in a flow.
   */
  static present(flow: FlowResult): Moment | null {
    return flow.moments.find((m) => m.position === "present") || null;
  }

  /**
   * Check if flow is healthy.
   */
  static health(flow: FlowResult): {
    healthy: boolean;
    diagnosis: string;
  } {
    if (flow.direction === "backward" && flow.velocity > 0.7) {
      return {
        healthy: false,
        diagnosis: "Stuck in the past. Time flowing backward too fast.",
      };
    }

    if (flow.viscosity > 0.9) {
      return {
        healthy: false,
        diagnosis: "Time feels thick. Everything is heavy.",
      };
    }

    if (flow.coherence < 0.2) {
      return {
        healthy: false,
        diagnosis: "Disconnected moments. No throughline.",
      };
    }

    if (flow.velocity === 0 && flow.moments.length > 0) {
      return {
        healthy: false,
        diagnosis: "Time has stopped. Frozen in place.",
      };
    }

    return {
      healthy: true,
      diagnosis: "Healthy flow. Past connects to future through present.",
    };
  }

  private static calculateCoherence(moments: Moment[]): number {
    if (moments.length < 2) {
      return 1;
    }

    // Coherence = how smoothly moments connect
    let connections = 0;
    for (let i = 1; i < moments.length; i++) {
      const gap = Math.abs(moments[i].distance - moments[i - 1].distance);
      if (gap < 0.5) {
        connections++;
      }
    }

    return connections / (moments.length - 1);
  }
}
