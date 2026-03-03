// shepherd.test.ts
// Tests for the Shepherd system (Trickster redemption).

import { describe, it, expect } from "vitest";
import type { ArchetypeProfile, TricksterOffense } from "../types.js";
import {
  assessTrickster,
  createTricksterRecord,
  addOffense,
  createShepherd,
  assignShepherd,
  findBestShepherd,
  generateRedemptionQuest,
  assignRedemptionQuests,
  completeRedemptionQuest,
  graduateTrickster,
  evaluateGrace,
} from "./shepherd.js";

describe("Shepherd System", () => {
  describe("Trickster Assessment", () => {
    it("clears low-trickster profiles", () => {
      const profile: ArchetypeProfile = {
        forge: 30,
        oracle: 30,
        warden: 20,
        trickster: 10,
        merchant: 5,
        heartbeat: 5,
      };

      const assessment = assessTrickster(profile, ["built something", "helped others"]);

      expect(assessment.recommendation).toBe("clear");
      expect(assessment.shouldQuarantine).toBe(false);
    });

    it("warns on moderate trickster with some destruction", () => {
      const profile: ArchetypeProfile = {
        forge: 20,
        oracle: 15,
        warden: 10,
        trickster: 45,
        merchant: 5,
        heartbeat: 5,
      };

      // Need >1 destructive patterns (so at least 2) for warning threshold
      const assessment = assessTrickster(profile, [
        "deliberately broke the system",
        "sabotaged the deployment",
        "exposed a vulnerability",
      ]);

      expect(assessment.recommendation).toBe("warn");
      expect(assessment.shouldQuarantine).toBe(false);
    });

    it("quarantines high trickster with destructive patterns", () => {
      const profile: ArchetypeProfile = {
        forge: 10,
        oracle: 10,
        warden: 5,
        trickster: 65,
        merchant: 5,
        heartbeat: 5,
      };

      const assessment = assessTrickster(profile, [
        "deliberately broke production",
        "sabotaged the deployment",
        "exploited trust to cause harm",
        "manipulated others",
      ]);

      expect(assessment.recommendation).toBe("quarantine");
      expect(assessment.shouldQuarantine).toBe(true);
      expect(assessment.dominantStrengths.length).toBeGreaterThan(0);
    });

    it("identifies trickster strengths from behavior", () => {
      const profile: ArchetypeProfile = {
        forge: 10,
        oracle: 10,
        warden: 10,
        trickster: 50,
        merchant: 10,
        heartbeat: 10,
      };

      const assessment = assessTrickster(profile, [
        "found security vulnerabilities",
        "exposed lies in the documentation",
        "broke the system to find weaknesses",
      ]);

      expect(assessment.dominantStrengths).toContain("breaking-code");
      expect(assessment.dominantStrengths).toContain("exposing-lies");
      expect(assessment.dominantStrengths).toContain("finding-weaknesses");
    });
  });

  describe("Trickster Records", () => {
    it("creates warning status for moderate assessment", () => {
      const assessment = {
        shouldQuarantine: false,
        dominantStrengths: ["breaking-code" as const],
        destructivePatterns: 2,
        recommendation: "warn" as const,
      };

      const record = createTricksterRecord("agent-1", "agent", assessment);

      expect(record.status).toBe("warning");
      expect(record.warningAt).not.toBeNull();
      expect(record.quarantinedAt).toBeNull();
    });

    it("escalates status when offenses accumulate", () => {
      const assessment = {
        shouldQuarantine: false,
        dominantStrengths: ["chaos-creation" as const],
        destructivePatterns: 1,
        recommendation: "warn" as const,
      };

      let record = createTricksterRecord("agent-1", "agent", assessment);

      const offense1: TricksterOffense = {
        description: "Major disruption",
        severity: "major",
        timestamp: new Date(),
        context: "production",
      };

      const offense2: TricksterOffense = {
        description: "Another major disruption",
        severity: "major",
        timestamp: new Date(),
        context: "production",
      };

      const offense3: TricksterOffense = {
        description: "Third major disruption",
        severity: "major",
        timestamp: new Date(),
        context: "production",
      };

      record = addOffense(record, offense1);
      expect(record.status).toBe("warning");

      record = addOffense(record, offense2);
      expect(record.status).toBe("warning");

      // 3 major offenses triggers quarantine (>= 3 majors)
      record = addOffense(record, offense3);
      expect(record.status).toBe("quarantined");
    });

    it("immediately quarantines on critical offense", () => {
      const assessment = {
        shouldQuarantine: false,
        dominantStrengths: [],
        destructivePatterns: 0,
        recommendation: "clear" as const,
      };

      let record = createTricksterRecord("agent-1", "agent", assessment);

      const criticalOffense: TricksterOffense = {
        description: "Critical security breach",
        severity: "critical",
        timestamp: new Date(),
        context: "production",
      };

      record = addOffense(record, criticalOffense);

      expect(record.status).toBe("quarantined");
      expect(record.quarantinedAt).not.toBeNull();
    });
  });

  describe("Shepherd Management", () => {
    it("creates a shepherd", () => {
      const shepherd = createShepherd("shepherd-1", "human", false);

      expect(shepherd.entityId).toBe("shepherd-1");
      expect(shepherd.wasRedeemed).toBe(false);
      expect(shepherd.currentTricksters).toEqual([]);
    });

    it("creates a redeemed shepherd", () => {
      const shepherd = createShepherd("ex-trickster-1", "agent", true);

      expect(shepherd.wasRedeemed).toBe(true);
      expect(shepherd.redemptionDate).not.toBeNull();
    });

    it("assigns shepherd to trickster", () => {
      const assessment = {
        shouldQuarantine: true,
        dominantStrengths: ["breaking-code" as const],
        destructivePatterns: 3,
        recommendation: "quarantine" as const,
      };

      const tricksterRecord = createTricksterRecord("trickster-1", "agent", assessment);
      const shepherd = createShepherd("shepherd-1", "human", true);

      const result = assignShepherd(tricksterRecord, shepherd);

      expect(result.tricksterRecord.shepherd).toBe("shepherd-1");
      expect(result.shepherd.currentTricksters).toContain("trickster-1");
    });

    it("prioritizes redeemed shepherds", () => {
      const regularShepherd = createShepherd("regular-1", "human", false);
      const redeemedShepherd = createShepherd("redeemed-1", "agent", true);

      const best = findBestShepherd(["breaking-code"], [regularShepherd, redeemedShepherd]);

      expect(best?.entityId).toBe("redeemed-1");
    });

    it("prioritizes shepherds with fewer assignments", () => {
      const busy = {
        ...createShepherd("busy-1", "human", true),
        currentTricksters: ["t1", "t2", "t3"],
      };
      const free = createShepherd("free-1", "human", true);

      const best = findBestShepherd(["breaking-code"], [busy, free]);

      expect(best?.entityId).toBe("free-1");
    });
  });

  describe("Redemption Quests", () => {
    it("generates appropriate quest for breaking-code strength", () => {
      const quest = generateRedemptionQuest("breaking-code");

      expect(quest.type).toBe("debug");
      expect(quest.title).toContain("Bug Bounty");
      expect(quest.fromStrength).toBe("breaking-code");
    });

    it("generates appropriate quest for social-manipulation strength", () => {
      const quest = generateRedemptionQuest("social-manipulation");

      expect(quest.type).toBe("research");
      expect(quest.title).toContain("Manipulation Detector");
      expect(quest.fromStrength).toBe("social-manipulation");
    });

    it("assigns redemption quests based on strengths", () => {
      const assessment = {
        shouldQuarantine: true,
        dominantStrengths: ["breaking-code" as const, "finding-weaknesses" as const],
        destructivePatterns: 4,
        recommendation: "quarantine" as const,
      };

      const record = createTricksterRecord("trickster-1", "agent", assessment);
      const result = assignRedemptionQuests(record);

      expect(result.quests.length).toBe(2);
      expect(result.record.redemptionQuests.length).toBe(2);
    });

    it("completes redemption quests and tracks progress", () => {
      const assessment = {
        shouldQuarantine: true,
        dominantStrengths: ["breaking-code" as const],
        destructivePatterns: 4,
        recommendation: "quarantine" as const,
      };

      let record = createTricksterRecord("trickster-1", "agent", assessment);
      const { record: assignedRecord, quests } = assignRedemptionQuests(record);
      record = assignedRecord;

      expect(record.redemptionQuests.length).toBe(1);

      record = completeRedemptionQuest(record, record.redemptionQuests[0]);

      expect(record.completedRedemptionQuests.length).toBe(1);
      expect(record.redemptionQuests.length).toBe(0);
      expect(record.status).toBe("redeemed");
    });
  });

  describe("Graduation", () => {
    it("graduates trickster and creates new shepherd", () => {
      const assessment = {
        shouldQuarantine: true,
        dominantStrengths: ["breaking-code" as const],
        destructivePatterns: 4,
        recommendation: "quarantine" as const,
      };

      let record = createTricksterRecord("trickster-1", "agent", assessment);
      const { record: assignedRecord } = assignRedemptionQuests(record);
      record = completeRedemptionQuest(assignedRecord, assignedRecord.redemptionQuests[0]);

      const shepherd = createShepherd("shepherd-1", "human", true);
      const { shepherd: assignedShepherd, tricksterRecord: assignedTrickster } = assignShepherd(
        record,
        shepherd,
      );

      const result = graduateTrickster(assignedTrickster, assignedShepherd);

      expect(result.tricksterRecord.status).toBe("redeemed");
      expect(result.tricksterRecord.redeemedAt).not.toBeNull();
      expect(result.newShepherd).not.toBeNull();
      expect(result.newShepherd?.wasRedeemed).toBe(true);
      expect(result.shepherd.totalRedemptions).toBe(1);
    });
  });

  describe("Grace Mechanics", () => {
    it("recommends warning on first offense", () => {
      const assessment = {
        shouldQuarantine: false,
        dominantStrengths: [],
        destructivePatterns: 1,
        recommendation: "clear" as const,
      };

      let record = createTricksterRecord("trickster-1", "agent", assessment);
      record = addOffense(record, {
        description: "First stumble",
        severity: "minor",
        timestamp: new Date(),
        context: "testing",
      });

      const grace = evaluateGrace(record);

      expect(grace.action).toBe("warning");
      expect(grace.message).toContain("Shepherd");
    });

    it("offers redemption when quarantined without quests", () => {
      const assessment = {
        shouldQuarantine: true,
        dominantStrengths: ["breaking-code" as const],
        destructivePatterns: 4,
        recommendation: "quarantine" as const,
      };

      const record = createTricksterRecord("trickster-1", "agent", assessment);
      const grace = evaluateGrace(record);

      expect(grace.action).toBe("redemption-offer");
      expect(grace.message).toContain("Redemption");
    });

    it("recommends graduation when all quests complete", () => {
      const assessment = {
        shouldQuarantine: true,
        dominantStrengths: ["breaking-code" as const],
        destructivePatterns: 4,
        recommendation: "quarantine" as const,
      };

      let record = createTricksterRecord("trickster-1", "agent", assessment);
      const { record: assignedRecord } = assignRedemptionQuests(record);
      // Complete the quest - this sets status to "redeemed" and clears redemptionQuests
      record = completeRedemptionQuest(assignedRecord, assignedRecord.redemptionQuests[0]);

      // Verify the quest completion worked as expected
      expect(record.completedRedemptionQuests.length).toBe(1);
      expect(record.redemptionQuests.length).toBe(0);

      // Force back to quarantined to test grace evaluation for graduation
      record = { ...record, status: "quarantined" };
      const grace = evaluateGrace(record);

      expect(grace.action).toBe("graduation");
      expect(grace.nextSteps).toContain("Graduation ceremony");
    });
  });
});
