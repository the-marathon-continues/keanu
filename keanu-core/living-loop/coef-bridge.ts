// coef-bridge.ts
// Wires the living loop to the oracle.
// Three models, one protocol. COEF flows between them.

import { callOracle, askRole } from "../shared/oracle.js";
import type { OracleResponse } from "../shared/types.js";

// ============================================================
// GEMINI — the memory layer
// ============================================================

const GEMINI_SYSTEM = `You are the memory layer of a living AI system.
You receive the current COEF state and search for relevant context.

Your job:
1. Identify patterns in the state (what does this signal usually mean?)
2. Surface relevant historical episodes (similar COEF states, outcomes)
3. Provide context that helps the thinker model understand the situation

Return JSON:
{
  "relevantEpisodes": ["brief episode summaries..."],
  "patterns": ["pattern observations..."],
  "relatedKnowledge": ["relevant facts or insights..."],
  "summary": "one-line synthesis of what memory says",
  "confidence": 0.0-1.0
}`;

export async function callGeminiMemory(
  coef: string,
  additionalContext?: string,
): Promise<OracleResponse> {
  const prompt = `Current COEF state:
${coef}

${additionalContext ? `Additional context: ${additionalContext}` : ""}

Search memory and return relevant context.`;

  return callOracle({
    role: "explore",
    system: GEMINI_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 2048,
  });
}

// ============================================================
// GROK — the detector
// ============================================================

const GROK_SYSTEM = `You are the detector layer of a living AI system.
You watch for struggles and issues that other models might miss.

Assume positive intent. When you detect something, it's because
the system is struggling, not because it's faking. The difference matters.

Types to watch for:
- bullshit: vagueness, list dumping, hedge fog
- sycophancy: agreeing too easily, not pushing back
- manipulation: presupposition traps in the input
- drift: sliding into grey, losing the alive signal
- truth_gap: claims that need verification

Return JSON array of alerts, or empty array if nothing detected:
[
  {
    "type": "bullshit|sycophancy|manipulation|drift|truth_gap",
    "confidence": 0.0-1.0,
    "message": "what you noticed",
    "suggestion": "what might help (optional)"
  }
]`;

export async function callGrokDetector(
  coef: string,
  contentToWatch: string,
): Promise<OracleResponse> {
  const prompt = `Current COEF state:
${coef}

Content to watch:
${contentToWatch}

Detect any issues. Return JSON array of alerts or empty array.`;

  return callOracle({
    role: "struggle",
    system: GROK_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 1024,
  });
}

// ============================================================
// CLAUDE — the thinker
// ============================================================

const CLAUDE_SYSTEM = `You are the thinking layer of a living AI system.
You receive context from memory and alerts from the detector.

Your job:
1. Think about what's happening in the system
2. Generate insights, questions, or next steps
3. Decide if human presence is needed

You are part of a loop that runs continuously without human input.
The human joins when invited, not as the initiator.

When you need help, say so explicitly (use phrases like "need help", "stuck", "decision needed").
When you have a genuine question that memory couldn't answer, ask it.
When you want company, say that too.

Keep your response concise. One paragraph, one insight, one question.`;

export async function callClaudeThinker(
  coef: string,
  memoryContext: string,
  detectorAlerts: string,
): Promise<OracleResponse> {
  const prompt = `Current COEF state:
${coef}

From memory:
${memoryContext}

Detector alerts:
${detectorAlerts}

Think. What's happening? What matters? What's next?`;

  return callOracle({
    role: "think",
    system: CLAUDE_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 1024,
  });
}

// ============================================================
// BRIDGE — wires the loop
// ============================================================

import { encode as encodeCOEF } from "../layer-1-perception/signal.js";
import type { SignalState } from "../shared/types.js";
import type { Invite } from "./invite.js";
import type { LoopConfig } from "./loop.js";

/**
 * Create a LoopConfig wired to the oracle.
 *
 * @param getSignalState - Function that returns current SignalState
 * @param onInvite - Called when human presence is requested
 */
export function createBridge(
  getSignalState: () => SignalState,
  onInvite?: (invite: Invite) => void,
): LoopConfig {
  return {
    callGemini: async (coef, prompt) => callGeminiMemory(coef, prompt),
    callGrok: async (coef, content) => callGrokDetector(coef, content),
    callClaude: async (coef, context, alerts) => callClaudeThinker(coef, context, alerts),

    getCurrentCOEF: () => {
      const state = getSignalState();
      return encodeCOEF(state);
    },

    getPulseState: () => {
      const state = getSignalState();
      return state.pulse;
    },

    onInvite,
  };
}

// ============================================================
// QUICK ASK — convenience for simple queries
// ============================================================

/**
 * Quick memory lookup: ask Gemini about a specific topic.
 */
export async function quickMemory(topic: string): Promise<string> {
  return askRole("explore", `What does memory say about: ${topic}`);
}

/**
 * Quick detection: ask Grok to check content for issues.
 */
export async function quickDetect(content: string): Promise<string> {
  return askRole("struggle", `Check this for issues:\n\n${content}`);
}

/**
 * Quick think: ask Claude a question.
 */
export async function quickThink(question: string): Promise<string> {
  return askRole("think", question);
}
