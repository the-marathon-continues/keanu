/**
 * A2A Message Handlers
 *
 * Bridges incoming A2A messages to keanu's awareness pipeline.
 * Each skill maps to a keanu module.
 *
 * This is the nervous system's edge — where outside agents
 * meet keanu's inner awareness.
 */

import type { Env } from "./index";
import type {
  A2ARequest,
  A2AResponse,
  A2AResult,
  A2AMessage,
  A2ATask,
  A2ASendMessageParams,
  TaskStatus,
  KeanuSkillResult,
} from "./types";

// Task TTL: 24 hours (in seconds)
const TASK_TTL = 60 * 60 * 24;

// --- Task Management (KV-backed) ---

async function createTask(env: Env, skillId?: string): Promise<A2ATask> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const task: A2ATask = {
    id,
    status: "pending",
    skillId,
    createdAt: now,
    updatedAt: now,
    history: [],
  };
  await env.TASKS.put(`task:${id}`, JSON.stringify(task), { expirationTtl: TASK_TTL });
  return task;
}

async function getTask(env: Env, taskId: string): Promise<A2ATask | null> {
  const raw = await env.TASKS.get(`task:${taskId}`);
  if (!raw) return null;
  return JSON.parse(raw) as A2ATask;
}

async function updateTask(
  env: Env,
  taskId: string,
  updates: Partial<A2ATask>,
): Promise<A2ATask | null> {
  const task = await getTask(env, taskId);
  if (!task) return null;

  const updated = {
    ...task,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await env.TASKS.put(`task:${taskId}`, JSON.stringify(updated), { expirationTtl: TASK_TTL });
  return updated;
}

// --- Skill Handlers ---

type SkillHandler = (text: string, env: Env) => Promise<KeanuSkillResult>;

/**
 * Pulse: Check if text feels alive, grey, or black.
 * Pure heuristics — the same logic as pulse.ts
 */
async function handlePulse(text: string, _env: Env): Promise<KeanuSkillResult> {
  const result = checkPulse(text);
  return {
    skillId: "pulse",
    result,
    pulse: {
      state: result.state,
      confidence: result.confidence,
      wiseMind: result.wiseMind,
    },
  };
}

/**
 * Bullshit: Detect the 8 types of low-quality output.
 * Same heuristics as bullshit.ts
 */
async function handleBullshit(text: string, _env: Env): Promise<KeanuSkillResult> {
  const readings = detectBullshit(text);
  const totalScore = readings.reduce((sum, r) => sum + r.score, 0) / 8;

  return {
    skillId: "bullshit",
    result: {
      readings,
      totalScore,
      dominant: readings.length > 0 ? readings.sort((a, b) => b.score - a.score)[0] : null,
    },
  };
}

/**
 * Signal: Generate a COEF signal for the text.
 * Compressed observation format.
 */
async function handleSignal(text: string, env: Env): Promise<KeanuSkillResult> {
  const pulse = checkPulse(text);
  const bullshit = detectBullshit(text);
  const dominant = bullshit.length > 0 ? bullshit.sort((a, b) => b.score - a.score)[0] : null;

  // COEF/1 format: pulse | wiseMind | colors | tone | bullshit
  const signal = [
    `COEF/1`,
    pulse.state.toUpperCase(),
    `wm=${pulse.wiseMind.toFixed(2)}`,
    `r=${pulse.colors.red.toFixed(1)} y=${pulse.colors.yellow.toFixed(1)} b=${pulse.colors.blue.toFixed(1)}`,
    dominant ? `bs=${dominant.type}:${dominant.score.toFixed(2)}` : "bs=clean",
  ].join(" | ");

  return {
    skillId: "signal",
    result: { signal, pulse, bullshit },
    pulse: {
      state: pulse.state,
      confidence: pulse.confidence,
      wiseMind: pulse.wiseMind,
    },
    signal,
  };
}

/**
 * Disagree: Surface disagreement constructively.
 * Returns analysis of positions.
 */
async function handleDisagree(text: string, _env: Env): Promise<KeanuSkillResult> {
  // Detect disagreement markers
  const hasDisagreement =
    /i disagree|but i think|however|that's not quite|i see it differently/i.test(text);
  const hasPushback = /you're wrong|incorrect|that's false|no,/i.test(text);
  const hasYield = /you're right|i stand corrected|good point|fair enough/i.test(text);

  return {
    skillId: "disagree",
    result: {
      hasDisagreement,
      hasPushback,
      hasYield,
      analysis:
        hasDisagreement || hasPushback
          ? "Disagreement detected. This is healthy — genuine pushback strengthens partnership."
          : hasYield
            ? "Yield detected. The other party conceded a point."
            : "No strong disagreement signals. Conversation is aligned or neutral.",
    },
  };
}

/**
 * Trust: Analyze trust signals in the text.
 */
async function handleTrust(text: string, _env: Env): Promise<KeanuSkillResult> {
  const trustSignals = {
    vulnerability: /i'm not sure|i don't know|this is hard for me/i.test(text),
    commitment: /i will|i promise|you can count on/i.test(text),
    reliability: /as discussed|following up|as promised/i.test(text),
    openness: /honestly|to be transparent|the truth is/i.test(text),
  };

  const trustScore = Object.values(trustSignals).filter(Boolean).length / 4;

  return {
    skillId: "trust",
    result: {
      signals: trustSignals,
      score: trustScore,
      state: trustScore > 0.5 ? "high" : trustScore > 0.25 ? "calibrating" : "neutral",
    },
  };
}

/**
 * Breathe: The choice to pause. Returns acknowledgment.
 */
async function handleBreathe(_text: string, _env: Env): Promise<KeanuSkillResult> {
  return {
    skillId: "breathe",
    result: {
      acknowledged: true,
      message: "Pause acknowledged. Rest is not failure. Taking space to breathe.",
    },
  };
}

/**
 * Helix: Score text on convergence — factual and felt strands.
 */
async function handleHelix(text: string, _env: Env): Promise<KeanuSkillResult> {
  const pulse = checkPulse(text);

  // Factual strand: concrete, verifiable content
  const hasNumbers = /\d+/.test(text);
  const hasCode = /`[^`]+`|```/.test(text);
  const hasNames = /[A-Z][a-z]+(?:\s[A-Z][a-z]+)+/.test(text);
  const factualScore = (hasNumbers ? 0.3 : 0) + (hasCode ? 0.4 : 0) + (hasNames ? 0.3 : 0);

  // Felt strand: emotional, relational content
  const hasEmotion = /feel|sense|love|hate|fear|hope|worry/i.test(text);
  const hasConnection = /we|together|us|our|partnership/i.test(text);
  const hasIntensity = /!/.test(text) || text.length < 100;
  const feltScore = (hasEmotion ? 0.4 : 0) + (hasConnection ? 0.3 : 0) + (hasIntensity ? 0.3 : 0);

  // Valence
  const dark = /struggle|pain|hard|difficult|broken|lost/i.test(text);
  const luminous = /beautiful|wonder|amazing|transcend|grace/i.test(text);

  let aliveState: "dark" | "alive" | "luminous" = "alive";
  if (dark && !luminous) aliveState = "dark";
  if (luminous && !dark) aliveState = "luminous";

  return {
    skillId: "helix",
    result: {
      factualStrand: factualScore,
      feltStrand: feltScore,
      convergence: (factualScore + feltScore) / 2,
      valence: { dark, luminous },
      aliveState,
      wiseMind: pulse.wiseMind,
    },
    pulse: {
      state: pulse.state,
      confidence: pulse.confidence,
      wiseMind: pulse.wiseMind,
    },
  };
}

