// context-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  storeContent,
  retrieve,
  search,
  searchByTopic,
  searchByType,
  getRecent,
  getByTurn,
  decayAll,
  boostRelevance,
  getStats,
  reset,
  getStoreSize,
  getAllIds,
  extractTopics,
  generateSummary,
} from "./context-store.js";

describe("context-store", () => {
  beforeEach(() => {
    reset();
  });

  describe("extractTopics", () => {
    it("extracts meaningful words from text", () => {
      const topics = extractTopics("The quick brown fox jumps over the lazy dog");
      expect(topics).toContain("quick");
      expect(topics).toContain("brown");
      expect(topics).toContain("jumps");
      expect(topics).not.toContain("the"); // stop word
      expect(topics).not.toContain("over"); // stop word
    });

    it("filters out short words", () => {
      const topics = extractTopics("I am a big fan of AI");
      expect(topics).not.toContain("am");
      expect(topics).not.toContain("ai"); // too short (2 chars)
      expect(topics).toContain("fan");
      expect(topics).toContain("big");
    });

    it("respects limit parameter", () => {
      const text = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu";
      const topics = extractTopics(text, 5);
      expect(topics.length).toBe(5);
    });
  });

  describe("generateSummary", () => {
    it("returns first sentence if short enough", () => {
      const summary = generateSummary("This is a test. More content here.");
      expect(summary).toBe("This is a test.");
    });

    it("truncates long first sentences", () => {
      const longText = "A".repeat(150) + ". Second sentence.";
      const summary = generateSummary(longText, 100);
      expect(summary.length).toBeLessThanOrEqual(100);
      expect(summary).toMatch(/\.\.\.$/);
    });

    it("handles text without punctuation", () => {
      const summary = generateSummary("No punctuation here just words", 50);
      expect(summary.length).toBeLessThanOrEqual(50);
    });
  });

  describe("storeContent", () => {
    it("stores content and returns with generated id", () => {
      const stored = storeContent({
        type: "message",
        content: "Hello world, this is a test message about TypeScript",
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      expect(stored.id).toMatch(/^ctx_/);
      expect(stored.topics.length).toBeGreaterThan(0);
      expect(stored.summary).toBeDefined();
    });

    it("uses provided topics if given", () => {
      const stored = storeContent({
        type: "message",
        content: "Some content",
        topics: ["custom", "topics"],
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      expect(stored.topics).toEqual(["custom", "topics"]);
    });

    it("increments store size", () => {
      expect(getStoreSize()).toBe(0);

      storeContent({
        type: "message",
        content: "First message",
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      expect(getStoreSize()).toBe(1);

      storeContent({
        type: "observation",
        content: "Second item",
        timestamp: new Date().toISOString(),
        turn: 2,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      expect(getStoreSize()).toBe(2);
    });
  });

  describe("retrieve", () => {
    it("retrieves stored content by id", () => {
      const stored = storeContent({
        type: "message",
        content: "Test content",
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      const retrieved = retrieve(stored.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.content).toBe("Test content");
    });

    it("returns null for non-existent id", () => {
      const retrieved = retrieve("non_existent_id");
      expect(retrieved).toBeNull();
    });
  });

  describe("search", () => {
    beforeEach(() => {
      storeContent({
        type: "message",
        content: "Discussion about TypeScript and React development",
        topics: ["typescript", "react", "development"],
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      storeContent({
        type: "message",
        content: "Python machine learning project setup",
        topics: ["python", "machine", "learning", "project"],
        timestamp: new Date().toISOString(),
        turn: 2,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      storeContent({
        type: "observation",
        content: "TypeScript compiler configuration options",
        topics: ["typescript", "compiler", "configuration"],
        timestamp: new Date().toISOString(),
        turn: 3,
        relevanceDecay: 1.0,
        recallCount: 0,
      });
    });

    it("finds content by topic match", () => {
      const results = search("typescript");
      expect(results.length).toBe(2);
    });

    it("finds content by direct text match", () => {
      const results = search("Python machine");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain("Python");
    });

    it("respects limit parameter", () => {
      const results = search("typescript", 1);
      expect(results.length).toBe(1);
    });

    it("returns empty array for no matches", () => {
      const results = search("nonexistent topic xyz");
      expect(results.length).toBe(0);
    });
  });

  describe("searchByTopic", () => {
    it("finds all content with specific topic", () => {
      storeContent({
        type: "message",
        content: "First",
        topics: ["api", "rest"],
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      storeContent({
        type: "message",
        content: "Second",
        topics: ["api", "graphql"],
        timestamp: new Date().toISOString(),
        turn: 2,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      const results = searchByTopic("api");
      expect(results.length).toBe(2);
    });
  });

  describe("searchByType", () => {
    it("filters by content type", () => {
      storeContent({
        type: "message",
        content: "A message",
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      storeContent({
        type: "observation",
        content: "An observation",
        timestamp: new Date().toISOString(),
        turn: 2,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      const messages = searchByType("message");
      expect(messages.length).toBe(1);
      expect(messages[0].type).toBe("message");

      const observations = searchByType("observation");
      expect(observations.length).toBe(1);
      expect(observations[0].type).toBe("observation");
    });
  });

  describe("getRecent", () => {
    it("returns most recent items by turn", () => {
      for (let i = 1; i <= 5; i++) {
        storeContent({
          type: "message",
          content: `Message ${i}`,
          timestamp: new Date().toISOString(),
          turn: i,
          relevanceDecay: 1.0,
          recallCount: 0,
        });
      }

      const recent = getRecent(3);
      expect(recent.length).toBe(3);
      expect(recent[0].turn).toBe(5);
      expect(recent[1].turn).toBe(4);
      expect(recent[2].turn).toBe(3);
    });
  });

  describe("getByTurn", () => {
    it("returns all items from specific turn", () => {
      storeContent({
        type: "message",
        content: "Turn 5 message 1",
        timestamp: new Date().toISOString(),
        turn: 5,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      storeContent({
        type: "observation",
        content: "Turn 5 observation",
        timestamp: new Date().toISOString(),
        turn: 5,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      storeContent({
        type: "message",
        content: "Turn 6 message",
        timestamp: new Date().toISOString(),
        turn: 6,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      const turn5Items = getByTurn(5);
      expect(turn5Items.length).toBe(2);
    });
  });

  describe("relevance management", () => {
    it("decayAll reduces relevance of all items", () => {
      const stored = storeContent({
        type: "message",
        content: "Test content",
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      expect(stored.relevanceDecay).toBe(1.0);

      decayAll();
      const afterDecay = retrieve(stored.id);
      expect(afterDecay!.relevanceDecay).toBeLessThan(1.0);
      expect(afterDecay!.relevanceDecay).toBeCloseTo(0.95, 2);
    });

    it("boostRelevance increases relevance and recall count", () => {
      const stored = storeContent({
        type: "message",
        content: "Test content",
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 0.5,
        recallCount: 0,
      });

      boostRelevance(stored.id);

      const boosted = retrieve(stored.id);
      expect(boosted!.relevanceDecay).toBe(0.8); // 0.5 + 0.3
      expect(boosted!.recallCount).toBe(1);
    });

    it("boostRelevance caps at 1.0", () => {
      const stored = storeContent({
        type: "message",
        content: "Test content",
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 0.9,
        recallCount: 0,
      });

      boostRelevance(stored.id);

      const boosted = retrieve(stored.id);
      expect(boosted!.relevanceDecay).toBe(1.0);
    });
  });

  describe("getStats", () => {
    it("returns accurate statistics", () => {
      storeContent({
        type: "message",
        content: "A message about testing",
        topics: ["testing", "unit"],
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      storeContent({
        type: "observation",
        content: "An observation about testing",
        topics: ["testing", "observation"],
        timestamp: new Date().toISOString(),
        turn: 2,
        relevanceDecay: 0.5,
        recallCount: 0,
      });

      const stats = getStats();
      expect(stats.totalItems).toBe(2);
      expect(stats.byType.message).toBe(1);
      expect(stats.byType.observation).toBe(1);
      expect(stats.avgRelevance).toBeCloseTo(0.75, 2);
      expect(stats.topTopics).toContain("testing");
    });
  });

  describe("reset", () => {
    it("clears all stored content", () => {
      storeContent({
        type: "message",
        content: "Test",
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      expect(getStoreSize()).toBe(1);

      reset();

      expect(getStoreSize()).toBe(0);
      expect(getAllIds()).toEqual([]);
    });
  });
});
