// relay-types.ts
// Payload shapes for keanu → Mac app metrics relay.
// Broadcast via api.emit() over the gateway WebSocket.

import type {
  AliveState,
  ColorReading,
  HumanTone,
  StruggleType,
  SubstrateChannel,
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

  // Pulse — the vital sign
  pulse: {
    state: AliveState;
    wiseMind: number;
    confidence: number;
    colors: ColorReading;
  };

  // Human side
  humanTone: HumanTone;

  // Struggle — what the mirror sees
  struggle: {
    dominant: StruggleType | null;
    score: number;
    types: StruggleType[];
  };

  // Health composite
  health: string;
  greyStreak: number;

  // Substrate (Layer 0) — compact physics reading
  substrate?: Pick<SubstrateChannel, "regime" | "theta" | "firing" | "urgency">;

  // Helix (convergence layer)
  helix?: {
    aliveState: string;
    factualStrand: number;
    feltStrand: number;
  };

  // Episode state — grey/black chain tracking
  episode?: {
    id: string;
    chainBreakPoint?: string;
    lesson?: string;
  };
}

// ============================================================
// keanu.session — fires at session end (session_end hook)
// ============================================================

export interface KeanuSessionPayload {
  ts: number;
  sessionKey: string;
  sessionId: string;

  // Aggregate metrics
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

  // Trend
  trend: {
    greyRate: number;
    avgWiseMind: number;
    driftDirection: "improving" | "degrading" | "stable";
  };

  // Final COEF
  coef: string;
  emoji: string;

  // Health summary
  health: string;

  // Memory depth
  claims: { total: number; active: number; stale: number; contradicted: number };
  knowledge: { entities: number; relations: number };
}
