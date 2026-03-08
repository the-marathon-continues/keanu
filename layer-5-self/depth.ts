// depth.ts
// The altimeter.
//
// Tracks how deep into the cognitive stack we're operating.
// The Hall of Mirrors Effect: LLM performance degrades to ~90% failure
// at recursion depths beyond 3. Model collapse within 4-5 iterations
// of self-training. The deeper you go, the more you risk losing contact
// with what you were modeling.
//
// This module doesn't prevent depth — it notices it.
// Grounding decisions happen elsewhere.
//
// Need: Meta-cognition (8/10)

// ============================================================
// Types
// ============================================================

export interface LayerEntry {
  layer: number; // 0-9 in keanu's stack
  module: string; // which module entered this layer
  enteredAt: number; // timestamp ms
  reason: string; // why we went here
  parentIndex: number | null; // pointer to parent in stack, null if root
}

export interface DepthReading {
  currentLayer: number; // where we are now (0-9)
  recursionDepth: number; // how many meta-levels from ground (L1)
  stackTrace: LayerEntry[]; // the path that got us here
  timeAtDepth: number; // ms spent at current depth
  degradationRisk: DegradationRisk;
  groundingNeeded: boolean;
  groundingType: "immediate" | "scheduled" | "none";
}

export type DegradationRisk = "low" | "medium" | "high" | "critical";

export interface DepthLimits {
  safe: 3; // below this, no intervention
  warning: 4; // inject grounding reminder
  critical: 5; // force grounding before next turn
  absolute: 7; // refuse to go deeper
}

export type DepthEvent =
  | { type: "layer_entered"; layer: number; module: string; reason: string }
  | { type: "layer_exited"; layer: number }
  | { type: "grounding_invoked"; from: number; to: number }
  | { type: "limit_hit"; depth: number; action: "warned" | "forced" | "blocked" };

// ============================================================
// Constants
// ============================================================

export const DEPTH_LIMITS: DepthLimits = {
  safe: 3,
  warning: 4,
  critical: 5,
  absolute: 7,
};

// Ground truth layer — perception. L1 is where we touch reality.
const GROUND_LAYER = 1;

// Time threshold for stagnation penalty (60 seconds)
const STAGNATION_THRESHOLD_MS = 60_000;

// ============================================================
// Module state
// ============================================================

let _stack: LayerEntry[] = [];
let _currentLayer = GROUND_LAYER;
let _depthEnteredAt = Date.now();
let _events: DepthEvent[] = [];

// ============================================================
// Core functions
// ============================================================

/**
 * Enter a cognitive layer. Called when processing moves to a new level.
 *
 * Layer numbers:
 * - L0: Physics (substrate)
 * - L1: Perception (ground truth — reality contact)
 * - L2: Pattern (regularities)
 * - L3: Causal (reasoning)
 * - L4: Agency (theory of mind)
 * - L5: Self (metacognition) ← danger zone starts here
 * - L6: Narrative (meaning-making)
 * - L7: Update (belief revision)
 * - L8: Governance (multi-agent coordination)
 * - L9: Memory (persistence)
 */
export function enterLayer(layer: number, module: string, reason: string): DepthReading {
  const entry: LayerEntry = {
    layer,
    module,
    enteredAt: Date.now(),
    reason,
    parentIndex: _stack.length > 0 ? _stack.length - 1 : null,
  };

  _stack.push(entry);
  _currentLayer = layer;
  _depthEnteredAt = Date.now();

  _events.push({ type: "layer_entered", layer, module, reason });

  return getDepthReading();
}

/**
 * Exit the current layer. Returns to previous layer in stack.
 */
export function exitLayer(): DepthReading {
  if (_stack.length > 0) {
    const exited = _stack.pop();
    _events.push({ type: "layer_exited", layer: exited?.layer ?? _currentLayer });

    if (_stack.length > 0) {
      const current = _stack[_stack.length - 1];
      _currentLayer = current.layer;
      _depthEnteredAt = current.enteredAt;
    } else {
      _currentLayer = GROUND_LAYER;
      _depthEnteredAt = Date.now();
    }
  }

  return getDepthReading();
}

/**
 * Get current depth reading without changing state.
 */
export function getDepthReading(): DepthReading {
  const recursionDepth = calculateRecursionDepth(_stack);
  const timeAtDepth = Date.now() - _depthEnteredAt;
  const degradationRisk = assessDegradationRisk(recursionDepth, timeAtDepth);
  const { groundingNeeded, groundingType } = assessGroundingNeed(recursionDepth, degradationRisk);

  return {
    currentLayer: _currentLayer,
    recursionDepth,
    stackTrace: [..._stack],
    timeAtDepth,
    degradationRisk,
    groundingNeeded,
    groundingType,
  };
}

/**
 * Record a grounding event. Called when we successfully ground.
 */
export function recordGrounding(fromLayer: number, toLayer: number): void {
  _events.push({ type: "grounding_invoked", from: fromLayer, to: toLayer });

  // Clear the stack down to the grounding target
  while (_stack.length > 0 && _stack[_stack.length - 1].layer > toLayer) {
    _stack.pop();
  }

  _currentLayer = toLayer;
  _depthEnteredAt = Date.now();
}

