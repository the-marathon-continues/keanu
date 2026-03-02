// digest.test.ts
// Tests for the learn digest formatter.

import { describe, it, expect } from "vitest";
import { formatDigest, formatQuickDigest } from "./digest.js";
import type { DigestInput, QuickDigestInput } from "./digest.js";

describe("digest.ts", () => {
  describe("formatDigest", () => {
    it("formats a complete digest", () => {
      const input: DigestInput = {
        sessionId: "s-test-123",
        workedItems: ["5 alive turns", "1 disagreement resolved"],
        brokeItems: [
          {
            description: "over-explained again",
            isBlindSpot: true,
            occurrences: 4,
            category: "over_explain",
          },
        ],
        confidenceChanges: [
          {
            pattern: "Tendency to over-explain",
            direction: "up",
            oldConfidence: 0.3,
            newConfidence: 0.5,
            reason: "Seen 3 times",
          },
        ],
        partnershipHealth: {
          trustStatus: "calibrating",
          greyRate: 12,
          aliveMoments: 5,
          corrections: 1,
          disagreementsResolved: 1,
        },
        curiosityQuestions: ["Why does over_explain keep recurring?"],
        promotions: [
          {
            from: "observation",
            to: "pattern",
            session: "s-test-123",
            timestamp: "",
            reason: "Seen 3x",
          },
        ],
        demotions: [],
        coefEmoji: "💟🐕💚",
      };

      const digest = formatDigest(input);

      expect(digest.markdown).toContain("Session s-test-123");
      expect(digest.markdown).toContain("5 alive turns");
      expect(digest.markdown).toContain("over-explained again");
      expect(digest.markdown).toContain("blind spot");
      expect(digest.markdown).toContain("Tendency to over-explain");
      expect(digest.markdown).toContain("30%");
      expect(digest.markdown).toContain("50%");
      expect(digest.markdown).toContain("calibrating");
      expect(digest.markdown).toContain("over_explain keep recurring");
      expect(digest.markdown).toContain("💟🐕💚");

      expect(digest.summary).toContain("2 worked");
      expect(digest.summary).toContain("1 broke");
    });

    it("handles empty inputs gracefully", () => {
      const input: DigestInput = {
        sessionId: "s-empty",
        workedItems: [],
        brokeItems: [],
        confidenceChanges: [],
        partnershipHealth: {
          trustStatus: "building",
          greyRate: 0,
          aliveMoments: 0,
          corrections: 0,
          disagreementsResolved: 0,
        },
        curiosityQuestions: [],
        promotions: [],
        demotions: [],
        coefEmoji: "",
      };

      const digest = formatDigest(input);

      expect(digest.markdown).toContain("nothing logged");
      expect(digest.markdown).toContain("nothing broke");
      expect(digest.markdown).toContain("no changes");
      expect(digest.summary).toContain("0 worked");
    });

    it("shows demotion in lifecycle section", () => {
      const input: DigestInput = {
        sessionId: "s-demotion",
        workedItems: [],
        brokeItems: [],
        confidenceChanges: [],
        partnershipHealth: {
          trustStatus: "stable",
          greyRate: 5,
          aliveMoments: 10,
          corrections: 0,
          disagreementsResolved: 0,
        },
        curiosityQuestions: [],
        promotions: [],
        demotions: [
          {
            from: "pattern",
            to: "stale",
            session: "s-demotion",
            timestamp: "",
            reason: "Confidence decayed",
          },
        ],
        coefEmoji: "",
      };

      const digest = formatDigest(input);

      expect(digest.markdown).toContain("pattern → stale");
      expect(digest.markdown).toContain("Confidence decayed");
    });
  });

  describe("formatQuickDigest", () => {
    it("returns a one-line summary", () => {
      const input: QuickDigestInput = {
        corrections: 2,
        greyRate: 15,
        aliveMoments: 8,
        recentPatterns: [
          {
            id: "p1",
            category: "over_explain",
            description: "Tendency to over-explain",
            stage: "pattern",
            confidence: 0.5,
            firstSeen: "s-1",
            lastSeen: "s-5",
            occurrences: 5,
            corrections: 3,
            sessionsSinceCorrection: 2,
            confirmedBy: null,
            contradictedBy: null,
            promotions: [],
          },
        ],
      };

      const result = formatQuickDigest(input);

      expect(result).toContain("Corrections: 2");
      expect(result).toContain("Grey: 15%");
      expect(result).toContain("Alive: 8");
      expect(result).toContain("Tendency to over-explain");
      expect(result).toContain("pattern");
      expect(result).toContain("50%");
    });

    it("handles empty patterns", () => {
      const input: QuickDigestInput = {
        corrections: 0,
        greyRate: 0,
        aliveMoments: 5,
        recentPatterns: [],
      };

      const result = formatQuickDigest(input);

      expect(result).toContain("Patterns: none");
    });

    it("excludes stale patterns", () => {
      const input: QuickDigestInput = {
        corrections: 0,
        greyRate: 0,
        aliveMoments: 5,
        recentPatterns: [
          {
            id: "p1",
            category: "over_explain",
            description: "Stale pattern",
            stage: "stale",
            confidence: 0.1,
            firstSeen: "s-1",
            lastSeen: "s-5",
            occurrences: 5,
            corrections: 3,
            sessionsSinceCorrection: 50,
            confirmedBy: null,
            contradictedBy: null,
            promotions: [],
          },
        ],
      };

      const result = formatQuickDigest(input);

      expect(result).toContain("Patterns: none");
      expect(result).not.toContain("Stale pattern");
    });
  });
});
