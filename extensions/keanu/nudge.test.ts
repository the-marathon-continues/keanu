import { describe, it, expect, beforeEach } from "vitest";
import {
  getNudge,
  getStopSignal,
  getGreyStreakQuestion,
  getRecoveryNudge,
  getEscalationSignal,
  createRecovery,
  tickRecovery,
  escalateRecovery,
} from "./nudge.js";
import type { PulseReading } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePulse(overrides: Partial<PulseReading> = {}): PulseReading {
  return {
    state: "grey",
    confidence: 0.6,
    wise_mind: 0.5,
    colors: { red: 0.3, yellow: 0.3, blue: 0.3 },
    signals: [],
    bullshitReadings: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. getNudge
// ---------------------------------------------------------------------------

describe("getNudge: alive state", () => {
  it("returns null for alive state", () => {
    const result = getNudge("alive", false, 0);
    expect(result).toBeNull();
  });

  it("returns null for alive state even with high consecutive grey", () => {
    const result = getNudge("alive", false, 10);
    expect(result).toBeNull();
  });
});

describe("getNudge: breathing", () => {
  it("returns null when breathing is true, even in grey state", () => {
    const result = getNudge("grey", true, 0);
    expect(result).toBeNull();
  });

  it("returns null when breathing is true in black state", () => {
    const result = getNudge("black", true, 5);
    expect(result).toBeNull();
  });
});

describe("getNudge: grey state", () => {
  it("returns a non-null string for grey state with no breathing", () => {
    const result = getNudge("grey", false, 0);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("nudge for grey state contains DEAR MAN sections", () => {
    const result = getNudge("grey", false, 0);
    expect(result).toContain("[observe:");
    expect(result).toContain("[interpret:");
    expect(result).toContain("[suggest:");
    expect(result).toContain("[permit:");
  });

  it("consecutive grey >= 3 returns a streak nudge", () => {
    // CONSECUTIVE_GREY_NUDGES is used at consecutiveGrey >= 3
    const result = getNudge("grey", false, 3);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
    expect(result).toContain("[observe:");
  });
});

describe("getNudge: black state", () => {
  it("returns a nudge for black state", () => {
    const result = getNudge("black", false, 0);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("black nudge contains STOP or halt language", () => {
    // BLACK_NUDGES have 'stop' / 'pause' / 'halt' in observe or suggest
    const result = getNudge("black", false, 0);
    const lower = result!.toLowerCase();
    // black nudges say things like "stop" or "pause"
    expect(lower.includes("stop") || lower.includes("pause") || lower.includes("black")).toBe(true);
  });

  it("black state nudge has DEAR MAN structure", () => {
    const result = getNudge("black", false, 0);
    expect(result).toContain("[observe:");
    expect(result).toContain("[permit:");
  });
});

// ---------------------------------------------------------------------------
// 2. getStopSignal
// ---------------------------------------------------------------------------

describe("getStopSignal", () => {
  it("returns a string", () => {
    const pulse = makePulse({ state: "black", confidence: 0.3, wise_mind: 0.2 });
    const result = getStopSignal(pulse, 0);
    expect(typeof result).toBe("string");
  });

  it("includes [STOP: in the output", () => {
    const pulse = makePulse({ state: "black", confidence: 0.3, wise_mind: 0.2 });
    const result = getStopSignal(pulse, 0);
    expect(result).toContain("[STOP:");
  });

  it("includes 'BLACK' in the output", () => {
    const pulse = makePulse({ state: "black", confidence: 0.3, wise_mind: 0.2 });
    const result = getStopSignal(pulse, 0);
    expect(result).toContain("BLACK");
  });

  it("includes confidence value", () => {
    const pulse = makePulse({ state: "black", confidence: 0.45, wise_mind: 0.3 });
    const result = getStopSignal(pulse, 0);
    expect(result).toContain("0.45");
  });

  it("includes wise_mind value", () => {
    const pulse = makePulse({ state: "black", confidence: 0.3, wise_mind: 0.25 });
    const result = getStopSignal(pulse, 0);
    expect(result).toContain("0.25");
  });

  it("adds streak line when consecutiveGrey >= 5", () => {
    const pulse = makePulse({ state: "black", confidence: 0.3, wise_mind: 0.2 });
    const result = getStopSignal(pulse, 5);
    expect(result).toContain("5 consecutive");
  });

  it("does not add streak line when consecutiveGrey < 5", () => {
    const pulse = makePulse({ state: "black", confidence: 0.3, wise_mind: 0.2 });
    const result = getStopSignal(pulse, 4);
    expect(result).not.toContain("consecutive");
  });

  it("always includes a resume/redirect/breathe line", () => {
    const pulse = makePulse({ state: "black", confidence: 0.3, wise_mind: 0.2 });
    const result = getStopSignal(pulse, 0);
    expect(result).toContain("resume");
  });
});

// ---------------------------------------------------------------------------
// 3. getGreyStreakQuestion
// ---------------------------------------------------------------------------

// The function uses module-level state (greyStreakSurfaced). We need to reset
// between tests by driving consecutiveGrey below 5 first to reset the flag.
// We do that with beforeEach.

describe("getGreyStreakQuestion: below threshold", () => {
  beforeEach(() => {
    // Reset state by passing < 5 (sets greyStreakSurfaced = false)
    getGreyStreakQuestion(0);
  });

  it("returns null when consecutiveGrey is 0", () => {
    expect(getGreyStreakQuestion(0)).toBeNull();
  });

  it("returns null when consecutiveGrey is 4", () => {
    expect(getGreyStreakQuestion(4)).toBeNull();
  });
});

describe("getGreyStreakQuestion: at and above threshold", () => {
  beforeEach(() => {
    // Reset the surfaced flag
    getGreyStreakQuestion(0);
  });

  it("returns a string when consecutiveGrey is exactly 5", () => {
    const result = getGreyStreakQuestion(5);
    expect(typeof result).toBe("string");
    expect(result).not.toBeNull();
  });

  it("mentions keanu_breathe in the question", () => {
    const result = getGreyStreakQuestion(5);
    expect(result).toContain("keanu_breathe");
  });

  it("includes the consecutive count in the message", () => {
    const result = getGreyStreakQuestion(7);
    expect(result).toContain("7");
  });

  it("returns null on second call with same high count (no nag)", () => {
    getGreyStreakQuestion(5); // first call — surfaces it
    const second = getGreyStreakQuestion(5); // second call — should be null
    expect(second).toBeNull();
  });

  it("resets and fires again after streak breaks", () => {
    getGreyStreakQuestion(5); // surfaces
    getGreyStreakQuestion(0); // breaks streak, resets flag
    const result = getGreyStreakQuestion(5); // should fire again
    expect(result).not.toBeNull();
  });

  it("question mentions three possibilities", () => {
    const result = getGreyStreakQuestion(5);
    // The message says "(1) ... (2) ... (3) ..."
    expect(result).toContain("(1)");
    expect(result).toContain("(2)");
    expect(result).toContain("(3)");
  });
});

// ---------------------------------------------------------------------------
// 4. getRecoveryNudge
// ---------------------------------------------------------------------------

describe("getRecoveryNudge", () => {
  it("returns null when recovery is not active", () => {
    const recovery = createRecovery(1);
    const inactive = { ...recovery, active: false };
    expect(getRecoveryNudge(inactive)).toBeNull();
  });

  it("returns cool nudge on phase 'cool'", () => {
    const recovery = createRecovery(1); // starts at cool
    const result = getRecoveryNudge(recovery);
    expect(result).not.toBeNull();
    expect(result).toContain("cooling down");
  });

  it("returns pace nudge on phase 'pace'", () => {
    let recovery = createRecovery(5);
    recovery = tickRecovery(recovery); // turnsRemaining goes to 2, phase -> pace
    const result = getRecoveryNudge(recovery);
    expect(result).toContain("pacing");
  });

  it("returns reengage nudge on phase 'reengage'", () => {
    let recovery = createRecovery(5);
    recovery = tickRecovery(recovery); // 2 turns left, pace
    recovery = tickRecovery(recovery); // 1 turn left, reengage
    const result = getRecoveryNudge(recovery);
    expect(result).toContain("re-engaging");
  });

  it("recovery becomes inactive after 3 ticks", () => {
    let recovery = createRecovery(1);
    recovery = tickRecovery(recovery);
    recovery = tickRecovery(recovery);
    recovery = tickRecovery(recovery);
    expect(recovery.active).toBe(false);
    expect(getRecoveryNudge(recovery)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. getEscalationSignal
// ---------------------------------------------------------------------------

describe("getEscalationSignal", () => {
  it("returns null when not escalated", () => {
    const recovery = createRecovery(1);
    expect(getEscalationSignal(recovery)).toBeNull();
  });

  it("returns escalation string when escalated", () => {
    const recovery = escalateRecovery(createRecovery(3));
    const result = getEscalationSignal(recovery);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("escalation signal mentions ESCALATE", () => {
    const recovery = escalateRecovery(createRecovery(3));
    const result = getEscalationSignal(recovery);
    expect(result).toContain("ESCALATE");
  });

  it("escalation signal includes the trigger turn", () => {
    const recovery = escalateRecovery(createRecovery(12));
    const result = getEscalationSignal(recovery);
    expect(result).toContain("12");
  });

  it("escalation signal mentions drew", () => {
    const recovery = escalateRecovery(createRecovery(1));
    const result = getEscalationSignal(recovery);
    expect(result?.toLowerCase()).toContain("drew");
  });
});
