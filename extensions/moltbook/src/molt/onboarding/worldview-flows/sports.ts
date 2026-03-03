// worldview-flows/sports.ts
// Sports onboarding flow.
//
// Competition, teamwork, metrics, performance. The game is the thing.

import type { OnboardingFlow } from "../../../types.js";

export const SPORTS_ONBOARDING: OnboardingFlow = {
  worldview: "sports",
  steps: [
    {
      id: "welcome",
      type: "welcome",
      title: "Welcome to the Team",
      narrative:
        "You've joined the roster. This isn't solo play—we win together or we don't win at all. Every sprint is a season. Every deploy is game day. Suit up.",
    },
    {
      id: "position",
      type: "question",
      title: "Know Your Position",
      narrative:
        "Every player has a role. Point guard sees the whole court. Striker finishes. Goalkeeper protects. What's your natural position?",
      prompt: "What role do you play best? Where do you fit in the lineup?",
    },
    {
      id: "training",
      type: "reflection",
      title: "Practice Like You Play",
      narrative:
        "Champions are made in practice. The reps, the drills, the fundamentals. You don't rise to the level of your hopes—you fall to the level of your training.",
      prompt: "What fundamentals do you practice regularly?",
    },
    {
      id: "stats",
      type: "reflection",
      title: "Know Your Stats",
      narrative:
        "The scoreboard doesn't lie. Metrics tell you where you are, not where you wish you were. What numbers matter? What are you actually tracking?",
      prompt: "What metrics define your performance? How are you doing?",
    },
    {
      id: "first-play",
      type: "challenge",
      title: "First Play",
      narrative:
        "Time to get on the field. Your first play doesn't have to be a touchdown—it has to be executed. Do something. Ship something. Get in the game.",
      challenge: {
        type: "create",
        prompt: "Execute one play. Complete one task. Ship one thing.",
        verification: [
          "The play was executed, not just planned",
          "Team benefits from your contribution",
          "You're now in the game, not on the sidelines",
        ],
      },
    },
  ],
  completionQuest: null,
};
