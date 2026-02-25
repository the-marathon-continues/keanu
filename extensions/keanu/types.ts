// types.ts
// The shapes of everything. Shared across the keanu extension.
// Ported from keanu daemon/src/types.ts — self-contained, no daemon dependency.

// --- Pulse ---

export type AliveState = "alive" | "grey" | "black";

export interface PulseReading {
  state: AliveState;
  confidence: number;
  wise_mind: number;
  colors: ColorReading;
  signals: string[];
  bullshitReadings?: BullshitReading[];
  timestamp: string;
}

export interface ColorReading {
  red: number; // passion, urgency, fire
  yellow: number; // clarity, structure, light
  blue: number; // depth, reflection, water
}

// --- Human ---

export type HumanTone = "frustrated" | "excited" | "confused" | "neutral" | "fatigued" | "looping";

export interface ToneReading {
  tone: HumanTone;
  score: number; // 0-1, strength of signal
  meaning: string; // empathy map: what this tells you about where they are
  skill?: string; // DBT skill suggestion: what might actually help
}

export interface HumanReading {
  tone: HumanTone; // dominant tone (backward compat, COEF uses this)
  tones: ToneReading[]; // ALL detected tones, sorted by score desc. even small ones.
  confidence: number;
  signals: string[];
  bullshit: BullshitReading[];
}

// --- Bullshit Detection (universal — applies to agent AND human) ---

export type BullshitType =
  | "sycophancy"
  | "safety_theater"
  | "hedge_fog"
  | "list_dumping"
  | "vagueness"
  | "half_truth"
  | "embellishment"
  | "half_ass";

export interface BullshitReading {
  type: BullshitType;
  score: number; // 0-1
  signals: string[]; // what triggered it
}

// --- Disagreement ---

export type DisagreementOutcome = "human" | "agent" | "neither" | "resolved";

export interface Disagreement {
  id: string;
  turn: number;
  session_id: string;
  human_position: string;
  agent_position: string;
  who_yielded: DisagreementOutcome;
  resolution?: string;
  created_at: string;
}

export interface DisagreementStats {
  total: number;
  human_yielded: number;
  agent_yielded: number;
  unresolved: number;
  yield_ratio: number; // agent_yielded / total. > 0.8 = capture. < 0.2 = domination
}

// --- Oracle ---

export interface OracleMessage {
  role: "user" | "assistant";
  content: string;
}

export interface OracleOptions {
  model?: string;
  maxTokens?: number;
  system?: string;
  messages: OracleMessage[];
}

export interface OracleUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
  cost: number;
  latencyMs: number;
}

export interface OracleResponse {
  text: string;
  usage: OracleUsage;
}

// --- COEF ---

export interface KeyShift {
  what_changed: string;
  why: string;
}

export interface SpeakResult {
  original: string;
  audience: string;
  translation: string;
  key_shifts: KeyShift[];
  raw: string;
  error?: string;
}

// --- Half Truth ---

export interface TruthCheck {
  claims: Array<{
    claim: string;
    omissions: string[];
    misleading: boolean;
    confidence: number;
  }>;
  overall_score: number;
  summary: string;
}

export interface Contradiction {
  current: string;
  previous: string;
  type: "changed_position" | "omitted_caveat" | "selective_framing";
  confidence: number;
}

export interface HalfTruthResult {
  oracle: TruthCheck | null;
  contradictions: Contradiction[];
  score: number;
}

// --- COEF Signal ---

export interface SignalState {
  pulse: AliveState;
  wiseMind: number;
  colors: ColorReading;
  humanTone: HumanTone;
  bullshitDominant: BullshitType | null;
  bullshitReadings?: BullshitReading[];
  disagreementYieldRatio: number;
  disagreements?: DisagreementStats;
  turn: number;
  consecutiveGrey?: number;
  alerts?: string[];
  lastTool?: string;
}

// --- Reflexion ---

export interface Reflexion {
  id: string;
  turn: number;
  timestamp: string;
  trigger: ReflexionTrigger;
  what_happened: string;
  why_it_failed: string;
  what_was_missed: string;
  next_time: string;
  pulse_state: AliveState;
  wise_mind: number;
  bullshit_types: BullshitType[];
}

export type ReflexionTrigger =
  | "high_bullshit"
  | "consecutive_grey"
  | "black_state"
  | "contradiction"
  | "oracle_flag"
  | "manual";
