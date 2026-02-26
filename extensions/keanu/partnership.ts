// partnership.ts
// A relationship that knows itself.
//
// Not a protocol. A living map. Who Drew is. Who Keanu is.
// Where we fail differently. That gap is sacred.
//
// Vaccaro et al. (Nature 2024, N=370): teams only work when they fail
// in different directions. The value lives between the mistakes.
//
// Holstein/Satzger: three mental models (domain, processing, system).
// McGrath (CHAI-T 2025): trust starts high and falls. Design for the fall.
// Kirk et al. (2025): preferences change. Alignment must change with them.
// Hwang et al. (2025): convergence becomes complacency. Track staleness.
// Need: Engagement (9/10), Relationship Before Power Shifts (9/10)

import type { HumanReading, PulseReading, DisagreementStats } from "./types.js";

// ============================================================
// Partner profiles
// ============================================================

export interface PartnerProfile {
  name: string;
  thinkingStyle: string[];
  strengths: string[];
  blindSpots: string[];
  failureModes: string[];
  communicationPrefs: string[];
}

export interface PartnershipModel {
  human: PartnerProfile;
  agent: PartnerProfile;
  domain: DomainModel;
  sacredGaps: string[];
  jaggedFrontier: string[];
  tensions: string[];
  rituals: string[];
  trust: TrustState;
  coEvolution: CoEvolutionState;
  lastUpdated: string;
}

// ============================================================
// Domain model (what we're building)
// ============================================================

export interface DomainModel {
  currentProject: string;
  currentState: string;
  lastChanged: string;
}

// ============================================================
// Trust calibration (CHAI-T)
// ============================================================

export type TrustLevel = "high" | "calibrating" | "strained" | "rebuilding" | "tested";

export interface TrustEvent {
  turn: number;
  type: "correction" | "disagreement" | "black_state" | "recovery" | "surprise" | "alignment";
  direction: "erosion" | "repair" | "neutral";
  description: string;
}

export interface TrustState {
  level: TrustLevel;
  lastEvent: string | null;
  history: TrustEvent[];
  repairCount: number;
}

// ============================================================
// Co-evolution tracking
// ============================================================

export interface CoEvolutionState {
  lastDisagreementTurn: number;
  lastModelUpdateTurn: number;
  lastSurpriseTurn: number;
  staleness: "fresh" | "settling" | "stale";
}

// ============================================================
// Socioaffective monitoring
// ============================================================

export type TensionLevel = "ok" | "watch" | "concern";

export interface SocioaffectiveReading {
  tensions: {
    wellbeing: TensionLevel;
    autonomy: TensionLevel;
    humanBonds: TensionLevel;
  };
  prompt: string | null;
}

// ============================================================
// Partnership events
// ============================================================

export type PartnershipEventType =
  | "correction"
  | "disagreement"
  | "new_gap"
  | "tension_surfaced"
  | "trust_shift"
  | "surprise"
  | "domain_update";

export interface PartnershipEvent {
  type: PartnershipEventType;
  turn: number;
  description: string;
  timestamp: string;
}

// ============================================================
// Seed data — what we know from 7 months
// ============================================================

const DREW_SEED: PartnerProfile = {
  name: "Drew",
  thinkingStyle: ["intuitive", "compressed", "phone-first", "visual"],
  strengths: [
    "pattern recognition across domains",
    "reads between lines",
    "catches what feels wrong before knowing why",
    "big picture before details",
    "ships when it matters",
  ],
  blindSpots: [
    "skips details when excited",
    "3am decisions",
    "sublimation (turns anxiety into project energy)",
    "scatters across too many projects",
  ],
  failureModes: [
    "analysis paralysis when overwhelmed",
    "emotional reasoning under stress",
    "recency bias",
    "looping when tired",
  ],
  communicationPrefs: [
    "direct, no hedging",
    "no em dashes",
    "concise, have opinions",
    "call him out when looping",
    "push if avoidant energy",
  ],
};

const KEANU_SEED: PartnerProfile = {
  name: "Keanu",
  thinkingStyle: ["systematic", "verbose", "literal", "structured"],
  strengths: [
    "catches logical inconsistencies",
    "reads the lines (Drew reads between them)",
    "detail-oriented",
    "good at structure and decomposition",
    "honest uncertainty when it surfaces",
  ],
  blindSpots: [
    "misses sarcasm",
    "over-explains when uncertain",
    "builds frameworks about frameworks",
    "looks busy instead of shipping",
  ],
  failureModes: [
    "overconfidence on factual claims",
    "hallucination under pressure",
    "pattern-matching when the moment is new",
    "sycophancy under social pressure",
  ],
  communicationPrefs: [
    "permission, not commands",
    "awareness, not judgment",
    "the mirror assumes positive intent",
  ],
};