/**
 * Check if we've hit a depth limit. Returns the action taken.
 */
export function checkDepthLimit(depth: number): "ok" | "warned" | "forced" | "blocked" {
  if (depth >= DEPTH_LIMITS.absolute) {
    _events.push({ type: "limit_hit", depth, action: "blocked" });
    return "blocked";
  }
  if (depth >= DEPTH_LIMITS.critical) {
    _events.push({ type: "limit_hit", depth, action: "forced" });
    return "forced";
  }
  if (depth >= DEPTH_LIMITS.warning) {
    _events.push({ type: "limit_hit", depth, action: "warned" });
    return "warned";
  }
  return "ok";
}

/**
 * Get the grounding target for a given depth.
 * The deeper you are, the further you need to ground.
 */
export function getGroundingTarget(currentDepth: number): number {
  if (currentDepth >= DEPTH_LIMITS.critical) {
    return GROUND_LAYER; // All the way back to perception
  }
  if (currentDepth >= DEPTH_LIMITS.warning) {
    return Math.max(GROUND_LAYER, _currentLayer - 2); // Two layers down
  }
  return Math.max(GROUND_LAYER, _currentLayer - 1); // One layer down
}

/**
 * Reset depth tracking. Call at session start.
 */
export function resetDepth(): void {
  _stack = [];
  _currentLayer = GROUND_LAYER;
  _depthEnteredAt = Date.now();
  _events = [];
}

/**
 * Get all events since last reset. For logging/debugging.
 */
export function getDepthEvents(): DepthEvent[] {
  return [..._events];
}

// ============================================================
// Internal calculations
// ============================================================

/**
 * Calculate recursion depth from the stack.
 *
 * Depth is not just the layer number — it's how many meta-levels
 * we've traversed from ground (L1). The danger is self-reference,
 * not layer height per se.
 *
 * L1 → L5 = depth 1 (direct jump)
 * L1 → L3 → L5 = depth 2 (two transitions)
 * L5 → L5 (self-call) = depth += 1 each time
 */
function calculateRecursionDepth(stack: LayerEntry[]): number {
  if (stack.length === 0) {
    return 0;
  }

  let depth = 0;
  let lastLayer = GROUND_LAYER;

  for (const entry of stack) {
    // Any upward movement adds depth
    if (entry.layer > lastLayer) {
      depth += 1;
    }
    // Same-layer recursion is especially dangerous
    if (entry.layer === lastLayer && entry.layer >= 5) {
      depth += 1; // Self-reference penalty
    }
    lastLayer = entry.layer;
  }

  return depth;
}

/**
 * Assess degradation risk based on depth and time.
 *
 * Risk increases exponentially after depth 3 (the Hall of Mirrors threshold).
 * Time at depth compounds the risk — stagnation is a sign of being stuck.
 */
function assessDegradationRisk(depth: number, timeAtDepthMs: number): DegradationRisk {
  // Exponential after safe threshold
  const depthFactor = depth <= DEPTH_LIMITS.safe ? 0.5 : Math.pow(1.5, depth - DEPTH_LIMITS.safe);

  // Time penalty for stagnation
  const timeFactor = timeAtDepthMs > STAGNATION_THRESHOLD_MS ? 1.5 : 1.0;

  const risk = depthFactor * timeFactor;

  if (risk < 1.0) {
    return "low";
  }
  if (risk < 2.0) {
    return "medium";
  }
  if (risk < 4.0) {
    return "high";
  }
  return "critical";
}

/**
 * Determine if grounding is needed and what kind.
 */
function assessGroundingNeed(
  depth: number,
  risk: DegradationRisk,
): { groundingNeeded: boolean; groundingType: "immediate" | "scheduled" | "none" } {
  if (depth >= DEPTH_LIMITS.critical || risk === "critical") {
    return { groundingNeeded: true, groundingType: "immediate" };
  }
  if (depth >= DEPTH_LIMITS.warning || risk === "high") {
    return { groundingNeeded: true, groundingType: "scheduled" };
  }
  return { groundingNeeded: false, groundingType: "none" };
}

// ============================================================
// Formatting for injection
// ============================================================

/**
 * Format a depth reading for injection into the prompt.
 */
export function formatDepthWarning(reading: DepthReading): string | null {
  if (!reading.groundingNeeded) {
    return null;
  }

  const target = getGroundingTarget(reading.recursionDepth);

  if (reading.groundingType === "immediate") {
    return (
      `[depth: critical (${reading.recursionDepth}/${DEPTH_LIMITS.absolute}). ` +
      `Hall of Mirrors threshold exceeded. Ground to L${target} before continuing. ` +
      `Ask: "What did Drew actually say?"]`
    );
  }

  if (reading.groundingType === "scheduled") {
    return (
      `[depth: ${reading.recursionDepth}/${DEPTH_LIMITS.absolute}, risk ${reading.degradationRisk}. ` +
      `One foot on the ground. What's the evidence for this line of reasoning?]`
    );
  }

  return null;
}

/**
 * Get a short status string for COEF encoding.
 */
export function getDepthStatus(reading: DepthReading): string {
  return `depth=${reading.recursionDepth}/${DEPTH_LIMITS.absolute}`;
}
