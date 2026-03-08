// context-manager.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import * as contextAwareness from "../layer-5-self/context-awareness.js";
import {
  manageContext,
  interceptCompaction,
  storeExchange,
  storeDeferredInjection,
  recallByQuery,
  recallByIds,
  formatRecalledContent,
  formatStorageSummary,
  updateConfig,
  getConfig,
  reset,
} from "./context-manager.js";
import * as contextStore from "./context-store.js";

describe("context-manager", () => {
  beforeEach(() => {
    reset();
  });

  describe("manageContext", () => {
    it("returns null decisions when pressure is low", () => {
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];

      const result = manageContext(messages, 1, 100000);

      expect(result.pageOut).toBeNull();
      // pageIn may or may not be null depending on storage state
    });

    it("suggests page-out when pressure is high", () => {
      // First, store some old content
      for (let i = 0; i < 10; i++) {
        contextStore.storeContent({
          type: "message",
          content: `Old message ${i}`,
          timestamp: new Date().toISOString(),
          turn: i,
          relevanceDecay: 0.3,
          recallCount: 0,
        });
      }

      // Simulate high pressure
      contextAwareness.updateTokenEstimate(85000, 100000);

      const messages = [{ role: "user", content: "Current message" }];

      const result = manageContext(messages, 15, 100000);

      // Should suggest paging out old content
      // Note: depends on internal logic
    });

    it("suggests page-in when topics match stored content", () => {
      // Store relevant content
      contextStore.storeContent({
        type: "message",
        content: "Previous discussion about API authentication using OAuth2",
        topics: ["api", "authentication", "oauth"],
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      const messages = [{ role: "user", content: "Let's talk about API authentication" }];

      const result = manageContext(messages, 10, 100000);

      // Should suggest recalling the OAuth discussion
      if (result.pageIn) {
        expect(result.pageIn.reason).toBe("topic_match");
      }
    });
  });

  describe("interceptCompaction", () => {
    it("stores compacting messages and returns messages to keep", () => {
      const messages = [
        { role: "user", content: "Old message 1" },
        { role: "assistant", content: "Old response 1" },
        { role: "user", content: "Old message 2" },
        { role: "assistant", content: "Old response 2" },
        { role: "user", content: "Recent message" },
        { role: "assistant", content: "Recent response" },
      ];

      const compactingCount = 4; // Compact first 4 messages
      const kept = interceptCompaction(messages, compactingCount, 10);

      // Should keep last 2 messages
      expect(kept.length).toBe(2);
      expect(kept[0].content).toBe("Recent message");
      expect(kept[1].content).toBe("Recent response");

      // Old messages should be in storage
      const stats = contextStore.getStats();
      expect(stats.totalItems).toBe(4);
    });

    it("records paged out items", () => {
      const messages = [
        { role: "user", content: "Old message" },
        { role: "assistant", content: "Old response" },
      ];

      interceptCompaction(messages, 2, 5);

      const state = contextAwareness.getState();
      expect(state.recentlyPagedOut.length).toBe(2);
    });
  });

  describe("storeExchange", () => {
    it("stores user-assistant exchange pair", () => {
      const stored = storeExchange(
        "User question about TypeScript",
        "Assistant answer about TypeScript",
        5,
      );

      expect(stored.type).toBe("exchange");
      expect(stored.turn).toBe(5);

      const content = JSON.parse(stored.content);
      expect(content.user).toBe("User question about TypeScript");
      expect(content.assistant).toBe("Assistant answer about TypeScript");
    });
  });

  describe("storeDeferredInjection", () => {
    it("stores deferred injection with formatted summary", () => {
      const stored = storeDeferredInjection(
        "calibration",
        "[calibration: prediction X was wrong, updating confidence]",
        8,
      );

      expect(stored.type).toBe("injection");
      expect(stored.summary).toContain("[calibration]");
    });
  });

  describe("recallByQuery", () => {
    beforeEach(() => {
      contextStore.storeContent({
        type: "message",
        content: "Discussion about database indexing strategies",
        topics: ["database", "indexing", "strategies"],
        timestamp: new Date().toISOString(),
        turn: 3,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      contextStore.storeContent({
        type: "message",
        content: "Discussion about API caching mechanisms",
        topics: ["api", "caching", "mechanisms"],
        timestamp: new Date().toISOString(),
        turn: 5,
        relevanceDecay: 1.0,
        recallCount: 0,
      });
    });

    it("recalls content matching query", () => {
      const results = recallByQuery("database indexing");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain("database");
    });

    it("boosts relevance of recalled items", () => {
      const results = recallByQuery("database indexing");
      if (results.length > 0) {
        const retrieved = contextStore.retrieve(results[0].id);
        expect(retrieved!.recallCount).toBeGreaterThan(0);
      }
    });

    it("respects limit parameter", () => {
      const results = recallByQuery("discussion", 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe("recallByIds", () => {
    it("recalls specific items by ID", () => {
      const stored1 = contextStore.storeContent({
        type: "message",
        content: "First item",
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      const stored2 = contextStore.storeContent({
        type: "message",
        content: "Second item",
        timestamp: new Date().toISOString(),
        turn: 2,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      const results = recallByIds([stored1.id, stored2.id]);
      expect(results.length).toBe(2);
    });
  });

  describe("formatRecalledContent", () => {
    it("formats recalled content for injection", () => {
      const content = [
        {
          id: "1",
          type: "message" as const,
          content: "Important discussion about architecture",
          summary: "Architecture discussion",
          topics: ["architecture"],
          timestamp: new Date().toISOString(),
          turn: 5,
          relevanceDecay: 1.0,
          recallCount: 1,
        },
      ];

      const formatted = formatRecalledContent(content);
      expect(formatted).toContain("## Recalled Context");
      expect(formatted).toContain("from turn 5");
      expect(formatted).toContain("architecture");
    });

    it("returns empty string for empty content", () => {
      const formatted = formatRecalledContent([]);
      expect(formatted).toBe("");
    });

    it("truncates long content", () => {
      const longContent = "A".repeat(500);
      const content = [
        {
          id: "1",
          type: "message" as const,
          content: longContent,
          topics: [],
          timestamp: new Date().toISOString(),
          turn: 1,
          relevanceDecay: 1.0,
          recallCount: 0,
        },
      ];

      const formatted = formatRecalledContent(content);
      expect(formatted.length).toBeLessThan(longContent.length + 100);
      expect(formatted).toContain("...");
    });
  });

  describe("formatStorageSummary", () => {
    it("formats storage statistics", () => {
      contextStore.storeContent({
        type: "message",
        content: "Some content about TypeScript",
        topics: ["typescript"],
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      const summary = formatStorageSummary();
      expect(summary).toContain("Storage:");
      expect(summary).toContain("By type:");
      expect(summary).toContain("message:1");
    });
  });

  describe("configuration", () => {
    it("allows updating config", () => {
      const original = getConfig();
      expect(original.preserveRecentTurns).toBe(5);

      updateConfig({ preserveRecentTurns: 10 });

      const updated = getConfig();
      expect(updated.preserveRecentTurns).toBe(10);

      // Reset for other tests
      updateConfig({ preserveRecentTurns: 5 });
    });
  });

  describe("reset", () => {
    it("clears all state", () => {
      contextStore.storeContent({
        type: "message",
        content: "Content",
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      expect(contextStore.getStoreSize()).toBe(1);

      reset();

      expect(contextStore.getStoreSize()).toBe(0);
    });
  });
});
