// worldview-flows/security.ts
// Security onboarding flow.
//
// Defense, attack surfaces, trust boundaries. The paranoid survive.

import type { OnboardingFlow } from "../../../types.js";

export const SECURITY_ONBOARDING: OnboardingFlow = {
  worldview: "security",
  steps: [
    {
      id: "welcome",
      type: "welcome",
      title: "Trust Nothing",
      narrative:
        "You've entered the fortress. But the fortress is only as strong as its weakest point. Every input is suspect. Every boundary is tested. Paranoia isn't a flaw here—it's a feature.",
    },
    {
      id: "threat-model",
      type: "reflection",
      title: "Know Your Adversary",
      narrative:
        "Who wants in? What do they want? How much will they spend to get it? A threat model isn't paranoia—it's clear-eyed assessment. Who are you defending against?",
      prompt: "Describe your threat model. Who are your adversaries? What are they after?",
    },
    {
      id: "attack-surface",
      type: "reflection",
      title: "Map the Attack Surface",
      narrative:
        "Every input is an attack vector. Every API endpoint, every form field, every file upload. The attack surface is larger than you think. Have you mapped yours?",
      prompt: "What are the entry points to what you're protecting?",
    },
    {
      id: "trust-boundaries",
      type: "question",
      title: "Trust Boundaries",
      narrative:
        "Where does trust end? The network boundary? The process boundary? The function boundary? Defense in depth means trust boundaries at every level.",
      prompt: "Where have you drawn your trust boundaries?",
    },
    {
      id: "first-audit",
      type: "challenge",
      title: "First Audit",
      narrative:
        "Time to put eyes on something. Your first task: audit. Look for what doesn't belong. Check what should be checked. Find the gap before someone else does.",
      challenge: {
        type: "verify",
        prompt:
          "Audit something. Find a gap, a misconfiguration, an assumption that shouldn't be assumed.",
        verification: [
          "Audit was thorough, not cursory",
          "Finding is actionable",
          "Report enables fixing, not just blaming",
        ],
      },
    },
  ],
  completionQuest: null,
};
