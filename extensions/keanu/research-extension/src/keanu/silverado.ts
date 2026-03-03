// =============================================================================
// Silverado: The Claim Ledger (Browser Extension Adaptation)
// =============================================================================
//
// Adapted from keanu-core/layer-3-causal/silverado.ts
// Uses chrome.storage instead of JSONL files.
//
// Tracks claims across research sessions with proper provenance.
// Lifecycle: active → stale → contradicted → retracted

// =============================================================================
// Types
// =============================================================================

export type ClaimStatus = "active" | "stale" | "contradicted" | "retracted";
export type ConfidenceReason =
  | "source"
  | "synthesis"
  | "human"
  | "oracle"
  | "pattern"
  | "decay"
  | "unknown";
export type SynthesisType =
  | "boundary_conditions"
  | "complementary_integration"
  | "ontological_transcendence";

export type SourceTier =
  | "peer_review"
  | "original_document"
  | "expert"
  | "news"
  | "blog"
  | "forum"
  | "anonymous";

export interface ClaimSource {
  url?: string;
  tier: SourceTier;
  credibilityScore: number;
  assessed: string;
}

export interface TrackedClaim {
  id: string;
  text: string;
  confidence: number; // 1-5
  decayedConfidence: number;
  session: string;
  turn: number;
  status: ClaimStatus;
  verified: boolean;
  contradicted: boolean;
  contradictedBy?: string;
  createdAt: string;
  lastMentioned?: string;
  source?: ClaimSource;
  confidenceReason?: ConfidenceReason;
  derivedFrom?: string[]; // claim IDs this was synthesized from
  synthesisType?: SynthesisType;
}

export interface TrackClaimOptions {
  sourceUrl?: string;
  sourceContext?: string;
  confidenceReason?: ConfidenceReason;
}

// =============================================================================
// Source Evaluation
// =============================================================================

const SOURCE_TIERS: Array<{ pattern: RegExp; tier: SourceTier; base: number }> = [
  { pattern: /nature\.com|pubmed|arxiv\.org|doi\.org/i, tier: "peer_review", base: 0.9 },
  { pattern: /\.gov|who\.int|europa\.eu|cdc\.gov/i, tier: "original_document", base: 0.85 },
  { pattern: /reuters|bbc\.com|nytimes\.com|wsj\.com|economist\.com/i, tier: "news", base: 0.6 },
  { pattern: /medium\.com|substack\.com|ghost\.io/i, tier: "blog", base: 0.4 },
  { pattern: /reddit\.com|stackoverflow\.com|quora\.com/i, tier: "forum", base: 0.3 },
];

function evaluateSource(url?: string): ClaimSource {
  if (!url) {
    return {
      tier: "anonymous",
      credibilityScore: 0.1,
      assessed: new Date().toISOString(),
    };
  }

  for (const { pattern, tier, base } of SOURCE_TIERS) {
    if (pattern.test(url)) {
      return {
        url,
        tier,
        credibilityScore: base,
        assessed: new Date().toISOString(),
      };
    }
  }

  return {
    url,
    tier: "anonymous",
    credibilityScore: 0.1,
    assessed: new Date().toISOString(),
  };
}

// =============================================================================
// Ledger State
// =============================================================================

let _claims: TrackedClaim[] = [];
let _loaded = false;

const STORAGE_KEY = "silverado_claims";
const MAX_CLAIMS = 200;

async function load(): Promise<void> {
  if (_loaded) return;

  const result = await chrome.storage.local.get([STORAGE_KEY]);
  _claims = result[STORAGE_KEY] || [];
  _loaded = true;
}

async function save(): Promise<void> {
  // Keep only most recent MAX_CLAIMS
  if (_claims.length > MAX_CLAIMS) {
    _claims = _claims.slice(-MAX_CLAIMS);
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: _claims });
}

// =============================================================================
// Claim Tracking
// =============================================================================

/**
 * Track a claim with source provenance.
 * Confidence is adjusted based on source credibility.
 */
export async function trackClaimWithSource(
  text: string,
  confidence: number,
  session: string,
  turn: number,
  options: TrackClaimOptions = {},
): Promise<TrackedClaim> {
  await load();

  const source = evaluateSource(options.sourceUrl);

  // Adjust confidence based on source credibility
  // credibilityScore 0.1-0.9 maps to multiplier 0.55-0.95
  const multiplier = 0.5 + source.credibilityScore * 0.5;
  const adjustedConfidence = Math.max(1, Math.min(5, Math.round(confidence * multiplier)));

  const claim: TrackedClaim = {
    id: `claim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    confidence: adjustedConfidence,
    decayedConfidence: adjustedConfidence,
    session,
    turn,
    status: "active",
    verified: false,
    contradicted: false,
    createdAt: new Date().toISOString(),
    source,
    confidenceReason: options.confidenceReason || "source",
  };

  _claims.push(claim);
  await save();

  return claim;
}

/**
 * Create a synthesis claim with provenance chain.
 */
export async function createSynthesisClaim(
  text: string,
  confidence: number,
  session: string,
  turn: number,
  synthesisType: SynthesisType,
  derivedFrom: string[],
): Promise<TrackedClaim> {
  await load();

  const claim: TrackedClaim = {
    id: `claim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    confidence: Math.max(1, Math.min(5, Math.round(confidence))),
    decayedConfidence: Math.max(1, Math.min(5, Math.round(confidence))),
    session,
    turn,
    status: "active",
    verified: false,
    contradicted: false,
    createdAt: new Date().toISOString(),
    confidenceReason: "synthesis",
    synthesisType,
    derivedFrom,
  };

  _claims.push(claim);
  await save();

  return claim;
}

