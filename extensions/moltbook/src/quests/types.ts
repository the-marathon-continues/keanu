// quests/types.ts
// Quest generation and management.

import type { Quest, QuestType, QuestDifficulty, QuestStatus } from "../types.js";

// ============================================================
// Quest Creation
// ============================================================

export interface CreateQuestInput {
  type: QuestType;
  difficulty: QuestDifficulty;
  title: string;
  description: string;
  requirements: string[];
  verification: string[];
  xp?: number;
  reputation?: number;
}

// Default XP by difficulty
export const XP_BY_DIFFICULTY: Record<QuestDifficulty, number> = {
  apprentice: 10,
  journeyman: 25,
  master: 50,
  legendary: 100,
};

// Default reputation by difficulty
export const REP_BY_DIFFICULTY: Record<QuestDifficulty, number> = {
  apprentice: 1,
  journeyman: 3,
  master: 7,
  legendary: 15,
};

export function createQuest(input: CreateQuestInput): Quest {
  return {
    id: crypto.randomUUID(),
    type: input.type,
    difficulty: input.difficulty,
    status: "available",
    title: input.title,
    description: input.description,
    requirements: input.requirements,
    verification: input.verification,
    assignedTo: null,
    worldview: null,
    xp: input.xp ?? XP_BY_DIFFICULTY[input.difficulty],
    reputation: input.reputation ?? REP_BY_DIFFICULTY[input.difficulty],
    createdAt: new Date(),
    assignedAt: null,
    completedAt: null,
    verifiedAt: null,
  };
}

// ============================================================
// Quest Status Transitions
// ============================================================

export type QuestTransition =
  | { type: "assign"; agentId: string; worldview: string }
  | { type: "start" }
  | { type: "complete"; artifact: string; notes: string }
  | { type: "verify"; passed: boolean }
  | { type: "fail"; reason: string };

const VALID_TRANSITIONS: Record<QuestStatus, QuestStatus[]> = {
  available: ["assigned"],
  assigned: ["in_progress", "available"], // Can unassign
  in_progress: ["completed", "failed"],
  completed: ["verified", "failed"],
  verified: [], // Terminal
  failed: ["available"], // Can retry
};

export function canTransition(from: QuestStatus, to: QuestStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
