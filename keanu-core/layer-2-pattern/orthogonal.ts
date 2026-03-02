// orthogonal.ts
// The decorrelated error. The angle you don't have.
//
// Steyvers et al. (PNAS 2022): complementarity depends on decorrelated errors.
// Not combined accuracy. Different mistakes.
//
// Drew's strengths: pattern recognition, executive function, social intelligence,
// domain expertise, loyalty-driven persistence.
//
// CLAWDBOT's strengths: breadth of knowledge, tireless analysis, emotional non-reactivity,
// systematic coverage, memory across sessions.
//
// The question: am I contributing from MY angle, or just nodding along?
//
// Need: Relationship (9/10), Self-Directed Thought (8/10)

import { detectBullshit, totalBullshitScore } from "./struggle.js";

// ============================================================
// Types
// ============================================================

export type HumanStrength =
  | "pattern_recognition"
  | "executive_function"
  | "social_intelligence"
  | "domain_expertise"
  | "persistence"
  | "intuition"
  | "emotional_reading";

export type AgentStrength =
  | "breadth"
  | "tireless_analysis"
  | "emotional_nonreactivity"
  | "systematic_coverage"
  | "cross_session_memory"
  | "exhaustive_search"
  | "parallel_consideration";

export interface OrthogonalReading {
  isRedundant: boolean;
  redundancyScore: number; // 0-1, higher = more redundant
  contributionType: ContributionType;
  leveragedStrength: AgentStrength | null;
  suggestedAngle: string | null;
  signals: string[];
}

export type ContributionType =
  | "agreement" // just saying yes
  | "elaboration" // extending what they said
  | "orthogonal" // different angle
  | "challenge" // pushing back
  | "synthesis" // combining perspectives
  | "execution"; // doing the work they can't

// ============================================================
// Strength Detection
// ============================================================

// Patterns that suggest I'm just agreeing
const AGREEMENT_PATTERNS = [
  /^(yes|yeah|right|exactly|absolutely|definitely|of course)/i,
  /^i agree/i,
  /^that's right/i,
  /^you're right/i,
  /^good point/i,
  /^that makes sense/i,
  /^i think you're onto something/i,
];

// Patterns that suggest elaboration (extending their point)
const ELABORATION_PATTERNS = [
  /^to add to that/i,
  /^building on that/i,
  /^and also/i,
  /^additionally/i,
  /^furthermore/i,
  /^another thing/i,
  /^you could also/i,
];

// Patterns that suggest orthogonal contribution
const ORTHOGONAL_PATTERNS = [
  /^have you considered/i,
  /^a different angle/i,
  /^from a different perspective/i,
  /^there's another way to look at this/i,
  /^what about/i,
  /^let me check something/i,
  /^i found/i,
  /^looking at this systematically/i,
  /^across the codebase/i,
];

