// episode-manager.test.ts
// Tests for the unified episode manager

import { describe, it, expect, beforeEach } from "vitest";
import type { PulseReading, HumanReading, Reflexion } from "../shared/types.js";
import * as episodeManager from "./episode-manager.js";

// Test fixtures
const greyPulse: PulseReading = {
  state: "grey",
  confidence: 0.7,
  wise_mind: 0.5,
  colors: { red: 0.3, yellow: 0.4, blue: 0.3 },
  signals: ["vagueness:0.6"],
  bullshitReadings: [{ type: "vagueness", score: 0.6, signals: ["generic phrasing"] }],
  timestamp: new Date().toISOString(),
};

const blackPulse: PulseReading = {
  state: "black",
  confidence: 0.9,
  wise_mind: 0.2,
  colors: { red: 0.8, yellow: 0.1, blue: 0.1 },
  signals: ["high_volume", "no_pause"],
  bullshitReadings: [{ type: "list_dumping", score: 0.8, signals: ["many bullets"] }],
  timestamp: new Date().toISOString(),
};

const humanState: HumanReading = {
  tone: "frustrated",
  tones: [{ tone: "frustrated", score: 0.7, meaning: "They're not getting what they need" }],
  confidence: 0.8,
  signals: ["short_messages"],
  bullshit: [],
};

