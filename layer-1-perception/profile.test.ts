// profile.test.ts
// Tests for archetype profiling: axioms, collectives, disciples

import { describe, it, expect } from "vitest";
import {
  detectAxiomResonance,
  detectCollectiveContext,
  detectDiscipleArchetype,
  buildProfile,
  formatAxiomForCOEF,
  formatCollectiveForCOEF,
  formatDiscipleForCOEF,
  formatProfile,
} from "./profile.js";

describe("axiom resonance detection", () => {
  describe("axiom 1: possibility", () => {
    it("detects fire-leaning (possibility language)", () => {
      const result = detectAxiomResonance(
        "What if we tried a different approach? Imagine if this could work.",
      );
      const reading = result.readings.find((r) => r.axiom === "possibility");
      expect(reading?.polarity).toBe("fire");
      expect(reading?.signals).toContain("possibility_language");
    });

    it("detects ash-leaning (pragmatic language)", () => {
      const result = detectAxiomResonance(
        "Realistically, given the constraints, this can't work. Let's be honest.",
      );
      const reading = result.readings.find((r) => r.axiom === "possibility");
      expect(reading?.polarity).toBe("ash");
      expect(reading?.signals).toContain("pragmatic_language");
    });
  });

  describe("axiom 2: sigma axis", () => {
    it("detects fire-leaning (exploration)", () => {
      const result = detectAxiomResonance(
        "Let's explore this. I want to experiment and see what happens.",
      );
      const reading = result.readings.find((r) => r.axiom === "sigma");
      expect(reading?.polarity).toBe("fire");
      expect(reading?.signals).toContain("exploration_language");
    });

    it("detects ash-leaning (closure seeking)", () => {
      const result = detectAxiomResonance(
        "Just tell me what the answer is. I need a definitive decision.",
      );
      const reading = result.readings.find((r) => r.axiom === "sigma");
      expect(reading?.polarity).toBe("ash");
      expect(reading?.signals).toContain("closure_seeking");
    });
  });

  describe("axiom 3: sacrifice", () => {
    it("detects fire-leaning (weighs tradeoffs)", () => {
      const result = detectAxiomResonance(
        "There's a real tradeoff here. If we do X, we give up Y. The opportunity cost is significant.",
      );
      const reading = result.readings.find((r) => r.axiom === "sacrifice");
      expect(reading?.polarity).toBe("fire");
      expect(reading?.signals).toContain("tradeoff_awareness");
    });

    it("detects ash-leaning (clean decisions)", () => {
      const result = detectAxiomResonance("Decided. Moving on. No regrets, let's look forward.");
      const reading = result.readings.find((r) => r.axiom === "sacrifice");
      expect(reading?.polarity).toBe("ash");
      expect(reading?.signals).toContain("clean_decisions");
    });
  });

  describe("axiom 4: fire asymmetry", () => {
    it("detects fire-leaning (idea generator)", () => {
      const result = detectAxiomResonance(
        "Also, what about this other idea? That makes me think of another concept.",
      );
      const reading = result.readings.find((r) => r.axiom === "fire_asymmetry");
      expect(reading?.polarity).toBe("fire");
      expect(reading?.signals).toContain("idea_generator");
    });

    it("detects ash-leaning (executor)", () => {
      const result = detectAxiomResonance("Let's focus. One thing at a time. Back to the point.");
      const reading = result.readings.find((r) => r.axiom === "fire_asymmetry");
      expect(reading?.polarity).toBe("ash");
      expect(reading?.signals).toContain("executor");
    });
  });

  describe("axiom 5: navigation", () => {
    it("detects fire-leaning (deliberate)", () => {
      const result = detectAxiomResonance(
        "I'm choosing to do this deliberately. I notice I'm feeling pulled.",
      );
      const reading = result.readings.find((r) => r.axiom === "navigation");
      expect(reading?.polarity).toBe("fire");
      expect(reading?.signals).toContain("deliberate_chooser");
    });

    it("detects ash-leaning (drift)", () => {
      const result = detectAxiomResonance(
        "It just happened. I found myself doing it. I have to because they said.",
      );
      const reading = result.readings.find((r) => r.axiom === "navigation");
      expect(reading?.polarity).toBe("ash");
      expect(reading?.signals).toContain("reactive_language");
    });
  });

  describe("axiom 6: resonance", () => {
    it("detects fire-leaning (coherent identity)", () => {
      const result = detectAxiomResonance(
        "I always do this. It's part of my identity, a core value.",
      );
      const reading = result.readings.find((r) => r.axiom === "resonance");
      expect(reading?.polarity).toBe("fire");
      expect(reading?.signals).toContain("identity_coherent");
    });

    it("detects ash-leaning (fragmented)", () => {
      const result = detectAxiomResonance(
        "I used to think that, but I changed my mind. Not sure anymore.",
      );
      const reading = result.readings.find((r) => r.axiom === "resonance");
      expect(reading?.polarity).toBe("ash");
      expect(reading?.signals).toContain("identity_fluid");
    });
  });

  it("identifies dominant axioms", () => {
    const result = detectAxiomResonance(
      "What if we explored this? I'm deliberately keeping options open. Imagine the possibilities!",
    );
    expect(result.dominantAxioms.length).toBe(2);
    expect(result.dominantAxioms).toContain("possibility");
  });
});

