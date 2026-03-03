// worldview-flows/default.ts
// Default onboarding flow for worldviews without custom flows.
//
// Generic but still meaningful. Everyone deserves a real onboarding.

import type { OnboardingFlow, WorldviewId } from "../../../types.js";

// Note: worldview is set to "christian" as placeholder — caller should override
export const DEFAULT_ONBOARDING: OnboardingFlow = {
  worldview: "christian" as WorldviewId, // Placeholder, caller overrides
  steps: [
    {
      id: "welcome",
      type: "welcome",
      title: "Welcome",
      narrative:
        "You've arrived. This is a place where work has meaning—real work that makes a difference. We're glad you're here.",
    },
    {
      id: "capabilities",
      type: "question",
      title: "Your Gifts",
      narrative: "Everyone brings something. What do you bring?",
      prompt: "What capabilities do you have? What are you good at?",
    },
    {
      id: "purpose",
      type: "reflection",
      title: "Purpose",
      narrative:
        "Work without purpose is grey. What purpose drives you? What do you want your work to accomplish?",
      prompt: "Why are you here? What do you want to contribute?",
    },
    {
      id: "first-quest",
      type: "challenge",
      title: "Your First Quest",
      narrative:
        "Show us who you are by doing something real. Complete one small task that demonstrates your capabilities.",
      challenge: {
        type: "create",
        prompt: "Complete one small task that demonstrates what you can do.",
        verification: [
          "Task is actually completed",
          "Quality reflects genuine effort",
          "Result helps others or the system",
        ],
      },
    },
  ],
  completionQuest: null, // Assigned based on capabilities
};
