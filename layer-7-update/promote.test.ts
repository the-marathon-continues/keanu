// promote.test.ts
// Tests for pattern lifecycle promotion/demotion.

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordOccurrence,
  promotePatterns,
  demotePatterns,
  contradictPattern,
  confirmPattern,
  getPatternsByStage,
  getAllPatterns,
  getPromotionStats,
  getLastLoadError,
  _reset,
} from "./promote.js";

describe("promote.ts", () => {
  beforeEach(() => {
    _reset();
  });

  describe("recordOccurrence", () => {
    it("creates a new pattern on first occurrence", () => {
      const pattern = recordOccurrence("over_explain", "s-1", true);
      expect(pattern.stage).toBe("observation");
      expect(pattern.confidence).toBe(0.3);
      expect(pattern.occurrences).toBe(1);
    });

    it("increments occurrences on subsequent calls", () => {
      recordOccurrence("over_explain", "s-1", true);
      const pattern = recordOccurrence("over_explain", "s-2", true);
      expect(pattern.occurrences).toBe(2);
    });

    it("tracks corrections separately from occurrences", () => {
      recordOccurrence("over_explain", "s-1", true);
      recordOccurrence("over_explain", "s-2", false);
      const pattern = recordOccurrence("over_explain", "s-3", true);
      expect(pattern.occurrences).toBe(3);
      expect(pattern.corrections).toBe(2);
    });
  });

  describe("promotePatterns", () => {
    it("promotes observation to pattern after 3 occurrences", () => {
      recordOccurrence("over_explain", "s-1", true);
      recordOccurrence("over_explain", "s-2", true);
      recordOccurrence("over_explain", "s-3", true);

      const promotions = promotePatterns("s-3");
      expect(promotions.length).toBe(1);
      expect(promotions[0].from).toBe("observation");
      expect(promotions[0].to).toBe("pattern");

      const patterns = getAllPatterns();
      expect(patterns[0].stage).toBe("pattern");
      expect(patterns[0].confidence).toBe(0.5);
    });

    it("promotes pattern to blind_spot after 2 corrections", () => {
      // First get to pattern stage
      recordOccurrence("over_explain", "s-1", true);
      recordOccurrence("over_explain", "s-2", true);
      recordOccurrence("over_explain", "s-3", true);
      promotePatterns("s-3");

      // Now add more corrections
      recordOccurrence("over_explain", "s-4", true);
      recordOccurrence("over_explain", "s-5", true);

      const promotions = promotePatterns("s-5");
      expect(promotions.length).toBe(1);
      expect(promotions[0].from).toBe("pattern");
      expect(promotions[0].to).toBe("blind_spot");

      const patterns = getAllPatterns();
      expect(patterns[0].stage).toBe("blind_spot");
      expect(patterns[0].confidence).toBe(0.7);
    });
  });

  describe("demotePatterns", () => {
    it("demotes patterns when confidence decays below 0.2", () => {
      recordOccurrence("over_explain", "s-1", true);
      recordOccurrence("over_explain", "s-2", true);
      recordOccurrence("over_explain", "s-3", true);
      promotePatterns("s-3");

      // Many sessions pass without seeing the pattern
      const demotions = demotePatterns("s-100", 50);
      expect(demotions.length).toBe(1);
      expect(demotions[0].to).toBe("stale");

      const patterns = getAllPatterns();
      expect(patterns[0].stage).toBe("stale");
    });
  });

  describe("contradictPattern", () => {
    it("marks a pattern as contradicted", () => {
      recordOccurrence("over_explain", "s-1", true);
      const record = contradictPattern("over_explain", "s-2");

      expect(record).not.toBeNull();
      expect(record!.to).toBe("contradicted");

      const patterns = getAllPatterns();
      expect(patterns[0].stage).toBe("contradicted");
      expect(patterns[0].contradictedBy).toBe("s-2");
    });

    it("returns null for non-existent pattern", () => {
      const record = contradictPattern("missed_tone", "s-1");
      expect(record).toBeNull();
    });
  });

  describe("confirmPattern", () => {
    it("boosts confidence on confirmation", () => {
      recordOccurrence("over_explain", "s-1", true);
      const before = getAllPatterns()[0].confidence;

      confirmPattern("over_explain", "human");
      const after = getAllPatterns()[0].confidence;

      expect(after).toBeGreaterThan(before);
    });

    it("tracks who confirmed", () => {
      recordOccurrence("over_explain", "s-1", true);
      confirmPattern("over_explain", "agent");

      expect(getAllPatterns()[0].confirmedBy).toBe("agent");
    });

    it("upgrades to 'both' when both confirm", () => {
      recordOccurrence("over_explain", "s-1", true);
      confirmPattern("over_explain", "agent");
      confirmPattern("over_explain", "human");

      expect(getAllPatterns()[0].confirmedBy).toBe("both");
    });
  });

  describe("getPatternsByStage", () => {
    it("filters patterns by stage", () => {
      recordOccurrence("over_explain", "s-1", true);
      recordOccurrence("missed_tone", "s-1", true);
      recordOccurrence("missed_tone", "s-2", true);
      recordOccurrence("missed_tone", "s-3", true);
      promotePatterns("s-3");

      const observations = getPatternsByStage("observation");
      const patterns = getPatternsByStage("pattern");

      expect(observations.length).toBe(1);
      expect(patterns.length).toBe(1);
    });
  });

  describe("getPromotionStats", () => {
    it("returns aggregate stats", () => {
      recordOccurrence("over_explain", "s-1", true);
      recordOccurrence("over_explain", "s-2", true);
      recordOccurrence("over_explain", "s-3", true);
      promotePatterns("s-3");

      const stats = getPromotionStats();
      expect(stats.total).toBe(1);
      expect(stats.byStage.pattern).toBe(1);
      expect(stats.recentPromotions.length).toBe(1);
    });
  });

  describe("getLastLoadError", () => {
    it("returns null when no error occurred", () => {
      expect(getLastLoadError()).toBeNull();
    });
  });
});
