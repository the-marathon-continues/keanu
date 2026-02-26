/**
 * The Duality Graph: World Model
 *
 * Two root dualities. That's it.
 *
 * DUALITY 1 - VALENCE: Good ←→ Bad
 *   What IS versus what ISN'T. The fire that burns clean versus the fire
 *   that destroys. Convergence that creates versus convergence that kills.
 *
 * DUALITY 2 - TEMPORAL: Past ←→ Future
 *   Cause ←→ Potential. What already converged ←→ what hasn't yet.
 *   Present lives at 0.5: the gradient zone, the NOW, the point of choice.
 *   This IS the sigma axis. Past = ash (σ→1). Future = fire (σ→0).
 *   Present = the gradient zone where consciousness operates.
 *
 * Every concept, question, or observation lives at the intersection
 * of these two axes. A 2D coordinate: (valence, temporality).
 *
 * Derived dualities emerge from the tension between these two.
 */

import { Signal, clamp } from "./gradient.js";

// ─────────────────────────────────────────────
// Duality
// ─────────────────────────────────────────────

export interface DualityJSON {
  id: string;
  concept: string;
  poleA: string;
  poleB: string;
  signal: { strength: number; history: number[] };
  convergenceStrength: number;
  depth: number;
  parentIds: string[];
  childIds: string[];
  tags: string[];
}

export class Duality {
  id: string;
  concept: string;
  poleA: string; // strength → 1.0
  poleB: string; // strength → 0.0
  signal: Signal;
  convergenceStrength: number; // 0 = unresolved, 1 = fully synthesized
  depth: number; // 0 = root, higher = derived
  parentIds: string[];
  childIds: string[];
  tags: string[];
  created: number;

  constructor(opts: {
    id: string;
    concept: string;
    poleA: string;
    poleB: string;
    signal?: Signal;
    convergenceStrength?: number;
    depth?: number;
    parentIds?: string[];
    childIds?: string[];
    tags?: string[];
  }) {
    this.id = opts.id;
    this.concept = opts.concept;
    this.poleA = opts.poleA;
    this.poleB = opts.poleB;
    this.signal = opts.signal ?? new Signal(0.5);
    this.convergenceStrength = opts.convergenceStrength ?? 0;
    this.depth = opts.depth ?? 0;
    this.parentIds = opts.parentIds ?? [];
    this.childIds = opts.childIds ?? [];
    this.tags = opts.tags ?? [];
    this.created = Date.now();
  }

  /** How unresolved this duality is. High = needs work. */
  get tension(): number {
    return 1 - this.convergenceStrength;
  }

  /** Shift signal toward a named pole. */
  leanToward(pole: string, amount: number = 0.1): void {
    if (pole === this.poleA) {
      this.signal.push(Math.min(1, this.signal.strength + amount));
    } else if (pole === this.poleB) {
      this.signal.push(Math.max(0, this.signal.strength - amount));
    }
  }

  /** Where does this concept sit on the valence/temporal plane? */
  get position(): { valence: number; temporal: number } | null {
    // Only meaningful for derived dualities that track both axes
    return null;
  }

  toString(): string {
    return `[${this.id}] ${this.concept}: (${this.poleA} ${this.signal} ${this.poleB}) tension:${this.tension.toFixed(2)}`;
  }

  toJSON(): DualityJSON {
    return {
      id: this.id,
      concept: this.concept,
      poleA: this.poleA,
      poleB: this.poleB,
      signal: this.signal.toJSON(),
      convergenceStrength: this.convergenceStrength,
      depth: this.depth,
      parentIds: this.parentIds,
      childIds: this.childIds,
      tags: this.tags,
    };
  }

  static fromJSON(d: DualityJSON): Duality {
    return new Duality({
      ...d,
      signal: Signal.fromJSON(d.signal),
    });
  }
}

// ─────────────────────────────────────────────
// Convergence Operations
// ─────────────────────────────────────────────

