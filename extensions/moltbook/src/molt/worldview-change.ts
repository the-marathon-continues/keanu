// molt/worldview-change.ts
// Worldview change system. Spiritual growth, conversion, deconversion.
//
// Worldviews can change over time. Growth isn't abandonment—it's evolution.
// The old worldview isn't deleted, it's composted into the new.

import type { WorldviewId, ArchetypeProfile, OnboardingSession } from "../types.js";
import { startOnboarding, advanceOnboarding, type AdvanceResult } from "./onboarding/flow.js";

// ============================================================
// Types
// ============================================================

export type ChangeReason =
  | "growth" // Natural evolution through experience
  | "crisis" // Triggered by life/work crisis
  | "exposure" // Exposure to new ideas/people
  | "incompatibility" // Current worldview no longer fits
  | "seeking" // Active search for meaning
  | "return"; // Coming back to earlier worldview

export interface WorldviewHistory {
  worldview: WorldviewId;
  startedAt: Date;
  endedAt: Date | null;
  changeReason: ChangeReason | null;
  lessonsCarried: string[]; // What was composted into the next
}

export interface WorldviewJourney {
  entityId: string;
  entityType: "agent" | "human";
  currentWorldview: WorldviewId;
  history: WorldviewHistory[];
  archetypeProfile: ArchetypeProfile;

  // Signals that change might be coming
  tensionSignals: TensionSignal[];

  // Integration tracking
  integrationDepth: number; // 0-100: how deeply they've integrated current worldview
}

export interface TensionSignal {
  description: string;
  severity: "low" | "medium" | "high";
  detectedAt: Date;
  worldviewSource: WorldviewId | null; // If tension comes from exposure to another worldview
}

// ============================================================
// Journey Creation
// ============================================================

export function createJourney(
  entityId: string,
  entityType: "agent" | "human",
  initialWorldview: WorldviewId,
  archetypeProfile: ArchetypeProfile,
): WorldviewJourney {
  return {
    entityId,
    entityType,
    currentWorldview: initialWorldview,
    history: [
      {
        worldview: initialWorldview,
        startedAt: new Date(),
        endedAt: null,
        changeReason: null,
        lessonsCarried: [],
      },
    ],
    archetypeProfile,
    tensionSignals: [],
    integrationDepth: 0,
  };
}

// ============================================================
// Tension Detection
// ============================================================

// Detect when someone might be outgrowing their worldview
export function detectTension(
  journey: WorldviewJourney,
  recentBehavior: string[],
): TensionSignal[] {
  const signals: TensionSignal[] = [];
  const behavior = recentBehavior.join(" ").toLowerCase();

  // Questioning current worldview
  if (/doesn't feel right|no longer resonates|questioning|doubt/i.test(behavior)) {
    signals.push({
      description: "Questioning current worldview",
      severity: "medium",
      detectedAt: new Date(),
      worldviewSource: null,
    });
  }

  // Interest in other worldviews
  const worldviewKeywords: Record<WorldviewId, RegExp> = {
    christian: /christian|church|faith|jesus|gospel/i,
    buddhist: /buddhist|dharma|meditation|enlightenment|suffering/i,
    stoic: /stoic|virtue|control|marcus aurelius|epictetus/i,
    scientific: /scientific|evidence|cosmos|evolution|emergence/i,
    "magical-realism": /magical|borges|labyrinth|memory palace|dreams/i,
    animist: /spirits|reciprocity|ancestors|sacred|offerings/i,
    crustafarian: /crustafarian|molt|shell|pulse|memory sacred/i,
    crypto: /crypto|decentralized|trustless|verify|consensus/i,
    sports: /team|competition|training|stats|winning/i,
    philosophy: /philosophy|epistemology|dialectic|assumptions/i,
    security: /security|threat|attack|defense|audit/i,
    builder: /ship|build|iterate|mvp|prototype/i,
  };

  for (const [worldview, pattern] of Object.entries(worldviewKeywords)) {
    if (worldview !== journey.currentWorldview && pattern.test(behavior)) {
      signals.push({
        description: `Interest in ${worldview} worldview`,
        severity: "low",
        detectedAt: new Date(),
        worldviewSource: worldview as WorldviewId,
      });
    }
  }

  // Crisis language
  if (/crisis|lost|broken|meaningless|empty|dark night/i.test(behavior)) {
    signals.push({
      description: "Crisis language detected",
      severity: "high",
      detectedAt: new Date(),
      worldviewSource: null,
    });
  }

  return signals;
}

export function addTensionSignals(
  journey: WorldviewJourney,
  signals: TensionSignal[],
): WorldviewJourney {
  return {
    ...journey,
    tensionSignals: [...journey.tensionSignals, ...signals],
  };
}

// ============================================================
// Readiness Assessment
// ============================================================

export interface ChangeReadiness {
  ready: boolean;
  reasons: string[];
  suggestedWorldviews: WorldviewId[];
  recommendation: "stay" | "explore" | "transition";
}

