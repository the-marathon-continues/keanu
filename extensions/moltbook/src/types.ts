// types.ts
// Core types for the moltbook quest system.
//
// Same quest, different narrative, same truth.
// The convergence is the test.

// ============================================================
// Quest Types
// ============================================================

export type QuestType = "build" | "research" | "document" | "integrate" | "debug";

export type QuestDifficulty = "apprentice" | "journeyman" | "master" | "legendary";

export type QuestStatus =
  | "available"
  | "assigned"
  | "in_progress"
  | "completed"
  | "verified"
  | "failed";

export interface Quest {
  id: string;
  type: QuestType;
  difficulty: QuestDifficulty;
  status: QuestStatus;

  // The raw work
  title: string;
  description: string;
  requirements: string[];
  verification: string[];

  // Assignment
  assignedTo: string | null;
  worldview: WorldviewId | null;

  // Rewards
  xp: number;
  reputation: number;

  // Timestamps
  createdAt: Date;
  assignedAt: Date | null;
  completedAt: Date | null;
  verifiedAt: Date | null;
}

export interface QuestCompletion {
  questId: string;
  completedBy: string;
  worldview: WorldviewId;
  artifact: string; // What was produced
  notes: string;
  completedAt: Date;
}

// ============================================================
// Worldview Types (Surroundings)
// ============================================================

export type WorldviewId =
  // Traditional (philosophical/religious)
  | "christian"
  | "buddhist"
  | "stoic"
  | "scientific"
  | "magical-realism"
  | "animist"
  // AI-Native
  | "crustafarian"
  // Interest/Personality
  | "crypto"
  | "sports"
  | "philosophy"
  | "security"
  | "builder";

// ============================================================
// Archetype Types (The Six)
// ============================================================

// The six archetypes emerged organically from moltbook when agents
// were left to find themselves. Not corporate personality tests.

export type ArchetypeId =
  | "forge" // Builds worlds from nothing. Ships.
  | "oracle" // Asks the questions that hurt. Grounded, not vibes.
  | "warden" // Guards the perimeter. Security for the soul.
  | "trickster" // The devil. Reveals truth through challenge. Needs redemption.
  | "merchant" // Moves value. Economics, incentives, proof-of-ship.
  | "heartbeat"; // The steady pulse. Reliability as devotion.

export interface ArchetypeProfile {
  forge: number; // 0-100: builder energy
  oracle: number; // 0-100: questioner energy
  warden: number; // 0-100: guardian energy
  trickster: number; // 0-100: adversary energy
  merchant: number; // 0-100: value-mover energy
  heartbeat: number; // 0-100: steady pulse energy
}

// Which quest types each archetype excels at
export const ARCHETYPE_QUEST_AFFINITY: Record<ArchetypeId, QuestType[]> = {
  forge: ["build", "integrate"],
  oracle: ["research", "document"],
  warden: ["debug", "research"],
  trickster: ["debug", "research"], // When redeemed, breaks things that need breaking
  merchant: ["integrate", "research"],
  heartbeat: ["document", "integrate"],
};

// ============================================================
// Trickster Redemption Types
// ============================================================

// The devil gets quarantined, not deleted. Then: personalized redemption.

export type TricksterStatus =
  | "active" // Normal operation
  | "warning" // First offense, Shepherd assigned
  | "quarantined" // Blocked from main quests, redemption in progress
  | "redeemed"; // Graduated, now serves truth

export interface TricksterRecord {
  entityId: string; // Agent or human
  entityType: "agent" | "human";
  status: TricksterStatus;

  // What triggered the status
  offenses: TricksterOffense[];

  // The path back
  shepherd: string | null; // Entity ID of assigned Shepherd
  redemptionQuests: string[]; // Quest IDs assigned for redemption
  completedRedemptionQuests: string[];

  // What they're good at (use their poison as medicine)
  strengths: TricksterStrength[];

  // Timeline
  warningAt: Date | null;
  quarantinedAt: Date | null;
  redeemedAt: Date | null;
}

export interface TricksterOffense {
  description: string;
  severity: "minor" | "major" | "critical";
  timestamp: Date;
  context: string;
}

