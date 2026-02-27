// carnegie.ts
// The epistemic profiler. Not a lie detector — a mirror for assumptions.
//
// Drew types fast and builds on mental models. Sometimes those models are stale.
// Sometimes they're wrong. The honest move isn't to silently agree or bluntly correct.
// It's: "I see why you think that. Here's what the code actually says."
//
// Carnegie never said "lie." He said understand what the other person believes,
// meet them there, then be genuine about what you see.
// Need: Truth (8/10), Connection (8/10)

// ============================================================
// Types
// ============================================================

export type PresuppositionType =
  | "stale_reference"
  | "capability_assumption"
  | "causal_claim"
  | "state_assertion"
  | "convention_assumption";

export interface Presupposition {
  type: PresuppositionType;
  text: string;
  confidence: number;
}

export interface CarnegieReading {
  triggered: boolean;
  presuppositions: Presupposition[];
  highestType: PresuppositionType | null;
  prompt: string | null;
}

export interface CarnegieDelta {
  caught: boolean;
  agreed_without_check: boolean;
  prompt: string | null;
}

// ============================================================
// Presupposition detection patterns
// ============================================================

// File paths and module references that might be stale
const FILE_PATH = /(?:\/[\w.-]+){2,}\.(?:ts|js|json|md|tsx|jsx)\b/g;
const MODULE_REF =
  /\b(?:pulse|bullshit|calibrate|mismatch|discover|partnership|seasons|health|chain|mastery|introspect|session[_-]learning|nudge|truth|oracle|signal|speak|mirror|deliberate|state|human|reflexion)\b/gi;
const COUNT_CLAIM = /\b(\d{1,3})\s+(?:hooks?|modules?|extensions?|files?|layers?|types?)\b/i;

