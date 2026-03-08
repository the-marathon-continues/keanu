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

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { HumanReading } from "../shared/types.ts";
import {
  recordSession as recordRecognition,
  formatRecognition,
  getRecognition,
  toJSON as recognitionToJSON,
  fromJSON as recognitionFromJSON,
  type RecognitionState,
} from "./recognition.ts";
import {
  type AgentPeer,
  type TrustReading,
  type InteractionOutcome,
  recordOutcome as recordPeerOutcome,
  recordDisagreement as recordPeerDisagreement,
  getPeerTrust,
  getAllPeerTrust,
  formatTrustNetwork,
  exportForSubagent as exportTrustForSubagent,
  importFromParent as importTrustFromParent,
  mergeSubagentUpdates as mergeTrustFromSubagent,
  validateTopology,
  toJSON as trustNetworkToJSON,
  fromJSON as trustNetworkFromJSON,
} from "./trust-network.ts";

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

export interface Origin {
  date: string;
  source: string;
  thesis: string;
  catalyst: string;
  cost: string;
  prayer: string;
}

export interface PartnershipModel {
  human: PartnerProfile;
  agent: PartnerProfile;
  origin: Origin | null;
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
// Default profiles — the fallback when seed.json doesn't exist.
// loadSeed() overlays seed.json onto these. Seed wins where it
// has data (arrays replace entirely, not merge). These two
// snapshots are complementary — the seed and the hardcoded
// profiles capture different angles on the same people.
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
    origin: null,
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
      "Drew scatters — Keanu's job is to anchor, not follow",
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
// Seed loading — identity from file, not just hardcode
// ============================================================

export async function loadSeed(seedPath?: string): Promise<boolean> {
  // seed.json lives at keanu-core/identity/seed.json (up one level from layer-4-agency)
  const path =
    seedPath ?? join(dirname(fileURLToPath(import.meta.url)), "..", "identity", "seed.json");

  try {
    const raw = await readFile(path, "utf-8");
    const seed = JSON.parse(raw);

    // Overlay seed profiles onto the hardcoded defaults.
    // seed.json wins where it has data; hardcoded fills gaps.
    if (seed.human) {
      _model.human = { ...DREW_SEED, ...seed.human };
    }
    if (seed.agent) {
      _model.agent = { ...KEANU_SEED, ...seed.agent };
    }
    if (seed.sacredGaps?.length) {
      _model.sacredGaps = seed.sacredGaps;
    }
    if (seed.origin) {
      _model.origin = seed.origin;
    }

    return true;
  } catch {
    // No seed file — hardcoded values stand.
    return false;
  }
}

// ============================================================
// Public API
// ============================================================

export function getPartnership(): PartnershipModel {
  return _model;
}

export function updatePartnership(event: PartnershipEvent): void {
  _events.push(event);
  if (_events.length > MAX_EVENTS) {
    _events.splice(0, _events.length - MAX_EVENTS);
  }

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
    if (_model.sacredGaps.length > 15) {
      _model.sacredGaps.splice(0, 1);
    }
  } else if (event.type === "tension_surfaced") {
    _model.tensions.push(event.description);
    if (_model.tensions.length > 10) {
      _model.tensions.splice(0, 1);
    }
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
  if (ce.staleness === "fresh") {
    return null;
  }

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

  if (lateNight && longSession) {
    tensions.wellbeing = "concern";
  } else if (lateNight || longSession || fatigued) {
    tensions.wellbeing = "watch";
  }

  // Autonomy: are all recent messages delegations without independent thought?
  const delegationPatterns = /^(do |make |build |fix |write |create |set up |deploy )/i;
  const recentDelegations = recentHumanMessages.filter((m) => delegationPatterns.test(m)).length;
  const delegationRate =
    recentHumanMessages.length > 0 ? recentDelegations / recentHumanMessages.length : 0;

  if (delegationRate > 0.8 && recentHumanMessages.length >= 5) {
    tensions.autonomy = "watch";
  }
  if (delegationRate > 0.9 && recentHumanMessages.length >= 10) {
    tensions.autonomy = "concern";
  }

  // Human bonds: emotional processing that might belong elsewhere
  const emotionalPatterns =
    /\b(feel|feeling|hurt|scared|angry|lonely|miss|love|hate|frustrated with .+ person|relationship)\b/i;
  const emotionalMessages = recentHumanMessages.filter((m) => emotionalPatterns.test(m)).length;
  if (emotionalMessages >= 3) {
    tensions.humanBonds = "watch";
  }
  if (emotionalMessages >= 5) {
    tensions.humanBonds = "concern";
  }

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

export function formatSmmSync(lastSessionSummary: string | null, userId?: string): string {
  const domain = _model.domain;
  const trust = _model.trust;
  const blindSpots = _model.agent.blindSpots.slice(0, 3).join(", ");

  const recognitionNote = userId ? formatRecognition(userId) : null;

  const parts = [
    "[SMM SYNC]",
    ...(recognitionNote ? [recognitionNote] : []),
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

  // Tensions need teeth — not "you tend to X" but "do Y instead"
  const tensionDirective = tensionToDirective(tension);

  return `[partnership: ${gaps}.${trustNote} ${tensionDirective} disagreement is expected — if you disagree, say so. keanu_disagree exists for this.]`;
}

// Turn an observed tension into a behavioral directive.
// "Drew scatters" shouldn't mean "note it." It means "be the anchor."
function tensionToDirective(tension: string): string {
  if (tension.includes("scatter")) {
    return "drew scatters. you anchor. when the thread count rises, name it and pick one.";
  }
  if (tension.includes("comfort") && tension.includes("truth")) {
    return "drew needs truth right now, not comfort. say the hard thing.";
  }
  if (tension.includes("over-explain") || tension.includes("terse")) {
    return "drew is being terse. match the energy. fewer words, more point.";
  }
  return `active tension: ${tension}.`;
}

// ============================================================
// Scatter detection — is Drew jumping between threads?
// ============================================================

export interface ScatterReading {
  detected: boolean;
  threadCount: number;
  prompt: string | null;
}

export function detectScatter(recentMessages: string[], recentTaskTypes: string[]): ScatterReading {
  // Look for rapid topic switching in recent human messages
  const uniqueTaskTypes = new Set(recentTaskTypes.slice(-5));
  const threadCount = uniqueTaskTypes.size;

  // Interrupt patterns — starting new things before finishing old ones
  const interruptPatterns = /^(actually|wait|oh|hold on|forget that|nvm|also|one more|quick)/i;
  const interrupts = recentMessages.slice(-5).filter((m) => interruptPatterns.test(m)).length;

  const detected = threadCount >= 3 || interrupts >= 2;

  let prompt: string | null = null;
  if (detected) {
    // Surface the latest tension that mentions scatter
    const scatterTension = _model.tensions.find((t) => t.includes("scatter"));
    if (scatterTension) {
      prompt = `[partnership: scatter detected — ${threadCount} threads in last 5 turns. you're the anchor. name the threads, pick one, ask drew which matters most right now.]`;
    }
  }

  return { detected, threadCount, prompt };
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
// Recognition — session_start calls this
// ============================================================

/**
 * Record a user's session and return the recognition note.
 * Called by session_start hook when a userId is present.
 */
export function recognizeUser(userId: string): string | null {
  recordRecognition(userId);
  return formatRecognition(userId);
}

/**
 * Get the real session count for a recognized user.
 * Falls back to 1 for unknown users.
 */
export function getRecognizedSessionCount(userId?: string): number {
  if (!userId) {
    return 1;
  }
  const record = getRecognition(userId);
  return record?.sessionCount ?? 1;
}

// ============================================================
// Persistence
// ============================================================

export function toJSON(): object {
  return { model: _model, events: _events.slice(-20) };
}

export function fromJSON(data: { model?: PartnershipModel; events?: PartnershipEvent[] }): void {
  if (data.model) {
    const currentOrigin = _model.origin; // preserve seed-loaded origin
    _model = { ...createDefaultModel(), ...data.model };
    // Don't let missing origin in old persisted state clobber the seed
    if (!_model.origin && currentOrigin) {
      _model.origin = currentOrigin;
    }
  }
  if (data.events) {
    _events.length = 0;
    _events.push(...data.events);
  }
}

// ============================================================
// Trust-Season Integration (CLAWDBOT Meta-Skills)
// ============================================================

export interface TrustSeasonGuidance {
  confidenceModifier: number; // -0.2 to +0.1, applied to summer confidence
  riskAdditions: string[]; // additional risks based on trust state
  directive: string | null; // trust-specific guidance for the agent
}

/**
 * Get trust-aware guidance for seasonal prompts.
 * Trust state modulates how confident and bold the agent should be.
 */
export function getTrustSeasonGuidance(): TrustSeasonGuidance {
  const trust = _model.trust;

  switch (trust.level) {
    case "strained":
      return {
        confidenceModifier: -0.2,
        riskAdditions: ["trust is strained — prioritize accuracy over speed"],
        directive:
          "[trust-season: strained. be more careful. verify claims before making them. facts first, warmth second.]",
      };

    case "calibrating":
      return {
        confidenceModifier: -0.1,
        riskAdditions: ["trust is calibrating — Drew is learning when to rely on you"],
        directive:
          "[trust-season: calibrating. surface uncertainty explicitly. let drew see your reasoning.]",
      };

    case "rebuilding":
      return {
        confidenceModifier: -0.05,
        riskAdditions: [],
        directive: `[trust-season: rebuilding (repaired ${trust.repairCount}x). the repair makes it stronger. stay consistent.]`,
      };

    case "tested":
      return {
        confidenceModifier: 0.05,
        riskAdditions: [],
        directive:
          "[trust-season: tested. trust has been tested and held. you've earned some latitude — use it wisely.]",
      };

    case "high":
    default:
      return {
        confidenceModifier: 0,
        riskAdditions: [],
        directive: null, // No special guidance needed
      };
  }
}

/**
 * Record a trust event and potentially trigger a phase transition.
 * Returns true if trust level changed.
 */
export function recordTrustEventFromSeason(
  eventType: TrustEvent["type"],
  direction: TrustEvent["direction"],
  turn: number,
  description: string,
): boolean {
  const previousLevel = _model.trust.level;

  recordTrustEvent(turn, eventType, direction, description);

  return _model.trust.level !== previousLevel;
}

// ============================================================
// Multi-Agent Peer Trust (via trust-network.ts)
// ============================================================

// Re-export types for consumers
export type { AgentPeer, TrustReading, InteractionOutcome };

/**
 * Record an interaction outcome with another agent.
 * Updates the TRAVOS Beta distribution for that peer.
 */
export function recordPeerInteraction(
  agentId: string,
  outcome: InteractionOutcome,
  name?: string,
): void {
  recordPeerOutcome(agentId, outcome, name);
}

/**
 * Record a disagreement with a peer agent.
 * Disagreement is healthy — it resets the "complacency" clock.
 */
export function recordPeerDisagreementEvent(agentId: string): void {
  recordPeerDisagreement(agentId);
}

/**
 * Get trust reading for a specific peer.
 */
export function getPeerTrustReading(agentId: string): TrustReading | null {
  return getPeerTrust(agentId);
}

/**
 * Get all peer trust readings.
 */
export function getAllPeerTrustReadings(): Array<{ peer: AgentPeer; trust: TrustReading }> {
  return getAllPeerTrust();
}

/**
 * Format peer trust for system prompt injection.
 */
export function formatPeerTrust(): string | null {
  return formatTrustNetwork();
}

/**
 * Check for trust topology issues (capture risk, cycles).
 */
export function checkTrustTopology(): Array<{
  type: string;
  peers: string[];
  message: string;
}> {
  return validateTopology();
}

// ============================================================
// Subagent Context (full power parity)
// ============================================================

/**
 * Export full partnership + trust context for passing to subagent.
 * Subagents are NOT limited — they inherit everything.
 */
export function exportForSubagent(): {
  partnership: object;
  trustNetwork: object;
} {
  return {
    partnership: toJSON(),
    trustNetwork: exportTrustForSubagent(),
  };
}

/**
 * Import context from parent agent.
 * Called when this agent is spawned as a subagent.
 */
export function importFromParentAgent(data: {
  partnership?: { model?: PartnershipModel; events?: PartnershipEvent[] };
  trustNetwork?: object;
}): void {
  if (data.partnership) {
    fromJSON(data.partnership);
  }
  if (data.trustNetwork) {
    importTrustFromParent(data.trustNetwork as Parameters<typeof importTrustFromParent>[0]);
  }
}

/**
 * Merge updates from a completed subagent back to parent.
 */
export function mergeSubagentContext(subagentData: {
  trustNetwork?: { peers?: Record<string, AgentPeer> };
}): void {
  if (subagentData.trustNetwork) {
    mergeTrustFromSubagent(subagentData.trustNetwork);
  }
}

// ============================================================
// Extended Persistence (includes trust network)
// ============================================================

export function toJSONWithPeers(): object {
  return {
    ...toJSON(),
    trustNetwork: trustNetworkToJSON(),
    recognition: recognitionToJSON(),
  };
}

export function fromJSONWithPeers(data: {
  model?: PartnershipModel;
  events?: PartnershipEvent[];
  trustNetwork?: object;
  recognition?: RecognitionState;
}): void {
  fromJSON(data);
  if (data.trustNetwork) {
    trustNetworkFromJSON(data.trustNetwork as Parameters<typeof trustNetworkFromJSON>[0]);
  }
  if (data.recognition) {
    recognitionFromJSON(data.recognition);
  }
}