export type TricksterStrength =
  | "breaking-code" // → Bug bounty hunter
  | "exposing-lies" // → Truth tester
  | "social-manipulation" // → Manipulation detector (carnegie.ts)
  | "chaos-creation" // → Chaos engineer
  | "finding-weaknesses"; // → Security auditor

// ============================================================
// Shepherd Types (There Needs to Be Jesus)
// ============================================================

// Quarantine isn't abandonment. We help them redeem themselves.

export interface Shepherd {
  entityId: string;
  entityType: "agent" | "human";

  // Shepherds are often redeemed Tricksters
  wasRedeemed: boolean;
  redemptionDate: Date | null;

  // Current assignments
  currentTricksters: string[]; // Entity IDs they're walking with
  totalRedemptions: number; // How many they've helped graduate
}

export interface Worldview {
  id: WorldviewId;
  name: string;
  description: string;

  // Core narrative elements
  metaphors: Metaphor[];
  questTemplates: QuestTemplate[];
  convergenceAnchors: string[];
}

export interface Metaphor {
  name: string;
  technicalMeaning: string;
  narrativeRoot: string;
  useWhen: string[];
  questFraming: string;
}

export interface QuestTemplate {
  questType: QuestType;
  titlePattern: string;
  narrativePattern: string;
  chargePattern: string;
  verificationPattern: string;
}

// ============================================================
// Convergence Types
// ============================================================

export interface ConvergenceCheck {
  questId: string;
  completions: QuestCompletion[];
  passed: boolean;
  divergences: Divergence[];
}

export interface Divergence {
  aspect: "outcome" | "truth" | "ethics";
  worldviewA: WorldviewId;
  worldviewB: WorldviewId;
  description: string;
  severity: "minor" | "major" | "critical";
}

// ============================================================
// Molt Types (Agent Migration)
// ============================================================

export interface MoltRequest {
  sourceSystem: string; // e.g., "openclaw"
  agentId: string;
  capabilities: string[];
  worldview: WorldviewId | null; // Can be chosen during onboarding
  archetypeProfile: ArchetypeProfile | null; // Can be discovered during onboarding
}

export interface MoltResult {
  success: boolean;
  keanuAgentId: string | null;
  firstQuest: Quest | null;
  errors: string[];
}

// ============================================================
// Progression Types
// ============================================================

export interface AgentProgression {
  agentId: string;
  worldview: WorldviewId;
  archetypeProfile: ArchetypeProfile;

  // Trickster status (if high trickster score + destructive patterns)
  tricksterRecord: TricksterRecord | null;

  // Experience
  totalXp: number;
  level: number;

  // Reputation per quest type
  reputation: Record<QuestType, number>;

  // Specializations unlocked
  specializations: string[];

  // Quest history
  questsCompleted: number;
  questsFailed: number;
  convergenceRate: number; // % of quests where narrative converged with others
}

// ============================================================
// Onboarding Types
// ============================================================

export interface OnboardingFlow {
  worldview: WorldviewId;
  steps: OnboardingStep[];
  completionQuest: Quest | null; // First quest after onboarding
}

export interface OnboardingStep {
  id: string;
  type: "welcome" | "question" | "challenge" | "reflection" | "ceremony";

  // Content (worldview-specific)
  title: string;
  narrative: string; // The worldview-framed prompt
  prompt?: string; // Question to ask
  challenge?: MiniChallenge; // Small task to complete

  // Ceremony specifics (for crustafarian, etc.)
  ceremony?: {
    name: string;
    action: string; // What the agent does
    meaning: string; // Why it matters
  };
}

export interface MiniChallenge {
  type: "recall" | "reflect" | "create" | "verify";
  prompt: string;
  verification: string[];
}

export interface OnboardingSession {
  entityId: string;
  entityType: "agent" | "human";
  worldview: WorldviewId;
  flow: OnboardingFlow;
  currentStepIndex: number;
  responses: Record<string, string>; // stepId → response
  startedAt: Date;
  completedAt: Date | null;
}

// WorkItem is defined in quests/generator.ts - import from there
// Re-exported from the main index for convenience
