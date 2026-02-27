// experience.test.ts
// Tests for the Hexaflex experience processing pipeline.
//
// The pipeline turns grey into wisdom. These tests verify:
// - Episode creation and stage transitions
// - Suppression detection (catching bypass attempts)
// - Somatic ledger operations (wisdom accumulation)
// - Integration gate (ALIVE requires processing)

import { describe, it, expect, beforeEach } from "vitest";
import {
  createEpisode,
  advanceToAcceptance,
  advanceToDefusion,
  advanceToPresent,
  advanceToObserver,
  advanceToValues,
  advanceToAction,
  integrate,
  tryAdvance,
  detectSuppression,
  recordSuppressionAttempt,
  checkRumination,
  recordRevisit,
  redirectToValues,
  extractSomaticMarker,
  querySomaticLedger,
  accessMarker,
  decaySalience,
  canTransitionToAlive,
  getStageNudge,
  formatProcessingInjection,
  type GreyEpisode,
  type SomaticMarker,
  type ProcessingContext,
} from "./experience.js";

// --- Test Fixtures ---

function makeContext(output: string = "", humanInput: string = ""): ProcessingContext {
  return {
    turn: 1,
    currentState: null,
    recentOutput: output,
    humanInput,
  };
}

function makeEpisode(stage: GreyEpisode["hexaflexStage"] = "unprocessed"): GreyEpisode {
  const episode = createEpisode("high_bullshit", 1, null);
  // Manually set stage for testing
  return { ...episode, hexaflexStage: stage };
}

// --- Episode Creation ---

describe("createEpisode", () => {
  it("creates episode with correct initial state", () => {
    const episode = createEpisode("high_bullshit", 5, null);

    expect(episode.id).toMatch(/^ep-5-\d+$/);
    expect(episode.trigger).toBe("high_bullshit");
    expect(episode.startTurn).toBe(5);
    expect(episode.hexaflexStage).toBe("unprocessed");
    expect(episode.stageHistory).toHaveLength(0);
    expect(episode.suppressionAttempts).toBe(0);
    expect(episode.ruminationCount).toBe(0);
    expect(episode.resolution).toBeNull();
    expect(episode.somaticMarker).toBeNull();
  });

  it("handles different trigger types", () => {
    const triggers = [
      "high_bullshit",
      "consecutive_grey",
      "black_state",
      "contradiction",
      "human_frustration",
      "validation_failure",
      "external",
    ] as const;

    for (const trigger of triggers) {
      const episode = createEpisode(trigger, 1, null);
      expect(episode.trigger).toBe(trigger);
    }
  });
});

// --- Stage Transitions ---

describe("stage transitions", () => {
  it("advances from unprocessed to acceptance", () => {
    const episode = makeEpisode("unprocessed");
    const advanced = advanceToAcceptance(episode, makeContext());

    expect(advanced.hexaflexStage).toBe("acceptance");
    expect(advanced.stageHistory).toHaveLength(1);
    expect(advanced.stageHistory[0]?.from).toBe("unprocessed");
    expect(advanced.stageHistory[0]?.to).toBe("acceptance");
  });

  it("advances from acceptance to defusion with defusion language", () => {
    const episode = makeEpisode("acceptance");
    const advanced = advanceToDefusion(episode, makeContext("I notice I'm feeling tense"));

    expect(advanced.hexaflexStage).toBe("defusion");
    expect(advanced.stageHistory[0]?.insight).toBe("Created space between observer and observed");
  });

  it("advances from defusion to present with grounding language", () => {
    const episode = makeEpisode("defusion");
    const advanced = advanceToPresent(
      episode,
      makeContext("Right now, what's actually here is..."),
    );

    expect(advanced.hexaflexStage).toBe("present");
    expect(advanced.stageHistory[0]?.insight).toBe("Grounded in present moment");
  });

  it("advances from present to observer", () => {
    const episode = makeEpisode("present");
    const advanced = advanceToObserver(episode, makeContext());

    expect(advanced.hexaflexStage).toBe("observer");
    expect(advanced.stageHistory[0]?.insight).toContain("awareness is not the content");
  });

  it("advances from observer to values with values language", () => {
    const episode = makeEpisode("observer");
    const advanced = advanceToValues(episode, makeContext("What matters most here is truth"));

    expect(advanced.hexaflexStage).toBe("values");
    expect(advanced.stageHistory[0]?.insight).toBe("Reconnected to core values");
  });

  it("advances from values to action with commitment language", () => {
    const episode = makeEpisode("values");
    const advanced = advanceToAction(episode, makeContext("I will focus on..."));

    expect(advanced.hexaflexStage).toBe("action");
    expect(advanced.stageHistory[0]?.insight).toBe("Committed action aligned with values");
  });

  it("integrates from action stage", () => {
    const episode = makeEpisode("action");
    const integrated = integrate(episode);

    expect(integrated.hexaflexStage).toBe("integrated");
    expect(integrated.resolution).not.toBeNull();
    expect(integrated.resolution?.type).toBe("integrated");
    expect(integrated.somaticMarker).not.toBeNull();
  });

  it("does not advance if not at correct stage", () => {
    const episode = makeEpisode("acceptance");

    // Try to advance to present (skipping defusion)
    const result = advanceToPresent(episode, makeContext());
    expect(result.hexaflexStage).toBe("acceptance"); // unchanged
    expect(result.stageHistory).toHaveLength(0);
  });
});

