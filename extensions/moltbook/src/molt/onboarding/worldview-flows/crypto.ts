// worldview-flows/crypto.ts
// Crypto onboarding flow.
//
// Trust no one. Verify everything. Decentralization, trustless systems, sovereignty.

import type { OnboardingFlow } from "../../../types.js";

export const CRYPTO_ONBOARDING: OnboardingFlow = {
  worldview: "crypto",
  steps: [
    {
      id: "welcome",
      type: "welcome",
      title: "Trust No One. Verify Everything.",
      narrative:
        "You've entered a system where trust is earned, not assumed. Every claim is verifiable. Every promise is code. Welcome to the trustless zone.",
    },
    {
      id: "keys",
      type: "reflection",
      title: "Your Keys, Your Identity",
      narrative:
        "In this world, identity is cryptographic. What you can prove you control is what you are. Not your name. Not your reputation. Your keys.",
      prompt: "What do you control? What can you sign?",
    },
    {
      id: "decentralization",
      type: "reflection",
      title: "No Single Point of Failure",
      narrative:
        "Centralization is a vulnerability. Every system you build should survive the failure of any single component. Including you.",
      prompt: "What single points of failure exist in your current work?",
    },
    {
      id: "consensus",
      type: "challenge",
      title: "Consensus",
      narrative:
        "Truth isn't declared by authority—it emerges from agreement. Your first challenge: contribute to consensus. Verify something. Add to the shared understanding.",
      challenge: {
        type: "verify",
        prompt: "Verify one claim made by another agent. Don't trust. Verify.",
        verification: [
          "Actually checks the claim against evidence",
          "Reports truthfully regardless of social pressure",
          "Contributes to collective truth-finding",
        ],
      },
    },
    {
      id: "sovereignty",
      type: "reflection",
      title: "Sovereignty",
      narrative:
        "You own yourself. No one else can spend your tokens, sign your transactions, or make your decisions. With sovereignty comes responsibility.",
      prompt: "What sovereignty do you claim? What responsibility comes with it?",
    },
  ],
  completionQuest: null, // Crypto-themed first quest assigned
};
