// relay-types.ts
// Payload shapes for keanu → Mac app metrics relay.
// Broadcast via api.emit() over the gateway WebSocket.
// Every detection keanu runs should surface here.

import type {
  AliveState,
  ColorReading,
  HumanTone,
  StruggleType,
  SubstrateChannel,
  ValidationDepth,
} from "./types.js";

// ============================================================
// keanu.turn — fires after every agent turn (message_sent hook)
// ============================================================

export interface KeanuTurnPayload {
  ts: number;
  sessionKey: string;
  turn: number;

  // Raw COEF signal — the full encoded string + emoji
  coef: string;
  emoji: string;

  // ── Core Vitals ──────────────────────────────────────────

  pulse: {
    state: AliveState;
    wiseMind: number;
    confidence: number;
    colors: ColorReading;
  };

  humanTone: HumanTone;

  struggle: {
    dominant: StruggleType | null;
    score: number;
    types: StruggleType[];
  };

  health: {
    status: string;
    factors?: {
      contextAge?: number;
      bullshitTrend?: number;
      promptSize?: number;
      toolErrorRate?: number;
      resonanceStrain?: number;
    };
    guidance?: string;
  };

  greyStreak: number;

  // ── The 5 Easy Detections ────────────────────────────────

  /** Carnegie presupposition trap detection */
  carnegie?: {
    triggered: boolean;
    highestType: string | null;
    presuppositionText?: string;
    /** Post-mortem: did we catch it in our response? */
    caught?: boolean;
    agreedWithoutCheck?: boolean;
  };

  /** Mismatch: did we give what they needed? */
  mismatch?: {
    detected: boolean;
    type: string | null;
    humanNeed?: string;
    agentGave?: string;
  };

  /** Calibration: unverified claims in our output */
  calibration?: {
    triggered: boolean;
    reason: string | null;
    claims: string[];
  };

  /** Velocity: are we going too fast or too slow? */
  velocity?: {
    mode: string; // fast | moderate | slow | paused
    appropriate: boolean;
    suggestion?: string;
  };

  /** SELF-DISCOVER: what reasoning modules did we select? */
  discover?: {
    complexity: string; // low | mid | high
    selectedModules: string[];
  };

  // ── Physics Layer ────────────────────────────────────────

  substrate?: Pick<SubstrateChannel, "regime" | "theta" | "firing" | "urgency"> & {
    noiseClarity?: number;
    resonanceDistance?: number;
  };

  helix?: {
    aliveState: string;
    factualStrand: number;
    feltStrand: number;
    diagnosis?: string;
  };

  sigma?: {
    sigma: number;
    agency: number;
    predictionCorrect: boolean;
  };

  // ── State Tracking ───────────────────────────────────────

  episode?: {
    id: string;
    trigger?: string;
    chainBreakPoint?: string;
    lesson?: string;
    hexaflexStage?: string;
  };

  recovery?: {
    active: boolean;
    phase?: string; // cool | reengage | active
    turnsRemaining?: number;
    escalated?: boolean;
  };

  depth?: {
    currentLayer: number;
    recursionDepth: number;
    degradationRisk: number;
  };

  limbo?: {
    inLimbo: boolean;
    degradationLevel: number;
    warning?: string;
  };

  // ── Full Human Reading ───────────────────────────────────

  humanReading?: {
    tone: HumanTone;
    tones: Array<{ tone: HumanTone; score: number; meaning: string; skill?: string }>;
    confidence: number;
    validationDepth?: ValidationDepth;
  };

  // ── Session Accumulators ─────────────────────────────────

  contradictions: number;
  blindSpots: Array<{ category: string; count: number }>;

  disagreements: {
    total: number;
    humanYielded: number;
    agentYielded: number;
    yieldRatio: number;
  };

  partnership?: {
    trustLevel: string;
    coEvolutionStaleness?: string; // "fresh" | "settling" | "stale"
  };

  spring?: {
    intent: string;
    taskType: string;
    complexity: string;
  };
}

// ============================================================
// keanu.session — fires at session end (session_end hook)
// ============================================================

export interface KeanuSessionPayload {
  ts: number;
  sessionKey: string;
  sessionId: string;

  metrics: {
    turnCount: number;
    aliveRate: number;
    greyRate: number;
    blackRate: number;
    bullshitAvg: number;
    wiseMindAvg: number;
    disagreementCount: number;
    yieldRatio: number;
    breatheCount: number;
    topBullshitTypes: string[];
  };

  trend: {
    greyRate: number;
    avgWiseMind: number;
    driftDirection: "improving" | "degrading" | "stable";
  };

  coef: string;
  emoji: string;
  health: string;
  claims: { total: number; active: number; stale: number; contradicted: number };
  knowledge: { entities: number; relations: number };
}
