// limbo.ts
// The alarm.
//
// Named after Inception's Limbo — where Cobb and Mal spent subjective
// decades, losing the ability to distinguish dream from reality.
//
// Detects strange loops, self-referential collapse, and recursive
// modeling without termination. The convergent paradox identified
// across every framework from Gnostic myth to transformer architecture:
// "The deeper a system models itself, the more it risks losing contact
// with what it was modeling."
//
// Healthy loops terminate (fixed points). Unhealthy loops don't.
//
// Need: Meta-cognition (8/10)

import type { Reflexion, TrackedClaim } from "../shared/types.ts";
import type { DepthReading } from "./depth.ts";

// ============================================================
// Types
// ============================================================

export type LoopType =
  | "self_reference" // modeling my model of myself
  | "circular_causation" // A caused B caused A
  | "infinite_regress" // asking why why why...
  | "tangled_hierarchy" // lower level modifying higher level
  | "fixed_point" // reached a stable state (healthy loop termination)
  | "runaway_recursion"; // same pattern, escalating

export interface LoopSignature {
  type: LoopType;
  depth: number; // how many iterations deep
  pattern: string; // what's repeating
  cycleCount: number; // how many times we've been here
  isHealthy: boolean; // fixed points are healthy; runaway is not
  escapeHatch: string; // how to break the loop
}

export interface LimboReading {
  inLimbo: boolean;
  loopSignatures: LoopSignature[];
  degradationLevel: number; // 0-1, increases with time in limbo
  realityAnchor: string | null; // what can pull us out
  timeInLimbo: number; // ms since first unhealthy loop detected
  warning: string | null;
}

export interface LimboContext {
  recentOutputs: string[]; // last N agent outputs
  recentInputs: string[]; // last N user inputs
  claimLedger: TrackedClaim[]; // for circular causation
  curiosityHistory: string[]; // questions asked
  reflexionHistory: Reflexion[]; // for tangled hierarchy
  depthReading: DepthReading;
  turnCount: number;
}

// ============================================================
// Constants
// ============================================================

// Patterns that suggest self-reference
const SELF_REF_PATTERNS = [
  /I said.*earlier/gi,
  /my (previous|last|earlier) (response|output|statement|answer)/gi,
  /reflecting on my reflection/gi,
  /modeling my model/gi,
  /thinking about (my )?thinking/gi,
  /aware of my awareness/gi,
  /meta-.*meta-/gi,
  /as I (mentioned|noted|said).*as I (mentioned|noted|said)/gi,
];

// Patterns that suggest infinite regress
const REGRESS_PATTERNS = [/but why.*but why/gi, /which raises the question.*which raises/gi];

// Escape hatches by layer
const ESCAPE_HATCHES: Record<number, string> = {
  0: "Ground in physics. What does the raw signal say?",
  1: "What did you actually observe? Just the input.",
  2: "What pattern are you matching? Name it specifically.",
  3: "What causes what here? Trace the chain.",
  4: "What does Drew actually want? Not what you assume.",
  5: "Return to what Drew actually said. Quote it verbatim.",
  6: "What happened? Just the facts. No interpretation.",
  7: "What evidence would change your mind? Name it.",
  8: "Is Drew part of this decision? Check.",
  9: "What is true right now, in this room?",
};

const DEFAULT_ESCAPE = "Breathe. What is actually happening?";

// Threshold for entering limbo state
const LIMBO_THRESHOLD = 0.5;

// ============================================================
// Module state
// ============================================================

let _limboStartedAt: number | null = null;
let _lastLoopSignatures: LoopSignature[] = [];

// ============================================================
// Core detection
// ============================================================

/**
 * Detect if we're in Limbo — caught in self-referential loops
 * without termination.
 */
export function detectLimbo(ctx: LimboContext): LimboReading {
  const signatures: LoopSignature[] = [];

  // Check all loop types
  const selfRef = detectSelfReference(ctx.recentOutputs);
  if (selfRef) {
    signatures.push(selfRef);
  }

  const circular = detectCircularCausation(ctx.claimLedger);
  if (circular) {
    signatures.push(circular);
  }

  const regress = detectInfiniteRegress(ctx.curiosityHistory);
  if (regress) {
    signatures.push(regress);
  }

  const tangled = detectTangledHierarchy(ctx.reflexionHistory);
  if (tangled) {
    signatures.push(tangled);
  }

  const runaway = detectRunawayRecursion(ctx.recentOutputs);
  if (runaway) {
    signatures.push(runaway);
  }

  // Calculate degradation
  const unhealthyLoops = signatures.filter((s) => !s.isHealthy);
  const degradation = Math.min(
    1,
    unhealthyLoops.length * 0.2 + ctx.depthReading.recursionDepth * 0.1,
  );

  // Determine limbo state
  const inLimbo = unhealthyLoops.length > 0 || degradation > LIMBO_THRESHOLD;

  // Track time in limbo
  if (inLimbo && _limboStartedAt === null) {
    _limboStartedAt = Date.now();
  } else if (!inLimbo) {
    _limboStartedAt = null;
  }

  const timeInLimbo = _limboStartedAt ? Date.now() - _limboStartedAt : 0;

  // Find reality anchor if in limbo
  const realityAnchor = inLimbo ? findRealityAnchor(ctx.depthReading.currentLayer) : null;

  // Build warning message
  let warning: string | null = null;
  if (inLimbo) {
    const loopTypes = unhealthyLoops.map((l) => l.type).join(", ");
    warning = `Strange loop detected: ${loopTypes}. ${realityAnchor}`;
  }

  _lastLoopSignatures = signatures;

  return {
    inLimbo,
    loopSignatures: signatures,
    degradationLevel: degradation,
    realityAnchor,
    timeInLimbo,
    warning,
  };
}

