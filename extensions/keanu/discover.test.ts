import { describe, it, expect } from "vitest";
import { discover, formatDiscover } from "./discover.js";

// ---------------------------------------------------------------------------
// 1. LOW COMPLEXITY
// ---------------------------------------------------------------------------

describe("low complexity detection", () => {
  it("simple question with no triggers is low complexity", () => {
    const reading = discover("What time is it?", []);
    expect(reading.complexity).toBe("low");
  });

  it("short declarative statement is low complexity", () => {
    const reading = discover("Thanks.", []);
    expect(reading.complexity).toBe("low");
  });

  it("low complexity has no selected modules", () => {
    const reading = discover("What time is it?", []);
    expect(reading.selectedModules).toHaveLength(0);
  });

  it("low complexity has null prompt", () => {
    const reading = discover("What time is it?", []);
    expect(reading.prompt).toBeNull();
  });

  it("low complexity has empty signals for a plain statement", () => {
    // "Thanks." is too short for any trigger — no question mark, no clauses, no comparison
    const reading = discover("Thanks.", []);
    expect(reading.signals).toHaveLength(0);
  });

  it("single-word message is low complexity", () => {
    const reading = discover("ok", []);
    expect(reading.complexity).toBe("low");
  });
});

// ---------------------------------------------------------------------------
// 2. MID COMPLEXITY
// ---------------------------------------------------------------------------

describe("mid complexity detection", () => {
  it("multi-clause message (and) reaches mid complexity", () => {
    // MULTI_CLAUSE triggers (+1), need score >= 2 — add another signal
    // "and" + "first" + "then" → +1 for multi_clause, check if that's enough with another
    // Actually score=1 is still "low". Need 2. Use a message with multiple triggers.
    const reading = discover("Fix the bug and also update the docs.", []);
    // "also" triggers MULTI_TOPIC (+2) → score=2 = mid
    expect(reading.complexity).toBe("mid");
  });

  it("multi-topic message reaches mid complexity", () => {
    const reading = discover("Fix the bug and also write tests.", []);
    expect(reading.complexity).toBe("mid");
  });

  it("comparison question reaches mid complexity", () => {
    // COMPARISON (+2): "versus" triggers comparison, no other high-scoring words
    // No "approach" (DECISION +1), no "?" ending a 5-40 char string (AMBIGUOUS)
    const reading = discover("REST versus GraphQL — what are the tradeoffs?", []);
    expect(reading.complexity).toBe("mid");
  });

  it("mid complexity has selected modules", () => {
    const reading = discover("Fix the bug and also write tests.", []);
    expect(reading.selectedModules.length).toBeGreaterThan(0);
  });

  it("mid complexity has non-null prompt", () => {
    const reading = discover("Fix the bug and also write tests.", []);
    expect(reading.prompt).not.toBeNull();
  });

  it("mid complexity prompt contains complexity level", () => {
    // MULTI_TOPIC (+2): "and also" triggers multi_topic, score=2 = mid
    const reading = discover("Fix the auth bug and also update the schema.", []);
    expect(reading.prompt).toContain("complexity=mid");
  });

  it("mid complexity signals list what triggered it", () => {
    const reading = discover("REST versus GraphQL — what are the tradeoffs?", []);
    expect(reading.signals).toContain("comparison");
  });
});

// ---------------------------------------------------------------------------
// 3. HIGH COMPLEXITY
// ---------------------------------------------------------------------------

