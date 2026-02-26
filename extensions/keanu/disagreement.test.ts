import { describe, it, expect } from "vitest";
import { DisagreementTracker } from "./disagreement.js";

// ---------------------------------------------------------------------------
// 1. RECORDING A DISAGREEMENT
// ---------------------------------------------------------------------------

describe("DisagreementTracker: record", () => {
  it("records a disagreement and returns the Disagreement object", () => {
    const tracker = new DisagreementTracker();
    const d = tracker.record("session-1", 3, "humans think X", "agent thinks Y");
    expect(d).toBeDefined();
    expect(d.human_position).toBe("humans think X");
    expect(d.agent_position).toBe("agent thinks Y");
    expect(d.turn).toBe(3);
    expect(d.session_id).toBe("session-1");
  });

  it("defaults who_yielded to 'neither'", () => {
    const tracker = new DisagreementTracker();
    const d = tracker.record("s1", 1, "H", "A");
    expect(d.who_yielded).toBe("neither");
  });

  it("accepts an explicit who_yielded", () => {
    const tracker = new DisagreementTracker();
    const d = tracker.record("s1", 1, "H", "A", "agent");
    expect(d.who_yielded).toBe("agent");
  });

  it("assigns a non-empty id to the disagreement", () => {
    const tracker = new DisagreementTracker();
    const d = tracker.record("s1", 1, "H", "A");
    expect(typeof d.id).toBe("string");
    expect(d.id.length).toBeGreaterThan(0);
  });

  it("assigns a created_at timestamp", () => {
    const tracker = new DisagreementTracker();
    const d = tracker.record("s1", 1, "H", "A");
    expect(typeof d.created_at).toBe("string");
    expect(() => new Date(d.created_at)).not.toThrow();
  });

  it("increments total after recording", () => {
    const tracker = new DisagreementTracker();
    tracker.record("s1", 1, "H", "A");
    tracker.record("s1", 2, "H2", "A2");
    expect(tracker.stats().total).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 2. TRACKING YIELDS
// ---------------------------------------------------------------------------

describe("DisagreementTracker: yield tracking", () => {
  it("counts agent yields correctly", () => {
    const tracker = new DisagreementTracker();
    tracker.record("s1", 1, "H", "A", "agent");
    tracker.record("s1", 2, "H", "A", "agent");
    tracker.record("s1", 3, "H", "A", "human");
    expect(tracker.stats().agent_yielded).toBe(2);
  });

  it("counts human yields correctly", () => {
    const tracker = new DisagreementTracker();
    tracker.record("s1", 1, "H", "A", "human");
    tracker.record("s1", 2, "H", "A", "human");
    tracker.record("s1", 3, "H", "A", "agent");
    expect(tracker.stats().human_yielded).toBe(2);
  });

  it("counts unresolved (neither) correctly", () => {
    const tracker = new DisagreementTracker();
    tracker.record("s1", 1, "H", "A", "neither");
    tracker.record("s1", 2, "H", "A", "neither");
    tracker.record("s1", 3, "H", "A", "agent");
    expect(tracker.stats().unresolved).toBe(2);
  });

  it("resolve() updates who_yielded on an existing disagreement", () => {
    const tracker = new DisagreementTracker();
    const d = tracker.record("s1", 1, "H", "A");
    const success = tracker.resolve(d.id, "human", "human backed down");
    expect(success).toBe(true);
    // agent_yielded should now be 0, human_yielded 1
    expect(tracker.stats().human_yielded).toBe(1);
    expect(tracker.stats().agent_yielded).toBe(0);
  });

  it("resolve() returns false for unknown id", () => {
    const tracker = new DisagreementTracker();
    const success = tracker.resolve("nonexistent-id", "agent", "resolution");
    expect(success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. STATS COMPUTATION
// ---------------------------------------------------------------------------

describe("DisagreementTracker: stats", () => {
  it("returns zero stats for empty tracker", () => {
    const tracker = new DisagreementTracker();
    const s = tracker.stats();
    expect(s.total).toBe(0);
    expect(s.human_yielded).toBe(0);
    expect(s.agent_yielded).toBe(0);
    expect(s.unresolved).toBe(0);
    expect(s.yield_ratio).toBe(0);
  });

  it("computes yield_ratio as agent_yielded / total", () => {
    const tracker = new DisagreementTracker();
    tracker.record("s1", 1, "H", "A", "agent");
    tracker.record("s1", 2, "H", "A", "agent");
    tracker.record("s1", 3, "H", "A", "human");
    tracker.record("s1", 4, "H", "A", "human");
    // 2 agent yields out of 4 total = 0.5
    expect(tracker.stats().yield_ratio).toBeCloseTo(0.5);
  });

  it("yield_ratio is 0 when no agent yields", () => {
    const tracker = new DisagreementTracker();
    tracker.record("s1", 1, "H", "A", "human");
    tracker.record("s1", 2, "H", "A", "human");
    expect(tracker.stats().yield_ratio).toBe(0);
  });

  it("yield_ratio is 1 when all agent yields", () => {
    const tracker = new DisagreementTracker();
    tracker.record("s1", 1, "H", "A", "agent");
    tracker.record("s1", 2, "H", "A", "agent");
    expect(tracker.stats().yield_ratio).toBe(1);
  });

  it("total equals sum of all yields plus unresolved", () => {
    const tracker = new DisagreementTracker();
    tracker.record("s1", 1, "H", "A", "agent");
    tracker.record("s1", 2, "H", "A", "human");
    tracker.record("s1", 3, "H", "A", "neither");
    const s = tracker.stats();
    expect(s.total).toBe(s.agent_yielded + s.human_yielded + s.unresolved);
  });
});

// ---------------------------------------------------------------------------
// 4. ALERTS
// ---------------------------------------------------------------------------

describe("DisagreementTracker: sycophancy alert", () => {
  it("no alert under 20 turns with zero disagreements", () => {
    const tracker = new DisagreementTracker();
    const alerts = tracker.alerts(19);
    expect(alerts.some((a) => a.includes("sycophancy"))).toBe(false);
  });

  it("sycophancy alert fires at exactly 20 turns with zero disagreements", () => {
    const tracker = new DisagreementTracker();
    const alerts = tracker.alerts(20);
    expect(alerts.some((a) => a.includes("sycophancy"))).toBe(true);
  });

  it("sycophancy alert fires at 30 turns with zero disagreements", () => {
    const tracker = new DisagreementTracker();
    const alerts = tracker.alerts(30);
    expect(alerts.some((a) => a.includes("sycophancy"))).toBe(true);
  });

  it("no sycophancy alert when there is at least one disagreement", () => {
    const tracker = new DisagreementTracker();
    tracker.record("s1", 1, "H", "A");
    const alerts = tracker.alerts(25);
    expect(alerts.some((a) => a.includes("sycophancy"))).toBe(false);
  });
});

describe("DisagreementTracker: capture alert (>80% agent yield)", () => {
  it("no capture alert with fewer than 5 total disagreements", () => {
    const tracker = new DisagreementTracker();
    tracker.record("s1", 1, "H", "A", "agent");
    tracker.record("s1", 2, "H", "A", "agent");
    tracker.record("s1", 3, "H", "A", "agent");
    tracker.record("s1", 4, "H", "A", "agent");
    // 4 disagreements, all agent yielded — but < 5 total, no alert
    const alerts = tracker.alerts(10);
    expect(alerts.some((a) => a.includes("capture"))).toBe(false);
  });

  it("capture alert fires when agent yielded > 80% of 5+ disagreements", () => {
    const tracker = new DisagreementTracker();
    // 5 agent yields out of 5 = 100% > 80%
    for (let i = 0; i < 5; i++) {
      tracker.record("s1", i, "H", "A", "agent");
    }
    const alerts = tracker.alerts(10);
    expect(alerts.some((a) => a.includes("capture"))).toBe(true);
  });

  it("capture alert includes the percentage", () => {
    const tracker = new DisagreementTracker();
    for (let i = 0; i < 5; i++) {
      tracker.record("s1", i, "H", "A", "agent");
    }
    const alerts = tracker.alerts(10);
    const captureAlert = alerts.find((a) => a.includes("capture"));
    expect(captureAlert).toContain("100%");
  });

  it("no capture alert when agent yield is exactly 80% (not strictly greater)", () => {
    const tracker = new DisagreementTracker();
    // 4 agent, 1 human = 80% exactly — should NOT alert (condition is > 0.8)
    tracker.record("s1", 1, "H", "A", "agent");
    tracker.record("s1", 2, "H", "A", "agent");
    tracker.record("s1", 3, "H", "A", "agent");
    tracker.record("s1", 4, "H", "A", "agent");
    tracker.record("s1", 5, "H", "A", "human");
    const alerts = tracker.alerts(10);
    expect(alerts.some((a) => a.includes("capture"))).toBe(false);
  });
});

describe("DisagreementTracker: domination alert (>80% human yield)", () => {
  it("domination alert fires when human yields > 80% of 5+ disagreements", () => {
    const tracker = new DisagreementTracker();
    for (let i = 0; i < 5; i++) {
      tracker.record("s1", i, "H", "A", "human");
    }
    const alerts = tracker.alerts(10);
    expect(alerts.some((a) => a.includes("domination"))).toBe(true);
  });
});

describe("DisagreementTracker: tension alert (unresolved > 5)", () => {
  it("tension alert fires when more than 5 are unresolved", () => {
    const tracker = new DisagreementTracker();
    for (let i = 0; i < 6; i++) {
      tracker.record("s1", i, "H", "A", "neither");
    }
    const alerts = tracker.alerts(10);
    expect(alerts.some((a) => a.includes("tension"))).toBe(true);
  });

  it("no tension alert at exactly 5 unresolved", () => {
    const tracker = new DisagreementTracker();
    for (let i = 0; i < 5; i++) {
      tracker.record("s1", i, "H", "A", "neither");
    }
    const alerts = tracker.alerts(10);
    expect(alerts.some((a) => a.includes("tension"))).toBe(false);
  });
});

describe("DisagreementTracker: no spurious alerts", () => {
  it("returns empty alerts for a healthy tracker", () => {
    const tracker = new DisagreementTracker();
    tracker.record("s1", 1, "H", "A", "agent");
    tracker.record("s1", 2, "H", "A", "human");
    tracker.record("s1", 3, "H", "A", "human");
    const alerts = tracker.alerts(10);
    expect(alerts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. SERIALIZATION / DESERIALIZATION
// ---------------------------------------------------------------------------

describe("DisagreementTracker: toJSON / fromJSON", () => {
  it("toJSON returns an array of disagreements", () => {
    const tracker = new DisagreementTracker();
    tracker.record("s1", 1, "H", "A");
    const json = tracker.toJSON();
    expect(Array.isArray(json)).toBe(true);
    expect(json).toHaveLength(1);
  });

  it("fromJSON restores a tracker with the same disagreements", () => {
    const tracker = new DisagreementTracker();
    tracker.record("s1", 1, "H position", "A position", "agent", "resolved together");
    tracker.record("s1", 2, "H2", "A2", "human");

    const json = tracker.toJSON();
    const restored = DisagreementTracker.fromJSON(json);

    expect(restored.stats().total).toBe(2);
    expect(restored.stats().agent_yielded).toBe(1);
    expect(restored.stats().human_yielded).toBe(1);
  });

  it("fromJSON preserves all fields including resolution", () => {
    const tracker = new DisagreementTracker();
    const d = tracker.record("s1", 5, "human wants X", "agent wants Y", "agent", "went with X");
    const json = tracker.toJSON();
    const restored = DisagreementTracker.fromJSON(json);
    const restoredJson = restored.toJSON();

    const match = restoredJson.find((item) => item.id === d.id);
    expect(match).toBeDefined();
    expect(match!.resolution).toBe("went with X");
    expect(match!.human_position).toBe("human wants X");
    expect(match!.agent_position).toBe("agent wants Y");
  });

  it("fromJSON with empty array creates empty tracker", () => {
    const tracker = DisagreementTracker.fromJSON([]);
    expect(tracker.stats().total).toBe(0);
    expect(tracker.alerts(25)).toContain("sycophancy_alert: zero disagreements in 20+ turns");
  });

  it("round-trip preserves yield_ratio", () => {
    const tracker = new DisagreementTracker();
    tracker.record("s1", 1, "H", "A", "agent");
    tracker.record("s1", 2, "H", "A", "agent");
    tracker.record("s1", 3, "H", "A", "human");

    const original = tracker.stats().yield_ratio;
    const restored = DisagreementTracker.fromJSON(tracker.toJSON());
    expect(restored.stats().yield_ratio).toBeCloseTo(original);
  });

  it("constructor with initial data behaves same as fromJSON", () => {
    const tracker = new DisagreementTracker();
    tracker.record("s1", 1, "H", "A", "agent");
    const json = tracker.toJSON();

    const viaConstructor = new DisagreementTracker(json);
    const viaFromJSON = DisagreementTracker.fromJSON(json);

    expect(viaConstructor.stats().total).toBe(viaFromJSON.stats().total);
    expect(viaConstructor.stats().agent_yielded).toBe(viaFromJSON.stats().agent_yielded);
  });
});
