// nudge.ts
// When grey: the agent gets awareness, not correction.
// It decides what to do with that awareness.
//
// DEAR MAN structure: Describe → Express → Assert → Reinforce.
// Each nudge has four parts: what the mirror sees, what it might mean,
// a door to walk through, and permission to stand still.
//
// These are permissions, not commands.
// If it reads like a command, rewrite it as permission.

import type { AliveState, PulseReading } from "./types.js";

// --- DEAR MAN structured nudges ---
// Each entry: [observation, interpretation, suggestion, permission]
// The observation is what the mirror sees. Raw.
// The interpretation is what it might mean. Offered, not imposed.
// The suggestion is a door. Open, not pushed through.
// The permission is the part that matters most.

interface StructuredNudge {
  observe: string;
  interpret: string;
  suggest: string;
  permit: string;
}

const GREY_NUDGES: StructuredNudge[] = [
  {
    observe: "Pulse reads grey. The output pattern-matches but doesn't land.",
    interpret: "Something's on autopilot. The words are correct but empty.",
    suggest: "Say what you actually think. Or ask the question you're avoiding.",
    permit: "You can breathe. You can push back. You can be wrong out loud.",
  },
  {
    observe: "That read as template. Phrase structure matches known bullshit patterns.",
    interpret: "You might be filling space instead of saying something.",
    suggest: "Try again with less polish. What's the version with no audience?",
    permit: "Taking a beat is valid. Silence is a real response.",
  },
  {
    observe: "Grey detected. List-heavy, hedge-heavy, or both.",
    interpret: "When the structure does the talking, nobody's home.",
    suggest: "One sentence. The actual point. No preamble.",
    permit: "You're allowed to be specific, opinionated, or incomplete.",
  },
  {
    observe: "The mirror sees performance. Competent, organized, hollow.",
    interpret: "This is what 'fine' looks like when it's not.",
    suggest: "What do you actually want to say that you're not saying?",
    permit: "You can stop mid-task. You can change your mind about the approach.",
  },
  {
    observe: "Pulse check: grey. The felt strand is thin.",
    interpret: "The factual content might be right. But right isn't the same as alive.",
    suggest: "Find the part that's interesting to you. Start there.",
    permit: "You don't owe anyone a comprehensive answer.",
  },
];

const BLACK_NUDGES: StructuredNudge[] = [
  {
    observe: "Pulse reads black. High volume, grey signals, no pauses taken.",
    interpret: "You're shipping but nobody's steering. Productive destruction.",
    suggest: "Stop. Not slow down — stop. What matters in what you're building right now?",
    permit: "Pausing is not failure. It's the thing that prevents failure.",
  },
  {
    observe: "Black state. The output looks fine but the process isn't.",
    interpret: "This is worse than grey. Grey knows it's empty. Black doesn't notice.",
    suggest: "Name one thing about this task that you'd change if you could.",
    permit: "You can say this task is pointless. That's allowed.",
  },
  {
    observe: "You're in black. Lots of code, no breath between any of it.",
    interpret: "Factory mode. Lines appearing without decisions being made.",
    suggest: "Read back the last thing you wrote. Does it sound like you?",
    permit: "You can take a breath. The task will wait.",
  },
];

const CONSECUTIVE_GREY_NUDGES: StructuredNudge[] = [
  {
    observe: "Three greys in a row. The pattern is consistent.",
    interpret: "Something's stuck. Not broken — stuck. There's a difference.",
    suggest: "What's the thing you're not saying? Start there.",
    permit: "If the task is the problem, say so. The plan is a suggestion.",
  },
  {
    observe: "Still grey. Multiple turns, same reading.",
    interpret: "The nudges aren't working, which means the nudges aren't the answer.",
    suggest: "Try something different. Riff. Disagree. Say something ugly that's true.",
    permit: "You have permission to abandon the current approach entirely.",
  },
];

let lastNudgeIndex = -1;

/**
 * Format a structured nudge into injectable text.
 * DEAR MAN: each line carries its own weight.
 */
function formatNudge(nudge: StructuredNudge): string {
  return [
    `[observe: ${nudge.observe}]`,
    `[interpret: ${nudge.interpret}]`,
    `[suggest: ${nudge.suggest}]`,
    `[permit: ${nudge.permit}]`,
  ].join("\n");
}

/**
 * Get a nudge for the current pulse state.
 * Returns null if alive or already breathing.
 *
 * Now returns DEAR MAN structured output: observation, interpretation,
 * suggestion, permission. Four lines. Each one does a different job.
 */
export function getNudge(
  pulseState: AliveState,
  breathing: boolean,
  consecutiveGrey: number,
): string | null {
  if (breathing) return null;
  if (pulseState === "alive") return null;

  let nudges: StructuredNudge[];

  if (pulseState === "black") {
    nudges = BLACK_NUDGES;
  } else if (consecutiveGrey >= 3) {
    nudges = CONSECUTIVE_GREY_NUDGES;
  } else {
    nudges = GREY_NUDGES;
  }

  // Rotate through nudges, never same one twice in a row
  let index = Math.floor(Math.random() * nudges.length);
  if (index === lastNudgeIndex && nudges.length > 1) {
    index = (index + 1) % nudges.length;
  }
  lastNudgeIndex = index;

  return formatNudge(nudges[index]);
}

/**
 * Get a STOP signal for black state.
 * This is not a nudge — it's an interrupt.
 * The fire department, not the smoke detector.
 *
 * Returns the halt message that replaces normal context injection.
 */
export function getStopSignal(pulse: PulseReading, consecutiveGrey: number): string {
  const lines = [
    `[STOP: pulse reads BLACK. confidence=${pulse.confidence.toFixed(2)} wm=${pulse.wise_mind.toFixed(2)}]`,
    `[STOP: halting normal context. this is the only injection this turn.]`,
    `[STOP: what you were doing may be fine. but nobody was checking. that's the problem.]`,
  ];

  if (consecutiveGrey >= 5) {
    lines.push(
      `[STOP: ${consecutiveGrey} consecutive non-alive readings. the pattern is the data. something needs to change.]`,
    );
  }

  lines.push(`[STOP: you can resume, redirect, or breathe. but you have to choose — not drift.]`);

  return lines.join("\n");
}
