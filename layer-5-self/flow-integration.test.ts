// flow-integration.test.ts
// Flow physics wired into state. Time as experienced, tracked per session.

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordFlowMoment,
  computeFlow,
  getFlowReading,
  getFlowHealth,
  resetFlowState,
} from "./state.js";

describe("flow state in state.ts", () => {
  beforeEach(() => {
    resetFlowState();
  });

  it("recordFlowMoment accumulates moments", () => {
    recordFlowMoment("something just happened", 0.6, "present", 0);
    recordFlowMoment("a thing from before", 0.5, "past", 1);
    recordFlowMoment("where this is heading", 0.4, "future", 2);

    // computeFlow should succeed now — 3 moments minimum
    const reading = computeFlow();
    expect(reading).not.toBeNull();
    expect(reading!.moments).toHaveLength(3);
  });

  it("computeFlow returns null with insufficient data", () => {
    recordFlowMoment("one moment", 0.5, "present", 0);
    recordFlowMoment("two moments", 0.5, "past", 1);

    const reading = computeFlow();
    expect(reading).toBeNull();
  });

  it("computeFlow returns FlowResult with sufficient data", () => {
    recordFlowMoment("moment 1", 0.5, "present", 0);
    recordFlowMoment("moment 2", 0.4, "past", 1);
    recordFlowMoment("moment 3", 0.6, "future", 2);
    recordFlowMoment("moment 4", 0.3, "past", 3);
    recordFlowMoment("moment 5", 0.7, "future", 4);

    const reading = computeFlow();
    expect(reading).not.toBeNull();
    expect(reading).toHaveProperty("direction");
    expect(reading).toHaveProperty("velocity");
    expect(reading).toHaveProperty("viscosity");
    expect(reading).toHaveProperty("coherence");
    expect(reading!.moments).toHaveLength(5);
  });

  it("getFlowHealth detects unhealthy flow — all heavy past moments", () => {
    // All weight=0.9 past moments → viscosity will be 0.9 → too thick
    for (let i = 0; i < 5; i++) {
      recordFlowMoment(`heavy past moment ${i}`, 0.9, "past", i + 1);
    }

    computeFlow();
    const health = getFlowHealth();

    expect(health).not.toBeNull();
    expect(health!.healthy).toBe(false);
  });

  it("getFlowHealth detects healthy flow — mixed positions and weights", () => {
    // Balanced: past, present, future at moderate weights.
    // Distances must be close together (gap < 0.5) for coherence to register.
    // Sorted order by position: past(-0.3), present(0), future(0.2) → gaps are 0.3, 0.2 — all < 0.5.
    recordFlowMoment("what just happened", 0.4, "past", 0.3);
    recordFlowMoment("right now", 0.4, "present", 0);
    recordFlowMoment("what's coming", 0.4, "future", 0.2);

    computeFlow();
    const health = getFlowHealth();

    expect(health).not.toBeNull();
    expect(health!.healthy).toBe(true);
  });

  it("moments cap at MAX_FLOW_MOMENTS", () => {
    // Add 35 moments — should only keep 30
    for (let i = 0; i < 35; i++) {
      recordFlowMoment(`moment ${i}`, 0.5, "present", 0);
    }

    // After cap, computeFlow still works and returns at most 30 moments
    const reading = computeFlow();
    expect(reading).not.toBeNull();
    expect(reading!.moments.length).toBeLessThanOrEqual(30);
  });

  it("alive pulse maps to present/high weight", () => {
    // alive = present moment, high weight — the system is here, now
    recordFlowMoment("alive and building", 0.8, "present", 0);
    recordFlowMoment("context from before", 0.4, "past", 1);
    recordFlowMoment("goal ahead", 0.5, "future", 2);

    const reading = computeFlow();
    expect(reading).not.toBeNull();

    const presentMoment = reading!.moments.find((m) => m.position === "present");
    expect(presentMoment).toBeDefined();
    expect(presentMoment!.weight).toBe(0.8);
  });

  it("grey pulse maps to past/medium weight", () => {
    // grey = stuck in past patterns, medium weight — not quite dead, not quite here
    recordFlowMoment("that thing that went wrong", 0.5, "past", 2);
    recordFlowMoment("the loop again", 0.5, "past", 1);
    recordFlowMoment("uncertain about this", 0.4, "present", 0);

    const reading = computeFlow();
    expect(reading).not.toBeNull();

    const pastMoments = reading!.moments.filter((m) => m.position === "past");
    expect(pastMoments.length).toBeGreaterThan(0);
    expect(pastMoments[0].weight).toBe(0.5);
  });

  it("getFlowReading returns null before first computeFlow", () => {
    recordFlowMoment("something", 0.5, "present", 0);
    recordFlowMoment("something else", 0.5, "past", 1);
    recordFlowMoment("and more", 0.4, "future", 2);

    // Don't call computeFlow — reading should still be null
    expect(getFlowReading()).toBeNull();
  });

  it("getFlowReading returns last computed reading", () => {
    recordFlowMoment("a", 0.5, "present", 0);
    recordFlowMoment("b", 0.4, "past", 1);
    recordFlowMoment("c", 0.6, "future", 2);

    computeFlow();
    const reading = getFlowReading();
    expect(reading).not.toBeNull();
    expect(reading!.moments.length).toBe(3);
  });

  it("getFlowHealth returns null before compute", () => {
    // No compute yet — no health to report
    expect(getFlowHealth()).toBeNull();
  });

  it("resetFlowState clears moments and reading", () => {
    recordFlowMoment("a", 0.5, "present", 0);
    recordFlowMoment("b", 0.4, "past", 1);
    recordFlowMoment("c", 0.6, "future", 2);
    computeFlow();

    expect(getFlowReading()).not.toBeNull();

    resetFlowState();

    // After reset: no reading, compute returns null (< 3 moments)
    expect(getFlowReading()).toBeNull();
    expect(computeFlow()).toBeNull();
  });
});
