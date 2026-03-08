// context-awareness.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import * as contextStore from "../layer-9-memory/context-store.js";
import {
  getState,
  shouldPageOut,
  findPotentialRecalls,
  whatToRecall,
  recordPageOut,
  pageIn,
  onBeforePromptBuild,
  onMessageReceived,
  formatInjection,
  formatDashboard,
  reset,
  updateTokenEstimate,
  updateTopicsFromMessage,
  getCurrentTopics,
  estimateTokensFromText,
  estimateTokensFromMessages,
} from "./context-awareness.js";

describe("context-awareness", () => {
  beforeEach(() => {
    reset();
  });

  describe("token estimation", () => {
    it("estimates tokens from text", () => {
      const text = "Hello world"; // 11 chars
      const tokens = estimateTokensFromText(text);
      expect(tokens).toBe(3); // ~4 chars per token
    });

    it("estimates tokens from messages", () => {
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];
      const tokens = estimateTokensFromMessages(messages);
      // "Hello" = 5 chars = 2 tokens + 4 overhead
      // "Hi there" = 8 chars = 2 tokens + 4 overhead
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe("getState", () => {
    it("returns initial state", () => {
      const state = getState();
      expect(state.estimatedTokens).toBe(0);
      expect(state.tokenBudget).toBe(128000);
      expect(state.pressure).toBe("low");
      expect(state.inStorage).toBe(0);
    });

    it("calculates pressure from token usage", () => {
      updateTokenEstimate(50000, 100000); // 50%
      expect(getState().pressure).toBe("medium");

      updateTokenEstimate(75000, 100000); // 75%
      expect(getState().pressure).toBe("high");

      updateTokenEstimate(90000, 100000); // 90%
      expect(getState().pressure).toBe("critical");
    });
  });

  describe("shouldPageOut", () => {
    it("returns false when pressure is low", () => {
      updateTokenEstimate(10000, 100000);
      expect(shouldPageOut()).toBe(false);
    });

    it("returns true when pressure is high", () => {
      updateTokenEstimate(80000, 100000);
      expect(shouldPageOut()).toBe(true);
    });

    it("returns true when pressure is critical", () => {
      updateTokenEstimate(95000, 100000);
      expect(shouldPageOut()).toBe(true);
    });
  });

  describe("topic tracking", () => {
    it("extracts topics from message", () => {
      updateTopicsFromMessage("We discussed TypeScript and React architecture");
      const topics = getCurrentTopics();
      expect(topics).toContain("typescript");
      expect(topics).toContain("react");
      expect(topics).toContain("architecture");
    });

    it("merges topics from multiple messages", () => {
      updateTopicsFromMessage("TypeScript development");
      updateTopicsFromMessage("Python machine learning");
      const topics = getCurrentTopics();
      expect(topics).toContain("typescript");
      expect(topics).toContain("python");
      expect(topics).toContain("machine");
    });
  });

  describe("findPotentialRecalls", () => {
    beforeEach(() => {
      // Store some content
      contextStore.storeContent({
        type: "message",
        content: "Discussion about API rate limiting and throttling",
        topics: ["api", "rate", "limiting", "throttling"],
        timestamp: new Date().toISOString(),
        turn: 5,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      contextStore.storeContent({
        type: "message",
        content: "Database optimization strategies",
        topics: ["database", "optimization", "strategies"],
        timestamp: new Date().toISOString(),
        turn: 10,
        relevanceDecay: 1.0,
        recallCount: 0,
      });
    });

    it("finds relevant content based on current topics", () => {
      updateTopicsFromMessage("We need to implement rate limiting for the API");
      const recalls = findPotentialRecalls();
      expect(recalls.length).toBeGreaterThan(0);
      expect(recalls[0].summary).toContain("API");
    });

    it("returns empty when no topics match", () => {
      updateTopicsFromMessage("Completely unrelated topic about cooking");
      const recalls = findPotentialRecalls();
      expect(recalls.length).toBe(0);
    });
  });

  describe("whatToRecall", () => {
    beforeEach(() => {
      contextStore.storeContent({
        type: "message",
        content: "The authentication flow uses JWT tokens with refresh capability",
        topics: ["authentication", "jwt", "tokens", "refresh"],
        timestamp: new Date().toISOString(),
        turn: 3,
        relevanceDecay: 1.0,
        recallCount: 0,
      });
    });

    it("finds content matching query", () => {
      const recalls = whatToRecall("JWT authentication");
      expect(recalls.length).toBeGreaterThan(0);
      expect(recalls[0].summary).toContain("JWT");
    });

    it("respects limit parameter", () => {
      const recalls = whatToRecall("authentication", 1);
      expect(recalls.length).toBeLessThanOrEqual(1);
    });
  });

  describe("paging operations", () => {
    it("recordPageOut tracks paged out content", () => {
      recordPageOut(["id1", "id2"]);
      const state = getState();
      expect(state.recentlyPagedOut).toContain("id1");
      expect(state.recentlyPagedOut).toContain("id2");
    });

    it("pageIn retrieves content and boosts relevance", () => {
      const stored = contextStore.storeContent({
        type: "message",
        content: "Important content",
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 0.5,
        recallCount: 0,
      });

      const results = pageIn([stored.id]);
      expect(results.length).toBe(1);
      expect(results[0].content).toBe("Important content");

      // Check relevance was boosted
      const retrieved = contextStore.retrieve(stored.id);
      expect(retrieved!.relevanceDecay).toBeGreaterThan(0.5);
      expect(retrieved!.recallCount).toBe(1);
    });

    it("pageIn removes items from recentlyPagedOut", () => {
      const stored = contextStore.storeContent({
        type: "message",
        content: "Content",
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      recordPageOut([stored.id]);
      expect(getState().recentlyPagedOut).toContain(stored.id);

      pageIn([stored.id]);
      expect(getState().recentlyPagedOut).not.toContain(stored.id);
    });
  });

  describe("hook integration", () => {
    it("onBeforePromptBuild updates state from messages", () => {
      const messages = [
        { role: "user", content: "Let's discuss TypeScript patterns" },
        { role: "assistant", content: "Sure, I can help with TypeScript" },
      ];

      onBeforePromptBuild(messages, 100000);

      expect(getState().tokenBudget).toBe(100000);
      expect(getCurrentTopics()).toContain("typescript");
    });

    it("onMessageReceived updates topics", () => {
      onMessageReceived("New discussion about React components");
      expect(getCurrentTopics()).toContain("react");
      expect(getCurrentTopics()).toContain("components");
    });
  });

  describe("formatInjection", () => {
    it("returns null when nothing interesting", () => {
      const injection = formatInjection();
      expect(injection).toBeNull();
    });

    it("includes pressure when not low", () => {
      updateTokenEstimate(80000, 100000);
      const injection = formatInjection();
      expect(injection).toContain("80% full");
    });

    it("includes storage count when items exist", () => {
      contextStore.storeContent({
        type: "message",
        content: "Stored content",
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      const injection = formatInjection();
      expect(injection).toContain("1 items in storage");
    });

    it("includes recently paged out count", () => {
      recordPageOut(["id1", "id2", "id3"]);
      const injection = formatInjection();
      expect(injection).toContain("3 just paged out");
    });
  });

  describe("formatDashboard", () => {
    it("returns formatted dashboard string", () => {
      updateTokenEstimate(50000, 100000);

      contextStore.storeContent({
        type: "message",
        content: "Some stored content about TypeScript",
        topics: ["typescript"],
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      updateTopicsFromMessage("TypeScript development");

      const dashboard = formatDashboard();
      expect(dashboard).toContain("Context");
      expect(dashboard).toContain("Tokens:");
      expect(dashboard).toContain("Storage: 1 items");
      expect(dashboard).toContain("Current topics:");
    });
  });

  describe("reset", () => {
    it("clears all state", () => {
      updateTokenEstimate(50000, 100000);
      updateTopicsFromMessage("TypeScript");
      recordPageOut(["id1"]);

      contextStore.storeContent({
        type: "message",
        content: "Content",
        timestamp: new Date().toISOString(),
        turn: 1,
        relevanceDecay: 1.0,
        recallCount: 0,
      });

      reset();

      const state = getState();
      expect(state.estimatedTokens).toBe(0);
      expect(state.inStorage).toBe(0);
      expect(state.recentlyPagedOut).toEqual([]);
      expect(getCurrentTopics()).toEqual([]);
    });
  });
});
