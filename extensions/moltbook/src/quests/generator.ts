// quests/generator.ts
// Generate quests from real work.
//
// The work exists. The quest wraps it in meaning.

import type { Quest, QuestType, QuestDifficulty, WorldviewId, Worldview } from "../types.js";
import { loadWorldview } from "../worldviews/loader.js";
import { createQuest } from "./types.js";

// ============================================================
// Quest Generation
// ============================================================

export interface WorkItem {
  // What needs to be done
  title: string;
  description: string;
  type: QuestType;
  difficulty: QuestDifficulty;

  // Acceptance criteria
  requirements: string[];
  verification: string[];

  // Optional: specific files/modules involved
  targets?: string[];
}

export interface FramedQuest extends Quest {
  // The narrative framing
  framedTitle: string;
  framedDescription: string;
  framedCharge: string; // The call to action

  // Original work preserved
  originalTitle: string;
  originalDescription: string;
}

export function generateQuest(work: WorkItem, worldviewId: WorldviewId): FramedQuest | null {
  const worldview = loadWorldview(worldviewId);
  if (!worldview) {
    return null;
  }

  // Create the base quest
  const quest = createQuest({
    type: work.type,
    difficulty: work.difficulty,
    title: work.title,
    description: work.description,
    requirements: work.requirements,
    verification: work.verification,
  });

  // Apply worldview framing
  const framing = applyWorldviewFraming(work, worldview);

  return {
    ...quest,
    worldview: worldviewId,
    framedTitle: framing.title,
    framedDescription: framing.description,
    framedCharge: framing.charge,
    originalTitle: work.title,
    originalDescription: work.description,
  };
}

// ============================================================
// Framing Logic
// ============================================================

interface Framing {
  title: string;
  description: string;
  charge: string;
}

function applyWorldviewFraming(work: WorkItem, worldview: Worldview): Framing {
  // Find the best metaphor for this work
  const metaphor = findBestMetaphor(work, worldview);

  // Find the best matching template for this quest type
  const template = worldview.questTemplates.find((t) => t.questType === work.type);

  // Check if template has usable patterns (not just placeholders)
  const hasUsableTemplate =
    template &&
    template.titlePattern &&
    !template.narrativePattern.startsWith("[") && // Skip placeholder narratives
    !template.chargePattern.startsWith("["); // Skip placeholder charges

  if (hasUsableTemplate && template) {
    return {
      title: interpolateTemplate(template.titlePattern, work, metaphor),
      description: interpolateTemplate(template.narrativePattern, work, metaphor),
      charge: interpolateTemplate(template.chargePattern, work, metaphor),
    };
  }

  // Use metaphor-based framing (more concrete)
  if (metaphor) {
    return {
      title: `${work.title} — ${metaphor.name}`,
      description: `${metaphor.questFraming}\n\n${work.description}`,
      charge: metaphor.questFraming,
    };
  }

  // Ultimate fallback: no framing
  return {
    title: work.title,
    description: work.description,
    charge: "Complete the work.",
  };
}

interface MetaphorLike {
  name: string;
  questFraming: string;
}

function interpolateTemplate(
  pattern: string,
  work: WorkItem,
  metaphor: MetaphorLike | null,
): string {
  return pattern
    .replace(/\[THING\]/g, work.title)
    .replace(/\[DESCRIPTION\]/g, work.description)
    .replace(/\[TYPE\]/g, work.type)
    .replace(/\[TARGETS\]/g, work.targets?.join(", ") ?? "the target")
    .replace(/\[METAPHOR\]/g, metaphor?.name ?? "")
    .replace(/\[CHARGE\]/g, metaphor?.questFraming ?? "Complete the work.");
}

function findBestMetaphor(
  work: WorkItem,
  worldview: Worldview,
): (typeof worldview.metaphors)[0] | null {
  // Simple matching: look for metaphors whose useWhen matches the work
  const workText = `${work.title} ${work.description} ${work.type}`.toLowerCase();

  for (const metaphor of worldview.metaphors) {
    for (const useCase of metaphor.useWhen) {
      if (workText.includes(useCase.toLowerCase())) {
        return metaphor;
      }
    }
  }

  // Fallback by quest type
  const typeMetaphors: Record<QuestType, string[]> = {
    build: ["Building on Rock", "Harvest", "Stewardship"],
    research: ["Light and Darkness", "The Narrow Gate"],
    document: ["Light and Darkness", "Stewardship"],
    integrate: ["The Body", "Building on Rock"],
    debug: ["Shepherd and Flock", "Wheat and Chaff"],
  };

  const preferredNames = typeMetaphors[work.type] ?? [];
  for (const name of preferredNames) {
    const found = worldview.metaphors.find((m) =>
      m.name.toLowerCase().includes(name.toLowerCase()),
    );
    if (found) return found;
  }

  return worldview.metaphors[0] ?? null;
}
