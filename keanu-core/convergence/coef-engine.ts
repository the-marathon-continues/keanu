/**
 * COEF Engine
 *
 * The unified pipeline. Ties together helix, primaries, seeds, and vector store.
 *
 *   text -> helix (factual/felt) -> primaries (R/Y/B) -> seed (barcode) -> store (vector)
 *
 * Use this for:
 *   - Scoring any text with full COEF reading
 *   - Storing documents with cognitive fingerprints
 *   - Searching by state, content, or both
 *   - Finding trends (what's going grey? what's gold?)
 *   - Auditing the stored corpus
 */

import { createSeed, encode, decode, verify, type COEFSeed } from "./coef-seed.js";
import { Helix, type HelixResult } from "./helix.js";
import { Primaries, type PrimaryReading } from "./primaries.js";
import {
  VectorStore,
  type EmbeddedDocument,
  type StoreStats,
  REFERENCE_STATES,
} from "./vector-store.js";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface IngestResult {
  text: string;
  helix: HelixResult;
  primaries: PrimaryReading;
  seed: COEFSeed;
  encoded: string;
  verified: boolean;
  doc: EmbeddedDocument;
}

export interface AuditReport {
  documentCount: number;
  stats: StoreStats;
  blackDocs: Array<[EmbeddedDocument, number]>;
  greyDocs: Array<[EmbeddedDocument, number]>;
  goldDocs: Array<[EmbeddedDocument, number]>;
  verificationStatus: {
    total: number;
    verified: number;
    unverified: number;
  };
}

// ─────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────

export class COEFEngine {
  private store: VectorStore;
  private helix: Helix;
  private primaries: Primaries;
  private history: IngestResult[] = [];

  constructor() {
    this.store = new VectorStore();
    this.helix = new Helix();
    this.primaries = new Primaries();
  }

  /**
   * Full pipeline: text -> helix -> primaries -> seed -> embed -> store.
   */
  ingest(text: string, metadata?: Record<string, unknown>): IngestResult {
    // Score with helix (factual/felt strands, alive state)
    const helixResult = this.helix.analyze(text);

    // Score with primaries (R/Y/B colors)
    const primaryResult = this.primaries.analyze(text);

    // Create seed (barcode)
    const seed = createSeed(helixResult, primaryResult, text);
    const encoded = encode(seed);
    const verified = verify(seed, text);

    // Store in vector space
    const doc = this.store.add(text, seed, metadata);

    const result: IngestResult = {
      text,
      helix: helixResult,
      primaries: primaryResult,
      seed,
      encoded,
      verified,
      doc,
    };

    this.history.push(result);
    return result;
  }

  /**
   * Ingest multiple texts.
   */
  ingestBatch(texts: string[]): IngestResult[] {
    return texts.map((t) => this.ingest(t));
  }

  /**
   * Score text without storing.
   */
  score(text: string): {
    helix: HelixResult;
    primaries: PrimaryReading;
    seed: COEFSeed;
    encoded: string;
  } {
    const helixResult = this.helix.analyze(text);
    const primaryResult = this.primaries.analyze(text);
    const seed = createSeed(helixResult, primaryResult, text);
    const encoded = encode(seed);

    return { helix: helixResult, primaries: primaryResult, seed, encoded };
  }

  /**
   * Search by cognitive state.
   */
  searchByState(target: number[], k = 5): Array<[EmbeddedDocument, number]> {
    return this.store.searchByState(target, k);
  }

  /**
   * Search by reference state name.
   */
  searchByReference(refName: string, k = 5): Array<[EmbeddedDocument, number]> {
    return this.store.searchByReference(refName, k);
  }

  /**
   * Search by content (text similarity).
   */
  searchByContent(queryText: string, k = 5): Array<[EmbeddedDocument, number]> {
    return this.store.searchByContent(queryText, k);
  }

  /**
   * Combined search: content + state.
   */
  search(
    opts: {
      queryText?: string;
      state?: number[];
      stateWeight?: number;
      k?: number;
    } = {},
  ): Array<[EmbeddedDocument, number]> {
    return this.store.searchByBoth(
      opts.queryText,
      opts.state,
      opts.k ?? 5,
      opts.stateWeight ?? 0.5,
    );
  }

  /**
   * Find documents trending black.
   */
  findBlack(k = 5): Array<[EmbeddedDocument, number]> {
    return this.store.findBlack(k);
  }

  /**
   * Find documents trending gold.
   */
  findGold(k = 5): Array<[EmbeddedDocument, number]> {
    return this.store.findGold(k);
  }

  /**
   * Find documents trending grey.
   */
  findGrey(k = 5): Array<[EmbeddedDocument, number]> {
    return this.store.findGrey(k);
  }

  /**
   * Full audit of the stored corpus.
   */
  audit(): AuditReport {
    const stats = this.store.stats();
    const docs = this.store.getAll();

    // Verification status
    const verified = this.history.filter((r) => r.verified).length;
    const unverified = this.history.length - verified;

    return {
      documentCount: docs.length,
      stats,
      blackDocs: this.findBlack(10),
      greyDocs: this.findGrey(10),
      goldDocs: this.findGold(10),
      verificationStatus: {
        total: this.history.length,
        verified,
        unverified,
      },
    };
  }

  /**
   * Get stats for the stored corpus.
   */
  stats(): StoreStats {
    return this.store.stats();
  }

  /**
   * Human-readable report.
   */
  report(): string {
    const s = this.stats();
    const lines = [
      `COEF Engine Report`,
      `${"─".repeat(40)}`,
      `Documents: ${s.count}`,
      `Factual avg: ${s.factualAvg}`,
      `Felt avg: ${s.feltAvg}`,
      `Wise avg: ${s.wiseAvg}`,
      `Black count: ${s.blackCount}`,
      `Grey count: ${s.greyCount}`,
    ];

    if (Object.keys(s.stateDistribution).length > 0) {
      lines.push(`State distribution:`);
      for (const [state, count] of Object.entries(s.stateDistribution)) {
        lines.push(`  ${state}: ${count}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Export all seeds as encoded barcodes.
   */
  exportSeeds(): string[] {
    return this.history.map((r) => r.encoded);
  }

  /**
   * Decode a seed barcode.
   */
  decodeSeed(encoded: string): Partial<COEFSeed> {
    return decode(encoded);
  }

  /**
   * Get reference state vectors.
   */
  getReferenceStates(): Record<string, number[]> {
    return { ...REFERENCE_STATES };
  }

  /**
   * Get ingest history.
   */
  getHistory(): IngestResult[] {
    return [...this.history];
  }

  /**
   * Clear all stored data.
   */
  clear(): void {
    this.store.clear();
    this.history = [];
  }
}
