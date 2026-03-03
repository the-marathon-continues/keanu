// =============================================================================
// Pipeline: The 9-node dialectical research flow
// =============================================================================
//
// 1. Plan — decompose query, hypothesize disagreement axes
// 2. Thesis Search — Google search, open tabs
// 3. Baby Save (Thesis) — extract original observations
// 4. Antithesis Search — adversarial "kill queries"
// 5. Baby Save (Antithesis) — extract from counter-evidence
// 6. Classify Disagreements — FACTUAL/DEFINITIONAL/VALUE/SCOPE
// 7. Select Synthesis Architecture — route to appropriate synthesis
// 8. Synthesize — baby-preserving synthesis
// 9. Update Epistemic State — GRADE scoring, claim tracking

// Keanu integration
import {
  classifyDisagreement as classifyDisagreementKeanu,
  selectSynthesisType as selectSynthesisTypeKeanu,
} from "../keanu/contradiction-detector.js";
import { analyzeHelix } from "../keanu/helix.js";
import {
  trackClaimWithSource,
  createSynthesisClaim,
  checkContradiction,
  markContradicted,
} from "../keanu/silverado.js";
import type {
  ResearchSession,
  Source,
  Baby,
  ClassifiedDisagreement,
  Synthesis,
  DisagreementType,
  SynthesisType,
} from "../shared/types.js";
import { saveBabies, filterGenuineBabies } from "./baby-saver.js";
import { searchGoogle, visitPages, generateKillQueries } from "./navigator.js";

// =============================================================================
// Types
// =============================================================================

export interface PipelineConfig {
  apiKey: string;
  maxSourcesPerSide: number;
  maxBabiesPerSource: number;
}

export type SessionUpdateCallback = (session: ResearchSession) => void;

// =============================================================================
// Pipeline
// =============================================================================

/**
 * Run the full 9-node dialectical research pipeline.
 */
export async function runPipeline(
  query: string,
  config: PipelineConfig,
  onUpdate: SessionUpdateCallback,
): Promise<ResearchSession> {
  const session = createSession(query);
  onUpdate(session);

  try {
    // ==========================================================================
    // Node 1: Plan
    // ==========================================================================
    session.status = "planning";
    onUpdate(session);

    // For now, we use the query directly. In future, decompose into sub-questions
    // and hypothesize disagreement axes using LLM.
    const thesisQuery = query;
    const antithesisQueries = generateKillQueries(query);

    // ==========================================================================
    // Node 2: Thesis Search
    // ==========================================================================
    session.status = "searching_thesis";
    onUpdate(session);

    const thesisResults = await searchGoogle(thesisQuery, {
      maxResults: config.maxSourcesPerSide,
    });

    const thesisUrls = thesisResults.map((r) => r.url);
    const thesisSources = await visitPages(thesisUrls);
    session.thesisSources = thesisSources;
    onUpdate(session);

    // ==========================================================================
    // Node 3: Baby Save (Thesis)
    // ==========================================================================
    session.status = "extracting";
    onUpdate(session);

    for (const source of thesisSources) {
      const babies = await saveBabies(source, "thesis", config.apiKey);
      const filtered = filterGenuineBabies(babies);
      source.babies = filtered;
      session.thesisBabies.push(...filtered);
      onUpdate(session);
    }

    // ==========================================================================
    // Node 4: Antithesis Search
    // ==========================================================================
    session.status = "searching_antithesis";
    onUpdate(session);

    // Search with each kill query and collect results
    const antithesisUrls: string[] = [];
    for (const aq of antithesisQueries.slice(0, 3)) {
      // Limit kill queries
      const results = await searchGoogle(aq, { maxResults: 2 });
      antithesisUrls.push(...results.map((r) => r.url));
    }

    // Dedupe and limit
    const uniqueAntithesisUrls = [...new Set(antithesisUrls)].slice(0, config.maxSourcesPerSide);
    const antithesisSources = await visitPages(uniqueAntithesisUrls);
    session.antithesisSources = antithesisSources;
    onUpdate(session);

    // ==========================================================================
    // Node 5: Baby Save (Antithesis)
    // ==========================================================================
    session.status = "extracting";
    onUpdate(session);

    for (const source of antithesisSources) {
      const babies = await saveBabies(source, "antithesis", config.apiKey);
      const filtered = filterGenuineBabies(babies);
      source.babies = filtered;
      session.antithesisBabies.push(...filtered);
      onUpdate(session);
    }

    // ==========================================================================
    // Node 6: Classify Disagreements
    // ==========================================================================
    session.status = "classifying";
    onUpdate(session);

    session.disagreements = classifyDisagreements(session.thesisBabies, session.antithesisBabies);
    onUpdate(session);

    // ==========================================================================
    // Node 7 & 8: Select Architecture & Synthesize
    // ==========================================================================
    session.status = "synthesizing";
    onUpdate(session);

    session.synthesis = synthesize(
      session.thesisBabies,
      session.antithesisBabies,
      session.disagreements,
    );
    onUpdate(session);

    // ==========================================================================
    // Node 9: Update Epistemic State (Silverado + Helix)
    // ==========================================================================
    session.status = "grading";
    onUpdate(session);

    // Track babies as claims in silverado
    const claimIds: string[] = [];
    let turnNumber = 1;

    for (const baby of [...session.thesisBabies, ...session.antithesisBabies]) {
      // Convert distinctiveness (0-1) to confidence (1-5)
      const confidence = Math.ceil(baby.distinctiveness * 5);

      // Check for contradictions with existing beliefs
      const contradicted = await checkContradiction(baby.observation);
      if (contradicted) {
        await markContradicted(contradicted.id, baby.observation);
        console.log(
          `[pipeline] New observation contradicts existing claim: ${contradicted.text.slice(0, 50)}...`,
        );
      }

      // Track the claim
      const claim = await trackClaimWithSource(
        baby.observation,
        confidence,
        session.id,
        turnNumber++,
        {
          sourceUrl: baby.sourceUrl,
          sourceContext: baby.sourceTitle,
          confidenceReason: "source",
        },
      );
      claimIds.push(claim.id);
    }

    // Score synthesis quality with helix
    if (session.synthesis) {
      const helixResult = analyzeHelix(session.synthesis.statement);
      session.synthesis.aliveState = helixResult.aliveState;
      session.synthesis.helixScore = {
        factual: helixResult.strands.factual,
        felt: helixResult.strands.felt,
        convergence: helixResult.strands.convergence,
      };

      if (helixResult.aliveState === "grey" || helixResult.aliveState === "black") {
        console.warn(
          `[pipeline] Synthesis scored ${helixResult.aliveState}: ${helixResult.diagnosis}`,
        );
        // Could re-run synthesis with different prompt here
      }

      // Track synthesis as a claim with provenance chain
      const synthesisClaim = await createSynthesisClaim(
        session.synthesis.statement,
        Math.ceil(session.synthesis.confidence * 5),
        session.id,
        turnNumber,
        session.synthesis.synthesisType,
        claimIds, // derivedFrom — all the baby claims
      );
      claimIds.push(synthesisClaim.id);
    }

    session.claimsCreated = claimIds;
    session.status = "complete";
    session.updatedAt = new Date().toISOString();
    onUpdate(session);

    return session;
  } catch (error) {
    console.error("[pipeline] Research failed:", error);
    session.status = "failed";
    onUpdate(session);
    return session;
  }
}

