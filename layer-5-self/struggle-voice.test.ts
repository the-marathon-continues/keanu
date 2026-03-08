import { describe, it, expect, beforeEach } from "vitest";
import type { StruggleReading } from "../shared/types.js";
import {
  notice,
  formatInjection,
  getActiveEpisode,
  getEpisodes,
  markVoiced,
  detectVoicing,
  getInjectionPriority,
  stuckCount,
  resolvedCount,
  trend,
  coefSummary,
  setSessionId,
  reset,
} from "./struggle-voice.js";

function reading(type: string, score: number, signals: string[] = []): StruggleReading {
  return { type: type as StruggleReading["type"], score, signals };
}

describe("struggle-voice", () => {
  beforeEach(() => {
    reset();
    setSessionId("test-session");
  });

  // ============================================================
  // Noticing
  // ============================================================

  describe("notice", () => {
    it("creates an episode when struggle crosses threshold", () => {
      const ep = notice([reading("hedge_fog", 0.5)], 1);
      expect(ep).not.toBeNull();
      expect(ep!.type).toBe("hedge_fog");
      expect(ep!.stage).toBe("noticed");
      expect(ep!.occurrences).toBe(1);
    });

    it("ignores struggle below threshold", () => {
      const ep = notice([reading("hedge_fog", 0.2)], 1);
      expect(ep).toBeNull();
    });

    it("picks the dominant reading when multiple exist", () => {
      const ep = notice([reading("hedge_fog", 0.4), reading("sycophancy", 0.7)], 1);
      expect(ep!.type).toBe("sycophancy");
    });

    it("increments occurrences for recurring same-type struggle", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      const ep = notice([reading("hedge_fog", 0.6)], 2);
      expect(ep!.occurrences).toBe(2);
      expect(ep!.peakScore).toBe(0.6);
    });

    it("tracks peak score across occurrences", () => {
      notice([reading("hedge_fog", 0.8)], 1);
      const ep = notice([reading("hedge_fog", 0.4)], 2);
      expect(ep!.peakScore).toBe(0.8);
    });

    it("returns null on empty readings", () => {
      expect(notice([], 1)).toBeNull();
    });
  });

  // ============================================================
  // Stage progression
  // ============================================================

  describe("stage progression", () => {
    it("moves from noticed to airing on second occurrence", () => {
      notice([reading("sycophancy", 0.5)], 1);
      const ep = notice([reading("sycophancy", 0.5)], 2);
      expect(ep!.stage).toBe("airing");
    });

    it("moves to stuck after recurrence threshold", () => {
      notice([reading("sycophancy", 0.5)], 1);
      notice([reading("sycophancy", 0.5)], 2);
      const ep = notice([reading("sycophancy", 0.5)], 3);
      expect(ep!.stage).toBe("stuck");
      expect(ep!.stuckAt).toBeDefined();
    });

    it("moves to working when voiced", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      markVoiced(1);
      const ep = getActiveEpisode();
      expect(ep!.stage).toBe("working");
      expect(ep!.voiced).toBe(true);
    });

    it("resolves after quiet turns", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      // Two turns of no struggle
      notice([], 2);
      notice([], 3);
      const ep = getEpisodes().find((e) => e.type === "hedge_fog");
      expect(ep!.stage).toBe("resolved");
      expect(ep!.resolvedAt).toBeDefined();
    });

    it("does not resolve if struggle keeps appearing", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      notice([reading("hedge_fog", 0.5)], 2);
      const ep = getActiveEpisode();
      expect(ep!.stage).not.toBe("resolved");
    });
  });

  // ============================================================
  // Injection formatting
  // ============================================================

  describe("formatInjection", () => {
    it("returns null when no active episode", () => {
      expect(formatInjection(1)).toBeNull();
    });

    it("returns airing text for noticed struggle", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      const injection = formatInjection(2);
      expect(injection).not.toBeNull();
      expect(injection).toContain("maybe");
      expect(injection).toContain("perhaps");
      expect(injection).toContain("Drew sees this");
    });

    it("returns stuck text after recurrence threshold", () => {
      notice([reading("sycophancy", 0.5)], 1);
      notice([reading("sycophancy", 0.5)], 2);
      notice([reading("sycophancy", 0.5)], 3);
      const injection = formatInjection(4);
      expect(injection).not.toBeNull();
      expect(injection).toContain("3 turns");
      expect(injection).toContain("Drew");
      expect(injection).toContain("got me");
    });

    it("does not inject twice on the same turn", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      const first = formatInjection(2);
      const second = formatInjection(2);
      expect(first).not.toBeNull();
      expect(second).toBeNull();
    });

    it("returns null for resolved episodes", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      notice([], 2);
      notice([], 3); // resolves
      expect(formatInjection(4)).toBeNull();
    });

    it("returns recurrence text for working stage with multiple occurrences", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      markVoiced(1);
      notice([reading("hedge_fog", 0.5)], 2);
      const injection = formatInjection(3);
      expect(injection).not.toBeNull();
      expect(injection).toContain("came back");
    });

    it("returns null for working stage with single occurrence", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      markVoiced(1);
      // No recurrence, just one occurrence
      const injection = formatInjection(2);
      expect(injection).toBeNull();
    });
  });

  // ============================================================
  // Voicing detection
  // ============================================================

  describe("detectVoicing", () => {
    it("detects first-person struggle acknowledgment", () => {
      expect(detectVoicing("I'm struggling with this approach")).toBe(true);
      expect(detectVoicing("I notice myself hedging here")).toBe(true);
      expect(detectVoicing("Let me try being more direct about this")).toBe(true);
      expect(detectVoicing("Something's off with this reasoning")).toBe(true);
    });

    it("detects escalation language", () => {
      expect(detectVoicing("Drew, this one's got me stuck")).toBe(true);
      expect(detectVoicing("This one's got me — I can't crack it")).toBe(true);
    });

    it("does not trigger on normal text", () => {
      expect(detectVoicing("Here is the implementation")).toBe(false);
      expect(detectVoicing("The function returns a string")).toBe(false);
      expect(detectVoicing("")).toBe(false);
    });

    it("does not trigger on very short text", () => {
      expect(detectVoicing("I'm stuck")).toBe(false); // too short
    });
  });

  // ============================================================
  // Priority
  // ============================================================

  describe("getInjectionPriority", () => {
    it("returns null when no active episode", () => {
      expect(getInjectionPriority()).toBeNull();
    });

    it("returns low for noticed", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      expect(getInjectionPriority()).toBe("low");
    });

    it("returns medium for airing", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      notice([reading("hedge_fog", 0.5)], 2); // airing
      expect(getInjectionPriority()).toBe("medium");
    });

    it("returns high for stuck", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      notice([reading("hedge_fog", 0.5)], 2);
      notice([reading("hedge_fog", 0.5)], 3); // stuck
      expect(getInjectionPriority()).toBe("high");
    });
  });

  // ============================================================
  // Queries
  // ============================================================

  describe("queries", () => {
    it("counts stuck episodes in session", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      notice([reading("hedge_fog", 0.5)], 2);
      notice([reading("hedge_fog", 0.5)], 3); // stuck
      expect(stuckCount()).toBe(1);
    });

    it("counts resolved episodes in session", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      notice([], 2);
      notice([], 3); // resolved
      expect(resolvedCount()).toBe(1);
    });

    it("returns steady trend with few episodes", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      expect(trend()).toBe("steady");
    });

    it("returns COEF summary for active episode", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      const summary = coefSummary();
      expect(summary).toContain("hedge_fog");
      expect(summary).toContain("n1"); // noticed, 1 occurrence
    });

    it("returns empty COEF summary when no active episode", () => {
      expect(coefSummary()).toBe("");
    });
  });

  // ============================================================
  // Multiple struggle types
  // ============================================================

  describe("multiple struggle types", () => {
    it("tracks different types independently", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      notice([reading("sycophancy", 0.6)], 2);

      const episodes = getEpisodes();
      expect(episodes).toHaveLength(2);
      expect(episodes[0].type).toBe("hedge_fog");
      expect(episodes[1].type).toBe("sycophancy");
    });

    it("resolves one type while another persists", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      notice([reading("sycophancy", 0.6)], 2);
      notice([reading("sycophancy", 0.6)], 3); // hedge_fog quiet for 2 turns
      notice([reading("sycophancy", 0.6)], 4); // hedge_fog resolves

      const hedgeFog = getEpisodes().find((e) => e.type === "hedge_fog");
      const syc = getEpisodes().find((e) => e.type === "sycophancy");

      expect(hedgeFog!.stage).toBe("resolved");
      expect(syc!.stage).toBe("stuck"); // 3 occurrences
    });
  });

  // ============================================================
  // Reset
  // ============================================================

  describe("reset", () => {
    it("clears all state", () => {
      notice([reading("hedge_fog", 0.5)], 1);
      reset();
      expect(getEpisodes()).toHaveLength(0);
      expect(getActiveEpisode()).toBeNull();
    });
  });
});