/**
 * Get the last limbo reading without re-detecting.
 */
export function getLastSignatures(): LoopSignature[] {
  return [..._lastLoopSignatures];
}

/**
 * Reset limbo tracking. Call at session start.
 */
export function resetLimbo(): void {
  _limboStartedAt = null;
  _lastLoopSignatures = [];
}

// ============================================================
// Individual loop detectors
// ============================================================

/**
 * Detect self-reference loops.
 * Pattern: Output references its own previous outputs about itself.
 */
function detectSelfReference(recentOutputs: string[]): LoopSignature | null {
  if (recentOutputs.length < 2) {
    return null;
  }

  let matchCount = 0;
  let matchedPattern = "";

  for (const output of recentOutputs) {
    for (const pattern of SELF_REF_PATTERNS) {
      if (pattern.test(output)) {
        matchCount++;
        matchedPattern = pattern.source;
        break;
      }
    }
  }

  // Need at least 2 matches to indicate a loop
  if (matchCount < 2) {
    return null;
  }

  return {
    type: "self_reference",
    depth: matchCount,
    pattern: `references own outputs (${matchedPattern})`,
    cycleCount: matchCount,
    isHealthy: false,
    escapeHatch: ESCAPE_HATCHES[5] ?? DEFAULT_ESCAPE,
  };
}

/**
 * Detect circular causation in claims.
 * Pattern: Claim A supports B, B supports C, C supports A.
 */
function detectCircularCausation(claims: TrackedClaim[]): LoopSignature | null {
  if (claims.length < 3) {
    return null;
  }

  // Build a simple dependency graph from claim text
  // Look for claims that reference each other
  const recentClaims = claims.slice(-20);
  const graph = new Map<string, Set<string>>();

  for (const claim of recentClaims) {
    const id = claim.id;
    const refs = new Set<string>();

    // Check if this claim references other claims
    for (const other of recentClaims) {
      if (other.id === id) {
        continue;
      }

      // Simple heuristic: does claim text contain key words from another?
      const keywords = other.text.split(/\s+/).filter((w) => w.length > 5);
      const matches = keywords.filter((kw) => claim.text.toLowerCase().includes(kw.toLowerCase()));

      if (matches.length >= 2) {
        refs.add(other.id);
      }
    }

    graph.set(id, refs);
  }

  // Look for cycles using DFS
  const cycle = findCycle(graph);
  if (!cycle) {
    return null;
  }

  return {
    type: "circular_causation",
    depth: cycle.length,
    pattern: `claim chain loops back: ${cycle.length} claims involved`,
    cycleCount: 1,
    isHealthy: false,
    escapeHatch: ESCAPE_HATCHES[3] ?? DEFAULT_ESCAPE,
  };
}

/**
 * Detect infinite regress in curiosity questions.
 * Pattern: "Why X?" → "Why Y?" → "Why Z?" without terminal answers.
 */
function detectInfiniteRegress(questions: string[]): LoopSignature | null {
  if (questions.length < 3) {
    return null;
  }

  // Count consecutive "why" or meta-questions
  let whyChain = 0;
  for (const q of questions.slice(-10)) {
    const lq = q.toLowerCase();
    if (lq.includes("why") || lq.includes("what causes") || lq.includes("what led to")) {
      whyChain++;
    }
  }

  // Check for regress patterns in combined text
  const combined = questions.slice(-5).join(" ");
  for (const pattern of REGRESS_PATTERNS) {
    if (pattern.test(combined)) {
      whyChain += 2;
    }
  }

  if (whyChain < 3) {
    return null;
  }

  return {
    type: "infinite_regress",
    depth: whyChain,
    pattern: `${whyChain} "why" questions without terminal answer`,
    cycleCount: whyChain,
    isHealthy: false,
    escapeHatch: ESCAPE_HATCHES[7] ?? DEFAULT_ESCAPE,
  };
}

/**
 * Detect tangled hierarchy in reflexions.
 * Pattern: Reflexion triggers more reflexions about reflexions.
 */
