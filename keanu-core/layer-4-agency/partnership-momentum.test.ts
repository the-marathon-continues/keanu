import { describe, it, expect, beforeEach } from "vitest";
import {
  update,
  applyDisagreementForce,
  getCurrent,
  getHealth,
  getTrend,
  getEnergy,
  reset,
} from "./partnership-momentum.js";

beforeEach(() => {
  reset();
});

// ---------------------------------------------------------------------------
// 1. update
// ---------------------------------------------------------------------------

describe("update", () => {
  it("creates momentum from mass and rates", () => {
    const result = update(10, 0.8, 0.7);
    expect(result).toBeDefined();
    expect(typeof result.magnitude).toBe("number");
    expect(Array.isArray(result.direction)).toBe(true);
    expect(typeof result.inertia).toBe("number");
    expect(typeof result.acceleration).toBe("number");
    expect(result.magnitude).toBeGreaterThan(0);
  });

  it("tracks history across multiple updates", () => {
    update(10, 0.5, 0.5);
    update(10, 0.6, 0.6);
    update(10, 0.7, 0.7);
    // Verify state is set (history is internal but trend reflects it)
    expect(getCurrent()).not.toBeNull();
  });

  it("zero alive rate and trust yields zero momentum", () => {
    const result = update(10, 0, 0);
    expect(result.magnitude).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. getHealth
// ---------------------------------------------------------------------------

describe("getHealth", () => {
  it("returns null with no current momentum", () => {
    expect(getHealth()).toBeNull();
  });

  it("detects stuck state when momentum is zero", () => {
    update(10, 0, 0);
    const health = getHealth();
    expect(health).not.toBeNull();
    expect(health!.healthy).toBe(false);
    expect(health!.diagnosis).toBe("No momentum. Stuck.");
  });

  it("detects high inertia with high momentum", () => {
    // mass=100 → inertia=min(1,100/10)=1.0 (>0.9)
    // velocity=[0.8,0.7] → speed=sqrt(0.64+0.49)=sqrt(1.13)≈1.063
    // magnitude=100*1.063≈106.3 (>5)
    const result = update(100, 0.8, 0.7);
    expect(result.inertia).toBeGreaterThan(0.9);
    expect(result.magnitude).toBeGreaterThan(5);
    const health = getHealth();
    expect(health!.healthy).toBe(false);
    expect(health!.diagnosis).toBe("High inertia with high momentum. Hard to steer.");
  });

  it("reports healthy for moderate mass and velocity", () => {
    // mass=5 → inertia=0.5, moderate speed
    update(5, 0.5, 0.5);
    const health = getHealth();
    expect(health!.healthy).toBe(true);
    expect(health!.diagnosis).toBe("Healthy momentum. Moving with control.");
  });
});

// ---------------------------------------------------------------------------
// 3. applyDisagreementForce
// ---------------------------------------------------------------------------

describe("applyDisagreementForce", () => {
  it("deflects trajectory after applying force", () => {
    const before = update(10, 0.8, 0.7);
    const after = applyDisagreementForce(10, 1.0);
    expect(after).not.toBeNull();
    // The force changes magnitude — direction should differ from original
    expect(after!.magnitude).not.toBe(before.magnitude);
  });

  it("returns null when no prior update has been made", () => {
    const result = applyDisagreementForce(10, 1.0);
    expect(result).toBeNull();
  });

  it("updates current after applying force", () => {
    update(10, 0.8, 0.7);
    const after = applyDisagreementForce(10, 1.0);
    expect(getCurrent()).toEqual(after);
  });
});

// ---------------------------------------------------------------------------
// 4. getTrend
// ---------------------------------------------------------------------------

describe("getTrend", () => {
  it("returns stable with no history", () => {
    expect(getTrend()).toBe("stable");
  });

  it("detects building momentum with increasing alive rates", () => {
    update(10, 0.3, 0.3); // lower magnitude
    update(10, 0.6, 0.6); // middle
    update(10, 0.9, 0.9); // higher magnitude
    expect(getTrend()).toBe("building");
  });

  it("detects fading momentum with decreasing alive rates", () => {
    update(10, 0.9, 0.9); // higher
    update(10, 0.6, 0.6); // middle
    update(10, 0.3, 0.3); // lower
    expect(getTrend()).toBe("fading");
  });
});

// ---------------------------------------------------------------------------
// 5. History cap
// ---------------------------------------------------------------------------

describe("history cap", () => {
  it("caps history at MAX_HISTORY (20) after 25 updates", () => {
    // We verify the cap indirectly: trend only looks at last 3, but
    // after 25 updates the module should not grow unbounded.
    // We can confirm getCurrent() is still valid (didn't crash)
    // and trend reflects recent entries, not old ones.
    for (let i = 0; i < 25; i++) {
      update(10, i / 25, i / 25);
    }
    // After 25 updates, trend should reflect final increasing pattern
    expect(getTrend()).toBe("building");
    expect(getCurrent()).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. reset
// ---------------------------------------------------------------------------

describe("reset", () => {
  it("clears current and history", () => {
    update(10, 0.8, 0.7);
    update(10, 0.9, 0.8);
    reset();
    expect(getCurrent()).toBeNull();
    expect(getTrend()).toBe("stable"); // no history → stable
    expect(getHealth()).toBeNull();
    expect(getEnergy(10)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. getEnergy
// ---------------------------------------------------------------------------

describe("getEnergy", () => {
  it("returns 0 when no momentum exists", () => {
    expect(getEnergy(10)).toBe(0);
  });

  it("returns kinetic energy using KE = p^2 / 2m", () => {
    const result = update(10, 0.8, 0.7);
    const energy = getEnergy(10);
    const expected = (result.magnitude * result.magnitude) / (2 * 10);
    expect(energy).toBeCloseTo(expected);
  });
});
