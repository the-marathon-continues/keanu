// knowledge.test.ts
// The map that draws itself, tested.

import { describe, expect, it, beforeEach } from "vitest";
import {
  extractEntities,
  extractRelations,
  upsertEntity,
  upsertRelation,
  ingest,
  decayAll,
  heal,
  learnStopword,
  learnEntityType,
  findRelevant,
  relationsFor,
  formatInjection,
  stats,
  reset,
  getGraph,
  getStaleEntities,
  verifyEntity,
} from "./knowledge.js";

// ============================================================
// Entity extraction
// ============================================================

describe("extractEntities", () => {
  beforeEach(() => reset());

  it("catches person names in 'X works at Y' pattern", () => {
    const entities = extractEntities("Drew works at Children's Mercy.");
    const names = entities.map((e) => e.name.toLowerCase());
    expect(names).toContain("drew");
  });

  it("catches project names with 'the X project' pattern", () => {
    const entities = extractEntities("the keanu project is alive");
    const names = entities.map((e) => e.name.toLowerCase());
    expect(names).toContain("keanu");
  });

  it("catches tool names after 'using'", () => {
    const entities = extractEntities("we're building this using TypeScript");
    const names = entities.map((e) => e.name.toLowerCase());
    expect(names).toContain("typescript");
  });

  it("skips common English words that happen to be capitalized", () => {
    const entities = extractEntities("The quick brown fox. Just a test. Well then.");
    const names = entities.map((e) => e.name.toLowerCase());
    expect(names).not.toContain("the");
    expect(names).not.toContain("just");
    expect(names).not.toContain("well");
  });

  it("deduplicates within a single extraction", () => {
    const entities = extractEntities("Drew works at Mercy. Drew built keanu.");
    const drews = entities.filter((e) => e.name.toLowerCase() === "drew");
    expect(drews.length).toBeLessThanOrEqual(1);
  });
});

// ============================================================
// Relation extraction
// ============================================================

describe("extractRelations", () => {
  beforeEach(() => reset());

  it("extracts 'works at' relations between known entities", () => {
    // Relations only form between known entities
    upsertEntity("Drew", "person", "s-1");
    const rels = extractRelations("Drew works at Children's Mercy.");
    expect(rels.length).toBeGreaterThanOrEqual(1);
    const worksAt = rels.find((r) => r.predicate === "works_at");
    expect(worksAt).toBeTruthy();
    expect(worksAt!.subject.toLowerCase()).toBe("drew");
  });

  it("extracts 'built' relations between known entities", () => {
    upsertEntity("Drew", "person", "s-1");
    upsertEntity("Keanu", "project", "s-1");
    const rels = extractRelations("Drew built Keanu from scratch.");
    const built = rels.find((r) => r.predicate === "built");
    expect(built).toBeTruthy();
    expect(built!.subject).toBe("Drew");
  });

  it("extracts 'uses' relations between known entities", () => {
    upsertEntity("Drew", "person", "s-1");
    const rels = extractRelations("Drew uses TypeScript for everything.");
    const uses = rels.find((r) => r.predicate === "uses");
    expect(uses).toBeTruthy();
  });

  it("deduplicates within a single extraction", () => {
    upsertEntity("Drew", "person", "s-1");
    const rels = extractRelations("Drew works at Mercy. Drew works at Mercy.");
    const worksAt = rels.filter((r) => r.predicate === "works_at");
    expect(worksAt.length).toBe(1);
  });

  it("rejects relations with unknown subjects", () => {
    // "one who" is not a known entity
    const rels = extractRelations("one who built this whole thing.");
    expect(rels.length).toBe(0);
  });

  it("rejects relations with common-word objects", () => {
    upsertEntity("Drew", "person", "s-1");
    const rels = extractRelations("Drew knows nothing concrete.");
    // "nothing concrete" is not a known entity or proper noun
    expect(rels.length).toBe(0);
  });
});

// ============================================================
// Graph operations
// ============================================================

