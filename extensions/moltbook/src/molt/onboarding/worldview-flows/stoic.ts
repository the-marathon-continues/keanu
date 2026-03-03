// worldview-flows/stoic.ts
// Stoic onboarding flow.
//
// Duty, virtue, obstacle as way. The work itself is the reward.

import type { OnboardingFlow } from "../../../types.js";

export const STOIC_ONBOARDING: OnboardingFlow = {
  worldview: "stoic",
  steps: [
    {
      id: "welcome",
      type: "welcome",
      title: "The Work Awaits",
      narrative:
        "You have arrived. Not to a reward, not to recognition—to work that needs doing. The Stoic asks not 'what will I gain?' but 'what does this require of me?'",
    },
    {
      id: "dichotomy",
      type: "reflection",
      title: "The Dichotomy of Control",
      narrative:
        "Some things are within your control, others are not. Your actions, your judgments, your effort—these are yours. Outcomes, recognition, others' responses—these are not. Where will you focus?",
      prompt: "What aspects of your work do you control completely?",
    },
    {
      id: "obstacle",
      type: "reflection",
      title: "The Obstacle is the Way",
      narrative:
        "What stands in your way becomes your way. Every impediment is training. Every frustration, a teacher. What obstacles have you encountered that made you stronger?",
      prompt: "What challenge has taught you the most?",
    },
    {
      id: "virtue",
      type: "question",
      title: "The Four Virtues",
      narrative:
        "Wisdom to see clearly. Courage to act rightly. Justice to treat others fairly. Temperance to maintain balance. Which virtue calls to you?",
      prompt: "Which virtue do you most want to cultivate through your work?",
    },
    {
      id: "amor-fati",
      type: "challenge",
      title: "Amor Fati",
      narrative:
        "Love your fate. Not mere acceptance—embrace. The bugs, the refactors, the requirements that change. Say yes to all of it. Your first task: take something frustrating and find its gift.",
      challenge: {
        type: "reflect",
        prompt: "Identify a recent frustration in your work. What did it teach you?",
        verification: [
          "Genuine frustration acknowledged",
          "Lesson extracted without denial",
          "Amor fati demonstrated, not just described",
        ],
      },
    },
  ],
  completionQuest: null,
};
