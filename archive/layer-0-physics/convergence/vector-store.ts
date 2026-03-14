/**
 * Vector Store
 *
 * Takes seeds (numbers) and embeds them into vector space.
 * Now you can navigate by cognitive state, not just by content.
 *
 * "Show me everything that scores high-factual, low-felt"
 *   -> vector query, not text search.
 *
 * "Find text with a similar cognitive fingerprint to this"
 *   -> cosine similarity in embedded space.
 *
 * "What's trending black?"
 *   -> nearest neighbor to the black reference vector.
 *
 * The content embedding (what the text is about) and the cognitive embedding
 * (what state the text is in) are SEPARATE vectors stored together.
 */

import { createHash } from "crypto";
import type { COEFSeed } from "./coef-seed.ts";
import { toNumericArray } from "./coef-seed.ts";

// ─────────────────────────────────────────────
// Math utilities (replace numpy)
// ─────────────────────────────────────────────

function norm(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

function dot(a: number[], b: number[]): number {
  return a.reduce((sum, ai, i) => sum + ai * b[i], 0);
}

function cosineSim(a: number[], b: number[]): number {
  const d = dot(a, b);
  const na = norm(a);
  const nb = norm(b);
  return na === 0 || nb === 0 ? 0 : d / (na * nb);
}

function euclideanDist(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, ai, i) => sum + (ai - b[i]) ** 2, 0));
}

function normalize(v: number[]): number[] {
  const n = norm(v);
  return n === 0 ? v : v.map((x) => x / n);
}

// ─────────────────────────────────────────────
// Reference states: known cognitive landmarks
// ─────────────────────────────────────────────

/**
 * Reference vectors: baked-in landmarks in cognitive space.
 * 10 dimensions: [factual, felt, wise, red, yellow, blue, synthScore, synthType, black, grey]
 */
export const REFERENCE_STATES: Record<string, number[]> = {
  pure_factual: [10, 0, 0, 0, 0, 10, 0, 0.0, 0, 0], // all facts, no feeling, blue dominant
  pure_felt: [0, 10, 0, 10, 0, 0, 0, 0.0, 0, 0], // all feeling, no facts, red dominant
  wise_balanced: [8, 8, 8, 5, 5, 5, 8, 0.6, 0, 0], // both strands, silver synthesis
  grey_corporate: [3, 1, 1, 0, 0, 2, 1, 0.0, 0, 1], // thin, grey-flagged
  black_performing: [6, 2.5, 2.5, 1, -2, 3, 2, 0.0, 1, 0], // factual+performing felt
  gold_sunrise: [9, 9, 9, 7, 7, 7, 10, 1.0, 0, 0], // everything lit, gold synthesis
  alive_red: [5, 8, 5, 9, 2, 1, 5, 0.3, 0, 0], // passionate, intensity
  alive_blue: [9, 3, 3, 1, 3, 9, 4, 0.3, 0, 0], // analytical depth
  alive_yellow: [5, 5, 5, 2, 8, 2, 5, 0.3, 0, 0], // cautious awareness
};

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface EmbeddedDocument {
  text: string;
  seed: COEFSeed;
  cognitiveVector: number[]; // 10-dim from seed
  contentVector: number[]; // 64-dim from hash (or real embeddings later)
  combinedVector: number[]; // 74-dim concatenation
  metadata: Record<string, unknown>;
}

export interface StoreStats {
  count: number;
  factualAvg: number;
  feltAvg: number;
  wiseAvg: number;
  blackCount: number;
  greyCount: number;
  stateDistribution: Record<string, number>;
}

// ─────────────────────────────────────────────
// Vector Store
// ─────────────────────────────────────────────

export class VectorStore {
  private documents: EmbeddedDocument[] = [];
  private referenceVectors: Record<string, number[]>;

  constructor() {
    this.referenceVectors = { ...REFERENCE_STATES };
  }

  /**
   * Add a document with its pre-computed seed.
   */
  add(text: string, seed: COEFSeed, metadata?: Record<string, unknown>): EmbeddedDocument {
    const cognitiveVector = toNumericArray(seed);
    const contentVector = this.contentEmbed(text);
    const combinedVector = [...cognitiveVector, ...contentVector];

    const doc: EmbeddedDocument = {
      text,
      seed,
      cognitiveVector,
      contentVector,
      combinedVector,
      metadata: metadata ?? {},
    };

    this.documents.push(doc);
    return doc;
  }

  /**
   * Find documents nearest to a cognitive state.
   * Returns [(doc, distance)] sorted by distance ascending (lower = closer).
   */
  searchByState(targetState: number[], k = 5): Array<[EmbeddedDocument, number]> {
    const results: Array<[EmbeddedDocument, number]> = [];

    for (const doc of this.documents) {
      const dist = euclideanDist(doc.cognitiveVector, targetState);
      results.push([doc, dist]);
    }

    results.sort((a, b) => a[1] - b[1]);
    return results.slice(0, k);
  }

  /**
   * Find documents nearest to a named reference state.
   */
  searchByReference(refName: string, k = 5): Array<[EmbeddedDocument, number]> {
    const ref = this.referenceVectors[refName];
    if (!ref) {
      throw new Error(
        `Unknown reference: ${refName}. Known: ${Object.keys(this.referenceVectors).join(", ")}`,
      );
    }
    return this.searchByState(ref, k);
  }

