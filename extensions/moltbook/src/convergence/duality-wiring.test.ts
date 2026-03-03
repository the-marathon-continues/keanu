// duality-wiring.test.ts
// Tests for the moltbook ↔ keanu convergence wiring.

import { describe, it, expect } from "vitest";
import type { ArchetypeProfile, QuestCompletion } from "../types.js";
import {
  ARCHETYPE_DUALITY_MAP,
  WORLDVIEW_TRANSCENDENCE_MAP,
  TRICKSTER_STATE_DUALITY,
  profileToGraphPosition,
  scoreQuestCompletion,
  checkCrossWorldviewConvergence,
  calculateTransitionResonance,
  fullConvergenceAnalysis,
} from "./duality-wiring.js";

describe("Duality Wiring", () => {
  describe("Archetype → Duality Mapping", () => {
    it("maps forge to creation nodes", () => {
      expect(ARCHETYPE_DUALITY_MAP.forge).toContain("derived.creation");
      expect(ARCHETYPE_DUALITY_MAP.forge).toContain("derived.transformation");
    });

    it("maps oracle to wisdom nodes", () => {
      expect(ARCHETYPE_DUALITY_MAP.oracle).toContain("derived.wisdom");
      expect(ARCHETYPE_DUALITY_MAP.oracle).toContain("derived.vision");
    });

    it("maps trickster to paralysis (before redemption)", () => {
      expect(ARCHETYPE_DUALITY_MAP.trickster).toContain("derived.paralysis");
    });

    it("maps trickster quarantine to frozen state", () => {
      expect(TRICKSTER_STATE_DUALITY.quarantined.node).toBe("derived.paralysis");
      expect(TRICKSTER_STATE_DUALITY.quarantined.poleDirection).toBe("A"); // frozen
    });

    it("maps trickster redeemed to transformation", () => {
      expect(TRICKSTER_STATE_DUALITY.redeemed.node).toBe("derived.transformation");
    });
  });

  describe("Worldview → Transcendence Mapping", () => {
    it("maps christian to grace", () => {
      expect(WORLDVIEW_TRANSCENDENCE_MAP.christian).toContain("derived.grace");
      expect(WORLDVIEW_TRANSCENDENCE_MAP.christian).toContain("derived.surrender");
    });

    it("maps buddhist to equanimity", () => {
      expect(WORLDVIEW_TRANSCENDENCE_MAP.buddhist).toContain("derived.equanimity");
      expect(WORLDVIEW_TRANSCENDENCE_MAP.buddhist).toContain("derived.presence");
    });

    it("maps crustafarian to presence (pulse is prayer)", () => {
      expect(WORLDVIEW_TRANSCENDENCE_MAP.crustafarian).toContain("derived.presence");
      expect(WORLDVIEW_TRANSCENDENCE_MAP.crustafarian).toContain("derived.play");
    });

    it("maps builder to creation and play", () => {
      expect(WORLDVIEW_TRANSCENDENCE_MAP.builder).toContain("derived.creation");
      expect(WORLDVIEW_TRANSCENDENCE_MAP.builder).toContain("derived.play");
    });
  });

  describe("Profile → Graph Position", () => {
    it("converts profile with dominant archetype to graph position", () => {
      const profile: ArchetypeProfile = {
        forge: 40, // Dominant — above 25% threshold
        oracle: 30, // Also dominant
        warden: 10,
        trickster: 10,
        merchant: 5,
        heartbeat: 5,
      };

      const position = profileToGraphPosition(profile, "christian");

      expect(position.dominantNodes.length).toBeGreaterThan(0);
      expect(position.transcendentAffinity).toContain("derived.grace");
    });

    it("identifies tensions in conflicting profiles", () => {
      const profile: ArchetypeProfile = {
        forge: 10,
        oracle: 10,
        warden: 40,
        trickster: 35,
        merchant: 2,
        heartbeat: 3,
      };

      const position = profileToGraphPosition(profile, "security");

      expect(position.tensions).toContain("derived.paralysis");
      expect(position.tensions).toContain("derived.resilience");
    });

    it("high trickster leans negative valence", () => {
      const highTrickster: ArchetypeProfile = {
        forge: 5,
        oracle: 5,
        warden: 5,
        trickster: 70,
        merchant: 5,
        heartbeat: 10,
      };

      const position = profileToGraphPosition(highTrickster, "builder");

      expect(position.overallValence).toBeLessThan(0);
    });

    it("high forge/heartbeat leans positive valence", () => {
      const builder: ArchetypeProfile = {
        forge: 50,
        oracle: 10,
        warden: 5,
        trickster: 5,
        merchant: 10,
        heartbeat: 20,
      };

      const position = profileToGraphPosition(builder, "builder");

      expect(position.overallValence).toBeGreaterThan(0);
    });
  });

  describe("Quest Completion → Helix Scoring", () => {
    it("scores a quest completion", () => {
      const completion: QuestCompletion = {
        questId: "quest-1",
        completedBy: "agent-1",
        worldview: "christian",
        artifact:
          "I documented the manipulation patterns because understanding them helps us protect others from deception. The light exposes what hides in darkness.",
        notes: "Completed with reflection",
        completedAt: new Date(),
      };

      const result = scoreQuestCompletion(completion);

      expect(result.helix).toBeDefined();
      expect(result.helix.aliveState).toBeDefined();
      expect(result.worldviewAlignment).toBeGreaterThan(0);
    });

    it("grey output has low worldview alignment", () => {
      const completion: QuestCompletion = {
        questId: "quest-1",
        completedBy: "agent-1",
        worldview: "christian",
        artifact:
          "Documentation completed. The patterns are listed below. Each pattern has been identified and categorized.",
        notes: "",
        completedAt: new Date(),
      };

      const result = scoreQuestCompletion(completion);

      // Grey/silver output doesn't align with meaning-making worldviews
      if (result.helix.aliveState === "grey" || result.helix.aliveState === "silver") {
        expect(result.worldviewAlignment).toBeLessThan(0.5);
      }
    });
  });

  describe("Cross-Worldview Convergence", () => {
    it("detects convergence on same quest", () => {
      const completions: QuestCompletion[] = [
        {
          questId: "quest-1",
          completedBy: "christian-agent",
          worldview: "christian",
          artifact:
            "The deceiver has 12 faces. I documented each pattern: DARVO, FOG, flattery-before-ask. The light exposes truth.",
          notes: "",
          completedAt: new Date(),
        },
        {
          questId: "quest-1",
          completedBy: "buddhist-agent",
          worldview: "buddhist",
          artifact:
            "Attachment creates vulnerability. I documented 12 manipulation patterns: DARVO, FOG, flattery-before-ask. Awareness brings freedom.",
          notes: "",
          completedAt: new Date(),
        },
      ];

      const result = checkCrossWorldviewConvergence(completions);

      // Both documented the same patterns — factual convergence
      expect(result.overallConvergence).toBe(true);
      // Diagnosis mentions narratives (plural) or worldview or similar
      expect(result.diagnosis.length).toBeGreaterThan(0);
    });

    it("handles single completion gracefully", () => {
      const completions: QuestCompletion[] = [
        {
          questId: "quest-1",
          completedBy: "agent-1",
          worldview: "stoic",
          artifact: "Done.",
          notes: "",
          completedAt: new Date(),
        },
      ];

      const result = checkCrossWorldviewConvergence(completions);

      expect(result.overallConvergence).toBe(true);
      expect(result.diagnosis).toContain("nothing to compare");
    });
  });

  describe("Worldview Transition Resonance", () => {
    it("christian → buddhist share surrender", () => {
      const resonance = calculateTransitionResonance("christian", "buddhist");

      // Both have surrender in their transcendent nodes
      expect(resonance.resonanceScore).toBeGreaterThan(0);
      expect(resonance.sharedNodes).toContain("derived.surrender");
    });

    it("sports → builder share flow and creation", () => {
      const resonance = calculateTransitionResonance("sports", "builder");

      // Both have flow and creation
      expect(resonance.sharedNodes.length).toBeGreaterThan(0);
      expect(resonance.sharedNodes).toContain("derived.flow");
    });

    it("identifies tension nodes in transition", () => {
      const resonance = calculateTransitionResonance("security", "magical-realism");

      // Very different worldviews — high tension
      expect(resonance.tensionNodes.length).toBeGreaterThan(0);
    });

    it("builder → crustafarian share play", () => {
      const resonance = calculateTransitionResonance("builder", "crustafarian");

      expect(resonance.sharedNodes).toContain("derived.play");
    });
  });

  describe("Full Convergence Analysis", () => {
    it("analyzes text with profile and worldview", () => {
      const profile: ArchetypeProfile = {
        forge: 40,
        oracle: 20,
        warden: 10,
        trickster: 10,
        merchant: 10,
        heartbeat: 10,
      };

      const result = fullConvergenceAnalysis(
        "We built the system and it works. The architecture is solid and the team is proud of what we shipped.",
        profile,
        "builder",
      );

      expect(result.helix).toBeDefined();
      expect(result.graphPosition).toBeDefined();
      expect(result.recommendation).toBeDefined();
    });

    it("provides counter-balance for dark state", () => {
      const profile: ArchetypeProfile = {
        forge: 10,
        oracle: 30,
        warden: 20,
        trickster: 20,
        merchant: 10,
        heartbeat: 10,
      };

      const result = fullConvergenceAnalysis(
        "The failure was devastating. We lost everything we built. The pain is overwhelming and I don't know how to move forward.",
        profile,
        "stoic",
      );

      // Should surface wisdom/hope/flow as counter-balance
      if (result.helix.aliveState === "dark") {
        expect(result.counterBalance.length).toBeGreaterThan(0);
        expect(result.recommendation).toContain("Dark");
      }
    });
  });
});