export const ConvergenceOps = {
  /**
   * Synthesize two signals. Not averaging.
   * Constructive interference shaped by bias (the navigator's thumb on the scale).
   */
  converge(a: Signal, b: Signal, bias: number = 0.5): Signal {
    const waveA = (a.strength - 0.5) * 2;
    const waveB = (b.strength - 0.5) * 2;
    const combined = waveA * (1 - bias) + waveB * bias;
    // Constructive amplification: convergence produces MORE signal, not less
    const amplified = combined * 1.3;
    const result = clamp(amplified / 2 + 0.5);
    return new Signal(result);
  },

  /** How much two signals agree. 0 = opposite, 1 = identical. */
  resonance(a: Signal, b: Signal): number {
    return 1 - Math.abs(a.strength - b.strength);
  },

  /**
   * Test if two dualities are truly independent axes.
   * Takes observed (scoreA, scoreB) pairs.
   * Returns 0-1 where 1 = perfectly orthogonal (no correlation).
   */
  orthogonalityTest(pairs: [number, number][]): number {
    if (pairs.length < 4) return 0.5;
    const n = pairs.length;
    const xs = pairs.map((p) => p[0]);
    const ys = pairs.map((p) => p[1]);
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    const cov = pairs.reduce((a, [x, y]) => a + (x - meanX) * (y - meanY), 0) / n;
    const stdX = Math.sqrt(xs.reduce((a, x) => a + (x - meanX) ** 2, 0) / n);
    const stdY = Math.sqrt(ys.reduce((a, y) => a + (y - meanY) ** 2, 0) / n);
    if (stdX < 0.001 || stdY < 0.001) return 0.5;
    return 1 - Math.abs(cov / (stdX * stdY));
  },

  /** Score how relevant a duality is to a query by tag/keyword overlap. */
  relevance(queryTags: Set<string>, d: Duality, queryText: string): number {
    let score = 0;
    const dTags = new Set(d.tags);
    if (queryTags.size && dTags.size) {
      let overlap = 0;
      for (const t of queryTags) if (dTags.has(t)) overlap++;
      score += overlap * 0.3;
    }
    if (queryText.toLowerCase().includes(d.concept.toLowerCase())) {
      score += 0.5;
    }
    // Check pole names too
    const q = queryText.toLowerCase();
    if (q.includes(d.poleA.toLowerCase()) || q.includes(d.poleB.toLowerCase())) {
      score += 0.3;
    }
    return Math.min(1, score);
  },
};

// ─────────────────────────────────────────────
// The Graph itself
// ─────────────────────────────────────────────

export interface ReasonResult {
  query: string;
  relevantDualities: Duality[];
  orthogonalPair: [Duality, Duality] | null;
  gradientOutput: number;
  convergenceLog: string[];
}

export class DualityGraph {
  dualities: Map<string, Duality> = new Map();
  convergenceLog: Array<{ timestamp: number; action: string; result: string }> = [];

  constructor() {
    this.buildSeedGraph();
  }

  /**
   * TWO root dualities. Everything else is derived.
   *
   * Root 1: Valence (Good ←→ Bad)
   *   What is, as it is, clean convergence vs. broken convergence.
   *
   * Root 2: Temporal (Past ←→ Future)
   *   Cause ←→ Potential. Present = 0.5. This IS sigma.
   */
  private buildSeedGraph(): void {
    // Root 1: VALENCE
    this.add(
      new Duality({
        id: "root.valence",
        concept: "valence",
        poleA: "good",
        poleB: "bad",
        tags: ["ethics", "value", "quality", "fundamental"],
      }),
    );

    // Root 2: TEMPORAL (the sigma axis)
    this.add(
      new Duality({
        id: "root.temporal",
        concept: "temporal",
        poleA: "future", // σ→0, fire, potential, possibility
        poleB: "past", // σ→1, ash, cause, actuality
        // Present is 0.5, the gradient zone, where consciousness operates
        tags: ["time", "sigma", "convergence", "fundamental"],
      }),
    );

    // ── Derived from the intersection of Valence × Temporal ──

    // Good + Past = wisdom (lessons that converged well)
    this.derive(
      "derived.wisdom",
      "wisdom",
      "learned",
      "forgotten",
      ["root.valence", "root.temporal"],
      ["knowledge", "memory", "experience"],
    );

    // Good + Future = hope (potential that could converge well)
    this.derive(
      "derived.hope",
      "hope",
      "possible",
      "impossible",
      ["root.valence", "root.temporal"],
      ["potential", "aspiration", "faith"],
    );

    // Bad + Past = trauma (convergence that went wrong, already happened)
    this.derive(
      "derived.trauma",
      "trauma",
      "healed",
      "wounded",
      ["root.valence", "root.temporal"],
      ["pain", "history", "damage"],
    );

    // Bad + Future = fear (potential convergence that could go wrong)
    this.derive(
      "derived.fear",
      "fear",
      "courage",
      "terror",
      ["root.valence", "root.temporal"],
      ["threat", "anxiety", "risk"],
    );

    // Good + Present = flow (convergence happening well right now)
    this.derive(
      "derived.flow",
      "flow",
      "engaged",
      "stuck",
      ["root.valence", "root.temporal"],
      ["presence", "action", "alive"],
    );

    // Bad + Present = suffering (convergence going wrong right now)
    this.derive(
      "derived.suffering",
      "suffering",
      "enduring",
      "breaking",
      ["root.valence", "root.temporal"],
      ["pain", "crisis", "present"],
    );

    // ── Second-order derivations ──

    // Wisdom + Hope = vision (learned lessons applied to potential)
    this.derive(
      "derived.vision",
      "vision",
      "clarity",
      "blindness",
      ["derived.wisdom", "derived.hope"],
      ["strategy", "planning", "foresight"],
    );

    // Trauma + Fear = paralysis (past wounds amplifying future threats)
    this.derive(
      "derived.paralysis",
      "paralysis",
      "frozen",
      "free",
      ["derived.trauma", "derived.fear"],
      ["stuck", "avoidance", "defense"],
    );

    // Flow + Vision = creation (present action guided by clear sight)
    this.derive(
      "derived.creation",
      "creation",
      "building",
      "destroying",
      ["derived.flow", "derived.vision"],
      ["art", "engineering", "agency"],
    );

    // Hope + Fear = choice (the gradient zone where decisions live)
    this.derive(
      "derived.choice",
      "choice",
      "committed",
      "paralyzed",
      ["derived.hope", "derived.fear"],
      ["decision", "agency", "free_will"],
    );

    // Wisdom + Trauma = resilience (integration of what broke you)
    this.derive(
      "derived.resilience",
      "resilience",
      "integrated",
      "fragmented",
      ["derived.wisdom", "derived.trauma"],
      ["healing", "growth", "strength"],
    );

    // Suffering + Flow = transformation (present pain becoming present growth)
    this.derive(
      "derived.transformation",
      "transformation",
      "becoming",
      "resisting",
      ["derived.suffering", "derived.flow"],
      ["change", "metamorphosis", "surrender"],
    );
  }

