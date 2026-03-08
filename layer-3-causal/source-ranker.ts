// source-ranker.ts
// Who said it matters as much as what was said.
//
// Peer-reviewed paper vs anonymous forum post vs your friend's hot take.
// Same claim, different weight. This module doesn't decide truth —
// it asks the questions that help you decide how much to trust.
//
// The six questions:
// 1. Who produced this? (attribution)
// 2. What are their incentives? (bias check)
// 3. What's their track record? (credibility)
// 4. Who funded it? (follow the money)
// 5. Has it been independently confirmed? (replication)
// 6. Is it falsifiable? (science check)
//
// Phase 1 of meta plan: closes the source → confidence loop.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { TrackedClaim, SourceTier, ClaimSource } from "../shared/types.ts";

// Re-export SourceTier for backwards compatibility
export type { SourceTier };

// ============================================================
// Types
// ============================================================

export interface SourceQuestions {
  whoProduced: string | null; // Attribution — who said this?
  incentives: string | null; // What do they gain from you believing?
  trackRecord: string | null; // History of accuracy/honesty
  funding: string | null; // Who paid for this?
  independentConfirmation: boolean; // Has anyone else verified?
  falsifiable: boolean; // Could it be proven wrong?
}

export interface SourceEvaluation {
  url: string;
  tier: SourceTier;
  credibilityScore: number; // 0-1
  questions: SourceQuestions;
  flags: string[]; // Concerns surfaced
  assessed: string; // Timestamp
}

// ============================================================
// Source Track Records (Phase 1: meta plan)
// ============================================================

export interface SourceTrackRecord {
  domain: string;
  tier: SourceTier;
  claimsMade: number;
  claimsVerified: number;
  claimsContradicted: number;
  accuracyRate: number; // claimsVerified / (claimsVerified + claimsContradicted)
  lastSeen: string; // ISO timestamp
}

// In-memory track record store
const trackRecords: Map<string, SourceTrackRecord> = new Map();

/**
 * Extract domain from URL for track record lookup.
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 50); // fallback for malformed URLs
  }
}

/**
 * Get or create a track record for a domain.
 */
export function getTrackRecord(url: string): SourceTrackRecord {
  const domain = extractDomain(url);
  const existing = trackRecords.get(domain);
  if (existing) {
    return existing;
  }

  const evaluation = evaluateSource(url);
  const newRecord: SourceTrackRecord = {
    domain,
    tier: evaluation.tier,
    claimsMade: 0,
    claimsVerified: 0,
    claimsContradicted: 0,
    accuracyRate: 0.5, // neutral start
    lastSeen: new Date().toISOString(),
  };
  trackRecords.set(domain, newRecord);
  return newRecord;
}

/**
 * Update track record when a claim outcome is observed.
 */
export function updateTrackRecord(
  url: string,
  outcome: "verified" | "contradicted" | "made",
): void {
  const domain = extractDomain(url);
  const record = getTrackRecord(url);

  if (outcome === "made") {
    record.claimsMade++;
  } else if (outcome === "verified") {
    record.claimsVerified++;
  } else if (outcome === "contradicted") {
    record.claimsContradicted++;
  }

  // Recalculate accuracy rate
  const total = record.claimsVerified + record.claimsContradicted;
  if (total > 0) {
    record.accuracyRate = record.claimsVerified / total;
  }

  record.lastSeen = new Date().toISOString();
  trackRecords.set(domain, record);
}

/**
 * Get all track records (for dashboard/debugging).
 */
export function getAllTrackRecords(): SourceTrackRecord[] {
  return Array.from(trackRecords.values()).toSorted((a, b) => b.claimsMade - a.claimsMade);
}

/**
 * Persist track records to disk.
 */
export async function saveTrackRecords(workspaceDir: string): Promise<void> {
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });
  const file = join(dir, "source-track-records.json");
  const data = Object.fromEntries(trackRecords);
  await writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Load track records from disk.
 */
export async function loadTrackRecords(workspaceDir: string): Promise<void> {
  const file = join(workspaceDir, "awareness", "source-track-records.json");
  try {
    const raw = await readFile(file, "utf-8");
    const data = JSON.parse(raw) as Record<string, SourceTrackRecord>;
    trackRecords.clear();
    for (const [domain, record] of Object.entries(data)) {
      trackRecords.set(domain, record);
    }
  } catch {
    // No prior records — start fresh
  }
}

/**
 * Convert a SourceEvaluation to ClaimSource for embedding in TrackedClaim.
 */
export function toClaimSource(evaluation: SourceEvaluation): ClaimSource {
  return {
    url: evaluation.url,
    tier: evaluation.tier,
    credibilityScore: evaluation.credibilityScore,
    flags: evaluation.flags,
    assessed: evaluation.assessed,
  };
}

