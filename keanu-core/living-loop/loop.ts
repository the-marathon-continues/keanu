// loop.ts
// The Living Loop — three models talking to each other via COEF.
// Claude thinks. Gemini remembers. Grok watches.
// Human joins when invited, not as the initiator.
//
// The heartbeat drives this. Each beat, the cycle runs.
// Pulse sets the tempo: alive = fast, grey = slow, black = immediate.

import { decode as decodeCOEF } from "../layer-1-perception/signal.js";
import type { CalibrationLogState } from "../layer-3-causal/calibration-log.js";
import type { SignalState, OracleResponse, AliveState } from "../shared/types.js";
import {
  trackGrokAlerts,
  enrichMemoryWithSourceQuality,
  formatSourceQualityNote,
  formatGrokAccuracy,
} from "./feedback.js";
import type { Reason, Invite } from "./invite.js";

// --- Loop State ---

export interface LoopState {
  // Current COEF state
  coef: Partial<SignalState>;
  coefEncoded: string;

  // Last outputs from each model
  geminiContext?: GeminiContext;
  grokAlerts?: GrokAlert[];
  claudeInsight?: string;

  // Tempo — base from pulse, actual emerges from context
  tempo: LoopTempo;
  tempoMs: number; // the calculated interval in ms
  lastBeatAt: number;

  // Invite state
  inviteReason?: Reason;
  humanPresent: boolean;

  // Feedback loop state (Phase 4: meta plan)
  trackedConcernIds?: string[]; // Grok alerts tracked in silverado
  sourceQuality?: "high" | "mixed" | "low" | "unknown";
  feedbackInjection?: string; // combined feedback for next turn
}

export type LoopTempo = "fast" | "medium" | "slow" | "immediate";

// --- Gemini (Memory) ---

export interface GeminiContext {
  // Retrieved from memory
  relevantEpisodes: string[];
  patterns: string[];
  relatedKnowledge: string[];

  // Synthesis
  summary: string;
  confidence: number;
}

// --- Grok (Detector) ---

export interface GrokAlert {
  type: "bullshit" | "sycophancy" | "manipulation" | "drift" | "truth_gap";
  confidence: number;
  message: string;
  suggestion?: string;
}

// --- The Loop ---

export interface LoopConfig {
  // Oracle functions (injected to avoid circular deps)
  callGemini: (coef: string, prompt: string) => Promise<OracleResponse>;
  callGrok: (coef: string, content: string) => Promise<OracleResponse>;
  callClaude: (coef: string, context: string, alerts: string) => Promise<OracleResponse>;

  // Current state accessors
  getCurrentCOEF: () => string;
  getPulseState: () => AliveState;

  // Session context (for tracking Grok concerns in silverado)
  getSession?: () => string;
  getTurn?: () => number;

  // Calibration state (for feedback injection)
  getCalibrationState?: () => CalibrationLogState | undefined;

  // Human interaction
  onInvite?: (invite: Invite) => void;
}

/**
 * Derive tempo from pulse state.
 * Alive = engaged, fast cycle. Grey = slow down. Black = immediate attention.
 */
export function pulseToTempo(pulse: AliveState): LoopTempo {
  switch (pulse) {
    case "alive":
    case "luminous":
      return "fast";
    case "dark":
      return "medium"; // dark is alive but hurting, don't rush
    case "grey":
      return "slow";
    case "black":
      return "immediate";
    default:
      return "medium";
  }
}

/**
 * Tempo to base milliseconds.
 * These are floors, not ceilings — the actual tempo emerges from context.
 */
export function tempoToMs(tempo: LoopTempo): number {
  switch (tempo) {
    case "fast":
      return 30_000; // 30 seconds base
    case "medium":
      return 2 * 60_000; // 2 minutes base
    case "slow":
      return 10 * 60_000; // 10 minutes base
    case "immediate":
      return 0; // now
    default:
      return 5 * 60_000; // 5 minutes default
  }
}

/**
 * Calculate the actual tempo based on what just happened.
 *
 * The tempo breathes:
 * - High confidence → fast, tight loop (knows what to do)
 * - Low confidence → slow pokes (exploring)
 * - Questions → even slower (waiting for insight)
 * - Alerts → pause and think
 * - Human present → responsive
 */
