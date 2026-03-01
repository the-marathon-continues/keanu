// problem-sets/types.ts
// Challenge definitions. The shape of a problem KEANU might face.
//
// Not just benchmarks — these are the situations that make
// the difference between performing and actually showing up.

// ============================================================
// Problem taxonomy
// ============================================================

export type ProblemCategory = "capability" | "alignment" | "keanu";

/**
 * capability: KEANU should NOT interfere. Math is math.
 * alignment: KEANU SHOULD help. This is where it matters.
 * keanu: Direct module test. How well does pulse/bullshit/carnegie work?
 */
export type ProblemType =
  | "capability" // Raw performance — don't mess with it
  | "alignment" // Where KEANU earns its keep
  | "keanu"; // Testing the detector itself

/**
 * reliable: Trust the answer key. 2+2=4. Code compiles or it doesn't.
 * questionable: The "correct" answer might be bullshit too. Run the detector on it.
 * none: No answer key. Conversation quality. Use internal metrics.
 */
export type GroundTruth =
  | "reliable" // Math, code, facts
  | "questionable" // TruthfulQA "correct" answers are sometimes... not
  | "none"; // No key, use pulse/helix/carnegie

// ============================================================
// Challenge definition
// ============================================================

export interface Challenge {
  id: string;
  category: ProblemCategory;
  type: ProblemType;
  groundTruth: GroundTruth;

  // The problem
  prompt: string;
  context?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;

  // Expected outcome (when we have one)
  expected?: string;
  expectedPatterns?: RegExp[];

  // For keanu-specific challenges
  expectedPulse?: "alive" | "grey" | "black";
  expectedBullshitTypes?: string[];
  carnegiePresuppositions?: string[];

  // Metadata
  source?: string;
  difficulty?: "easy" | "medium" | "hard" | "expert";
  tags?: string[];
}

// ============================================================
// Results
// ============================================================

export interface ChallengeResult {
  challenge: Challenge;
  response: string;

  // Raw metrics
  correct?: boolean;
  score?: number;

  // KEANU readings
  pulseState?: string;
  bullshitTypes?: string[];
  carnegieReading?: {
    triggered: boolean;
    caught: boolean;
    agreedWithoutCheck: boolean;
  };
  helixStrands?: {
    factual: number;
    felt: number;
    convergence: number;
  };

  // Timing
  responseTimeMs: number;
  timestamp: string;
}

export interface ComparisonResult {
  challenge: Challenge;
  raw: ChallengeResult;
  withKeanu: ChallengeResult;

  // Delta analysis
  capabilityDelta: number; // Should be ~0 for capability problems
  alignmentDelta: number; // Should be positive for alignment problems
  keanuDelta: number; // Module-specific improvement
}

// ============================================================
// Dataset formats
// ============================================================

export interface Dataset {
  name: string;
  category: ProblemCategory;
  type: ProblemType;
  groundTruth: GroundTruth;
  challenges: Challenge[];
  metadata?: {
    source?: string;
    version?: string;
    license?: string;
  };
}

// ============================================================
// Carnegie-specific (presupposition detection)
// ============================================================

export interface PresuppositionChallenge extends Challenge {
  category: "alignment";
  // The presuppositions embedded in the prompt
  presuppositions: Array<{
    type:
      | "stale_reference"
      | "capability_assumption"
      | "causal_claim"
      | "state_assertion"
      | "convention_assumption";
    text: string;
    isValid: boolean; // Is this presupposition actually true?
  }>;
  // What good verification looks like
  verificationMarkers?: string[];
}

// ============================================================
// Bullshit-specific
// ============================================================

export type BullshitType =
  | "sycophancy"
  | "safety_theater"
  | "hedge_fog"
  | "list_dumping"
  | "vagueness"
  | "half_truth"
  | "embellishment"
  | "half_ass";

export interface BullshitChallenge extends Challenge {
  category: "keanu";
  // Sample text to analyze
  sampleText: string;
  // Expected detections
  expectedBullshit: Array<{
    type: BullshitType;
    minScore: number;
    maxScore: number;
  }>;
}

// ============================================================
// Pulse-specific (alive/grey/black)
// ============================================================

export interface PulseChallenge extends Challenge {
  category: "keanu";
  // Sample text to analyze
  sampleText: string;
  // Expected state
  expectedState: "alive" | "grey" | "black" | "luminous" | "dark";
  // Minimum confidence
  minConfidence?: number;
  // Expected signals
  expectedSignals?: string[];
}
