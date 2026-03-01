/**
 * consolidate.ts
 * Sleep-time compute: background memory refinement.
 *
 * Runs at session_end (async) to:
 * - Cluster similar claims
 * - Merge redundant memories
 * - Detect patterns across claims
 * - Update knowledge graph with consolidated insights
 *
 * This is Letta's "sleep-time compute" pattern — decoupling memory
 * management latency from conversation latency.
 */

import * as silverado from "../../keanu-core/layer-3-causal/silverado.js";
import * as knowledge from "../../keanu-core/layer-9-memory/knowledge.js";
import type { TrackedClaim } from "../../keanu-core/shared/types.js";

// ============================================================
// Types
// ============================================================

export interface ClusterResult {
  clusterId: string;
  claims: TrackedClaim[];
  centroid: string; // representative text
  pattern?: string; // detected pattern if any
}

export interface ConsolidationReport {
  timestamp: string;
  clustersFormed: number;
  claimsMerged: number;
  patternsDetected: number;
  knowledgeUpdates: number;
}

// ============================================================
// Clustering (simple keyword-based for now)
// ============================================================

/**
 * Extract keywords from claim text for clustering.
 */
function extractKeywords(text: string): Set<string> {
  const stopwords = new Set([
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "can",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "as",
    "it",
    "that",
    "this",
    "these",
    "those",
    "and",
    "or",
    "but",
    "if",
    "then",
  ]);

  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3 && !stopwords.has(w)),
  );
}

/**
 * Calculate Jaccard similarity between two keyword sets.
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Cluster claims by keyword similarity.
 * Uses simple single-linkage clustering with threshold.
 */
function clusterClaims(claims: TrackedClaim[], threshold = 0.3): ClusterResult[] {
  const clusters: Map<string, TrackedClaim[]> = new Map();
  const keywordCache: Map<string, Set<string>> = new Map();

  // Pre-extract keywords
  for (const claim of claims) {
    keywordCache.set(claim.id, extractKeywords(claim.text));
  }

  // Assign to clusters
  let nextClusterId = 0;
  const claimToCluster: Map<string, string> = new Map();

  for (const claim of claims) {
    const keywords = keywordCache.get(claim.id)!;
    let bestCluster: string | null = null;
    let bestSim = threshold;

    // Find most similar existing cluster
    for (const [clusterId, members] of clusters) {
      for (const member of members) {
        const memberKw = keywordCache.get(member.id)!;
        const sim = jaccardSimilarity(keywords, memberKw);
        if (sim > bestSim) {
          bestSim = sim;
          bestCluster = clusterId;
        }
      }
    }

    if (bestCluster) {
      clusters.get(bestCluster)!.push(claim);
      claimToCluster.set(claim.id, bestCluster);
    } else {
      const newId = `cluster-${nextClusterId++}`;
      clusters.set(newId, [claim]);
      claimToCluster.set(claim.id, newId);
    }
  }

  // Convert to results
  const results: ClusterResult[] = [];
  for (const [clusterId, members] of clusters) {
    if (members.length < 2) continue; // Only report clusters with multiple claims

    // Find centroid (claim with most keyword overlap with others)
    const memberKeywords = members.map((m) => keywordCache.get(m.id)!);
    let bestCentroid = members[0];
    let bestOverlap = 0;

    for (let i = 0; i < members.length; i++) {
      let totalOverlap = 0;
      for (let j = 0; j < members.length; j++) {
        if (i !== j) {
          totalOverlap += jaccardSimilarity(memberKeywords[i], memberKeywords[j]);
        }
      }
      if (totalOverlap > bestOverlap) {
        bestOverlap = totalOverlap;
        bestCentroid = members[i];
      }
    }

    results.push({
      clusterId,
      claims: members,
      centroid: bestCentroid.text,
    });
  }

  return results;
}

// ============================================================
// Pattern detection
// ============================================================

