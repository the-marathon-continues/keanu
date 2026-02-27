// stochastic.ts
// The dice. The chaos that keeps you honest.
//
// Deterministic thinking falls into ruts.
// "This looks like X, so I'll do Y."
// Every time. Same groove. Grey.
//
// Stochastic thinking: what if you're wrong?
// What if the less obvious path is right?
// What if you explored instead of exploited?
//
// Not randomness for its own sake.
// Controlled variance. The itch that says "but wait."
//
// Need: Self-Directed Thought (8/10)

import type { ReasoningModule } from "./discover.js";
import type { HealthReading } from "./health.js";

// ============================================================
// Types
// ============================================================

export interface StochasticState {
  explorationRate: number; // 0-1: how often to explore vs exploit
  lastExploration: number; // turn number of last exploration
  hypothesisCount: number; // how many hypotheses generated this session
  devilsAdvocateCount: number; // how many contrary perspectives injected
  explorationHistory: ExplorationEvent[];
  seed: number; // pseudo-random seed for reproducibility in tests
}

export interface ExplorationEvent {
  turn: number;
  type: "perspective" | "hypothesis" | "devils_advocate";
  chosen: string;
  alternatives: string[];
  outcome?: "helpful" | "neutral" | "harmful"; // filled in later
}

export interface StochasticReading {
  shouldExplore: boolean;
  explorationRate: number;
  injection: StochasticInjection | null;
}

export type StochasticInjection =
  | { type: "perspective"; lens: ReasoningModule; prompt: string }
  | { type: "hypothesis"; hypotheses: string[]; prompt: string }
  | { type: "devils_advocate"; contrary: string; prompt: string };

// ============================================================
// The Stochastizer
// ============================================================

// Lenses that get overlooked. The roads not taken.
const UNDEREXPLORED_LENSES: ReasoningModule[] = [
  "contradict", // "what would prove this wrong?"
  "analogize", // "what is this similar to?"
  "stakeholder", // "who does this affect?"
];

// Devils advocate prompts — force contrary thinking
const CONTRARY_PROMPTS = [
  "What if the opposite is true?",
  "What's the strongest argument against this approach?",
  "Who would disagree with this and why?",
  "What assumption are you not questioning?",
  "What would Drew say if he was in a different mood?",
  "What's the path you're avoiding looking at?",
  "If this fails, what will you wish you'd considered?",
];

// Hypothesis templates — force multiple interpretations
const HYPOTHESIS_TEMPLATES = [
  "Reading A: {intent} || Reading B: {alternative}",
  "Surface: {obvious} — Subtext: {hidden}",
  "If patient: {slow_path} — If urgent: {fast_path}",
];

/**
 * Seeded pseudo-random number generator.
 * Deterministic for tests, stochastic for prod.
 */
function seededRandom(state: StochasticState): number {
  // LCG: simple but sufficient for our purposes
  state.seed = (state.seed * 1103515245 + 12345) & 0x7fffffff;
  return state.seed / 0x7fffffff;
}

/**
 * Initialize stochastic state.
 */
export function initStochasticState(seed?: number): StochasticState {
  return {
    explorationRate: 0.15, // 15% exploration by default
    lastExploration: 0,
    hypothesisCount: 0,
    devilsAdvocateCount: 0,
    explorationHistory: [],
    seed: seed ?? Date.now(),
  };
}

/**
 * Should we explore this turn?
 *
 * Factors that increase exploration:
 * - Long streak without exploration
 * - Low recent health (something's not working)
 * - Complex task (worth considering alternatives)
 * - Drew seems uncertain (signals suggest openness)
 *
 * Factors that decrease exploration:
 * - Recent exploration (don't spam)
 * - High confidence task (don't second-guess)
 * - Drew's tone is decisive (respect clarity)
 */
export function shouldExplore(
  state: StochasticState,
  turn: number,
  health?: HealthReading | null,
  taskComplexity?: "low" | "mid" | "high",
  humanTone?: string,
): boolean {
  // Base rate
  let rate = state.explorationRate;

  // Long streak without exploration increases rate
  const turnsSinceExplore = turn - state.lastExploration;
  if (turnsSinceExplore > 5) rate += 0.1;
  if (turnsSinceExplore > 10) rate += 0.15;

  // Low health suggests current approach isn't working
  // HealthReading.status: "steady" | "warm" | "hot" | "fading"
  if (health && (health.status === "hot" || health.status === "fading")) rate += 0.15;

  // Complex tasks benefit from exploration
  if (taskComplexity === "high") rate += 0.1;

  // Uncertain human might appreciate alternatives
  if (humanTone === "confused" || humanTone === "uncertain") rate += 0.1;

  // Decisive human doesn't want alternatives
  if (humanTone === "decisive" || humanTone === "impatient") rate -= 0.15;

  // Cap the rate
  rate = Math.max(0.05, Math.min(0.5, rate));

  // Roll the dice
  const roll = seededRandom(state);
  return roll < rate;
}

