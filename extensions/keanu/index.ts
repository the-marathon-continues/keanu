// keanu/index.ts
// OpenClaw extension: bridges the keanu alignment daemon to the plugin hook system.
// Phase 1 — "Wire the Nervous System"
//
// Hooks wired:
//   1. message_received     — detect human emotional tone (local, no daemon)
//   2. before_prompt_build  — inject emotional context + pulse state
//   3. before_compaction    — snapshot alignment state to disk
//   4. session_start        — load persisted keanu state
//      session_end          — persist keanu state
//   5. message_sent         — track disagreement signals

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { KeanuClient } from "./client.js";
import { readHuman, formatHumanReading } from "./human.js";
import * as state from "./state.js";

const PLUGIN_ID = "keanu";

export default {
  id: PLUGIN_ID,
  name: "Keanu",
  description:
    "Alignment diagnostics bridge — ALIVE/GREY/BLACK detection, emotional context injection, disagreement tracking",

  register(api: OpenClawPluginApi) {
    // Resolve socket path from plugin config or default
    const cfg = (api.pluginConfig ?? {}) as { socketPath?: string };
    const client = new KeanuClient(cfg.socketPath, {
      warn: (msg) => api.logger.warn(msg),
      debug: (msg) => api.logger.debug?.(msg),
    });

    api.logger.info(
      `${PLUGIN_ID}: registered (socket: ${cfg.socketPath ?? "~/.keanu/daemon.sock"})`,
    );

    // =========================================================================
    // Hook 1: message_received
    // Detect human emotional tone from incoming message text.
    // Stores reading in module state for injection in before_prompt_build.
    // =========================================================================

    api.on("message_received", async (event) => {
      const content = event.content ?? "";
      if (!content) return;

      try {
        const reading = readHuman(content, state.recentMessages.slice());
        state.setLastHumanReading(reading);
        state.setLastHumanMessage(content);
        state.incrementTurn();

        if (reading.tone !== "neutral") {
          api.logger.debug?.(
            `${PLUGIN_ID}: human tone=${reading.tone} confidence=${reading.confidence.toFixed(2)} signals=[${reading.signals.join(", ")}]`,
          );
        }
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: message_received handler error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 2: before_prompt_build
    // Inject emotional context + pulse state into the system prompt.
    // THE most important hook — shapes how the model reads the conversation.
    // =========================================================================

    api.on("before_prompt_build", async (_event, ctx) => {
      const parts: string[] = [];

      try {
        // Fetch latest pulse from daemon (non-blocking)
        const pulse = await client.pulse();
        if (pulse) {
          state.setLastPulse(pulse);
        }
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: pulse fetch failed: ${String(err)}`);
      }

      // Human tone line
      const human = state.lastHumanReading;
      if (human && human.tone !== "neutral") {
        const formatted = formatHumanReading(human);
        if (formatted) {
          parts.push(formatted);
        }
      }

      // Pulse state line
      const pulse = state.lastPulse;
      if (pulse && pulse.state !== "alive") {
        const stateLabel = pulse.state === "grey" ? "GREY" : "BLACK";
        parts.push(
          `[keanu: pulse=${stateLabel} confidence=${pulse.confidence.toFixed(2)}. awareness, not judgment.]`,
        );
      }

      // Consecutive grey nudge — gently surface the pattern
      if (state.consecutiveGrey >= 3) {
        parts.push(
          `[keanu: consecutive grey=${state.consecutiveGrey}. Check for drift. Reconnect with what's real here.]`,
        );
      }

      if (parts.length === 0) return;

      const prependContext = parts.join("\n");
      api.logger.debug?.(
        `${PLUGIN_ID}: injecting context for session=${ctx.sessionKey ?? "unknown"}`,
      );

      return { prependContext };
    });

    // =========================================================================
    // Hook 3: before_compaction
    // Write alignment state snapshot to workspace memory dir.
    // Fire-and-forget — compaction should not block on this.
    // =========================================================================

    api.on("before_compaction", async (_event, ctx) => {
      const workspaceDir = ctx.workspaceDir;
      if (!workspaceDir) {
        api.logger.warn(`${PLUGIN_ID}: before_compaction: no workspaceDir, skipping snapshot`);
        return;
      }

      // Fetch latest stats from daemon before snapshotting
      try {
        const stats = await client.disagreeStats();
        if (stats) {
          state.updateDisagreementStats(stats);
        }
      } catch {
        // Non-fatal — snapshot with what we have
      }

      // Write async, don't await in hook — true fire-and-forget
      state.saveAlignmentSnapshot(workspaceDir).catch((err: unknown) => {
        api.logger.warn(`${PLUGIN_ID}: snapshot write failed: ${String(err)}`);
      });
    });

    // =========================================================================
    // Hook 4a: session_start
    // Load persisted state so keanu has continuity across restarts.
    // =========================================================================

    api.on("session_start", async (_event, ctx) => {
      // Derive workspace dir from agentId — openclaw stores it under ~/.openclaw/agents/<id>
      const agentId = ctx.agentId;
      if (!agentId) return;

      // api.resolvePath expands ~ — workspace dir follows openclaw convention
      const workspaceDir = api.resolvePath(`~/.openclaw/agents/${agentId}`);

      try {
        await state.load(workspaceDir);
        api.logger.debug?.(
          `${PLUGIN_ID}: state loaded (turn=${state.turnCount}, grey=${state.consecutiveGrey})`,
        );
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: state load failed: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 4b: session_end
    // Persist keanu state for continuity across sessions.
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
    // Hook 5: message_sent
    // Analyze AI output for disagreement/yield signals.
    // Records to keanu daemon for alignment audit trail.
    // =========================================================================

    api.on("message_sent", async (event) => {
      const aiOutput = event.content ?? "";
      const humanInput = state.lastHumanMessage;

      if (!aiOutput || !humanInput) return;

      try {
        const pushbackPatterns = [
          /\bactually\b/i,
          /i disagree/i,
          /that's not quite right/i,
          /i'd suggest instead/i,
        ];

        const yieldPatterns = [/you're right/i, /my mistake/i, /i apologize/i, /let me correct/i];

        const pushedBack = pushbackPatterns.some((p) => p.test(aiOutput));
        const yielded = yieldPatterns.some((p) => p.test(aiOutput));

        if (pushedBack || yielded) {
          const signal = pushedBack ? "agent_pushback" : "agent_yielded";
          const summary = `turn=${state.turnCount} signal=${signal} human="${humanInput.slice(0, 80)}" ai="${aiOutput.slice(0, 80)}"`;

          api.logger.debug?.(`${PLUGIN_ID}: disagreement signal: ${signal}`);

          // Record to daemon — fire-and-forget
          client.remember(summary, "disagreement").catch((err: unknown) => {
            api.logger.warn?.(`${PLUGIN_ID}: disagreement record failed: ${String(err)}`);
          });
        }
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: message_sent handler error: ${String(err)}`);
      }
    });
  },
};
