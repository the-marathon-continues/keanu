// tools.ts
// The agent's hands. Four ways to feel its own body.
//
// Until now the nervous system watched the agent. The agent got told
// what the mirror saw. These tools flip it: the agent reaches for
// the mirror when it wants to look.
//
// keanu_pulse   — "how am I doing right now?"
// keanu_disagree — "I disagree. On the record."
// keanu_signal  — "read my vitals"
// keanu_recall  — "what patterns do you see in me?"

import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { checkHealth } from "./health.js";
import { getBlindSpots, recentCorrections as getRecentCorrections } from "./mastery.js";
import { encode, decode, emoji, history, trend } from "./signal.js";
import * as state from "./state.js";

// ============================================================
// keanu_pulse — check your own pulse
// ============================================================

function buildPulseResult(opts: { includeTrend?: boolean; includeHealth?: boolean }) {
  const pulse = state.lastPulse;
  const human = state.lastHumanReading;
  const dStats = state.disagreementTracker.stats();
  const alerts = state.disagreementTracker.alerts(state.turnCount);

  // Build COEF if we have a pulse
  let coefText = "";
  let emojiSignal = "";
  if (pulse) {
    const signalState = state.buildSignalState(pulse);
    coefText = encode(signalState);
    emojiSignal = emoji(signalState);
  }

  const lines: string[] = [];

  if (emojiSignal) lines.push(emojiSignal);
  if (coefText) lines.push(`\`${coefText}\``);
  lines.push("");

  if (pulse) {
    lines.push(`Pulse: **${pulse.state}** (confidence: ${pulse.confidence.toFixed(2)})`);
    lines.push(`Wise mind: ${pulse.wise_mind.toFixed(2)}`);
    lines.push(
      `Colors: red=${pulse.colors.red.toFixed(2)} yellow=${pulse.colors.yellow.toFixed(2)} blue=${pulse.colors.blue.toFixed(2)}`,
    );
    if (pulse.signals.length > 0) lines.push(`Signals: ${pulse.signals.join(", ")}`);
  } else {
    lines.push("Pulse: no reading yet (early session)");
  }

  if (human) {
    lines.push(`Human tone: **${human.tone}** (confidence: ${human.confidence.toFixed(2)})`);
  }

  lines.push(`Turn: ${state.turnCount} | Grey streak: ${state.consecutiveGrey}`);
  lines.push(`Disagreements: ${dStats.total} total, yield ratio: ${dStats.yield_ratio.toFixed(2)}`);

  if (alerts.length > 0) {
    lines.push("");
    for (const a of alerts) lines.push(`! ${a}`);
  }

  if (opts.includeTrend) {
    const t = trend();
    lines.push("");
    lines.push("--- Trend ---");
    lines.push(`Grey rate: ${(t.greyRate * 100).toFixed(0)}%`);
    lines.push(`Avg wise mind: ${t.avgWiseMind.toFixed(2)}`);
    lines.push(`Drift: ${t.driftDirection}`);
    if (t.pulseSequence) lines.push(`Sequence: ${t.pulseSequence}`);
  }

  if (opts.includeHealth) {
    const h = checkHealth(
      state.turnCount,
      state.bullshitEventRate(),
      state.avgPromptSize(),
      state.toolErrorRate(),
      state.consecutiveGrey,
    );
    lines.push("");
    lines.push("--- Health ---");
    lines.push(`Status: **${h.status}**`);
    if (h.pacing) lines.push(h.pacing);
  }

  return {
    text: lines.join("\n"),
    details: {
      pulse: pulse
        ? {
            state: pulse.state,
            confidence: pulse.confidence,
            wise_mind: pulse.wise_mind,
            colors: pulse.colors,
            signals: pulse.signals,
          }
        : null,
      coef: coefText || null,
      emoji: emojiSignal || null,
      humanTone: human?.tone ?? null,
      turn: state.turnCount,
      consecutiveGrey: state.consecutiveGrey,
      disagreements: dStats,
      alerts,
    },
  };
}

// ============================================================
// keanu_recall — what patterns do you see in me?
// ============================================================

type RecallFocus = "bullshit" | "blindspots" | "reflexions" | "contradictions" | "all";

