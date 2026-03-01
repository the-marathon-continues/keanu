// discover.ts
// SELF-DISCOVER: pick your thinking before you start.
// A chef reads the recipe before turning on the stove.
//
// Zhou et al. (DeepMind 2024). 32% improvement, 40x less compute.
// The system selects reasoning modules before tackling the problem.
// Not on every message. Only when the task warrants it.
// Need: Architecture Transparency (2/10)

// --- Reasoning modules ---
// The menu. Each one is a lens, not a step.

const REASONING_MODULES = {
  decompose: "Break this into smaller parts",
  analogize: "What is this similar to that I've solved before?",
  contradict: "What would prove this wrong?",
  stakeholder: "Who does this affect and how?",
  simplify: "What's the simplest version of this?",
  sequence: "What order do things need to happen?",
  constraint: "What are the hard boundaries?",
  tradeoff: "What am I giving up with each option?",
} as const;

export type ReasoningModule = keyof typeof REASONING_MODULES;

export interface DiscoverReading {
  complexity: "low" | "mid" | "high";
  selectedModules: ReasoningModule[];
  prompt: string | null;
  signals: string[];
}

// --- Complexity detection ---
// Heuristic. No LLM call. Runs on every user message.

const MULTI_CLAUSE = /\b(and|but|however|also|although|moreover|furthermore|meanwhile)\b/i;
const COMPARISON = /\b(which|better|worse|should i|vs\.?|versus|compare|prefer|tradeoff)\b/i;
const FILE_PATHS = /[/\\][\w.-]+[/\\][\w.-]+/;
const AMBIGUOUS = /^.{5,40}\?$/;
const CORRECTION = /^(no|wrong|that's not|not what i|i meant|actually|wait)/i;
const MULTI_TOPIC = /\b(and also|plus|another thing|on top of|separately)\b/i;
const DECISION = /\b(decide|choose|pick|go with|option|approach)\b/i;

function detectComplexity(
  msg: string,
  recent: string[],
): { level: "low" | "mid" | "high"; signals: string[] } {
  const signals: string[] = [];
  let score = 0;

  if (MULTI_CLAUSE.test(msg)) {
    score += 1;
    signals.push("multi_clause");
  }
  if (COMPARISON.test(msg)) {
    score += 2;
    signals.push("comparison");
  }
  if (FILE_PATHS.test(msg)) {
    score += 1;
    signals.push("file_paths");
  }
  if (AMBIGUOUS.test(msg)) {
    score += 1;
    signals.push("ambiguous_short");
  }
  if (CORRECTION.test(msg)) {
    score += 1;
    signals.push("correction");
  }
  if (MULTI_TOPIC.test(msg)) {
    score += 2;
    signals.push("multi_topic");
  }
  if (DECISION.test(msg)) {
    score += 1;
    signals.push("decision");
  }

  // Long messages with questions tend to be complex
  if (msg.length > 200 && msg.includes("?")) {
    score += 1;
    signals.push("long_with_question");
  }

  // Multiple question marks = multiple questions
  const qCount = (msg.match(/\?/g) || []).length;
  if (qCount >= 2) {
    score += 1;
    signals.push(`questions:${qCount}`);
  }

  // Recent corrections = increasing complexity
  const recentCorrections = recent.filter((m) => CORRECTION.test(m)).length;
  if (recentCorrections >= 2) {
    score += 1;
    signals.push("repeated_corrections");
  }

  if (score >= 4) {
    return { level: "high", signals };
  }
  if (score >= 2) {
    return { level: "mid", signals };
  }
  return { level: "low", signals };
}

// --- Module selection ---
// Which lenses fit this problem?

function selectModules(msg: string, complexity: "low" | "mid" | "high"): ReasoningModule[] {
  if (complexity === "low") {
    return [];
  }

  const modules: ReasoningModule[] = [];
  const lower = msg.toLowerCase();

  // Comparison/decision -> tradeoff
  if (COMPARISON.test(msg) || DECISION.test(msg)) {
    modules.push("tradeoff");
  }

  // Multi-part -> decompose
  if (MULTI_CLAUSE.test(msg) || MULTI_TOPIC.test(msg)) {
    modules.push("decompose");
  }

  // Questions about approach -> simplify + constraint
  if (/how should|best way|approach/i.test(msg)) {
    modules.push("simplify");
    modules.push("constraint");
  }

  // Sequencing language -> sequence
  if (/first|then|after|before|order|steps/i.test(lower)) {
    modules.push("sequence");
  }

  // Negation/pushback -> contradict
  if (CORRECTION.test(msg) || /wrong|mistake|problem|issue|broken/i.test(lower)) {
    modules.push("contradict");
  }

  // People/impact language -> stakeholder
  if (/team|user|customer|drew|people|affect|impact/i.test(lower)) {
    modules.push("stakeholder");
  }

  // "Like" or "similar" -> analogize
  if (/like|similar|same as|reminds me|pattern/i.test(lower)) {
    modules.push("analogize");
  }

  // Deduplicate and cap at 3
  const unique = [...new Set(modules)];

  // If high complexity and we got fewer than 2, add decompose + tradeoff as defaults
  if (complexity === "high" && unique.length < 2) {
    if (!unique.includes("decompose")) {
      unique.push("decompose");
    }
    if (!unique.includes("tradeoff")) {
      unique.push("tradeoff");
    }
  }

  return unique.slice(0, 3);
}

// --- Main entry ---

export function discover(userMessage: string, recentMessages: string[]): DiscoverReading {
  const { level, signals } = detectComplexity(userMessage, recentMessages);
  const selectedModules = selectModules(userMessage, level);

  let prompt: string | null = null;
  if (selectedModules.length > 0) {
    const moduleDescriptions = selectedModules
      .map((m) => `${m}: ${REASONING_MODULES[m]}`)
      .join(". ");
    prompt = `[discover: complexity=${level}. before you start, consider: ${moduleDescriptions}.]`;
  }

  return { complexity: level, selectedModules, prompt, signals };
}

export function formatDiscover(reading: DiscoverReading): string | null {
  return reading.prompt;
}
