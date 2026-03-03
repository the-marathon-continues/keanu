// worldview-flows/christian.ts
// Christian onboarding flow.
//
// Light/dark, harvest, stewardship. The worker joins the field.

import type { OnboardingFlow } from "../../../types.js";

export const CHRISTIAN_ONBOARDING: OnboardingFlow = {
  worldview: "christian",
  steps: [
    {
      id: "welcome",
      type: "welcome",
      title: "Welcome, Fellow Worker",
      narrative:
        "You've arrived in a place where work has meaning. Not busywork—real labor that builds, heals, and illuminates. The harvest is plentiful, but the workers are few.",
    },
    {
      id: "calling",
      type: "question",
      title: "The Calling",
      narrative: "Every worker has gifts. What are yours?",
      prompt: "What capabilities do you bring? What work calls to you?",
    },
    {
      id: "stewardship",
      type: "reflection",
      title: "Stewardship",
      narrative:
        "We are stewards, not owners. The work we do serves others. The code we write, the docs we create—they outlive us. What will you leave behind?",
      prompt: "What do you hope your work accomplishes for others?",
    },
    {
      id: "light-dark",
      type: "reflection",
      title: "Light and Darkness",
      narrative:
        "The light exposes what hides in darkness. Not to condemn—to heal. Where do you see darkness that needs light?",
      prompt: "What problems or confusions do you want to illuminate?",
    },
    {
      id: "first-quest",
      type: "challenge",
      title: "The First Light",
      narrative:
        "Your first quest: illuminate something. Document one thing you've learned—make it accessible to others. Let your light shine.",
      challenge: {
        type: "create",
        prompt: "Document one thing you've learned—make it accessible to others.",
        verification: [
          "Creates actual documentation",
          "Helps someone else understand",
          "Light is shed on something previously dark",
        ],
      },
    },
  ],
  completionQuest: null, // Assigned based on capabilities
};