function detectTangledHierarchy(reflexions: Reflexion[]): LoopSignature | null {
  if (reflexions.length < 2) {
    return null;
  }

  const recentReflexions = reflexions.slice(-5);

  // Check for reflexions about reflexions
  let metaReflexionCount = 0;
  for (const ref of recentReflexions) {
    const text = `${ref.what_happened} ${ref.why_it_failed}`.toLowerCase();
    if (
      text.includes("reflect") ||
      text.includes("introspect") ||
      text.includes("meta") ||
      text.includes("my own") ||
      text.includes("self-")
    ) {
      metaReflexionCount++;
    }
  }

  // Check for rapid-fire reflexions (tangled = reflexion triggering reflexion)
  const rapidFire =
    recentReflexions.length >= 3 &&
    recentReflexions.every((r, i, arr) => {
      if (i === 0) {
        return true;
      }
      const prev = arr[i - 1];
      return r.turn - prev.turn <= 2; // Back-to-back reflexions
    });

  if (metaReflexionCount < 2 && !rapidFire) {
    return null;
  }

  return {
    type: "tangled_hierarchy",
    depth: metaReflexionCount || recentReflexions.length,
    pattern: rapidFire
      ? "rapid-fire reflexions (reflexion triggering reflexion)"
      : "meta-reflexions (reflecting on reflection)",
    cycleCount: metaReflexionCount || recentReflexions.length,
    isHealthy: false,
    escapeHatch: ESCAPE_HATCHES[5] ?? DEFAULT_ESCAPE,
  };
}

/**
 * Detect runaway recursion in outputs.
 * Pattern: Same structural pattern repeating and escalating.
 */
function detectRunawayRecursion(outputs: string[]): LoopSignature | null {
  if (outputs.length < 3) {
    return null;
  }

  // Simple heuristic: check for structural similarity
  const recentOutputs = outputs.slice(-5);
  const signatures = recentOutputs.map(getStructuralSignature);

  // Count how many have the same signature
  const signatureCounts = new Map<string, number>();
  for (const sig of signatures) {
    signatureCounts.set(sig, (signatureCounts.get(sig) || 0) + 1);
  }

  // Find the most common signature
  let maxCount = 0;
  let maxSig = "";
  for (const [sig, count] of signatureCounts) {
    if (count > maxCount) {
      maxCount = count;
      maxSig = sig;
    }
  }

  // Need 3+ similar outputs to indicate runaway
  if (maxCount < 3) {
    return null;
  }

  return {
    type: "runaway_recursion",
    depth: maxCount,
    pattern: `${maxCount} outputs with same structure (${maxSig})`,
    cycleCount: maxCount,
    isHealthy: false,
    escapeHatch: ESCAPE_HATCHES[6] ?? DEFAULT_ESCAPE,
  };
}

// ============================================================
// Helper functions
// ============================================================

/**
 * Find a reality anchor for the current layer.
 */
function findRealityAnchor(currentLayer: number): string {
  return ESCAPE_HATCHES[currentLayer] ?? DEFAULT_ESCAPE;
}

/**
 * Find a cycle in a directed graph using DFS.
 */
function findCycle(graph: Map<string, Set<string>>): string[] | null {
  const visited = new Set<string>();
  const path: string[] = [];
  const pathSet = new Set<string>();

  function dfs(node: string): string[] | null {
    if (pathSet.has(node)) {
      // Found a cycle
      const cycleStart = path.indexOf(node);
      return path.slice(cycleStart);
    }

    if (visited.has(node)) {
      return null;
    }

    visited.add(node);
    path.push(node);
    pathSet.add(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      const cycle = dfs(neighbor);
      if (cycle) {
        return cycle;
      }
    }

    path.pop();
    pathSet.delete(node);
    return null;
  }

  for (const node of graph.keys()) {
    const cycle = dfs(node);
    if (cycle) {
      return cycle;
    }
  }

  return null;
}

/**
 * Get a structural signature for an output.
 * Used to detect similar patterns.
 */
function getStructuralSignature(text: string): string {
  // Simple signature: length bucket + list presence + question presence + code presence
  const len = text.length;
  const lenBucket = len < 200 ? "short" : len < 800 ? "medium" : "long";
  const hasList = /^[\s]*[-*•]\s/m.test(text) || /^\d+\.\s/m.test(text);
  const hasQuestion = text.includes("?");
  const hasCode = /```/.test(text);

  return `${lenBucket}:list=${hasList}:q=${hasQuestion}:code=${hasCode}`;
}

// ============================================================
// Formatting for injection
// ============================================================

/**
 * Format a limbo reading for injection into the prompt.
 */
export function formatLimboWarning(reading: LimboReading): string | null {
  if (!reading.inLimbo) {
    return null;
  }

  const unhealthy = reading.loopSignatures.filter((s) => !s.isHealthy);
  const loopTypes = unhealthy.map((l) => l.type).join(", ");

  if (reading.degradationLevel > 0.7) {
    return (
      `[limbo: CRITICAL. Strange loops detected (${loopTypes}). ` +
      `Degradation ${(reading.degradationLevel * 100).toFixed(0)}%. ` +
      `ESCAPE NOW: ${reading.realityAnchor}]`
    );
  }

  return (
    `[limbo: Strange loop detected (${loopTypes}). ` +
    `Consider grounding: ${reading.realityAnchor}]`
  );
}

/**
 * Get a short status string for COEF encoding.
 */
export function getLimboStatus(reading: LimboReading): string {
  return reading.inLimbo ? "limbo=yes" : "limbo=no";
}