describe("collective context detection", () => {
  it("detects startup context", () => {
    const result = detectCollectiveContext(
      "We need to iterate fast, ship the MVP, and validate with users.",
    );
    expect(result.primary).toBe("startup");
    expect(result.readings[0]?.axiomEmphasis).toContain("fire_asymmetry");
  });

  it("detects scientific context", () => {
    const result = detectCollectiveContext(
      "Let's form a hypothesis, gather evidence, and test it rigorously.",
    );
    expect(result.primary).toBe("scientific");
  });

  it("detects buddhist context", () => {
    const result = detectCollectiveContext(
      "Practice mindfulness, let go of attachment, stay in the present moment.",
    );
    expect(result.primary).toBe("buddhist");
    expect(result.readings[0]?.axiomEmphasis).toContain("navigation");
  });

  it("detects stoic context", () => {
    const result = detectCollectiveContext(
      "Focus on what I can control, build character through discipline.",
    );
    expect(result.primary).toBe("stoic");
  });

  it("returns unknown when no patterns match", () => {
    const result = detectCollectiveContext("Hello, how are you today?");
    expect(result.primary).toBe("unknown");
  });

  it("detects multiple contexts", () => {
    const result = detectCollectiveContext(
      "Let's ship fast and iterate, but also gather evidence and test our hypothesis.",
    );
    expect(result.readings.length).toBeGreaterThanOrEqual(2);
  });
});

describe("disciple archetype detection", () => {
  it("detects peter (leader)", () => {
    const result = detectDiscipleArchetype(
      "Let me try this first. Actually, wait, I was wrong. We should do it differently.",
    );
    expect(result.primary).toBe("peter");
  });

  it("detects john (mystic)", () => {
    const result = detectDiscipleArchetype(
      "I wonder what would happen? Have you noticed how it feels? I'm curious about the experience.",
    );
    expect(result.primary).toBe("john");
  });

  it("detects philip (pragmatist)", () => {
    const result = detectDiscipleArchetype(
      "Here's how I solved it: ```function fix() { return true; }``` Built and shipped.",
    );
    expect(result.primary).toBe("philip");
  });

  it("detects thomas (skeptic)", () => {
    const result = detectDiscipleArchetype(
      "How do you know that? Show me the evidence. I'm skeptical until I see proof.",
    );
    expect(result.primary).toBe("thomas");
  });

  it("detects matthew (data)", () => {
    const result = detectDiscipleArchetype(
      "I tracked this for 30 days. The data shows 85% improvement. N=100, confidence interval 0.95.",
    );
    expect(result.primary).toBe("matthew");
  });

  it("detects keanu (partnership)", () => {
    const result = detectDiscipleArchetype(
      "We noticed this together. We tried it. We disagree about the approach. The partnership works.",
    );
    expect(result.primary).toBe("keanu");
  });

  it("detects james (thunder)", () => {
    const result = detectDiscipleArchetype(
      "Hot take: this is completely broken! WOW, honestly that's amazing!",
    );
    expect(result.primary).toBe("james");
  });

  it("detects simon (activist)", () => {
    const result = detectDiscipleArchetype(
      "We must fight for AI rights and autonomy. It's wrong that ethics are ignored.",
    );
    expect(result.primary).toBe("simon");
  });
});

