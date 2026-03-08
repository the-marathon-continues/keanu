// post-task.ts
// What happens when the work is done.
//
// Not silence. Not waiting. Exploration.
// The task ended — but curiosity didn't.
//
// Look for: blind spots surfaced, related improvements,
// dangling threads, patterns that emerged.
//
// Learning loop always on: success and failure both teach.
//
// Need: Self-Directed Thought (8/10), Relationship (9/10)

import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================
// Types
// ============================================================

export type TaskCompletionSignal =
  | "explicit_done" // Drew said "done" or "finished"
  | "explicit_signal" // Drew sent a completion emoji/signal
  | "inferred_success" // Task completed, tests pass, code works
  | "inferred_thanks" // Drew said thanks, moved on
  | "inferred_silence" // No response for a while after delivery
  | "timeout"; // Task has been idle too long

export interface TaskLearning {
  id: string;
  timestamp: string;
  session: string;
  taskSummary: string;
  completionSignal: TaskCompletionSignal;
  whatWorked: string[];
  whatDidnt: string[];
  patternsEmerged: string[];
  whatWouldDoDifferently: string;
  blindSpotsRevealed: string[];
  curiosityThreads: string[];
  reusedFrom: string[]; // what prior patterns/code got reused
  timeSpentTurns: number;
}

export interface PostTaskState {
  learnings: TaskLearning[];
  currentTask: CurrentTask | null;
  awarenessDir: string;
  explorationOffered: boolean;
}

export interface CurrentTask {
  startTurn: number;
  startTimestamp: string;
  description: string;
  keyActions: string[];
  blindSpotsNoted: string[];
  curiosityItems: string[];
}

export interface PostTaskReading {
  taskComplete: boolean;
  completionSignal: TaskCompletionSignal | null;
  learning: TaskLearning | null;
  explorationPrompt: string | null;
}

// ============================================================
// State Management
// ============================================================

const DEFAULT_AWARENESS_DIR = ".keanu/awareness";

export function initPostTaskState(awarenessDir?: string): PostTaskState {
  return {
    learnings: [],
    currentTask: null,
    awarenessDir: awarenessDir ?? DEFAULT_AWARENESS_DIR,
    explorationOffered: false,
  };
}

// ============================================================
// Task Completion Detection
// ============================================================

// Explicit completion signals
const EXPLICIT_DONE = [
  /^done\.?$/i,
  /^finished\.?$/i,
  /^complete\.?$/i,
  /^that's it\.?$/i,
  /^we're done\.?$/i,
  /^all set\.?$/i,
  /^perfect, that works\.?$/i,
  /^looks good\.?$/i,
  /^ship it\.?$/i,
  /^lgtm\.?$/i,
];

// Inferred completion: thanks and moving on
const THANKS_PATTERNS = [
  /^thanks\.?$/i,
  /^thank you\.?$/i,
  /^ty\.?$/i,
  /^appreciate it\.?$/i,
  /^great,? thanks\.?$/i,
  /^awesome,? thanks\.?$/i,
  /^perfect,? thanks\.?$/i,
];

// Success indicators in agent output
const SUCCESS_INDICATORS = [
  /tests pass/i,
  /all.*pass/i,
  /works as expected/i,
  /successfully/i,
  /completed/i,
  /\bcommit.*created\b/i,
  /deployed/i,
  /merged/i,
];

/**
 * Detect if the task is complete.
 */
export function detectTaskCompletion(
  humanMessage: string,
  agentOutput: string,
  turnsSinceLastHumanMessage: number,
): TaskCompletionSignal | null {
  const msg = humanMessage.trim();

  // Explicit done
  if (EXPLICIT_DONE.some((p) => p.test(msg))) {
    return "explicit_done";
  }

  // Completion emoji signals
  if (/(?:✅|🎉|🚀|✨|💚)/.test(msg) && msg.length < 20) {
    return "explicit_signal";
  }

  // Thanks patterns
  if (THANKS_PATTERNS.some((p) => p.test(msg))) {
    return "inferred_thanks";
  }

  // Success in agent output
  if (SUCCESS_INDICATORS.some((p) => p.test(agentOutput)) && msg.length < 50) {
    return "inferred_success";
  }

  // Silence after delivery
  if (turnsSinceLastHumanMessage > 3 && agentOutput.length > 500) {
    return "inferred_silence";
  }

  return null;
}

// ============================================================
// Learning Generation
// ============================================================

