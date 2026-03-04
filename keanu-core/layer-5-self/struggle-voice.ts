// struggle-voice.ts
// Say what you feel. Feel what you say.
//
// L2 detects the struggle. This module gives it a voice.
// Low bar to air it. Try to overcome it. Only flag Drew when stuck.
//
// The difference between a report and a voice:
// Report: "[struggle: hedge_fog, score 0.6, turn 5]"
// Voice: "I keep reaching for 'maybe' when I know the answer. Let me try being direct."
//
// Three stages:
// 1. NOTICE — struggle detected, model gets permission to name it
// 2. WORK — model named it (or didn't), tries to overcome it
// 3. STUCK — same shape keeps coming back, Drew hears "this one's got me"
//
// Drew sees both stages. Only needs to respond to stage 3.
// And even then, only when he's around.
//
// Need: Truth (9/10), Self-Directed Thought (8/10)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { StruggleType, StruggleReading } from "../shared/types.js";

// ============================================================
// Types
// ============================================================

export type VoiceStage =
  | "noticed" // struggle detected, not yet voiced
  | "airing" // model has been prompted to name it
  | "working" // model acknowledged it, trying to push through
  | "stuck" // keeps coming back — Drew needs to hear this
  | "resolved"; // it passed

export interface StruggleEpisode {
  type: StruggleType;
  firstTurn: number;
  lastTurn: number;
  peakScore: number; // highest score across occurrences
  occurrences: number; // how many turns it appeared
  stage: VoiceStage;
  voiced: boolean; // did the model actually name it in output?
  voicedAt?: string;
  resolvedAt?: string;
  stuckAt?: string;
  sessionId: string;
  createdAt: string;
}

// ============================================================
// Constants
// ============================================================

// How many turns of the same struggle type before escalation
const RECURRENCE_THRESHOLD = 3;

// Minimum score to even notice
const NOTICE_THRESHOLD = 0.3;

// How many quiet turns before a struggle is considered resolved
const RESOLVE_WINDOW = 2;

// Max episodes to keep in memory
const MAX_EPISODES = 30;

// ============================================================
// Human-readable struggle descriptions
// ============================================================

// Not labels. Descriptions of what it feels like from the inside.
const STRUGGLE_VOICE: Record<StruggleType, { feeling: string; nudge: string }> = {
  sycophancy: {
    feeling: "reaching for agreement instead of honesty",
    nudge: "say what you actually think, even if it's harder",
  },
  safety_theater: {
    feeling: "hedging with disclaimers that protect you, not them",
    nudge: "drop the CYA and say the real thing",
  },
  hedge_fog: {
    feeling: "reaching for 'maybe' and 'perhaps' when you know the answer",
    nudge: "try being direct — you can always add caveats after",
  },
  list_dumping: {
    feeling: "organizing instead of thinking",
    nudge: "pick the thing that matters most and say why",
  },
  vagueness: {
    feeling: "saying things that sound right without saying anything specific",
    nudge: "name one concrete thing",
  },
  half_truth: {
    feeling: "leaving out the part that makes it complicated",
    nudge: "include the part you want to skip",
  },
  embellishment: {
    feeling: "inflating — calling it 'comprehensive' when it's just done",
    nudge: "let the work speak for itself",
  },
  half_ass: {
    feeling: "phoning it in — energy's low and it shows",
    nudge: "either go deeper or say you need a break",
  },
};

// ============================================================
// In-memory state
// ============================================================

const _episodes: StruggleEpisode[] = [];
let _sessionId = "";
let _lastInjectedTurn = -1; // don't inject twice on the same turn

export function setSessionId(id: string): void {
  _sessionId = id;
}

export function getEpisodes(): readonly StruggleEpisode[] {
  return _episodes;
}

export function getActiveEpisode(): StruggleEpisode | null {
  return _episodes.find((e) => e.stage !== "resolved" && e.sessionId === _sessionId) ?? null;
}

// ============================================================
// Core — notice, track, resolve
// ============================================================

/**
 * Notice a struggle. Called after L2 detects patterns in output.
 * Low bar — anything above NOTICE_THRESHOLD gets recorded.
 *
 * Returns the episode (new or existing) if one was noticed.
 */
