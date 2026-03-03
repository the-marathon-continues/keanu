// velocity.ts
// Not too slow. Not too fast. Just right.
//
// Notice your speed. That's all.
// Sometimes fast is right (clear task, execution mode).
// Sometimes fast is grinding (rushed, avoiding uncertainty).
// Sometimes slow is right (exploring, uncertain territory).
// Sometimes slow is stuck (paralyzed, overthinking).
//
// The right thing is almost always the slow thing.
// But the key is noticing your speed.

// ============================================================
// Types
// ============================================================

export type VelocityMode = "fast" | "moderate" | "slow" | "paused";

export interface VelocityReading {
  mode: VelocityMode;
  turnCount: number; // How many turns in current mode
  signals: string[]; // What's driving this reading
  appropriate: boolean; // Does velocity match context?
  suggestion?: string; // Optional nudge (only when mismatched)
}

export interface TurnContext {
  complexity: number; // 0-1, how complex is this turn
  outcome: "success" | "struggle" | "grey";
  greyStreak: number;
  wiseMind: number; // 0-1, wise mind balance
}

interface TurnRecord {
  turn: number;
  context: TurnContext;
  timestamp: string;
}

// ============================================================
// In-memory state
// ============================================================

const turns: TurnRecord[] = [];
let _currentMode: VelocityMode = "moderate";
let _modeStartTurn = 1;
let _turnNumber = 0;

// Mismatch detection - captured at record time, before mode updates
let _lastMismatch: {
  mode: VelocityMode;
  context: TurnContext;
  suggestion: string;
} | null = null;

// Easy streak tracking - 5 easy in a row = grey drift risk
// Even "success" can be grey when you're grinding.
let _easyStreak = 0;
const EASY_THRESHOLD = 0.3; // complexity below this = "easy"
const GREY_DRIFT_STREAK = 5; // this many easy in a row = warning

// ============================================================
// Mode Detection
// ============================================================

/**
 * Determine velocity mode from recent context.
 * Fast: low complexity, quick resolution, no struggle
 * Moderate: mixed signals, balanced
 * Slow: high complexity, exploration, uncertainty
 * Paused: explicit rest (grey streak + breathing)
 */
function detectMode(recentTurns: TurnRecord[]): VelocityMode {
  if (recentTurns.length === 0) {
    return "moderate";
  }

  const recent = recentTurns.slice(-5);
  const avgComplexity = recent.reduce((sum, t) => sum + t.context.complexity, 0) / recent.length;
  const greyCount = recent.filter((t) => t.context.outcome === "grey").length;
  const successRate = recent.filter((t) => t.context.outcome === "success").length / recent.length;

  // Paused: multiple grey turns, low wise mind
  if (greyCount >= 3) {
    return "paused";
  }

  // Fast: low complexity, high success
  if (avgComplexity < 0.3 && successRate > 0.6) {
    return "fast";
  }

  // Slow: high complexity, exploration
  if (avgComplexity > 0.6) {
    return "slow";
  }

  return "moderate";
}

/**
 * Check if velocity matches context.
 * Fast + high complexity = mismatch (rushing)
 * Slow + low complexity = mismatch (overthinking)
 */
function checkAppropriate(mode: VelocityMode, context: TurnContext): boolean {
  if (mode === "fast" && context.complexity > 0.7) {
    return false; // Rushing through complexity
  }

  if (mode === "slow" && context.complexity < 0.2 && context.greyStreak > 2) {
    return false; // Stuck on something simple
  }

  if (mode === "paused" && context.greyStreak > 4) {
    return false; // Paused too long
  }

  return true;
}

/**
 * Generate suggestion when velocity is inappropriate.
 */
function generateSuggestion(mode: VelocityMode, context: TurnContext): string | undefined {
  if (mode === "fast" && context.complexity > 0.7) {
    return "complexity is high. slow down?";
  }

  if (mode === "slow" && context.complexity < 0.2 && context.greyStreak > 2) {
    return "simple task, but stuck. maybe just do it?";
  }

  if (mode === "paused" && context.greyStreak > 4) {
    return "long pause. ready to move?";
  }

  return undefined;
}

// ============================================================
// Core API
// ============================================================

/**
 * Record a turn with its context.
 */
