// belief-updater.test.ts
// Tests for active belief revision — the journal that asks "still true?"

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordRevision,
  getRevisionHistory,
  getRevisionsInSession,
  getRecentRevisions,
  formatInjection,
  onSessionStart,
  recordVerification,
  recordContradiction,
  recordRetraction,
  getStats,
  reset,
} from "./belief-updater.js";

describe("belief-updater", () => {
  beforeEach(() => {
    reset();
  });

  describe("recordRevision", () => {
    it("records a revision with all fields", () => {
      const revision = recordRevision("claim-1", "Drew prefers TypeScript", 5, 3, "decay");

      expect(revision.claimId).toBe("claim-1");
      expect(revision.claimText).toBe("Drew prefers TypeScript");
      expect(revision.oldConfidence).toBe(5);
      expect(revision.newConfidence).toBe(3);
      expect(revision.reason).toBe("decay");
      expect(revision.id).toBeDefined();
      expect(revision.timestamp).toBeDefined();
    });

    it("records revision with evidence", () => {
      const revision = recordRevision(
        "claim-2",
        "The API uses REST",
        4,
        0,
        "contradiction",
        "New evidence shows GraphQL",
      );

      expect(revision.evidence).toBe("New evidence shows GraphQL");
    });

    it("maintains rolling window of 100 revisions", () => {
      // Add 110 revisions
      for (let i = 0; i < 110; i++) {
        recordRevision(`claim-${i}`, `Claim ${i}`, 5, 4, "decay");
      }

      const history = getRevisionHistory();
      expect(history.length).toBe(100);
      // Oldest should be trimmed
      expect(history[0].claimId).toBe("claim-10");
    });
  });

  describe("getRevisionHistory", () => {
    it("returns all revisions when no filter", () => {
      recordRevision("a", "Claim A", 5, 4, "decay");
      recordRevision("b", "Claim B", 4, 3, "decay");

      const history = getRevisionHistory();
      expect(history.length).toBe(2);
    });

    it("filters by claimId when provided", () => {
      recordRevision("a", "Claim A", 5, 4, "decay");
      recordRevision("b", "Claim B", 4, 3, "decay");
      recordRevision("a", "Claim A", 4, 2, "decay");

      const history = getRevisionHistory("a");
      expect(history.length).toBe(2);
      expect(history.every((r) => r.claimId === "a")).toBe(true);
    });
  });

  describe("getRevisionsInSession", () => {
    it("filters by session", () => {
      onSessionStart("session-1");
      recordRevision("a", "Claim A", 5, 4, "decay");

      onSessionStart("session-2");
      recordRevision("b", "Claim B", 4, 3, "decay");

      const session1 = getRevisionsInSession("session-1");
      expect(session1.length).toBe(1);
      expect(session1[0].claimId).toBe("a");

      const session2 = getRevisionsInSession("session-2");
      expect(session2.length).toBe(1);
      expect(session2[0].claimId).toBe("b");
    });
  });

  describe("getRecentRevisions", () => {
    it("returns last N revisions", () => {
      for (let i = 0; i < 10; i++) {
        recordRevision(`claim-${i}`, `Claim ${i}`, 5, 4, "decay");
      }

      const recent = getRecentRevisions(3);
      expect(recent.length).toBe(3);
      expect(recent[0].claimId).toBe("claim-7");
      expect(recent[2].claimId).toBe("claim-9");
    });
  });

  describe("convenience functions", () => {
    it("recordVerification keeps same confidence", () => {
      const rev = recordVerification("c1", "Still true", 5);
      expect(rev.oldConfidence).toBe(5);
      expect(rev.newConfidence).toBe(5);
      expect(rev.reason).toBe("verification");
      expect(rev.evidence).toBe("agent confirmed");
    });

    it("recordContradiction sets confidence to 0", () => {
      const rev = recordContradiction("c2", "Was wrong", 4, "New info says otherwise");
      expect(rev.oldConfidence).toBe(4);
      expect(rev.newConfidence).toBe(0);
      expect(rev.reason).toBe("contradiction");
      expect(rev.evidence).toBe("New info says otherwise");
    });

    it("recordRetraction sets confidence to 0", () => {
      const rev = recordRetraction("c3", "Taking it back", 3, "I was mistaken");
      expect(rev.oldConfidence).toBe(3);
      expect(rev.newConfidence).toBe(0);
      expect(rev.reason).toBe("retraction");
      expect(rev.evidence).toBe("I was mistaken");
    });
  });

  describe("getStats", () => {
    it("tracks revisions by reason", () => {
      onSessionStart("test-session");
      recordRevision("a", "A", 5, 4, "decay");
      recordRevision("b", "B", 4, 3, "decay");
      recordRevision("c", "C", 3, 0, "contradiction");
      recordVerification("d", "D", 5);

      const stats = getStats();
      expect(stats.totalRevisions).toBe(4);
      expect(stats.thisSession).toBe(4);
      expect(stats.byReason.decay).toBe(2);
      expect(stats.byReason.contradiction).toBe(1);
      expect(stats.byReason.verification).toBe(1);
    });
  });

  describe("formatInjection", () => {
    it("returns null when no revisions or reviews", () => {
      onSessionStart("empty-session");
      const injection = formatInjection();
      expect(injection).toBeNull();
    });

    it("includes recent revision from current session", () => {
      onSessionStart("test-session");
      recordRevision("x", "Something changed", 5, 3, "evidence", "found new data");

      const injection = formatInjection();
      expect(injection).toContain("[belief-review:");
      expect(injection).toContain("Something changed");
      expect(injection).toContain("5→3");
      expect(injection).toContain("evidence");
    });
  });
});
