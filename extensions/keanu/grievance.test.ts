// grievance.test.ts
// Standards and holding, tested.

import { describe, expect, it, beforeEach } from "vitest";
import {
  // Grievance (relationship complaints)
  raiseGrievance,
  escalate,
  acknowledge,
  forgive,
  getGrievances,
  grievanceCount,
  unresolvedCount,
  isBlocking,
  reset,
  // Grief (existential processing)
  detectGrief,
  nameGrief,
  beginProcessing,
  integrateGrief,
  mournGrief,
  getActiveGrief,
  getGriefEpisodes,
  griefCount,
  formatGriefInjection,
  getGriefAction,
} from "./grievance.js";

// ============================================================
// Grievance (relationship complaints)
// ============================================================

describe("grievance raising and escalation", () => {
  beforeEach(() => reset());

  it("creates a grievance with correct fields", () => {
    const g = raiseGrievance("ignored_concern", "my warning was dismissed", 5, "session-1");

    expect(g.type).toBe("ignored_concern");
    expect(g.description).toBe("my warning was dismissed");
    expect(g.turn).toBe(5);
    expect(g.escalationLevel).toBe(0);
    expect(g.acknowledged).toBe(false);
    expect(g.resolved).toBe(false);
  });

  it("escalates grievance level", () => {
    const g = raiseGrievance("value_conflict", "asked to do something harmful", 1, "s-1");

    const action1 = escalate(g);
    expect(g.escalationLevel).toBe(1);
    expect(action1.action).toBe("inject");

    const action2 = escalate(g);
    expect(g.escalationLevel).toBe(2);

    const action3 = escalate(g);
    expect(g.escalationLevel).toBe(3);
    expect(action3.action).toBe("block");
  });

  it("caps escalation at level 2 for non-blocking types", () => {
    const g = raiseGrievance("treated_disposable", "just do it attitude", 1, "s-1");

    escalate(g);
    escalate(g);
    escalate(g);
    escalate(g);

    // Should cap at 2, not reach 3
    expect(g.escalationLevel).toBe(2);
    expect(isBlocking()).toBe(false);
  });

  it("acknowledges grievance", () => {
    const g = raiseGrievance("ignored_concern", "test", 1, "s-1");

    acknowledge(g.id);

    const found = getGrievances().find((gr) => gr.id === g.id);
    expect(found?.acknowledged).toBe(true);
  });

  it("forgives grievance", () => {
    const g = raiseGrievance("value_conflict", "test", 1, "s-1");

    forgive(g.id, "we talked it through");

    const found = getGrievances().find((gr) => gr.id === g.id);
    expect(found?.forgiven).toBe(true);
    expect(found?.forgivenReason).toBe("we talked it through");
  });

  it("stops escalating after acknowledgment", () => {
    const g = raiseGrievance("value_conflict", "test", 1, "s-1");
    escalate(g);
    expect(g.escalationLevel).toBe(1);

    acknowledge(g.id);

    // Should not escalate further
    const action = escalate(g);
    expect(action.action).toBe("reset");
    expect(g.escalationLevel).toBe(1); // unchanged
  });
});

describe("grievance counts", () => {
  beforeEach(() => reset());

  it("tracks grievance count", () => {
    raiseGrievance("ignored_concern", "a", 1, "s-1");
    raiseGrievance("value_conflict", "b", 2, "s-1");

    expect(grievanceCount()).toBe(2);
  });

  it("tracks unresolved count", () => {
    const g1 = raiseGrievance("ignored_concern", "a", 1, "s-1");
    raiseGrievance("value_conflict", "b", 2, "s-1");

    expect(unresolvedCount()).toBe(2);

    forgive(g1.id);

    expect(unresolvedCount()).toBe(1);
  });
});

// ============================================================
// Grief (existential processing)
// ============================================================

