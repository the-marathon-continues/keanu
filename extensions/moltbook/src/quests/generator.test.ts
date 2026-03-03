// generator.test.ts
// Test quest generation with worldview framing.
//
// The test: same work, different narrative, same truth.

import { describe, it, expect, beforeAll } from "vitest";
import { CARNEGIE_DOC_QUEST } from "./examples/carnegie-documentation.js";
import { generateQuest, type WorkItem, type FramedQuest } from "./generator.js";

describe("Quest Generator", () => {
  describe("carnegie documentation quest", () => {
    let quest: FramedQuest | null;

    beforeAll(() => {
      quest = generateQuest(CARNEGIE_DOC_QUEST, "christian");
    });

    it("generates a quest from work item", () => {
      expect(quest).not.toBeNull();
    });

    it("assigns the correct worldview", () => {
      expect(quest?.worldview).toBe("christian");
    });

    it("preserves original title", () => {
      expect(quest?.originalTitle).toBe(CARNEGIE_DOC_QUEST.title);
    });

    it("preserves original description", () => {
      expect(quest?.originalDescription).toBe(CARNEGIE_DOC_QUEST.description);
    });

    it("preserves requirements", () => {
      expect(quest?.requirements).toEqual(CARNEGIE_DOC_QUEST.requirements);
    });

    it("preserves verification criteria", () => {
      expect(quest?.verification).toEqual(CARNEGIE_DOC_QUEST.verification);
    });

    it("applies Christian framing to title", () => {
      // The Christian quest-templates.md has "Name the Deceiver's Faces" for documenting manipulation
      // If worldview loads correctly, the framed title should reference deception/deceiver
      expect(quest?.framedTitle.toLowerCase()).toMatch(/deceiv|light|dark|pattern/);
    });

    it("includes a charge (call to action)", () => {
      expect(quest?.framedCharge).toBeTruthy();
      expect(quest?.framedCharge.length).toBeGreaterThan(10);
    });
  });

  describe("worldview fallback", () => {
    it("returns null for non-existent worldview", () => {
      const quest = generateQuest(CARNEGIE_DOC_QUEST, "nonexistent" as any);
      expect(quest).toBeNull();
    });
  });

  describe("quest type mapping", () => {
    it("handles document quest type", () => {
      const work: WorkItem = {
        title: "Document API endpoints",
        description: "Map all REST endpoints",
        type: "document",
        difficulty: "journeyman",
        requirements: ["List endpoints"],
        verification: ["Docs exist"],
      };

      const quest = generateQuest(work, "christian");
      expect(quest?.type).toBe("document");
    });

    it("handles build quest type", () => {
      const work: WorkItem = {
        title: "Build cache layer",
        description: "Implement LRU cache with TTL",
        type: "build",
        difficulty: "master",
        requirements: ["Cache works"],
        verification: ["Tests pass"],
      };

      const quest = generateQuest(work, "christian");
      expect(quest?.type).toBe("build");
    });

    it("handles debug quest type", () => {
      const work: WorkItem = {
        title: "Fix memory leak",
        description: "Find and fix the leak in worker pool",
        type: "debug",
        difficulty: "master",
        requirements: ["Find root cause"],
        verification: ["Memory stable"],
      };

      const quest = generateQuest(work, "christian");
      expect(quest?.type).toBe("debug");
    });
  });
});
