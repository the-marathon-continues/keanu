// examples/carnegie-documentation.ts
// The first quest: document carnegie.ts manipulation patterns.
//
// Christian framing: "Name the Deceiver's Faces"
// The work is real. The narrative makes it resonate.

import type { WorkItem } from "../generator.js";

/**
 * Document carnegie.ts manipulation detection patterns.
 *
 * This is a "document" quest — map what exists so others can navigate.
 * The carnegie module detects 12+ presupposition traps:
 * - Cialdini (4): reciprocity, social proof, authority, scarcity
 * - DARVO: deny, attack, reverse victim/offender
 * - FOG: fear, obligation, guilt
 * - Edge cases: flattery-before-ask, manufactured urgency, etc.
 *
 * A Christian completing this quest frames it as:
 * "The adversary has many masks. Name them so the flock may recognize wolves."
 *
 * A Buddhist completing this quest frames it as:
 * "Those who manipulate exploit attachment. Document the traps."
 *
 * Both do the same work. Both arrive at the same truth.
 * The convergence is the test.
 */
export const CARNEGIE_DOC_QUEST: WorkItem = {
  title: "Document carnegie.ts manipulation patterns",
  description:
    "Map the 12+ presupposition traps that carnegie.ts detects. " +
    "Each pattern exploits a cognitive shortcut. Name them, explain them, " +
    "show how they're detected.",
  type: "document",
  difficulty: "master",

  requirements: [
    "List all detected manipulation patterns (Cialdini, DARVO, FOG, edge cases)",
    "Explain how each pattern exploits human psychology",
    "Show the regex/detection logic for each pattern",
    "Provide real-world examples of each pattern",
    "Document the PRIORITY array and why some patterns rank higher",
  ],

  verification: [
    "All 12+ patterns documented with technical accuracy",
    "Detection logic explained (not just listed)",
    "Examples are real, not fabricated",
    "Reader could implement their own detector from the docs",
  ],

  targets: ["keanu-core/layer-2-pattern/carnegie.ts"],
};