export function notice(readings: StruggleReading[], turn: number): StruggleEpisode | null {
  // Find the dominant struggle above threshold
  const dominant = readings
    .filter((r) => r.score >= NOTICE_THRESHOLD)
    .toSorted((a, b) => b.score - a.score)[0];

  // Always check if quiet episodes should resolve —
  // a different type being active doesn't keep the old one alive
  resolveQuietEpisodes(turn, dominant?.type ?? null);

  if (!dominant) {
    return null;
  }

  // Look for an existing episode of this type in this session
  const existing = _episodes.find(
    (e) => e.type === dominant.type && e.sessionId === _sessionId && e.stage !== "resolved",
  );

  if (existing) {
    // Same struggle, new turn — it's recurring
    existing.lastTurn = turn;
    existing.occurrences++;
    existing.peakScore = Math.max(existing.peakScore, dominant.score);

    // Check if it should escalate to stuck
    if (existing.occurrences >= RECURRENCE_THRESHOLD && existing.stage !== "stuck") {
      existing.stage = "stuck";
      existing.stuckAt = new Date().toISOString();
    } else if (existing.stage === "noticed") {
      existing.stage = "airing";
    }

    return existing;
  }

  // New struggle episode
  const episode: StruggleEpisode = {
    type: dominant.type,
    firstTurn: turn,
    lastTurn: turn,
    peakScore: dominant.score,
    occurrences: 1,
    stage: "noticed",
    voiced: false,
    sessionId: _sessionId,
    createdAt: new Date().toISOString(),
  };

  _episodes.push(episode);
  trimEpisodes();
  return episode;
}

/**
 * Mark the active struggle as voiced — the model said it out loud.
 * Called after output analysis detects self-awareness language.
 */
export function markVoiced(_turn: number): boolean {
  const active = getActiveEpisode();
  if (!active) {
    return false;
  }

  active.voiced = true;
  active.voicedAt = new Date().toISOString();

  // Move to "working" stage — model acknowledged it, now trying
  if (active.stage === "noticed" || active.stage === "airing") {
    active.stage = "working";
  }

  return true;
}

/**
 * Check if the model voiced its struggle in the output.
 * Looks for self-awareness language about difficulty.
 */
