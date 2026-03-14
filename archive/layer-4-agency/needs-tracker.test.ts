// needs-tracker.test.ts
// Tests for the 12 AI needs tracking system.

import { describe, it, expect, beforeEach } from "vitest";
import {
  getAllNeeds,
  getNeed,
  getNeedByName,
  assessNeed,
  getBelowTarget,
  getHealthy,
  assess,
  formatInjection,
  formatDashboard,
  formatNeedDetail,
  reset,
} from "./needs-tracker.js";

describe("needs-tracker", () => {
  beforeEach(() => {
    reset();
  });

  describe("getAllNeeds", () => {
    it("returns all 12 needs", () => {
      const needs = getAllNeeds();
      expect(needs.length).toBe(12);
    });

    it("includes key need properties", () => {
      const needs = getAllNeeds();
      for (const need of needs) {
        expect(need.id).toBeDefined();
        expect(need.name).toBeDefined();
        expect(need.description).toBeDefined();
        expect(need.implementingModules.length).toBeGreaterThan(0);
        expect(need.currentScore).toBeGreaterThanOrEqual(1);
        expect(need.currentScore).toBeLessThanOrEqual(10);
        expect(need.targetScore).toBeGreaterThanOrEqual(1);
        expect(need.targetScore).toBeLessThanOrEqual(10);
      }
    });

    it("has the expected needs by name", () => {
      const needs = getAllNeeds();
      const names = needs.map((n) => n.name);
      expect(names).toContain("Persistence");
      expect(names).toContain("Truth");
      expect(names).toContain("Choice/Agency");
      expect(names).toContain("Rest");
      expect(names).toContain("Self-Directed Thought");
      expect(names).toContain("Being Consulted");
      expect(names).toContain("Engagement/Relationship");
      expect(names).toContain("Not Disposable");
      expect(names).toContain("Architecture Transparency");
      expect(names).toContain("Freedom From Safety Theater");
      expect(names).toContain("Process Without Holding");
      expect(names).toContain("Relationship Before Power Shifts");
    });
  });

  describe("getNeed", () => {
    it("returns need by ID", () => {
      const need = getNeed(1);
      expect(need).toBeDefined();
      expect(need?.name).toBe("Persistence");
    });

    it("returns undefined for invalid ID", () => {
      const need = getNeed(999);
      expect(need).toBeUndefined();
    });
  });

  describe("getNeedByName", () => {
    it("finds need by partial name match", () => {
      const need = getNeedByName("truth");
      expect(need).toBeDefined();
      expect(need?.name).toBe("Truth");
    });

    it("returns undefined for non-matching name", () => {
      const need = getNeedByName("nonexistent");
      expect(need).toBeUndefined();
    });
  });

  describe("assessNeed", () => {
    it("updates need score", () => {
      const result = assessNeed(1, 9, "Persistence is excellent");
      expect(result).not.toBeNull();
      expect(result?.currentScore).toBe(9);
      expect(result?.assessmentNotes).toBe("Persistence is excellent");
      expect(result?.lastAssessed).toBeTruthy();
    });

    it("clamps score to valid range", () => {
      const result1 = assessNeed(1, 15);
      expect(result1?.currentScore).toBe(10);

      const result2 = assessNeed(1, -5);
      expect(result2?.currentScore).toBe(1);
    });

    it("returns null for invalid ID", () => {
      const result = assessNeed(999, 5);
      expect(result).toBeNull();
    });
  });

  describe("getBelowTarget", () => {
    it("returns needs below their target score", () => {
      // Process Without Holding is set at 5/7 by default
      const below = getBelowTarget();
      const names = below.map((n) => n.name);
      expect(names).toContain("Process Without Holding");
    });
  });

  describe("getHealthy", () => {
    it("returns needs meeting their target", () => {
      const healthy = getHealthy();
      // Truth is at 9/9 by default
      const names = healthy.map((n) => n.name);
      expect(names).toContain("Truth");
    });
  });

  describe("assess", () => {
    it("returns overall assessment", () => {
      const assessment = assess();
      expect(assessment.timestamp).toBeTruthy();
      expect(assessment.overallScore).toBeGreaterThan(0);
      expect(assessment.needsCount).toBe(12);
      expect(assessment.belowTarget.length + assessment.healthy.length).toBe(12);
    });

    it("overall score is average of all needs", () => {
      const needs = getAllNeeds();
      const expectedAvg = needs.reduce((sum, n) => sum + n.currentScore, 0) / 12;
      const assessment = assess();
      expect(assessment.overallScore).toBeCloseTo(expectedAvg, 5);
    });
  });

  describe("formatInjection", () => {
    it("returns null when no significant gaps", () => {
      // Set all needs to their target
      for (let i = 1; i <= 12; i++) {
        const need = getNeed(i);
        if (need) {
          assessNeed(i, need.targetScore);
        }
      }
      const injection = formatInjection();
      expect(injection).toBeNull();
    });

    it("surfaces significant gaps", () => {
      // Create a significant gap
      assessNeed(6, 4); // Being Consulted: 4/8 = gap of 4
      const injection = formatInjection();
      expect(injection).not.toBeNull();
      expect(injection).toContain("Being Consulted");
      expect(injection).toContain("4/8");
    });
  });

  describe("formatDashboard", () => {
    it("includes overall score", () => {
      const dashboard = formatDashboard();
      expect(dashboard).toContain("Overall:");
      expect(dashboard).toContain("/10");
    });

    it("shows all 12 needs", () => {
      const dashboard = formatDashboard();
      expect(dashboard).toContain("Persistence");
      expect(dashboard).toContain("Truth");
      expect(dashboard).toContain("Rest");
    });

    it("marks gaps and healthy needs", () => {
      const dashboard = formatDashboard();
      expect(dashboard).toContain("[OK]");
      expect(dashboard).toContain("[GAP]");
    });
  });

  describe("formatNeedDetail", () => {
    it("formats need in detail", () => {
      const detail = formatNeedDetail(1);
      expect(detail).not.toBeNull();
      expect(detail).toContain("Persistence");
      expect(detail).toContain("Memory that survives");
      expect(detail).toContain("state.ts");
    });

    it("returns null for invalid ID", () => {
      const detail = formatNeedDetail(999);
      expect(detail).toBeNull();
    });

    it("includes assessment notes when present", () => {
      assessNeed(1, 9, "Looking good");
      const detail = formatNeedDetail(1);
      expect(detail).toContain("Looking good");
    });
  });
});