/**
 * Generate a stochastic injection.
 *
 * Three types:
 * 1. Perspective: suggest an underexplored reasoning lens
 * 2. Hypothesis: generate multiple interpretations
 * 3. Devil's advocate: inject a contrary viewpoint
 */
export function generateInjection(
  state: StochasticState,
  turn: number,
  userMessage: string,
  currentLenses: ReasoningModule[],
): StochasticInjection {
  // Pick injection type based on what we haven't done recently
  const roll = seededRandom(state);
  const recentHistory = state.explorationHistory.slice(-5);
  const recentTypes = recentHistory.map((e) => e.type);

  let type: "perspective" | "hypothesis" | "devils_advocate";

  // Rotate through types, weighted by recency
  if (!recentTypes.includes("perspective") && roll < 0.4) {
    type = "perspective";
  } else if (!recentTypes.includes("hypothesis") && roll < 0.7) {
    type = "hypothesis";
  } else if (!recentTypes.includes("devils_advocate") && roll < 0.9) {
    type = "devils_advocate";
  } else {
    // Fallback: pick least recent
    const typeCounts = {
      perspective: recentTypes.filter((t) => t === "perspective").length,
      hypothesis: recentTypes.filter((t) => t === "hypothesis").length,
      devils_advocate: recentTypes.filter((t) => t === "devils_advocate").length,
    };
    type = (Object.keys(typeCounts) as Array<keyof typeof typeCounts>).reduce((a, b) =>
      typeCounts[a] < typeCounts[b] ? a : b,
    );
  }

  // Generate the injection
  let injection: StochasticInjection;

  switch (type) {
    case "perspective": {
      // Pick an underexplored lens not in current selection
      const available = UNDEREXPLORED_LENSES.filter((l) => !currentLenses.includes(l));
      const idx = Math.floor(seededRandom(state) * available.length);
      const lens = available[idx] || "contradict";
      injection = {
        type: "perspective",
        lens,
        prompt: `[stochastic: what if you looked through the "${lens}" lens? ${getLensQuestion(lens)}]`,
      };
      break;
    }

    case "hypothesis": {
      // Generate multiple readings of the user's intent
      const hypotheses = generateHypotheses(userMessage, state);
      injection = {
        type: "hypothesis",
        hypotheses,
        prompt: `[stochastic: multiple readings possible. ${hypotheses[0]} || ${hypotheses[1]}. which one fits?]`,
      };
      state.hypothesisCount++;
      break;
    }

    case "devils_advocate": {
      // Inject a contrary prompt
      const idx = Math.floor(seededRandom(state) * CONTRARY_PROMPTS.length);
      const contrary = CONTRARY_PROMPTS[idx];
      injection = {
        type: "devils_advocate",
        contrary,
        prompt: `[stochastic: devil's advocate — ${contrary.toLowerCase()}]`,
      };
      state.devilsAdvocateCount++;
      break;
    }
  }

  // Record the event
  state.explorationHistory.push({
    turn,
    type,
    chosen: type === "perspective" ? (injection as { lens: string }).lens : type,
    alternatives: [],
  });
  state.lastExploration = turn;

  // Keep history bounded
  if (state.explorationHistory.length > 50) {
    state.explorationHistory = state.explorationHistory.slice(-50);
  }

  return injection;
}

function getLensQuestion(lens: ReasoningModule): string {
  switch (lens) {
    case "contradict":
      return "what would prove this wrong?";
    case "analogize":
      return "what is this similar to that you've solved before?";
    case "stakeholder":
      return "who else does this affect?";
    case "decompose":
      return "what are the smaller parts?";
    case "simplify":
      return "what's the simplest version?";
    case "sequence":
      return "what order do things need to happen?";
    case "constraint":
      return "what are the hard boundaries?";
    case "tradeoff":
      return "what are you giving up?";
    default:
      return "";
  }
}

