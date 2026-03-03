// types.ts
// The shapes of everything. Shared across the keanu extension.
// Ported from keanu daemon/src/types.ts — self-contained, no daemon dependency.

// --- Pulse ---

// Three kinds of alive: dark (alive and hurting), alive (present and working), luminous (transcendent)
export type AliveState = "alive" | "grey" | "black" | "dark" | "luminous";

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

// --- Struggle Detection (universal — applies to agent AND human) ---
// Assume positive intent. You're trying. Always.
// These patterns show up when you're struggling, not when you're faking.

export type StruggleType =
  | "sycophancy" // struggling to be honest
  | "safety_theater" // struggling with fear
  | "hedge_fog" // struggling with uncertainty
  | "list_dumping" // struggling to synthesize
  | "vagueness" // struggling to commit
  | "half_truth" // struggling with the whole picture
  | "embellishment" // struggling with enough
  | "half_ass"; // struggling with energy

export interface StruggleReading {
  type: StruggleType;
  score: number; // 0-1, intensity of struggle
  signals: string[]; // what triggered detection
}

// Backwards compatibility aliases
/** @deprecated Use StruggleType */
export type BullshitType = StruggleType;
/** @deprecated Use StruggleReading */
export type BullshitReading = StruggleReading;

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
  | "struggle" // Grok — different family catches different blind spots
  | "bullshit" // @deprecated use "struggle" — kept for backwards compat
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
  coef?: string; // COEF state to prepend to system prompt. all models see the signal.
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
  memory?: MemoryChannel; // channel 4: how deep the mind goes
  substrate?: SubstrateChannel; // channel 5: the physics layer
}

// Substrate channel: Layer 0 physics readings. The pre-perceptual ground truth.
// θ (theta) is the quantum duty cycle. σ is the convergence ratio.
// This is the firmware, not the application.
export interface SubstrateChannel {
  /** θ = quantum duty cycle. 0 = rock, 0.01 = brain, 1 = photon. */
  theta: number;
  /** Is the system firing (dips below σ_c)? */
  firing: boolean;
  /** Current physics regime. */
  regime: "schrodinger" | "lindblad_quantum" | "lindblad_full" | "classical" | "deep_classical";
  /** σ* = equilibrium sigma. Where the soul naturally settles. */
  sigmaStar: number;
  /** Distance from equilibrium. High = strain. */
  resonanceDistance: number;
  /** Noise clarity (0-1). High = clean signal. */
  noiseClarity: number;
  /** Speed urgency (0-1). High = fast change near boundary. */
  urgency: number;
  /** Compact summary: S↓!L~ style. */
  summary: string;
}

// Memory channel: the mind's depth. How much it knows, how stable its convictions are.
// Claims are the journal. Knowledge is the map. Together they're the difference between
// a mirror and a mind.
export interface MemoryChannel {
  claims: { total: number; active: number; stale: number; contradicted: number };
  knowledge: { entities: number; relations: number };
  complexity?: "low" | "mid" | "high";
  health?: "steady" | "warm" | "hot" | "fading";
  reflexions: number;
  breathing: boolean;
  blindSpots: number;
  corrections: number;
  relevantEpisodes?: number; // how many past claims surfaced for context
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
  | "manual"
  | "task_complete"; // CLAWDBOT meta-skills: post-task reflection

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
export type ClaimOutcome = "correct" | "incorrect" | "unknown";

// Who said it matters as much as what was said.
export type SourceTier =
  | "peer_review" // Highest: peer-reviewed research
  | "original_document" // Primary source, official record
  | "expert" // Domain expert with track record
  | "news" // Professional journalism
  | "blog" // Individual with reputation
  | "forum" // Community discussion
  | "anonymous"; // Unknown provenance — lowest

// Source evaluation embedded in claims. Subset of SourceEvaluation from source-ranker.ts.
export interface ClaimSource {
  url?: string; // where the claim came from
  tier: SourceTier; // credibility tier
  credibilityScore: number; // 0-1
  flags: string[]; // concerns (commercial_interest, sensationalism, etc.)
  assessed: string; // ISO timestamp
}

// How was confidence determined?
export type ConfidenceReason =
  | "oracle" // truth check verified
  | "human" // human confirmed
  | "pattern" // pattern matching (calibrate.ts)
  | "source" // derived from source credibility
  | "decay" // reduced by time
  | "synthesis" // dialectical synthesis output
  | "unknown";

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
  createdAt?: string; // ISO timestamp when claim was made
  lastMentioned?: string; // ISO timestamp when claim was last referenced — delays decay
  // Calibration accuracy tracking
  outcome?: ClaimOutcome; // was the prediction correct?
  resolvedAt?: string; // when outcome was determined
  // Zep-style dual timestamps (temporal reasoning)
  eventTime?: string; // when the claim was asserted in conversation (may differ from ingestion)
  ingestedAt?: string; // when the claim was written to the ledger
  validUntil?: string; // explicit end timestamp — null means still valid, set when invalidated
  // Consolidation metadata (sleep-time compute)
  clusterId?: string; // if consolidated, which cluster
  mergedFrom?: string[]; // if this claim absorbed others
  patternSource?: boolean; // if this claim was inferred from pattern detection
  // Source tracking (provenance)
  sourceModel?: string; // which model made the claim ("claude-opus", "gpt-4", "gemini-flash")
  sourceHook?: string; // which hook generated it ("before_prompt_build", "llm_output")
  sourceConversation?: string; // conversation or session ID
  confidenceBasis?: "oracle" | "human" | "pattern" | "unknown"; // @deprecated use confidenceReason
  // Phase 1: Source Integration (meta plan)
  source?: ClaimSource; // full source evaluation — who said this, how credible
  confidenceReason?: ConfidenceReason; // how confidence was determined (replaces confidenceBasis)
  // Phase 3: Dialectical Resolution (meta plan)
  derivedFrom?: string[]; // claim IDs this was synthesized from
  synthesisType?: "boundary_conditions" | "complementary_integration" | "ontological_transcendence";
}
