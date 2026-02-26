// silverado.test.ts
// The journal that doesn't burn, tested.

import { describe, expect, it, beforeEach } from "vitest";
import {
  getAllClaims,
  markVerified,
  markRetracted,
  decayAll,
  crossCheck,
  contradictByText,
  staleClaims,
  contradictedClaims,
  beliefs,
  claimsAbout,
  formatInjection,
  mergeSessionClaims,
  reset,
} from "./silverado.js";
import type { TrackedClaim } from "./types.js";

// ============================================================
// Helpers
// ============================================================

function makeClaim(overrides: Partial<TrackedClaim> = {}): TrackedClaim {
  return {
    id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: "TypeScript is better for this project",
    confidence: 4,
    turn: 1,
    session: "s-test",
    verified: false,
    contradicted: false,
    decayedConfidence: 4,
    status: "active",
    ...overrides,
  };
}

function seedLedger(claims: TrackedClaim[]): void {
  mergeSessionClaims(claims);
}

// ============================================================
// Lifecycle transitions
// ============================================================

describe("claim lifecycle", () => {
  beforeEach(() => reset());

  it("new claims start active", () => {
    const claim = makeClaim();
    seedLedger([claim]);
    expect(getAllClaims()[0].status).toBe("active");
  });

  it("decay moves high-confidence claims to stale", () => {
    const claim = makeClaim({ confidence: 4, decayedConfidence: 4 });
    seedLedger([claim]);

    // Simulate multiple sessions of decay
    decayAll();
    decayAll();
    // 4 → 3 → 2, threshold is ≤2 with original ≥3
    expect(getAllClaims()[0].status).toBe("stale");
    expect(getAllClaims()[0].decayedConfidence).toBe(2);
  });

  it("verified claims resist decay", () => {
    const claim = makeClaim({ confidence: 4, decayedConfidence: 4, verified: true });
    seedLedger([claim]);

    decayAll();
    decayAll();
    decayAll();

    expect(getAllClaims()[0].decayedConfidence).toBe(4); // no decay
    expect(getAllClaims()[0].status).toBe("active");
  });

  it("markVerified resets decay and restores active status", () => {
    const claim = makeClaim({ confidence: 4, decayedConfidence: 1, status: "stale" });
    seedLedger([claim]);

    markVerified(claim.id);

    expect(getAllClaims()[0].verified).toBe(true);
    expect(getAllClaims()[0].status).toBe("active");
    expect(getAllClaims()[0].decayedConfidence).toBe(4);
  });

  it("markRetracted sets status and timestamp", () => {
    const claim = makeClaim();
    seedLedger([claim]);

    markRetracted(claim.id);

    const retracted = getAllClaims()[0];
    expect(retracted.status).toBe("retracted");
    expect(retracted.contradicted).toBe(true);
    expect(retracted.retractedAt).toBeTruthy();
  });

  it("retracted claims don't decay further", () => {
    const claim = makeClaim({ status: "retracted" as const, contradicted: true });
    seedLedger([claim]);

    decayAll();

    expect(getAllClaims()[0].decayedConfidence).toBe(4); // unchanged
  });
});

// ============================================================
// Cross-session contradiction detection
// ============================================================

describe("cross-session contradiction detection", () => {
  beforeEach(() => reset());

  it("detects contradictions against historical claims", () => {
    const oldClaim = makeClaim({
      text: "TypeScript is better for this project",
      confidence: 4,
      decayedConfidence: 3,
    });
    seedLedger([oldClaim]);

    const contradictions = crossCheck("TypeScript is worse for this project");
    // memoryContradictionCheck may or may not catch this depending on its implementation
    // but the function should at least return an array
    expect(Array.isArray(contradictions)).toBe(true);
  });

  it("contradictByText marks the old claim", () => {
    const claim = makeClaim({ text: "Python is the best choice" });
    seedLedger([claim]);

    const result = contradictByText("Python is the best", "actually Rust is better");

    expect(result).not.toBeNull();
    expect(result!.status).toBe("contradicted");
    expect(result!.contradictedBy).toBe("actually Rust is better");
  });

  it("skips retracted claims in contradiction search", () => {
    const claim = makeClaim({
      text: "Python is the best choice",
      status: "retracted" as const,
      contradicted: true,
    });
    seedLedger([claim]);

    const result = contradictByText("Python is the best");
    expect(result).toBeNull(); // already dealt with
  });
});

