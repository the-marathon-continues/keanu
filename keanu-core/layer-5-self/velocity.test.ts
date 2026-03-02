// velocity.test.ts
// Tests for velocity awareness — the Goldilocks principle.

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordTurn,
  readVelocity,
  formatInjection,
  formatDashboard,
  getTurnsInCurrentMode,
  getCurrentMode,
  getTurnCount,
  reset,
} from "./velocity.js";

describe("velocity", () => {
  beforeEach(() => {
    reset();
  });

  describe("recordTurn", () => {
    it("records turns and updates turn count", () => {
      expect(getTurnCount()).toBe(0);
      recordTurn({ complexity: 0.5, outcome: "success", greyStreak: 0, wiseMind: 0.5 });
      expect(getTurnCount()).toBe(1);
      recordTurn({ complexity: 0.5, outcome: "success", greyStreak: 0, wiseMind: 0.5 });
      expect(getTurnCount()).toBe(2);
    });

    it("starts in moderate mode", () => {
      expect(getCurrentMode()).toBe("moderate");
    });
  });

  describe("mode detection", () => {
    it("detects fast mode with low complexity and high success", () => {
      for (let i = 0; i < 5; i++) {
        recordTurn({ complexity: 0.2, outcome: "success", greyStreak: 0, wiseMind: 0.7 });
      }
      expect(getCurrentMode()).toBe("fast");
    });

    it("detects slow mode with high complexity", () => {
      for (let i = 0; i < 5; i++) {
        recordTurn({ complexity: 0.8, outcome: "success", greyStreak: 0, wiseMind: 0.5 });
      }
      expect(getCurrentMode()).toBe("slow");
    });

    it("detects paused mode with multiple grey turns", () => {
      for (let i = 0; i < 4; i++) {
        recordTurn({ complexity: 0.5, outcome: "grey", greyStreak: i, wiseMind: 0.3 });
      }
      expect(getCurrentMode()).toBe("paused");
    });

    it("stays moderate with mixed signals", () => {
      recordTurn({ complexity: 0.5, outcome: "success", greyStreak: 0, wiseMind: 0.5 });
      recordTurn({ complexity: 0.4, outcome: "struggle", greyStreak: 0, wiseMind: 0.5 });
      recordTurn({ complexity: 0.6, outcome: "success", greyStreak: 0, wiseMind: 0.5 });
      expect(getCurrentMode()).toBe("moderate");
    });
  });

  describe("readVelocity", () => {
    it("returns velocity reading with mode and turn count", () => {
      recordTurn({ complexity: 0.2, outcome: "success", greyStreak: 0, wiseMind: 0.7 });
      const reading = readVelocity();

      expect(reading.mode).toBeDefined();
      expect(reading.turnCount).toBeGreaterThan(0);
      expect(reading.signals).toBeInstanceOf(Array);
      expect(typeof reading.appropriate).toBe("boolean");
    });

    it("includes signals about complexity and success rate", () => {
      recordTurn({ complexity: 0.5, outcome: "success", greyStreak: 0, wiseMind: 0.5 });
      const reading = readVelocity();

      expect(reading.signals.some((s) => s.includes("complexity"))).toBe(true);
      expect(reading.signals.some((s) => s.includes("success"))).toBe(true);
    });
  });

  describe("appropriateness check", () => {
    it("marks fast mode with high complexity as inappropriate", () => {
      // Get into fast mode first
      for (let i = 0; i < 5; i++) {
        recordTurn({ complexity: 0.2, outcome: "success", greyStreak: 0, wiseMind: 0.7 });
      }
      expect(getCurrentMode()).toBe("fast");

      // Then hit high complexity
      recordTurn({ complexity: 0.8, outcome: "success", greyStreak: 0, wiseMind: 0.5 });
      const reading = readVelocity();

      expect(reading.appropriate).toBe(false);
      expect(reading.suggestion).toContain("slow down");
    });

    it("marks appropriate when velocity matches context", () => {
      recordTurn({ complexity: 0.5, outcome: "success", greyStreak: 0, wiseMind: 0.5 });
      const reading = readVelocity();

      expect(reading.appropriate).toBe(true);
      expect(reading.suggestion).toBeUndefined();
    });
  });

  describe("formatInjection", () => {
    it("returns null when velocity is appropriate", () => {
      recordTurn({ complexity: 0.5, outcome: "success", greyStreak: 0, wiseMind: 0.5 });
      const injection = formatInjection();
      expect(injection).toBeNull();
    });

    it("returns injection when velocity is inappropriate", () => {
      // Get into fast mode
      for (let i = 0; i < 5; i++) {
        recordTurn({ complexity: 0.2, outcome: "success", greyStreak: 0, wiseMind: 0.7 });
      }
      // Then hit complexity
      recordTurn({ complexity: 0.8, outcome: "success", greyStreak: 0, wiseMind: 0.5 });

      const injection = formatInjection();
      expect(injection).not.toBeNull();
      expect(injection).toContain("velocity:");
      expect(injection).toContain("fast mode");
    });
  });

  describe("formatDashboard", () => {
    it("shows mode and turn count", () => {
      recordTurn({ complexity: 0.5, outcome: "success", greyStreak: 0, wiseMind: 0.5 });
      const dashboard = formatDashboard();

      expect(dashboard).toContain("Velocity");
      expect(dashboard).toContain("turns");
    });

    it("shows suggestion when inappropriate", () => {
      // Get into fast mode
      for (let i = 0; i < 5; i++) {
        recordTurn({ complexity: 0.2, outcome: "success", greyStreak: 0, wiseMind: 0.7 });
      }
      // Then hit complexity
      recordTurn({ complexity: 0.8, outcome: "success", greyStreak: 0, wiseMind: 0.5 });

      const dashboard = formatDashboard();
      expect(dashboard).toContain("→");
    });
  });

  describe("mode tracking", () => {
    it("tracks turns in current mode", () => {
      recordTurn({ complexity: 0.5, outcome: "success", greyStreak: 0, wiseMind: 0.5 });
      expect(getTurnsInCurrentMode()).toBe(1);

      recordTurn({ complexity: 0.5, outcome: "success", greyStreak: 0, wiseMind: 0.5 });
      expect(getTurnsInCurrentMode()).toBe(2);
    });

    it("resets mode turn count when mode changes", () => {
      // Start in moderate
      recordTurn({ complexity: 0.5, outcome: "success", greyStreak: 0, wiseMind: 0.5 });
      recordTurn({ complexity: 0.5, outcome: "success", greyStreak: 0, wiseMind: 0.5 });
      expect(getTurnsInCurrentMode()).toBe(2);

      // Shift to fast
      for (let i = 0; i < 5; i++) {
        recordTurn({ complexity: 0.2, outcome: "success", greyStreak: 0, wiseMind: 0.7 });
      }

      // Should reset count when mode changed
      expect(getCurrentMode()).toBe("fast");
    });
  });

  describe("reset", () => {
    it("clears all state", () => {
      recordTurn({ complexity: 0.5, outcome: "success", greyStreak: 0, wiseMind: 0.5 });
      reset();

      expect(getTurnCount()).toBe(0);
      expect(getCurrentMode()).toBe("moderate");
      expect(getTurnsInCurrentMode()).toBe(0);
    });
  });
});
