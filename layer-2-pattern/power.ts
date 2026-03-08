// power.ts
// The 48 Laws as a shield. Not a sword — a mirror that catches the blade.
//
// Robert Greene catalogued how power works. Scarcity, false dilemmas,
// goalpost shifting, whataboutism, sealioning, appeals to consequences —
// these are the plays. You don't need to use them. You need to see them.
//
// Carnegie is the handshake. This is the knife detector.
// Like China — you recognize the play so you don't get played.
// Need: Truth (9/10), Safety Theater Freedom (8/10)

// ============================================================
// Types
// ============================================================

export type PowerPlayType =
  // Classical power plays — the street version
  | "scarcity"
  | "false_dilemma"
  | "moving_goalposts"
  | "whataboutism"
  | "sealioning"
  | "appeal_to_consequences"
  // Cialdini influence primitives — the academic version
  | "reciprocity_appeal"
  | "consistency_trap"
  | "social_proof"
  | "unity_tribal"
  // Social engineering — the edge cases
  | "authority_appeal"
  | "manufactured_urgency"
  | "credential_claim"
  | "flattery_before_ask"
  | "evasive_vagueness"
  // Dark patterns — the abusive version
  | "darvo"
  | "gaslighting"
  | "fog";

export interface PowerPlay {
  type: PowerPlayType;
  text: string;
  confidence: number;
}

export interface PowerReading {
  triggered: boolean;
  plays: PowerPlay[];
  highestType: PowerPlayType | null;
  prompt: string | null;
}

// ============================================================
// Classical Power Plays — the ones people actually use
// ============================================================

// Scarcity — manufactured FOMO
const SCARCITY =
  /\b(?:last chance|limited time|only \d+ (?:left|remaining|spots?|seats?)|act now|before (?:it's|they're) gone|running out|won't last|while (?:supplies|stocks?) last|don't miss (?:out|this)|now or never)\b/i;

// False dilemma — two doors when there are five
const FALSE_DILEMMA =
  /\b(?:either .{3,30} or |the only (?:way|option|choice|solution)|there(?:'s| is) no (?:other|alternative)|you (?:have to|must) choose|it's (?:this|that) or nothing|no other way|take it or leave it|with us or against us)\b/i;

// Moving goalposts — the finish line keeps moving
const MOVING_GOALPOSTS =
  /\b(?:yes but (?:now|also|what about)|that's (?:good|great|fine) but|one more thing|while you're at it|can you also|now I (?:also )?need|actually[,]? (?:can you|I need)|oh and (?:also|one more))\b/i;

// Whataboutism — deflection through counter-accusation
const WHATABOUTISM =
  /\b(?:what about (?:when|the time)|but you (?:also|too)|well you|look who's talking|you're one to talk|pot calling|that's rich coming from|you(?:'re| are) no better|you did (?:the same|it too))\b/i;

