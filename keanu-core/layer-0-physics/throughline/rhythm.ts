// rhythm.ts
// The beat of time. Patterns in the flow.
//
// Not metronome time - organic rhythm. Breath. Heartbeat. Seasons.
// The pulse underneath everything.

export interface Beat {
  id: string;
  position: number; // where in the cycle (0-1)
  strength: number; // how strong this beat (0-1)
  type: "downbeat" | "upbeat" | "rest";
}

export interface RhythmResult {
  beats: Beat[];
  tempo: number; // beats per unit time
  regularity: number; // how consistent (0-1)
  swing: number; // deviation from perfect time (-1 to 1)
  phase: "rising" | "falling" | "peak" | "trough";
}

/**
 * Rhythm engine. Finding the beat.
 */
export class Rhythm {
  /**
   * Detect rhythm in a sequence.
   */
  static detect(beats: Beat[]): RhythmResult {
    if (beats.length === 0) {
      return {
        beats: [],
        tempo: 0,
        regularity: 0,
        swing: 0,
        phase: "trough",
      };
    }

    // Tempo = beats per unit
    const tempo = beats.length;

    // Regularity = how evenly spaced
    const expectedSpacing = 1 / beats.length;
    let spacingVariance = 0;
    for (let i = 1; i < beats.length; i++) {
      const actualSpacing = beats[i].position - beats[i - 1].position;
      spacingVariance += Math.abs(actualSpacing - expectedSpacing);
    }
    const regularity = 1 - Math.min(1, spacingVariance);

    // Swing = average deviation from center
    const centerPositions = beats.map((b, i) => i / beats.length);
    const swing =
      beats.reduce((sum, b, i) => sum + (b.position - centerPositions[i]), 0) / beats.length;

    // Phase based on recent strength trend
    const recentBeats = beats.slice(-3);
    const phase = this.detectPhase(recentBeats);

    return {
      beats,
      tempo,
      regularity,
      swing,
      phase,
    };
  }

  /**
   * Find where we are in the cycle.
   */
  static position(rhythm: RhythmResult): number {
    if (rhythm.beats.length === 0) {
      return 0;
    }
    const last = rhythm.beats[rhythm.beats.length - 1];
    return last.position;
  }

  /**
   * Predict the next beat.
   */
  static next(rhythm: RhythmResult): Beat | null {
    if (rhythm.beats.length < 2) {
      return null;
    }

    const last = rhythm.beats[rhythm.beats.length - 1];
    const secondLast = rhythm.beats[rhythm.beats.length - 2];

    const spacing = last.position - secondLast.position;
    const nextPosition = (last.position + spacing) % 1;

    // Alternate beat types
    const nextType =
      last.type === "downbeat" ? "upbeat" : last.type === "upbeat" ? "rest" : "downbeat";

    return {
      id: `beat-${Date.now()}`,
      position: nextPosition,
      strength: last.strength * 0.9, // slight decay
      type: nextType,
    };
  }

  /**
   * Check if rhythm is healthy.
   */
  static health(rhythm: RhythmResult): {
    healthy: boolean;
    diagnosis: string;
  } {
    if (rhythm.tempo === 0) {
      return {
        healthy: false,
        diagnosis: "No rhythm. Silence.",
      };
    }

    if (rhythm.regularity < 0.3) {
      return {
        healthy: false,
        diagnosis: "Arrhythmic. Beats are chaotic.",
      };
    }

    if (Math.abs(rhythm.swing) > 0.5) {
      return {
        healthy: false,
        diagnosis: "Swing too extreme. Rhythm is lurching.",
      };
    }

    return {
      healthy: true,
      diagnosis: "Healthy rhythm. Steady with natural variation.",
    };
  }

  private static detectPhase(beats: Beat[]): "rising" | "falling" | "peak" | "trough" {
    if (beats.length < 2) {
      return "trough";
    }

    const strengths = beats.map((b) => b.strength);
    const trend = strengths[strengths.length - 1] - strengths[0];

    const avg = strengths.reduce((a, b) => a + b, 0) / strengths.length;

    if (avg > 0.7 && Math.abs(trend) < 0.1) {
      return "peak";
    }
    if (avg < 0.3 && Math.abs(trend) < 0.1) {
      return "trough";
    }
    if (trend > 0.1) {
      return "rising";
    }
    return "falling";
  }
}