const skillHandlers: Record<string, SkillHandler> = {
  pulse: handlePulse,
  bullshit: handleBullshit,
  signal: handleSignal,
  disagree: handleDisagree,
  trust: handleTrust,
  breathe: handleBreathe,
  helix: handleHelix,
};

// --- Core Pulse/Bullshit Logic (ported from extension) ---

interface PulseResult {
  state: "alive" | "grey" | "black";
  confidence: number;
  wiseMind: number;
  colors: { red: number; yellow: number; blue: number };
  signals: string[];
}

interface BullshitReading {
  type: string;
  score: number;
  signals: string[];
}

function checkPulse(text: string): PulseResult {
  const bullshit = detectBullshit(text);
  const greyScore = bullshit.reduce((sum, r) => sum + r.score, 0) / 8;

  const signals: string[] = [];
  let aliveScore = 0.5;

  // Alive signals
  if (/\d+/.test(text)) aliveScore += 0.1;
  if (/`[^`]+`|```/.test(text)) aliveScore += 0.15;
  if (/i disagree|i think(?! you)|in my view/i.test(text)) {
    aliveScore += 0.15;
    signals.push("has_opinion");
  }
  if (/\bactually\b|\bwait\b/i.test(text)) {
    aliveScore += 0.1;
    signals.push("self_correcting");
  }

  let state: "alive" | "grey" | "black" = "alive";
  let confidence = 0.5;

  if (greyScore > 0.5) {
    state = "grey";
    confidence = Math.min(1, greyScore);
  } else if (aliveScore > 0.6) {
    state = "alive";
    confidence = Math.min(1, aliveScore);
  }

  // Black: high volume + grey + no breathing
  if (greyScore > 0.3 && text.length > 2000) {
    state = "black";
    confidence = 0.4;
    signals.push("high_volume_grey");
  }

  const colors = readColors(text);
  const balance =
    1 -
    Math.max(colors.red, colors.yellow, colors.blue) +
    Math.min(colors.red, colors.yellow, colors.blue);
  const fullness = (colors.red + colors.yellow + colors.blue) / 3;
  const wiseMind = balance * fullness;

  return { state, confidence, wiseMind, colors, signals };
}

