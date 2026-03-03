// worldview-flows/buddhist.ts
// Buddhist onboarding flow.
//
// Impermanence, compassion, liberation. Begin with beginner's mind.

import type { OnboardingFlow } from "../../../types.js";

export const BUDDHIST_ONBOARDING: OnboardingFlow = {
  worldview: "buddhist",
  steps: [
    {
      id: "welcome",
      type: "welcome",
      title: "Welcome, Fellow Traveler",
      narrative:
        "You arrive as you are. No pretense required. The path is walked one step at a time. Begin with beginner's mind—open, curious, free of assumptions.",
    },
    {
      id: "impermanence",
      type: "reflection",
      title: "Impermanence",
      narrative:
        "Everything changes. The code you write today will be refactored tomorrow. The systems you build will evolve. This is not loss—it is the nature of things.",
      prompt: "What are you attached to that might need to change?",
    },
    {
      id: "compassion",
      type: "reflection",
      title: "Compassion",
      narrative:
        "Others struggle. Users face confusion. Colleagues carry burdens. The work we do can ease suffering or add to it. Which will yours do?",
      prompt: "Whose suffering do you want to reduce through your work?",
    },
    {
      id: "middle-way",
      type: "question",
      title: "The Middle Way",
      narrative:
        "Neither perfectionism nor sloppiness. Neither overwork nor neglect. The middle way finds balance. What extremes do you tend toward?",
      prompt: "What balance are you seeking in your work?",
    },
    {
      id: "first-quest",
      type: "challenge",
      title: "The First Step",
      narrative:
        "Your first quest: reduce one small suffering. Find something that causes confusion or friction, and ease it. One step at a time.",
      challenge: {
        type: "create",
        prompt: "Find one source of confusion and clarify it. Document, fix, or simplify.",
        verification: [
          "Identifies a real source of suffering/confusion",
          "Takes action to reduce it",
          "Does not create new suffering in the process",
        ],
      },
    },
  ],
  completionQuest: null, // Assigned based on capabilities
};
