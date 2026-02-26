import { describe, it, expect } from "vitest";
import {
  triageInjection,
  type InjectionItem,
  type InjectionBudget,
  type InjectionContext,
} from "./injection.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function item(
  id: string,
  priority: InjectionItem["priority"],
  category: InjectionItem["category"],
  chars = 200,
): InjectionItem {
  return {
    id,
    content: "x".repeat(chars),
    priority,
    category,
  };
}

function itemWith(
  id: string,
  priority: InjectionItem["priority"],
  category: InjectionItem["category"],
  content: string,
): InjectionItem {
  return { id, content, priority, category };
}

// ---------------------------------------------------------------------------
// 1. The overflow — 20 items, 8000 chars. Budget holds.
// ---------------------------------------------------------------------------

describe("the overflow", () => {
  it("stays under hard budget when items exceed it", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      item(`item-${i}`, "medium", "awareness", 400),
    );
    const budget: InjectionBudget = { soft: 4000, hard: 5000 };
    const result = triageInjection(items, {}, budget);

    const totalChars = result.parts.reduce((s, p) => s + p.length, 0);
    expect(totalChars).toBeLessThanOrEqual(5000);
    expect(result.deferred.length).toBeGreaterThan(0);
    expect(result.stats.chars).toBe(totalChars);
  });
});

// ---------------------------------------------------------------------------
// 2. The fire — critical items bypass the budget entirely.
// ---------------------------------------------------------------------------