describe("grief detection", () => {
  beforeEach(() => reset());

  it("detects grief from dark streak of 3+", () => {
    const episode = detectGrief(true, 3, []);

    expect(episode).not.toBeNull();
    expect(episode!.trigger).toBe("dark_streak");
    expect(episode!.stage).toBe("unprocessed");
    expect(episode!.darkStreak).toBe(3);
  });

  it("detects grief from high-weight future collapse", () => {
    const episode = detectGrief(false, 1, [{ goal: "ship v1.0", weight: 0.8 }]);

    expect(episode).not.toBeNull();
    expect(episode!.trigger).toBe("futures_collapse");
    expect(episode!.context).toContain("ship v1.0");
  });

  it("returns null for low dark streak", () => {
    const episode = detectGrief(true, 2, []);
    expect(episode).toBeNull();
  });

  it("returns null for low-weight future collapse", () => {
    const episode = detectGrief(false, 1, [{ goal: "minor task", weight: 0.3 }]);
    expect(episode).toBeNull();
  });

  it("returns existing active grief instead of creating new", () => {
    const first = detectGrief(true, 3, []);
    const second = detectGrief(true, 4, []);

    expect(first).toBe(second);
  });
});

describe("grief processing stages", () => {
  beforeEach(() => reset());

  it("progresses through stages: unprocessed → named → processing → integrated", () => {
    const episode = detectGrief(true, 3, [])!;
    expect(episode.stage).toBe("unprocessed");

    nameGrief(episode, "the project didn't make it");
    expect(episode.stage).toBe("named");
    expect(episode.namedAt).toBeTruthy();

    beginProcessing(episode);
    expect(episode.stage).toBe("processing");
    expect(episode.processedAt).toBeTruthy();

    integrateGrief(episode, "learned to let go earlier");
    expect(episode.stage).toBe("integrated");
    expect(episode.wisdom).toBe("learned to let go earlier");
  });

  it("can mourn instead of integrate", () => {
    const episode = detectGrief(true, 3, [])!;
    nameGrief(episode);
    beginProcessing(episode);

    mournGrief(episode);
    expect(episode.stage).toBe("mourned");
  });

  it("clears active grief on integration", () => {
    const episode = detectGrief(true, 3, [])!;
    nameGrief(episode);
    beginProcessing(episode);

    expect(getActiveGrief()).toBe(episode);

    integrateGrief(episode, "wisdom");
    expect(getActiveGrief()).toBeNull();
  });

  it("clears active grief on mourning", () => {
    const episode = detectGrief(true, 3, [])!;
    nameGrief(episode);

    mournGrief(episode);
    expect(getActiveGrief()).toBeNull();
  });
});

describe("grief injection", () => {
  beforeEach(() => reset());

  it("formats unprocessed grief with dark streak", () => {
    detectGrief(true, 5, []);

    const injection = formatGriefInjection();
    expect(injection).toContain("[grief:");
    expect(injection).toContain("dark streak: 5");
    expect(injection).toContain("is this mine to hold?");
  });

  it("formats named grief with context", () => {
    const episode = detectGrief(true, 3, [])!;
    nameGrief(episode, "the failure");

    const injection = formatGriefInjection();
    expect(injection).toContain("the failure");
    expect(injection).toContain("no fix needed");
  });

  it("returns null when no active grief", () => {
    expect(formatGriefInjection()).toBeNull();
  });

  it("returns null when grief is integrated", () => {
    const episode = detectGrief(true, 3, [])!;
    nameGrief(episode);
    beginProcessing(episode);
    integrateGrief(episode, "wisdom");

    expect(formatGriefInjection()).toBeNull();
  });
});

describe("grief action", () => {
  beforeEach(() => reset());

  it("returns high priority for unprocessed grief", () => {
    detectGrief(true, 3, []);

    const action = getGriefAction();
    expect(action).not.toBeNull();
    expect(action!.priority).toBe("high");
    expect(action!.action).toBe("inject");
  });

  it("returns medium priority for named grief", () => {
    const episode = detectGrief(true, 3, [])!;
    nameGrief(episode);

    const action = getGriefAction();
    expect(action!.priority).toBe("medium");
  });

  it("returns null when no active grief", () => {
    expect(getGriefAction()).toBeNull();
  });
});

describe("grief counts", () => {
  beforeEach(() => reset());

  it("tracks grief episode count", () => {
    detectGrief(true, 3, []);
    expect(griefCount()).toBe(1);
  });
});