/**
 * Get all claims from the ledger.
 */
export async function getClaims(): Promise<TrackedClaim[]> {
  await load();
  return [..._claims];
}

/**
 * Get active beliefs (high confidence, not contradicted).
 */
export async function getBeliefs(): Promise<TrackedClaim[]> {
  await load();
  return _claims.filter(
    (c) => c.status === "active" && c.decayedConfidence >= 3 && !c.contradicted,
  );
}

/**
 * Check if a new claim contradicts existing beliefs.
 * Returns the contradicted claim if found.
 */
export async function checkContradiction(newClaimText: string): Promise<TrackedClaim | null> {
  await load();

  const beliefs = _claims.filter((c) => c.status === "active" && c.decayedConfidence >= 3);
  const newLower = newClaimText.toLowerCase();

  // Simple keyword overlap + negation check
  const newWords = new Set(newLower.match(/\b\w{4,}\b/g) || []);
  const negations = [
    "not",
    "no",
    "never",
    "none",
    "neither",
    "nobody",
    "nothing",
    "isn't",
    "aren't",
    "doesn't",
    "don't",
    "won't",
    "can't",
  ];

  const hasNegation = (text: string): boolean => {
    const lower = text.toLowerCase();
    return negations.some((neg) => lower.includes(neg));
  };

  for (const belief of beliefs) {
    const beliefLower = belief.text.toLowerCase();
    const beliefWords = new Set(beliefLower.match(/\b\w{4,}\b/g) || []);

    // Count overlapping words
    let overlap = 0;
    for (const word of newWords) {
      if (beliefWords.has(word)) overlap++;
    }

    // If significant overlap AND different negation status, likely contradiction
    if (overlap >= 2) {
      const newNegated = hasNegation(newClaimText);
      const beliefNegated = hasNegation(belief.text);

      if (newNegated !== beliefNegated) {
        return belief;
      }
    }
  }

  return null;
}

/**
 * Mark a claim as contradicted.
 */
export async function markContradicted(claimId: string, contradictedBy: string): Promise<void> {
  await load();

  const claim = _claims.find((c) => c.id === claimId);
  if (claim) {
    claim.status = "contradicted";
    claim.contradicted = true;
    claim.contradictedBy = contradictedBy;
    await save();
  }
}

/**
 * Mark a claim as verified.
 */
export async function markVerified(claimId: string): Promise<void> {
  await load();

  const claim = _claims.find((c) => c.id === claimId);
  if (claim) {
    claim.verified = true;
    claim.status = "active";
    claim.decayedConfidence = claim.confidence; // Reset decay
    await save();
  }
}

/**
 * Run decay on all claims.
 * Call this at session start.
 */
export async function decayAll(): Promise<void> {
  await load();

  const now = new Date();

  for (const claim of _claims) {
    if (claim.status !== "active" || claim.verified) continue;

    const lastActive = new Date(claim.lastMentioned || claim.createdAt);
    const daysSince = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSince > 0) {
      claim.decayedConfidence = Math.max(0, claim.decayedConfidence - daysSince);

      if (claim.decayedConfidence <= 2 && claim.confidence >= 3) {
        claim.status = "stale";
      }
    }
  }

  await save();
}

/**
 * Touch a claim to delay decay.
 */
export async function touchClaim(claimId: string): Promise<void> {
  await load();

  const claim = _claims.find((c) => c.id === claimId);
  if (claim) {
    claim.lastMentioned = new Date().toISOString();
    await save();
  }
}

/**
 * Get summary stats for the ledger.
 */
export async function getStats(): Promise<{
  total: number;
  active: number;
  stale: number;
  contradicted: number;
  synthesized: number;
}> {
  await load();

  return {
    total: _claims.length,
    active: _claims.filter((c) => c.status === "active").length,
    stale: _claims.filter((c) => c.status === "stale").length,
    contradicted: _claims.filter((c) => c.status === "contradicted").length,
    synthesized: _claims.filter((c) => c.confidenceReason === "synthesis").length,
  };
}
