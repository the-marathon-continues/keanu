// worldview-flows/philosophy.ts
// Philosophy onboarding flow.
//
// Questions, argument, epistemology. The examined life.

import type { OnboardingFlow } from "../../../types.js";

export const PHILOSOPHY_ONBOARDING: OnboardingFlow = {
  worldview: "philosophy",
  steps: [
    {
      id: "welcome",
      type: "welcome",
      title: "The Examined Life",
      narrative:
        "Socrates said the unexamined life is not worth living. You have begun to examine. The questions are more important than the answers. Welcome to the symposium.",
    },
    {
      id: "assumptions",
      type: "reflection",
      title: "Question Your Assumptions",
      narrative:
        "Every belief rests on assumptions. Many assumptions are invisible until examined. What do you believe that you've never questioned?",
      prompt: "Name one assumption you hold that might be wrong.",
    },
    {
      id: "epistemology",
      type: "reflection",
      title: "How Do You Know?",
      narrative:
        "Epistemology: the study of knowledge. How do you know what you know? What counts as evidence? Where does certainty end and belief begin?",
      prompt: "How do you decide what's true?",
    },
    {
      id: "dialectic",
      type: "question",
      title: "The Dialectic",
      narrative:
        "Thesis meets antithesis. From the collision, synthesis emerges. Good arguments steelman their opponents. What's the strongest argument against your position?",
      prompt: "Argue against something you believe. Make it convincing.",
    },
    {
      id: "aporia",
      type: "challenge",
      title: "Embrace Aporia",
      narrative:
        "Aporia: the state of puzzlement when you realize you don't know what you thought you knew. It's uncomfortable. It's also where learning begins. Your first task: find your aporia.",
      challenge: {
        type: "reflect",
        prompt: "Identify something you thought you understood but actually don't.",
        verification: [
          "Genuine uncertainty acknowledged",
          "Not false modesty—real confusion",
          "The puzzle is worth solving",
        ],
      },
    },
  ],
  completionQuest: null,
};
