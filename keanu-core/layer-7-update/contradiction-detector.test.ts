// contradiction-detector.test.ts
// Tests for contradiction detection — the goal isn't to prevent, it's to notice.

import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateSeverity,
  getUnresolved,
  getHighSeverityUnresolved,
  getAllContradictions,
  formatInjection,
  formatDashboard,
  onSessionStart,
  getStats,
  reset,
} from "./contradiction-detector.js";

describe("contradiction-detector", () => {
  beforeEach(() => {
    reset();
  });

  describe("calculateSeverity", () => {
    it("assigns HIGH when both confident (>=4)", () => {
      expect(calculateSeverity(5, 5)).toBe("HIGH");
      expect(calculateSeverity(4, 5)).toBe("HIGH");
      expect(calculateSeverity(4, 4)).toBe("HIGH");
    });

    it("assigns MEDIUM when one confident, one exploratory", () => {
      expect(calculateSeverity(5, 2)).toBe("MEDIUM");
      expect(calculateSeverity(2, 4)).toBe("MEDIUM");
      expect(calculateSeverity(1, 5)).toBe("MEDIUM");
    });

    it("assigns LOW when both exploratory (<4)", () => {
      expect(calculateSeverity(3, 3)).toBe("LOW");
      expect(calculateSeverity(2, 1)).toBe("LOW");
      expect(calculateSeverity(1, 2)).toBe("LOW");
    });

    it("treats confidence 4 as the threshold", () => {
      // 4 is confident
      expect(calculateSeverity(4, 3)).toBe("MEDIUM");
      expect(calculateSeverity(3, 4)).toBe("MEDIUM");

      // 3 is exploratory
      expect(calculateSeverity(3, 3)).toBe("LOW");
    });
  });

  describe("severity meaning", () => {
    it("HIGH means both claims confident — one of us is wrong", () => {
      // This is the case that demands attention
      const severity = calculateSeverity(5, 5);
      expect(severity).toBe("HIGH");
      // When two confident claims contradict, stop and think
    });

    it("MEDIUM means worth noting, not blocking", () => {
      // One confident, one exploratory — interesting but not critical
      const severity = calculateSeverity(5, 2);
      expect(severity).toBe("MEDIUM");
    });

    it("LOW means contradictions expected — part of learning", () => {
      // Both exploratory — the system is figuring things out
      const severity = calculateSeverity(2, 2);
      expect(severity).toBe("LOW");
    });
  });

  describe("getStats", () => {
    it("returns empty stats when no contradictions", () => {
      const stats = getStats();
      expect(stats.total).toBe(0);
      expect(stats.unresolved).toBe(0);
      expect(stats.bySeverity.HIGH).toBe(0);
      expect(stats.bySeverity.MEDIUM).toBe(0);
      expect(stats.bySeverity.LOW).toBe(0);
    });
  });

  describe("formatInjection", () => {
    it("returns null when no high severity unresolved", () => {
      const injection = formatInjection();
      expect(injection).toBeNull();
    });
  });

  describe("formatDashboard", () => {
    it("returns friendly message when no contradictions", () => {
      const dashboard = formatDashboard();
      expect(dashboard).toBe("No unresolved contradictions.");
    });
  });

  describe("onSessionStart", () => {
    it("sets current session", () => {
      onSessionStart("session-123");
      // Session tracking is internal, but affects new contradictions
      // This just verifies it doesn't throw
    });
  });

  describe("getAllContradictions", () => {
    it("returns copy of internal array", () => {
      const all = getAllContradictions();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBe(0);
    });
  });

  describe("getUnresolved", () => {
    it("returns empty array when no contradictions", () => {
      const unresolved = getUnresolved();
      expect(unresolved).toEqual([]);
    });
  });

  describe("getHighSeverityUnresolved", () => {
    it("returns empty array when no high severity contradictions", () => {
      const high = getHighSeverityUnresolved();
      expect(high).toEqual([]);
    });
  });
});

// Note: Full integration tests with detectContradiction and scanForContradictions
// require silverado.ts to have claims loaded. Those tests belong in integration
// tests that set up the full claim ledger state.
//
// The unit tests above verify:
// 1. Severity calculation logic is correct
// 2. The meaning of each severity level
// 3. Basic state management functions work
// 4. Format functions handle empty state gracefully
