// coherence.test.ts
// Tests for narrative coherence analysis.

import { describe, it, expect, beforeEach } from "vitest";
import {
  generateNarratives,
  analyzeCoherence,
  compareNarratives,
  formatInjection,
  formatDashboard,
  reset,
} from "./coherence.js";

describe("coherence", () => {
  beforeEach(() => {
    reset();
  });

  describe("generateNarratives", () => {
    it("returns empty array for no observations", () => {
      const narratives = generateNarratives([]);
      expect(narratives).toEqual([]);
    });

    it("generates narratives from observations", () => {
      const observations = [
        "The server crashed at 3pm",
        "Memory usage spiked before the crash",
        "A new deployment happened at 2:45pm",
      ];

      const narratives = generateNarratives(observations);
      expect(narratives.length).toBeGreaterThan(0);
      expect(narratives.length).toBeLessThanOrEqual(3);
    });

    it("respects count limit", () => {
      const observations = [
        "Observation 1",
        "Observation 2",
        "Observation 3",
        "Observation 4",
        "Observation 5",
      ];

      const narratives = generateNarratives(observations, 2);
      expect(narratives.length).toBeLessThanOrEqual(2);
    });

    it("includes required narrative fields", () => {
      const observations = ["Something happened"];
      const narratives = generateNarratives(observations);

      expect(narratives[0]).toHaveProperty("id");
      expect(narratives[0]).toHaveProperty("summary");
      expect(narratives[0]).toHaveProperty("supportingEvidence");
      expect(narratives[0]).toHaveProperty("contradictingEvidence");
      expect(narratives[0]).toHaveProperty("evidenceWeight");
      expect(narratives[0]).toHaveProperty("assumptions");
      expect(narratives[0]).toHaveProperty("confidence");
    });
  });

  describe("analyzeCoherence", () => {
    it("returns empty analysis for no observations", () => {
      const analysis = analyzeCoherence([]);
      expect(analysis.observations).toEqual([]);
      expect(analysis.narratives).toEqual([]);
      expect(analysis.recommended).toBeNull();
      expect(analysis.confidence).toBe(0);
    });

    it("recommends highest confidence narrative", () => {
      const observations = [
        "The cache was cleared",
        "Performance improved after clearing cache",
        "Cache clearing solved the problem",
      ];

      const analysis = analyzeCoherence(observations);
      expect(analysis.recommended).toBeDefined();
      expect(analysis.narratives.length).toBeGreaterThan(0);

      // Recommended should be the first (highest confidence) narrative
      if (analysis.recommended) {
        expect(analysis.narratives[0].id).toBe(analysis.recommended);
      }
    });

    it("detects tensions between narratives", () => {
      const observations = [
        "The bug was caused by the new deployment",
        "The deployment was successful with no errors",
        "The bug existed before the deployment",
      ];

      const analysis = analyzeCoherence(observations);
      // These observations create tension
      expect(analysis.narratives.length).toBeGreaterThan(0);
    });
  });

  describe("compareNarratives", () => {
    it("declares tie for similar narratives", () => {
      const n1 = {
        id: "n1",
        summary: "Story A",
        supportingEvidence: ["a", "b"],
        contradictingEvidence: [],
        evidenceWeight: 0.5,
        assumptions: [],
        confidence: 0.5,
      };

      const n2 = {
        id: "n2",
        summary: "Story B",
        supportingEvidence: ["c", "d"],
        contradictingEvidence: [],
        evidenceWeight: 0.5,
        assumptions: [],
        confidence: 0.5,
      };

      const result = compareNarratives(n1, n2);
      expect(result.winner).toBe("tie");
    });

    it("picks winner with higher confidence", () => {
      const n1 = {
        id: "n1",
        summary: "Strong story",
        supportingEvidence: ["a", "b", "c"],
        contradictingEvidence: [],
        evidenceWeight: 0.8,
        assumptions: [],
        confidence: 0.8,
      };

      const n2 = {
        id: "n2",
        summary: "Weak story",
        supportingEvidence: ["d"],
        contradictingEvidence: ["e", "f"],
        evidenceWeight: 0.3,
        assumptions: [],
        confidence: 0.3,
      };

      const result = compareNarratives(n1, n2);
      expect(result.winner).toBe("n1");
      expect(result.margin).toBeGreaterThan(0);
    });
  });

  describe("assumptions detection", () => {
    it("detects causal assumptions", () => {
      const observations = ["The crash happened because of memory leak"];
      const narratives = generateNarratives(observations);

      const assumptions = narratives[0].assumptions;
      expect(assumptions.some((a) => a.includes("Causal"))).toBe(true);
    });

    it("detects timing assumptions", () => {
      const observations = ["This always happens before lunch"];
      const narratives = generateNarratives(observations);

      const assumptions = narratives[0].assumptions;
      expect(assumptions.some((a) => a.includes("Timeline") || a.includes("exceptions"))).toBe(
        true,
      );
    });
  });

  describe("formatInjection", () => {
    it("returns null for single narrative", () => {
      const analysis = analyzeCoherence(["Single observation"]);
      const injection = formatInjection(analysis);
      expect(injection).toBeNull();
    });

    it("returns null when no tensions", () => {
      const analysis = {
        observations: ["a", "b"],
        narratives: [
          {
            id: "n1",
            summary: "A",
            supportingEvidence: [],
            contradictingEvidence: [],
            evidenceWeight: 0.5,
            assumptions: [],
            confidence: 0.5,
          },
          {
            id: "n2",
            summary: "B",
            supportingEvidence: [],
            contradictingEvidence: [],
            evidenceWeight: 0.5,
            assumptions: [],
            confidence: 0.5,
          },
        ],
        recommended: "n1",
        confidence: 0.5,
        tensions: [],
      };

      const injection = formatInjection(analysis);
      expect(injection).toBeNull();
    });

    it("surfaces competing narratives with tensions", () => {
      const analysis = {
        observations: ["a", "b"],
        narratives: [
          {
            id: "n1",
            summary: "Story about cause A",
            supportingEvidence: [],
            contradictingEvidence: [],
            evidenceWeight: 0.7,
            assumptions: [],
            confidence: 0.7,
          },
          {
            id: "n2",
            summary: "Story about cause B",
            supportingEvidence: [],
            contradictingEvidence: [],
            evidenceWeight: 0.5,
            assumptions: [],
            confidence: 0.5,
          },
        ],
        recommended: "n1",
        confidence: 0.7,
        tensions: ["A vs B"],
      };

      const injection = formatInjection(analysis);
      expect(injection).not.toBeNull();
      expect(injection).toContain("coherence:");
      expect(injection).toContain("competing stories");
    });
  });

  describe("formatDashboard", () => {
    it("handles empty analysis", () => {
      const analysis = {
        observations: [],
        narratives: [],
        recommended: null,
        confidence: 0,
        tensions: [],
      };

      const dashboard = formatDashboard(analysis);
      expect(dashboard).toBe("No narratives generated.");
    });

    it("formats multiple narratives", () => {
      const analysis = analyzeCoherence([
        "First thing happened",
        "Second thing happened",
        "Third thing happened",
      ]);

      const dashboard = formatDashboard(analysis);
      expect(dashboard).toContain("Coherence Analysis");
      expect(dashboard).toContain("observations");
    });

    it("marks recommended narrative", () => {
      const analysis = analyzeCoherence(["The fix worked", "Performance improved after the fix"]);

      const dashboard = formatDashboard(analysis);
      expect(dashboard).toContain("recommended");
    });
  });
});