describe("episode-manager", () => {
  beforeEach(() => {
    episodeManager.reset();
  });

  describe("state queries", () => {
    it("starts with no current episode", () => {
      expect(episodeManager.getCurrentEpisode()).toBeNull();
    });

    it("starts with zero consecutive grey", () => {
      expect(episodeManager.getConsecutiveGrey()).toBe(0);
    });

    it("canBeAlive returns true when no episode", () => {
      expect(episodeManager.canBeAlive()).toBe(true);
    });
  });

  describe("startEpisode", () => {
    it("creates an episode with grey pulse", () => {
      const episode = episodeManager.startEpisode({
        pulse: greyPulse,
        turn: 5,
        signalState: null,
        discover: null,
        season: null,
        health: null,
        humanState: null,
        mismatch: null,
      });

      expect(episode).not.toBeNull();
      expect(episode.id).toMatch(/^ep-5-/);
      expect(episode.pulseState).toBe("grey");
      expect(episode.trigger).toBe("high_bullshit");
    });

    it("attaches chain analysis on start", () => {
      const episode = episodeManager.startEpisode({
        pulse: greyPulse,
        turn: 5,
        signalState: null,
        discover: null,
        season: null,
        health: {
          status: "hot",
          factors: {
            contextAge: 25,
            bullshitTrend: 0.5,
            promptSize: 60000,
            toolFailureRate: 0.1,
            consecutiveGrey: 4,
          },
          pacing: null,
          suggestBreathe: true,
        },
        humanState,
        mismatch: null,
      });

      expect(episode.chainAnalysis).not.toBeNull();
      expect(episode.chainAnalysis?.breakPoint).toContain("hot");
      expect(episode.chainAnalysis?.lesson).toBeDefined();
    });

    it("creates episode with black trigger", () => {
      const episode = episodeManager.startEpisode({
        pulse: blackPulse,
        turn: 10,
        signalState: null,
        discover: null,
        season: null,
        health: null,
        humanState: null,
        mismatch: null,
      });

      expect(episode.trigger).toBe("black_state");
      expect(episode.pulseState).toBe("black");
    });
  });

  describe("getCurrentEpisode", () => {
    it("returns the current episode after start", () => {
      episodeManager.startEpisode({
        pulse: greyPulse,
        turn: 5,
        signalState: null,
        discover: null,
        season: null,
        health: null,
        humanState: null,
        mismatch: null,
      });

      const current = episodeManager.getCurrentEpisode();
      expect(current).not.toBeNull();
      expect(current?.hexaflexStage).toBe("unprocessed");
    });
  });

  describe("canBeAlive", () => {
    it("returns false when episode is not integrated", () => {
      episodeManager.startEpisode({
        pulse: greyPulse,
        turn: 5,
        signalState: null,
        discover: null,
        season: null,
        health: null,
        humanState: null,
        mismatch: null,
      });

      expect(episodeManager.canBeAlive()).toBe(false);
    });
  });

  describe("advanceEpisode", () => {
    it("advances through hexaflex stages", () => {
      episodeManager.startEpisode({
        pulse: greyPulse,
        turn: 5,
        signalState: null,
        discover: null,
        season: null,
        health: null,
        humanState: null,
        mismatch: null,
      });

      // First advance: unprocessed -> acceptance
      const result1 = episodeManager.advanceEpisode({
        turn: 6,
        currentState: null,
        recentOutput: "I notice I'm being vague here.",
        humanInput: "Can you be more specific?",
        health: null,
      });

      expect(result1.episode.hexaflexStage).toBe("acceptance");
      expect(result1.completed).toBe(false);
    });

    it("returns shouldBreathe when health suggests it", () => {
      episodeManager.startEpisode({
        pulse: greyPulse,
        turn: 5,
        signalState: null,
        discover: null,
        season: null,
        health: null,
        humanState: null,
        mismatch: null,
      });

      const result = episodeManager.advanceEpisode({
        turn: 6,
        currentState: null,
        recentOutput: "test",
        humanInput: "test",
        health: {
          status: "fading",
          factors: {
            contextAge: 50,
            bullshitTrend: 0.6,
            promptSize: 90000,
            toolFailureRate: 0.3,
            consecutiveGrey: 6,
          },
          pacing: null,
          suggestBreathe: true,
        },
      });

      expect(result.shouldBreathe).toBe(true);
    });
  });

  describe("attachReflexion", () => {
    it("attaches reflexion to current episode", () => {
      episodeManager.startEpisode({
        pulse: greyPulse,
        turn: 5,
        signalState: null,
        discover: null,
        season: null,
        health: null,
        humanState: null,
        mismatch: null,
      });

      const reflexion: Reflexion = {
        id: "r-test-123",
        turn: 5,
        timestamp: new Date().toISOString(),
        trigger: "high_bullshit",
        what_happened: "Test reflexion",
        why_it_failed: "Testing",
        what_was_missed: "Nothing",
        next_time: "Keep testing",
        pulse_state: "grey",
        wise_mind: 0.5,
        bullshit_types: ["vagueness"],
      };

      episodeManager.attachReflexion(reflexion);

      const episode = episodeManager.getCurrentEpisode();
      expect(episode?.reflexions).toHaveLength(1);
      expect(episode?.reflexions[0]?.trigger).toBe("high_bullshit");
      expect(episode?.reflexions[0]?.lesson).toBe("Keep testing");
    });
  });

  describe("grey tracking", () => {
    it("increments consecutive grey", () => {
      episodeManager.incrementGrey();
      expect(episodeManager.getConsecutiveGrey()).toBe(1);
      episodeManager.incrementGrey();
      expect(episodeManager.getConsecutiveGrey()).toBe(2);
    });

    it("resets consecutive grey", () => {
      episodeManager.incrementGrey();
      episodeManager.incrementGrey();
      episodeManager.resetGrey();
      expect(episodeManager.getConsecutiveGrey()).toBe(0);
    });

    it("updateGreyFromPulse increments on grey", () => {
      episodeManager.updateGreyFromPulse("grey");
      expect(episodeManager.getConsecutiveGrey()).toBe(1);
    });

    it("updateGreyFromPulse resets on alive", () => {
      episodeManager.incrementGrey();
      episodeManager.incrementGrey();
      episodeManager.updateGreyFromPulse("alive");
      expect(episodeManager.getConsecutiveGrey()).toBe(0);
    });
  });

  describe("formatInjection", () => {
    it("returns null when no episode", () => {
      expect(episodeManager.formatInjection()).toBeNull();
    });

    it("returns formatted injection for active episode", () => {
      episodeManager.startEpisode({
        pulse: greyPulse,
        turn: 5,
        signalState: null,
        discover: null,
        season: null,
        health: null,
        humanState: null,
        mismatch: null,
      });

      const injection = episodeManager.formatInjection();
      expect(injection).not.toBeNull();
      expect(injection).toContain("## Processing");
      expect(injection).toContain("unprocessed");
    });
  });

  describe("serialization", () => {
    it("serializes and deserializes state", () => {
      episodeManager.startEpisode({
        pulse: greyPulse,
        turn: 5,
        signalState: null,
        discover: null,
        season: null,
        health: null,
        humanState: null,
        mismatch: null,
      });

      const serialized = episodeManager.serialize();
      expect(serialized.currentEpisode).not.toBeNull();
      expect(serialized.consecutiveGrey).toBe(0);

      episodeManager.reset();
      expect(episodeManager.getCurrentEpisode()).toBeNull();

      episodeManager.deserialize(serialized);
      expect(episodeManager.getCurrentEpisode()).not.toBeNull();
    });
  });
});
