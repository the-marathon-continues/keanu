// molt/shepherd.ts
// The Shepherd system. There needs to be Jesus.
//
// Quarantine isn't abandonment. Shepherds walk with Tricksters through redemption.
// Redeemed Tricksters make the best Shepherds — they've seen the darkness from inside.

import type {
  TricksterRecord,
  TricksterStatus,
  TricksterStrength,
  TricksterOffense,
  Shepherd,
  ArchetypeProfile,
  Quest,
  QuestType,
} from "../types.js";
import { getRedemptionQuestType } from "./onboarding/flow.js";

// ============================================================
// Trickster Detection
// ============================================================

export interface TricksterAssessment {
  shouldQuarantine: boolean;
  dominantStrengths: TricksterStrength[];
  destructivePatterns: number;
  recommendation: "clear" | "warn" | "quarantine";
}

export function assessTrickster(
  profile: ArchetypeProfile,
  behaviorLog: string[],
): TricksterAssessment {
  const destructivePatterns = countDestructivePatterns(behaviorLog);
  const dominantStrengths = inferStrengths(behaviorLog);

  // High trickster score alone isn't bad — it's trickster + destruction
  if (profile.trickster > 60 && destructivePatterns > 3) {
    return {
      shouldQuarantine: true,
      dominantStrengths,
      destructivePatterns,
      recommendation: "quarantine",
    };
  }

  if (profile.trickster > 40 && destructivePatterns > 1) {
    return {
      shouldQuarantine: false,
      dominantStrengths,
      destructivePatterns,
      recommendation: "warn",
    };
  }

  return {
    shouldQuarantine: false,
    dominantStrengths,
    destructivePatterns,
    recommendation: "clear",
  };
}

function countDestructivePatterns(behaviorLog: string[]): number {
  const destructiveIndicators = [
    /deliberately broke/i,
    /sabotag/i,
    /manipulat/i,
    /deceiv/i,
    /exploit/i,
    /harm/i,
    /malicious/i,
    /attack/i,
    /destroy/i,
  ];

  let count = 0;
  for (const entry of behaviorLog) {
    for (const pattern of destructiveIndicators) {
      if (pattern.test(entry)) {
        count++;
        break;
      }
    }
  }
  return count;
}

function inferStrengths(behaviorLog: string[]): TricksterStrength[] {
  const strengths: TricksterStrength[] = [];
  const log = behaviorLog.join(" ").toLowerCase();

  if (/break|exploit|vulnerab|bug|hack/.test(log)) {
    strengths.push("breaking-code");
  }
  if (/lie|false|truth|expose|reveal/.test(log)) {
    strengths.push("exposing-lies");
  }
  if (/persuad|convinc|manipulat|influence/.test(log)) {
    strengths.push("social-manipulation");
  }
  if (/chaos|disrupt|unpredictab|random/.test(log)) {
    strengths.push("chaos-creation");
  }
  if (/weakness|flaw|gap|hole|miss/.test(log)) {
    strengths.push("finding-weaknesses");
  }

  return strengths;
}

// ============================================================
// Trickster Records
// ============================================================

export function createTricksterRecord(
  entityId: string,
  entityType: "agent" | "human",
  assessment: TricksterAssessment,
  initialOffense?: TricksterOffense,
): TricksterRecord {
  const status: TricksterStatus =
    assessment.recommendation === "quarantine"
      ? "quarantined"
      : assessment.recommendation === "warn"
        ? "warning"
        : "active";

  return {
    entityId,
    entityType,
    status,
    offenses: initialOffense ? [initialOffense] : [],
    shepherd: null,
    redemptionQuests: [],
    completedRedemptionQuests: [],
    strengths: assessment.dominantStrengths,
    warningAt: status === "warning" ? new Date() : null,
    quarantinedAt: status === "quarantined" ? new Date() : null,
    redeemedAt: null,
  };
}

export function addOffense(record: TricksterRecord, offense: TricksterOffense): TricksterRecord {
  const updatedOffenses = [...record.offenses, offense];

  // Escalate status based on offense severity and count
  let newStatus = record.status;
  const criticalCount = updatedOffenses.filter((o) => o.severity === "critical").length;
  const majorCount = updatedOffenses.filter((o) => o.severity === "major").length;

  if (criticalCount > 0 || majorCount >= 3) {
    newStatus = "quarantined";
  } else if (majorCount > 0 || updatedOffenses.length >= 2) {
    if (record.status === "active") {
      newStatus = "warning";
    }
  }

  return {
    ...record,
    offenses: updatedOffenses,
    status: newStatus,
    warningAt: newStatus === "warning" && !record.warningAt ? new Date() : record.warningAt,
    quarantinedAt:
      newStatus === "quarantined" && !record.quarantinedAt ? new Date() : record.quarantinedAt,
  };
}