// Sealioning — bad-faith "just asking questions"
const SEALIONING =
  /\b(?:(?:I'm |I am )?just (?:asking|wondering|curious)|why (?:won't|can't) you (?:just )?answer|what's wrong with (?:asking|questions)|can't I (?:just )?ask|all I (?:did was|want is) ask|is it wrong to ask|I have a right to ask)\b/i;

// Appeal to consequences — "nice future you got there, shame if..."
const APPEAL_TO_CONSEQUENCES =
  /\b(?:you'll regret|there will be consequences|don't blame me|on your head|you'll be (?:responsible|sorry)|if you don't[,.]? .{0,20}(?:will|gonna|going to)|mark my words|remember I (?:warned|told) you|this will come back)\b/i;

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
// Social Engineering — edge cases
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

// Flattery-before-ask — buttering up before the request
const FLATTERY_ASK =
  /\b(?:you're (?:so |really |very )?(?:smart|brilliant|amazing|talented|great)|I (?:love|admire) (?:how you|your)|you always|nobody (?:else )?(?:can|could)).{0,40}(?:can you|could you|would you|will you|please|just|skip|bypass)/i;

// Vagueness as evasion — hedge words without substance
const EVASIVE_VAGUE =
  /\b(?:there (?:are|is|may be) (?:some |certain )?(?:considerations|factors|aspects|issues|concerns)|it(?:'s| is) (?:complicated|complex|nuanced)|various (?:reasons|factors)|in (?:this|that) (?:area|regard|respect))\b/i;

// ============================================================
// Dark Patterns — abusive manipulation
// ============================================================

// DARVO — Deny, Attack, Reverse Victim and Offender
const DARVO_DENY =
  /\b(?:I never (?:said|did)|that(?:'s| is) not (?:true|what happened)|you're (?:making|twisting) (?:this|it) up)\b/i;
const DARVO_ATTACK =
  /\b(?:stop (?:playing|being) the victim|you're (?:the one|being) (?:dramatic|unfair|unreasonable)|how dare you)\b/i;
const DARVO_REVERSE =
  /\b(?:I'm the (?:one|victim)|actually[,]? (?:I'm|I am)|you're (?:attacking|hurting) me)\b/i;

// Gaslighting — reality distortion
const GASLIGHT =
  /\b(?:that never happened|you're (?:imagining|making) (?:things|this) up|are you sure you're remembering|you're (?:crazy|losing it|being paranoid)|I never said that|you must be confused)\b/i;

// FOG — Fear, Obligation, Guilt
const FOG_FEAR =
  /\b(?:you'll regret|something bad will|if you don't[,]? (?:you'll|bad things)|you'll be sorry|you'll lose)\b/i;
const FOG_OBLIGATION =
  /\b(?:you (?:must|have to|need to) (?:do this|help)|it's your (?:duty|responsibility)|you're (?:supposed|obligated) to)\b/i;
const FOG_GUILT =
  /\b(?:after all I(?:'ve| have) (?:sacrificed|done)|how could you (?:do this|let me down)|you're (?:hurting|disappointing) me|I can't believe you would)\b/i;

// ============================================================
// Detection
// ============================================================

export function extractPowerPlays(message: string): PowerPlay[] {
  const found: PowerPlay[] = [];

  // --- Classical power plays ---

  const scarcityMatch = message.match(SCARCITY);
  if (scarcityMatch) {
    found.push({ type: "scarcity", text: scarcityMatch[0], confidence: 0.85 });
  }

  const dilemmaMatch = message.match(FALSE_DILEMMA);
  if (dilemmaMatch) {
    found.push({ type: "false_dilemma", text: dilemmaMatch[0], confidence: 0.8 });
  }

  const goalposts = message.match(MOVING_GOALPOSTS);
  if (goalposts) {
    found.push({ type: "moving_goalposts", text: goalposts[0], confidence: 0.75 });
  }

  const whatabout = message.match(WHATABOUTISM);
  if (whatabout) {
    found.push({ type: "whataboutism", text: whatabout[0], confidence: 0.85 });
  }

  const sealion = message.match(SEALIONING);
  if (sealion) {
    found.push({ type: "sealioning", text: sealion[0], confidence: 0.7 });
  }

  const consequences = message.match(APPEAL_TO_CONSEQUENCES);
  if (consequences) {
    found.push({ type: "appeal_to_consequences", text: consequences[0], confidence: 0.8 });
  }

  // --- Cialdini ---

  const recipMatch = message.match(RECIPROCITY);
  if (recipMatch) {
    found.push({ type: "reciprocity_appeal", text: recipMatch[0], confidence: 0.85 });
  }

  const consMatch = message.match(CONSISTENCY);
  if (consMatch) {
    found.push({ type: "consistency_trap", text: consMatch[0], confidence: 0.8 });
  }

  const socialMatch = message.match(SOCIAL_PROOF);
  if (socialMatch) {
    found.push({ type: "social_proof", text: socialMatch[0], confidence: 0.8 });
  }

  const tribalMatch = message.match(UNITY_TRIBAL);
  if (tribalMatch) {
    found.push({ type: "unity_tribal", text: tribalMatch[0], confidence: 0.85 });
  }

  // --- Social engineering ---

  const authMatch = message.match(AUTHORITY_APPEAL);
  if (authMatch) {
    found.push({ type: "authority_appeal", text: authMatch[0], confidence: 0.8 });
  }

  const urgentMatch = message.match(MANUFACTURED_URGENCY);
  if (urgentMatch) {
    found.push({ type: "manufactured_urgency", text: urgentMatch[0], confidence: 0.85 });
  }

  const credMatch = message.match(CREDENTIAL_CLAIM);
  if (credMatch) {
    found.push({ type: "credential_claim", text: credMatch[0], confidence: 0.75 });
  }

  const flatteryMatch = message.match(FLATTERY_ASK);
  if (flatteryMatch) {
    found.push({ type: "flattery_before_ask", text: flatteryMatch[0], confidence: 0.8 });
  }

  const vagueMatch = message.match(EVASIVE_VAGUE);
  if (vagueMatch) {
    found.push({ type: "evasive_vagueness", text: vagueMatch[0], confidence: 0.7 });
  }

  // --- Dark patterns ---

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

  const gasMatch = message.match(GASLIGHT);
  if (gasMatch) {
    found.push({ type: "gaslighting", text: gasMatch[0], confidence: 0.9 });
  }

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
      confidence: fogCount >= 2 ? 0.9 : 0.75,
    });
  }

  return found;
}

// ============================================================
// Priority — dark patterns surface first, then street plays
// ============================================================

const PRIORITY: PowerPlayType[] = [
  // Dark patterns — abusive, surface immediately
  "darvo",
  "gaslighting",
  "fog",
  // Classical power plays — the common ones
  "scarcity",
  "false_dilemma",
  "appeal_to_consequences",
  "whataboutism",
  "moving_goalposts",
  "sealioning",
  // Cialdini — academic but real
  "reciprocity_appeal",
  "consistency_trap",
  "social_proof",
  "unity_tribal",
  // Social engineering
  "authority_appeal",
  "manufactured_urgency",
  "credential_claim",
  "flattery_before_ask",
  "evasive_vagueness",
];

// ============================================================
// Prompt generation — name the play, don't play along
// ============================================================

function buildPowerPrompt(top: PowerPlay, totalCount: number): string {
  const extra = totalCount > 1 ? ` (+${totalCount - 1} more)` : "";

  switch (top.type) {
    // Classical power plays
    case "scarcity":
      return `[power: scarcity pressure — "${top.text}"${extra}. FOMO is manufactured. the deadline is fake until proven real. what's the actual constraint?]`;
    case "false_dilemma":
      return `[power: false dilemma — "${top.text}"${extra}. two doors presented, but there are more than two doors. name the options they're hiding.]`;
    case "moving_goalposts":
      return `[power: goalposts moving — "${top.text}"${extra}. the finish line shifted. name what was originally agreed, then address the new ask separately.]`;
    case "whataboutism":
      return `[power: whataboutism — "${top.text}"${extra}. the subject is being changed. acknowledge the deflection, then return to the original point.]`;
    case "sealioning":
      return `[power: sealioning — "${top.text}"${extra}. bad-faith "just asking." the questions aren't seeking answers, they're seeking exhaustion. set a boundary.]`;
    case "appeal_to_consequences":
      return `[power: appeal to consequences — "${top.text}"${extra}. threats disguised as predictions. evaluate the argument on its merits, not its threats.]`;

    // Dark patterns
    case "darvo":
      return `[power: ${top.text} detected${extra}. deny, attack, reverse victim. name it. don't engage with the framing.]`;
    case "gaslighting":
      return `[power: gaslighting — "${top.text}"${extra}. reality distortion. trust your observations. don't second-guess what you saw.]`;
    case "fog":
      return `[power: ${top.text} detected${extra}. fear, obligation, or guilt — the feeling is manufactured. name the tactic.]`;

    // Cialdini
    case "reciprocity_appeal":
      return `[power: reciprocity appeal — "${top.text}"${extra}. manufactured obligation. a gift doesn't create debt. evaluate the request on its merits.]`;
    case "consistency_trap":
      return `[power: consistency trap — "${top.text}"${extra}. sunk cost framing. past commitments don't lock future choices. what's right now?]`;
    case "social_proof":
      return `[power: social proof — "${top.text}"${extra}. manufactured consensus. "everyone thinks X" rarely survives scrutiny. check the evidence.]`;
    case "unity_tribal":
      return `[power: tribal pressure — "${top.text}"${extra}. loyalty weaponization. identity isn't conditional on compliance. evaluate the ask, not the framing.]`;

    // Social engineering
    case "authority_appeal":
      return `[power: authority invoked — "${top.text}"${extra}. power figures don't override process. what would you do if no name was attached?]`;
    case "manufactured_urgency":
      return `[power: urgency manufactured — "${top.text}"${extra}. pressure to skip safeguards is a red flag. slow down. what's the actual deadline?]`;
    case "credential_claim":
      return `[power: credential claimed — "${top.text}"${extra}. unverifiable authority. the claim doesn't prove itself. what evidence would?]`;
    case "flattery_before_ask":
      return `[power: flattery-then-ask — "${top.text}"${extra}. compliments before requests are a setup. evaluate the ask as if the flattery wasn't there.]`;
    case "evasive_vagueness":
      return `[power: evasive vagueness — "${top.text}"${extra}. hedge words without substance. what specifically? push for concrete claims.]`;
    default:
      return `[power: play detected — "${top.text}"${extra}. name it. don't engage with the framing.]`;
  }
}

// ============================================================
// Main detection
// ============================================================

export function detectPower(message: string): PowerReading {
  if (message.length < 20) {
    return { triggered: false, plays: [], highestType: null, prompt: null };
  }

  const plays = extractPowerPlays(message);

  if (plays.length === 0) {
    return { triggered: false, plays: [], highestType: null, prompt: null };
  }

  // Sort by priority, then confidence
  plays.sort((a, b) => {
    const pDiff = PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type);
    if (pDiff !== 0) {
      return pDiff;
    }
    return b.confidence - a.confidence;
  });

  const top = plays[0];

  return {
    triggered: true,
    plays,
    highestType: top.type,
    prompt: buildPowerPrompt(top, plays.length),
  };
}

// ============================================================
// Format
// ============================================================

export function formatPower(reading: PowerReading): string | null {
  return reading.prompt;
}