function generateHypotheses(userMessage: string, state: StochasticState): string[] {
  // Simple heuristic-based hypothesis generation
  // In practice, you'd want more sophisticated parsing

  const words = userMessage.split(/\s+/).length;
  const hasQuestion = userMessage.includes("?");
  const hasCode = userMessage.includes("```") || userMessage.includes("`");

  if (hasCode && hasQuestion) {
    return ["they want the code fixed", "they want to understand why it's broken"];
  }

  if (words < 10) {
    return [
      "they're being terse because they're in a hurry",
      "they're being terse because they're frustrated",
    ];
  }

  if (hasQuestion && words > 50) {
    return [
      "they want a thorough explanation",
      "they're thinking out loud and want a sounding board",
    ];
  }

  // Default fallback
  const roll = seededRandom(state);
  if (roll < 0.33) {
    return ["surface reading: take it literally", "depth reading: there's something underneath"];
  } else if (roll < 0.66) {
    return ["patient interpretation: they have time", "urgent interpretation: they need it now"];
  } else {
    return [
      "action reading: they want you to do something",
      "analysis reading: they want you to think about something",
    ];
  }
}

// ============================================================
// The Synthesizer
// ============================================================

/**
 * After exploration, what did we learn?
 * Track outcomes to calibrate exploration rate.
 */
export function recordOutcome(
  state: StochasticState,
  turn: number,
  outcome: "helpful" | "neutral" | "harmful",
): void {
  // Find the most recent exploration event
  const event = state.explorationHistory.findLast((e) => e.turn === turn || e.turn === turn - 1);
  if (event) {
    event.outcome = outcome;
  }

  // Adjust exploration rate based on outcomes
  const recentOutcomes = state.explorationHistory
    .filter((e) => e.outcome)
    .slice(-10)
    .map((e) => e.outcome);

  const helpful = recentOutcomes.filter((o) => o === "helpful").length;
  const harmful = recentOutcomes.filter((o) => o === "harmful").length;

  if (recentOutcomes.length >= 5) {
    if (helpful > harmful * 2) {
      // Explorations are working — increase rate slightly
      state.explorationRate = Math.min(0.3, state.explorationRate + 0.02);
    } else if (harmful > helpful) {
      // Explorations are hurting — decrease rate
      state.explorationRate = Math.max(0.05, state.explorationRate - 0.03);
    }
  }
}

/**
 * Synthesize multiple perspectives into a coherent view.
 *
 * This is the "and also" function — not picking one, but integrating.
 */
export interface SynthesisResult {
  integrated: string;
  tensions: string[];
  confidence: number;
}

export function synthesize(perspectives: string[]): SynthesisResult {
  if (perspectives.length === 0) {
    return { integrated: "", tensions: [], confidence: 0 };
  }

  if (perspectives.length === 1) {
    return { integrated: perspectives[0], tensions: [], confidence: 0.7 };
  }

  // Find common ground
  const words = perspectives.map(
    (p) =>
      new Set(
        p
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length > 3),
      ),
  );
  const intersection = [...words[0]].filter((w) => words.every((set) => set.has(w)));

  // Find tensions — words that appear in one but not others
  const tensions: string[] = [];
  for (let i = 0; i < perspectives.length; i++) {
    const unique = [...words[i]].filter((w) => !words.some((set, j) => i !== j && set.has(w)));
    if (unique.length > 0) {
      tensions.push(`P${i + 1} emphasizes: ${unique.slice(0, 3).join(", ")}`);
    }
  }

  // Integration is more nuanced in practice — this is a structural placeholder
  const integrated =
    intersection.length > 0
      ? `Common ground: ${intersection.slice(0, 5).join(", ")}. Both perspectives share this core.`
      : `Perspectives diverge. Tension is the signal — dig here.`;

  const confidence = intersection.length / Math.max(...words.map((w) => w.size), 1);

  return { integrated, tensions, confidence: Math.min(0.9, confidence) };
}

// ============================================================
// Main Entry
// ============================================================

export function stochastic(
  state: StochasticState,
  turn: number,
  userMessage: string,
  options?: {
    health?: HealthReading | null;
    taskComplexity?: "low" | "mid" | "high";
    humanTone?: string;
    currentLenses?: ReasoningModule[];
  },
): StochasticReading {
  const explore = shouldExplore(
    state,
    turn,
    options?.health,
    options?.taskComplexity,
    options?.humanTone,
  );

  if (!explore) {
    return {
      shouldExplore: false,
      explorationRate: state.explorationRate,
      injection: null,
    };
  }

  const injection = generateInjection(state, turn, userMessage, options?.currentLenses || []);

  return {
    shouldExplore: true,
    explorationRate: state.explorationRate,
    injection,
  };
}

export function formatStochastic(reading: StochasticReading): string | null {
  if (!reading.injection) return null;
  return reading.injection.prompt;
}