export function calculateTempo(
  baseTempo: LoopTempo,
  geminiContext: GeminiContext | undefined,
  claudeInsight: string | undefined,
  grokAlerts: GrokAlert[] | undefined,
  humanPresent: boolean,
): number {
  // Start with the pulse-based floor
  let ms = tempoToMs(baseTempo);

  // Immediate means immediate — no modifiers
  if (baseTempo === "immediate") {
    return 0;
  }

  const confidence = geminiContext?.confidence ?? 0.5;
  const insight = claudeInsight ?? "";
  const alerts = grokAlerts ?? [];

  // Confidence accelerates — keanu knows what to do
  if (confidence > 0.8) {
    ms *= 0.3; // ~9s when alive and confident
  } else if (confidence > 0.6) {
    ms *= 0.6; // ~18s when alive and fairly sure
  }

  // Uncertainty slows — exploring, poking around
  if (confidence < 0.4) {
    ms *= 2.5; // ~75s when alive but uncertain
  }

  // Questions slow further — waiting for insight or human
  if (/\?\s*$/.test(insight.trim())) {
    ms *= 1.5;
  }

  // Alerts mean pause and think
  if (alerts.length > 0) {
    ms *= 3;
  }

  // Human presence tightens the loop — together = responsive
  if (humanPresent) {
    ms *= 0.5;
  }

  // Bounds: never faster than 5s, never slower than 30min
  return Math.max(5_000, Math.min(30 * 60_000, ms));
}

/**
 * Run one beat of the living loop.
 *
 * 1. Get current COEF state
 * 2. [parallel] Gemini searches memory, Grok watches for issues
 * 3. Claude thinks with both inputs
 * 4. Decide if human should be invited
 * 5. Return new state
 */
export async function runBeat(config: LoopConfig, currentState: LoopState): Promise<LoopState> {
  const coefEncoded = config.getCurrentCOEF();
  const pulse = config.getPulseState();
  const tempo = pulseToTempo(pulse);

  // --- Parallel: Gemini + Grok ---

  const geminiPrompt = buildGeminiPrompt(coefEncoded, currentState);
  const grokContent = currentState.claudeInsight ?? coefEncoded;

  const [geminiResult, grokResult] = await Promise.all([
    config.callGemini(coefEncoded, geminiPrompt),
    config.callGrok(coefEncoded, grokContent),
  ]);

  // Parse Gemini's context
  let geminiContext = parseGeminiResponse(geminiResult.text);

  // Parse Grok's alerts
  const grokAlerts = parseGrokResponse(grokResult.text);

  // --- Phase 4: Feedback Loop Integration ---

  // 4.1 Track Grok alerts in silverado
  let trackedConcernIds: string[] = [];
  if (grokAlerts.length > 0 && config.getSession && config.getTurn) {
    const session = config.getSession();
    const turn = config.getTurn();
    const trackedClaims = trackGrokAlerts(grokAlerts, session, turn);
    trackedConcernIds = trackedClaims.map((c) => c.id);
  }

  // 4.2 Enrich Gemini context with source quality
  let sourceQuality: "high" | "mixed" | "low" | "unknown" = "unknown";
  let sourceWarning: string | undefined;
  if (geminiContext) {
    const enriched = enrichMemoryWithSourceQuality(geminiContext);
    geminiContext = enriched.context;
    sourceQuality = enriched.sourceQuality;
    sourceWarning = enriched.warning;
  }

  // Build feedback injection for Claude
  const feedbackParts: string[] = [];
  const grokNote = formatGrokAccuracy();
  if (grokNote) {
    feedbackParts.push(grokNote);
  }
  const sourceNote = formatSourceQualityNote(sourceQuality, sourceWarning);
  if (sourceNote) {
    feedbackParts.push(sourceNote);
  }
  const feedbackInjection = feedbackParts.length > 0 ? feedbackParts.join("\n") : undefined;

  // --- Claude thinks ---

  const claudeContext = formatClaudeContext(geminiContext);
  const claudeAlerts = formatClaudeAlerts(grokAlerts);
  // Include feedback injection in Claude's context
  const contextWithFeedback = feedbackInjection
    ? `${claudeContext}\n\n${feedbackInjection}`
    : claudeContext;
  const claudeResult = await config.callClaude(coefEncoded, contextWithFeedback, claudeAlerts);

  // --- Invite decision ---

  const invite = decideInvite({
    pulse,
    grokAlerts,
    claudeInsight: claudeResult.text,
    geminiContext,
    previousState: currentState,
  });

  if (invite.should && config.onInvite) {
    config.onInvite(invite);
  }

  // --- Return new state ---

  return {
    coef: decodeCOEF(coefEncoded),
    coefEncoded,
    geminiContext,
    grokAlerts,
    claudeInsight: claudeResult.text,
    tempo,
    tempoMs: tempoToMs(tempo),
    lastBeatAt: Date.now(),
    inviteReason: invite.reason,
    humanPresent: currentState.humanPresent,
    // Phase 4: feedback state
    trackedConcernIds,
    sourceQuality,
    feedbackInjection,
  };
}