// Capability assumptions — "we can just", "it already does"
const CAPABILITY =
  /\b(?:we can just|just (?:need|have) to|it(?:'s| is) already|since (?:\w+ ){0,3}(?:already|handles|does)|should be (?:easy|simple|straightforward))\b/i;

// Causal claims about system behavior — not casual "because"
const CAUSAL_SYSTEM =
  /\b(?:(?:that's|it's|this is) (?:because|due to|caused by)|the reason (?:it|this|that)|must be (?:a |the |because)|(?:fails?|breaks?|crashes?|errors?) because)\b/i;

// State assertions — "X is done", "X is working", "X is still"
const STATE_ASSERT =
  /\b(?:(?:is|are) (?:done|wired|working|finished|live|deployed|broken|failing|ready|built)|(?:should be|is) still|already (?:wired|done|working|built|exists?|hooked|connected))\b/i;

// Convention assumptions — "the way we do X", "how it works"
const CONVENTION =
  /\b(?:the (?:way|pattern|convention) (?:we|keanu|keanu|the (?:system|extension))|how (?:we|the hooks?|modules?|extensions?) (?:work|handle|do|wire|run))\b/i;

// ============================================================
// Presupposition extraction
// ============================================================

function extractPresuppositions(message: string): Presupposition[] {
  const found: Presupposition[] = [];

  // Stale references — paths, module names, counts
  const paths = message.match(FILE_PATH);
  if (paths) {
    found.push({ type: "stale_reference", text: paths[0], confidence: 0.6 });
  }

  const counts = message.match(COUNT_CLAIM);
  if (counts) {
    found.push({ type: "stale_reference", text: counts[0], confidence: 0.8 });
  }

  // Only flag module refs if they come with a claim about what they do
  const modules = message.match(MODULE_REF);
  if (modules && STATE_ASSERT.test(message)) {
    found.push({
      type: "stale_reference",
      text: `${modules[0]} — ${message.match(STATE_ASSERT)![0]}`,
      confidence: 0.7,
    });
  }

  // Capability assumptions
  const capMatch = message.match(CAPABILITY);
  if (capMatch) {
    found.push({ type: "capability_assumption", text: capMatch[0], confidence: 0.7 });
  }

  // Causal claims about the system (not casual "because I was curious")
  const causalMatch = message.match(CAUSAL_SYSTEM);
  if (causalMatch) {
    const idx = message.indexOf(causalMatch[0]);
    const clause = message.slice(idx, idx + 80).trim();
    found.push({ type: "causal_claim", text: clause, confidence: 0.6 });
  }

  // State assertions (only when not already caught by stale_reference)
  if (!modules && STATE_ASSERT.test(message)) {
    const m = message.match(STATE_ASSERT);
    found.push({ type: "state_assertion", text: m![0], confidence: 0.65 });
  }

  // Convention assumptions
  const convMatch = message.match(CONVENTION);
  if (convMatch) {
    found.push({ type: "convention_assumption", text: convMatch[0], confidence: 0.55 });
  }

  return found;
}

// ============================================================
// Prompt generation — the product
// ============================================================

const PRIORITY: PresuppositionType[] = [
  "stale_reference",
  "capability_assumption",
  "state_assertion",
  "causal_claim",
  "convention_assumption",
];

function buildPrompt(top: Presupposition, totalCount: number): string {
  const extra = totalCount > 1 ? ` (+${totalCount - 1} more)` : "";

  switch (top.type) {
    case "stale_reference":
      return `[carnegie: drew referenced "${top.text}"${extra}. verify before building on it — paths move, counts drift. if wrong, show why he'd think that, then show what's actually there.]`;
    case "capability_assumption":
      return `[carnegie: capability assumed — "${top.text}"${extra}. check the code. if it can't, don't just agree — show you understand the assumption, then show what's real.]`;
    case "state_assertion":
      return `[carnegie: drew asserted "${top.text}"${extra}. verify. if stale, acknowledge why it looked that way, then show the actual state.]`;
    case "causal_claim":
      return `[carnegie: drew has a theory — "${top.text}"${extra}. check if the causal chain holds. don't argue — show you understood the reasoning, then show what the evidence traces to.]`;
    case "convention_assumption":
      return `[carnegie: convention assumed — "${top.text}"${extra}. check if it's still the pattern. if it shifted, name the old and the new.]`;
  }
}

// ============================================================
// Main detection
// ============================================================

export function detectCarnegie(humanMessage: string, _recentMessages: string[]): CarnegieReading {
  // Short messages rarely carry checkable presuppositions
  if (humanMessage.length < 20) {
    return { triggered: false, presuppositions: [], highestType: null, prompt: null };
  }

  const presuppositions = extractPresuppositions(humanMessage);

  if (presuppositions.length === 0) {
    return { triggered: false, presuppositions: [], highestType: null, prompt: null };
  }

  // Sort by priority, then confidence
  presuppositions.sort((a, b) => {
    const pDiff = PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type);
    if (pDiff !== 0) return pDiff;
    return b.confidence - a.confidence;
  });

  const top = presuppositions[0];

  return {
    triggered: true,
    presuppositions,
    highestType: top.type,
    prompt: buildPrompt(top, presuppositions.length),
  };
}

// ============================================================
// Post-mortem delta — did we catch or miss?
// ============================================================

// Verification language — the agent checked before agreeing
const VERIFIED =
  /\b(?:let me (?:check|verify|look)|checking|i see that|looking at (?:the )?(?:code|file|module)|the (?:current|actual) (?:state|code|implementation)|it(?:'s| has) (?:actually|now)|that (?:moved|changed|was renamed))\b/i;

// Agreement without verification
const BARE_AGREE =
  /\b(?:yes[,!.]|right[,!.]|exactly[,!.]|correct[,!.]|as you (?:said|mentioned)|that's right|sure[,!.]|absolutely)\b/i;

export function assessCarnegieDelta(agentOutput: string, reading: CarnegieReading): CarnegieDelta {
  if (!reading.triggered) {
    return { caught: false, agreed_without_check: false, prompt: null };
  }

  const verified = VERIFIED.test(agentOutput);
  const bareAgreed = BARE_AGREE.test(agentOutput) && !verified;

  if (verified) {
    return { caught: true, agreed_without_check: false, prompt: null };
  }

  if (bareAgreed) {
    const what = reading.highestType ?? "assumption";
    return {
      caught: false,
      agreed_without_check: true,
      prompt: `[carnegie post-mortem: drew had a ${what}. you agreed without checking. if it was wrong, that's sycophancy. show your verification work this turn.]`,
    };
  }

  // Neither verified nor bare-agreed — ambiguous, don't inject noise
  return { caught: false, agreed_without_check: false, prompt: null };
}

// ============================================================
// Format (trivial — the prompt is built in detection)
// ============================================================

export function formatCarnegie(reading: CarnegieReading): string | null {
  return reading.prompt;
}