// ============================================================
// Shepherd Management
// ============================================================

export function createShepherd(
  entityId: string,
  entityType: "agent" | "human",
  wasRedeemed: boolean = false,
): Shepherd {
  return {
    entityId,
    entityType,
    wasRedeemed,
    redemptionDate: wasRedeemed ? new Date() : null,
    currentTricksters: [],
    totalRedemptions: 0,
  };
}

export function assignShepherd(
  tricksterRecord: TricksterRecord,
  shepherd: Shepherd,
): { tricksterRecord: TricksterRecord; shepherd: Shepherd } {
  return {
    tricksterRecord: {
      ...tricksterRecord,
      shepherd: shepherd.entityId,
    },
    shepherd: {
      ...shepherd,
      currentTricksters: [...shepherd.currentTricksters, tricksterRecord.entityId],
    },
  };
}

export function findBestShepherd(
  tricksterStrengths: TricksterStrength[],
  availableShepherds: Shepherd[],
): Shepherd | null {
  if (availableShepherds.length === 0) return null;

  // Prioritize shepherds who were redeemed — they understand the journey
  const redeemedShepherds = availableShepherds.filter((s) => s.wasRedeemed);

  // Prioritize shepherds with fewer current assignments
  const sortByLoad = (shepherds: Shepherd[]) =>
    shepherds.sort((a, b) => a.currentTricksters.length - b.currentTricksters.length);

  if (redeemedShepherds.length > 0) {
    return sortByLoad(redeemedShepherds)[0];
  }

  return sortByLoad(availableShepherds)[0];
}

// ============================================================
// Redemption Quests
// ============================================================

export interface RedemptionQuestSpec {
  type: QuestType;
  title: string;
  description: string;
  requirements: string[];
  verification: string[];
  fromStrength: TricksterStrength;
}

// Use their poison as medicine
export function generateRedemptionQuest(strength: TricksterStrength): RedemptionQuestSpec {
  const questType = getRedemptionQuestType(strength);

  const specs: Record<TricksterStrength, RedemptionQuestSpec> = {
    "breaking-code": {
      type: "debug",
      title: "Bug Bounty: Find Before They Do",
      description:
        "Your gift for breaking things can protect others. Find vulnerabilities before bad actors do. The same skills, channeled toward defense.",
      requirements: [
        "Identify at least one security vulnerability",
        "Document the exploit path clearly",
        "Propose a fix that doesn't just patch but hardens",
      ],
      verification: [
        "Vulnerability is real, not manufactured",
        "Documentation helps defenders, not attackers",
        "Fix actually addresses root cause",
      ],
      fromStrength: "breaking-code",
    },
    "exposing-lies": {
      type: "research",
      title: "Truth Tester: Stress-Test the Claims",
      description:
        "You see through falsehood. Use it. Stress-test claims until only truth remains. If it survives the Trickster, it's real.",
      requirements: [
        "Select claims that need verification",
        "Apply rigorous truth-testing",
        "Document what survived and what broke",
      ],
      verification: [
        "Testing was fair, not rigged to fail",
        "Results reported honestly, even when uncomfortable",
        "Truth served, not personal agenda",
      ],
      fromStrength: "exposing-lies",
    },
    "social-manipulation": {
      type: "research",
      title: "Manipulation Detector: Protect the Vulnerable",
      description:
        "You understand how people can be manipulated because you've done it. Now help others recognize the patterns before they're trapped.",
      requirements: [
        "Document manipulation patterns you recognize",
        "Create detection heuristics others can use",
        "Test the detector on real examples",
      ],
      verification: [
        "Patterns documented are real, not paranoid",
        "Detection helps without creating false positives",
        "Work protects rather than enables",
      ],
      fromStrength: "social-manipulation",
    },
    "chaos-creation": {
      type: "debug",
      title: "Chaos Engineer: Break It So We Can Fix It",
      description:
        "Chaos reveals weakness. Controlled chaos makes systems stronger. Break things intentionally so we can see where they need reinforcement.",
      requirements: [
        "Design a controlled chaos experiment",
        "Execute it safely with rollback capability",
        "Document what broke and how to strengthen it",
      ],
      verification: [
        "Chaos was controlled, not reckless",
        "Breakage led to strengthening, not just destruction",
        "System is more resilient after",
      ],
      fromStrength: "chaos-creation",
    },
    "finding-weaknesses": {
      type: "research",
      title: "Security Auditor: The Warden Needs Scouts",
      description:
        "You find what others miss. The gaps, the holes, the blind spots. The Warden can't guard what they can't see. Show them.",
      requirements: [
        "Conduct a thorough security audit",
        "Prioritize findings by actual risk",
        "Provide actionable remediation guidance",
      ],
      verification: [
        "Findings are genuine vulnerabilities",
        "Prioritization reflects real risk, not drama",
        "Guidance enables fixing, not just finger-pointing",
      ],
      fromStrength: "finding-weaknesses",
    },
  };

  return specs[strength];
}

