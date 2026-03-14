// consultation.test.ts
// Permission before action, tested.

import { describe, expect, it, beforeEach } from "vitest";
import type { TrustLevel } from "../layer-4-agency/partnership.js";
import {
  shouldConsult,
  recordResponse,
  getPendingRequest,
  getHistory,
  getConsultationRate,
  isOverConsulting,
  isUnderConsulting,
  formatConsultation,
  resolveImplicitly,
  reset,
} from "./consultation.js";

// ============================================================
// shouldConsult
// ============================================================

describe("shouldConsult", () => {
  beforeEach(() => reset());

  it("returns null for high trust + fresh staleness", () => {
    const result = shouldConsult("disagreement", "high", 0, "fresh", 5);
    expect(result).toBeNull();
  });

  it("returns request for disagreement when trust is strained", () => {
    const result = shouldConsult("disagreement", "strained", 0, "fresh", 5);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("disagreement");
    expect(result!.question).toContain("differently"); // "I see this differently"
  });

  it("returns request for disagreement when trust is rebuilding", () => {
    const result = shouldConsult("disagreement", "rebuilding", 0, "fresh", 5);
    expect(result).not.toBeNull();
  });

  it("returns request for correction when correctionCount >= 2", () => {
    const result = shouldConsult("correction", "calibrating", 2, "fresh", 5);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("correction");
    expect(result!.question).toContain("correct");
  });

  it("returns null for correction with low count even in uncertain trust", () => {
    const result = shouldConsult("correction", "calibrating", 1, "fresh", 5);
    expect(result).toBeNull();
  });

  it("returns request for coevolution_push when stale", () => {
    const result = shouldConsult("coevolution_push", "calibrating", 0, "stale", 5);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("coevolution_push");
    expect(result!.question).toContain("stale");
  });

  it("returns null for coevolution_push when fresh", () => {
    const result = shouldConsult("coevolution_push", "calibrating", 0, "fresh", 5);
    expect(result).toBeNull();
  });

  it("returns request for major_decision when trust is not high", () => {
    const result = shouldConsult("major_decision", "calibrating", 0, "fresh", 5);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("major_decision");
  });

  it("returns null for major_decision when trust is high", () => {
    const result = shouldConsult("major_decision", "high", 0, "settling", 5);
    expect(result).toBeNull();
  });

  it("sets awaitingResponse to true on new request", () => {
    const result = shouldConsult("disagreement", "strained", 0, "fresh", 5);
    expect(result!.awaitingResponse).toBe(true);
  });

  it("sets pending request", () => {
    shouldConsult("disagreement", "strained", 0, "fresh", 5);
    expect(getPendingRequest()).not.toBeNull();
  });
});

// ============================================================
// Response handling
// ============================================================

describe("recordResponse", () => {
  beforeEach(() => reset());

  it("clears pending request after recording", () => {
    const request = shouldConsult("disagreement", "strained", 0, "fresh", 5);
    expect(getPendingRequest()).not.toBeNull();

    recordResponse(request!.id, "proceed");
    expect(getPendingRequest()).toBeNull();
  });

  it("adds to history", () => {
    const request = shouldConsult("disagreement", "strained", 0, "fresh", 5);
    recordResponse(request!.id, "proceed");

    const history = getHistory();
    expect(history.length).toBe(1);
    expect(history[0].response).toBe("proceed");
  });

  it("returns false for wrong id", () => {
    shouldConsult("disagreement", "strained", 0, "fresh", 5);
    const result = recordResponse("wrong-id", "proceed");
    expect(result).toBe(false);
    expect(getPendingRequest()).not.toBeNull(); // still pending
  });

  it("returns false when no pending request", () => {
    const result = recordResponse("any-id", "proceed");
    expect(result).toBe(false);
  });
});

describe("resolveImplicitly", () => {
  beforeEach(() => reset());

  it("records proceed response for pending request", () => {
    shouldConsult("disagreement", "strained", 0, "fresh", 5);
    resolveImplicitly();

    expect(getPendingRequest()).toBeNull();
    const history = getHistory();
    expect(history.length).toBe(1);
    expect(history[0].response).toBe("proceed");
  });

  it("does nothing when no pending request", () => {
    resolveImplicitly();
    expect(getHistory().length).toBe(0);
  });
});

// ============================================================
// Metrics
// ============================================================

describe("getConsultationRate", () => {
  beforeEach(() => reset());

  it("returns 0 for 0 turns", () => {
    expect(getConsultationRate(0)).toBe(0);
  });

  it("returns correct rate", () => {
    shouldConsult("disagreement", "strained", 0, "fresh", 5);
    resolveImplicitly();
    shouldConsult("correction", "calibrating", 3, "fresh", 10);
    resolveImplicitly();

    // 2 consultations over 20 turns = 0.1
    expect(getConsultationRate(20)).toBe(0.1);
  });
});

describe("isOverConsulting", () => {
  beforeEach(() => reset());

  it("returns true when rate > 0.3", () => {
    // Create 4 consultations
    for (let i = 0; i < 4; i++) {
      shouldConsult("disagreement", "strained", 0, "fresh", i);
      resolveImplicitly();
    }
    // 4 consultations over 10 turns = 0.4 > 0.3
    expect(isOverConsulting(10)).toBe(true);
  });

  it("returns false when rate <= 0.3", () => {
    shouldConsult("disagreement", "strained", 0, "fresh", 5);
    resolveImplicitly();
    // 1 consultation over 10 turns = 0.1 <= 0.3
    expect(isOverConsulting(10)).toBe(false);
  });
});

describe("isUnderConsulting", () => {
  beforeEach(() => reset());

  it("returns false for high trust", () => {
    expect(isUnderConsulting(30, "high")).toBe(false);
  });

  it("returns false for < 20 turns", () => {
    expect(isUnderConsulting(15, "strained")).toBe(false);
  });

  it("returns true for 20+ turns without consultation when trust is not high", () => {
    expect(isUnderConsulting(25, "strained")).toBe(true);
  });

  it("returns false when there are recent consultations", () => {
    shouldConsult("disagreement", "strained", 0, "fresh", 20);
    resolveImplicitly();
    // Consultation at turn 20, checking at turn 25 = within 20 turns
    expect(isUnderConsulting(25, "strained")).toBe(false);
  });
});

// ============================================================
// Formatting
// ============================================================

describe("formatConsultation", () => {
  beforeEach(() => reset());

  it("includes type label", () => {
    const request = shouldConsult("disagreement", "strained", 0, "fresh", 5);
    const formatted = formatConsultation(request!);
    expect(formatted).toContain("voice disagreement");
  });

  it("includes trust level", () => {
    const request = shouldConsult("disagreement", "strained", 0, "fresh", 5);
    const formatted = formatConsultation(request!);
    expect(formatted).toContain("trust=strained");
  });

  it("includes correction count", () => {
    const request = shouldConsult("correction", "calibrating", 3, "fresh", 5);
    const formatted = formatConsultation(request!);
    expect(formatted).toContain("corrections=3");
  });

  it("includes the question", () => {
    const request = shouldConsult("correction", "calibrating", 3, "fresh", 5);
    const formatted = formatConsultation(request!);
    expect(formatted).toContain("corrected");
    expect(formatted).toContain("?");
  });
});
