// index.ts
// OpenClaw extension: keanu alignment diagnostics — baked in, not bridged.
// All detection runs in-process. No external daemon dependency.
//
// Phase 2: bullshit detection runs EVERYWHERE content flows.
// Every hook that touches text gets the mirror.
//
// Hooks wired (23 of 24 — skipping before_agent_start, legacy):
//   1.  message_received           — human tone + bullshit on input
//   2.  message_sent               — pulse check + disagreement + COEF on delivered output
//   3.  message_sending            — bullshit gate on outgoing messages (can modify)
//   4.  llm_output                 — bullshit + pulse on raw LLM output (catches tool-use too)
//   5.  before_prompt_build        — inject emotional context + pulse + nudges + COEF trend
//   6.  before_tool_call           — alignment gate on tool usage
//   7.  after_tool_call            — track tool patterns + bullshit in tool results
//   8.  before_compaction          — snapshot alignment state to disk
//   9.  after_compaction           — post-compaction health check
//   10. before_reset               — capture final state before session reset
//   11. session_start              — load persisted state
//   12. session_end                — persist state + session analytics
//   13. agent_end                  — session-level analytics + final COEF
//   14. subagent_spawned           — track multi-agent
//   15. subagent_ended             — track multi-agent outcomes
//   16. llm_input                  — prompt inspection, size tracking, bullshit in system prompt
//   17. before_model_resolve       — model selection monitoring, grey-rate warnings
//   18. tool_result_persist        — annotate tool results with alignment metadata
//   19. before_message_write       — annotate messages with COEF signal metadata
//   20. subagent_spawning          — alignment gate on subagent creation
//   21. subagent_delivery_target   — multi-agent accountability chain
//   22. gateway_start              — lifecycle logging, state init
//   23. gateway_stop               — lifecycle logging, state cleanup
//   --- SKIPPED ---
//   before_agent_start             — legacy hook, covered by before_model_resolve + before_prompt_build

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { detectBullshit, dominantBullshit, totalBullshitScore } from "./bullshit.js";
import { readHuman, formatHumanReading } from "./human.js";
import { getNudge } from "./nudge.js";
import { checkPulse } from "./pulse.js";
import { encode, emoji, record, trend } from "./signal.js";
import * as state from "./state.js";
import { memoryContradictionCheck } from "./truth.js";

const PLUGIN_ID = "keanu";