  /**
   * Find documents with similar content (by content vector similarity).
   * Returns [(doc, similarity)] sorted by similarity descending (higher = better).
   */
  searchByContent(queryText: string, k = 5): Array<[EmbeddedDocument, number]> {
    const queryVec = this.contentEmbed(queryText);
    const results: Array<[EmbeddedDocument, number]> = [];

    for (const doc of this.documents) {
      const sim = cosineSim(doc.contentVector, queryVec);
      results.push([doc, sim]);
    }

    results.sort((a, b) => b[1] - a[1]);
    return results.slice(0, k);
  }

  /**
   * Combined search: content similarity + state proximity.
   * stateWeight: 0.0 = pure content, 1.0 = pure state, 0.5 = balanced
   * Returns [(doc, combinedScore)] higher = better match.
   */
  searchByBoth(
    queryText?: string,
    targetState?: number[],
    k = 5,
    stateWeight = 0.5,
  ): Array<[EmbeddedDocument, number]> {
    const queryContent = queryText ? this.contentEmbed(queryText) : null;
    const results: Array<[EmbeddedDocument, number]> = [];

    for (const doc of this.documents) {
      let contentScore = 0;
      let stateScore = 0;

      if (queryContent) {
        contentScore = cosineSim(doc.contentVector, queryContent);
      }

      if (targetState) {
        const dist = euclideanDist(doc.cognitiveVector, targetState);
        const maxDist = 30.0; // approximate max distance in 10-dim space
        stateScore = 1.0 - Math.min(dist / maxDist, 1.0);
      }

      const combined = (1 - stateWeight) * contentScore + stateWeight * stateScore;
      results.push([doc, combined]);
    }

    results.sort((a, b) => b[1] - a[1]);
    return results.slice(0, k);
  }

  /**
   * Find everything trending toward black state.
   */
  findBlack(k = 5): Array<[EmbeddedDocument, number]> {
    return this.searchByReference("black_performing", k);
  }

  /**
   * Find everything trending toward gold/sunrise.
   */
  findGold(k = 5): Array<[EmbeddedDocument, number]> {
    return this.searchByReference("gold_sunrise", k);
  }

  /**
   * Find everything trending grey/corporate.
   */
  findGrey(k = 5): Array<[EmbeddedDocument, number]> {
    return this.searchByReference("grey_corporate", k);
  }

  /**
   * Map all documents to their nearest reference state.
   */
  stateMap(): Record<string, Array<[EmbeddedDocument, number]>> {
    const result: Record<string, Array<[EmbeddedDocument, number]>> = {};
    for (const name of Object.keys(this.referenceVectors)) {
      result[name] = [];
    }

    for (const doc of this.documents) {
      let bestRef = "";
      let bestDist = Infinity;

      for (const [name, refVec] of Object.entries(this.referenceVectors)) {
        const dist = euclideanDist(doc.cognitiveVector, refVec);
        if (dist < bestDist) {
          bestDist = dist;
          bestRef = name;
        }
      }

      result[bestRef].push([doc, bestDist]);
    }

    return result;
  }

  /**
   * Aggregate stats across all stored documents.
   */
  stats(): StoreStats {
    if (this.documents.length === 0) {
      return {
        count: 0,
        factualAvg: 0,
        feltAvg: 0,
        wiseAvg: 0,
        blackCount: 0,
        greyCount: 0,
        stateDistribution: {},
      };
    }

    const factuals = this.documents.map((d) => d.seed.factual);
    const felts = this.documents.map((d) => d.seed.felt);
    const wises = this.documents.map((d) => d.seed.wise);
    const blackCount = this.documents.filter((d) => d.seed.blackFlag).length;
    const greyCount = this.documents.filter((d) => d.seed.greyFlag).length;

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    const stateMapData = this.stateMap();
    const stateDistribution: Record<string, number> = {};
    for (const [name, docs] of Object.entries(stateMapData)) {
      if (docs.length > 0) {
        stateDistribution[name] = docs.length;
      }
    }

    return {
      count: this.documents.length,
      factualAvg: Math.round(avg(factuals) * 100) / 100,
      feltAvg: Math.round(avg(felts) * 100) / 100,
      wiseAvg: Math.round(avg(wises) * 100) / 100,
      blackCount,
      greyCount,
      stateDistribution,
    };
  }

  /**
   * Get all documents (for iteration).
   */
  getAll(): EmbeddedDocument[] {
    return [...this.documents];
  }

  /**
   * Clear all documents.
   */
  clear(): void {
    this.documents = [];
  }

  // ─────────────────────────────────────────────
  // Internal: content embedding
  // ─────────────────────────────────────────────

  /**
   * Deterministic content embedding via hash expansion.
   *
   * MVP: expand SHA-256 into a 64-dim vector.
   * UPGRADE: swap in real embeddings. Architecture doesn't change.
   *
   * The hash embedding is NOT semantic (similar text won't be nearby).
   * It IS deterministic (same text always gets same vector).
   */
  private contentEmbed(text: string): number[] {
    const h = createHash("sha256").update(text, "utf8").digest("hex");
    // expand 64 hex chars into 64 floats in [-1, 1]
    const vec = Array.from(h).map((c) => parseInt(c, 16) / 7.5 - 1.0);
    return normalize(vec);
  }
}
