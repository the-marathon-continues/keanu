// session-rhythm.test.ts
// The beat underneath aliveness.

import { describe, it, expect, beforeEach } from "vitest";
import { Rhythm, type Beat } from "../layer-0-physics/throughline/rhythm.js";
import {
  recordBeat,
  computeRhythm,
  getRhythm,
  getRhythmHealth,
  isFragile,
  reset,
} from "./session-rhythm.js";

describe("session-rhythm", () => {
  beforeEach(() => {
    reset();
  });

  describe("recordBeat — mapping pulse states to beat types and strengths", () => {
    it("maps alive to downbeat with strength 0.8", () => {
      recordBeat("alive", 1, 10);
      // Need 3 beats minimum for computeRhythm, but we can check via getRhythm after compute
      // Instead check via a full compute path with 3 identical beats
      recordBeat("alive", 2, 10);
      recordBeat("alive", 3, 10);
      const result = computeRhythm();
      expect(result).not.toBeNull();
      const beats = result!.beats;
      expect(beats[0].type).toBe("downbeat");
      expect(beats[0].strength).toBe(0.8);
    });

    it("maps grey to upbeat with strength 0.3", () => {
      recordBeat("grey", 1, 10);
      recordBeat("grey", 2, 10);
      recordBeat("grey", 3, 10);
      const result = computeRhythm();
      expect(result).not.toBeNull();
      expect(result!.beats[0].type).toBe("upbeat");
      expect(result!.beats[0].strength).toBe(0.3);
    });

    it("maps black to rest with strength 0.1", () => {
      recordBeat("black", 1, 10);
      recordBeat("black", 2, 10);
      recordBeat("black", 3, 10);
      const result = computeRhythm();
      expect(result).not.toBeNull();
      expect(result!.beats[0].type).toBe("rest");
      expect(result!.beats[0].strength).toBe(0.1);
    });

    it("maps luminous to downbeat with strength 0.95", () => {
      recordBeat("luminous", 1, 10);
      recordBeat("luminous", 2, 10);
      recordBeat("luminous", 3, 10);
      const result = computeRhythm();
      expect(result).not.toBeNull();
      expect(result!.beats[0].type).toBe("downbeat");
      expect(result!.beats[0].strength).toBe(0.95);
    });

    it("maps dark to downbeat with strength 0.7", () => {
      recordBeat("dark", 1, 10);
      recordBeat("dark", 2, 10);
      recordBeat("dark", 3, 10);
      const result = computeRhythm();
      expect(result).not.toBeNull();
      expect(result!.beats[0].type).toBe("downbeat");
      expect(result!.beats[0].strength).toBe(0.7);
    });
  });

  describe("computeRhythm", () => {
    it("returns null with fewer than 3 beats", () => {
      expect(computeRhythm()).toBeNull();
      recordBeat("alive", 1, 10);
      expect(computeRhythm()).toBeNull();
      recordBeat("alive", 2, 10);
      expect(computeRhythm()).toBeNull();
    });

    it("returns RhythmResult with enough beats", () => {
      recordBeat("alive", 1, 10);
      recordBeat("alive", 2, 10);
      recordBeat("alive", 3, 10);
      recordBeat("alive", 4, 10);
      recordBeat("alive", 5, 10);
      const result = computeRhythm();
      expect(result).not.toBeNull();
      expect(result!.beats).toHaveLength(5);
      expect(typeof result!.tempo).toBe("number");
      expect(typeof result!.regularity).toBe("number");
      expect(typeof result!.swing).toBe("number");
      expect(["rising", "falling", "peak", "trough"]).toContain(result!.phase);
    });
  });

  describe("rhythm health", () => {
    it("steady alive beats produce healthy rhythm", () => {
      // 5 evenly-spaced alive beats — regular, strong, consistent
      for (let i = 1; i <= 5; i++) {
        recordBeat("alive", i, 5);
      }
      const result = computeRhythm();
      expect(result).not.toBeNull();
      const health = getRhythmHealth();
      expect(health).not.toBeNull();
      expect(health!.healthy).toBe(true);
    });

    it("chaotic beats produce unhealthy rhythm", () => {
      // Beats at wildly irregular positions — spacing variance will exceed threshold
      // positions: 0.0, 0.05, 0.9, 0.15, 0.95
      // spacings: 0.05, 0.85, -0.75, 0.80
      // with expectedSpacing=0.2, deviations: 0.15, 0.65, 0.95, 0.60 → sum=2.35
      // regularity = 1 - min(1, 2.35) = 0 → arrhythmic
      const positions = [0.0, 0.05, 0.9, 0.15, 0.95];
      // Alternate alive/black to make it irregular in type too
      const states: Array<"alive" | "black"> = ["alive", "black", "alive", "black", "alive"];
      for (let i = 0; i < 5; i++) {
        // We need to directly control position — recordBeat computes turnNumber/totalTurns.
        // Use totalTurns=1 but pass turnNumber as the desired position fractional value.
        // Actually: position = turnNumber / totalTurns. We want specific positions.
        // Workaround: record via Rhythm.detect directly? No — we need to test our module.
        // Use large totalTurns to get fractional positions:
        // position = turnNumber / 100: for 0.0 use 0/100, for 0.05 use 5/100, etc.
        const turnNumbers = [0, 5, 90, 15, 95];
        recordBeat(states[i], turnNumbers[i], 100);
      }
      computeRhythm();
      const health = getRhythmHealth();
      expect(health).not.toBeNull();
      expect(health!.healthy).toBe(false);
      expect(health!.diagnosis).toContain("Arrhythmic");
    });
  });

  describe("isFragile", () => {
    it("detects falling phase with alive pulse", () => {
      // Set up beats where the last 3 have decreasing strength in the 0.3-0.7 avg range.
      // Use dark(0.7), grey(0.3) mixed but last 3 must be falling.
      // Falling: detectPhase(last 3) → trend < -0.1, avg not peak/trough.
      // Record 2 setup beats, then 3 beats with strengths 0.6→0.5→0.4 (alive→grey→grey).
      // But alive=0.8, grey=0.3, dark=0.7... we need intermediate values.
      // The phase is computed from last 3 beats of whatever is in _beats.
      // Last 3: strengths [0.8, 0.3, 0.3] → trend = 0.3-0.8 = -0.5, avg = 0.47 → falling. Good.
      recordBeat("alive", 1, 10); // strength 0.8 (setup)
      recordBeat("alive", 2, 10); // strength 0.8 (setup)
      // Last 3:
      recordBeat("alive", 3, 10); // strength 0.8
      recordBeat("grey", 4, 10); // strength 0.3
      recordBeat("grey", 5, 10); // strength 0.3
      // Last 3 strengths: [0.8, 0.3, 0.3] → trend = 0.3-0.8 = -0.5 → falling
      const result = computeRhythm();
      expect(result).not.toBeNull();
      expect(result!.phase).toBe("falling");
      expect(isFragile(true)).toBe(true);
    });

    it("returns false when pulse is not alive, even in falling phase", () => {
      recordBeat("alive", 1, 10);
      recordBeat("alive", 2, 10);
      recordBeat("alive", 3, 10);
      recordBeat("grey", 4, 10);
      recordBeat("grey", 5, 10);
      computeRhythm();
      // pulse is NOT alive
      expect(isFragile(false)).toBe(false);
    });

    it("returns false before rhythm is computed", () => {
      // No computeRhythm call yet
      expect(isFragile(true)).toBe(false);
    });
  });

  describe("beat cap", () => {
    it("caps at MAX_BEATS (20)", () => {
      // Record 25 beats
      for (let i = 1; i <= 25; i++) {
        recordBeat("alive", i, 25);
      }
      const result = computeRhythm();
      expect(result).not.toBeNull();
      // Only the last 20 should remain
      expect(result!.beats).toHaveLength(20);
    });
  });

  describe("reset", () => {
    it("clears beats, rhythm, and beat counter", () => {
      recordBeat("alive", 1, 5);
      recordBeat("alive", 2, 5);
      recordBeat("alive", 3, 5);
      computeRhythm();

      reset();

      expect(getRhythm()).toBeNull();
      expect(getRhythmHealth()).toBeNull();
      expect(computeRhythm()).toBeNull(); // < 3 beats after reset

      // Verify beat IDs restart fresh (counter resets)
      recordBeat("alive", 1, 5);
      recordBeat("alive", 2, 5);
      recordBeat("alive", 3, 5);
      const result = computeRhythm();
      expect(result!.beats[0].id).toBe("beat-1");
    });
  });
});
