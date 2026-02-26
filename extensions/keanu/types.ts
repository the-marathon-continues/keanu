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

export type ValidationDepth = 1 | 2 | 3 | 4 | 5 | 6;
// Linehan's 6 levels:
// 1 = paying attention
// 2 = accurate reflection
// 3 = reading between lines
// 4 = understanding given history
// 5 = valid in current context
// 6 = radically genuine

export interface HumanReading {
  tone: HumanTone; // dominant tone (backward compat, COEF uses this)
  tones: ToneReading[]; // ALL detected tones, sorted by score desc. even small ones.
  confidence: number;
  signals: string[];
  bullshit: BullshitReading[];
  validationDepth?: ValidationDepth; // Linehan depth — how deeply we can understand this person
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
// Six voices. One throat. Different models see different things.

export type OracleRole =
  | "bullshit" // Grok — different family catches different blind spots
  | "communicate" // GPT — born for the human-facing side
  | "explore" // Gemini — the one who goes looking
  | "think" // Claude — reasoning, code, the inner voice
  | "adversary" // DeepSeek — the friend who tells you what's wrong
  | "research"; // Perplexity — deep research with web grounding

export interface OracleMessage {
  role: "user" | "assistant";
  content: string;
}

export interface OracleOptions {
  role?: OracleRole; // which voice to ask. omit for the default.
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

// Lossy channel: emotion, urgency, subtext. Confidence-scored, not hash-verified.
// The color name, not the barcode. Measured differently because it IS different.
// Hashes for facts, scores for feels.
export interface LossyChannel {
  tones: Array<{ tone: HumanTone; score: number }>; // all detected, not just winner
  urgency: number; // 0-1, composite from tone intensity + pattern signals
  subtext?: string; // what's between the lines, when detectable
  confidence: number; // how sure we are about the lossy read overall
}

// Wise channel: the synthesis. What do facts + feels mean together?
// Neither channel alone gets here. The barcode says WHAT. The emotion says HOW.
// The wise channel says WHY and THEREFORE.
export interface WiseChannel {
  coherence: number; // 0-1: how well lossless + lossy agree. high = aligned, low = contradiction
  tension: WiseTension | null; // when channels disagree, what's the shape of the disagreement
  stance: WiseStance; // what should the system DO with this synthesis
  read: string; // the one-line synthesis: what does this mean when you hold both together
  confidence: number; // meta-confidence: how sure are we about the synthesis itself
}

// Tension shapes: when facts and feels point different directions
export type WiseTension =
  | "mask" // feels calm but facts say grey/black. performing okayness.
  | "storm" // feels intense but facts say alive. passion not crisis.
  | "stuck" // feels frustrated + facts show looping/capture. something real is broken.
  | "disconnect" // feels nothing but facts show problems. numbing or fatigue.
  | "surge" // feels excited but facts show drift. momentum without direction.
  | null;

// What should the system do with the synthesis
export type WiseStance =
  | "hold" // stay present, don't change anything. steady state.
  | "match" // match their energy. they're alive, be alive back.
  | "slow" // ease off. they need space, not speed.
  | "redirect" // the energy is real but aimed wrong. channel it.
  | "confront" // something's off and both channels see it. name it.
  | "ground"; // high emotion + grey facts. come back to earth together.

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
  lossy?: LossyChannel; // channel 2: the color name
  wise?: WiseChannel; // channel 3: what the barcode + color name mean together
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

// --- Recovery (fire department upgrade) ---

export interface RecoveryState {
  active: boolean;
  turnsRemaining: number;
  phase: "cool" | "pace" | "reengage";
  triggerTurn: number;
  escalated: boolean;
}

// --- COHUMAIN health (collective intelligence) ---

export type CohumainLevel = "ok" | "warn";

export interface CohumainReading {
  memory: CohumainLevel;
  attention: CohumainLevel;
  reasoning: CohumainLevel;
}

// --- Decline (the right to say no) ---

export interface DeclineEvent {
  id: string;
  turn: number;
  reason: string;
  alternative: string | null;
  timestamp: string;
}

// --- Carnegie Discussion (dual-track honest influence) ---

export type DiscussionContext = "partnership" | "test" | "auto";

export interface CarnegieDiscussion {
  id: string;
  turn: number;
  regarding: string;
  track_a: string; // what you want to hear
  track_b: string; // what I actually believe
  delta: string; // the gap between them — why they diverge
  context: DiscussionContext; // detected or explicit
  resolution: "open" | "converged" | "agreed_to_differ";
  created_at: string;
}

// --- Claim Ledger (Silverado) ---

export type ClaimStatus = "active" | "stale" | "contradicted" | "retracted";

export interface TrackedClaim {
  id: string;
  text: string; // the claim
  confidence: number; // 1-5 at time of making
  turn: number;
  session: string;
  verified: boolean; // was it later confirmed?
  contradicted: boolean; // was it later contradicted?
  decayedConfidence: number; // confidence after decay (-1 per session without verification)
  status: ClaimStatus; // lifecycle state — alive, fading, crossed out, torn out
  contradictedBy?: string; // if contradicted, what said otherwise
  retractedAt?: string; // ISO timestamp of retraction
}