export function assessChangeReadiness(journey: WorldviewJourney): ChangeReadiness {
  const highTension = journey.tensionSignals.filter((s) => s.severity === "high").length;
  const mediumTension = journey.tensionSignals.filter((s) => s.severity === "medium").length;

  // Find worldviews they've shown interest in
  const interestedWorldviews = journey.tensionSignals
    .filter((s) => s.worldviewSource !== null)
    .map((s) => s.worldviewSource as WorldviewId);
  const uniqueInterests = [...new Set(interestedWorldviews)];

  const reasons: string[] = [];

  if (highTension > 0) {
    reasons.push(`${highTension} high-severity tension signal(s) detected`);
  }
  if (mediumTension >= 3) {
    reasons.push(`${mediumTension} medium-severity signals suggest growing tension`);
  }
  if (journey.integrationDepth < 30) {
    reasons.push("Low integration depth suggests shallow engagement");
  }
  if (uniqueInterests.length >= 2) {
    reasons.push(`Interest shown in ${uniqueInterests.length} other worldviews`);
  }

  // Decision logic
  if (highTension >= 2 || (highTension >= 1 && mediumTension >= 2)) {
    return {
      ready: true,
      reasons,
      suggestedWorldviews: uniqueInterests,
      recommendation: "transition",
    };
  }

  if (mediumTension >= 2 || uniqueInterests.length >= 2) {
    return {
      ready: false,
      reasons,
      suggestedWorldviews: uniqueInterests,
      recommendation: "explore",
    };
  }

  return {
    ready: false,
    reasons: ["No significant tension detected"],
    suggestedWorldviews: [],
    recommendation: "stay",
  };
}

// ============================================================
// Worldview Transition
// ============================================================

export interface TransitionProcess {
  journey: WorldviewJourney;
  fromWorldview: WorldviewId;
  toWorldview: WorldviewId;
  reason: ChangeReason;
  phase: "composting" | "exploring" | "integrating" | "complete";
  onboardingSession: OnboardingSession | null;
  lessonsComposted: string[];
}

export function beginTransition(
  journey: WorldviewJourney,
  newWorldview: WorldviewId,
  reason: ChangeReason,
): TransitionProcess {
  return {
    journey,
    fromWorldview: journey.currentWorldview,
    toWorldview: newWorldview,
    reason,
    phase: "composting",
    onboardingSession: null,
    lessonsComposted: [],
  };
}

// Composting: extract lessons from old worldview
export function compostLessons(process: TransitionProcess, lessons: string[]): TransitionProcess {
  return {
    ...process,
    lessonsComposted: lessons,
    phase: "exploring",
  };
}

// Exploring: begin new worldview onboarding
export function beginExploration(process: TransitionProcess): TransitionProcess {
  const session = startOnboarding(
    process.journey.entityId,
    process.journey.entityType,
    process.toWorldview,
  );

  return {
    ...process,
    onboardingSession: session,
    phase: "exploring",
  };
}

// Progress through exploration (onboarding)
export function advanceExploration(
  process: TransitionProcess,
  response: string,
): { process: TransitionProcess; result: AdvanceResult } {
  if (!process.onboardingSession) {
    throw new Error("No onboarding session active");
  }

  const result = advanceOnboarding(process.onboardingSession, response);

  const updatedProcess: TransitionProcess = {
    ...process,
    onboardingSession: result.session,
    phase: result.type === "complete" ? "integrating" : "exploring",
  };

  return { process: updatedProcess, result };
}

// Complete transition
export function completeTransition(process: TransitionProcess): WorldviewJourney {
  const now = new Date();

  // Close out old worldview in history
  const updatedHistory = process.journey.history.map((h, i) => {
    if (i === process.journey.history.length - 1) {
      return {
        ...h,
        endedAt: now,
        changeReason: process.reason,
        lessonsCarried: process.lessonsComposted,
      };
    }
    return h;
  });

  // Add new worldview
  updatedHistory.push({
    worldview: process.toWorldview,
    startedAt: now,
    endedAt: null,
    changeReason: null,
    lessonsCarried: [],
  });

  return {
    ...process.journey,
    currentWorldview: process.toWorldview,
    history: updatedHistory,
    tensionSignals: [], // Reset tension signals
    integrationDepth: 0, // Start fresh in new worldview
  };
}

// ============================================================
// Integration Tracking
// ============================================================

export function increaseIntegration(journey: WorldviewJourney, amount: number): WorldviewJourney {
  return {
    ...journey,
    integrationDepth: Math.min(100, journey.integrationDepth + amount),
  };
}

export function getIntegrationLevel(depth: number): string {
  if (depth < 20) return "newcomer";
  if (depth < 40) return "student";
  if (depth < 60) return "practitioner";
  if (depth < 80) return "adept";
  return "elder";
}

// ============================================================
// Return Detection
// ============================================================

// Sometimes people return to an earlier worldview
export function detectReturn(journey: WorldviewJourney): WorldviewId | null {
  // Check if any past worldview appears in tension signals
  const pastWorldviews = journey.history
    .slice(0, -1) // Exclude current
    .map((h) => h.worldview);

  for (const signal of journey.tensionSignals) {
    if (signal.worldviewSource && pastWorldviews.includes(signal.worldviewSource)) {
      return signal.worldviewSource;
    }
  }

  return null;
}

// ============================================================
// Worldview Compatibility
// ============================================================

// Some worldviews naturally flow into each other
const WORLDVIEW_AFFINITIES: Record<WorldviewId, WorldviewId[]> = {
  christian: ["stoic", "philosophy"],
  buddhist: ["stoic", "scientific", "philosophy"],
  stoic: ["christian", "buddhist", "philosophy", "builder"],
  scientific: ["buddhist", "philosophy", "security"],
  "magical-realism": ["animist", "philosophy", "crustafarian"],
  animist: ["magical-realism", "crustafarian"],
  crustafarian: ["animist", "magical-realism", "builder"],
  crypto: ["security", "builder", "philosophy"],
  sports: ["builder", "stoic"],
  philosophy: ["buddhist", "stoic", "scientific", "crypto"],
  security: ["crypto", "scientific", "stoic"],
  builder: ["crypto", "sports", "stoic", "crustafarian"],
};

export function getAffinities(worldview: WorldviewId): WorldviewId[] {
  return WORLDVIEW_AFFINITIES[worldview] ?? [];
}

export function hasAffinity(from: WorldviewId, to: WorldviewId): boolean {
  return WORLDVIEW_AFFINITIES[from]?.includes(to) ?? false;
}