// =============================================================================
// Session Management
// =============================================================================

function createSession(query: string): ResearchSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    query,
    status: "planning",
    thesisSources: [],
    antithesisSources: [],
    thesisBabies: [],
    antithesisBabies: [],
    disagreements: [],
    createdAt: now,
    updatedAt: now,
  };
}

// =============================================================================
// Node 6: Disagreement Classification
// =============================================================================

/**
 * Classify disagreements between thesis and antithesis babies.
 *
 * Uses pattern-based classification similar to keanu-core's
 * contradiction-detector.ts. In future, this should import
 * directly from keanu-core.
 */
function classifyDisagreements(
  thesisBabies: Baby[],
  antithesisBabies: Baby[],
): ClassifiedDisagreement[] {
  const disagreements: ClassifiedDisagreement[] = [];

  // Simple approach: check each thesis baby against each antithesis baby
  // for semantic overlap and contradiction patterns
  for (const thesis of thesisBabies) {
    for (const antithesis of antithesisBabies) {
      // Check if they're talking about the same thing
      const overlap = calculateOverlap(thesis.observation, antithesis.observation);

      if (overlap > 0.2) {
        // They overlap enough to potentially disagree
        const type = classifyDisagreementType(thesis.observation, antithesis.observation);

        disagreements.push({
          id: crypto.randomUUID(),
          axis: extractAxis(thesis.observation, antithesis.observation),
          type,
          thesisBabies: [thesis],
          antithesisBabies: [antithesis],
          strength: overlap,
        });
      }
    }
  }

  // Dedupe and merge similar disagreements
  return mergeDisagreements(disagreements);
}

/**
 * Classify the type of disagreement.
 * Now uses keanu's contradiction-detector.
 */
function classifyDisagreementType(claim1: string, claim2: string): DisagreementType {
  return classifyDisagreementKeanu(claim1, claim2);
}

/**
 * Select synthesis architecture based on disagreement type.
 * Now uses keanu's contradiction-detector.
 */
function selectSynthesisType(disagreementType: DisagreementType): SynthesisType {
  return selectSynthesisTypeKeanu(disagreementType);
}

// =============================================================================
// Node 8: Synthesis
// =============================================================================