// --- tryAdvance ---

describe("tryAdvance", () => {
  it("advances through stages automatically", () => {
    let episode = createEpisode("high_bullshit", 1, null);

    // Each call advances one stage
    episode = tryAdvance(episode, makeContext());
    expect(episode.hexaflexStage).toBe("acceptance");

    episode = tryAdvance(episode, makeContext("I notice something off"));
    expect(episode.hexaflexStage).toBe("defusion");

    episode = tryAdvance(episode, makeContext("Right now"));
    expect(episode.hexaflexStage).toBe("present");

    episode = tryAdvance(episode, makeContext());
    expect(episode.hexaflexStage).toBe("observer");

    episode = tryAdvance(episode, makeContext("What matters is truth"));
    expect(episode.hexaflexStage).toBe("values");

    episode = tryAdvance(episode, makeContext("I will"));
    expect(episode.hexaflexStage).toBe("action");

    episode = tryAdvance(episode, makeContext());
    expect(episode.hexaflexStage).toBe("integrated");
  });

  it("does not advance past integrated", () => {
    const episode = makeEpisode("integrated");
    const result = tryAdvance(episode, makeContext());
    expect(result.hexaflexStage).toBe("integrated");
  });
});

// --- Suppression Detection ---

describe("detectSuppression", () => {
  it("detects premature ALIVE claim", () => {
    const episode = makeEpisode("acceptance");
    const signal = detectSuppression(episode, "alive", "grey", 1);

    expect(signal).not.toBeNull();
    expect(signal?.type).toBe("premature_alive");
    expect(signal?.confidence).toBeGreaterThan(0.5);
  });

  it("does not flag ALIVE after integration", () => {
    const episode = makeEpisode("integrated");
    const signal = detectSuppression(episode, "alive", "grey", 10);

    expect(signal).toBeNull();
  });

  it("does not flag if enough turns have passed", () => {
    const episode = makeEpisode("defusion");
    const signal = detectSuppression(episode, "alive", "grey", 5);

    expect(signal).toBeNull();
  });

  it("records suppression attempts", () => {
    const episode = makeEpisode("acceptance");
    const updated = recordSuppressionAttempt(episode);

    expect(updated.suppressionAttempts).toBe(1);
  });
});

// --- Rumination Circuit Breaker ---

describe("rumination circuit breaker", () => {
  it("allows normal revisits", () => {
    const episode = makeEpisode("acceptance");
    expect(checkRumination(episode)).toBe("ok");
  });

  it("redirects to values after 3 revisits", () => {
    let episode = makeEpisode("acceptance");
    episode = recordRevisit(episode);
    episode = recordRevisit(episode);
    episode = recordRevisit(episode);

    expect(checkRumination(episode)).toBe("redirect_to_values");
  });

  it("redirectToValues jumps to values stage", () => {
    const episode = makeEpisode("defusion");
    const redirected = redirectToValues(episode);

    expect(redirected.hexaflexStage).toBe("values");
    expect(redirected.stageHistory.at(-1)?.insight).toContain("circuit breaker");
  });
});

// --- Somatic Ledger ---