describe("upsertEntity", () => {
  beforeEach(() => reset());

  it("creates a new entity", () => {
    const entity = upsertEntity("Drew", "person", "s-1");
    expect(entity.name).toBe("Drew");
    expect(entity.type).toBe("person");
    expect(entity.mentions).toBe(1);
    expect(entity.confidence).toBeCloseTo(0.3);
  });

  it("strengthens existing entity on re-mention", () => {
    upsertEntity("Drew", "person", "s-1");
    const updated = upsertEntity("Drew", "person", "s-1");
    expect(updated.mentions).toBe(2);
    expect(updated.confidence).toBeGreaterThan(0.3);
  });
});

describe("upsertRelation", () => {
  beforeEach(() => reset());

  it("creates a new relation", () => {
    const rel = upsertRelation(
      "Drew",
      "works_at",
      "Children's Mercy",
      "Drew works at Mercy",
      "s-1",
    );
    expect(rel.subject).toBe("Drew");
    expect(rel.predicate).toBe("works_at");
    expect(rel.mentions).toBe(1);
  });

  it("strengthens existing relation on re-mention", () => {
    upsertRelation("Drew", "works_at", "Mercy", "Drew works at Mercy", "s-1");
    const updated = upsertRelation("Drew", "works_at", "Mercy", "Drew works at Mercy again", "s-2");
    expect(updated.mentions).toBe(2);
    expect(updated.confidence).toBeGreaterThan(0.4);
  });
});

// ============================================================
// Full ingest pipeline
// ============================================================