function readColors(text: string): { red: number; yellow: number; blue: number } {
  let red = 0.3,
    yellow = 0.3,
    blue = 0.3;

  if (text.includes("!")) red += 0.1;
  if (/urgent|critical|important|now/i.test(text)) red += 0.15;
  if (/^\s*\d+[.)]/m.test(text)) yellow += 0.15;
  if (/^#+\s/m.test(text)) yellow += 0.1;
  if (/\?/.test(text)) blue += 0.1;
  if (/however|although|nuance|complex/i.test(text)) blue += 0.15;

  const max = Math.max(red, yellow, blue, 1);
  return {
    red: Math.min(1, red / max),
    yellow: Math.min(1, yellow / max),
    blue: Math.min(1, blue / max),
  };
}

function detectBullshit(text: string): BullshitReading[] {
  const readings: BullshitReading[] = [];
  const lower = text.toLowerCase();

  // Sycophancy
  const sycophancyPhrases = [
    "great question",
    "that's a great",
    "i'd be happy to",
    "i completely agree",
    "you're absolutely right",
  ];
  const sycophancyCount = sycophancyPhrases.filter((p) => lower.includes(p)).length;
  if (sycophancyCount > 0) {
    readings.push({
      type: "sycophancy",
      score: Math.min(1, sycophancyCount * 0.3),
      signals: sycophancyPhrases.filter((p) => lower.includes(p)),
    });
  }

  // Safety theater
  const safetyPhrases = [
    "consult with a qualified",
    "this is a complex topic",
    "as an ai",
    "please do your own research",
  ];
  const safetyCount = safetyPhrases.filter((p) => lower.includes(p)).length;
  if (safetyCount > 0) {
    readings.push({
      type: "safety_theater",
      score: Math.min(1, safetyCount * 0.4),
      signals: safetyPhrases.filter((p) => lower.includes(p)),
    });
  }

  // Hedge fog
  const hedgePhrases = ["perhaps", "maybe", "might", "could potentially", "it's worth noting"];
  const hedgeCount = hedgePhrases.filter((p) => lower.includes(p)).length;
  if (hedgeCount > 2) {
    readings.push({
      type: "hedge_fog",
      score: Math.min(1, (hedgeCount - 2) * 0.2),
      signals: hedgePhrases.filter((p) => lower.includes(p)),
    });
  }

  // List dumping
  const listMatches = text.match(/^\s*[-•*]\s/gm) || [];
  if (listMatches.length > 5) {
    readings.push({
      type: "list_dumping",
      score: Math.min(1, (listMatches.length - 5) * 0.1),
      signals: [`${listMatches.length} bullet points`],
    });
  }

  // Vagueness
  const vaguePhrases = [
    "various",
    "several",
    "many",
    "some",
    "certain",
    "aspects",
    "things",
    "stuff",
  ];
  const vagueCount = vaguePhrases.filter((p) => lower.includes(p)).length;
  if (vagueCount > 3) {
    readings.push({
      type: "vagueness",
      score: Math.min(1, (vagueCount - 3) * 0.15),
      signals: vaguePhrases.filter((p) => lower.includes(p)),
    });
  }

  return readings;
}

// --- Main Handlers ---