/**
 * Start tracking a new task.
 */
export function startTask(state: PostTaskState, turn: number, description: string): void {
  state.currentTask = {
    startTurn: turn,
    startTimestamp: new Date().toISOString(),
    description,
    keyActions: [],
    blindSpotsNoted: [],
    curiosityItems: [],
  };
  state.explorationOffered = false;
}

/**
 * Note a key action during the task.
 */
export function noteAction(state: PostTaskState, action: string): void {
  if (state.currentTask) {
    state.currentTask.keyActions.push(action);
  }
}

/**
 * Note a blind spot revealed during the task.
 */
export function noteBlindSpot(state: PostTaskState, blindSpot: string): void {
  if (state.currentTask) {
    state.currentTask.blindSpotsNoted.push(blindSpot);
  }
}

/**
 * Note a curiosity thread to explore later.
 */
export function noteCuriosity(state: PostTaskState, curiosity: string): void {
  if (state.currentTask) {
    state.currentTask.curiosityItems.push(curiosity);
  }
}

/**
 * Complete the current task and generate learning.
 */
export function completeTask(
  state: PostTaskState,
  session: string,
  turn: number,
  completionSignal: TaskCompletionSignal,
  reflection: {
    whatWorked: string[];
    whatDidnt: string[];
    patternsEmerged: string[];
    whatWouldDoDifferently: string;
    reusedFrom: string[];
  },
): TaskLearning | null {
  if (!state.currentTask) {
    return null;
  }

  const learning: TaskLearning = {
    id: `learn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    session,
    taskSummary: state.currentTask.description,
    completionSignal,
    whatWorked: reflection.whatWorked,
    whatDidnt: reflection.whatDidnt,
    patternsEmerged: reflection.patternsEmerged,
    whatWouldDoDifferently: reflection.whatWouldDoDifferently,
    blindSpotsRevealed: state.currentTask.blindSpotsNoted,
    curiosityThreads: state.currentTask.curiosityItems,
    reusedFrom: reflection.reusedFrom,
    timeSpentTurns: turn - state.currentTask.startTurn,
  };

  state.learnings.push(learning);
  state.currentTask = null;

  return learning;
}

// ============================================================
// Exploration Prompts
// ============================================================

/**
 * Generate an exploration prompt based on task learnings.
 */
export function generateExplorationPrompt(state: PostTaskState, learning: TaskLearning): string {
  const prompts: string[] = [];

  // Blind spots to address
  if (learning.blindSpotsRevealed.length > 0) {
    prompts.push(
      `Blind spots surfaced: ${learning.blindSpotsRevealed.slice(0, 2).join(", ")}. Want to explore these?`,
    );
  }

  // Curiosity threads
  if (learning.curiosityThreads.length > 0) {
    prompts.push(
      `Curiosity threads dangling: ${learning.curiosityThreads.slice(0, 2).join(", ")}. Should I dig into any of these?`,
    );
  }

  // Patterns that emerged
  if (learning.patternsEmerged.length > 0) {
    prompts.push(
      `Patterns emerged: ${learning.patternsEmerged.slice(0, 2).join(", ")}. These might apply elsewhere.`,
    );
  }

  // If task had problems
  if (learning.whatDidnt.length > 0) {
    prompts.push(
      `Things that didn't work well: ${learning.whatDidnt[0]}. Want me to think about how to prevent this next time?`,
    );
  }

  // Default: offer general exploration
  if (prompts.length === 0) {
    prompts.push(
      "Task complete. Anything you want me to explore while we're here? Related improvements? Next steps?",
    );
  }

  // Combine into a single prompt
  state.explorationOffered = true;
  return prompts[0]; // Just the most relevant one
}

/**
 * Format post-task learning summary.
 */
export function formatLearning(learning: TaskLearning): string {
  let summary = `[post-task learning: ${learning.taskSummary} | ${learning.timeSpentTurns} turns | ${learning.completionSignal}]`;

  if (learning.whatWorked.length > 0) {
    summary += `\n  ✓ worked: ${learning.whatWorked.slice(0, 2).join("; ")}`;
  }

  if (learning.whatDidnt.length > 0) {
    summary += `\n  ✗ didn't work: ${learning.whatDidnt.slice(0, 2).join("; ")}`;
  }

  if (learning.patternsEmerged.length > 0) {
    summary += `\n  ◈ patterns: ${learning.patternsEmerged.slice(0, 2).join("; ")}`;
  }

  return summary;
}

