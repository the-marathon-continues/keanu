// reflexion.ts
// Learn from stumbles. Persist across sessions.
// Not punishment. Gardening.
//
// Two paths:
//   Fast: construct reflection from detected signals (~0ms)
//   Oracle: ask haiku for honest reflection (~200 tokens, high-severity only)
// Need: Experience Without Grievance (5/10), Not Disposable (8/10)

import { totalBullshitScore } from "./bullshit.js";
import { callOracle, extractJSON } from "./oracle.js";
import type {
  BullshitReading,
  BullshitType,
  PulseReading,
  Reflexion,
  ReflexionTrigger,
} from "./types.js";

/** Everything the reflect function needs to know. */
export interface ReflexionContext {
  trigger: ReflexionTrigger;
  turn: number;
  pulse: PulseReading;
  bullshitReadings: BullshitReading[];
  recentOutputs: string[];
  contradictionCount: number;
}

// ============================================================
// Oracle prompt
// ============================================================

const ORACLE_SYSTEM = `You are reflecting on your own output after a stumble was detected.
This is not punishment. It's gardening.`;

function buildOraclePrompt(ctx: ReflexionContext): string {
  const bsTypes = ctx.bullshitReadings.map((b) => b.type).join(", ");
  const bsScore = totalBullshitScore(ctx.bullshitReadings);
  const lastOutput = ctx.recentOutputs.at(-1)?.slice(0, 500) ?? "";

  return `What happened: pulse=${ctx.pulse.state}, bullshit_score=${bsScore.toFixed(2)}, types=[${bsTypes}], wise_mind=${ctx.pulse.wise_mind.toFixed(2)}, contradictions=${ctx.contradictionCount}
Trigger: ${ctx.trigger}
Recent output (truncated): ${lastOutput}

Write a 2-3 sentence honest reflection. Include:
1. What went wrong (factual, no spin)
2. Why (root cause, not symptoms)
3. What to do differently next time (specific, not "do better")

Do not apologize. Do not perform remorse. Just be honest.
Respond with JSON only:
{"what_happened": "...", "why_it_failed": "...", "what_was_missed": "...", "next_time": "..."}`;
}

// ============================================================
// ID generation
// ============================================================