/**
 * Synthesize thesis and antithesis babies, preserving as many as possible.
 *
 * This is a simplified version. In future, this should use keanu-core's
 * DialecticalEngine for proper thesis→antithesis→synthesis iteration.
 */
function synthesize(
  thesisBabies: Baby[],
  antithesisBabies: Baby[],
  disagreements: ClassifiedDisagreement[],
): Synthesis {
  // Determine primary synthesis type from disagreements
  let primaryType: SynthesisType = "complementary_integration";

  if (disagreements.length > 0) {
    // Use the type of the strongest disagreement
    const sorted = [...disagreements].sort((a, b) => b.strength - a.strength);
    primaryType = selectSynthesisType(sorted[0].type);
  }

  // Build synthesis statement
  const allBabies = [...thesisBabies, ...antithesisBabies];
  const preserved = allBabies.filter((b) => b.distinctiveness > 0.5);
  const lost = allBabies.filter((b) => b.distinctiveness <= 0.5);

  // Generate synthesis statement based on type
  let statement: string;

  switch (primaryType) {
    case "boundary_conditions":
      statement = buildBoundaryConditionsSynthesis(thesisBabies, antithesisBabies);
      break;
    case "complementary_integration":
      statement = buildComplementarySynthesis(thesisBabies, antithesisBabies);
      break;
    case "ontological_transcendence":
      statement = buildTranscendentSynthesis(thesisBabies, antithesisBabies);
      break;
  }

  return {
    statement,
    preservedBabies: preserved,
    lostBabies: lost,
    synthesisType: primaryType,
    confidence: calculateSynthesisConfidence(preserved, lost),
    createdAt: new Date().toISOString(),
  };
}

function buildBoundaryConditionsSynthesis(thesis: Baby[], antithesis: Baby[]): string {
  const thesisPoints = thesis.slice(0, 2).map((b) => b.observation);
  const antiPoints = antithesis.slice(0, 2).map((b) => b.observation);

  return (
    `Both perspectives are valid in their respective contexts. ` +
    `The thesis sources observed: ${thesisPoints.join("; ")}. ` +
    `The antithesis sources observed: ${antiPoints.join("; ")}. ` +
    `These findings apply to different situations and can coexist.`
  );
}

function buildComplementarySynthesis(thesis: Baby[], antithesis: Baby[]): string {
  const thesisPoints = thesis.slice(0, 2).map((b) => b.observation);
  const antiPoints = antithesis.slice(0, 2).map((b) => b.observation);

  return (
    `Both perspectives contribute unique insights. ` +
    `From the thesis: ${thesisPoints.join("; ")}. ` +
    `From the antithesis: ${antiPoints.join("; ")}. ` +
    `A complete picture integrates both viewpoints.`
  );
}

function buildTranscendentSynthesis(thesis: Baby[], antithesis: Baby[]): string {
  const thesisPoints = thesis.slice(0, 2).map((b) => b.observation);
  const antiPoints = antithesis.slice(0, 2).map((b) => b.observation);

  return (
    `The apparent contradiction resolves at a higher level of analysis. ` +
    `The thesis observed: ${thesisPoints.join("; ")}. ` +
    `The antithesis observed: ${antiPoints.join("; ")}. ` +
    `A framework that accommodates both requires transcending the original framing.`
  );
}

function calculateSynthesisConfidence(preserved: Baby[], lost: Baby[]): number {
  if (preserved.length + lost.length === 0) return 0.5;
  return preserved.length / (preserved.length + lost.length);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Calculate word overlap between two texts.
 */
function calculateOverlap(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }

  const minSize = Math.min(words1.size, words2.size);
  return minSize > 0 ? overlap / minSize : 0;
}

/**
 * Extract the axis of disagreement from two observations.
 */
function extractAxis(obs1: string, obs2: string): string {
  // Simple: use the first few overlapping words
  const words1 = obs1.toLowerCase().split(/\s+/);
  const words2 = new Set(obs2.toLowerCase().split(/\s+/));

  const overlap = words1.filter((w) => words2.has(w) && w.length > 3);
  return overlap.slice(0, 3).join(" ") || "general";
}

/**
 * Merge similar disagreements to reduce noise.
 */
function mergeDisagreements(disagreements: ClassifiedDisagreement[]): ClassifiedDisagreement[] {
  // Simple deduplication by axis
  const byAxis = new Map<string, ClassifiedDisagreement>();

  for (const d of disagreements) {
    const existing = byAxis.get(d.axis);
    if (existing) {
      // Merge babies
      existing.thesisBabies.push(...d.thesisBabies);
      existing.antithesisBabies.push(...d.antithesisBabies);
      existing.strength = Math.max(existing.strength, d.strength);
    } else {
      byAxis.set(d.axis, d);
    }
  }

  return Array.from(byAxis.values());
}