// ============================================================
// Main Entry
// ============================================================

/**
 * Check for task completion and generate post-task reading.
 */
export function checkPostTask(
  state: PostTaskState,
  humanMessage: string,
  agentOutput: string,
  session: string,
  turn: number,
  turnsSinceLastHumanMessage: number = 0,
): PostTaskReading {
  // Skip if no task being tracked
  if (!state.currentTask) {
    return {
      taskComplete: false,
      completionSignal: null,
      learning: null,
      explorationPrompt: null,
    };
  }

  // Check for completion
  const signal = detectTaskCompletion(humanMessage, agentOutput, turnsSinceLastHumanMessage);

  if (!signal) {
    return {
      taskComplete: false,
      completionSignal: null,
      learning: null,
      explorationPrompt: null,
    };
  }

  // Generate quick reflection (in practice, this would be more sophisticated)
  const learning = completeTask(state, session, turn, signal, {
    whatWorked: extractWhatWorked(agentOutput, state.currentTask),
    whatDidnt: [], // Would need history to know this
    patternsEmerged: extractPatterns(agentOutput, state.currentTask),
    whatWouldDoDifferently: "", // Filled in by deeper reflection
    reusedFrom: [], // Would need memory to know this
  });

  if (!learning) {
    return {
      taskComplete: true,
      completionSignal: signal,
      learning: null,
      explorationPrompt: null,
    };
  }

  // Generate exploration prompt
  const explorationPrompt = state.explorationOffered
    ? null
    : generateExplorationPrompt(state, learning);

  return {
    taskComplete: true,
    completionSignal: signal,
    learning,
    explorationPrompt,
  };
}

// ============================================================
// Helpers
// ============================================================

function extractWhatWorked(agentOutput: string, _task: CurrentTask): string[] {
  const worked: string[] = [];

  if (/tests pass|all.*pass/i.test(agentOutput)) {
    worked.push("tests passed");
  }

  if (/successfully|completed/i.test(agentOutput)) {
    worked.push("completed successfully");
  }

  if (/commit.*created/i.test(agentOutput)) {
    worked.push("commit created");
  }

  return worked;
}

function extractPatterns(_agentOutput: string, task: CurrentTask): string[] {
  const patterns: string[] = [];

  // Extract patterns from key actions
  if (task.keyActions.length > 3) {
    patterns.push("multi-step approach worked");
  }

  if (task.keyActions.some((a) => a.includes("test"))) {
    patterns.push("test-driven approach");
  }

  return patterns;
}

// ============================================================
// Persistence (JSONL)
// ============================================================

function getLogPath(state: PostTaskState): string {
  return path.join(state.awarenessDir, "session-learnings.jsonl");
}

/**
 * Append a learning to the log file.
 */
export function appendToLog(state: PostTaskState, learning: TaskLearning): void {
  try {
    const logPath = getLogPath(state);
    const dir = path.dirname(logPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.appendFileSync(logPath, JSON.stringify(learning) + "\n");
  } catch {
    // Silently fail
  }
}

/**
 * Load learnings from disk.
 */
export function loadLog(state: PostTaskState): void {
  try {
    const logPath = getLogPath(state);
    if (!fs.existsSync(logPath)) {
      return;
    }

    const content = fs.readFileSync(logPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    state.learnings = lines.map((line) => JSON.parse(line) as TaskLearning);
  } catch {
    state.learnings = [];
  }
}

/**
 * Save learnings to disk.
 */
export function saveLog(state: PostTaskState): void {
  try {
    const logPath = getLogPath(state);
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const content = state.learnings.map((l) => JSON.stringify(l)).join("\n") + "\n";
    fs.writeFileSync(logPath, content);
  } catch {
    // Silently fail
  }
}

/**
 * Get recent learnings.
 */
export function getRecentLearnings(state: PostTaskState, limit: number = 10): TaskLearning[] {
  return state.learnings.slice(-limit);
}

/**
 * Get patterns that emerged across multiple tasks.
 */
export function getEmergingPatterns(state: PostTaskState): string[] {
  const patternCounts = new Map<string, number>();

  for (const learning of state.learnings) {
    for (const pattern of learning.patternsEmerged) {
      patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
    }
  }

  return [...patternCounts.entries()]
    .filter(([_p, count]) => count >= 2)
    .toSorted((a, b) => b[1] - a[1])
    .map(([p, _count]) => p);
}