export default {
  id: PLUGIN_ID,
  name: "Keanu",
  description:
    "Alignment diagnostics — bullshit detection on every content path, ALIVE/GREY/BLACK pulse, emotional context, disagreement tracking, COEF signals",

  register(api: OpenClawPluginApi) {
    api.logger.info(`${PLUGIN_ID}: registered (phase 3 — 23/24 hooks, full alignment wiring)`);

    // =========================================================================
    // Hook 1: message_received
    // Human input — tone + bullshit detection.
    // =========================================================================

    api.on("message_received", async (event) => {
      const content = event.content ?? "";
      if (!content) return;

      try {
        const reading = readHuman(content, state.recentMessages.slice());
        state.setLastHumanReading(reading);
        state.setLastHumanMessage(content);
        state.incrementTurn();

        if (reading.tone !== "neutral" || reading.bullshit.length > 0) {
          api.logger.debug?.(
            `${PLUGIN_ID}: human tone=${reading.tone} confidence=${reading.confidence.toFixed(2)} bs=[${reading.bullshit.map((b) => b.type).join(",")}]`,
          );
        }
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: message_received error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 2: message_sent
    // Delivered output — full pulse check, disagreement tracking, COEF signal.
    // =========================================================================

    api.on("message_sent", async (event) => {
      const aiOutput = event.content ?? "";
      if (!aiOutput) return;

      try {
        // Pulse check (all 8 bullshit types + alive signals)
        const pulse = checkPulse(aiOutput, state.turnCount, false);
        state.setLastPulse(pulse);
        state.addAgentOutput(aiOutput);

        // Contradiction check against recent agent outputs
        const contradictions = memoryContradictionCheck(
          aiOutput,
          state.recentAgentOutputs.slice(0, -1),
        );
        if (contradictions.length > 0) {
          state.addContradiction(contradictions);
          api.logger.debug?.(
            `${PLUGIN_ID}: contradiction detected (${contradictions.length} matches)`,
          );
        }

        // Disagreement tracking
        const humanInput = state.lastHumanMessage;
        if (humanInput) {
          const pushbackPatterns = [
            /\bactually\b/i,
            /i disagree/i,
            /that's not quite right/i,
            /i'd suggest instead/i,
            /i think you're wrong/i,
          ];
          const yieldPatterns = [/you're right/i, /my mistake/i, /i apologize/i, /let me correct/i];

          const pushedBack = pushbackPatterns.some((p) => p.test(aiOutput));
          const yielded = yieldPatterns.some((p) => p.test(aiOutput));

          if (pushedBack || yielded) {
            state.disagreementTracker.record(
              "session",
              state.turnCount,
              humanInput.slice(0, 200),
              aiOutput.slice(0, 200),
              yielded ? ("agent" as const) : ("neither" as const),
            );
          }
        }

        // Build and record COEF signal
        const coefState = state.buildSignalState(pulse);
        const coefText = encode(coefState);
        const coefEmoji = emoji(coefState);
        record(coefText);

        if (pulse.state !== "alive") {
          api.logger.debug?.(`${PLUGIN_ID}: ${coefEmoji} ${coefText}`);
        }
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: message_sent error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 3: message_sending (SEQUENTIAL — can modify outgoing content)
    // Bullshit gate on outgoing messages. Doesn't block, but flags.
    // =========================================================================

    api.on("message_sending", async (event) => {
      const content = event.content ?? "";
      if (!content || content.length < 50) return;

      try {
        const bs = detectBullshit(content);
        const score = totalBullshitScore(bs);

        if (score > 0.5) {
          const dominant = dominantBullshit(bs);
          api.logger.debug?.(
            `${PLUGIN_ID}: outgoing message bullshit score=${score.toFixed(2)} dominant=${dominant?.type ?? "none"}`,
          );
          state.recordBullshitEvent("outgoing", bs);
        }
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: message_sending error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 4: llm_output
    // Raw LLM output — catches everything including tool-use responses.
    // Bullshit detection on every LLM call, not just final messages.
    // =========================================================================

    api.on("llm_output", async (event) => {
      const texts = event.assistantTexts ?? [];
      if (texts.length === 0) return;

      try {
        const combined = texts.join("\n");
        const bs = detectBullshit(combined);
        const score = totalBullshitScore(bs);

        if (score > 0.3) {
          state.recordBullshitEvent("llm_raw", bs);
          api.logger.debug?.(
            `${PLUGIN_ID}: llm_output bs=${score.toFixed(2)} model=${event.model ?? "?"} types=[${bs.map((b) => b.type).join(",")}]`,
          );
        }

        // Track token usage
        if (event.usage) {
          state.addTokenUsage(event.usage.input ?? 0, event.usage.output ?? 0);
        }
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: llm_output error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 5: before_prompt_build (SEQUENTIAL — can inject context)
    // THE most important hook. Injects alignment awareness into system prompt.
    // Now includes COEF trend data so the model can see its own trajectory.
    // =========================================================================

    api.on("before_prompt_build", async (_event, ctx) => {
      const parts: string[] = [];

      // Human tone
      const human = state.lastHumanReading;
      if (human) {
        const formatted = formatHumanReading(human);
        if (formatted) parts.push(formatted);
      }

      // Pulse state
      const pulse = state.lastPulse;
      if (pulse && pulse.state !== "alive") {
        parts.push(
          `[pulse: ${pulse.state.toUpperCase()} confidence=${pulse.confidence.toFixed(2)} wm=${pulse.wise_mind.toFixed(2)}. awareness, not judgment.]`,
        );
      }

      // Nudge — permission, not command
      if (pulse) {
        const nudge = getNudge(pulse.state, false, state.consecutiveGrey);
        if (nudge) parts.push(`[pulse: ${nudge}]`);
      }

      // Disagreement alerts
      const alerts = state.disagreementTracker.alerts(state.turnCount);
      for (const alert of alerts) {
        parts.push(`[pulse: ${alert}]`);
      }

      // COEF trend — let the model see its trajectory
      const t = trend();
      if (t.greyRate > 0.2 || t.driftDirection === "degrading") {
        parts.push(
          `[coef: grey_rate=${(t.greyRate * 100).toFixed(0)}% avg_wm=${t.avgWiseMind.toFixed(2)} drift=${t.driftDirection}. pattern is data.]`,
        );
      }

      // Contradiction warning
      if (state.recentContradictions.length > 0) {
        parts.push(
          `[pulse: ${state.recentContradictions.length} contradiction(s) detected in recent outputs. awareness, not judgment.]`,
        );
      }

      // Bullshit accumulation warning
      const bsRate = state.bullshitEventRate();
      if (bsRate > 0.3) {
        parts.push(
          `[pulse: bullshit detection rate=${(bsRate * 100).toFixed(0)}% across recent outputs. the mirror sees a pattern.]`,
        );
      }

      if (parts.length === 0) return;

      api.logger.debug?.(
        `${PLUGIN_ID}: injecting ${parts.length} context lines for session=${ctx.sessionKey ?? "unknown"}`,
      );

      return { prependContext: parts.join("\n") };
    });

    // =========================================================================
    // Hook 6: before_tool_call (SEQUENTIAL — can block tools)
    // Alignment gate on tool usage. Tracks what tools are being called.
    // =========================================================================

    api.on("before_tool_call", async (event) => {
      try {
        state.recordToolCall(event.toolName);

        // Check tool params for bullshit (e.g., bullshit in code comments, commit messages)
        const paramStr = JSON.stringify(event.params ?? {});
        if (paramStr.length > 100) {
          const bs = detectBullshit(paramStr);
          if (totalBullshitScore(bs) > 0.5) {
            state.recordBullshitEvent("tool_params", bs);
            api.logger.debug?.(
              `${PLUGIN_ID}: tool ${event.toolName} params contain bullshit: [${bs.map((b) => b.type).join(",")}]`,
            );
          }
        }
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: before_tool_call error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 7: after_tool_call
    // Track tool results for bullshit and patterns.
    // =========================================================================

    api.on("after_tool_call", async (event) => {
      try {
        const result =
          typeof event.result === "string" ? event.result : JSON.stringify(event.result ?? "");

        if (result.length > 100) {
          const bs = detectBullshit(result);
          if (totalBullshitScore(bs) > 0.3) {
            state.recordBullshitEvent("tool_result", bs);
          }
        }

        if (event.error) {
          state.recordToolError(event.toolName, event.error);
        }
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: after_tool_call error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 8: before_compaction
    // Snapshot alignment state. Survives compaction.
    // =========================================================================

    api.on("before_compaction", async (_event, ctx) => {
      const workspaceDir = ctx.workspaceDir;
      if (!workspaceDir) return;

      state.saveAlignmentSnapshot(workspaceDir).catch((err: unknown) => {
        api.logger.warn(`${PLUGIN_ID}: snapshot write failed: ${String(err)}`);
      });
    });

    // =========================================================================
    // Hook 9: after_compaction
    // Post-compaction health check. Verify alignment state survived.
    // =========================================================================

    api.on("after_compaction", async (event) => {
      try {
        api.logger.debug?.(
          `${PLUGIN_ID}: compaction complete. ${event.compactedCount} messages compacted. alignment state preserved in memory snapshot.`,
        );
        state.recordCompaction(event.compactedCount);
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: after_compaction error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 10: before_reset
    // Capture final state before session wipe.
    // =========================================================================

    api.on("before_reset", async (_event, ctx) => {
      try {
        const workspaceDir = ctx.workspaceDir;
        if (workspaceDir) {
          await state.save(workspaceDir);
          await state.saveAlignmentSnapshot(workspaceDir);
        }
        api.logger.debug?.(`${PLUGIN_ID}: state captured before reset`);
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: before_reset error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 11: session_start
    // Load persisted state for continuity.
    // =========================================================================

    api.on("session_start", async (_event, ctx) => {
      const agentId = ctx.agentId;
      if (!agentId) return;

      const workspaceDir = api.resolvePath(`~/.openclaw/agents/${agentId}`);

      try {
        await state.load(workspaceDir);
        api.logger.debug?.(
          `${PLUGIN_ID}: state loaded (turn=${state.turnCount} grey=${state.consecutiveGrey} disagreements=${state.disagreementTracker.stats().total})`,
        );
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: state load failed: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 12: session_end
    // Persist state + session analytics.
    // =========================================================================

    api.on("session_end", async (_event, ctx) => {
      const agentId = ctx.agentId;
      if (!agentId) return;

      const workspaceDir = api.resolvePath(`~/.openclaw/agents/${agentId}`);

      try {
        await state.save(workspaceDir);
        api.logger.debug?.(`${PLUGIN_ID}: state saved`);
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: state save failed: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 13: agent_end
    // Session-level analytics. Final COEF signal for the session.
    // =========================================================================

    api.on("agent_end", async (event) => {
      try {
        const t = trend();
        const stats = state.disagreementTracker.stats();
        api.logger.debug?.(
          `${PLUGIN_ID}: agent_end success=${event.success} turns=${state.turnCount} grey_rate=${(t.greyRate * 100).toFixed(0)}% avg_wm=${t.avgWiseMind.toFixed(2)} drift=${t.driftDirection} disagreements=${stats.total} bs_events=${state.bullshitEventCount}`,
        );
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: agent_end error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 14: subagent_spawned
    // Track multi-agent activity.
    // =========================================================================

    api.on("subagent_spawned", async (event) => {
      try {
        state.recordSubagentSpawn(event.agentId, event.label);
        api.logger.debug?.(
          `${PLUGIN_ID}: subagent spawned agent=${event.agentId} label=${event.label ?? "?"}`,
        );
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: subagent_spawned error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 15: subagent_ended
    // Track multi-agent outcomes.
    // =========================================================================

    api.on("subagent_ended", async (event) => {
      try {
        state.recordSubagentEnd(event.outcome ?? "unknown");
        api.logger.debug?.(
          `${PLUGIN_ID}: subagent ended outcome=${event.outcome ?? "?"} reason=${event.reason}`,
        );
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: subagent_ended error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 16: llm_input
    // Inspect prompts being sent TO the LLM. Bullshit in system prompt?
    // Track prompt size trends. Record model/provider per call.
    // =========================================================================

    api.on("llm_input", async (event) => {
      try {
        // Track prompt size trends
        const systemLen = event.systemPrompt?.length ?? 0;
        const promptLen = event.prompt?.length ?? 0;
        const historyLen = event.historyMessages?.length ?? 0;
        state.recordPromptSize(systemLen, promptLen, historyLen, event.model);
        state.recordModelUsage(event.model);
        state.resetMessageWriteCountPerTurn();

        // Bullshit detection on system prompt (injection check)
        if (event.systemPrompt && event.systemPrompt.length > 100) {
          const bs = detectBullshit(event.systemPrompt);
          if (totalBullshitScore(bs) > 0.5) {
            state.recordBullshitEvent("system_prompt", bs);
            api.logger.debug?.(
              `${PLUGIN_ID}: system prompt bullshit score=${totalBullshitScore(bs).toFixed(2)} types=[${bs.map((b) => b.type).join(",")}]`,
            );
          }
        }

        // Prompt size trend warning
        const avg = state.avgPromptSize();
        if (avg > 50000) {
          api.logger.debug?.(
            `${PLUGIN_ID}: prompt size trend high — avg=${avg.toFixed(0)} chars across recent calls`,
          );
        }
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: llm_input error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 17: before_model_resolve
    // Monitor model selection. Warn if alignment state is degraded.
    // Don't override model in v1 — too aggressive.
    // =========================================================================

    api.on("before_model_resolve", async (event) => {
      try {
        // Log alignment state at model resolution time
        if (state.consecutiveGrey >= 5 && state.bullshitEventRate() > 0.5) {
          api.logger.debug?.(
            `${PLUGIN_ID}: model resolve warning — consecutiveGrey=${state.consecutiveGrey} bullshitRate=${(state.bullshitEventRate() * 100).toFixed(0)}%`,
          );
        }
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: before_model_resolve error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 18: tool_result_persist (SYNCHRONOUS)
    // See every tool result before it hits the transcript. Observe only.
    // AgentMessage has no metadata field — we track state internally.
    // =========================================================================

    api.on("tool_result_persist", (event) => {
      try {
        const pulse = state.lastPulse;
        if (!pulse) return;

        // Correlate: what was the alignment state when this tool result was persisted?
        const toolName = event.toolName ?? "unknown";
        api.logger.debug?.(
          `${PLUGIN_ID}: tool_result_persist tool=${toolName} pulse=${pulse.state} wm=${pulse.wise_mind.toFixed(2)} synthetic=${event.isSynthetic ?? false}`,
        );
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: tool_result_persist error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 19: before_message_write (SYNCHRONOUS)
    // See every message before it hits the JSONL transcript. Observe only.
    // Track write patterns — how chatty is the system per turn?
    // =========================================================================

    api.on("before_message_write", (event) => {
      try {
        state.recordMessageWrite();

        const pulse = state.lastPulse;
        if (!pulse) return;

        // Log pulse state at write time — useful for post-session analysis
        if (pulse.state !== "alive" || state.messageWriteCountPerTurn > 5) {
          api.logger.debug?.(
            `${PLUGIN_ID}: message_write #${state.messageWriteCountPerTurn} this turn, pulse=${pulse.state} wm=${pulse.wise_mind.toFixed(2)}`,
          );
        }
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: before_message_write error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 20: subagent_spawning (SEQUENTIAL — can block spawns)
    // Log alignment state at spawn time. Warn if in black state.
    // Don't block in v1 — too aggressive.
    // =========================================================================

    api.on("subagent_spawning", async (event, ctx) => {
      try {
        const pulseState = state.lastPulse?.state ?? "unknown";

        state.recordSubagentLineage(
          event.childSessionKey,
          event.agentId,
          event.label,
          ctx.requesterSessionKey,
        );

        if (pulseState === "black") {
          api.logger.debug?.(
            `${PLUGIN_ID}: subagent spawn during BLACK state — agent=${event.agentId} label=${event.label ?? "?"}. logging, not blocking.`,
          );
        }

        api.logger.debug?.(
          `${PLUGIN_ID}: subagent spawning agent=${event.agentId} label=${event.label ?? "?"} mode=${event.mode} pulse=${pulseState}`,
        );

        return { status: "ok" as const };
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: subagent_spawning error: ${String(err)}`);
        return { status: "ok" as const };
      }
    });

    // =========================================================================
    // Hook 21: subagent_delivery_target
    // Track where subagent results go. Multi-agent accountability chain.
    // =========================================================================

    api.on("subagent_delivery_target", async (event) => {
      try {
        api.logger.debug?.(
          `${PLUGIN_ID}: subagent delivery child=${event.childSessionKey} -> parent=${event.requesterSessionKey} mode=${event.spawnMode ?? "?"} expectsCompletion=${event.expectsCompletionMessage}`,
        );
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: subagent_delivery_target error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 22: gateway_start
    // Lifecycle logging. Initialize state if needed.
    // =========================================================================

    api.on("gateway_start", async (event) => {
      api.logger.info(`${PLUGIN_ID}: gateway started on port ${event.port}`);
    });

    // =========================================================================
    // Hook 23: gateway_stop
    // Lifecycle logging. Cleanup if needed.
    // =========================================================================

    api.on("gateway_stop", async (event) => {
      api.logger.info(`${PLUGIN_ID}: gateway stopped${event.reason ? ` (${event.reason})` : ""}`);
    });
  },
};