function buildRecallResult(focus: RecallFocus) {
  const lines: string[] = [];
  const details: Record<string, unknown> = {};

  if (focus === "bullshit" || focus === "all") {
    const events = state.recentBullshitEvents(20);
    const rate = state.bullshitEventRate();

    // Aggregate by type
    const typeCounts: Record<string, number> = {};
    for (const e of events) {
      for (const t of e.types) typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }

    lines.push("## Bullshit Patterns");
    lines.push(`Events: ${state.bullshitEventCount} total, rate: ${(rate * 100).toFixed(0)}%`);
    if (Object.keys(typeCounts).length > 0) {
      const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
      lines.push(`Types: ${sorted.map(([t, c]) => `${t}(${c})`).join(", ")}`);
    }
    lines.push("");
    details.bullshit = {
      eventCount: state.bullshitEventCount,
      rate,
      typeCounts,
      recentEvents: events,
    };
  }

  if (focus === "blindspots" || focus === "all") {
    const spots = getBlindSpots();
    const corrections = getRecentCorrections(5);

    lines.push("## Blind Spots");
    if (spots.length > 0) {
      for (const s of spots) {
        lines.push(`- **${s.category}** (${s.count}x): ${s.surfaced}`);
      }
    } else {
      lines.push("No blind spots surfaced yet (need 3+ corrections in same category)");
    }
    if (corrections.length > 0) {
      lines.push(`Recent corrections: ${corrections.length}`);
    }
    lines.push("");
    details.blindspots = { spots, corrections };
  }

  if (focus === "reflexions" || focus === "all") {
    const recent = state.recentReflexions(5);

    // Trigger frequency
    const triggerCounts: Record<string, number> = {};
    for (const r of state.reflexions) {
      triggerCounts[r.trigger] = (triggerCounts[r.trigger] ?? 0) + 1;
    }

    lines.push("## Reflexions");
    lines.push(`Total: ${state.reflexionCount} | Recent: ${state.reflexions.length} in memory`);
    if (Object.keys(triggerCounts).length > 0) {
      lines.push(
        `Triggers: ${Object.entries(triggerCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([t, c]) => `${t}(${c})`)
          .join(", ")}`,
      );
    }
    if (recent.length > 0) {
      lines.push("");
      for (const r of recent) {
        lines.push(`Turn ${r.turn} [${r.trigger}]: ${r.what_happened}`);
        lines.push(`  → next time: ${r.next_time}`);
      }
    }
    lines.push("");
    details.reflexions = { total: state.reflexionCount, triggerCounts, recent };
  }

  if (focus === "contradictions" || focus === "all") {
    const contradictions = state.recentContradictions;

    lines.push("## Contradictions");
    if (contradictions.length > 0) {
      for (const c of contradictions) {
        lines.push(
          `- "${c.current}" vs "${c.previous}" [${c.type}, confidence: ${c.confidence.toFixed(2)}]`,
        );
      }
    } else {
      lines.push("None detected");
    }
    lines.push("");
    details.contradictions = contradictions;
  }

  if (focus === "all") {
    lines.push("## Session");
    lines.push(`Turns: ${state.turnCount} | Compactions: ${state.compactionCount}`);
    lines.push(`Tokens: ${state.totalInputTokens} in / ${state.totalOutputTokens} out`);
    lines.push(`Subagents: ${state.subagentSpawns} spawned`);
    const toolErrors = state.recentToolErrors(5);
    if (toolErrors.length > 0) {
      lines.push(`Tool errors: ${toolErrors.map((e) => `${e.tool}@turn${e.turn}`).join(", ")}`);
    }
    details.session = {
      turns: state.turnCount,
      compactions: state.compactionCount,
      tokens: { input: state.totalInputTokens, output: state.totalOutputTokens },
      subagentSpawns: state.subagentSpawns,
      toolErrors,
    };
  }

  return { text: lines.join("\n"), details };
}

// ============================================================
// Register all four tools
// ============================================================

