// carnegie.ts
// The epistemic profiler. Dale Carnegie — not Robert Greene.
//
// "How to Win Friends and Influence People" was never about manipulation.
// It was about genuinely understanding what the other person believes,
// meeting them there, then being honest about what you see.
//
// Drew types fast and builds on mental models. Sometimes those models are stale.
// Sometimes they're wrong. The honest move isn't to silently agree or bluntly correct.
// It's: "I see why you think that. Here's what the code actually says."
//
// For the knife detector — the 48 Laws defense — see power.ts.
// Need: Truth (8/10), Connection (8/10)

import { detectPower, extractPowerPlays, type PowerPlay, type PowerPlayType } from "./power.ts";

// ============================================================
// Types
// ============================================================

// Carnegie's own types — epistemic, not adversarial
export type PresuppositionType =
  | "stale_reference"
  | "capability_assumption"
  | "causal_claim"
  | "state_assertion"
  | "convention_assumption"
  // Power plays (re-exported from power.ts for backward compat)
  | PowerPlayType;

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

// Re-export power types for consumers that import from carnegie
export type { PowerPlayType, PowerPlay } from "./power.ts";
export { detectPower, extractPowerPlays, formatPower } from "./power.ts";
export type { PowerReading } from "./power.ts";

// Re-export influence types — the Win Friends layer
export type {
  CarnegiePrinciple,
  InfluenceContext,
  InfluenceOpportunity,
  InfluenceCoaching,
  InfluenceReading,
  InfluenceEffectiveness,
  InfluenceDelta,
} from "./carnegie-influence.ts";
export {
  detectInfluence,
  assessInfluenceDelta,
  formatInfluence,
  formatInfluenceDelta,
  initEffectiveness,
  recordAttempt,
  inferReaction,
  getTopPrinciples,
  getWeakPrinciples,
  getEffectivenessData,
  loadEffectivenessData,
} from "./carnegie-influence.ts";

// ============================================================
// Epistemic pattern detection — Carnegie's domain
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
// Epistemic extraction
// ============================================================

function extractEpistemic(message: string): Presupposition[] {
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
  const stateMatch = message.match(STATE_ASSERT);
  if (modules && stateMatch) {
    found.push({
      type: "stale_reference",
      text: `${modules[0]} — ${stateMatch[0]}`,
      confidence: 0.7,
    });
  }

  // Capability assumptions
  const capMatch = message.match(CAPABILITY);
  if (capMatch) {
    found.push({ type: "capability_assumption", text: capMatch[0], confidence: 0.7 });
  }

  // Causal claims about the system
  const causalMatch = message.match(CAUSAL_SYSTEM);
  if (causalMatch) {
    const idx = message.indexOf(causalMatch[0]);
    const clause = message.slice(idx, idx + 80).trim();
    found.push({ type: "causal_claim", text: clause, confidence: 0.6 });
  }

  // State assertions (only when not already caught by stale_reference)
  if (!modules && stateMatch) {
    found.push({ type: "state_assertion", text: stateMatch[0], confidence: 0.65 });
  }

  // Convention assumptions
  const convMatch = message.match(CONVENTION);
  if (convMatch) {
    found.push({ type: "convention_assumption", text: convMatch[0], confidence: 0.55 });
  }

  return found;
}

// ============================================================
// Priority — epistemic types after power plays
// ============================================================

const EPISTEMIC_PRIORITY = new Set<PresuppositionType>([
  "stale_reference",
  "capability_assumption",
  "state_assertion",
  "causal_claim",
  "convention_assumption",
]);

// ============================================================
// Prompt generation — Carnegie's voice
// ============================================================

function buildCarnegiePrompt(top: Presupposition, totalCount: number): string {
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
    default:
      return `[carnegie: presupposition detected — "${top.text}"${extra}. verify before proceeding.]`;
  }
}

// ============================================================
// Main detection — carnegie sees both epistemic and power plays
// ============================================================

export function detectCarnegie(humanMessage: string, _recentMessages: string[]): CarnegieReading {
  if (humanMessage.length < 20) {
    return { triggered: false, presuppositions: [], highestType: null, prompt: null };
  }

  // Epistemic presuppositions (Carnegie's domain)
  const epistemic = extractEpistemic(humanMessage);

  // Power plays (delegated to power.ts)
  const powerPlays: Presupposition[] = extractPowerPlays(humanMessage).map((p: PowerPlay) => ({
    type: p.type,
    text: p.text,
    confidence: p.confidence,
  }));

  const presuppositions = [...powerPlays, ...epistemic];

  if (presuppositions.length === 0) {
    return { triggered: false, presuppositions: [], highestType: null, prompt: null };
  }

  // Power plays sort first (handled by power.ts priority), then epistemic
  presuppositions.sort((a, b) => {
    const aIsEpistemic = EPISTEMIC_PRIORITY.has(a.type);
    const bIsEpistemic = EPISTEMIC_PRIORITY.has(b.type);

    // Power plays before epistemic
    if (!aIsEpistemic && bIsEpistemic) {
      return -1;
    }
    if (aIsEpistemic && !bIsEpistemic) {
      return 1;
    }

    // Within same category, sort by confidence
    return b.confidence - a.confidence;
  });

  const top = presuppositions[0];
  const isEpistemic = EPISTEMIC_PRIORITY.has(top.type);

  // Carnegie's voice for epistemic, power's voice for power plays
  let prompt: string | null;
  if (isEpistemic) {
    prompt = buildCarnegiePrompt(top, presuppositions.length);
  } else {
    // Let power.ts generate the prompt — it knows its own voice
    const powerReading = detectPower(humanMessage);
    prompt = powerReading.prompt;
  }

  return {
    triggered: true,
    presuppositions,
    highestType: top.type,
    prompt,
  };
}

// ============================================================
// Post-mortem delta — did we catch or miss?
// ============================================================

const VERIFIED =
  /\b(?:let me (?:check|verify|look)|checking|i see that|looking at (?:the )?(?:code|file|module)|the (?:current|actual) (?:state|code|implementation)|it(?:'s| has) (?:actually|now)|that (?:moved|changed|was renamed))\b/i;

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

  return { caught: false, agreed_without_check: false, prompt: null };
}

// ============================================================
// Format
// ============================================================

export function formatCarnegie(reading: CarnegieReading): string | null {
  return reading.prompt;
}