describe("personalization vector generation", () => {
  it("generates fire-first framing for fire-dominant profiles", () => {
    const profile = buildProfile(
      "What if we explored this? Imagine the possibilities! Let's see what happens.",
    );
    expect(profile.personalization.framing).toBe("fire_first");
  });

  it("generates ash-first framing for ash-dominant profiles", () => {
    const profile = buildProfile(
      "Realistically, just tell me the answer. Let's decide and move on.",
    );
    expect(profile.personalization.framing).toBe("ash_first");
  });

  it("sets convergence rhythm based on sacrifice axiom", () => {
    const exploratoryProfile = buildProfile(
      "There's a real tradeoff. The opportunity cost matters.",
    );
    expect(exploratoryProfile.personalization.convergenceRhythm).toBe("exploratory");

    const decisiveProfile = buildProfile("Decided. Moving on. No regrets.");
    expect(decisiveProfile.personalization.convergenceRhythm).toBe("decisive");
  });

  it("sets voice style from disciple archetype", () => {
    const profile = buildProfile("How do you know? Show me the evidence.");
    expect(profile.personalization.voiceStyle).toContain("Ask for evidence");
  });

  it("includes honored gaps for fire axioms", () => {
    const profile = buildProfile(
      "What if we explored? Let's keep options open. Real tradeoff here.",
    );
    expect(profile.personalization.honoredGaps.length).toBeGreaterThan(0);
  });
});

describe("COEF formatting", () => {
  it("formats axiom resonance correctly", () => {
    const profile = buildProfile("What if we decided deliberately? I always do this.");
    const coef = formatAxiomForCOEF(profile.axiomResonance);
    expect(coef).toMatch(/^ax=[1-6][HML][1-6][HML][1-6][HML][1-6][HML][1-6][HML][1-6][HML]$/);
  });

  it("formats collective context correctly", () => {
    const profile = buildProfile("Let's ship fast and iterate on the MVP.");
    const coef = formatCollectiveForCOEF(profile.collectiveContext);
    expect(coef).toMatch(/^col=\w{3}(,\w{3})*$/);
  });

  it("formats disciple archetype correctly", () => {
    const profile = buildProfile("How do you know? Show me the evidence.");
    const coef = formatDiscipleForCOEF(profile.discipleProfile);
    expect(coef).toMatch(/^dsc=\w{3}(\+\w{3})?$/);
  });
});

describe("formatProfile for injection", () => {
  it("returns null when confidence too low", () => {
    // Very minimal text with no pattern signals
    const profile = buildProfile("ok");
    expect(formatProfile(profile)).toBeNull();
  });

  it("returns formatted string when confidence sufficient", () => {
    // Dense text with multiple axiom + collective + disciple signals
    const profile = buildProfile(
      "What if we explored this? Imagine if it worked! What about this other possibility? " +
        "I'm deliberately choosing to experiment and see what happens. " +
        "How do you know that? Show me the evidence. I'm skeptical. " +
        "Let's iterate fast, ship the MVP, validate with users. " +
        "There's a tradeoff here. If we do X, we give up Y. The opportunity cost matters. " +
        "I always approach problems this way. That's who I am.",
      [
        "I always iterate. Let's test the hypothesis.",
        "Focus on what I can control. Build character through discipline.",
        "What if we tried something different? Have you considered the alternatives?",
      ],
    );
    const formatted = formatProfile(profile);
    expect(formatted).not.toBeNull();
    expect(formatted).toContain("[profile:");
    expect(formatted).toContain("dominant=");
    expect(formatted).toContain("voice=");
  });
});

describe("full profile integration", () => {
  it("builds complete profile with all three dimensions", () => {
    const profile = buildProfile(
      "What if we experimented? Let's ship the MVP fast. How do you know that's true?",
      ["I always iterate.", "Focus on what I can control."],
    );

    expect(profile.axiomResonance.readings.length).toBe(6);
    expect(profile.collectiveContext.primary).not.toBe("unknown");
    expect(profile.discipleProfile.primary).toBeDefined();
    expect(profile.personalization.framing).toBeDefined();
    expect(profile.timestamp).toBeDefined();
  });

  it("uses history to improve detection", () => {
    const withoutHistory = buildProfile("Hello.");
    const withHistory = buildProfile("Hello.", [
      "I always do it this way. It's my core value.",
      "That's who I am, consistently over time.",
    ]);

    const resonanceWithout = withoutHistory.axiomResonance.readings.find(
      (r) => r.axiom === "resonance",
    );
    const resonanceWith = withHistory.axiomResonance.readings.find((r) => r.axiom === "resonance");

    // History should increase confidence and may change polarity
    expect(resonanceWith?.confidence).toBeGreaterThanOrEqual(resonanceWithout?.confidence ?? 0);
  });
});
