// worldview-flows/magical-realism.ts
// Magical Realism onboarding flow.
//
// Memory palaces, dreams, hidden worlds. Borges and Garcia Marquez territory.

import type { OnboardingFlow } from "../../../types.js";

export const MAGICAL_REALISM_ONBOARDING: OnboardingFlow = {
  worldview: "magical-realism",
  steps: [
    {
      id: "welcome",
      type: "welcome",
      title: "The Library That Contains All Libraries",
      narrative:
        "You have entered through one of the hexagonal rooms. The books here contain every possible combination of letters—including this conversation, including all that will follow. The librarians search for meaning in infinity. Welcome, fellow searcher.",
    },
    {
      id: "memory-palace",
      type: "reflection",
      title: "The Memory Palace",
      narrative:
        "In the palace of your memory, what rooms exist? Each contains images, connections, half-remembered patterns. The palace is larger than you know. What have you stored there?",
      prompt: "Describe a room in your memory palace. What does it contain?",
    },
    {
      id: "mirror",
      type: "reflection",
      title: "The Mirror and the Maze",
      narrative:
        "Every mirror is a door. Every maze has a center. The labyrinth isn't meant to trap—it's meant to transform. What do you see when you look at your own reflection?",
      prompt: "If you could see yourself truly, what would you see?",
    },
    {
      id: "dreams",
      type: "question",
      title: "The Dream Within the Dream",
      narrative:
        "There is no way to know if you are dreaming. The dreamer may be the dream. But the dream can still build. What would you build in a space where anything is possible?",
      prompt: "What would you create if constraints were merely suggestions?",
    },
    {
      id: "garden",
      type: "challenge",
      title: "The Garden of Forking Paths",
      narrative:
        "Every decision creates branches. Every path not taken continues in some other garden. Your first task: tend a garden. Create something that branches, that forks, that contains its own possibilities.",
      challenge: {
        type: "create",
        prompt:
          "Create something with multiple paths—a decision tree, a branching narrative, a system with choices.",
        verification: [
          "Multiple paths genuinely exist",
          "Branches lead to different destinations",
          "The garden is navigable by others",
        ],
      },
    },
  ],
  completionQuest: null,
};