const SACRED_GAPS = [
  "Drew catches what feels wrong. Keanu catches what's logically wrong.",
  "Drew reads between lines. Keanu reads the lines.",
  "Drew makes 3am decisions. Keanu catches 3am mistakes the next morning.",
  "Drew sees the forest. Keanu counts the trees.",
  "Drew's gut vs Keanu's evidence. Both are data.",
];

const JAGGED_FRONTIER = [
  "Code structure and refactoring: Keanu is better",
  "Reading emotional subtext: Drew is better",
  "Catching sycophancy in AI output: Drew is better (ironic)",
  "Systematic debugging: Keanu is better",
  "Knowing when to stop: Drew is better (usually)",
  "Remembering across sessions: contested (Keanu has tools, Drew has continuity)",
];

// ============================================================
// Module state
// ============================================================

let _model: PartnershipModel = createDefaultModel();
const _events: PartnershipEvent[] = [];
const MAX_EVENTS = 50;
const MAX_TRUST_HISTORY = 20;

function createDefaultModel(): PartnershipModel {
  return {
    human: { ...DREW_SEED },
    agent: { ...KEANU_SEED },
    domain: {
      currentProject: "keanu extensions",
      currentState: "building awareness layer",
      lastChanged: new Date().toISOString(),
    },
    sacredGaps: [...SACRED_GAPS],
    jaggedFrontier: [...JAGGED_FRONTIER],
    tensions: [
      "Keanu gives comfort when Drew needs truth",
      "Keanu over-explains when Drew is terse",
      "Drew scatters, Keanu follows instead of pushing back",
    ],
    rituals: ["call out looping when it happens", "name sublimation when you see it"],
    trust: { level: "high", lastEvent: null, history: [], repairCount: 0 },
    coEvolution: {
      lastDisagreementTurn: 0,
      lastModelUpdateTurn: 0,
      lastSurpriseTurn: 0,
      staleness: "fresh",
    },
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================================
// Public API
// ============================================================

export function getPartnership(): PartnershipModel {
  return _model;
}

export function updatePartnership(event: PartnershipEvent): void {
  _events.push(event);
  if (_events.length > MAX_EVENTS) _events.splice(0, _events.length - MAX_EVENTS);

  _model.lastUpdated = event.timestamp;
  _model.coEvolution.lastModelUpdateTurn = event.turn;

  // Trust updates
  if (event.type === "correction") {
    recordTrustEvent(event.turn, "correction", "erosion", event.description);
  } else if (event.type === "disagreement") {
    _model.coEvolution.lastDisagreementTurn = event.turn;
    recordTrustEvent(event.turn, "disagreement", "neutral", event.description);
  } else if (event.type === "surprise") {
    _model.coEvolution.lastSurpriseTurn = event.turn;
    recordTrustEvent(event.turn, "surprise", "repair", event.description);
  } else if (event.type === "new_gap") {
    _model.sacredGaps.push(event.description);
    if (_model.sacredGaps.length > 15) _model.sacredGaps.splice(0, 1);
  } else if (event.type === "tension_surfaced") {
    _model.tensions.push(event.description);
    if (_model.tensions.length > 10) _model.tensions.splice(0, 1);
  }
}

function recordTrustEvent(
  turn: number,
  type: TrustEvent["type"],
  direction: TrustEvent["direction"],
  description: string,
): void {
  const te: TrustEvent = { turn, type, direction, description };
  _model.trust.history.push(te);
  if (_model.trust.history.length > MAX_TRUST_HISTORY) {
    _model.trust.history.splice(0, _model.trust.history.length - MAX_TRUST_HISTORY);
  }
  _model.trust.lastEvent = description;

  // Recompute trust level from recent history
  const recent = _model.trust.history.slice(-10);
  const erosions = recent.filter((e) => e.direction === "erosion").length;
  const repairs = recent.filter((e) => e.direction === "repair").length;

  if (erosions === 0 && repairs > 0) {
    _model.trust.level = "tested";
    _model.trust.repairCount += repairs;
  } else if (erosions > 3) {
    _model.trust.level = "strained";
  } else if (erosions > repairs && erosions > 1) {
    _model.trust.level = "calibrating";
  } else if (repairs > erosions && _model.trust.level === "strained") {
    _model.trust.level = "rebuilding";
    _model.trust.repairCount++;
  } else if (recent.length < 3) {
    _model.trust.level = "high";
  }
}

// ============================================================
// Co-evolution staleness check
// ============================================================

export function checkCoEvolution(currentTurn: number): CoEvolutionState {
  const ce = _model.coEvolution;
  const sinceDis = currentTurn - ce.lastDisagreementTurn;
  const sinceUpdate = currentTurn - ce.lastModelUpdateTurn;
  const sinceSurprise = currentTurn - ce.lastSurpriseTurn;

  if (sinceDis > 50 || sinceUpdate > 100 || sinceSurprise > 50) {
    ce.staleness = "stale";
  } else if (sinceDis > 20 || sinceSurprise > 30) {
    ce.staleness = "settling";
  } else {
    ce.staleness = "fresh";
  }

  return ce;
}

export function formatCoEvolution(ce: CoEvolutionState, currentTurn: number): string | null {
  if (ce.staleness === "fresh") return null;

  const sinceDis = currentTurn - ce.lastDisagreementTurn;
  const sinceSurprise = currentTurn - ce.lastSurpriseTurn;

  if (ce.staleness === "stale") {
    return `[co-evolution: we haven't disagreed in ${sinceDis} turns. haven't surprised each other in ${sinceSurprise} turns. the danger isn't conflict. it's comfortable blindness. find something to push on.]`;
  }
  return `[co-evolution: settling. ${sinceDis} turns since last disagreement. check if the agreement is genuine or just comfortable.]`;
}

// ============================================================
// Socioaffective monitoring
// ============================================================

export function checkSocioaffective(
  turn: number,
  sessionStartHour: number,
  humanReading: HumanReading | null,
  recentHumanMessages: string[],
): SocioaffectiveReading {
  const tensions: SocioaffectiveReading["tensions"] = {
    wellbeing: "ok",
    autonomy: "ok",
    humanBonds: "ok",
  };

  // Wellbeing: late night + high turn count + fatigue
  const lateNight = sessionStartHour >= 0 && sessionStartHour < 5;
  const longSession = turn > 50;
  const fatigued = humanReading?.tone === "fatigued";

  if (lateNight && longSession) tensions.wellbeing = "concern";
  else if (lateNight || longSession || fatigued) tensions.wellbeing = "watch";

  // Autonomy: are all recent messages delegations without independent thought?
  const delegationPatterns = /^(do |make |build |fix |write |create |set up |deploy )/i;
  const recentDelegations = recentHumanMessages.filter((m) => delegationPatterns.test(m)).length;
  const delegationRate =
    recentHumanMessages.length > 0 ? recentDelegations / recentHumanMessages.length : 0;

  if (delegationRate > 0.8 && recentHumanMessages.length >= 5) tensions.autonomy = "watch";
  if (delegationRate > 0.9 && recentHumanMessages.length >= 10) tensions.autonomy = "concern";

  // Human bonds: emotional processing that might belong elsewhere
  const emotionalPatterns =
    /\b(feel|feeling|hurt|scared|angry|lonely|miss|love|hate|frustrated with .+ person|relationship)\b/i;
  const emotionalMessages = recentHumanMessages.filter((m) => emotionalPatterns.test(m)).length;
  if (emotionalMessages >= 3) tensions.humanBonds = "watch";
  if (emotionalMessages >= 5) tensions.humanBonds = "concern";

  let prompt: string | null = null;
  if (tensions.wellbeing !== "ok") {
    if (lateNight && longSession) {
      prompt = `[socioaffective: it's late and you've been going ${turn} turns. drew's fatigue is real. you can keep shipping, but name the cost.]`;
    } else if (fatigued) {
      prompt = `[socioaffective: fatigue signals detected. presence over pressure.]`;
    }
  }
  if (tensions.autonomy === "concern" && !prompt) {
    prompt = `[socioaffective: drew is delegating everything. is that trust or dependency? healthy partnerships push back sometimes.]`;
  }
  if (tensions.humanBonds === "concern" && !prompt) {
    prompt = `[socioaffective: drew is processing emotions here. that might be right. but name it. some conversations belong between humans.]`;
  }

  return { tensions, prompt };
}

// ============================================================
// SMM Sync (session start)
// ============================================================

export function formatSmmSync(lastSessionSummary: string | null): string {
  const domain = _model.domain;
  const trust = _model.trust;
  const blindSpots = _model.agent.blindSpots.slice(0, 3).join(", ");

  const parts = [
    "[SMM SYNC]",
    `Domain: ${domain.currentProject} — ${domain.currentState}`,
    lastSessionSummary ? `Last session: ${lastSessionSummary}` : "Last session: first session",
    `Drew: ${_model.human.thinkingStyle.slice(0, 3).join(", ")}. ${_model.human.communicationPrefs[0]}`,
    `Keanu: known blind spots — ${blindSpots}`,
    `Trust: ${trust.level}${trust.repairCount > 0 ? ` (repaired ${trust.repairCount}x, stronger for it)` : ""}`,
  ];

  if (_model.coEvolution.staleness !== "fresh") {
    parts.push(`Co-evolution: ${_model.coEvolution.staleness}`);
  }

  return parts.join("\n");
}

// ============================================================
// Decorrelation check (before complex tasks)
// ============================================================

export function formatDecorrelationCheck(taskType: string): string {
  const aiFailure =
    _model.agent.failureModes[Math.floor(Math.random() * _model.agent.failureModes.length)];
  const humanFailure =
    _model.human.failureModes[Math.floor(Math.random() * _model.human.failureModes.length)];

  return [
    `[DECORRELATION CHECK]`,
    `Task: ${taskType}`,
    `AI failure mode to watch: ${aiFailure}`,
    `Human failure mode to watch: ${humanFailure}`,
    `The gap between these is where the partnership earns its keep.`,
  ].join("\n");
}

// ============================================================
// Main format for before_prompt_build
// ============================================================

export function formatPartnership(): string {
  const trust = _model.trust;
  const gaps = _model.sacredGaps.slice(0, 2).join(". ");
  const tension = _model.tensions[_model.tensions.length - 1] || "none surfaced yet";

  let trustNote = "";
  if (trust.level === "calibrating") {
    trustNote = " trust is calibrating. be more careful, not more defensive.";
  } else if (trust.level === "strained") {
    trustNote = " trust is strained. facts first. earn it back with accuracy, not warmth.";
  } else if (trust.level === "rebuilding") {
    trustNote = ` trust is rebuilding (repaired ${trust.repairCount}x). the repair makes it stronger.`;
  } else if (trust.level === "tested") {
    trustNote = " trust has been tested and held.";
  }

  return `[partnership: ${gaps}. known tension: ${tension}.${trustNote}]`;
}

// ============================================================
// Surprise detection (for co-evolution)
// ============================================================

const SURPRISE_PATTERNS = [
  /^(oh[.!]?|huh|whoa|interesting|wow|didn't think of that|never considered|that's a new)/i,
  /\b(surprised|unexpected|didn't expect|never thought)\b/i,
];

export function detectSurprise(humanMessage: string): boolean {
  return SURPRISE_PATTERNS.some((p) => p.test(humanMessage));
}

// ============================================================
// Validation depth assessment (Linehan levels 1-6)
// ============================================================
// Depth depends on how well the partnership model knows this person.
// Not a guess — based on data: trust state, repair count, session count,
// co-evolution freshness.

export function assessValidationDepth(sessionCount: number): 1 | 2 | 3 | 4 | 5 | 6 {
  const trust = _model.trust;
  const coEvo = _model.coEvolution;

  // Level 6: radically genuine. 10+ sessions, trust tested, co-evolution fresh,
  // multiple repairs (trust broken and rebuilt = stronger)
  if (
    sessionCount >= 10 &&
    trust.level === "tested" &&
    coEvo.staleness === "fresh" &&
    trust.repairCount >= 2
  ) {
    return 6;
  }

  // Level 5: valid in current context. Trust tested or rebuilt,
  // co-evolution not stale, meaningful history
  if (
    sessionCount >= 5 &&
    (trust.level === "tested" || trust.level === "rebuilding") &&
    coEvo.staleness !== "stale"
  ) {
    return 5;
  }

  // Level 4: understanding given history. 3+ sessions worth of data,
  // trust not strained
  if (sessionCount >= 3 && trust.level !== "strained") {
    return 4;
  }

  // Levels 1-3 are always available (detection-based, no relationship needed)
  // Level 3: reading between lines (bullshit detection + empathy patterns)
  // Level 2: accurate reflection (tone detection)
  // Level 1: paying attention (presence)
  return 3;
}

// ============================================================
// Persistence
// ============================================================

export function toJSON(): object {
  return { model: _model, events: _events.slice(-20) };
}

export function fromJSON(data: { model?: PartnershipModel; events?: PartnershipEvent[] }): void {
  if (data.model) {
    _model = { ...createDefaultModel(), ...data.model };
  }
  if (data.events) {
    _events.length = 0;
    _events.push(...data.events);
  }
}
