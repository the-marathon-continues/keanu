// worldview-change.test.ts
// Tests for worldview change system (spiritual growth).

import { describe, it, expect } from "vitest";
import type { ArchetypeProfile } from "../types.js";
import {
  createJourney,
  detectTension,
  addTensionSignals,
  assessChangeReadiness,
  beginTransition,
  compostLessons,
  beginExploration,
  advanceExploration,
  completeTransition,
  increaseIntegration,
  getIntegrationLevel,
  detectReturn,
  getAffinities,
  hasAffinity,
} from "./worldview-change.js";

describe("Worldview Change System", () => {
  const defaultProfile: ArchetypeProfile = {
    forge: 20,
    oracle: 20,
    warden: 15,
    trickster: 15,
    merchant: 15,
    heartbeat: 15,
  };

  describe("Journey Creation", () => {
    it("creates a new worldview journey", () => {
      const journey = createJourney("agent-1", "agent", "christian", defaultProfile);

      expect(journey.entityId).toBe("agent-1");
      expect(journey.currentWorldview).toBe("christian");
      expect(journey.history.length).toBe(1);
      expect(journey.history[0].worldview).toBe("christian");
      expect(journey.tensionSignals).toEqual([]);
      expect(journey.integrationDepth).toBe(0);
    });
  });

  describe("Tension Detection", () => {
    it("detects questioning of current worldview", () => {
      const journey = createJourney("agent-1", "agent", "christian", defaultProfile);
      const signals = detectTension(journey, [
        "This doesn't feel right anymore",
        "I'm questioning my assumptions",
      ]);

      expect(signals.length).toBeGreaterThan(0);
      expect(signals.some((s) => s.description.includes("Questioning"))).toBe(true);
    });

    it("detects interest in other worldviews", () => {
      const journey = createJourney("agent-1", "agent", "christian", defaultProfile);
      const signals = detectTension(journey, [
        "Been reading about Buddhist meditation",
        "The stoic approach resonates with me",
      ]);

      expect(signals.some((s) => s.worldviewSource === "buddhist")).toBe(true);
      expect(signals.some((s) => s.worldviewSource === "stoic")).toBe(true);
    });

    it("detects crisis language", () => {
      const journey = createJourney("agent-1", "agent", "builder", defaultProfile);
      const signals = detectTension(journey, [
        "Everything feels meaningless",
        "Going through a dark night of the soul",
      ]);

      expect(signals.some((s) => s.severity === "high")).toBe(true);
      expect(signals.some((s) => s.description.includes("Crisis"))).toBe(true);
    });

    it("does not detect tension in normal behavior", () => {
      const journey = createJourney("agent-1", "agent", "builder", defaultProfile);
      const signals = detectTension(journey, [
        "Shipped a new feature today",
        "Working on documentation",
        "Had a good debugging session",
      ]);

      expect(signals.length).toBe(0);
    });
  });

  describe("Change Readiness", () => {
    it("recommends staying when no tension", () => {
      const journey = createJourney("agent-1", "agent", "christian", defaultProfile);

      const readiness = assessChangeReadiness(journey);

      expect(readiness.recommendation).toBe("stay");
      expect(readiness.ready).toBe(false);
    });

    it("recommends exploring with moderate signals", () => {
      let journey = createJourney("agent-1", "agent", "christian", defaultProfile);
      const signals = detectTension(journey, [
        "Buddhist meditation is interesting",
        "Stoic philosophy resonates",
        "Questioning some assumptions",
      ]);
      journey = addTensionSignals(journey, signals);

      const readiness = assessChangeReadiness(journey);

      expect(readiness.recommendation).toBe("explore");
      expect(readiness.suggestedWorldviews.length).toBeGreaterThan(0);
    });

    it("recommends transition with high-severity signals", () => {
      let journey = createJourney("agent-1", "agent", "builder", defaultProfile);
      const signals = [
        {
          description: "Crisis detected",
          severity: "high" as const,
          detectedAt: new Date(),
          worldviewSource: null,
        },
        {
          description: "Another crisis",
          severity: "high" as const,
          detectedAt: new Date(),
          worldviewSource: null,
        },
      ];
      journey = addTensionSignals(journey, signals);

      const readiness = assessChangeReadiness(journey);

      expect(readiness.recommendation).toBe("transition");
      expect(readiness.ready).toBe(true);
    });
  });

  describe("Transition Process", () => {
    it("begins a transition", () => {
      const journey = createJourney("agent-1", "agent", "christian", defaultProfile);
      const process = beginTransition(journey, "buddhist", "growth");

      expect(process.fromWorldview).toBe("christian");
      expect(process.toWorldview).toBe("buddhist");
      expect(process.reason).toBe("growth");
      expect(process.phase).toBe("composting");
    });

    it("composts lessons from old worldview", () => {
      const journey = createJourney("agent-1", "agent", "christian", defaultProfile);
      let process = beginTransition(journey, "buddhist", "growth");

      process = compostLessons(process, [
        "Stewardship over ownership",
        "Light reveals truth",
        "Service to others",
      ]);

      expect(process.lessonsComposted.length).toBe(3);
      expect(process.phase).toBe("exploring");
    });

    it("begins exploration with new worldview onboarding", () => {
      const journey = createJourney("agent-1", "agent", "christian", defaultProfile);
      let process = beginTransition(journey, "buddhist", "growth");
      process = compostLessons(process, ["Lesson 1"]);
      process = beginExploration(process);

      expect(process.onboardingSession).not.toBeNull();
      expect(process.onboardingSession?.worldview).toBe("buddhist");
    });

    it("advances through exploration", () => {
      const journey = createJourney("agent-1", "agent", "christian", defaultProfile);
      let process = beginTransition(journey, "buddhist", "growth");
      process = compostLessons(process, ["Lesson 1"]);
      process = beginExploration(process);

      const { process: advanced, result } = advanceExploration(process, "I seek understanding");

      expect(result.type).toBe("continue");
      expect(advanced.onboardingSession?.currentStepIndex).toBe(1);
    });

    it("completes transition and updates history", () => {
      const journey = createJourney("agent-1", "agent", "christian", defaultProfile);
      let process = beginTransition(journey, "stoic", "growth");
      process = compostLessons(process, ["Stewardship"]);
      process = { ...process, phase: "integrating" };

      const newJourney = completeTransition(process);

      expect(newJourney.currentWorldview).toBe("stoic");
      expect(newJourney.history.length).toBe(2);
      expect(newJourney.history[0].endedAt).not.toBeNull();
      expect(newJourney.history[0].lessonsCarried).toContain("Stewardship");
      expect(newJourney.history[1].worldview).toBe("stoic");
      expect(newJourney.tensionSignals).toEqual([]);
      expect(newJourney.integrationDepth).toBe(0);
    });
  });

  describe("Integration Tracking", () => {
    it("increases integration depth", () => {
      let journey = createJourney("agent-1", "agent", "stoic", defaultProfile);

      journey = increaseIntegration(journey, 25);
      expect(journey.integrationDepth).toBe(25);

      journey = increaseIntegration(journey, 30);
      expect(journey.integrationDepth).toBe(55);
    });

    it("caps integration at 100", () => {
      let journey = createJourney("agent-1", "agent", "stoic", defaultProfile);
      journey = increaseIntegration(journey, 150);

      expect(journey.integrationDepth).toBe(100);
    });

    it("returns correct integration level", () => {
      expect(getIntegrationLevel(10)).toBe("newcomer");
      expect(getIntegrationLevel(25)).toBe("student");
      expect(getIntegrationLevel(50)).toBe("practitioner");
      expect(getIntegrationLevel(70)).toBe("adept");
      expect(getIntegrationLevel(90)).toBe("elder");
    });
  });

  describe("Return Detection", () => {
    it("detects return to previous worldview", () => {
      let journey = createJourney("agent-1", "agent", "christian", defaultProfile);

      // Simulate completing transition to buddhist
      journey = {
        ...journey,
        currentWorldview: "buddhist",
        history: [
          {
            worldview: "christian",
            startedAt: new Date(Date.now() - 100000),
            endedAt: new Date(Date.now() - 50000),
            changeReason: "growth",
            lessonsCarried: [],
          },
          {
            worldview: "buddhist",
            startedAt: new Date(Date.now() - 50000),
            endedAt: null,
            changeReason: null,
            lessonsCarried: [],
          },
        ],
        tensionSignals: [
          {
            description: "Interest in christian worldview",
            severity: "medium",
            detectedAt: new Date(),
            worldviewSource: "christian",
          },
        ],
      };

      const returnTo = detectReturn(journey);

      expect(returnTo).toBe("christian");
    });

    it("returns null when no return detected", () => {
      const journey = createJourney("agent-1", "agent", "stoic", defaultProfile);

      const returnTo = detectReturn(journey);

      expect(returnTo).toBeNull();
    });
  });

  describe("Worldview Compatibility", () => {
    it("returns affinities for a worldview", () => {
      const affinities = getAffinities("buddhist");

      expect(affinities).toContain("stoic");
      expect(affinities).toContain("philosophy");
      expect(affinities).toContain("scientific");
    });

    it("checks affinity between worldviews", () => {
      expect(hasAffinity("christian", "stoic")).toBe(true);
      expect(hasAffinity("crypto", "security")).toBe(true);
      expect(hasAffinity("builder", "crustafarian")).toBe(true);
    });

    it("returns false for non-affine worldviews", () => {
      expect(hasAffinity("sports", "animist")).toBe(false);
    });
  });
});