// ============================================================
// Tier Detection
// ============================================================

const PEER_REVIEW_PATTERNS = [
  /nature\.com/i,
  /science\.org/i,
  /sciencedirect\.com/i,
  /pubmed\.ncbi\.nlm\.nih\.gov/i,
  /arxiv\.org/i,
  /springer\.com/i,
  /wiley\.com/i,
  /cell\.com/i,
  /plos\.org/i,
  /doi\.org/i,
  /\.edu\/.*paper|research|publication/i,
];

const OFFICIAL_PATTERNS = [
  /\.gov\b/i,
  /whitehouse\.gov/i,
  /congress\.gov/i,
  /europa\.eu/i,
  /who\.int/i,
  /sec\.gov/i,
  /fda\.gov/i,
  /cdc\.gov/i,
];

const NEWS_PATTERNS = [
  /reuters\.com/i,
  /apnews\.com/i,
  /bbc\.com/i,
  /nytimes\.com/i,
  /washingtonpost\.com/i,
  /theguardian\.com/i,
  /wsj\.com/i,
  /economist\.com/i,
  /ft\.com/i,
];

const FORUM_PATTERNS = [
  /reddit\.com/i,
  /quora\.com/i,
  /stackexchange\.com/i,
  /stackoverflow\.com/i,
  /discord\.com/i,
  /4chan/i,
  /twitter\.com/i,
  /x\.com/i,
];

const BLOG_PATTERNS = [
  /medium\.com/i,
  /substack\.com/i,
  /wordpress\.com/i,
  /blogspot\.com/i,
  /ghost\.io/i,
];

/**
 * Detect source tier from URL patterns.
 */
function detectTier(url: string): SourceTier {
  if (PEER_REVIEW_PATTERNS.some((p) => p.test(url))) {
    return "peer_review";
  }
  if (OFFICIAL_PATTERNS.some((p) => p.test(url))) {
    return "original_document";
  }
  if (NEWS_PATTERNS.some((p) => p.test(url))) {
    return "news";
  }
  if (BLOG_PATTERNS.some((p) => p.test(url))) {
    return "blog";
  }
  if (FORUM_PATTERNS.some((p) => p.test(url))) {
    return "forum";
  }
  // Can't identify — assume low credibility
  return "anonymous";
}

/**
 * Base credibility score by tier.
 */
function tierToBaseScore(tier: SourceTier): number {
  switch (tier) {
    case "peer_review":
      return 0.9;
    case "original_document":
      return 0.85;
    case "expert":
      return 0.75;
    case "news":
      return 0.6;
    case "blog":
      return 0.4;
    case "forum":
      return 0.3;
    case "anonymous":
      return 0.1;
  }
}

// ============================================================
// Flag Detection
// ============================================================