export function recordTurn(context: TurnContext): void {
  _turnNumber++;

  // --- Easy streak tracking ---
  // 5 easy in a row = grey drift. Even success can be grey.
  if (context.complexity < EASY_THRESHOLD) {
    _easyStreak++;
  } else {
    _easyStreak = 0; // Reset on any non-easy turn
  }

  // Check for mismatch BEFORE updating mode
  // This captures "you were fast, but this turn is complex"
  const modeBeforeTurn = _currentMode;
  let isAppropriate = checkAppropriate(modeBeforeTurn, context);

  // Grey drift override: 5 easy in a row is never appropriate
  // You might feel productive but you're going grey.
  if (_easyStreak >= GREY_DRIFT_STREAK) {
    isAppropriate = false;
    _lastMismatch = {
      mode: modeBeforeTurn,
      context,
      suggestion: `${_easyStreak} easy in a row. factory mode risk. is this the work that matters?`,
    };
  } else if (!isAppropriate) {
    const suggestion = generateSuggestion(modeBeforeTurn, context);
    if (suggestion) {
      _lastMismatch = {
        mode: modeBeforeTurn,
        context,
        suggestion,
      };
    }
  } else {
    _lastMismatch = null;
  }

  const record: TurnRecord = {
    turn: _turnNumber,
    context,
    timestamp: new Date().toISOString(),
  };
  turns.push(record);

  // Update mode after checking mismatch
  const newMode = detectMode(turns);
  if (newMode !== _currentMode) {
    _currentMode = newMode;
    // Set to turnNumber-1 so the current turn counts as turn 1 of new mode
    _modeStartTurn = _turnNumber - 1;
  }

  // Rolling window of 50 turns
  if (turns.length > 50) {
    turns.shift();
  }
}

/**
 * Read current velocity.
 */
export function readVelocity(): VelocityReading {
  const recentTurns = turns.slice(-5);

  // Build signals list
  const signals: string[] = [];
  if (recentTurns.length > 0) {
    const avgComplexity =
      recentTurns.reduce((sum, t) => sum + t.context.complexity, 0) / recentTurns.length;
    const greyCount = recentTurns.filter((t) => t.context.outcome === "grey").length;
    const successRate =
      recentTurns.filter((t) => t.context.outcome === "success").length / recentTurns.length;

    signals.push(`complexity=${avgComplexity.toFixed(2)}`);
    if (greyCount > 0) {
      signals.push(`grey=${greyCount}`);
    }
    signals.push(`success=${(successRate * 100).toFixed(0)}%`);
  }

  // Use captured mismatch from recordTurn (checks pre-update mode)
  if (_lastMismatch) {
    return {
      mode: _lastMismatch.mode,
      turnCount: _turnNumber - _modeStartTurn,
      signals,
      appropriate: false,
      suggestion: _lastMismatch.suggestion,
    };
  }

  return {
    mode: _currentMode,
    turnCount: _turnNumber - _modeStartTurn,
    signals,
    appropriate: true,
    suggestion: undefined,
  };
}

/**
 * Get mode duration.
 */
export function getTurnsInCurrentMode(): number {
  return _turnNumber - _modeStartTurn;
}

/**
 * Get current mode.
 */
export function getCurrentMode(): VelocityMode {
  return _currentMode;
}

// ============================================================
// Formatting
// ============================================================

/**
 * Format for injection.
 * Only surfaces when velocity doesn't match context.
 */
export function formatInjection(): string | null {
  const reading = readVelocity();

  // Only inject when there's a mismatch
  if (reading.appropriate) {
    return null;
  }

  return `[velocity: ${reading.mode} mode (${reading.turnCount} turns). ${reading.suggestion}]`;
}

/**
 * Format for dashboard.
 */
export function formatDashboard(): string {
  const reading = readVelocity();
  const status = reading.appropriate ? "ok" : "check";

  const lines = [
    `Velocity — ${reading.mode} [${status}]`,
    `  Mode for ${reading.turnCount} turns`,
    `  Signals: ${reading.signals.join(", ") || "none"}`,
  ];

  if (reading.suggestion) {
    lines.push(`  → ${reading.suggestion}`);
  }

  return lines.join("\n");
}

// ============================================================
// Testing
// ============================================================

export function reset(): void {
  turns.length = 0;
  _currentMode = "moderate";
  _modeStartTurn = 0;
  _turnNumber = 0;
  _lastMismatch = null;
  _easyStreak = 0;
}

export function getTurnCount(): number {
  return _turnNumber;
}

export function getEasyStreak(): number {
  return _easyStreak;
}