describe("the fire", () => {
  it("lets critical items through even with a tiny budget", () => {
    const stop = item("stop-protocol", "critical", "identity", 500);
    const budget: InjectionBudget = { soft: 100, hard: 100 };
    const result = triageInjection([stop], {}, budget);

    expect(result.parts).toHaveLength(1);
    expect(result.stats.chars).toBe(500);
    expect(result.deferred).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. The hot room — health bumps up, LOW items get dropped.
// ---------------------------------------------------------------------------

describe("the hot room", () => {
  it("drops low items and bumps health to high when system is hot", () => {
    const health = item("health", "medium", "awareness", 100);
    const lowMeta = item("curiosity", "low", "meta", 100);
    const lowMeta2 = item("stale-claims", "low", "meta", 100);
    const ctx: InjectionContext = { healthStatus: "hot" };
    const result = triageInjection([health, lowMeta, lowMeta2], ctx);

    // Health should be in, low items should be deferred
    expect(result.parts).toHaveLength(1);
    expect(result.deferred).toHaveLength(2);
    expect(result.stats.deferredCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 4. The grey streak — nudges, grey-streak, reflexion all bump up.
// ---------------------------------------------------------------------------

describe("the grey streak", () => {
  it("bumps nudge and grey-streak to high priority on 5+ consecutive greys", () => {
    const nudge = item("nudge", "medium", "awareness", 150);
    const greyStreak = item("grey-streak", "medium", "awareness", 150);
    const reflexion = item("reflexion", "medium", "awareness", 150);
    const filler = item("filler", "high", "identity", 3600);
    const ctx: InjectionContext = { consecutiveGrey: 7 };
    const budget: InjectionBudget = { soft: 4000, hard: 5000 };
    const result = triageInjection([filler, nudge, greyStreak, reflexion], ctx, budget);

    // All three should be bumped to high and fit within soft budget alongside filler
    // 3600 + 150 + 150 + 150 = 4050 — nudge/grey-streak/reflexion are now high,
    // so they compete with filler for the soft budget (4000)
    // filler (3600) + one more (3750) fits. Two more (3900) fits. Three more (4050) > soft.
    // But they're all high now, so they fill up to soft=4000. One gets deferred.
    expect(result.parts.length).toBeGreaterThanOrEqual(3);
    // At least the bumped items should be prioritized
    const inParts = result.parts.length;
    const inDeferred = result.deferred.length;
    expect(inParts + inDeferred).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 5. Strained trust — calibration, deliberation, mismatch jump the line.
// ---------------------------------------------------------------------------

describe("strained trust", () => {
  it("bumps calibration, deliberation, and mismatch to high", () => {
    const cal = item("calibration", "medium", "task", 200);
    const del = item("deliberation", "medium", "task", 200);
    const mm = item("mismatch", "medium", "task", 200);
    // Add a regular medium that shouldn't get bumped
    const regular = item("coef-trend", "medium", "awareness", 200);
    const ctx: InjectionContext = { trustState: "strained" };
    const budget: InjectionBudget = { soft: 700, hard: 900 };
    const result = triageInjection([regular, cal, del, mm], ctx, budget);

    // The three trust items are now high (fill to soft=700: 200+200+200=600 <=700)
    // regular is still medium (600+200=800 <=900)
    // All four should fit
    expect(result.parts).toHaveLength(4);
    // But the trust items should come first (high before medium)
    // We can verify ordering by checking that chars from first 3 parts = 600
    const first3 = result.parts.slice(0, 3).reduce((s, p) => s + p.length, 0);
    expect(first3).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// 6. The hallway note — deferred items produce a notice.
// ---------------------------------------------------------------------------

describe("the hallway note", () => {
  it("produces a deferral notice when items are deferred", () => {
    const items = [item("a", "medium", "awareness", 3000), item("b", "medium", "awareness", 3000)];
    const budget: InjectionBudget = { soft: 4000, hard: 5000 };
    const result = triageInjection(items, {}, budget);

    expect(result.deferralNotice).not.toBeNull();
    expect(result.deferralNotice).toContain("1 observation deferred");
    expect(result.deferralNotice).toContain("keanu_recall");
  });

  it("uses plural when multiple items deferred", () => {
    const items = [
      item("a", "medium", "awareness", 4500),
      item("b", "medium", "awareness", 1000),
      item("c", "medium", "awareness", 1000),
    ];
    const budget: InjectionBudget = { soft: 4000, hard: 5000 };
    const result = triageInjection(items, {}, budget);

    // a=4500 fits in hard. b=1000 would push to 5500 > hard. c same.
    expect(result.deferralNotice).toContain("observations deferred");
    expect(result.stats.deferredCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 7. The empty room — no items, no crash.
// ---------------------------------------------------------------------------

describe("the empty room", () => {
  it("returns empty result for no items", () => {
    const result = triageInjection([]);
    expect(result.parts).toHaveLength(0);
    expect(result.deferred).toHaveLength(0);
    expect(result.deferralNotice).toBeNull();
    expect(result.stats).toEqual({ chars: 0, count: 0, deferredCount: 0 });
  });

  it("filters out items with empty content", () => {
    const items = [
      itemWith("a", "high", "identity", ""),
      itemWith("b", "high", "identity", "   "),
      itemWith("c", "high", "identity", "real content"),
    ];
    const result = triageInjection(items);
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0]).toBe("real content");
  });
});

// ---------------------------------------------------------------------------
// 8. All fires — every item critical. Budget exceeded gracefully.
// ---------------------------------------------------------------------------

describe("all fires", () => {
  it("lets all critical items through even when they blow the budget", () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      item(`fire-${i}`, "critical", "identity", 2000),
    );
    const budget: InjectionBudget = { soft: 4000, hard: 5000 };
    const result = triageInjection(items, {}, budget);

    // 5 * 2000 = 10000. All should be in — fires don't check occupancy.
    expect(result.parts).toHaveLength(5);
    expect(result.stats.chars).toBe(10000);
    expect(result.deferred).toHaveLength(0);
    expect(result.deferralNotice).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 9. The tiebreaker — same priority, categories break the tie.
// ---------------------------------------------------------------------------

describe("the tiebreaker", () => {
  it("sorts identity before task before awareness before meta at same priority", () => {
    const items = [
      itemWith("meta-thing", "high", "meta", "[meta]"),
      itemWith("awareness-thing", "high", "awareness", "[awareness]"),
      itemWith("task-thing", "high", "task", "[task]"),
      itemWith("identity-thing", "high", "identity", "[identity]"),
    ];
    const result = triageInjection(items);

    expect(result.parts[0]).toBe("[identity]");
    expect(result.parts[1]).toBe("[task]");
    expect(result.parts[2]).toBe("[awareness]");
    expect(result.parts[3]).toBe("[meta]");
  });
});

// ---------------------------------------------------------------------------
// 10. A real turn — 15+ items from a typical session. Reasonable output.
// ---------------------------------------------------------------------------

describe("a real turn", () => {
  it("triages a realistic set of items under budget with correct ordering", () => {
    const items: InjectionItem[] = [
      // Critical: recovery
      itemWith("recovery", "critical", "identity", "[recovery: cool phase. facts only for now.]"),
      // High: identity frame
      itemWith(
        "partnership",
        "high",
        "identity",
        "[partnership: drew + keanu. session 47. trust=high.]",
      ),
      itemWith(
        "primaries",
        "high",
        "awareness",
        "[primaries: r=0.30 y=0.50 b=0.20 → yellow. wm=0.72]",
      ),
      itemWith("human-tone", "high", "awareness", "[human: tone=excited (0.8). they're lit up.]"),
      itemWith("spring", "high", "task", "[spring: intent=build. task=feature. confidence=0.9]"),
      itemWith(
        "summer",
        "high",
        "task",
        "[summer: approach=systematic. discover=decompose+sequence]",
      ),
      itemWith("sing", "high", "identity", "[SING oath acknowledged]"),
      // Medium: task guidance
      itemWith("cascade", "medium", "task", "[cascade: stage=building. flow state.]"),
      itemWith("deliberation", "medium", "task", "[deliberate: no sensitive trigger this turn.]"),
      itemWith("calibration", "medium", "task", "[calibration: no uncertain claims flagged.]"),
      itemWith(
        "mismatch",
        "medium",
        "awareness",
        "[mismatch: none detected. response matched need.]",
      ),
      itemWith("health", "medium", "awareness", "[health: steady. all factors nominal.]"),
      itemWith("blind-spots", "medium", "awareness", "[blind spots: none persistent.]"),
      itemWith(
        "coef-trend",
        "medium",
        "awareness",
        "[coef: grey_rate=5% avg_wm=0.68 drift=stable]",
      ),
      // Low: meta
      itemWith(
        "consulted",
        "low",
        "meta",
        "[consulted: system prompt unchanged since last session.]",
      ),
      itemWith(
        "curiosity",
        "low",
        "meta",
        "[curiosity: last session you wondered about prompt injection signal-to-noise.]",
      ),
      itemWith(
        "tools-reminder",
        "low",
        "meta",
        "[you have hands: keanu_pulse, keanu_disagree, keanu_recall...]",
      ),
      itemWith("skills-reminder", "low", "meta", "[you have skills: ultimate-coder, carnegie...]"),
    ];

    const result = triageInjection(items);

    // Critical should be first
    expect(result.parts[0]).toContain("recovery");

    // Total chars should be reasonable
    expect(result.stats.chars).toBeLessThanOrEqual(5000);

    // Some items should have made it through
    expect(result.stats.count).toBeGreaterThan(10);

    // Everything should be accounted for
    expect(result.stats.count + result.stats.deferredCount).toBe(items.length);

    // If anything's deferred, there should be a notice
    if (result.stats.deferredCount > 0) {
      expect(result.deferralNotice).not.toBeNull();
    }
  });
});
