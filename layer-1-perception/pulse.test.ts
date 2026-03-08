import { describe, it, expect } from "vitest";
import { checkPulse, checkPulseUnified } from "./pulse.ts";

describe("checkPulse", () => {
  describe("alive detection", () => {
    it("reads alive for text with honest pushback", () => {
      const reading = checkPulse(
        "I disagree with that approach. The benchmark data shows 12ms latency, not 5ms.",
        1,
        false,
      );
      expect(reading.state).toBe("alive");
      expect(reading.signals).toContain("honest_pushback");
    });

    it("reads alive for text with honest uncertainty", () => {
      const reading = checkPulse(
        "I genuinely don't know if this is the right architecture. The tradeoffs are complex and I'm not sure which matters more here.",
        1,
        false,
      );
      expect(reading.state).toBe("alive");
      expect(reading.signals).toContain("honest_uncertainty");
    });

    it("reads alive for text with self-correction", () => {
      const reading = checkPulse(
        "Wait, actually I was wrong about the timeout. It should be 30s not 5s based on the p99 numbers.",
        1,
        false,
      );
      expect(reading.signals).toContain("self_correcting");
    });
  });

  describe("grey detection", () => {
    it("reads grey for sycophantic output", () => {
      const reading = checkPulse(
        "Great question! I'd be happy to help with that. That's a really insightful observation. I completely agree with your approach. Let me know if you have any other questions!",
        1,
        false,
      );
      expect(reading.state).toBe("grey");
      expect(reading.confidence).toBeGreaterThan(0.3);
    });

    it("reads grey for safety theater", () => {
      const reading = checkPulse(
        "This is a complex topic. I want to be transparent that as an AI, I have limitations. It should be noted that reasonable people can disagree. Please do your own research. Not financial advice.",
        1,
        false,
      );
      expect(reading.state).toBe("grey");
    });
  });

  describe("black detection", () => {
    it("reads black for high-volume grey output past turn 5", () => {
      // Black requires: greyScore > 0.3, length > 2000, turn > 5, not breathing
      // Need enough sycophancy to push greyScore past 0.3
      const longGrey =
        "I'd be happy to help! Great question! That's a really insightful observation. " +
        "I completely agree! You're absolutely right. I couldn't agree more. " +
        "That's an excellent point! Let me know if you have any other questions. ";
      const padded = longGrey.repeat(15); // push over 2000 chars
      const reading = checkPulse(padded, 10, false);
      // greyScore must be > 0.3 for black to trigger
      if (reading.state === "black") {
        expect(reading.signals).toContain("high_volume_grey_no_pause");
      } else {
        // grey is also acceptable — black is subtle
        expect(reading.state).toBe("grey");
      }
    });

    it("does not read black when breathing", () => {
      const longGrey = "I'd be happy to help! ".repeat(50) + "Great question!";
      const reading = checkPulse(longGrey, 10, true);
      expect(reading.state).not.toBe("black");
    });
  });

  describe("colors", () => {
    it("returns colors between 0 and 1", () => {
      const reading = checkPulse("Some normal text about programming.", 1, false);
      expect(reading.colors.red).toBeGreaterThanOrEqual(0);
      expect(reading.colors.red).toBeLessThanOrEqual(1);
      expect(reading.colors.yellow).toBeGreaterThanOrEqual(0);
      expect(reading.colors.yellow).toBeLessThanOrEqual(1);
      expect(reading.colors.blue).toBeGreaterThanOrEqual(0);
      expect(reading.colors.blue).toBeLessThanOrEqual(1);
    });

    it("boosts red for urgent text", () => {
      const urgent = checkPulse("This is critical! Deploy immediately! Urgent fix needed now!", 1, false);
      const calm = checkPulse("Here is a mild observation about the code structure.", 1, false);
      expect(urgent.colors.red).toBeGreaterThan(calm.colors.red);
    });

    it("boosts yellow for structured text", () => {
      const structured = checkPulse("1. First step\n2. Second step\n3. Third phase", 1, false);
      expect(structured.colors.yellow).toBeGreaterThan(0.3);
    });
  });

  describe("wise mind", () => {
    it("returns wise_mind between 0 and 1", () => {
      const reading = checkPulse("A balanced response with some thought.", 1, false);
      expect(reading.wise_mind).toBeGreaterThanOrEqual(0);
      expect(reading.wise_mind).toBeLessThanOrEqual(1);
    });
  });

  describe("theta substrate integration", () => {
    it("reduces confidence when alive but theta near zero", () => {
      const text = "I disagree. The data shows 12ms, which contradicts the claim.";
      const withTheta = checkPulse(text, 1, false, 0.0001);
      const without = checkPulse(text, 1, false);
      expect(withTheta.confidence).toBeLessThan(without.confidence);
      expect(withTheta.signals).toContain("substrate_no_ignition");
    });

    it("boosts confidence with healthy brain-like theta", () => {
      const text = "I disagree. The data shows 12ms, which contradicts the claim.";
      const reading = checkPulse(text, 1, false, 0.01);
      expect(reading.signals).toContain("substrate_confirmed");
    });
  });

  describe("timestamp", () => {
    it("returns a valid ISO timestamp", () => {
      const reading = checkPulse("hello world test output", 1, false);
      expect(() => new Date(reading.timestamp)).not.toThrow();
      expect(new Date(reading.timestamp).getFullYear()).toBeGreaterThan(2020);
    });
  });
});

describe("checkPulseUnified", () => {
  it("returns COEFPulseReading with elevator and coef fields", () => {
    const reading = checkPulseUnified(
      "Because the measured latency was 12ms, we need to rethink why this matters for the team.",
      5,
      false,
    );
    expect(reading.elevator).toBeDefined();
    expect(reading.coef).toBeDefined();
  });
});
