// breathe.test.ts
// The permission to be silent, tested.

import { describe, expect, it, beforeEach } from "vitest";
import type { PulseReading } from "../shared/types.js";
import {
  recordBreathe,
  getEvents,
  lastBreatheEvent,
  breatheCount,
  postBreatheInjection,
  setSessionId,
  reset,
} from "./breathe.js";

// ============================================================
// Helpers
// ============================================================

function makePulse(overrides: Partial<PulseReading> = {}): PulseReading {
  return {
    state: "alive",
    confidence: 0.8,
    wise_mind: 0.65,
    colors: { red: 0.3, yellow: 0.4, blue: 0.3 },
    signals: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================
// Recording
// ============================================================

describe("recordBreathe", () => {
  beforeEach(() => {
    reset();
    setSessionId("test-session");
  });

  it("records a breathe event with correct pulse state", () => {
    const pulse = makePulse({ state: "grey", wise_mind: 0.3 });
    const event = recordBreathe(5, "need a beat", pulse, 3);

    expect(event.turn).toBe(5);
    expect(event.session_id).toBe("test-session");
    expect(event.pulse_before).toBe("grey");
    expect(event.wise_mind_before).toBe(0.3);
    expect(event.grey_streak).toBe(3);
    expect(event.reason).toBe("need a beat");
    expect(event.created_at).toBeTruthy();
  });

  it("records multiple breathe events", () => {
    const pulse = makePulse();
    recordBreathe(5, "first pause", pulse, 0);
    recordBreathe(12, "second pause", pulse, 2);

    expect(breatheCount()).toBe(2);
    expect(getEvents()).toHaveLength(2);
  });

  it("handles null pulse gracefully", () => {
    const event = recordBreathe(1, "no reading yet", null, 0);

    expect(event.pulse_before).toBe("grey");
    expect(event.wise_mind_before).toBe(0);
  });

  it("returns the most recent event via lastBreatheEvent", () => {
    const pulse1 = makePulse({ state: "alive" });
    const pulse2 = makePulse({ state: "grey" });
    recordBreathe(5, "first", pulse1, 0);
    recordBreathe(10, "second", pulse2, 3);

    const last = lastBreatheEvent();
    expect(last?.turn).toBe(10);
    expect(last?.pulse_before).toBe("grey");
  });

  it("returns null when no events exist", () => {
    expect(lastBreatheEvent()).toBeNull();
    expect(breatheCount()).toBe(0);
  });
});

// ============================================================
// Post-breathe injection
// ============================================================

describe("postBreatheInjection", () => {
  it("generates injection text from breathe event", () => {
    const event = recordBreathe(5, "going grey", makePulse({ state: "grey", wise_mind: 0.25 }), 4);
    const text = postBreatheInjection(event);

    expect(text).toContain("you breathed last turn");
    expect(text).toContain("grey");
    expect(text).toContain("0.25");
    expect(text).toContain("what do you want to do now?");
  });

  it("returns null when no event provided", () => {
    expect(postBreatheInjection(null)).toBeNull();
  });
});

// ============================================================
// Reset
// ============================================================

describe("reset", () => {
  it("clears all events", () => {
    reset();
    recordBreathe(1, "test", makePulse(), 0);
    recordBreathe(2, "test", makePulse(), 0);
    expect(breatheCount()).toBe(2);

    reset();
    expect(breatheCount()).toBe(0);
    expect(lastBreatheEvent()).toBeNull();
  });
});