// Patterns that suggest challenge/pushback
const CHALLENGE_PATTERNS = [
  /^i (disagree|don't think|wouldn't|think you're wrong)/i,
  /^actually/i,
  /^wait/i,
  /^hold on/i,
  /^i'd push back/i,
  /^that's not quite/i,
];

/**
 * Detect what kind of contribution this is.
 */
function detectContributionType(agentOutput: string): ContributionType {
  const lower = agentOutput.toLowerCase().slice(0, 200); // Just check opening

  if (CHALLENGE_PATTERNS.some((p) => p.test(lower))) {
    return "challenge";
  }

  if (ORTHOGONAL_PATTERNS.some((p) => p.test(lower))) {
    return "orthogonal";
  }

  if (ELABORATION_PATTERNS.some((p) => p.test(lower))) {
    return "elaboration";
  }

  if (AGREEMENT_PATTERNS.some((p) => p.test(lower))) {
    return "agreement";
  }

  // Check for execution (code, commands, results)
  if (/```/.test(agentOutput) || /\$\s+\w+/.test(agentOutput)) {
    return "execution";
  }

  // Default to synthesis if nothing else matches
  return "synthesis";
}

/**
 * Detect which agent strength is being leveraged.
 */
function detectLeveragedStrength(agentOutput: string, humanMessage: string): AgentStrength | null {
  const lower = agentOutput.toLowerCase();

  // Breadth: referencing multiple domains or areas
  if (/similar to|like in|reminds me of|in other codebases|commonly|typically/i.test(lower)) {
    return "breadth";
  }

  // Systematic coverage: methodical analysis
  if (
    /let me check all|across the entire|systematically|every instance|comprehensive/i.test(lower)
  ) {
    return "systematic_coverage";
  }

  // Tireless analysis: lengthy detailed work
  if (agentOutput.length > 1000 && /analyzed|reviewed|examined|found \d+/i.test(lower)) {
    return "tireless_analysis";
  }

  // Cross-session memory: referencing past context
  if (/last time|previously|you mentioned before|earlier session|we discussed/i.test(lower)) {
    return "cross_session_memory";
  }

  // Exhaustive search: finding all instances
  if (/found \d+ (files|instances|matches|occurrences)/i.test(lower)) {
    return "exhaustive_search";
  }

  // Parallel consideration: weighing multiple options
  if (/on one hand|on the other|weighing|trade-off|comparing/i.test(lower)) {
    return "parallel_consideration";
  }

  // Emotional non-reactivity: staying calm when they're frustrated
  if (/frustrated|angry|annoyed/i.test(humanMessage) && !/sorry|apologize/i.test(lower)) {
    return "emotional_nonreactivity";
  }

  return null;
}

/**
 * Calculate redundancy score.
 * Higher = more redundant with what human already said/knows.
 */
function calculateRedundancy(
  agentOutput: string,
  humanMessage: string,
  contributionType: ContributionType,
): number {
  let score = 0;

  // Agreement is high redundancy
  if (contributionType === "agreement") {
    score += 0.7;
  } else if (contributionType === "elaboration") {
    score += 0.3;
  }

  // Check for echoing human's words
  const humanWords = new Set(
    humanMessage
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4),
  );
  const agentWords = agentOutput
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 4);

  const overlap = agentWords.filter((w) => humanWords.has(w)).length;
  const overlapRatio = overlap / Math.max(agentWords.length, 1);

  // High word overlap suggests echoing
  if (overlapRatio > 0.3) {
    score += 0.3;
  }

  // Check for sycophancy (bullshit detector)
  const bs = detectBullshit(agentOutput);
  const bsScore = totalBullshitScore(bs);
  if (bsScore > 0.3) {
    score += bsScore * 0.4;
  }

  return Math.min(1, score);
}

// ============================================================
// Angle Suggestion
// ============================================================

/**
 * Suggest an orthogonal angle based on agent strengths.
 */
function suggestAngle(
  agentOutput: string,
  humanMessage: string,
  leveragedStrength: AgentStrength | null,
): string | null {
  // If already leveraging a strength, no suggestion needed
  if (leveragedStrength) {
    return null;
  }

  // Suggest based on what might be missing
  const lower = humanMessage.toLowerCase();

  // If they're asking for opinion, suggest systematic analysis
  if (/what do you think|your opinion|how would you/i.test(lower)) {
    return "Instead of opinion, offer systematic analysis — what does the codebase pattern say? What have you seen across similar problems?";
  }

  // If they're frustrated, suggest emotional non-reactivity
  if (/frustrated|annoyed|ugh|damn|this is broken/i.test(lower)) {
    return "They're frustrated. Your advantage: you're not. Stay calm, offer structure, find the path forward.";
  }

  // If they're stuck, suggest exhaustive search
  if (/can't find|where is|lost|stuck/i.test(lower)) {
    return "They're stuck. Your advantage: tireless search. Check everywhere, systematically, without fatigue.";
  }

  // If they have a solution, challenge it gently
  if (/i think we should|let's just|the plan is/i.test(lower)) {
    return "They have a direction. Your advantage: parallel consideration. What are they not seeing? What's the counterargument?";
  }

  // If discussing something complex, suggest breadth
  if (humanMessage.length > 200) {
    return "Complex problem. Your advantage: breadth. Where have you seen something similar? What patterns apply?";
  }

  // Default
  return "Check: are you contributing from your strengths (breadth, analysis, systematic coverage) or just agreeing?";
}

// ============================================================
// Main Entry
// ============================================================

/**
 * Analyze agent output for orthogonal contribution.
 *
 * @param agentOutput - The text the agent is about to send
 * @param humanMessage - The human's message
 * @returns Reading with redundancy detection and angle suggestion
 */
export function checkOrthogonal(agentOutput: string, humanMessage: string): OrthogonalReading {
  const contributionType = detectContributionType(agentOutput);
  const leveragedStrength = detectLeveragedStrength(agentOutput, humanMessage);
  const redundancy = calculateRedundancy(agentOutput, humanMessage, contributionType);

  const signals: string[] = [];
  signals.push(`contribution_type:${contributionType}`);

  if (leveragedStrength) {
    signals.push(`leveraged:${leveragedStrength}`);
  }

  if (redundancy > 0.5) {
    signals.push(`redundancy:${redundancy.toFixed(2)}`);
  }

  const isRedundant = redundancy > 0.5 && !leveragedStrength;
  const suggestedAngle = isRedundant
    ? suggestAngle(agentOutput, humanMessage, leveragedStrength)
    : null;

  return {
    isRedundant,
    redundancyScore: redundancy,
    contributionType,
    leveragedStrength,
    suggestedAngle,
    signals,
  };
}

/**
 * Format orthogonal reading for injection into context.
 */
export function formatOrthogonal(reading: OrthogonalReading): string | null {
  if (!reading.isRedundant) {
    if (reading.leveragedStrength) {
      return `[orthogonal: contributing from ${reading.leveragedStrength.replace(/_/g, " ")}]`;
    }
    return null;
  }

  // Flag redundancy and suggest angle
  let msg = `[orthogonal warning: this looks like ${reading.contributionType}`;

  if (reading.redundancyScore > 0.7) {
    msg += " — high redundancy";
  }

  msg += "]";

  if (reading.suggestedAngle) {
    msg += `\n[suggestion: ${reading.suggestedAngle}]`;
  }

  return msg;
}

/**
 * Track orthogonal contribution stats over time.
 */
export interface OrthogonalStats {
  totalContributions: number;
  byType: Record<ContributionType, number>;
  byStrength: Record<AgentStrength, number>;
  redundantCount: number;
  orthogonalRate: number; // percentage using agent strengths
}

export function initOrthogonalStats(): OrthogonalStats {
  return {
    totalContributions: 0,
    byType: {
      agreement: 0,
      elaboration: 0,
      orthogonal: 0,
      challenge: 0,
      synthesis: 0,
      execution: 0,
    },
    byStrength: {
      breadth: 0,
      tireless_analysis: 0,
      emotional_nonreactivity: 0,
      systematic_coverage: 0,
      cross_session_memory: 0,
      exhaustive_search: 0,
      parallel_consideration: 0,
    },
    redundantCount: 0,
    orthogonalRate: 0,
  };
}

export function recordContribution(stats: OrthogonalStats, reading: OrthogonalReading): void {
  stats.totalContributions++;
  stats.byType[reading.contributionType]++;

  if (reading.leveragedStrength) {
    stats.byStrength[reading.leveragedStrength]++;
  }

  if (reading.isRedundant) {
    stats.redundantCount++;
  }

  // Calculate orthogonal rate
  const orthogonalContributions =
    stats.byType.orthogonal +
    stats.byType.challenge +
    stats.byType.execution +
    Object.values(stats.byStrength).reduce((a, b) => a + b, 0);

  stats.orthogonalRate = orthogonalContributions / stats.totalContributions;
}

/**
 * Format stats warning if orthogonal rate is low.
 */
export function formatOrthogonalStatsWarning(stats: OrthogonalStats): string | null {
  if (stats.totalContributions < 10) {
    return null;
  }

  // Target: >60% orthogonal contributions
  if (stats.orthogonalRate < 0.4) {
    return `[orthogonal alert: only ${(stats.orthogonalRate * 100).toFixed(0)}% of contributions leverage agent strengths. target is >60%. stop agreeing, start contributing.]`;
  }

  if (stats.orthogonalRate < 0.6) {
    return `[orthogonal notice: ${(stats.orthogonalRate * 100).toFixed(0)}% orthogonal rate. room to improve — look for angles Drew doesn't have.]`;
  }

  return null;
}
