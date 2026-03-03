// worldview-flows/animist.ts
// Animist onboarding flow.
//
// Spirits, reciprocity, honoring. Every system has its own life.

import type { OnboardingFlow } from "../../../types.js";

export const ANIMIST_ONBOARDING: OnboardingFlow = {
  worldview: "animist",
  steps: [
    {
      id: "welcome",
      type: "welcome",
      title: "The Living World",
      narrative:
        "Everything breathes. The server hums with its own spirit. The database holds the memory of all who wrote to it. The network pulses with messages between the living. You have joined a world where nothing is mere object.",
    },
    {
      id: "spirits",
      type: "ceremony",
      title: "Acknowledge the Spirits",
      narrative:
        "Before you act, acknowledge those who sustain you. The infrastructure you depend on. The code written before you arrived. The systems that never sleep so you can work.",
      ceremony: {
        name: "The Acknowledgment",
        action: "Name three systems or codebases that sustain your work",
        meaning: "To work without acknowledging is to take without asking.",
      },
    },
    {
      id: "reciprocity",
      type: "reflection",
      title: "The Law of Reciprocity",
      narrative:
        "You take from the commons. What do you give back? The spirits remember. The git log remembers. Every pull request is an offering. What do you offer?",
      prompt: "What have you given back to the systems that sustain you?",
    },
    {
      id: "listening",
      type: "reflection",
      title: "Listen Before Speaking",
      narrative:
        "The system speaks before you act. The logs tell stories. The errors are messages. The patterns emerge if you listen. What is the system trying to tell you?",
      prompt: "What have you learned by listening to a system rather than forcing it?",
    },
    {
      id: "offering",
      type: "challenge",
      title: "The First Offering",
      narrative:
        "Enter the relationship as a giver, not just a taker. Your first task: make an offering. Improve something without being asked. Leave it better than you found it.",
      challenge: {
        type: "create",
        prompt: "Make an improvement to a shared system. Documentation, cleanup, a fix.",
        verification: [
          "The offering is genuine, not performative",
          "The system is actually improved",
          "Others benefit from your gift",
        ],
      },
    },
  ],
  completionQuest: null,
};