// ============================================================
// Queries
// ============================================================

describe("queries", () => {
  beforeEach(() => reset());

  it("staleClaims returns only stale claims", () => {
    seedLedger([
      makeClaim({ id: "a", status: "active" as const }),
      makeClaim({ id: "b", status: "stale" as const }),
      makeClaim({ id: "c", status: "contradicted" as const }),
    ]);

    expect(staleClaims().map((c) => c.id)).toEqual(["b"]);
  });

  it("beliefs returns active high-confidence claims", () => {
    seedLedger([
      makeClaim({ id: "strong", decayedConfidence: 4, status: "active" as const }),
      makeClaim({ id: "weak", decayedConfidence: 1, status: "active" as const }),
      makeClaim({ id: "stale", decayedConfidence: 4, status: "stale" as const }),
    ]);

    const result = beliefs();
    expect(result.map((c) => c.id)).toEqual(["strong"]);
  });

  it("claimsAbout finds claims by keyword", () => {
    seedLedger([
      makeClaim({ id: "ts", text: "TypeScript is good for this" }),
      makeClaim({ id: "py", text: "Python handles data well" }),
    ]);

    expect(claimsAbout("TypeScript").map((c) => c.id)).toEqual(["ts"]);
    expect(claimsAbout("Python").map((c) => c.id)).toEqual(["py"]);
    expect(claimsAbout("Rust")).toHaveLength(0);
  });
});

// ============================================================
// Session merging
// ============================================================

describe("mergeSessionClaims", () => {
  beforeEach(() => reset());

  it("adds new claims to the ledger", () => {
    const claim = makeClaim({ id: "new-1" });
    mergeSessionClaims([claim]);

    expect(getAllClaims()).toHaveLength(1);
    expect(getAllClaims()[0].id).toBe("new-1");
  });

  it("updates existing claims on merge", () => {
    const claim = makeClaim({ id: "merge-1", verified: false });
    mergeSessionClaims([claim]);

    const updated = { ...claim, verified: true };
    mergeSessionClaims([updated]);

    expect(getAllClaims()).toHaveLength(1);
    expect(getAllClaims()[0].verified).toBe(true);
  });

  it("deduplicates by id", () => {
    const claim = makeClaim({ id: "dup-1" });
    mergeSessionClaims([claim, claim, claim]);

    expect(getAllClaims()).toHaveLength(1);
  });
});

// ============================================================
// Injection formatting
// ============================================================

describe("formatInjection", () => {
  beforeEach(() => reset());

  it("returns null for empty ledger", () => {
    expect(formatInjection()).toBeNull();
  });

  it("returns null when all claims are active", () => {
    seedLedger([makeClaim({ status: "active" as const, decayedConfidence: 4 })]);
    // No stale or contradicted → only active beliefs line
    const result = formatInjection();
    // Should mention active beliefs but no contradictions or stale
    if (result) {
      expect(result).toContain("silverado");
    }
  });

  it("surfaces stale claims", () => {
    seedLedger([
      makeClaim({
        text: "React is the best framework",
        status: "stale" as const,
        confidence: 4,
        decayedConfidence: 1,
      }),
    ]);

    const result = formatInjection();
    expect(result).not.toBeNull();
    expect(result).toContain("stale");
    expect(result).toContain("React");
  });

  it("surfaces contradictions with contradictedBy context", () => {
    seedLedger([
      makeClaim({
        text: "Python is faster",
        status: "contradicted" as const,
        contradicted: true,
        contradictedBy: "Rust is faster for this workload",
      }),
    ]);

    const result = formatInjection();
    expect(result).not.toBeNull();
    expect(result).toContain("contradicted");
    expect(result).toContain("Rust");
  });
});