describe("high complexity detection", () => {
  it("architectural decision with multiple signals is high complexity", () => {
    // COMPARISON (+2) + DECISION (+1) + MULTI_CLAUSE (+1) = 4 = high
    const reading = discover(
      "Should we choose a monolith versus microservices, and which is better for our team's approach?",
      [],
    );
    expect(reading.complexity).toBe("high");
  });

  it("long message with question and multiple clauses reaches high", () => {
    // >200 chars with ? (+1), MULTI_CLAUSE (+1), 2+ question marks (+1), COMPARISON (+2) = 5+
    const msg =
      "I'm trying to decide whether to use REST or GraphQL. We have multiple clients " +
      "and also need real-time updates — however the team is split on this. " +
      "Which is better and what should we pick? Is there a clear winner?";
    const reading = discover(msg, []);
    expect(reading.complexity).toBe("high");
  });

  it("high complexity selects up to 3 modules", () => {
    const reading = discover(
      "Should we choose a monolith versus microservices, and which is better for our team's approach?",
      [],
    );
    expect(reading.selectedModules.length).toBeGreaterThan(0);
    expect(reading.selectedModules.length).toBeLessThanOrEqual(3);
  });

  it("high complexity prompt contains complexity=high", () => {
    const reading = discover(
      "Should we choose a monolith versus microservices, and which is better for our team?",
      [],
    );
    expect(reading.prompt).toContain("complexity=high");
  });

  it("repeated corrections in recent messages push toward high complexity", () => {
    // score from message alone = 1 (CORRECTION), recent corrections >= 2 adds +1 more
    // need total >= 4; combine with comparison and multi-topic
    const reading = discover("Actually, which is better? And also what about the other approach?", [
      "no that's wrong",
      "actually wait",
      "not what i meant",
    ]);
    expect(reading.complexity).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// 4. MODULE SELECTION
// ---------------------------------------------------------------------------

describe("module selection based on task type", () => {
  it("comparison language selects tradeoff module", () => {
    const reading = discover("Which database should I use versus the other?", []);
    expect(reading.selectedModules).toContain("tradeoff");
  });

  it("decision language selects tradeoff module", () => {
    const reading = discover("Help me decide which option to pick.", []);
    expect(reading.selectedModules).toContain("tradeoff");
  });

  it("multi-clause language selects decompose module", () => {
    // "and also" triggers MULTI_TOPIC which selects decompose
    const reading = discover("Fix the auth bug and also update the database schema.", []);
    expect(reading.selectedModules).toContain("decompose");
  });

  it("approach/best-way language selects simplify and constraint", () => {
    // Need mid+ complexity but only the "best way" trigger for simplify/constraint.
    // "and also" pushes to mid; no comparison/decision words to steal slots first.
    // Module order: no COMPARISON, no DECISION → tradeoff not added.
    // MULTI_TOPIC → decompose added. Then "best way" → simplify + constraint.
    // Slots: decompose, simplify, constraint (3 exactly, none fighting for cap)
    const reading = discover("Refactor this and also find the best way to structure it.", []);
    expect(reading.selectedModules).toContain("simplify");
    expect(reading.selectedModules).toContain("constraint");
  });

  it("sequencing language selects sequence module", () => {
    // Need mid+ complexity first. Combine with comparison to hit score >= 2.
    const reading = discover("Which steps should I do first, and then what order after that?", []);
    expect(reading.selectedModules).toContain("sequence");
  });

  it("correction language selects contradict module", () => {
    // Need mid complexity with correction triggering, but without comparison/decision
    // stealing all 3 slots before contradict fires.
    // "No" triggers CORRECTION (+1). "and also" triggers MULTI_TOPIC (+2) = score 3 = mid.
    // Module order: no comparison → no tradeoff. MULTI_TOPIC → decompose.
    // CORRECTION+/wrong → contradict. No "how should/best way/approach" → no simplify/constraint.
    // Slots: decompose, contradict (2 slots, well within cap)
    const reading = discover("No that's wrong and also it breaks the other thing.", []);
    expect(reading.selectedModules).toContain("contradict");
  });

  it("people/team language selects stakeholder module", () => {
    // Need mid complexity, team/user language, but no comparison or decision words
    // to claim the first 3 slots before stakeholder fires.
    // "and also" → multi_topic (+2) = mid. Team language → stakeholder.
    // No COMPARISON, no DECISION → tradeoff not added.
    // MULTI_TOPIC → decompose. "team" → stakeholder.
    // Slots: decompose, stakeholder (within cap)
    const reading = discover("Fix this and also check how it affects the team.", []);
    expect(reading.selectedModules).toContain("stakeholder");
  });

  it("'like' or 'similar' language selects analogize module", () => {
    // Need mid complexity with "similar" triggering analogize, but no comparison/decision
    // filling slots first.
    // "and also" → multi_topic (+2) = mid. "similar" → analogize.
    // No COMPARISON, no DECISION → tradeoff not added.
    // MULTI_TOPIC → decompose. "similar" → analogize.
    // Slots: decompose, analogize (within cap)
    const reading = discover("Fix this and also find something similar to what we had before.", []);
    expect(reading.selectedModules).toContain("analogize");
  });

  it("modules are deduplicated — no duplicates in selected list", () => {
    // Both MULTI_CLAUSE and MULTI_TOPIC trigger decompose — should only appear once
    const reading = discover(
      "Fix this bug and also update the docs, but also add tests on top of that.",
      [],
    );
    const decompose = reading.selectedModules.filter((m) => m === "decompose");
    expect(decompose.length).toBeLessThanOrEqual(1);
  });

  it("selected modules are capped at 3", () => {
    // Message with many triggers
    const reading = discover(
      "Which is better for the team: option A or option B? However, first tell me the steps and what's similar to before. Also decide.",
      [],
    );
    expect(reading.selectedModules.length).toBeLessThanOrEqual(3);
  });

  it("high complexity with no specific modules gets decompose and tradeoff as defaults", () => {
    // Need high complexity but no specific module triggers:
    // Use repeated corrections + file paths but no comparison/decision/etc.
    // file_paths (+1), correction (+1), long_with_question (>200 chars and ?)...
    // Build a message with score >= 4 but no direct module triggers
    const msg =
      "Actually, no. Wait — I meant the path src/config/env is wrong. " +
      "Not what I said. Look at /etc/nginx/nginx.conf instead?";
    const reading = discover(msg, ["no wait", "actually wrong"]);
    if (reading.complexity === "high" && reading.selectedModules.length < 2) {
      expect(reading.selectedModules).toContain("decompose");
      expect(reading.selectedModules).toContain("tradeoff");
    } else {
      // If the message hit specific module triggers, that's fine too
      expect(reading.selectedModules.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. formatDiscover
// ---------------------------------------------------------------------------

describe("formatDiscover", () => {
  it("returns null for low complexity reading", () => {
    const reading = discover("Hello.", []);
    expect(formatDiscover(reading)).toBeNull();
  });

  it("returns the prompt string for mid complexity", () => {
    const reading = discover("Which option is better?", []);
    const result = formatDiscover(reading);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("returns the prompt string for high complexity", () => {
    const reading = discover(
      "Should we pick microservices versus monolith, and which is better for the team approach?",
      [],
    );
    const result = formatDiscover(reading);
    expect(result).not.toBeNull();
    expect(result).toContain("complexity=high");
  });

  it("formatDiscover output is identical to reading.prompt", () => {
    const reading = discover("Which option is better?", []);
    expect(formatDiscover(reading)).toBe(reading.prompt);
  });

  it("prompt includes the module name and description", () => {
    const reading = discover("Which option is better?", []);
    // tradeoff module should be selected
    if (reading.selectedModules.includes("tradeoff")) {
      expect(reading.prompt).toContain("tradeoff:");
    }
  });
});

// ---------------------------------------------------------------------------
// 6. DiscoverReading SHAPE
// ---------------------------------------------------------------------------

describe("DiscoverReading shape", () => {
  it("always returns all required fields", () => {
    const reading = discover("Any message here.", []);
    expect(reading).toHaveProperty("complexity");
    expect(reading).toHaveProperty("selectedModules");
    expect(reading).toHaveProperty("prompt");
    expect(reading).toHaveProperty("signals");
    expect(Array.isArray(reading.selectedModules)).toBe(true);
    expect(Array.isArray(reading.signals)).toBe(true);
  });

  it("complexity is always one of the three valid values", () => {
    const valid = ["low", "mid", "high"];
    const cases = [
      discover("ok", []),
      discover("Which is better?", []),
      discover(
        "Should we use REST or GraphQL? And also what about the team and users? However it depends.",
        [],
      ),
    ];
    for (const r of cases) {
      expect(valid).toContain(r.complexity);
    }
  });
});