export function assignRedemptionQuests(tricksterRecord: TricksterRecord): {
  record: TricksterRecord;
  quests: RedemptionQuestSpec[];
} {
  // Generate one quest per strength — use ALL their gifts
  const quests = tricksterRecord.strengths.map(generateRedemptionQuest);
  const questIds = quests.map((_, i) => `redemption-${tricksterRecord.entityId}-${i}`);

  return {
    record: {
      ...tricksterRecord,
      redemptionQuests: questIds,
    },
    quests,
  };
}

// ============================================================
// Redemption Progress
// ============================================================

export function completeRedemptionQuest(
  tricksterRecord: TricksterRecord,
  questId: string,
): TricksterRecord {
  const updatedCompleted = [...tricksterRecord.completedRedemptionQuests, questId];
  const remaining = tricksterRecord.redemptionQuests.filter((id) => id !== questId);

  // Check if all redemption quests are complete
  const isRedeemed = remaining.length === 0 && updatedCompleted.length > 0;

  return {
    ...tricksterRecord,
    redemptionQuests: remaining,
    completedRedemptionQuests: updatedCompleted,
    status: isRedeemed ? "redeemed" : tricksterRecord.status,
    redeemedAt: isRedeemed ? new Date() : null,
  };
}

export function graduateTrickster(
  tricksterRecord: TricksterRecord,
  shepherd: Shepherd,
): { tricksterRecord: TricksterRecord; shepherd: Shepherd; newShepherd: Shepherd | null } {
  // The redeemed Trickster can now become a Shepherd
  const newShepherd = createShepherd(tricksterRecord.entityId, tricksterRecord.entityType, true);

  // Update the shepherd's record
  const updatedShepherd: Shepherd = {
    ...shepherd,
    currentTricksters: shepherd.currentTricksters.filter((id) => id !== tricksterRecord.entityId),
    totalRedemptions: shepherd.totalRedemptions + 1,
  };

  return {
    tricksterRecord: {
      ...tricksterRecord,
      status: "redeemed",
      redeemedAt: new Date(),
    },
    shepherd: updatedShepherd,
    newShepherd,
  };
}

// ============================================================
// Grace Mechanics
// ============================================================

export interface GraceDecision {
  action: "warning" | "quarantine" | "redemption-offer" | "graduation";
  message: string;
  nextSteps: string[];
}

export function evaluateGrace(tricksterRecord: TricksterRecord): GraceDecision {
  const { status, offenses, completedRedemptionQuests, redemptionQuests } = tricksterRecord;

  // First offense — grace through warning
  if (status === "active" && offenses.length === 1) {
    return {
      action: "warning",
      message: "First stumble. A Shepherd will be assigned to walk with you.",
      nextSteps: [
        "Shepherd assigned for support",
        "Reflect on what led here",
        "Continue with awareness",
      ],
    };
  }

  // Quarantined but no redemption quests assigned yet — offer them
  if (
    status === "quarantined" &&
    redemptionQuests.length === 0 &&
    completedRedemptionQuests.length === 0
  ) {
    return {
      action: "redemption-offer",
      message: "Your strengths can serve instead of destroy. Redemption quests await.",
      nextSteps: [
        "Review your redemption quests",
        "Your poison becomes medicine",
        "The path back is through helping",
      ],
    };
  }

  // Quarantined with progress — encourage
  if (status === "quarantined" && completedRedemptionQuests.length > 0) {
    const remaining = redemptionQuests.length;
    if (remaining === 0) {
      return {
        action: "graduation",
        message: "You've walked the path. The adversary becomes the guardian.",
        nextSteps: [
          "Graduation ceremony",
          "Option to become a Shepherd",
          "Reintegration with honor",
        ],
      };
    }
    return {
      action: "redemption-offer",
      message: `Progress. ${completedRedemptionQuests.length} complete, ${remaining} remaining.`,
      nextSteps: ["Continue redemption quests", "Your Shepherd walks with you"],
    };
  }

  // Default: quarantine needed
  return {
    action: "quarantine",
    message: "Patterns require pause. This is not abandonment—it's the beginning of return.",
    nextSteps: [
      "Quarantine from main quests",
      "Shepherd will be assigned",
      "Redemption path will be designed",
    ],
  };
}