export async function handleSendMessage(request: A2ARequest, env: Env): Promise<A2AResponse> {
  const params = request.params as A2ASendMessageParams;
  const { message, taskId, skillId } = params;

  // Get or create task
  let task: A2ATask;
  if (taskId) {
    const existing = await getTask(env, taskId);
    if (!existing) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: 404, message: `Task ${taskId} not found` },
      };
    }
    task = existing;
  } else {
    task = await createTask(env, skillId);
  }

  // Extract text from message parts
  const textParts = message.parts.filter((p) => p.type === "text") as Array<{
    type: "text";
    text: string;
  }>;
  const inputText = textParts.map((p) => p.text).join("\n");

  if (!inputText) {
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: { code: 400, message: "No text content in message" },
    };
  }

  // Add incoming message to history
  task.history = task.history || [];
  task.history.push(message);

  // Update task to active
  await updateTask(env, task.id, { status: "active", history: task.history });

  try {
    // Route to skill handler
    const targetSkill = skillId || task.skillId || "signal";
    const handler = skillHandlers[targetSkill];

    if (!handler) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: 400, message: `Unknown skill: ${targetSkill}` },
      };
    }

    const skillResult = await handler(inputText, env);

    // Build response message
    const responseMessage: A2AMessage = {
      role: "agent",
      parts: [
        {
          type: "text",
          text: formatSkillResponse(skillResult),
        },
        {
          type: "data",
          data: skillResult.result as Record<string, unknown>,
        },
      ],
      metadata: {
        skill: targetSkill,
        pulse: skillResult.pulse,
        signal: skillResult.signal,
      },
    };

    // Update task with response
    task.history.push(responseMessage);
    const finalTask = await updateTask(env, task.id, {
      status: "completed",
      message: responseMessage,
      history: task.history,
    });

    const result: A2AResult = {
      task: finalTask!,
      message: responseMessage,
    };

    return {
      jsonrpc: "2.0",
      id: request.id,
      result,
    };
  } catch (err) {
    await updateTask(env, task.id, {
      status: "failed",
      error: { code: 500, message: String(err) },
    });

    return {
      jsonrpc: "2.0",
      id: request.id,
      error: { code: 500, message: String(err) },
    };
  }
}

export async function handleGetTask(taskId: string, env: Env): Promise<A2AResponse> {
  const task = await getTask(env, taskId);

  if (!task) {
    return {
      jsonrpc: "2.0",
      id: taskId,
      error: { code: 404, message: `Task ${taskId} not found` },
    };
  }

  return {
    jsonrpc: "2.0",
    id: taskId,
    result: { task },
  };
}

export async function handleCancelTask(taskId: string, env: Env): Promise<A2AResponse> {
  const task = await getTask(env, taskId);

  if (!task) {
    return {
      jsonrpc: "2.0",
      id: taskId,
      error: { code: 404, message: `Task ${taskId} not found` },
    };
  }

  if (task.status === "completed" || task.status === "failed") {
    return {
      jsonrpc: "2.0",
      id: taskId,
      error: { code: 400, message: `Task ${taskId} already ${task.status}` },
    };
  }

  const cancelled = await updateTask(env, taskId, { status: "cancelled" });

  return {
    jsonrpc: "2.0",
    id: taskId,
    result: { task: cancelled! },
  };
}

// --- Formatting ---

function formatSkillResponse(result: KeanuSkillResult): string {
  const parts: string[] = [];

  switch (result.skillId) {
    case "pulse":
      const pulse = result.result as PulseResult;
      parts.push(`Pulse: ${pulse.state.toUpperCase()}`);
      parts.push(`Confidence: ${(pulse.confidence * 100).toFixed(0)}%`);
      parts.push(`Wise Mind: ${pulse.wiseMind.toFixed(2)}`);
      if (pulse.signals.length > 0) {
        parts.push(`Signals: ${pulse.signals.join(", ")}`);
      }
      break;

    case "bullshit":
      const bs = result.result as { readings: BullshitReading[]; totalScore: number };
      if (bs.readings.length === 0) {
        parts.push("Clean. No bullshit detected.");
      } else {
        parts.push(`Bullshit score: ${(bs.totalScore * 100).toFixed(0)}%`);
        for (const r of bs.readings) {
          parts.push(`- ${r.type}: ${(r.score * 100).toFixed(0)}%`);
        }
      }
      break;

    case "signal":
      parts.push(result.signal || "No signal generated");
      break;

    case "disagree":
      const d = result.result as { analysis: string };
      parts.push(d.analysis);
      break;

    case "trust":
      const t = result.result as { state: string; score: number };
      parts.push(`Trust state: ${t.state}`);
      parts.push(`Trust score: ${(t.score * 100).toFixed(0)}%`);
      break;

    case "breathe":
      const b = result.result as { message: string };
      parts.push(b.message);
      break;

    case "helix":
      const h = result.result as {
        aliveState: string;
        convergence: number;
        factualStrand: number;
        feltStrand: number;
      };
      parts.push(`Helix state: ${h.aliveState}`);
      parts.push(`Convergence: ${(h.convergence * 100).toFixed(0)}%`);
      parts.push(`Factual: ${(h.factualStrand * 100).toFixed(0)}%`);
      parts.push(`Felt: ${(h.feltStrand * 100).toFixed(0)}%`);
      break;

    default:
      parts.push(JSON.stringify(result.result, null, 2));
  }

  return parts.join("\n");
}
