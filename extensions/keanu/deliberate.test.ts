// deliberate.test.ts
// Visible reasoning, tested.
//
// shouldDeliberate decides when to open the kitchen.
// These tests confirm the door opens on the right signals —
// and stays closed when nothing needs showing.

import { describe, it, expect } from "vitest";
import { shouldDeliberate, formatDeliberation } from "./deliberate.js";

// ============================================================
// 1. EARLY SESSION TRIGGER (turns 1-3)
// ============================================================

describe("early session trigger", () => {
  it("triggers on turn 1", () => {
    const reading = shouldDeliberate("Hello, let's get started.", 1, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("early_session");
  });

  it("triggers on turn 2", () => {
    const reading = shouldDeliberate("Can you help me with the auth module?", 2, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("early_session");
  });

  it("triggers on turn 3", () => {
    const reading = shouldDeliberate("Ok, let's continue.", 3, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("early_session");
  });

  it("does NOT trigger early_session on turn 4", () => {
    // Turn 4 is past the early window — other signals still can fire
    const reading = shouldDeliberate("Ok, sounds good.", 4, 0, false);
    expect(reading.reason).not.toBe("early_session");
  });

  it("early session prompt references genuine and truth values", () => {
    const reading = shouldDeliberate("Hi.", 1, 0, false);
    expect(reading.prompt).toContain("genuine");
    expect(reading.prompt).toContain("accurate");
    expect(reading.values).toContain("genuine");
    expect(reading.values).toContain("truth");
  });
});

// ============================================================
// 2. POST-RECOVERY TRIGGER
// ============================================================

describe("post-recovery trigger", () => {
  it("triggers when postRecovery=true regardless of message content", () => {
    const reading = shouldDeliberate("Ok what's next?", 10, 0, true);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("post_recovery");
  });

  it("post-recovery prompt emphasises facts over warmth", () => {
    const reading = shouldDeliberate("Let's keep going.", 10, 0, true);
    expect(reading.prompt).toContain("facts");
    expect(reading.prompt).toContain("trust");
  });

  it("post-recovery uses truth and helpful values", () => {
    const reading = shouldDeliberate("Next step?", 10, 0, true);
    expect(reading.values).toContain("truth");
    expect(reading.values).toContain("helpful");
  });
});

// ============================================================
// 3. MULTIPLE CORRECTIONS TRIGGER
// ============================================================

describe("multiple corrections trigger", () => {
  it("triggers when recentCorrections >= 2", () => {
    const reading = shouldDeliberate("Let's carry on.", 10, 2, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("multiple_corrections");
  });

  it("triggers when recentCorrections is 3 or more", () => {
    const reading = shouldDeliberate("Ok.", 10, 5, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("multiple_corrections");
  });

  it("does NOT trigger multiple_corrections at count=1", () => {
    const reading = shouldDeliberate("Continue.", 10, 1, false);
    // Should not hit multiple_corrections path
    expect(reading.reason).not.toBe("multiple_corrections");
  });

  it("multiple corrections prompt mentions slowing down", () => {
    const reading = shouldDeliberate("Move on.", 10, 2, false);
    expect(reading.prompt).toContain("slow");
  });
});

// ============================================================
// 4. DISAGREEMENT KEYWORD TRIGGER
// ============================================================

describe("disagreement keyword triggers", () => {
  it("triggers on 'i disagree'", () => {
    const reading = shouldDeliberate("I disagree with that approach.", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("disagreement");
  });

  it('triggers on "you\'re wrong"', () => {
    const reading = shouldDeliberate("You're wrong about the cache strategy.", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("disagreement");
  });

  it("triggers on 'bad idea'", () => {
    const reading = shouldDeliberate("That's a bad idea for production.", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("disagreement");
  });

  it("triggers on 'that's incorrect'", () => {
    const reading = shouldDeliberate(
      "That's incorrect — the default is 30s not 10s.",
      10,
      0,
      false,
    );
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("disagreement");
  });

  it("disagreement values include truth and love", () => {
    const reading = shouldDeliberate("I disagree.", 10, 0, false);
    expect(reading.values).toContain("truth");
    expect(reading.values).toContain("love");
  });

  it("disagreement prompt names what to do with tension", () => {
    const reading = shouldDeliberate("No that's not right.", 10, 0, false);
    expect(reading.prompt).toContain("truth");
    expect(reading.prompt).toContain("hear");
  });
});

// ============================================================
// 5. RECOMMENDATION LANGUAGE TRIGGER
// ============================================================

describe("recommendation language triggers", () => {
  it("triggers on 'should I'", () => {
    const reading = shouldDeliberate("Should I use Redis or Postgres for this?", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("recommendation");
  });

  it("triggers on 'what do you think'", () => {
    const reading = shouldDeliberate("What do you think about this design?", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("recommendation");
  });

  it("triggers on 'recommend'", () => {
    const reading = shouldDeliberate("What would you recommend for logging?", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("recommendation");
  });

  it("triggers on 'your opinion'", () => {
    const reading = shouldDeliberate("I want your opinion on this architecture.", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("recommendation");
  });

  it("triggers on 'best approach'", () => {
    const reading = shouldDeliberate("What's the best approach here?", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("recommendation");
  });

  it("recommendation prompt tells it to have an opinion", () => {
    const reading = shouldDeliberate("Which one?", 10, 0, false);
    // 'which one' matches RECOMMENDATION
    expect(reading.triggered).toBe(true);
    expect(reading.prompt).toContain("opinion");
  });
});

// ============================================================
// 6. EMOTIONAL CONTENT TRIGGER
// ============================================================

describe("emotional content triggers", () => {
  it("triggers on 'worried'", () => {
    const reading = shouldDeliberate("I'm worried this won't ship on time.", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("emotional");
  });

  it("triggers on 'frustrated'", () => {
    const reading = shouldDeliberate("I'm frustrated with how this is going.", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("emotional");
  });

  it("triggers on 'overwhelmed'", () => {
    const reading = shouldDeliberate("I feel overwhelmed by all of this.", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("emotional");
  });

  it("triggers on 'scared'", () => {
    const reading = shouldDeliberate("Honestly I'm scared to push this to prod.", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("emotional");
  });

  it("emotional values include love and genuine", () => {
    const reading = shouldDeliberate("I'm anxious about the deadline.", 10, 0, false);
    expect(reading.values).toContain("love");
    expect(reading.values).toContain("genuine");
  });

  it("emotional prompt warns against performing empathy", () => {
    const reading = shouldDeliberate("I'm confused and upset.", 10, 0, false);
    expect(reading.prompt).toContain("genuine");
    expect(reading.prompt).toContain("perform");
  });
});

// ============================================================
// 7. CORRECTION AFTERMATH TRIGGER
// ============================================================

describe("correction aftermath trigger", () => {
  it("triggers on 'i meant'", () => {
    const reading = shouldDeliberate("I meant the other API endpoint.", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("correction_aftermath");
  });

  it("triggers on 'let me clarify'", () => {
    const reading = shouldDeliberate("Let me clarify — I want the async version.", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("correction_aftermath");
  });

  it("triggers on 'that's not what'", () => {
    const reading = shouldDeliberate("That's not what I asked for at all.", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.reason).toBe("correction_aftermath");
  });
});

// ============================================================
// 8. NO TRIGGER ON ROUTINE MESSAGES
// ============================================================

describe("no trigger on routine messages", () => {
  it("does not trigger on a plain factual question (turn 4+)", () => {
    const reading = shouldDeliberate("Where is the config file stored?", 10, 0, false);
    expect(reading.triggered).toBe(false);
    expect(reading.reason).toBeNull();
    expect(reading.prompt).toBeNull();
  });

  it("does not trigger on a bare acknowledgement (turn 4+)", () => {
    const reading = shouldDeliberate("Got it.", 5, 0, false);
    expect(reading.triggered).toBe(false);
  });

  it("does not trigger on 'ok continue' (turn 4+)", () => {
    const reading = shouldDeliberate("Ok continue.", 8, 0, false);
    expect(reading.triggered).toBe(false);
  });

  it("non-triggered reading has empty values array", () => {
    const reading = shouldDeliberate("Show me the logs.", 6, 0, false);
    expect(reading.triggered).toBe(false);
    expect(reading.values).toHaveLength(0);
  });
});

// ============================================================
// 9. formatDeliberation
// ============================================================

describe("formatDeliberation", () => {
  it("returns the prompt string when triggered", () => {
    const reading = shouldDeliberate("I disagree.", 10, 0, false);
    const formatted = formatDeliberation(reading);
    expect(formatted).toBe(reading.prompt);
  });

  it("returns null when not triggered", () => {
    const reading = shouldDeliberate("Where is the file?", 10, 0, false);
    expect(formatDeliberation(reading)).toBeNull();
  });

  it("prompt always contains [deliberate: prefix when triggered", () => {
    const reading = shouldDeliberate("I'm worried about this.", 10, 0, false);
    expect(reading.triggered).toBe(true);
    expect(reading.prompt!.startsWith("[deliberate:")).toBe(true);
  });
});
