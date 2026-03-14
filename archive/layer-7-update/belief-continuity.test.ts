// belief-continuity.test.ts
// Thread integrity checking for belief revision history.
//
// The question: when a claim changes over and over, does the thread hold?
// A belief that drifts from 0.9 to 0.85 to 0.8 is consistent.
// A belief that flips (true → false → true) is fraying.
// This is where that distinction lives.

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordRevision,
  checkBeliefContinuity,
  getContinuityIssues,
  reset,
} from "./belief-updater.js";

describe("belief-continuity", () => {
  beforeEach(() => {
    reset();
  });

  describe("checkBeliefContinuity", () => {
    it("no continuity check with fewer than 3 revisions", () => {
      recordRevision("claim-1", "Drew prefers TypeScript", 5, 4, "decay");
      recordRevision("claim-1", "Drew prefers TypeScript", 4, 3, "decay");

      const result = checkBeliefContinuity("claim-1");
      expect(result).toBeNull();
    });

    it("continuity check runs at 3+ revisions", () => {
      recordRevision("claim-1", "Drew prefers TypeScript", 5, 4, "decay");
      recordRevision("claim-1", "Drew prefers TypeScript", 4, 3, "decay");
      recordRevision("claim-1", "Drew prefers TypeScript", 3, 2, "decay");

      const result = checkBeliefContinuity("claim-1");
      expect(result).not.toBeNull();
      expect(result).toHaveProperty("intact");
      expect(result).toHaveProperty("breaks");
      expect(result).toHaveProperty("strength");
    });

    it("consistent revisions show intact continuity", () => {
      // Same claim text, steadily declining confidence — thread holds
      recordRevision("claim-1", "X is true", 9, 9, "verification");
      recordRevision("claim-1", "X is true", 9, 8.5, "decay");
      recordRevision("claim-1", "X is true", 8.5, 8.0, "decay");

      const result = checkBeliefContinuity("claim-1");
      expect(result).not.toBeNull();
      expect(result!.intact).toBe(true);
      expect(result!.breaks).toHaveLength(0);
    });

    it("contradictory revisions show breaks", () => {
      // Flip-flopping: unrelated statements so Jaccard similarity < 0.3
      // Each adjacent pair shares almost no words
      recordRevision("claim-2", "TypeScript preferred always", 9, 9, "verification");
      recordRevision("claim-2", "Python definitely superior language", 9, 1, "contradiction");
      recordRevision("claim-2", "TypeScript preferred always", 1, 9, "evidence");

      const result = checkBeliefContinuity("claim-2");
      expect(result).not.toBeNull();
      expect(result!.intact).toBe(false);
      expect(result!.breaks.length).toBeGreaterThan(0);
    });

    it("continuity issues tracked by claim ID after a break", () => {
      recordRevision("claim-3", "TypeScript preferred always", 9, 9, "verification");
      recordRevision("claim-3", "Python definitely superior language", 9, 1, "contradiction");
      recordRevision("claim-3", "TypeScript preferred always", 1, 9, "evidence");

      // Trigger via direct call (auto-trigger fires too but let's be explicit)
      checkBeliefContinuity("claim-3");

      const issues = getContinuityIssues();
      expect(issues.has("claim-3")).toBe(true);
    });

    it("healed continuity removes claim from issues", () => {
      // First — create a break
      recordRevision("claim-4", "TypeScript preferred always", 9, 9, "verification");
      recordRevision("claim-4", "Python definitely superior language", 9, 1, "contradiction");
      recordRevision("claim-4", "TypeScript preferred always", 1, 9, "evidence");
      checkBeliefContinuity("claim-4");
      expect(getContinuityIssues().has("claim-4")).toBe(true);

      // Now reset and build a consistent thread for the same claim
      reset();
      recordRevision("claim-4", "X is consistent", 9, 9, "verification");
      recordRevision("claim-4", "X is consistent", 9, 8.5, "decay");
      recordRevision("claim-4", "X is consistent", 8.5, 8.0, "decay");
      checkBeliefContinuity("claim-4");

      expect(getContinuityIssues().has("claim-4")).toBe(false);
    });

    it("different claims tracked separately", () => {
      // claim-A: consistent
      recordRevision("claim-A", "X is true", 9, 9, "verification");
      recordRevision("claim-A", "X is true", 9, 8.5, "decay");
      recordRevision("claim-A", "X is true", 8.5, 8, "decay");

      // claim-B: contradictory — unrelated text so Jaccard drops below 0.3
      recordRevision("claim-B", "TypeScript preferred always", 9, 9, "verification");
      recordRevision("claim-B", "Python definitely superior language", 9, 0, "contradiction");
      recordRevision("claim-B", "TypeScript preferred always", 0, 9, "evidence");

      checkBeliefContinuity("claim-A");
      checkBeliefContinuity("claim-B");

      const issues = getContinuityIssues();
      expect(issues.has("claim-A")).toBe(false);
      expect(issues.has("claim-B")).toBe(true);
    });

    it("reset clears continuity issues", () => {
      recordRevision("claim-5", "TypeScript preferred always", 9, 9, "verification");
      recordRevision("claim-5", "Python definitely superior language", 9, 0, "contradiction");
      recordRevision("claim-5", "TypeScript preferred always", 0, 9, "evidence");
      checkBeliefContinuity("claim-5");

      expect(getContinuityIssues().size).toBeGreaterThan(0);

      reset();

      expect(getContinuityIssues().size).toBe(0);
    });
  });

  describe("auto-trigger via recordRevision", () => {
    it("auto-checks continuity after third revision for the same claim", () => {
      // Three revisions with contradictory content — issues should populate automatically
      recordRevision("claim-6", "TypeScript preferred always", 9, 9, "verification");
      recordRevision("claim-6", "Python definitely superior language", 9, 0, "contradiction");
      recordRevision("claim-6", "TypeScript preferred always", 0, 9, "evidence");

      // No explicit checkBeliefContinuity call — auto-trigger should have fired
      const issues = getContinuityIssues();
      expect(issues.has("claim-6")).toBe(true);
    });

    it("consistent third revision does not add to issues", () => {
      recordRevision("claim-7", "X is true", 9, 9, "verification");
      recordRevision("claim-7", "X is true", 9, 8.5, "decay");
      recordRevision("claim-7", "X is true", 8.5, 8, "decay");

      const issues = getContinuityIssues();
      expect(issues.has("claim-7")).toBe(false);
    });
  });
});