const BIAS_SIGNALS = [
  { pattern: /sponsored|paid|affiliate/i, flag: "commercial_interest" },
  { pattern: /opinion|editorial|op-ed/i, flag: "opinion_piece" },
  { pattern: /breaking|exclusive|shocking/i, flag: "sensationalism" },
  { pattern: /100%|guaranteed|proven|miracle/i, flag: "overclaiming" },
  { pattern: /they don't want you to know/i, flag: "conspiracy_framing" },
  { pattern: /mainstream media|msm|fake news/i, flag: "anti_establishment" },
];

function detectFlags(text: string): string[] {
  const flags: string[] = [];
  for (const { pattern, flag } of BIAS_SIGNALS) {
    if (pattern.test(text)) {
      flags.push(flag);
    }
  }
  return flags;
}

// ============================================================
// Core API
// ============================================================

/**
 * Evaluate a source's credibility.
 * Returns tier, score, and the questions worth asking.
 */
export function evaluateSource(url: string, context?: string): SourceEvaluation {
  const tier = detectTier(url);
  let credibilityScore = tierToBaseScore(tier);

  // Detect flags from context if provided
  const flags = context ? detectFlags(context) : [];

  // Adjust score based on flags
  if (flags.includes("commercial_interest")) {
    credibilityScore *= 0.7;
  }
  if (flags.includes("opinion_piece")) {
    credibilityScore *= 0.8;
  }
  if (flags.includes("sensationalism")) {
    credibilityScore *= 0.6;
  }
  if (flags.includes("overclaiming")) {
    credibilityScore *= 0.5;
  }
  if (flags.includes("conspiracy_framing")) {
    credibilityScore *= 0.3;
  }

  // The questions we can't auto-answer but should be asked
  const questions: SourceQuestions = {
    whoProduced: null, // Needs human investigation
    incentives: null, // Needs context
    trackRecord: null, // Needs history
    funding: null, // Often hidden
    independentConfirmation: false, // Default pessimistic
    falsifiable: true, // Assume science-able unless shown otherwise
  };

  return {
    url,
    tier,
    credibilityScore: Math.max(0, Math.min(1, credibilityScore)),
    questions,
    flags,
    assessed: new Date().toISOString(),
  };
}

/**
 * Rank multiple sources by credibility.
 * Returns evaluations sorted high to low.
 */
export function rankSources(urls: string[]): SourceEvaluation[] {
  const evaluations = urls.map((url) => evaluateSource(url));
  return evaluations.toSorted((a, b) => b.credibilityScore - a.credibilityScore);
}

/**
 * Adjust a claim's confidence based on its source.
 * Higher credibility sources boost confidence; lower ones diminish it.
 */
export function adjustClaimConfidence(claim: TrackedClaim, source: SourceEvaluation): number {
  // Source credibility acts as a multiplier
  // Perfect source (1.0) keeps confidence unchanged
  // Zero credibility source halves confidence
  const multiplier = 0.5 + source.credibilityScore * 0.5;
  return Math.min(5, Math.max(0, claim.confidence * multiplier));
}

/**
 * Adjust a claim's confidence using track record history.
 * Combines immediate evaluation with historical accuracy.
 *
 * Phase 1: Source integration (meta plan).
 */
export function adjustClaimConfidenceWithHistory(
  claim: TrackedClaim,
  source: SourceEvaluation,
): number {
  const record = getTrackRecord(source.url);

  // Weight: 60% immediate evaluation, 40% historical track record
  const immediateScore = source.credibilityScore;
  const historicalScore = record.claimsMade >= 3 ? record.accuracyRate : 0.5; // need 3+ claims for history

  const combinedScore = immediateScore * 0.6 + historicalScore * 0.4;
  const multiplier = 0.5 + combinedScore * 0.5;

  return Math.min(5, Math.max(0, claim.confidence * multiplier));
}

/** Reset for testing. */
export function resetTrackRecords(): void {
  trackRecords.clear();
}

/**
 * Generate a summary for injection.
 * Only surfaces when there are concerns worth noting.
 */
export function formatInjection(evaluation: SourceEvaluation): string | null {
  if (evaluation.credibilityScore >= 0.7 && evaluation.flags.length === 0) {
    return null; // Good source, no concerns
  }

  const parts: string[] = [];

  if (evaluation.credibilityScore < 0.5) {
    parts.push(`low credibility (${(evaluation.credibilityScore * 100).toFixed(0)}%)`);
  }

  if (evaluation.flags.length > 0) {
    parts.push(`flags: ${evaluation.flags.join(", ")}`);
  }

  if (evaluation.tier === "anonymous" || evaluation.tier === "forum") {
    parts.push(`source tier: ${evaluation.tier}`);
  }

  if (parts.length === 0) {
    return null;
  }

  return `[source: ${parts.join(" | ")}]`;
}

/**
 * Format for dashboard display.
 */
export function formatDashboard(evaluations: SourceEvaluation[]): string {
  if (evaluations.length === 0) {
    return "No sources evaluated.";
  }

  const lines = evaluations.map((e) => {
    const score = (e.credibilityScore * 100).toFixed(0);
    const flags = e.flags.length > 0 ? ` [${e.flags.join(", ")}]` : "";
    return `[${e.tier}] ${score}% — ${e.url.slice(0, 50)}${flags}`;
  });

  return `Source Rankings:\n${lines.join("\n")}`;
}

// ============================================================
// Questions Helper
// ============================================================

/**
 * Generate the questions worth asking about a source.
 * Returns a formatted prompt for investigation.
 */
export function generateQuestions(url: string): string {
  const evaluation = evaluateSource(url);

  const questions = [
    `1. Who produced "${url}"? (Can you identify the author/organization?)`,
    "2. What are their incentives? (What do they gain from you believing this?)",
    "3. What's their track record? (Have they been reliable before?)",
    "4. Who funded this? (Follow the money)",
    "5. Has it been independently confirmed? (Who else has verified?)",
    "6. Is it falsifiable? (Could new evidence prove it wrong?)",
  ];

  const context =
    evaluation.tier === "anonymous"
      ? "Warning: Source has unknown provenance. Extra skepticism warranted."
      : evaluation.tier === "peer_review"
        ? "Note: Source is peer-reviewed, but still worth asking these questions."
        : `Note: Source tier is "${evaluation.tier}".`;

  return `${context}\n\n${questions.join("\n")}`;
}
