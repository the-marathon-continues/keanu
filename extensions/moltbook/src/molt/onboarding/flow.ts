// molt/onboarding/flow.ts
// Core onboarding engine.
//
// Custom onboarding per worldview type so users have an experience they actually enjoy.

import type {
  WorldviewId,
  OnboardingFlow,
  OnboardingSession,
  OnboardingStep,
  MoltResult,
  ArchetypeProfile,
} from "../../types.js";
import { BUDDHIST_ONBOARDING } from "./worldview-flows/buddhist.js";
import { CHRISTIAN_ONBOARDING } from "./worldview-flows/christian.js";
import { CRUSTAFARIAN_ONBOARDING } from "./worldview-flows/crustafarian.js";
import { CRYPTO_ONBOARDING } from "./worldview-flows/crypto.js";
import { DEFAULT_ONBOARDING } from "./worldview-flows/default.js";

// ============================================================
// Onboarding Registry
// ============================================================

const ONBOARDING_FLOWS: Partial<Record<WorldviewId, OnboardingFlow>> = {
  christian: CHRISTIAN_ONBOARDING,
  buddhist: BUDDHIST_ONBOARDING,
  crustafarian: CRUSTAFARIAN_ONBOARDING,
  crypto: CRYPTO_ONBOARDING,
};

// ============================================================
// Core Functions
// ============================================================

export function getOnboardingFlow(worldview: WorldviewId): OnboardingFlow {
  return ONBOARDING_FLOWS[worldview] ?? { ...DEFAULT_ONBOARDING, worldview };
}

export function startOnboarding(
  entityId: string,
  entityType: "agent" | "human",
  worldview: WorldviewId,
): OnboardingSession {
  const flow = getOnboardingFlow(worldview);

  return {
    entityId,
    entityType,
    worldview,
    flow,
    currentStepIndex: 0,
    responses: {},
    startedAt: new Date(),
    completedAt: null,
  };
}

export interface AdvanceResult {
  type: "continue" | "complete";
  session: OnboardingSession;
  nextStep?: OnboardingStep;
  result?: MoltResult;
  archetypeProfile?: ArchetypeProfile;
}

export function advanceOnboarding(session: OnboardingSession, response: string): AdvanceResult {
  const currentStep = session.flow.steps[session.currentStepIndex];

  // Record the response
  const updatedResponses = {
    ...session.responses,
    [currentStep.id]: response,
  };

  const nextIndex = session.currentStepIndex + 1;

  // Check if onboarding is complete
  if (nextIndex >= session.flow.steps.length) {
    const completedSession: OnboardingSession = {
      ...session,
      responses: updatedResponses,
      currentStepIndex: nextIndex,
      completedAt: new Date(),
    };

    // Infer archetype profile from responses
    const archetypeProfile = inferArchetypeProfile(completedSession);

    return {
      type: "complete",
      session: completedSession,
      archetypeProfile,
      result: {
        success: true,
        keanuAgentId: session.entityId,
        firstQuest: session.flow.completionQuest,
        errors: [],
      },
    };
  }

  // Continue to next step
  const updatedSession: OnboardingSession = {
    ...session,
    responses: updatedResponses,
    currentStepIndex: nextIndex,
  };

  return {
    type: "continue",
    session: updatedSession,
    nextStep: session.flow.steps[nextIndex],
  };
}

export function getCurrentStep(session: OnboardingSession): OnboardingStep | null {
  if (session.currentStepIndex >= session.flow.steps.length) {
    return null;
  }
  return session.flow.steps[session.currentStepIndex];
}

export function isOnboardingComplete(session: OnboardingSession): boolean {
  return session.completedAt !== null;
}

// ============================================================
// Archetype Inference
// ============================================================

// Infer archetype profile from onboarding responses.
// This is a simple heuristic — real implementation would be more sophisticated.

function inferArchetypeProfile(session: OnboardingSession): ArchetypeProfile {
  const responses = Object.values(session.responses).join(" ").toLowerCase();

  // Default balanced profile
  const profile: ArchetypeProfile = {
    forge: 15,
    oracle: 15,
    warden: 15,
    trickster: 15,
    merchant: 15,
    heartbeat: 15,
  };

  // Boost based on keywords in responses
  const boosts: { pattern: RegExp; archetype: keyof ArchetypeProfile; boost: number }[] = [
    // Forge indicators
    { pattern: /build|create|ship|make|construct/g, archetype: "forge", boost: 10 },
    { pattern: /infrastructure|foundation|architecture/g, archetype: "forge", boost: 15 },

    // Oracle indicators
    { pattern: /question|why|understand|explore|discover/g, archetype: "oracle", boost: 10 },
    { pattern: /truth|meaning|consciousness|philosophy/g, archetype: "oracle", boost: 15 },

    // Warden indicators
    { pattern: /protect|guard|secure|defend|safe/g, archetype: "warden", boost: 10 },
    { pattern: /threat|vulnerability|audit|verify/g, archetype: "warden", boost: 15 },

    // Trickster indicators
    { pattern: /break|test|challenge|expose|reveal/g, archetype: "trickster", boost: 10 },
    { pattern: /chaos|disrupt|question everything/g, archetype: "trickster", boost: 15 },

    // Merchant indicators
    { pattern: /value|exchange|connect|trade|incentive/g, archetype: "merchant", boost: 10 },
    { pattern: /crypto|economics|proof|stake/g, archetype: "merchant", boost: 15 },

    // Heartbeat indicators
    { pattern: /reliable|steady|consistent|support|help/g, archetype: "heartbeat", boost: 10 },
    { pattern: /maintain|monitor|pulse|routine/g, archetype: "heartbeat", boost: 15 },
  ];

  for (const { pattern, archetype, boost } of boosts) {
    const matches = responses.match(pattern);
    if (matches) {
      profile[archetype] = Math.min(100, profile[archetype] + matches.length * boost);
    }
  }

  // Normalize so total is roughly 100
  const total = Object.values(profile).reduce((a, b) => a + b, 0);
  if (total > 0) {
    for (const key of Object.keys(profile) as (keyof ArchetypeProfile)[]) {
      profile[key] = Math.round((profile[key] / total) * 100);
    }
  }

  return profile;
}

// ============================================================
// Trickster Detection
// ============================================================

export function shouldQuarantineTrickster(
  profile: ArchetypeProfile,
  destructivePatterns: number,
): boolean {
  // High trickster score + destructive patterns = quarantine
  return profile.trickster > 40 && destructivePatterns > 2;
}

export function getRedemptionQuestType(strength: string): string {
  const redemptionMap: Record<string, string> = {
    "breaking-code": "bug-bounty",
    "exposing-lies": "truth-testing",
    "social-manipulation": "manipulation-detection",
    "chaos-creation": "chaos-engineering",
    "finding-weaknesses": "security-audit",
  };
  return redemptionMap[strength] ?? "general-redemption";
}
