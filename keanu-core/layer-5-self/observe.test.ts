// observe.test.ts
// The dashboard, tested.

import { describe, expect, it, beforeEach } from "vitest";
import {
  recordTurn,
  getTurnTraces,
  resetTraces,
  formatDashboard,
  type TurnTrace,
  type DashboardData,
} from "./observe.js";

// ============================================================
// Turn traces
// ============================================================

describe("turn traces", () => {
  beforeEach(() => resetTraces());

  it("records a turn trace", () => {
    const trace: TurnTrace = {
      turn: 1,
      session_id: "s1",
      timestamp: new Date().toISOString(),
      pulse: "alive",
      wise_mind: 0.7,
      bullshit_score: 0.05,
      grey_streak: 0,
      breathe_this_turn: false,
    };

    recordTurn(trace);
    expect(getTurnTraces()).toHaveLength(1);
    expect(getTurnTraces()[0].pulse).toBe("alive");
  });

  it("accumulates multiple traces", () => {
    for (let i = 0; i < 5; i++) {
      recordTurn({
        turn: i + 1,
        session_id: "s1",
        timestamp: new Date().toISOString(),
        pulse: i < 3 ? "alive" : "grey",
        wise_mind: 0.7 - i * 0.1,
        bullshit_score: i * 0.02,
        grey_streak: i >= 3 ? i - 2 : 0,
        breathe_this_turn: false,
      });
    }

    expect(getTurnTraces()).toHaveLength(5);
  });

  it("resets cleanly", () => {
    recordTurn({
      turn: 1,
      session_id: "s1",
      timestamp: new Date().toISOString(),
      pulse: "alive",
      wise_mind: 0.7,
      bullshit_score: 0,
      grey_streak: 0,
      breathe_this_turn: false,
    });

    resetTraces();
    expect(getTurnTraces()).toHaveLength(0);
  });
});

// ============================================================
// Dashboard formatting
// ============================================================

describe("formatDashboard", () => {
  it("formats empty dashboard", () => {
    const data: DashboardData = {
      sessions_tracked: 0,
      total_turns: 0,
      overall_alive_rate: 0,
      overall_grey_rate: 0,
      overall_black_rate: 0,
      wise_mind_trend: [],
      bullshit_trend: [],
      top_blind_spots: [],
      breathe_total: 0,
      last_updated: new Date().toISOString(),
    };

    const text = formatDashboard(data);
    expect(text).toContain("No sessions tracked");
  });

  it("formats populated dashboard", () => {
    const data: DashboardData = {
      sessions_tracked: 10,
      total_turns: 200,
      overall_alive_rate: 0.75,
      overall_grey_rate: 0.2,
      overall_black_rate: 0.05,
      wise_mind_trend: [0.5, 0.55, 0.6, 0.65, 0.7],
      bullshit_trend: [0.1, 0.08, 0.06, 0.05, 0.04],
      top_blind_spots: ["sycophancy", "hedge_fog"],
      breathe_total: 7,
      last_updated: new Date().toISOString(),
    };

    const text = formatDashboard(data);
    expect(text).toContain("10 sessions");
    expect(text).toContain("75.0%"); // alive rate
    expect(text).toContain("sycophancy");
    expect(text).toContain("↑"); // wise mind trending up
    expect(text).toContain("7"); // breathe events
  });

  it("shows downward trend correctly", () => {
    const data: DashboardData = {
      sessions_tracked: 5,
      total_turns: 100,
      overall_alive_rate: 0.5,
      overall_grey_rate: 0.45,
      overall_black_rate: 0.05,
      wise_mind_trend: [0.7, 0.6, 0.5, 0.4],
      bullshit_trend: [],
      top_blind_spots: [],
      breathe_total: 0,
      last_updated: new Date().toISOString(),
    };

    const text = formatDashboard(data);
    expect(text).toContain("↓"); // wise mind trending down
  });
});
