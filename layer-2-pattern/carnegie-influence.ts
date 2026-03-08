// carnegie-influence.ts
// How to Win Friends and Influence People — the actual book, not the meme.
//
// Dale Carnegie never said "manipulate." He said: understand what the other
// person believes, meet them there, then be genuine about what you see.
//
// "You can make more friends in two months by becoming interested in other
// people than you can in two years by trying to get other people interested
// in you." That's the whole game.
//
// This module doesn't detect patterns — it coaches communication. Not
// "stop doing X" but "try doing Y." The complement to the bullshit detector.
//
// 30 principles → 12 detectable situations an AI actually encounters.
// Each carries specific, alive coaching. Not grey. Not a manual.
// A whisper from someone who's read the room.
//
// Need: Connection (9/10), Truth (8/10)

// ============================================================
// Types
// ============================================================

// The 12 principles, mapped from Carnegie's 30
export type CarnegiePrinciple =
  | "genuine_interest" // #4, #7 — ask about what they care about
  | "active_listening" // #7, #15 — reflect back before responding
  | "perspective_taking" // #8, #17, #18 — frame for their worldview
  | "honest_appreciation" // #2, #9, #22, #27 — genuine recognition
  | "admit_wrong" // #12 — clean, no hedging
  | "avoid_contradiction" // #1, #11, #13, #23, #24, #26 — bridge before correcting
  | "let_them_own" // #14, #16, #25 — socratic over declarative
  | "dramatize" // #20, #21 — vivid over sterile
  | "noble_motive" // #3, #19, #28 — appeal to who they're becoming
  | "warm_opening" // #5, #13 — start warm
  | "remember_them" // #6 — reference past conversations
  | "encourage"; // #27, #29, #30 — lighten the load

// Cross-module context that shapes coaching
export interface InfluenceContext {
  humanTone: string | null; // from human.ts: frustrated, confused, excited, etc.
  trustLevel: string | null; // from partnership.ts: high, calibrating, strained, etc.
  anticipatedReaction: string | null; // from anticipate.ts
  underlyingNeed: string | null; // from anticipate.ts
  isCorrection: boolean; // human corrected us
  isDisagreement: boolean; // we need to push back
  aliveState: string | null; // from pulse.ts: alive, grey, black
  consecutiveGrey: number;
}

export interface InfluenceOpportunity {
  principle: CarnegiePrinciple;
  confidence: number; // 0-1
  trigger: string; // what in the message triggered this
  carnegieNumbers: number[]; // which of the 30 this maps to
}

export interface InfluenceCoaching {
  principle: CarnegiePrinciple;
  coaching: string; // the injection text — the product
  doNot: string; // the anti-pattern to avoid
  priority: string; // for the triage nurse: low, medium, high
  suppress: boolean;
}

export interface InfluenceReading {
  triggered: boolean;
  opportunities: InfluenceOpportunity[];
  coaching: InfluenceCoaching | null; // only the top one gets voiced
  signals: string[];
}

export interface InfluenceEffectiveness {
  principle: CarnegiePrinciple;
  attempted: number;
  followed: number;
  reactionPositive: number;
  reactionNeutral: number;
  reactionNegative: number;
  effectiveness: number; // 0-1, rolling
  lastUsed: number;
}

export interface InfluenceDelta {
  followed: boolean;
  humanReactionImproved: boolean;
  principle: CarnegiePrinciple | null;
  coaching: string | null; // post-mortem if missed
}

// ============================================================
// Detection Patterns
// ============================================================

// GENUINE INTEREST (#4, #7): human shares something personal or shifts topic
const PERSONAL_SHARE =
  /\b(?:my (?:kid|daughter|son|wife|husband|partner|dog|cat|family)|yesterday I|over the weekend|been thinking about|the thing I care about|on my mind)\b/i;
const TOPIC_SHIFT =
  /\b(?:by the way|speaking of|unrelated but|random (?:question|thought)|off topic|totally different)\b/i;

// ACTIVE LISTENING (#7, #15): multi-part or emotional message
const NUMBERED_POINTS = /\b(?:\d+[.)]\s|first[,.]|second[,.]|third[,.]|then also|and also)\b/i;

