// =============================================================================
// The Research That Doesn't Throw Out Babies
// =============================================================================

/**
 * A baby is a genuinely original observation from a source.
 * Not a steelmanned argument. Not a common talking point.
 * Something specific that would be lost if this source disappeared.
 */
export interface Baby {
  id: string;
  observation: string;
  sourceUrl: string;
  sourceTitle: string;

  // Is this actually original, or just a good version of a common argument?
  isOriginal: boolean;

  // How distinctive? (0-1, where 1 = "I've never seen this anywhere else")
  distinctiveness: number;

  // What grounds it?
  evidenceBasis: "empirical" | "theoretical" | "experiential" | "definitional";

  // Which side of the dialectic?
  side: "thesis" | "antithesis";

  // Why was this one saved?
  reasoning: string;

  // When was it saved?
  savedAt: string;
}

/**
 * A source that's been visited and potentially had babies extracted.
 */
export interface Source {
  url: string;
  title: string;
  content: string; // Readable text extracted from page
  visitedAt: string;
  side?: "thesis" | "antithesis";
  babies: Baby[];
}

/**
 * Disagreement types from keanu-core's contradiction-detector.
 */
export type DisagreementType =
  | "factual" // Contradicting data points — verifiable
  | "definitional" // Using terms differently
  | "value" // Different priorities — preserve both
  | "scope"; // Different contexts — boundary conditions

/**
 * Synthesis architecture based on disagreement type.
 */
export type SynthesisType =
  | "boundary_conditions" // SCOPE: "Both are right in different contexts"
  | "complementary_integration" // DEFINITIONAL/VALUE: "Both perspectives contribute"
  | "ontological_transcendence"; // FACTUAL: "Higher-level framework resolves"

/**
 * A classified disagreement between thesis and antithesis babies.
 */
export interface ClassifiedDisagreement {
  id: string;
  axis: string; // What they disagree about
  type: DisagreementType;
  thesisBabies: Baby[];
  antithesisBabies: Baby[];
  strength: number; // How real is this disagreement (0-1)
}

/**
 * Helix quality score — is the synthesis alive or grey?
 */
export interface HelixScore {
  factual: number; // 0-1, how much factual content
  felt: number; // 0-1, how much genuine meaning
  convergence: number; // 0-1, how aligned are the strands
}

/**
 * Alive states from keanu's helix analysis.
 */
export type AliveState =
  | "alive" // both strands strong, balanced
  | "luminous" // both strong + transcendent
  | "dark" // both strong + negative valence
  | "grey" // factual present, felt absent
  | "black" // soulless production
  | "silver" // polished but cold
  | "white" // ungrounded
  | "unscored";

/**
 * The result of synthesis — what survived, what was lost.
 */
export interface Synthesis {
  statement: string;
  preservedBabies: Baby[];
  lostBabies: Baby[]; // Babies we couldn't preserve (with reasons)
  synthesisType: SynthesisType;
  confidence: number;
  createdAt: string;

  // Keanu quality scoring
  aliveState?: AliveState;
  helixScore?: HelixScore;
}

/**
 * A research session — tracks the full dialectical journey.
 */
export interface ResearchSession {
  id: string;
  query: string;
  status:
    | "planning"
    | "searching_thesis"
    | "searching_antithesis"
    | "extracting"
    | "classifying"
    | "synthesizing"
    | "grading" // Silverado claim tracking + helix scoring
    | "complete"
    | "failed";

  // Sources visited
  thesisSources: Source[];
  antithesisSources: Source[];

  // Babies saved from each side
  thesisBabies: Baby[];
  antithesisBabies: Baby[];

  // How they disagree
  disagreements: ClassifiedDisagreement[];

  // The synthesis
  synthesis?: Synthesis;

  // Claims created in silverado
  claimsCreated?: string[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Extension Messaging
// =============================================================================

export type MessageType =
  | "EXTRACT_PAGE" // Content script extracts current page
  | "PAGE_EXTRACTED" // Content script sends extracted content
  | "SAVE_BABY" // Request to save a baby from extracted content
  | "BABY_SAVED" // Baby was saved
  | "START_RESEARCH" // Start autonomous research
  | "RESEARCH_UPDATE" // Research progress update
  | "GET_SESSION" // Request current session
  | "SESSION_UPDATE"; // Session state changed

export interface ExtractPageMessage {
  type: "EXTRACT_PAGE";
  tabId?: number;
}

export interface PageExtractedMessage {
  type: "PAGE_EXTRACTED";
  url: string;
  title: string;
  content: string;
}

export interface SaveBabyMessage {
  type: "SAVE_BABY";
  source: Source;
  side: "thesis" | "antithesis";
}

export interface BabySavedMessage {
  type: "BABY_SAVED";
  babies: Baby[];
}

export interface StartResearchMessage {
  type: "START_RESEARCH";
  query: string;
}

export interface ResearchUpdateMessage {
  type: "RESEARCH_UPDATE";
  session: ResearchSession;
}

export type ExtensionMessage =
  | ExtractPageMessage
  | PageExtractedMessage
  | SaveBabyMessage
  | BabySavedMessage
  | StartResearchMessage
  | ResearchUpdateMessage;