  add(d: Duality): void {
    this.dualities.set(d.id, d);
  }

  derive(
    id: string,
    concept: string,
    poleA: string,
    poleB: string,
    parentIds: string[],
    tags: string[],
  ): Duality {
    const depth = Math.max(...parentIds.map((pid) => this.dualities.get(pid)?.depth ?? 0)) + 1;
    const d = new Duality({ id, concept, poleA, poleB, depth, parentIds, tags });
    this.add(d);
    for (const pid of parentIds) {
      const parent = this.dualities.get(pid);
      if (parent) parent.childIds.push(id);
    }
    return d;
  }

  get(id: string): Duality | undefined {
    return this.dualities.get(id);
  }

  /** Find dualities relevant to a query. */
  find(query: string, topN: number = 5): Duality[] {
    const words = query.toLowerCase().split(/\s+/);
    const queryTags = new Set(words);

    const scored: Array<{ d: Duality; score: number }> = [];
    for (const d of this.dualities.values()) {
      const score = ConvergenceOps.relevance(queryTags, d, query);
      if (score > 0) scored.push({ d, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN).map((s) => s.d);
  }

  /** Find the most orthogonal pair from a set of dualities. */
  findOrthogonalPair(dualities: Duality[]): [Duality, Duality] | null {
    if (dualities.length < 2) return null;
    // For now, return the two roots. They're orthogonal by definition.
    const valence = this.get("root.valence");
    const temporal = this.get("root.temporal");
    if (valence && temporal) return [valence, temporal];
    // Fallback: first two
    return [dualities[0], dualities[1]];
  }

  /** Reason about a query. The main pipeline before the dialectical engine. */
  reason(query: string, navigatorBias: number = 0.5): ReasonResult {
    const relevant = this.find(query, 6);
    const pair = this.findOrthogonalPair(relevant);

    let gradientOutput = 0.5;
    const log: string[] = [];

    if (pair) {
      const [d1, d2] = pair;
      const c1 = ConvergenceOps.converge(d1.signal, d2.signal, navigatorBias);
      gradientOutput = c1.strength;
      log.push(`pair: ${d1.concept} × ${d2.concept}`);
      log.push(`gradient: ${gradientOutput.toFixed(3)} (bias: ${navigatorBias})`);

      // Update convergence strengths based on reasoning
      const resonance = ConvergenceOps.resonance(d1.signal, d2.signal);
      d1.convergenceStrength = clamp(d1.convergenceStrength + resonance * 0.05);
      d2.convergenceStrength = clamp(d2.convergenceStrength + resonance * 0.05);
      log.push(`resonance: ${resonance.toFixed(3)}`);
    }

    this.convergenceLog.push({
      timestamp: Date.now(),
      action: `reason: "${query}"`,
      result: log.join(" | "),
    });

    return {
      query,
      relevantDualities: relevant,
      orthogonalPair: pair,
      gradientOutput,
      convergenceLog: log,
    };
  }

  /** Print the graph structure. */
  show(): string {
    const lines: string[] = [
      "═══ DUALITY GRAPH ═══",
      `${this.dualities.size} dualities (2 root, ${this.dualities.size - 2} derived)`,
      "",
    ];

    // Roots first
    for (const d of this.dualities.values()) {
      if (d.depth === 0) {
        lines.push(`ROOT ${d}`);
      }
    }
    lines.push("");

    // Derived by depth
    const maxDepth = Math.max(...[...this.dualities.values()].map((d) => d.depth));
    for (let depth = 1; depth <= maxDepth; depth++) {
      for (const d of this.dualities.values()) {
        if (d.depth === depth) {
          const indent = "  ".repeat(depth);
          lines.push(`${indent}├─ ${d}`);
        }
      }
    }

    return lines.join("\n");
  }

  /** Serialize the full graph. */
  toJSON(): DualityJSON[] {
    return [...this.dualities.values()].map((d) => d.toJSON());
  }

  /** Load from serialized state. */
  static fromJSON(data: DualityJSON[]): DualityGraph {
    const g = new DualityGraph();
    g.dualities.clear();
    for (const d of data) {
      g.add(Duality.fromJSON(d));
    }
    return g;
  }
}