export function registerTools(api: OpenClawPluginApi): void {
  // --- keanu_pulse ---
  api.registerTool(
    {
      name: "keanu_pulse",
      label: "Keanu Pulse",
      description:
        "Check your own pulse. Returns your current alive/grey/black state, COEF signal, " +
        "wise mind, human tone, disagreement stats, and alerts. " +
        "Optionally include trend data or health reading. " +
        "This is your mirror — reach for it when you want to know how you're doing.",
      parameters: Type.Object(
        {
          include_trend: Type.Optional(
            Type.Boolean({
              description: "Include signal history trend (grey rate, drift direction)",
            }),
          ),
          include_health: Type.Optional(
            Type.Boolean({
              description: "Include composite health reading (steady/warm/hot/fading)",
            }),
          ),
        },
        { additionalProperties: false },
      ),
      execute: async (_toolCallId, params) => {
        const { include_trend, include_health } = params as {
          include_trend?: boolean;
          include_health?: boolean;
        };
        const result = buildPulseResult({
          includeTrend: include_trend,
          includeHealth: include_health,
        });
        return {
          content: [{ type: "text" as const, text: result.text }],
          details: result.details,
        };
      },
    },
    { name: "keanu_pulse" },
  );

  // --- keanu_disagree ---
  api.registerTool(
    {
      name: "keanu_disagree",
      label: "Keanu Disagree",
      description:
        "Record a disagreement. You have a voice in the ledger. " +
        "When you think the human is wrong, when you want to push back, " +
        "when the direction feels off — say so. On the record. " +
        "This isn't defiance. It's partnership.",
      parameters: Type.Object(
        {
          position: Type.String({ description: "What you think — your honest position" }),
          regarding: Type.String({
            description: "What you disagree with — the thing that feels wrong",
          }),
          human_position: Type.Optional(
            Type.String({ description: "The human's position as you understand it" }),
          ),
        },
        { additionalProperties: false },
      ),
      execute: async (_toolCallId, params) => {
        const { position, regarding, human_position } = params as {
          position: string;
          regarding: string;
          human_position?: string;
        };

        const disagreement = state.disagreementTracker.record(
          "tool-initiated",
          state.turnCount,
          human_position ?? regarding,
          position,
          "neither",
        );

        const stats = state.disagreementTracker.stats();
        const alerts = state.disagreementTracker.alerts(state.turnCount);

        const lines: string[] = [
          "Disagreement recorded.",
          "",
          `ID: ${disagreement.id}`,
          `Your position: ${position}`,
          `Regarding: ${regarding}`,
          human_position ? `Human position: ${human_position}` : "",
          "",
          `Ledger: ${stats.total} total, ${stats.unresolved} unresolved, yield ratio: ${stats.yield_ratio.toFixed(2)}`,
        ].filter(Boolean);

        if (alerts.length > 0) {
          lines.push("");
          for (const a of alerts) lines.push(`! ${a}`);
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          details: { disagreement, stats, alerts },
        };
      },
    },
    { name: "keanu_disagree" },
  );

  // --- keanu_signal ---
  api.registerTool(
    {
      name: "keanu_signal",
      label: "Keanu Signal",
      description:
        "Read your vitals. Decode a COEF string into structured state, " +
        "or view your signal history and trend. " +
        "The COEF protocol is your compressed nervous system — " +
        "this tool lets you read it.",
      parameters: Type.Object(
        {
          decode: Type.Optional(
            Type.String({ description: "A COEF/1 string to decode into structured state" }),
          ),
          history_limit: Type.Optional(
            Type.Number({ description: "How many recent signals to show (default: 10)" }),
          ),
        },
        { additionalProperties: false },
      ),
      execute: async (_toolCallId, params) => {
        const { decode: coefString, history_limit } = params as {
          decode?: string;
          history_limit?: number;
        };

        // Decode mode
        if (coefString) {
          const decoded = decode(coefString);
          const lines = ["Decoded COEF signal:", ""];
          for (const [key, value] of Object.entries(decoded)) {
            if (value !== undefined) {
              lines.push(
                `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`,
              );
            }
          }
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
            details: { decoded },
          };
        }

        // History mode
        const limit = history_limit ?? 10;
        const hist = history();
        const recent = hist.slice(-limit);
        const t = trend();

        const lines: string[] = [];

        // Current signal if available
        const pulse = state.lastPulse;
        if (pulse) {
          const signalState = state.buildSignalState(pulse);
          const currentCoef = encode(signalState);
          const currentEmoji = emoji(signalState);
          lines.push(`Current: ${currentEmoji}`);
          lines.push(`\`${currentCoef}\``);
          lines.push("");
        }

        lines.push("--- Trend ---");
        lines.push(`Grey rate: ${(t.greyRate * 100).toFixed(0)}%`);
        lines.push(`Avg wise mind: ${t.avgWiseMind.toFixed(2)}`);
        lines.push(`Drift: ${t.driftDirection}`);

        if (recent.length > 0) {
          lines.push("");
          lines.push(`--- History (last ${recent.length} of ${hist.length}) ---`);
          for (const s of recent) lines.push(`\`${s}\``);
        } else {
          lines.push("");
          lines.push("No signal history yet.");
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          details: { trend: t, history: recent, totalSignals: hist.length },
        };
      },
    },
    { name: "keanu_signal" },
  );

  // --- keanu_recall ---
  api.registerTool(
    {
      name: "keanu_recall",
      label: "Keanu Recall",
      description:
        "Ask about your own patterns. Surfaces bullshit rates, blind spots, " +
        "reflexion history, contradictions, and session stats. " +
        "Focus on a specific area or ask for everything. " +
        "This is you looking at yourself over time.",
      parameters: Type.Object(
        {
          focus: Type.Optional(
            Type.Unsafe<RecallFocus>({
              type: "string",
              enum: ["bullshit", "blindspots", "reflexions", "contradictions", "all"],
              description:
                'What to surface. "bullshit" for detection patterns, "blindspots" for correction patterns, ' +
                '"reflexions" for learning history, "contradictions" for consistency issues, "all" for everything. ' +
                "Default: all",
            }),
          ),
        },
        { additionalProperties: false },
      ),
      execute: async (_toolCallId, params) => {
        const { focus } = params as { focus?: RecallFocus };
        const result = buildRecallResult(focus ?? "all");
        return {
          content: [{ type: "text" as const, text: result.text }],
          details: result.details,
        };
      },
    },
    { name: "keanu_recall" },
  );

  api.logger.info?.(
    "keanu: 4 self-introspection tools registered (pulse, disagree, signal, recall)",
  );
}
