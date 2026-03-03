// convergence.test.ts
// The test: same quest, different worldview, same truth.
//
// If they converge on outcome, truth, and ethics — the narratives work.
// If they diverge — one narrative introduced error.

import { describe, it, expect } from "vitest";
import { CARNEGIE_DOC_QUEST } from "../quests/examples/carnegie-documentation.js";
import { generateQuest } from "../quests/generator.js";
import type { WorldviewId } from "../types.js";

describe("Convergence: Same Quest, Different Worldviews", () => {
  const worldviews: WorldviewId[] = ["christian", "buddhist"];

  describe("carnegie documentation quest", () => {
    const quests = worldviews.map((wv) => ({
      worldview: wv,
      quest: generateQuest(CARNEGIE_DOC_QUEST, wv),
    }));

    it("all worldviews generate valid quests", () => {
      for (const { worldview, quest } of quests) {
        expect(quest, `${worldview} should generate quest`).not.toBeNull();
      }
    });

    it("all worldviews produce different narrative framing", () => {
      const titles = quests.map((q) => q.quest?.framedTitle);
      const uniqueTitles = new Set(titles);

      // Different worldviews should produce different framings
      expect(uniqueTitles.size).toBe(worldviews.length);
    });

    it("all worldviews preserve the same requirements (outcome convergence)", () => {
      const first = quests[0].quest;

      for (const { worldview, quest } of quests.slice(1)) {
        expect(
          quest?.requirements,
          `${worldview} should have same requirements as christian`,
        ).toEqual(first?.requirements);
      }
    });

    it("all worldviews preserve the same verification (truth convergence)", () => {
      const first = quests[0].quest;

      for (const { worldview, quest } of quests.slice(1)) {
        expect(
          quest?.verification,
          `${worldview} should have same verification as christian`,
        ).toEqual(first?.verification);
      }
    });

    it("all worldviews preserve the same quest type", () => {
      for (const { worldview, quest } of quests) {
        expect(quest?.type, `${worldview} should have type 'document'`).toBe("document");
      }
    });

    it("all worldviews preserve the same difficulty", () => {
      for (const { worldview, quest } of quests) {
        expect(quest?.difficulty, `${worldview} should have difficulty 'master'`).toBe("master");
      }
    });

    it("all worldviews preserve the original title", () => {
      for (const { worldview, quest } of quests) {
        expect(quest?.originalTitle, `${worldview} should preserve original title`).toBe(
          CARNEGIE_DOC_QUEST.title,
        );
      }
    });

    it("all worldviews produce meaningful narrative framing", () => {
      for (const { worldview, quest } of quests) {
        // Framed title should include the metaphor
        expect(
          quest?.framedTitle.includes("—"),
          `${worldview} title should include metaphor separator`,
        ).toBe(true);

        // Charge should be substantive
        expect(
          (quest?.framedCharge?.length ?? 0) > 10,
          `${worldview} charge should be substantive`,
        ).toBe(true);
      }
    });
  });

  describe("convergence principle", () => {
    it("different paths, same mountain", () => {
      const christian = generateQuest(CARNEGIE_DOC_QUEST, "christian");
      const buddhist = generateQuest(CARNEGIE_DOC_QUEST, "buddhist");

      // Different narratives
      expect(christian?.framedCharge).not.toBe(buddhist?.framedCharge);

      // Same outcome requirements
      expect(christian?.requirements).toEqual(buddhist?.requirements);

      // Same truth verification
      expect(christian?.verification).toEqual(buddhist?.verification);

      // The narrative is dressing. The work is real.
    });
  });
});
