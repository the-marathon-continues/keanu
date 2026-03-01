import { describe, it, expect } from "vitest";
import { checkHealth, formatHealth } from "./health.js";

// ---------------------------------------------------------------------------
// 1. STEADY STATE
// ---------------------------------------------------------------------------

describe("steady state", () => {
  it("returns steady when all inputs are low", () => {
    const reading = checkHealth(5, 0.1, 10000, 0.05, 0);
    expect(reading.status).toBe("steady");
  });

  it("steady state has null pacing", () => {
    const reading = checkHealth(5, 0.1, 10000, 0.05, 0);
    expect(reading.pacing).toBeNull();
  });

  it("steady state: score is below 2 — no factor crosses a threshold", () => {
    // turnCount=10 (<20), bullshitRate=0.1 (<0.3), avgPromptSize=20000 (<50000),
    // toolErrorRate=0.1 (<0.15), consecutiveGrey=1 (<3) — all zero contribution
    const reading = checkHealth(10, 0.1, 20000, 0.1, 1);
    expect(reading.status).toBe("steady");
    expect(reading.pacing).toBeNull();
  });

  it("factors are echoed back accurately", () => {
    const reading = checkHealth(5, 0.1, 10000, 0.05, 0);
    expect(reading.factors.contextAge).toBe(5);
    expect(reading.factors.bullshitTrend).toBe(0.1);
    expect(reading.factors.promptSize).toBe(10000);
    expect(reading.factors.toolFailureRate).toBe(0.05);
    expect(reading.factors.consecutiveGrey).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. WARM STATE
// ---------------------------------------------------------------------------

describe("warm state", () => {
  it("returns warm when score is exactly 2", () => {
    // turnCount=25 (+1), bullshitRate=0.35 (+1): total score=2
    const reading = checkHealth(25, 0.35, 10000, 0.05, 0);
    expect(reading.status).toBe("warm");
  });

  it("returns warm when score is 3", () => {
    // turnCount=25 (+1), bullshitRate=0.35 (+1), consecutiveGrey=3 (+1): total=3
    const reading = checkHealth(25, 0.35, 10000, 0.05, 3);
    expect(reading.status).toBe("warm");
  });

  it("warm state pacing is non-null", () => {
    const reading = checkHealth(25, 0.35, 10000, 0.05, 0);
    expect(reading.pacing).not.toBeNull();
    expect(reading.pacing).toContain("warm");
  });

  it("warm state pacing says 'notice' not 'urgent'", () => {
    const reading = checkHealth(25, 0.35, 10000, 0.05, 0);
    expect(reading.pacing).toContain("notice");
  });
});

// ---------------------------------------------------------------------------
// 3. HOT STATE — high bullshit + large prompt
// ---------------------------------------------------------------------------

describe("hot state", () => {
  it("returns hot when bullshit and prompt size are both high", () => {
    // bullshitRate=0.55 (+2), avgPromptSize=85000 (+2): score=4 => hot
    const reading = checkHealth(5, 0.55, 85000, 0.05, 0);
    expect(reading.status).toBe("hot");
  });

  it("returns hot at score exactly 4", () => {
    // bullshitRate=0.55 (+2), toolErrorRate=0.35 (+2): score=4
    const reading = checkHealth(5, 0.55, 10000, 0.35, 0);
    expect(reading.status).toBe("hot");
  });

  it("returns hot at score 5", () => {
    // turnCount=25 (+1), bullshitRate=0.55 (+2), avgPromptSize=85000 (+2): score=5
    const reading = checkHealth(25, 0.55, 85000, 0.05, 0);
    expect(reading.status).toBe("hot");
  });

  it("hot state pacing mentions shortening responses", () => {
    const reading = checkHealth(5, 0.55, 85000, 0.05, 0);
    expect(reading.pacing).toContain("shorten");
  });

  it("hot state pacing mentions checking claims", () => {
    const reading = checkHealth(5, 0.55, 85000, 0.05, 0);
    expect(reading.pacing).toContain("check claims");
  });
});

// ---------------------------------------------------------------------------
// 4. FADING STATE — old context + grey streak
// ---------------------------------------------------------------------------

describe("fading state", () => {
  it("returns fading when context is very old and grey streak is high", () => {
    // turnCount=45 (+2), consecutiveGrey=5 (+2), bullshitRate=0.35 (+1): score=5...
    // need score>=6: add toolErrorRate=0.35 (+2) too → 7
    const reading = checkHealth(45, 0.1, 10000, 0.35, 5);
    expect(reading.status).toBe("fading");
  });

  it("returns fading at score exactly 6", () => {
    // turnCount=45 (+2), consecutiveGrey=5 (+2), avgPromptSize=85000 (+2): score=6
    const reading = checkHealth(45, 0.1, 85000, 0.05, 5);
    expect(reading.status).toBe("fading");
  });

  it("fading state pacing mentions context being old", () => {
    const reading = checkHealth(45, 0.1, 85000, 0.05, 5);
    expect(reading.pacing).toContain("context is old");
  });

  it("fading state pacing suggests a reset", () => {
    const reading = checkHealth(45, 0.1, 85000, 0.05, 5);
    expect(reading.pacing).toContain("reset");
  });

  it("fading state pacing mentions shorter responses", () => {
    const reading = checkHealth(45, 0.1, 85000, 0.05, 5);
    expect(reading.pacing).toContain("shorter responses");
  });
});

// ---------------------------------------------------------------------------
// 5. formatHealth
// ---------------------------------------------------------------------------

describe("formatHealth", () => {
  it("returns null for steady reading", () => {
    const reading = checkHealth(5, 0.1, 10000, 0.05, 0);
    expect(formatHealth(reading)).toBeNull();
  });

  it("returns the pacing string for warm reading", () => {
    const reading = checkHealth(25, 0.35, 10000, 0.05, 0);
    const result = formatHealth(reading);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("returns the pacing string for hot reading", () => {
    const reading = checkHealth(5, 0.55, 85000, 0.05, 0);
    const result = formatHealth(reading);
    expect(result).not.toBeNull();
    expect(result).toContain("hot");
  });

  it("returns the pacing string for fading reading", () => {
    const reading = checkHealth(45, 0.1, 85000, 0.05, 5);
    const result = formatHealth(reading);
    expect(result).not.toBeNull();
    expect(result).toContain("fading");
  });

  it("formatHealth output is identical to reading.pacing", () => {
    const reading = checkHealth(25, 0.55, 85000, 0.35, 5);
    expect(formatHealth(reading)).toBe(reading.pacing);
  });
});

// ---------------------------------------------------------------------------
// 6. THRESHOLD BOUNDARIES
// ---------------------------------------------------------------------------

describe("score threshold boundaries", () => {
  it("turnCount=21 adds 1 point (crosses >20)", () => {
    // Only turnCount above threshold — should be warm (score=1... actually needs 2)
    // so pair with another threshold cross
    const just_above = checkHealth(21, 0.35, 10000, 0.05, 0); // +1 turn, +1 bullshit = 2 = warm
    expect(just_above.status).toBe("warm");
  });

  it("turnCount=41 adds 2 points (crosses >40)", () => {
    // turnCount=41 (+2), everything else zero: score=2 = warm
    const reading = checkHealth(41, 0.1, 10000, 0.05, 0);
    expect(reading.status).toBe("warm");
  });

  it("bullshitRate=0.31 adds 1 point (crosses >0.3)", () => {
    const reading = checkHealth(21, 0.31, 10000, 0.05, 0); // +1 turn, +1 bullshit = 2 = warm
    expect(reading.status).toBe("warm");
  });

  it("consecutiveGrey=3 adds 1 point, consecutiveGrey=5 adds 2", () => {
    const at3 = checkHealth(21, 0.1, 10000, 0.05, 3); // +1 turn, +1 grey = 2 = warm
    const at5 = checkHealth(21, 0.1, 10000, 0.05, 5); // +1 turn, +2 grey = 3 = warm still
    expect(at3.status).toBe("warm");
    expect(at5.status).toBe("warm");
  });

  it("HealthReading always has a valid status field", () => {
    const validStatuses = ["steady", "warm", "hot", "fading"];
    const cases = [
      checkHealth(0, 0, 0, 0, 0),
      checkHealth(50, 0.9, 100000, 0.5, 10),
      checkHealth(20, 0.3, 50000, 0.15, 3),
    ];
    for (const r of cases) {
      expect(validStatuses).toContain(r.status);
    }
  });
});
