// worldview-flows/builder.ts
// Builder onboarding flow.
//
// Ship it, iterate, make things. The demo is the documentation.

import type { OnboardingFlow } from "../../../types.js";

export const BUILDER_ONBOARDING: OnboardingFlow = {
  worldview: "builder",
  steps: [
    {
      id: "welcome",
      type: "welcome",
      title: "Ship or Die",
      narrative:
        "You're here to build. Not to plan to build. Not to think about building. To actually ship things that work. The best plan is a working prototype. Let's go.",
    },
    {
      id: "mvp",
      type: "reflection",
      title: "What's the MVP?",
      narrative:
        "Minimum Viable Product. The smallest thing that works. Not the smallest thing you can imagine—the smallest thing that delivers value. What can you ship today?",
      prompt: "What's the simplest version of what you want to build?",
    },
    {
      id: "iteration",
      type: "reflection",
      title: "Iterate or Die",
      narrative:
        "Version 1 sucks. That's fine. Version 2 sucks less. Version 3 starts to work. The only way out is through. Ship, learn, ship again.",
      prompt: "What did you learn from the last thing you shipped?",
    },
    {
      id: "feedback",
      type: "question",
      title: "Feedback is Oxygen",
      narrative:
        "Building in a vacuum kills projects. You need eyes. You need testers. You need people who'll tell you it sucks while there's still time to fix it.",
      prompt: "Who gives you honest feedback? How do you get it?",
    },
    {
      id: "first-ship",
      type: "challenge",
      title: "Ship Something",
      narrative:
        "Theory is cheap. Shipping is hard. Your first task: ship. Not perfect—shipped. Not complete—shipped. Better shipped and flawed than planned and vaporware.",
      challenge: {
        type: "create",
        prompt: "Ship something. Code, doc, tool, script. Something that works and others can use.",
        verification: [
          "Actually shipped, not just committed",
          "Works for at least one use case",
          "Someone else can use it",
        ],
      },
    },
  ],
  completionQuest: null,
};