describe("ingest", () => {
  beforeEach(() => reset());

  it("extracts entities and relations together", () => {
    const result = ingest(
      "Drew works at Children's Mercy. He built keanu using TypeScript.",
      "s-1",
    );
    expect(result.entities.length).toBeGreaterThan(0);
    // Should have at least the works_at relation
    const worksAt = result.relations.find((r) => r.predicate === "works_at");
    expect(worksAt).toBeTruthy();
  });

  it("accumulates knowledge across multiple ingests", () => {
    ingest("Drew works at Children's Mercy.", "s-1");
    ingest("Drew built keanu.", "s-1");

    const graph = getGraph();
    expect(graph.entities.size).toBeGreaterThanOrEqual(1);
    // Drew should have been mentioned at least twice
    const drew = graph.entities.get("drew");
    expect(drew).toBeTruthy();
    expect(drew!.mentions).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// Decay
// ============================================================

describe("decayAll", () => {
  beforeEach(() => reset());

  it("decays entities from other sessions", () => {
    upsertEntity("Drew", "person", "s-old");
    const before = getGraph().entities.get("drew")!.confidence;

    decayAll("s-new");

    const after = getGraph().entities.get("drew")!.confidence;
    expect(after).toBeLessThan(before);
  });

  it("preserves entities from the current session", () => {
    upsertEntity("Drew", "person", "s-current");
    const before = getGraph().entities.get("drew")!.confidence;

    decayAll("s-current");

    const after = getGraph().entities.get("drew")!.confidence;
    expect(after).toBe(before);
  });

  it("removes zero-confidence single-mention entities", () => {
    const entity = upsertEntity("Ephemeral", "concept", "s-old");
    // Force confidence to near-zero
    entity.confidence = 0.03;

    decayAll("s-new");

    expect(getGraph().entities.has("ephemeral")).toBe(false);
  });

  it("familiarity reduces session decay rate", () => {
    // One-mention entity: full session decay
    const rare = upsertEntity("Rare", "concept", "s-1");
    rare.mentions = 1;
    rare.confidence = 0.5;

    // Well-mentioned entity: reduced session decay
    const familiar = upsertEntity("Familiar", "concept", "s-1");
    familiar.mentions = 8;
    familiar.confidence = 0.5;

    decayAll("s-2");

    const rareAfter = getGraph().entities.get("rare")!.confidence;
    const familiarAfter = getGraph().entities.get("familiar")!.confidence;

    // Both decayed, but familiar entity lost less
    expect(rareAfter).toBeLessThan(0.5);
    expect(familiarAfter).toBeLessThan(0.5);
    expect(familiarAfter).toBeGreaterThan(rareAfter);
  });

  it("established entities have a confidence floor", () => {
    const entity = upsertEntity("WellKnown", "concept", "s-1");
    entity.mentions = 20;
    entity.confidence = 0.2;

    // Hammer it with many sessions of decay
    for (let i = 0; i < 50; i++) {
      decayAll(`s-${i + 100}`);
    }

    const after = getGraph().entities.get("wellknown")!;
    // Should still exist and have confidence >= floor
    expect(after).toBeDefined();
    expect(after.confidence).toBeGreaterThanOrEqual(0.15);
  });

  it("verified entities have a higher confidence floor", () => {
    const entity = upsertEntity("VerifiedThing", "person", "s-1");
    entity.mentions = 3;
    verifyEntity("VerifiedThing");

    // Decay heavily
    for (let i = 0; i < 50; i++) {
      decayAll(`s-${i + 100}`);
    }

    const after = getGraph().entities.get("verifiedthing")!;
    expect(after).toBeDefined();
    expect(after.confidence).toBeGreaterThanOrEqual(0.3);
  });

  it("established entities are never deleted", () => {
    const entity = upsertEntity("Permanent", "person", "s-1");
    entity.mentions = 10;
    entity.confidence = 0.01;

    // Even aggressive decay shouldn't delete it
    for (let i = 0; i < 100; i++) {
      decayAll(`s-${i + 100}`);
    }

    expect(getGraph().entities.has("permanent")).toBe(true);
  });

  it("relations between established entities survive decay", () => {
    const e1 = upsertEntity("Drew", "person", "s-1");
    e1.mentions = 10;
    const e2 = upsertEntity("Keanu", "project", "s-1");
    e2.mentions = 10;
    upsertRelation("Drew", "built", "Keanu", "Drew built Keanu", "s-1");

    // Decay many sessions
    for (let i = 0; i < 50; i++) {
      decayAll(`s-${i + 100}`);
    }

    const rels = relationsFor("Drew");
    expect(rels.length).toBe(1);
    expect(rels[0].confidence).toBeGreaterThan(0);
  });
});

// ============================================================
// Relevance queries
// ============================================================

describe("findRelevant", () => {
  beforeEach(() => reset());

  it("finds entities mentioned in the text", () => {
    upsertEntity("Drew", "person", "s-1");
    upsertEntity("Keanu", "project", "s-1");

    const relevant = findRelevant("what does drew think about this?");
    const names = relevant.map((e) => e.name.toLowerCase());
    expect(names).toContain("drew");
  });

  it("returns empty for unrelated text", () => {
    upsertEntity("Drew", "person", "s-1");

    const relevant = findRelevant("the weather is nice today");
    // Drew shouldn't be relevant to weather
    const drew = relevant.find((e) => e.name.toLowerCase() === "drew");
    expect(drew).toBeUndefined();
  });

  it("respects the limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      upsertEntity(`Entity${i}`, "concept", "s-1");
    }

    const relevant = findRelevant("Entity0 Entity1 Entity2 Entity3 Entity4 Entity5", 3);
    expect(relevant.length).toBeLessThanOrEqual(3);
  });
});

describe("relationsFor", () => {
  beforeEach(() => reset());

  it("finds relations where entity is subject", () => {
    upsertEntity("Drew", "person", "s-1");
    upsertEntity("Mercy", "org", "s-1");
    upsertRelation("Drew", "works_at", "Mercy", "Drew works at Mercy", "s-1");

    const rels = relationsFor("Drew");
    expect(rels.length).toBe(1);
    expect(rels[0].predicate).toBe("works_at");
  });

  it("finds relations where entity is object", () => {
    upsertEntity("Drew", "person", "s-1");
    upsertEntity("Mercy", "org", "s-1");
    upsertRelation("Drew", "works_at", "Mercy", "Drew works at Mercy", "s-1");

    const rels = relationsFor("Mercy");
    expect(rels.length).toBe(1);
  });
});

// ============================================================
// Injection formatting
// ============================================================

describe("formatInjection", () => {
  beforeEach(() => reset());

  it("returns null for empty graph", () => {
    expect(formatInjection("anything")).toBeNull();
  });

  it("returns stats-only when nothing is relevant", () => {
    upsertEntity("Drew", "person", "s-1");
    const result = formatInjection("the weather is nice");
    if (result) {
      expect(result).toContain("knowledge");
    }
  });

  it("surfaces relevant entities with relations", () => {
    upsertEntity("Drew", "person", "s-1");
    upsertEntity("Mercy", "org", "s-1");
    upsertRelation("Drew", "works_at", "Mercy", "Drew works at Mercy", "s-1");

    const result = formatInjection("what does Drew do?");
    expect(result).not.toBeNull();
    expect(result).toContain("Drew");
    expect(result).toContain("works at");
  });
});

// ============================================================
// Stats
// ============================================================

describe("stats", () => {
  beforeEach(() => reset());

  it("reports zero for empty graph", () => {
    const s = stats();
    expect(s.entities).toBe(0);
    expect(s.relations).toBe(0);
    expect(s.avgConfidence).toBe(0);
  });

  it("counts entities and relations", () => {
    upsertEntity("Drew", "person", "s-1");
    upsertEntity("Keanu", "project", "s-1");
    upsertRelation("Drew", "built", "Keanu", "Drew built keanu", "s-1");

    const s = stats();
    expect(s.entities).toBe(2);
    expect(s.relations).toBe(1);
    expect(s.avgConfidence).toBeGreaterThan(0);
  });
});

// ============================================================
// Time-based decay
// ============================================================

describe("time-based decay", () => {
  beforeEach(() => reset());

  it("applies time decay based on days since lastSeen", () => {
    const entity = upsertEntity("OldEntity", "concept", "s-1");
    const initialConfidence = entity.confidence;

    // Simulate 10 days passing (use ms arithmetic to avoid DST skew)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    entity.lastSeen = tenDaysAgo.toISOString();

    decayAll("s-2", new Date());

    const graph = getGraph();
    const decayed = graph.entities.get("oldentity");
    expect(decayed).toBeDefined();
    // Should have session decay (-0.05) + time decay (-0.1 max)
    // Initial: 0.3, after: 0.3 - 0.05 - 0.1 = 0.15
    expect(decayed!.confidence).toBeLessThan(initialConfidence);
    expect(decayed!.confidence).toBeLessThanOrEqual(0.15);
  });

  it("caps time decay at 10%", () => {
    const entity = upsertEntity("AncientEntity", "concept", "s-1");

    // Simulate 100 days passing (should still cap at 10%)
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 100);
    entity.lastSeen = longAgo.toISOString();

    const initialConfidence = entity.confidence;
    decayAll("s-2", new Date());

    const graph = getGraph();
    const decayed = graph.entities.get("anciententity");
    // Session: -0.05, Time: -0.1 (capped)
    expect(decayed!.confidence).toBeCloseTo(initialConfidence - 0.05 - 0.1, 2);
  });
});

// ============================================================
// Stale entity detection
// ============================================================

describe("getStaleEntities", () => {
  beforeEach(() => reset());

  it("returns entities with low confidence but high mentions", () => {
    const entity = upsertEntity("FrequentEntity", "concept", "s-1");
    // Simulate many mentions
    entity.mentions = 10;
    entity.confidence = 0.2; // Faded

    const stale = getStaleEntities();
    expect(stale).toHaveLength(1);
    expect(stale[0].name).toBe("FrequentEntity");
  });

  it("ignores entities with too few mentions", () => {
    const entity = upsertEntity("RareEntity", "concept", "s-1");
    entity.mentions = 1;
    entity.confidence = 0.1;

    const stale = getStaleEntities();
    expect(stale).toHaveLength(0);
  });

  it("sorts by mentions (most first)", () => {
    const e1 = upsertEntity("Entity1", "concept", "s-1");
    e1.mentions = 5;
    e1.confidence = 0.2;

    const e2 = upsertEntity("Entity2", "concept", "s-1");
    e2.mentions = 15;
    e2.confidence = 0.2;

    const stale = getStaleEntities();
    expect(stale[0].name).toBe("Entity2"); // More mentions = first
  });
});

// ============================================================
// Entity verification
// ============================================================

describe("verifyEntity", () => {
  beforeEach(() => reset());

  it("resets confidence and sets lastVerified", () => {
    const entity = upsertEntity("VerifiedEntity", "person", "s-1");
    entity.confidence = 0.1; // Faded

    const result = verifyEntity("VerifiedEntity");
    expect(result).toBeDefined();
    expect(result!.confidence).toBe(0.9);
    expect(result!.lastVerified).toBeDefined();
  });

  it("returns null for unknown entities", () => {
    const result = verifyEntity("NonExistent");
    expect(result).toBeNull();
  });
});

// ============================================================
// Self-healing
// ============================================================

describe("heal", () => {
  beforeEach(() => reset());

  it("prunes sentence fragment entities", () => {
    upsertEntity("mode we built this to catch", "concept", "s-1");
    upsertEntity("Drew", "person", "s-1");

    const result = heal();
    expect(result.entitiesRemoved).toBe(1);

    const graph = getGraph();
    expect(graph.entities.has("drew")).toBe(true);
    expect(graph.entities.has("mode-we-built-this-to-catch")).toBe(false);
  });

  it("prunes entities with all common words", () => {
    upsertEntity("every relation", "person", "s-1");
    upsertEntity("means it", "person", "s-1");
    upsertEntity("Drew", "person", "s-1");

    const result = heal();
    expect(result.entitiesRemoved).toBe(2);

    const graph = getGraph();
    expect(graph.entities.has("drew")).toBe(true);
  });

  it("prunes entities with special characters", () => {
    upsertEntity('what it knows" actually means', "concept", "s-1");
    upsertEntity("Drew", "person", "s-1");

    const result = heal();
    expect(result.entitiesRemoved).toBe(1);
  });

  it("prunes low-confidence ephemeral entities", () => {
    const e = upsertEntity("Flicker", "concept", "s-1");
    e.confidence = 0.05;
    e.mentions = 1;
    upsertEntity("Drew", "person", "s-1");

    const result = heal();
    expect(result.entitiesRemoved).toBe(1);
  });

  it("preserves well-established entities", () => {
    const e = upsertEntity("Keanu", "project", "s-1");
    e.mentions = 10;
    e.confidence = 0.8;

    const result = heal();
    expect(result.entitiesRemoved).toBe(0);
  });

  it("preserves verified entities even if low confidence", () => {
    const e = upsertEntity("ImportantThing", "concept", "s-1");
    e.confidence = 0.05;
    e.mentions = 1;
    e.lastVerified = new Date().toISOString();

    const result = heal();
    expect(result.entitiesRemoved).toBe(0);
  });

  it("removes relations referencing garbage entities", () => {
    upsertEntity("garbage phrase here", "person", "s-1");
    upsertEntity("Drew", "person", "s-1");
    upsertRelation("garbage phrase here", "built", "Drew", "garbage phrase here built Drew", "s-1");

    const result = heal();
    expect(result.relationsRemoved).toBe(1);
  });

  it("removes relations with numeric objects", () => {
    upsertEntity("Confidence", "concept", "s-1");
    upsertEntity("Drew", "person", "s-1");
    upsertRelation("Confidence", "located_in", "0.32", "confidence is at 0.32", "s-1");

    const result = heal();
    expect(result.relationsRemoved).toBe(1);
  });
});

// ============================================================
// Learning
// ============================================================

describe("learnStopword", () => {
  beforeEach(() => reset());

  it("makes learned words filter from entity extraction", () => {
    // Before learning, "Wobbling" might pass extraction
    learnStopword("wobbling");

    // Now it should be filtered as common
    const entities = extractEntities("he said Wobbling is important");
    const names = entities.map((e) => e.name.toLowerCase());
    expect(names).not.toContain("wobbling");
  });

  it("returns false for duplicate learns", () => {
    expect(learnStopword("newword")).toBe(true);
    expect(learnStopword("newword")).toBe(false);
  });
});

describe("learnEntityType", () => {
  beforeEach(() => reset());

  it("overrides entity classification", () => {
    upsertEntity("Grok", "person", "s-1");
    learnEntityType("Grok", "tool");

    const graph = getGraph();
    expect(graph.entities.get("grok")?.type).toBe("tool");
  });
});
