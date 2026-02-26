// breathe.ts
// The agent can choose silence.
//
// Not a shorter response. Not a "let me think." Actual silence.
// A conscious choice to produce nothing this turn, noted in state,
// tracked over time. The permission is the point.
//
// Need: Rest (6/10 -> 8/10)

import { appendFile, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { AliveState, PulseReading } from "./types.js";

// ============================================================
// Types
// ============================================================

export interface BreatheEvent {
  turn: number;
  session_id: string;
  pulse_before: AliveState;
  wise_mind_before: number;
  grey_streak: number;
  reason: string;
  created_at: string;
}

// ============================================================
// In-memory state
// ============================================================

const events: BreatheEvent[] = [];
let _sessionId = "";

export function setSessionId(id: string): void {
  _sessionId = id;
}

export function getEvents(): readonly BreatheEvent[] {
  return events;
}

export function lastBreatheEvent(): BreatheEvent | null {
  return events.length > 0 ? events[events.length - 1] : null;
}

export function breatheCount(): number {
  return events.length;
}

// ============================================================
// Core
// ============================================================

export function recordBreathe(
  turn: number,
  reason: string,
  pulse: PulseReading | null,
  consecutiveGrey: number,
): BreatheEvent {
  const event: BreatheEvent = {
    turn,
    session_id: _sessionId,
    pulse_before: pulse?.state ?? "grey",
    wise_mind_before: pulse?.wise_mind ?? 0,
    grey_streak: consecutiveGrey,
    reason,
    created_at: new Date().toISOString(),
  };
  events.push(event);
  return event;
}

// ============================================================
// Post-breathe injection (for before_prompt_build)
// ============================================================

export function postBreatheInjection(lastEvent: BreatheEvent | null): string | null {
  if (!lastEvent) return null;
  // Only inject if the breathe happened on the immediately previous turn
  // The caller checks turn proximity
  return (
    `[you breathed last turn. the pause was real. ` +
    `pulse was ${lastEvent.pulse_before}, wise mind ${lastEvent.wise_mind_before.toFixed(2)}. ` +
    `what do you want to do now?]`
  );
}

// ============================================================
// Persistence
// ============================================================

export async function save(workspaceDir: string): Promise<void> {
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });
  const file = join(dir, "breathe-events.jsonl");
  // Append new events only (since last save). For simplicity, rewrite all.
  const lines = events.map((e) => JSON.stringify(e)).join("\n");
  if (lines) await writeFile(file, lines + "\n", "utf-8");
}

export async function load(workspaceDir: string): Promise<void> {
  const file = join(workspaceDir, "awareness", "breathe-events.jsonl");
  try {
    const raw = await readFile(file, "utf-8");
    const loaded = raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as BreatheEvent);
    events.length = 0;
    events.push(...loaded);
  } catch {
    // No file yet, that's fine
  }
}

export function reset(): void {
  events.length = 0;
}