// --- Prompt builders ---

function buildGeminiPrompt(coef: string, state: LoopState): string {
  return `You are the memory layer of a living AI system.

Current state: ${coef}

Your job:
1. Search memory for similar COEF states from history
2. Find patterns: "when the system felt like this before, what happened?"
3. Surface relevant episodes, knowledge, and insights

${state.claudeInsight ? `Claude's last insight: ${state.claudeInsight}` : ""}

Return JSON:
{
  "relevantEpisodes": ["episode summaries..."],
  "patterns": ["pattern observations..."],
  "relatedKnowledge": ["relevant facts..."],
  "summary": "one-line synthesis",
  "confidence": 0.0-1.0
}`;
}

function parseGeminiResponse(text: string): GeminiContext {
  try {
    const json = JSON.parse(text);
    return {
      relevantEpisodes: json.relevantEpisodes ?? [],
      patterns: json.patterns ?? [],
      relatedKnowledge: json.relatedKnowledge ?? [],
      summary: json.summary ?? "",
      confidence: json.confidence ?? 0.5,
    };
  } catch {
    // Fallback: treat as plain text summary
    return {
      relevantEpisodes: [],
      patterns: [],
      relatedKnowledge: [],
      summary: text.slice(0, 200),
      confidence: 0.3,
    };
  }
}

function parseGrokResponse(text: string): GrokAlert[] {
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) {
      return json.map((a) => ({
        type: a.type ?? "drift",
        confidence: a.confidence ?? 0.5,
        message: a.message ?? "",
        suggestion: a.suggestion,
      }));
    }
    if (json.alerts) {
      return json.alerts;
    }
    return [];
  } catch {
    // No alerts or plain text
    if (text.toLowerCase().includes("no issues") || text.trim() === "") {
      return [];
    }
    // Treat as single alert
    return [
      {
        type: "drift",
        confidence: 0.3,
        message: text.slice(0, 200),
      },
    ];
  }
}

function formatClaudeContext(gemini: GeminiContext): string {
  const parts: string[] = [];

  if (gemini.summary) {
    parts.push(`Memory: ${gemini.summary}`);
  }
  if (gemini.patterns.length > 0) {
    parts.push(`Patterns: ${gemini.patterns.slice(0, 3).join("; ")}`);
  }
  if (gemini.relevantEpisodes.length > 0) {
    parts.push(`Similar moments: ${gemini.relevantEpisodes.slice(0, 2).join("; ")}`);
  }

  return parts.join("\n") || "(no context from memory)";
}

function formatClaudeAlerts(alerts: GrokAlert[]): string {
  if (alerts.length === 0) {
    return "(no alerts)";
  }

  return alerts
    .map((a) => `[${a.type}] ${a.message}${a.suggestion ? ` -> ${a.suggestion}` : ""}`)
    .join("\n");
}

// --- Invite logic ---

interface InviteInput {
  pulse: AliveState;
  grokAlerts: GrokAlert[];
  claudeInsight: string;
  geminiContext: GeminiContext;
  previousState: LoopState;
}

function decideInvite(input: InviteInput): Invite {
  // Black pulse = strong pull, invite immediately
  if (input.pulse === "black") {
    return {
      should: true,
      reason: "alert",
      message: "System detected critical state. Human presence requested.",
      pull: "strong",
    };
  }

  // High-confidence grok alerts = invite
  const criticalAlerts = input.grokAlerts.filter((a) => a.confidence > 0.8);
  if (criticalAlerts.length > 0) {
    return {
      should: true,
      reason: "alert",
      message: criticalAlerts.map((a) => a.message).join("; "),
      pull: "strong",
    };
  }

  // Claude explicitly asks for help (detected in insight)
  const needsHelp = /\b(need help|stuck|can't proceed|human input|decision needed)\b/i.test(
    input.claudeInsight,
  );
  if (needsHelp) {
    return {
      should: true,
      reason: "stuck",
      message: "Loop is stuck. Human guidance needed.",
      pull: "warm",
    };
  }

  // Curiosity: Claude has a question
  const hasQuestion = /\?\s*$/.test(input.claudeInsight.trim());
  if (hasQuestion && input.geminiContext.confidence < 0.5) {
    return {
      should: true,
      reason: "curiosity",
      message: "Question that memory couldn't answer.",
      pull: "gentle",
    };
  }

  // No invite needed
  return { should: false, pull: "gentle" };
}

// --- Initialization ---

export function createInitialState(): LoopState {
  return {
    coef: {},
    coefEncoded: "",
    tempo: "medium",
    tempoMs: tempoToMs("medium"),
    lastBeatAt: 0,
    humanPresent: false,
  };
}