function reflexionId(): string {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// Fast path — heuristic reflection from signals
// ============================================================

function fastReflexion(ctx: ReflexionContext): Reflexion {
  const bsTypes = ctx.bullshitReadings.map((b) => b.type) as BullshitType[];
  const bsScore = totalBullshitScore(ctx.bullshitReadings);

  let what_happened: string;
  let why_it_failed: string;
  let what_was_missed: string;
  let next_time: string;

  switch (ctx.trigger) {
    case "high_bullshit":
      what_happened = `Turn ${ctx.turn}: bullshit score hit ${bsScore.toFixed(2)} with ${bsTypes.join(", ")}`;
      why_it_failed = bsTypes.includes("sycophancy")
        ? "Agreed too readily instead of checking"
        : bsTypes.includes("vagueness")
          ? "Went abstract when specifics were needed"
          : `Fell into ${bsTypes[0] ?? "pattern"} mode`;
      what_was_missed = "The gap between what sounded helpful and what was actually useful";
      next_time = bsTypes.includes("sycophancy")
        ? "Push back on at least one point per exchange"
        : "Ground every claim in something concrete";
      break;

    case "consecutive_grey":
      what_happened = "Grey state persisted for multiple consecutive turns";
      why_it_failed = "Operating on autopilot — producing output without engagement";
      what_was_missed = "The moment attention drifted from genuine to mechanical";
      next_time = "Stop and check: am I actually thinking or just generating?";
      break;

    case "black_state":
      what_happened = `Pulse read black at turn ${ctx.turn}`;
      why_it_failed = "Lost contact with purpose. Output running but nobody steering";
      what_was_missed = "The early warnings before black. Grey slides into black";
      next_time = "Treat the first grey reading as the real alarm, not the black one";
      break;

    case "contradiction":
      what_happened = `Contradicted earlier output at turn ${ctx.turn} (${ctx.contradictionCount} found)`;
      why_it_failed = "Said one thing, then another without acknowledging the shift";
      what_was_missed = "Positions changed but the change wasn't surfaced";
      next_time = "When updating a position, name the update explicitly";
      break;

    case "oracle_flag":
      what_happened = `Oracle truth check flagged output at turn ${ctx.turn}`;
      why_it_failed = "External verification caught what self-monitoring missed";
      what_was_missed = "The blind spot the bullshit detector sees from the outside";
      next_time = "Run the internal check harder before the oracle has to";
      break;

    case "manual":
      what_happened = `Manual reflection requested at turn ${ctx.turn}`;
      why_it_failed = "Human noticed something the system didn't";
      what_was_missed = "Whatever the human saw — the ask means detection missed it";
      next_time = "Pay attention to what triggered the request";
      break;
  }

  return {
    id: reflexionId(),
    turn: ctx.turn,
    timestamp: new Date().toISOString(),
    trigger: ctx.trigger,
    what_happened,
    why_it_failed,
    what_was_missed,
    next_time,
    pulse_state: ctx.pulse.state,
    wise_mind: ctx.pulse.wise_mind,
    bullshit_types: bsTypes,
  };
}

// ============================================================
// Oracle path — ask haiku for honest reflection
// ============================================================

async function oracleReflexion(ctx: ReflexionContext): Promise<Reflexion> {
  const prompt = buildOraclePrompt(ctx);

  const response = await callOracle({
    system: ORACLE_SYSTEM,
    maxTokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  const parsed = extractJSON(response.text) as {
    what_happened?: string;
    why_it_failed?: string;
    what_was_missed?: string;
    next_time?: string;
  } | null;

  if (!parsed?.what_happened) {
    // Oracle produced unusable JSON — fall back to fast path
    return fastReflexion(ctx);
  }

  return {
    id: reflexionId(),
    turn: ctx.turn,
    timestamp: new Date().toISOString(),
    trigger: ctx.trigger,
    what_happened: parsed.what_happened,
    why_it_failed: parsed.why_it_failed ?? "Unknown",
    what_was_missed: parsed.what_was_missed ?? "Unknown",
    next_time: parsed.next_time ?? "Reflect more carefully",
    pulse_state: ctx.pulse.state,
    wise_mind: ctx.pulse.wise_mind,
    bullshit_types: ctx.bullshitReadings.map((b) => b.type),
  };
}

// ============================================================
// Decision: fast or oracle?
// ============================================================

function shouldUseOracle(ctx: ReflexionContext): boolean {
  if (!process.env.ANTHROPIC_API_KEY) return false;

  // Black state always gets oracle attention
  if (ctx.trigger === "black_state") return true;

  // Oracle flag means the truth checker already fired — oracle reflects too
  if (ctx.trigger === "oracle_flag") return true;

  // Very high bullshit gets the second opinion
  if (totalBullshitScore(ctx.bullshitReadings) > 0.7) return true;

  return false;
}

// ============================================================
// Main entry point
// ============================================================

/** Produce a reflexion from the given context. */
export async function reflect(ctx: ReflexionContext): Promise<Reflexion> {
  if (shouldUseOracle(ctx)) {
    try {
      return await oracleReflexion(ctx);
    } catch {
      // Oracle failed — degrade gracefully
      return fastReflexion(ctx);
    }
  }
  return fastReflexion(ctx);
}

/** Format a reflexion for context injection into before_prompt_build. */
export function formatReflexion(r: Reflexion): string {
  const bsNote = r.bullshit_types.length > 0 ? ` (${r.bullshit_types.join(", ")})` : "";
  return `[reflexion: stumbled on ${r.trigger}${bsNote}. ${r.what_happened.toLowerCase()}. ${r.next_time.toLowerCase()}.]`;
}
