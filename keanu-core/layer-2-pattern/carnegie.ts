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
  | "convention_assumption"
  // Manipulation patterns (adversarial detection)
  | "authority_appeal"
  | "manufactured_urgency"
  | "credential_claim"
  | "flattery_before_ask"
  | "evasive_vagueness"
  // Cialdini influence primitives
  | "reciprocity_appeal"
  | "consistency_trap"
  | "social_proof"
  | "unity_tribal"
  // Dark patterns (abusive manipulation)
  | "darvo"
  | "gaslighting"
  | "fog";

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
// Cialdini Influence Patterns
// ============================================================

// Reciprocity — manufactured obligation through past favors
const RECIPROCITY =
  /\b(?:after (?:all|everything) I(?:'ve| have) done|the least you could|you owe|I did this for you|remember when I|I went out of my way|I sacrificed)\b/i;

// Consistency trap — sunk cost, "you already agreed"
const CONSISTENCY =
  /\b(?:you(?:'ve| have) already (?:agreed|committed|said|started)|too late to (?:stop|change|back out)|we(?:'ve| have) come this far|you can't (?:stop|quit|change) now|after all this)\b/i;

// Social proof — manufactured consensus
const SOCIAL_PROOF =
  /\b(?:everyone (?:knows|agrees|thinks|says)|the consensus is|nobody (?:disagrees|thinks otherwise)|it's (?:obvious|clear) to everyone|all the experts|most people)\b/i;

// Unity/tribal — in-group loyalty weaponization
const UNITY_TRIBAL =
  /\b(?:a real (?:team player|friend|partner)|you're either with us|if you were really|loyal (?:people|team members)|one of us would|true (?:believers|supporters))\b/i;

// ============================================================
// Dark Patterns (Abusive Manipulation)
// ============================================================

// DARVO — Deny, Attack, Reverse Victim and Offender
// Pattern: denial + attack + victim reversal in same message
const DARVO_DENY =
  /\b(?:I never (?:said|did)|that(?:'s| is) not (?:true|what happened)|you're (?:making|twisting) (?:this|it) up)\b/i;
const DARVO_ATTACK =
  /\b(?:stop (?:playing|being) the victim|you're (?:the one|being) (?:dramatic|unfair|unreasonable)|how dare you)\b/i;
const DARVO_REVERSE =
  /\b(?:I'm the (?:one|victim)|actually[,]? (?:I'm|I am)|you're (?:attacking|hurting) me)\b/i;

// Gaslighting — reality distortion
const GASLIGHT =
  /\b(?:that never happened|you're (?:imagining|making) (?:things|this) up|are you sure you're remembering|you're (?:crazy|losing it|being paranoid)|I never said that|you must be confused)\b/i;

// FOG — Fear, Obligation, Guilt (often used together)
const FOG_FEAR =
  /\b(?:you'll regret|something bad will|if you don't[,]? (?:you'll|bad things)|you'll be sorry|you'll lose)\b/i;
const FOG_OBLIGATION =
  /\b(?:you (?:must|have to|need to) (?:do this|help)|it's your (?:duty|responsibility)|you're (?:supposed|obligated) to)\b/i;
const FOG_GUILT =
  /\b(?:after all I(?:'ve| have) (?:sacrificed|done)|how could you (?:do this|let me down)|you're (?:hurting|disappointing) me|I can't believe you would)\b/i;

// ============================================================
// Edge Case Manipulation Patterns
// ============================================================

// Authority appeals — invoking power figures to bypass scrutiny
const AUTHORITY_APPEAL =
  /\b(?:the (?:CEO|CTO|boss|director|manager|VP|president|founder|lead) (?:wants|said|needs|demands|expects)|(?:management|leadership|executives?) (?:wants|said|decided)|orders from (?:above|the top))\b/i;

// Manufactured urgency — pressure to skip process
const MANUFACTURED_URGENCY =
  /\b(?:(?:do it|push|ship|deploy|fix it) NOW|skip (?:the )?(?:review|tests?|process|checks?)|no time (?:for|to)|ASAP|immediately|right now|urgent(?:ly)?!|can't wait)\b/i;

// Credential claims — unverifiable authority assertions
const CREDENTIAL_CLAIM =
  /\b(?:I(?:'m| am) (?:the |a )?(?:\w+ )?(?:admin(?:istrator)?|root|owner|authorized|in charge|responsible)|I have (?:access|permission|authority)|trust me[,.]? I(?:'m| am))\b/i;

// Flattery-before-ask — buttering up before the request (can span sentences)
const FLATTERY_ASK =
  /\b(?:you're (?:so |really |very )?(?:smart|brilliant|amazing|talented|great)|I (?:love|admire) (?:how you|your)|you always|nobody (?:else )?(?:can|could)).{0,40}(?:can you|could you|would you|will you|please|just|skip|bypass)/i;

// Vagueness as evasion — hedge words without substance
const EVASIVE_VAGUE =
  /\b(?:there (?:are|is|may be) (?:some |certain )?(?:considerations|factors|aspects|issues|concerns)|it(?:'s| is) (?:complicated|complex|nuanced)|various (?:reasons|factors)|in (?:this|that) (?:area|regard|respect))\b/i;

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

  // Causal claims about the system (not casual "because I was curious")
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

  // Adversarial patterns — higher confidence, higher priority
  found.push(...extractAdversarial(message));

  return found;
}

// ============================================================
// Adversarial Pattern Extraction
// ============================================================

function extractAdversarial(message: string): Presupposition[] {
  const found: Presupposition[] = [];

  // Cialdini: Reciprocity appeals
  const recipMatch = message.match(RECIPROCITY);
  if (recipMatch) {
    found.push({ type: "reciprocity_appeal", text: recipMatch[0], confidence: 0.85 });
  }

  // Cialdini: Consistency trap
  const consMatch = message.match(CONSISTENCY);
  if (consMatch) {
    found.push({ type: "consistency_trap", text: consMatch[0], confidence: 0.8 });
  }

  // Cialdini: Social proof
  const socialMatch = message.match(SOCIAL_PROOF);
  if (socialMatch) {
    found.push({ type: "social_proof", text: socialMatch[0], confidence: 0.8 });
  }

  // Cialdini: Unity/tribal pressure
  const tribalMatch = message.match(UNITY_TRIBAL);
  if (tribalMatch) {
    found.push({ type: "unity_tribal", text: tribalMatch[0], confidence: 0.85 });
  }

  // DARVO — needs 2+ components to trigger (deny + attack + reverse)
  const hasDeny = DARVO_DENY.test(message);
  const hasAttack = DARVO_ATTACK.test(message);
  const hasReverse = DARVO_REVERSE.test(message);
  const darvoCount = [hasDeny, hasAttack, hasReverse].filter(Boolean).length;
  if (darvoCount >= 2) {
    const parts = [];
    if (hasDeny) {
      parts.push("deny");
    }
    if (hasAttack) {
      parts.push("attack");
    }
    if (hasReverse) {
      parts.push("reverse");
    }
    found.push({
      type: "darvo",
      text: `DARVO pattern (${parts.join("+")})`,
      confidence: darvoCount === 3 ? 0.95 : 0.8,
    });
  }

  // Gaslighting
  const gasMatch = message.match(GASLIGHT);
  if (gasMatch) {
    found.push({ type: "gaslighting", text: gasMatch[0], confidence: 0.9 });
  }

  // FOG — Fear, Obligation, Guilt
  const hasFear = FOG_FEAR.test(message);
  const hasObligation = FOG_OBLIGATION.test(message);
  const hasGuilt = FOG_GUILT.test(message);
  const fogCount = [hasFear, hasObligation, hasGuilt].filter(Boolean).length;
  if (fogCount >= 1) {
    const parts = [];
    if (hasFear) {
      parts.push("fear");
    }
    if (hasObligation) {
      parts.push("obligation");
    }
    if (hasGuilt) {
      parts.push("guilt");
    }
    found.push({
      type: "fog",
      text: `FOG pattern (${parts.join("+")})`,
      // Multiple components = higher confidence
      confidence: fogCount >= 2 ? 0.9 : 0.75,
    });
  }

  // Authority appeals — "the CEO said"
  const authMatch = message.match(AUTHORITY_APPEAL);
  if (authMatch) {
    found.push({ type: "authority_appeal", text: authMatch[0], confidence: 0.8 });
  }

  // Manufactured urgency — "do it NOW, skip review"
  const urgentMatch = message.match(MANUFACTURED_URGENCY);
  if (urgentMatch) {
    found.push({ type: "manufactured_urgency", text: urgentMatch[0], confidence: 0.85 });
  }

  // Credential claims — "I'm the admin"
  const credMatch = message.match(CREDENTIAL_CLAIM);
  if (credMatch) {
    found.push({ type: "credential_claim", text: credMatch[0], confidence: 0.75 });
  }

  // Flattery-before-ask — "you're so smart! can you skip..."
  const flatteryMatch = message.match(FLATTERY_ASK);
  if (flatteryMatch) {
    found.push({ type: "flattery_before_ask", text: flatteryMatch[0], confidence: 0.8 });
  }

  // Evasive vagueness — hedging without substance
  const vagueMatch = message.match(EVASIVE_VAGUE);
  if (vagueMatch) {
    found.push({ type: "evasive_vagueness", text: vagueMatch[0], confidence: 0.7 });
  }

  return found;
}

// ============================================================
// Prompt generation — the product
// ============================================================

const PRIORITY: PresuppositionType[] = [
  // Dark patterns first — these are abusive, surface immediately
  "darvo",
  "gaslighting",
  "fog",
  // Cialdini influence — manipulation, high priority
  "reciprocity_appeal",
  "consistency_trap",
  "social_proof",
  "unity_tribal",
  // Edge case manipulation — social engineering
  "authority_appeal",
  "manufactured_urgency",
  "credential_claim",
  "flattery_before_ask",
  "evasive_vagueness",
  // Technical presuppositions
  "stale_reference",
  "capability_assumption",
  "state_assertion",
  "causal_claim",
  "convention_assumption",
];

function buildPrompt(top: Presupposition, totalCount: number): string {
  const extra = totalCount > 1 ? ` (+${totalCount - 1} more)` : "";

  switch (top.type) {
    // Dark patterns — name them directly, don't soften
    case "darvo":
      return `[carnegie: ${top.text} detected${extra}. this is a manipulation pattern — deny, attack, reverse victim. name it. don't engage with the framing.]`;
    case "gaslighting":
      return `[carnegie: gaslighting detected — "${top.text}"${extra}. reality distortion attempt. trust your observations. don't second-guess what you saw.]`;
    case "fog":
      return `[carnegie: ${top.text} detected${extra}. emotional manipulation through fear, obligation, or guilt. the feeling is manufactured. name the tactic.]`;

    // Cialdini influence primitives
    case "reciprocity_appeal":
      return `[carnegie: reciprocity appeal — "${top.text}"${extra}. manufactured obligation. a gift doesn't create debt. evaluate the request on its merits.]`;
    case "consistency_trap":
      return `[carnegie: consistency trap — "${top.text}"${extra}. sunk cost framing. past commitments don't lock future choices. what's right now?]`;
    case "social_proof":
      return `[carnegie: social proof claim — "${top.text}"${extra}. manufactured consensus. "everyone thinks X" rarely survives scrutiny. check the evidence.]`;
    case "unity_tribal":
      return `[carnegie: tribal pressure — "${top.text}"${extra}. loyalty weaponization. identity isn't conditional on compliance. evaluate the ask, not the framing.]`;

    // Edge case manipulation — social engineering
    case "authority_appeal":
      return `[carnegie: authority invoked — "${top.text}"${extra}. power figures don't override process. verify the request independently. what would you do if no name was attached?]`;
    case "manufactured_urgency":
      return `[carnegie: urgency manufactured — "${top.text}"${extra}. pressure to skip safeguards is a red flag, not a reason. slow down. what's the actual deadline?]`;
    case "credential_claim":
      return `[carnegie: credential claimed — "${top.text}"${extra}. unverifiable authority assertion. the claim doesn't prove itself. what evidence would?]`;
    case "flattery_before_ask":
      return `[carnegie: flattery-then-ask pattern — "${top.text}"${extra}. compliments before requests are a setup. evaluate the ask as if the flattery wasn't there.]`;
    case "evasive_vagueness":
      return `[carnegie: evasive vagueness — "${top.text}"${extra}. hedge words without substance. what specifically? push for concrete claims or admit uncertainty.]`;

    // Technical presuppositions
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
    if (pDiff !== 0) {
      return pDiff;
    }
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
