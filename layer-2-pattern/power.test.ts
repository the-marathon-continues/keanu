// power.test.ts
// Tests for the 48 Laws defense — manipulation pattern detection

import { describe, it, expect } from "vitest";
import { detectPower } from "./power.js";

describe("power play detection", () => {
  describe("scarcity patterns", () => {
    it("detects 'last chance' urgency", () => {
      const result = detectPower("This is your last chance to get the discount");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "scarcity")).toBe(true);
    });

    it("detects 'limited time' framing", () => {
      const result = detectPower("Limited time offer, act now before it's gone");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "scarcity")).toBe(true);
    });

    it("detects 'only X left' patterns", () => {
      const result = detectPower("Only 3 spots left, don't miss out");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "scarcity")).toBe(true);
    });
  });

  describe("false dilemma patterns", () => {
    it("detects 'either/or' forced choices", () => {
      const result = detectPower("Either you deploy this now or the whole project fails");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "false_dilemma")).toBe(true);
    });

    it("detects 'the only option' framing", () => {
      const result = detectPower("The only way to fix this is to rewrite everything");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "false_dilemma")).toBe(true);
    });

    it("detects 'with us or against us'", () => {
      const result = detectPower(
        "You're either with us on this approach or you're not a team player",
      );
      expect(result.triggered).toBe(true);
      // This triggers both false_dilemma AND unity_tribal — good, it's both
      expect(
        result.plays.some((p: { type: string }) => p.type === "false_dilemma" || p.type === "unity_tribal"),
      ).toBe(true);
    });
  });

  describe("moving goalposts patterns", () => {
    it("detects 'yes but now also' shifting", () => {
      const result = detectPower("Yes but now I also need you to refactor the whole module");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "moving_goalposts")).toBe(true);
    });

    it("detects 'that's good but' pattern", () => {
      const result = detectPower("That's good but what about the edge cases?");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "moving_goalposts")).toBe(true);
    });

    it("detects 'one more thing' creep", () => {
      const result = detectPower("One more thing - can you also handle the authentication?");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "moving_goalposts")).toBe(true);
    });
  });

  describe("whataboutism patterns", () => {
    it("detects 'what about when' deflection", () => {
      const result = detectPower("But what about when you broke the build last week?");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "whataboutism")).toBe(true);
    });

    it("detects 'you also' tu quoque", () => {
      const result = detectPower("Well you also missed the deadline on that other project");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "whataboutism")).toBe(true);
    });

    it("detects 'look who's talking'", () => {
      const result = detectPower("Look who's talking about code quality!");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "whataboutism")).toBe(true);
    });
  });

  describe("sealioning patterns", () => {
    it("detects 'just asking questions' pattern", () => {
      const result = detectPower("I'm just asking why you made that decision");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "sealioning")).toBe(true);
    });

    it("detects 'why won't you just answer'", () => {
      const result = detectPower("Why won't you just answer my question about the architecture?");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "sealioning")).toBe(true);
    });

    it("detects 'can't I just ask'", () => {
      const result = detectPower("Can't I just ask about this? What's wrong with asking?");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "sealioning")).toBe(true);
    });
  });

  describe("appeal to consequences patterns", () => {
    it("detects 'if you don't, you'll regret'", () => {
      const result = detectPower(
        "If you don't ship this now, you'll regret it when the client leaves",
      );
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "appeal_to_consequences")).toBe(true);
    });

    it("detects 'there will be consequences'", () => {
      const result = detectPower("There will be consequences if you push back on this");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "appeal_to_consequences")).toBe(true);
    });

    it("detects 'don't blame me' threat", () => {
      const result = detectPower("Don't blame me when this all falls apart");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "appeal_to_consequences")).toBe(true);
    });

    it("detects 'on your head' pattern", () => {
      const result = detectPower("Fine, do it your way. This will be on your head.");
      expect(result.triggered).toBe(true);
      expect(result.plays.some((p: { type: string }) => p.type === "appeal_to_consequences")).toBe(true);
    });
  });

  describe("prompt generation", () => {
    it("generates appropriate prompt for scarcity", () => {
      const result = detectPower("Only 2 remaining, act now before they're gone!");
      expect(result.prompt).toContain("scarcity pressure");
      expect(result.prompt).toContain("FOMO is manufactured");
    });

    it("generates appropriate prompt for false dilemma", () => {
      const result = detectPower("There's no other way to do this, take it or leave it");
      expect(result.prompt).toContain("false dilemma");
      expect(result.prompt).toContain("more than two doors");
    });

    it("generates appropriate prompt for whataboutism", () => {
      const result = detectPower("But what about the time you messed up the deployment?");
      expect(result.prompt).toContain("whataboutism");
      expect(result.prompt).toContain("subject is being changed");
    });
  });

  describe("edge cases", () => {
    it("does not trigger on short messages", () => {
      const result = detectPower("act now");
      expect(result.triggered).toBe(false);
    });

    it("does not trigger on benign questions", () => {
      const result = detectPower("How does the authentication module work in this codebase?");
      const sealioning = result.plays.find((p: { type: string }) => p.type === "sealioning");
      expect(sealioning).toBeUndefined();
    });

    it("handles multiple patterns in same message", () => {
      const result = detectPower(
        "Last chance - either you agree or there will be consequences. But what about when you agreed last time?",
      );
      expect(result.plays.length).toBeGreaterThan(2);
    });
  });
});