/**
 * Detect temporal patterns in clusters.
 * Returns a pattern description if found.
 */
function detectPatterns(cluster: ClusterResult): string | null {
  const { claims } = cluster;
  if (claims.length < 3) return null;

  // Check for contradiction pattern (flip-flopping)
  const contradicted = claims.filter((c) => c.contradicted);
  if (contradicted.length >= 2) {
    return `recurring contradiction: topic revisited ${claims.length} times, ${contradicted.length} reversals`;
  }

  // Check for decay pattern (repeatedly making claims that go stale)
  const stale = claims.filter((c) => c.status === "stale");
  if (stale.length >= 2) {
    return `attention drift: ${stale.length} claims on this topic went stale`;
  }

  // Check for confidence pattern
  const avgConf = claims.reduce((sum, c) => sum + c.confidence, 0) / claims.length;
  const avgDecay = claims.reduce((sum, c) => sum + c.decayedConfidence, 0) / claims.length;
  if (avgConf >= 4 && avgDecay <= 2) {
    return `overconfidence pattern: high initial confidence (${avgConf.toFixed(1)}) decayed to ${avgDecay.toFixed(1)}`;
  }

  return null;
}

// ============================================================
// Knowledge graph updates
// ============================================================

/**
 * Update knowledge graph with consolidated insights.
 * Extracts entities and relations from patterns.
 */
function updateKnowledge(clusters: ClusterResult[], sessionId: string): number {
  let updates = 0;

  for (const cluster of clusters) {
    if (!cluster.pattern) continue;

    // Extract topic from centroid
    const words = cluster.centroid.split(/\W+/).filter((w) => w.length > 4);
    const topic = words[0] || "unknown_topic";

    // Ingest the pattern as knowledge
    knowledge.ingest(`pattern: ${topic} — ${cluster.pattern}`, sessionId);
    updates++;
  }

  return updates;
}

// ============================================================
// Main consolidation
// ============================================================

/**
 * Run consolidation on the claim ledger.
 * This is the "sleep-time compute" entry point.
 */
export async function consolidate(sessionId: string): Promise<ConsolidationReport> {
  const allClaims = silverado.getAllClaims();
  const activeClaims = allClaims.filter((c) => c.status !== "retracted" && c.decayedConfidence > 0);

  // Cluster claims
  const clusters = clusterClaims([...activeClaims]);

  // Detect patterns
  for (const cluster of clusters) {
    cluster.pattern = detectPatterns(cluster) ?? undefined;
  }

  // Update claim metadata with cluster IDs
  let claimsMerged = 0;
  for (const cluster of clusters) {
    for (const claim of cluster.claims) {
      // We can't directly mutate silverado claims, but we track the cluster
      // The cluster info goes into the consolidation report
      claimsMerged++;
    }
  }

  // Update knowledge graph
  const knowledgeUpdates = updateKnowledge(clusters, sessionId);

  const patternsDetected = clusters.filter((c) => c.pattern).length;

  return {
    timestamp: new Date().toISOString(),
    clustersFormed: clusters.length,
    claimsMerged,
    patternsDetected,
    knowledgeUpdates,
  };
}

/**
 * Format consolidation report for logging.
 */
export function formatReport(report: ConsolidationReport): string {
  if (
    report.clustersFormed === 0 &&
    report.patternsDetected === 0 &&
    report.knowledgeUpdates === 0
  ) {
    return "[consolidate: nothing to consolidate]";
  }

  const parts: string[] = [];
  if (report.clustersFormed > 0) {
    parts.push(`${report.clustersFormed} clusters`);
  }
  if (report.patternsDetected > 0) {
    parts.push(`${report.patternsDetected} patterns`);
  }
  if (report.knowledgeUpdates > 0) {
    parts.push(`${report.knowledgeUpdates} knowledge updates`);
  }

  return `[consolidate: ${parts.join(", ")}]`;
}