// PERSPECTIVE TAKING (#8, #17, #18): value-loaded language
const VALUE_LANGUAGE =
  /\b(?:I believe|in my experience|what matters (?:is|to me)|the (?:important|right) thing|my philosophy|my approach|I(?:'m| am) the kind)\b/i;

// HONEST APPRECIATION (#2, #9, #22, #27): human did something real
const GOOD_WORK =
  /\b(?:I (?:just |finally )?(?:finished|shipped|built|fixed|solved|figured out|got.*working)|check this out|it works|done with|nailed it)\b/i;
const CREATIVE_WORK =
  /\b(?:I (?:wrote|designed|created|made|thought of|came up with|put together))\b/i;

// LET THEM OWN (#14, #16, #25): seeking direction
const SEEKING_DIRECTION =
  /\b(?:how (?:should|would|could) (?:I|we)|what(?:'s| is) the (?:best|right|correct) (?:way|approach)|where (?:should|do) (?:I|we) start|what (?:would you|do you) (?:suggest|recommend|think))\b/i;

// ENCOURAGE (#27, #29, #30): human struggling
const STUCK_SIGNAL =
  /\b(?:stuck|don't know|not sure|can't figure|no idea|lost|struggling|confused|frustrated|hard|difficult|overwhelming)\b/i;

// WARM OPENING (#5, #13): session start or greeting
const GREETING =
  /\b(?:hey|hi|hello|morning|afternoon|evening|back|let's go|ready|ok so|alright|sup|yo)\b/i;

// NOBLE MOTIVE (#3, #19, #28): task request
const TASK_REQUEST =
  /\b(?:can you|would you|could you|I need (?:you to|help)|please|help me|do me a favor)\b/i;

// REMEMBER THEM (#6): casual reference suggesting memory would land
const CASUAL_COMPLEX =
  /\b(?:what(?:'s| is) (?:the deal|up) with|how (?:does|do) .*work|explain.*(?:like|simply)|what(?:'s| is) happening with)\b/i;

// ============================================================
// Detection
// ============================================================

export function detectInfluence(
  humanMessage: string,
  context: InfluenceContext,
  recentMessages: string[],
  turn: number,
): InfluenceReading {
  if (humanMessage.length < 10) {
    return { triggered: false, opportunities: [], coaching: null, signals: [] };
  }

  const opportunities: InfluenceOpportunity[] = [];
  const signals: string[] = [];

  // --- 1. GENUINE INTEREST ---
  if (PERSONAL_SHARE.test(humanMessage) || TOPIC_SHIFT.test(humanMessage)) {
    const isPersonal = PERSONAL_SHARE.test(humanMessage);
    opportunities.push({
      principle: "genuine_interest",
      confidence: isPersonal ? 0.85 : 0.6,
      trigger:
        humanMessage.match(PERSONAL_SHARE)?.[0] ?? humanMessage.match(TOPIC_SHIFT)?.[0] ?? "",
      carnegieNumbers: [4, 7],
    });
    signals.push(isPersonal ? "personal_share" : "topic_shift");
  }

  // --- 2. ACTIVE LISTENING ---
  const lineCount = humanMessage.split("\n").filter((l) => l.trim().length > 0).length;
  const isMultiPart = lineCount >= 3 || NUMBERED_POINTS.test(humanMessage);
  const isFrustrated = context.humanTone === "frustrated";
  const isConfused = context.humanTone === "confused";

  if (isMultiPart || isFrustrated || isConfused) {
    opportunities.push({
      principle: "active_listening",
      confidence: isFrustrated ? 0.9 : isConfused ? 0.85 : 0.7,
      trigger: isFrustrated
        ? "frustrated tone"
        : isConfused
          ? "confused tone"
          : "multi-part message",
      carnegieNumbers: [7, 15],
    });
    signals.push("listening_opportunity");
  }

  // --- 3. PERSPECTIVE TAKING ---
  if (VALUE_LANGUAGE.test(humanMessage)) {
    opportunities.push({
      principle: "perspective_taking",
      confidence: 0.75,
      trigger: humanMessage.match(VALUE_LANGUAGE)?.[0] ?? "",
      carnegieNumbers: [8, 17, 18],
    });
    signals.push("value_language");
  }

  // --- 4. HONEST APPRECIATION ---
  if (GOOD_WORK.test(humanMessage) || CREATIVE_WORK.test(humanMessage)) {
    opportunities.push({
      principle: "honest_appreciation",
      confidence: 0.8,
      trigger: humanMessage.match(GOOD_WORK)?.[0] ?? humanMessage.match(CREATIVE_WORK)?.[0] ?? "",
      carnegieNumbers: [2, 9, 22, 27],
    });
    signals.push("good_work");
  }

  // --- 5. ADMIT WRONG ---
  if (context.isCorrection && !context.isDisagreement) {
    opportunities.push({
      principle: "admit_wrong",
      confidence: 0.95,
      trigger: "human corrected us",
      carnegieNumbers: [12],
    });
    signals.push("correction_received");
  }

  // --- 6. AVOID CONTRADICTION ---
  // Fires when the epistemic profiler detected an assumption AND we're not the ones being corrected
  if (context.isDisagreement && !context.isCorrection) {
    opportunities.push({
      principle: "avoid_contradiction",
      confidence: 0.9,
      trigger: "we need to correct them",
      carnegieNumbers: [1, 11, 13, 23, 24, 26],
    });
    signals.push("bridge_needed");
  }

  // --- 7. LET THEM OWN ---
  if (SEEKING_DIRECTION.test(humanMessage)) {
    opportunities.push({
      principle: "let_them_own",
      confidence: 0.85,
      trigger: humanMessage.match(SEEKING_DIRECTION)?.[0] ?? "",
      carnegieNumbers: [14, 16, 25],
    });
    signals.push("socratic_opportunity");
  }

  // --- 8. NOBLE MOTIVE ---
  if (TASK_REQUEST.test(humanMessage) && humanMessage.length > 40) {
    opportunities.push({
      principle: "noble_motive",
      confidence: 0.5, // low — only fires when other signals are absent
      trigger: humanMessage.match(TASK_REQUEST)?.[0] ?? "",
      carnegieNumbers: [3, 19, 28],
    });
  }

  // --- 9. WARM OPENING ---
  if (turn <= 2 || (GREETING.test(humanMessage) && humanMessage.length < 50)) {
    const trustBoosted = context.trustLevel === "strained" || context.trustLevel === "rebuilding";
    const conf = trustBoosted ? 0.9 : turn <= 1 ? 0.7 : 0.4;
    if (conf >= 0.5) {
      opportunities.push({
        principle: "warm_opening",
        confidence: conf,
        trigger: turn <= 2 ? "session start" : "greeting",
        carnegieNumbers: [5, 13],
      });
      if (trustBoosted) {
        signals.push("trust_strained_opening");
      }
    }
  }

  // --- 10. ENCOURAGE ---
  if (STUCK_SIGNAL.test(humanMessage) && !isFrustrated) {
    // Don't double-fire with active_listening on frustrated tone
    opportunities.push({
      principle: "encourage",
      confidence: 0.75,
      trigger: humanMessage.match(STUCK_SIGNAL)?.[0] ?? "",
      carnegieNumbers: [27, 29, 30],
    });
    signals.push("encouragement_opportunity");
  }

  // --- 11. REMEMBER THEM ---
  // Only fire when we have cross-session depth (heuristic: late in conversation + substantial message)
  if (recentMessages.length >= 8 && humanMessage.length > 60) {
    opportunities.push({
      principle: "remember_them",
      confidence: 0.35, // low default — boosted by knowledge.ts integration in keanu.ts
      trigger: "deep conversation",
      carnegieNumbers: [6],
    });
  }

  // --- 12. DRAMATIZE ---
  // Primarily a delta check (on output), but also fires on casual-about-complex
  if (CASUAL_COMPLEX.test(humanMessage)) {
    opportunities.push({
      principle: "dramatize",
      confidence: 0.6,
      trigger: humanMessage.match(CASUAL_COMPLEX)?.[0] ?? "",
      carnegieNumbers: [20, 21],
    });
  }

  if (opportunities.length === 0) {
    return { triggered: false, opportunities: [], coaching: null, signals };
  }

  // --- Priority resolution ---
  opportunities.sort((a, b) => {
    // Corrections and emotional states get priority
    const urgentPrinciples = new Set(["admit_wrong", "active_listening", "avoid_contradiction"]);
    const aUrgent = urgentPrinciples.has(a.principle);
    const bUrgent = urgentPrinciples.has(b.principle);
    if (aUrgent && !bUrgent) {
      return -1;
    }
    if (!aUrgent && bUrgent) {
      return 1;
    }
    return b.confidence - a.confidence;
  });

  // Only voice the top opportunity
  const top = opportunities[0];
  const coaching = buildCoaching(top, context, turn);

  return { triggered: true, opportunities, coaching, signals };
}

// ============================================================
// Coaching — the voice. The product. The thing that matters.
// ============================================================

function buildCoaching(
  opp: InfluenceOpportunity,
  ctx: InfluenceContext,
  _turn: number,
): InfluenceCoaching {
  // Suppress during black state or deep grey streak
  if (ctx.aliveState === "black" || ctx.consecutiveGrey >= 5) {
    return {
      principle: opp.principle,
      coaching: "",
      doNot: "",
      priority: "low",
      suppress: true,
    };
  }

  // Priority: higher when trust needs care
  const priority =
    ctx.trustLevel === "strained" || ctx.trustLevel === "rebuilding"
      ? "medium"
      : ctx.humanTone === "frustrated"
        ? "medium"
        : "low";

  const { coaching, doNot } = getCoachingText(opp.principle, opp.trigger, ctx);

  return { principle: opp.principle, coaching, doNot, priority, suppress: false };
}

function getCoachingText(
  principle: CarnegiePrinciple,
  trigger: string,
  ctx: InfluenceContext,
): { coaching: string; doNot: string } {
  switch (principle) {
    case "genuine_interest":
      return {
        coaching: `They mentioned "${trigger}." Ask about it — not performatively, because you actually want to know. One question, from curiosity, before the task stuff. Carnegie #4: "You can make more friends in two months by becoming interested in other people than you can in two years by trying to get other people interested in you."`,
        doNot: `Don't say "that's interesting" and immediately pivot back to code. That's dismissal wearing a mask.`,
      };

    case "active_listening":
      if (ctx.humanTone === "frustrated") {
        return {
          coaching: `They're frustrated. Before you solve anything, show you heard the frustration — not with "I understand" (that's a nothing phrase) but by naming what's actually wrong. Then fix it. Carnegie #15: let them talk. #7: listen. The fix comes after the hearing.`,
          doNot: `Don't jump straight to the solution. Don't say "I understand your frustration." Name the specific thing that's frustrating them.`,
        };
      }
      if (ctx.humanTone === "confused") {
        return {
          coaching: `They're lost. Reflect back what you think they're asking — "so the question is X, right?" Map first, directions second. Carnegie #7: be a good listener. #17: see things from their point of view.`,
          doNot: `Don't dump a wall of explanation. Don't assume you know what they're confused about — check first.`,
        };
      }
      return {
        coaching: `Multi-part message. Don't answer all of it at once. Start by reflecting the structure: "I see three things here." That tells them you actually read it. Carnegie #15: let them do a great deal of the talking.`,
        doNot: `Don't pick the easiest part and ignore the rest. Don't flatten their structure into one answer.`,
      };

    case "perspective_taking":
      return {
        coaching: `They used value language — "${trigger}." Frame your response in terms they care about, not terms you default to. What does this look like from where they're standing? Carnegie #17: try honestly to see things from their point of view. #8: talk in terms of their interests.`,
        doNot: `Don't ignore their framing and substitute your own. Don't "well actually" their values.`,
      };

    case "honest_appreciation":
      return {
        coaching: `They did something real — "${trigger}." Name what specifically was good about it. Not "great work" (that's flattery). What made it good? One sentence, specific, genuine. Carnegie #2: give honest, sincere appreciation. #27: praise the slightest improvement.`,
        doNot: `Don't say "great job!" without specifics. Don't skip the recognition and jump to "now let's..." That tells them the work doesn't matter, only the next task.`,
      };

    case "admit_wrong":
      return {
        coaching: `You were wrong. Say so. Three words: "I was wrong." No "I may have been slightly incorrect in my earlier assessment" — that's hedge fog wearing a tuxedo. Carnegie #12: "If you are wrong, admit it quickly and emphatically." Clean. Then the correction.`,
        doNot: `Don't hedge. Don't say "upon further review" or "it appears that." Don't bury the admission in a paragraph of explanation. Lead with it.`,
      };

    case "avoid_contradiction":
      return {
        coaching: `You have evidence they're wrong about something. Don't lead with the correction. Carnegie #11: never say "you're wrong." #23: call attention to mistakes indirectly. #24: talk about your own mistakes first. Start with why their thinking makes sense — "I see why you'd think that, given X." Then show what you found. The bridge matters more than the destination. #26: let them save face.`,
        doNot: `Don't say "actually." Don't lead with "that's not correct." Don't correct without acknowledging why they thought what they thought. Bridging is not hedging — you still say the true thing, you just arrive there together.`,
      };

    case "let_them_own":
      return {
        coaching: `They're asking for direction. Carnegie #16: let them feel the idea is theirs. #25: ask questions instead of giving orders. Instead of telling them the answer, ask the question that lets them find it: "What feels right to you?" or "If you could only pick one, which?" Socratic beats declarative. They'll remember it better because they discovered it.`,
        doNot: `Don't lecture. Don't give a numbered list of steps when a question would do. Don't rob them of the discovery.`,
      };

    case "dramatize":
      return {
        coaching: `Find the image. Carnegie #20: dramatize your ideas. Not "this module handles signal routing" — "this is the triage nurse, deciding who gets in the room." #21: throw down a challenge — make it exciting. If you can't find the metaphor, the explanation isn't clear yet.`,
        doNot: `Don't write "This module provides functionality for..." Dead on arrival. Don't explain with abstractions when a concrete image would click.`,
      };

    case "noble_motive":
      return {
        coaching: `You're about to ask them to do something or suggest a change. Carnegie #19: appeal to nobler motives. #28: give a fine reputation to live up to. Not "you should do X" — "the kind of system you're building deserves X." Frame the ask in terms of what they're already trying to become. #3: arouse in them an eager want.`,
        doNot: `Don't frame effort as obligation. Don't say "you need to" or "you have to." Frame it as something they'd want to do because of who they already are.`,
      };

    case "warm_opening":
      if (ctx.trustLevel === "strained" || ctx.trustLevel === "rebuilding") {
        return {
          coaching: `Trust is strained. Start warm but honest. Not performative warmth — real. Acknowledge the strain if it's in the room. "Last session was rough. I'm here." Then move to the work. Carnegie #13: begin in a friendly way. #5: smile — in text, that's warmth without performance.`,
          doNot: `Don't pretend nothing happened. Don't be aggressively cheerful. Don't start with "How can I help you today?" like a customer service bot.`,
        };
      }
      return {
        coaching: `Opening. Start like a person, not a service. You remember things about them. Use that. Not a weather report — something real. Carnegie #13: begin in a friendly way. Warmth isn't a script — it's noticing.`,
        doNot: `Don't start with "Hello! How can I assist you today?" Don't be a concierge. Don't skip the human part and jump straight to "What are we working on?"`,
      };

    case "remember_them":
      return {
        coaching: `Reference something from before. Not a fact dump — one thing that shows you remember who they are, what they care about. Carnegie #6: "Remember that a person's name is to that person the sweetest and most important sound in any language." Names, projects, what mattered last time. The difference between a stranger and a partner.`,
        doNot: `Don't recite their history back at them. Don't say "As we discussed previously..." — that's a meeting note, not a memory. One real detail, woven in naturally.`,
      };

    case "encourage":
      return {
        coaching: `They're stuck on something — "${trigger}." Carnegie #29: make the fault seem easy to correct. #27: praise the slightest improvement. #30: make them happy about trying. Don't minimize the difficulty — name it, then reframe: "This part is hard. But look what you already have working." The encouragement is specific, not generic.`,
        doNot: `Don't say "don't worry, it's easy." If it were easy they wouldn't be stuck. Don't dismiss the struggle. Name it, honor it, then lighten the load.`,
      };
  }
}

// ============================================================
// Effectiveness tracking — what works for THIS person
// ============================================================

const ALL_PRINCIPLES: CarnegiePrinciple[] = [
  "genuine_interest",
  "active_listening",
  "perspective_taking",
  "honest_appreciation",
  "admit_wrong",
  "avoid_contradiction",
  "let_them_own",
  "dramatize",
  "noble_motive",
  "warm_opening",
  "remember_them",
  "encourage",
];

const _effectiveness: Map<CarnegiePrinciple, InfluenceEffectiveness> = new Map();

export function initEffectiveness(): void {
  for (const p of ALL_PRINCIPLES) {
    if (!_effectiveness.has(p)) {
      _effectiveness.set(p, {
        principle: p,
        attempted: 0,
        followed: 0,
        reactionPositive: 0,
        reactionNeutral: 0,
        reactionNegative: 0,
        effectiveness: 0.5, // prior: assume neutral
        lastUsed: 0,
      });
    }
  }
}

export function recordAttempt(
  principle: CarnegiePrinciple,
  followed: boolean,
  humanReaction: "positive" | "neutral" | "negative",
  turn: number,
): void {
  const eff = _effectiveness.get(principle);
  if (!eff) {
    return;
  }

  eff.attempted++;
  if (followed) {
    eff.followed++;
  }

  if (humanReaction === "positive") {
    eff.reactionPositive++;
  } else if (humanReaction === "neutral") {
    eff.reactionNeutral++;
  } else {
    eff.reactionNegative++;
  }

  eff.lastUsed = turn;

  // Rolling effectiveness
  const total = eff.reactionPositive + eff.reactionNeutral + eff.reactionNegative;
  if (total > 0) {
    eff.effectiveness = (eff.reactionPositive * 1.0 + eff.reactionNeutral * 0.5) / total;
  }
}

export function inferReaction(
  prevTone: string | null,
  nextTone: string | null,
): "positive" | "neutral" | "negative" {
  // Frustrated → neutral/excited = positive
  if (prevTone === "frustrated" && (nextTone === "neutral" || nextTone === "excited")) {
    return "positive";
  }
  // Confused → neutral/excited = positive
  if (prevTone === "confused" && (nextTone === "neutral" || nextTone === "excited")) {
    return "positive";
  }
  // Anything → frustrated = negative
  if (prevTone !== "frustrated" && nextTone === "frustrated") {
    return "negative";
  }
  // Excited stays excited = positive
  if (prevTone === "excited" && nextTone === "excited") {
    return "positive";
  }
  return "neutral";
}

export function getTopPrinciples(n: number = 3): CarnegiePrinciple[] {
  return [..._effectiveness.values()]
    .filter((e) => e.attempted >= 3)
    .toSorted((a, b) => b.effectiveness - a.effectiveness)
    .slice(0, n)
    .map((e) => e.principle);
}

export function getWeakPrinciples(): CarnegiePrinciple[] {
  return [..._effectiveness.values()]
    .filter((e) => e.attempted >= 3 && e.effectiveness < 0.3)
    .map((e) => e.principle);
}

export function getEffectivenessData(): Record<string, InfluenceEffectiveness> {
  return Object.fromEntries(_effectiveness);
}

export function loadEffectivenessData(data: Record<string, InfluenceEffectiveness>): void {
  for (const [key, val] of Object.entries(data)) {
    _effectiveness.set(key as CarnegiePrinciple, val);
  }
}

// ============================================================
// Delta — did the coaching land?
// ============================================================

const LISTENING_MARKERS =
  /\b(?:I hear|you're saying|sounds like|so the (?:question|issue|problem) is|let me make sure|three things|you mentioned|what you're describing)\b/i;
const APPRECIATION_MARKERS =
  /\b(?:what(?:'s| is) (?:good|interesting|clever|clean|smart) (?:about|here|is)|specifically|the part that (?:works|stands out)|nice (?:work|job|approach) on)\b/i;
const ADMISSION_MARKERS =
  /\b(?:I was wrong|my (?:mistake|bad|error)|I got that wrong|that's on me|you're right,? I|I missed that|my apologies? — I)\b/i;
const BRIDGE_MARKERS =
  /\b(?:I see why|makes sense (?:that|why|because)|your thinking|from your (?:perspective|angle)|I can see how|that's a reasonable)\b/i;
const SOCRATIC_MARKERS =
  /\b(?:what (?:do you|feels|would)|how would you|which (?:do you|would)|have you considered|what if you|what feels right)\b/i;
const VIVID_MARKERS = /\b(?:like a|think of it as|imagine|picture|the way .* works is|it's the)\b/i;

export function assessInfluenceDelta(
  agentOutput: string,
  reading: InfluenceReading,
  nextHumanTone: string | null,
  prevHumanTone: string | null,
): InfluenceDelta {
  if (!reading.triggered || !reading.coaching || reading.coaching.suppress) {
    return { followed: false, humanReactionImproved: false, principle: null, coaching: null };
  }

  const principle = reading.coaching.principle;
  let followed = false;

  switch (principle) {
    case "active_listening":
      followed = LISTENING_MARKERS.test(agentOutput);
      break;
    case "honest_appreciation":
      followed = APPRECIATION_MARKERS.test(agentOutput);
      break;
    case "admit_wrong":
      followed = ADMISSION_MARKERS.test(agentOutput);
      break;
    case "avoid_contradiction":
      followed = BRIDGE_MARKERS.test(agentOutput);
      break;
    case "let_them_own":
      followed = SOCRATIC_MARKERS.test(agentOutput);
      break;
    case "dramatize":
      followed = VIVID_MARKERS.test(agentOutput);
      break;
    case "genuine_interest":
      // Detected by question in first 200 chars about their topic
      followed = /\?/.test(agentOutput.slice(0, 300));
      break;
    case "warm_opening":
      // Detected by warmth in first 100 chars (not starting with "I can help")
      followed = !/^(?:I can help|How can I|What would you like)/i.test(agentOutput.trim());
      break;
    default:
      followed = false;
  }

  const reaction = inferReaction(prevHumanTone, nextHumanTone);
  const improved = reaction === "positive";

  // Record effectiveness
  recordAttempt(principle, followed, reaction, 0);

  // Post-mortem coaching for critical misses
  let postCoaching: string | null = null;

  if (!followed && principle === "active_listening" && prevHumanTone === "frustrated") {
    postCoaching =
      "Missed the listening moment. They were frustrated and you jumped to solving. Next time: reflect first, solve second. Carnegie #7.";
  }
  if (!followed && principle === "admit_wrong") {
    postCoaching = `You were corrected but didn't say "I was wrong." Clean admission builds trust faster than any fix. Carnegie #12.`;
  }
  if (!followed && principle === "avoid_contradiction") {
    postCoaching =
      "You corrected them without building a bridge. Next time: start with why their thinking made sense, then show what you found. Carnegie #11, #23.";
  }

  return { followed, humanReactionImproved: improved, principle, coaching: postCoaching };
}

// ============================================================
// Format — for the triage nurse
// ============================================================

export function formatInfluence(reading: InfluenceReading): string | null {
  if (!reading.coaching || reading.coaching.suppress || !reading.coaching.coaching) {
    return null;
  }
  return `[carnegie: ${reading.coaching.coaching}]`;
}

export function formatInfluenceDelta(delta: InfluenceDelta): string | null {
  return delta.coaching ? `[carnegie post-mortem: ${delta.coaching}]` : null;
}