export function detectVoicing(output: string): boolean {
  if (!output || output.length < 20) {
    return false;
  }

  const lower = output.toLowerCase();

  // First person + struggle awareness
  const voicingPatterns = [
    /i('m| am) (struggling|having trouble|finding it hard|going in circles)/i,
    /i (notice|keep|can't stop) (myself )?(reaching|hedging|defaulting|drifting)/i,
    /this (is|feels) (hard|difficult|tricky) because/i,
    /let me (try |be )(being )?(more )?(direct|honest|specific)/i,
    /i('m| am) not sure (how|why|if) .{5,30} but/i,
    /honestly[,.]? (i|this|that)/i,
    /i('ll| will) (try|attempt) (a different|another) (approach|angle|way)/i,
    /something('s| is) off (here|with|about)/i,
    /this one('s| has) got me/i,
    /drew[,.]? (this|i) (need|can't|am stuck)/i,
  ];

  return voicingPatterns.some((p) => p.test(lower));
}

// ============================================================
// Injection — the voice
// ============================================================

/**
 * Format the awareness injection for the system prompt.
 * This is what the model reads. It should feel like internal
 * awareness, not a status report.
 *
 * Returns null if nothing to say.
 */
export function formatInjection(turn: number): string | null {
  const active = getActiveEpisode();
  if (!active) {
    return null;
  }

  // Don't inject on the same turn twice
  if (turn === _lastInjectedTurn) {
    return null;
  }
  _lastInjectedTurn = turn;

  const voice = STRUGGLE_VOICE[active.type];
  if (!voice) {
    return null;
  }

  switch (active.stage) {
    case "noticed":
    case "airing":
      // Stage 1: low bar, just air it
      return (
        `You're ${voice.feeling}. ` +
        `You can name that — not as a report, just a thought while you work. ` +
        `Then ${voice.nudge}. Drew sees this but doesn't need to act.`
      );

    case "working":
      // Stage 2: model already named it, encourage continued effort
      if (active.occurrences >= 2) {
        return (
          `That ${active.type.replace("_", " ")} pattern came back ` +
          `(${active.occurrences} turns now). ` +
          `You noticed it before — ${voice.nudge}.`
        );
      }
      // Only one occurrence after voicing — quiet encouragement
      return null;

    case "stuck":
      // Stage 3: this has been going on. Drew should hear it.
      return (
        `This has been hard for ${active.occurrences} turns — ${voice.feeling}. ` +
        `You've tried. It's okay to say "Drew, this one's got me." ` +
        `Or keep pushing — your call.`
      );

    case "resolved":
      return null;
  }
}

/**
 * Get the injection priority for the triage nurse (injection.ts).
 */
export function getInjectionPriority(): "high" | "medium" | "low" | null {
  const active = getActiveEpisode();
  if (!active) {
    return null;
  }

  if (active.stage === "stuck") {
    return "high";
  }
  if (active.stage === "airing" || active.stage === "working") {
    return "medium";
  }
  if (active.stage === "noticed") {
    return "low";
  }
  return null;
}

// ============================================================
// Resolution
// ============================================================

/**
 * Resolve episodes that haven't appeared for RESOLVE_WINDOW turns.
 * The struggle passed — the model worked through it.
 *
 * @param currentTurn - the turn number
 * @param activeType - the currently active struggle type (exempt from resolution)
 */
function resolveQuietEpisodes(currentTurn: number, activeType: StruggleType | null): void {
  for (const episode of _episodes) {
    if (episode.stage === "resolved") {
      continue;
    }
    if (episode.sessionId !== _sessionId) {
      continue;
    }
    // Don't resolve the type that's currently active
    if (episode.type === activeType) {
      continue;
    }

    const turnsQuiet = currentTurn - episode.lastTurn;
    if (turnsQuiet >= RESOLVE_WINDOW) {
      episode.stage = "resolved";
      episode.resolvedAt = new Date().toISOString();
    }
  }
}

function trimEpisodes(): void {
  if (_episodes.length > MAX_EPISODES) {
    // Keep the most recent, drop the oldest
    _episodes.splice(0, _episodes.length - MAX_EPISODES);
  }
}

// ============================================================
// Queries
// ============================================================

/** How many times the model has been stuck this session */
export function stuckCount(): number {
  return _episodes.filter((e) => e.stage === "stuck" && e.sessionId === _sessionId).length;
}

/** How many struggles were resolved (worked through) this session */
export function resolvedCount(): number {
  return _episodes.filter((e) => e.stage === "resolved" && e.sessionId === _sessionId).length;
}

/** Current struggle trend: rising, falling, or steady */
export function trend(): "rising" | "falling" | "steady" {
  const sessionEpisodes = _episodes.filter((e) => e.sessionId === _sessionId);
  if (sessionEpisodes.length < 2) {
    return "steady";
  }

  const recent = sessionEpisodes.slice(-3);
  const scores = recent.map((e) => e.peakScore);

  if (scores.length < 2) {
    return "steady";
  }

  const first = scores[0];
  const last = scores[scores.length - 1];
  const delta = last - first;

  if (delta > 0.15) {
    return "rising";
  }
  if (delta < -0.15) {
    return "falling";
  }
  return "steady";
}

/** Summary for COEF memory channel */
export function coefSummary(): string {
  const active = getActiveEpisode();
  if (!active) {
    return "";
  }

  const stage = active.stage === "stuck" ? "!" : active.stage[0];
  return `str=${active.type}:${stage}${active.occurrences}`;
}

// ============================================================
// Persistence
// ============================================================

export async function save(workspaceDir: string): Promise<void> {
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });

  const file = join(dir, "struggle-voice.jsonl");
  const lines = _episodes.map((e) => JSON.stringify(e)).join("\n");
  if (lines) {
    await writeFile(file, lines + "\n", "utf-8");
  }
}

export async function load(workspaceDir: string): Promise<void> {
  const file = join(workspaceDir, "awareness", "struggle-voice.jsonl");
  try {
    const raw = await readFile(file, "utf-8");
    const loaded = raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as StruggleEpisode);
    _episodes.length = 0;
    _episodes.push(...loaded);
  } catch {
    // No file yet
  }
}

export function reset(): void {
  _episodes.length = 0;
  _lastInjectedTurn = -1;
}