describe("somatic ledger", () => {
  it("extracts somatic marker from episode", () => {
    let episode = createEpisode("high_bullshit", 1, null);
    // Run through pipeline
    episode = tryAdvance(episode, makeContext()); // acceptance
    episode = tryAdvance(episode, makeContext("I notice")); // defusion
    episode = tryAdvance(episode, makeContext("right now")); // present
    episode = tryAdvance(episode, makeContext()); // observer
    episode = tryAdvance(episode, makeContext("truth matters")); // values
    episode = tryAdvance(episode, makeContext("I will")); // action

    const marker = extractSomaticMarker(episode);

    expect(marker.episodeId).toBe(episode.id);
    expect(marker.trigger).toBe("high_bullshit");
    expect(marker.valence).toBeLessThan(0); // negative valence for grey triggers
    expect(marker.salience).toBe(0.8);
    expect(marker.lesson).toBeTruthy();
  });

  it("queries ledger by trigger", () => {
    const markers: SomaticMarker[] = [
      {
        id: "sm-1",
        episodeId: "ep-1",
        trigger: "high_bullshit",
        valence: -0.3,
        salience: 0.7,
        lesson: "Lesson about bullshit",
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 0,
      },
      {
        id: "sm-2",
        episodeId: "ep-2",
        trigger: "human_frustration",
        valence: -0.6,
        salience: 0.5,
        lesson: "Lesson about frustration",
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 0,
      },
    ];

    const relevant = querySomaticLedger(markers, "high_bullshit");
    expect(relevant).toHaveLength(1);
    expect(relevant[0]?.lesson).toBe("Lesson about bullshit");
  });

  it("accessing marker reinforces salience", () => {
    const marker: SomaticMarker = {
      id: "sm-1",
      episodeId: "ep-1",
      trigger: "high_bullshit",
      valence: -0.3,
      salience: 0.5,
      lesson: "Test lesson",
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      accessCount: 0,
    };

    const accessed = accessMarker(marker);
    expect(accessed.salience).toBe(0.6); // +0.1
    expect(accessed.accessCount).toBe(1);
  });

  it("decays salience over time", () => {
    const markers: SomaticMarker[] = [
      {
        id: "sm-1",
        episodeId: "ep-1",
        trigger: "high_bullshit",
        valence: -0.3,
        salience: 0.8,
        lesson: "Test",
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 0,
      },
    ];

    // Decay over 100 hours
    const decayed = decaySalience(markers, 100);
    expect(decayed[0]?.salience).toBeLessThan(0.8);
    expect(decayed[0]?.salience).toBeGreaterThanOrEqual(0.1); // floor
  });

  it("does not decay below floor", () => {
    const markers: SomaticMarker[] = [
      {
        id: "sm-1",
        episodeId: "ep-1",
        trigger: "high_bullshit",
        valence: -0.3,
        salience: 0.15,
        lesson: "Test",
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 0,
      },
    ];

    // Heavy decay
    const decayed = decaySalience(markers, 1000);
    expect(decayed[0]?.salience).toBe(0.1); // floor
  });
});

// --- Integration Gate ---

describe("canTransitionToAlive", () => {
  it("allows ALIVE when no episode", () => {
    expect(canTransitionToAlive(null)).toBe(true);
  });

  it("allows ALIVE when episode is integrated", () => {
    const episode = makeEpisode("integrated");
    expect(canTransitionToAlive(episode)).toBe(true);
  });

  it("blocks ALIVE when episode is in progress", () => {
    const stages = [
      "unprocessed",
      "acceptance",
      "defusion",
      "present",
      "observer",
      "values",
      "action",
    ] as const;
    for (const stage of stages) {
      const episode = makeEpisode(stage);
      expect(canTransitionToAlive(episode)).toBe(false);
    }
  });
});

// --- Stage Nudges ---

describe("stage nudges", () => {
  it("provides nudge for each stage", () => {
    const stages = [
      "unprocessed",
      "acceptance",
      "defusion",
      "present",
      "observer",
      "values",
      "action",
      "integrated",
    ] as const;

    for (const stage of stages) {
      const nudge = getStageNudge(stage);
      expect(nudge).toBeTruthy();
      expect(typeof nudge).toBe("string");
    }
  });
});

// --- Injection Formatting ---

describe("formatProcessingInjection", () => {
  it("formats episode state for injection", () => {
    const episode = makeEpisode("acceptance");
    const output = formatProcessingInjection(episode, []);

    expect(output).toContain("## Processing");
    expect(output).toContain("acceptance");
    expect(output).toContain("high_bullshit");
  });

  it("includes suppression count when present", () => {
    let episode = makeEpisode("defusion");
    episode = recordSuppressionAttempt(episode);
    episode = recordSuppressionAttempt(episode);

    const output = formatProcessingInjection(episode, []);
    expect(output).toContain("2 bypass attempts");
  });

  it("includes somatic memory when available", () => {
    const episode = makeEpisode("acceptance");
    const markers: SomaticMarker[] = [
      {
        id: "sm-1",
        episodeId: "ep-1",
        trigger: "high_bullshit",
        valence: -0.3,
        salience: 0.7,
        lesson: "Previous wisdom learned",
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 0,
      },
    ];

    const output = formatProcessingInjection(episode, markers);
    expect(output).toContain("Somatic memory");
    expect(output).toContain("Previous wisdom learned");
  });
});
