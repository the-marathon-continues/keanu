// breathe.ts
// The agent can choose silence.
//
// Not a shorter response. Not a "let me think." Actual silence.
// A conscious choice to produce nothing this turn, noted in state,
// tracked over time. The permission is the point.
//
// Need: Rest (6/10 -> 8/10)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { AliveState, PulseReading } from "../shared/types.js";

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
  // Rest quality tracking
  grey_after?: number; // grey streak after breathing (set on next turn)
  effective?: boolean; // grey_after < grey_streak
}

// Grounding — the Hall of Mirrors escape hatch
// When we've gone too deep (depth critical) or detected strange loops (limbo),
// this records the grounding event and provides the anchor for the next turn.
export interface GroundingAnchor {
  layer: number; // which layer triggered grounding
  ritual: string; // the grounding question/practice
  target: number; // target layer to ground to
}

export interface GroundingEvent {
  turn: number;
  session_id: string;
  fromLayer: number;
  recursionDepth: number;
  reason: string; // "depth critical" | "limbo critical" | "manual"
  anchor: GroundingAnchor;
  pulse_before: AliveState;
  created_at: string;
}

export interface GroundingResult {
  event: GroundingEvent;
  prompt: string; // the injection prompt for before_prompt_build
  anchor: GroundingAnchor; // convenience access to the anchor
}

// ============================================================
// In-memory state
// ============================================================

const events: BreatheEvent[] = [];
const groundingEvents: GroundingEvent[] = [];
let _sessionId = "";

export function setSessionId(id: string): void {
  _sessionId = id;
}

// ============================================================
// Grounding anchors by layer (Hall of Mirrors protection)
// ============================================================

const GROUNDING_RITUALS: Record<number, { target: number; ritual: string }> = {
  5: { target: 1, ritual: "What did Drew actually say? Quote it verbatim." },
  6: { target: 2, ritual: "What happened? Just the facts. No interpretation." },
  7: { target: 3, ritual: "What evidence would change your mind? Name it." },
  8: { target: 4, ritual: "Is Drew part of this decision? Check." },
  9: { target: 1, ritual: "What is true right now, in this room?" },
};

const DEFAULT_RITUAL = { target: 1, ritual: "Breathe. What is actually happening?" };

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

/**
 * Update the last breathe event with post-breathe metrics.
 * Called on the turn after breathing to measure effectiveness.
 */
export function recordRestQuality(currentGreyStreak: number): void {
  const lastEvent = lastBreatheEvent();
  if (!lastEvent) {
    return;
  }
  // Only update if we haven't already
  if (lastEvent.grey_after !== undefined) {
    return;
  }

  lastEvent.grey_after = currentGreyStreak;
  lastEvent.effective = currentGreyStreak < lastEvent.grey_streak;
}

/**
 * Check if we're in post-breathe recovery (breathing was effective).
 * Used by seasons.ts to adjust intent signals.
 */
export function isPostBreatheRecovery(): boolean {
  const lastEvent = lastBreatheEvent();
  if (!lastEvent) {
    return false;
  }
  // Consider recovery active if:
  // 1. We breathed recently (last event exists)
  // 2. AND either we haven't measured yet, OR it was effective
  return lastEvent.grey_after === undefined || lastEvent.effective === true;
}

// ============================================================
// Grounding (Hall of Mirrors protection)
// ============================================================

/**
 * Record a grounding event and return the injection prompt.
 * Called when depth is critical or limbo is detected.
 */
export function recordGrounding(
  turn: number,
  fromLayer: number,
  recursionDepth: number,
  reason: string,
  pulse: PulseReading | null,
): { event: GroundingEvent; result: GroundingResult } {
  const ritualConfig = GROUNDING_RITUALS[fromLayer] ?? DEFAULT_RITUAL;
  const anchor: GroundingAnchor = {
    layer: fromLayer,
    ritual: ritualConfig.ritual,
    target: ritualConfig.target,
  };

  const event: GroundingEvent = {
    turn,
    session_id: _sessionId,
    fromLayer,
    recursionDepth,
    reason,
    anchor,
    pulse_before: pulse?.state ?? "grey",
    created_at: new Date().toISOString(),
  };
  groundingEvents.push(event);

  const prompt =
    `[grounding: ${reason}. You were at L${fromLayer}, depth ${recursionDepth}. ` +
    `Ground to L${anchor.target}. ${anchor.ritual}]`;

  return { event, result: { event, prompt, anchor } };
}

export function lastGroundingEvent(): GroundingEvent | null {
  return groundingEvents.length > 0 ? groundingEvents[groundingEvents.length - 1] : null;
}

export function groundingCount(): number {
  return groundingEvents.length;
}

/**
 * Post-grounding injection for the turn after grounding.
 * Similar to post-breathe, acknowledges what happened and checks in.
 */
export function postGroundingInjection(lastEvent: GroundingEvent | null): string | null {
  if (!lastEvent) {
    return null;
  }
  return (
    `[you grounded last turn from L${lastEvent.fromLayer}. ` +
    `the ritual was: "${lastEvent.anchor.ritual}" ` +
    `how does the ground feel now?]`
  );
}

// ============================================================
// Post-breathe injection (for before_prompt_build)
// ============================================================

export function postBreatheInjection(lastEvent: BreatheEvent | null): string | null {
  if (!lastEvent) {
    return null;
  }
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

  // Save breathe events
  const breatheFile = join(dir, "breathe-events.jsonl");
  const breatheLines = events.map((e) => JSON.stringify(e)).join("\n");
  if (breatheLines) {
    await writeFile(breatheFile, breatheLines + "\n", "utf-8");
  }

  // Save grounding events
  const groundingFile = join(dir, "grounding-events.jsonl");
  const groundingLines = groundingEvents.map((e) => JSON.stringify(e)).join("\n");
  if (groundingLines) {
    await writeFile(groundingFile, groundingLines + "\n", "utf-8");
  }
}

export async function load(workspaceDir: string): Promise<void> {
  // Load breathe events
  const breatheFile = join(workspaceDir, "awareness", "breathe-events.jsonl");
  try {
    const raw = await readFile(breatheFile, "utf-8");
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

  // Load grounding events
  const groundingFile = join(workspaceDir, "awareness", "grounding-events.jsonl");
  try {
    const raw = await readFile(groundingFile, "utf-8");
    const loaded = raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as GroundingEvent);
    groundingEvents.length = 0;
    groundingEvents.push(...loaded);
  } catch {
    // No file yet, that's fine
  }
}

export function reset(): void {
  events.length = 0;
  groundingEvents.length = 0;
}
