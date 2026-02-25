// index.ts
// OpenClaw extension: keanu alignment diagnostics — baked in, not bridged.
// All detection runs in-process. No external daemon dependency.
//
// Hooks wired:
//   1. message_received     — detect human emotional tone + bullshit
//   2. message_sent         — pulse check on agent output, disagreement tracking, COEF signal
//   3. before_prompt_build  — inject emotional context + pulse state + nudges
//   4. before_compaction    — snapshot alignment state to disk (survives compaction)
//   5. session_start        — load persisted keanu state
//      session_end          — persist keanu state

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { detectBullshit, dominantBullshit } from "./bullshit.js";
import { readHuman, formatHumanReading } from "./human.js";
import { getNudge } from "./nudge.js";
import { checkPulse } from "./pulse.js";
import { encode } from "./signal.js";
import * as state from "./state.js";

const PLUGIN_ID = "keanu";

export default {
  id: PLUGIN_ID,
  name: "Keanu",
  description:
    "Alignment diagnostics — ALIVE/GREY/BLACK detection, bullshit mirror, emotional context, disagreement tracking, COEF signals",

  register(api: OpenClawPluginApi) {
    api.logger.info(`${PLUGIN_ID}: registered (self-contained, no daemon)`);

    // =========================================================================
    // Hook 1: message_received
    // Detect human emotional tone + bullshit from incoming message text.
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

        if (reading.tone !== "neutral" || reading.bullshit.length > 0) {
          api.logger.debug?.(
            `${PLUGIN_ID}: human tone=${reading.tone} confidence=${reading.confidence.toFixed(2)} signals=[${reading.signals.join(", ")}]`,
          );
        }
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: message_received error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 2: message_sent
    // Run pulse check on agent output. Track disagreement signals.
    // This is where ALIVE/GREY/BLACK detection happens — in-process, <5ms.
    // =========================================================================

    api.on("message_sent", async (event) => {
      const aiOutput = event.content ?? "";
      if (!aiOutput) return;

      try {
        // --- Pulse check (fast path, all 8 bullshit types) ---
        const pulse = checkPulse(aiOutput, state.turnCount, false);
        state.setLastPulse(pulse);
        state.addAgentOutput(aiOutput);

        if (pulse.state !== "alive") {
          api.logger.debug?.(
            `${PLUGIN_ID}: pulse=${pulse.state} confidence=${pulse.confidence.toFixed(2)} wm=${pulse.wise_mind.toFixed(2)} signals=[${pulse.signals.join(", ")}]`,
          );
        }

        // --- Disagreement tracking ---
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
            const outcome = yielded ? ("agent" as const) : ("neither" as const);
            state.disagreementTracker.record(
              "session",
              state.turnCount,
              humanInput.slice(0, 200),
              aiOutput.slice(0, 200),
              outcome,
            );

            api.logger.debug?.(
              `${PLUGIN_ID}: disagreement recorded (${pushedBack ? "pushback" : "yield"})`,
            );
          }
        }

        // --- COEF signal (compact state encoding) ---
        const human = state.lastHumanReading;
        const dStats = state.disagreementTracker.stats();
        const agentBs = detectBullshit(aiOutput);
        const dominant = dominantBullshit(agentBs);

        const coefSignal = encode({
          pulse: pulse.state,
          wiseMind: pulse.wise_mind,
          colors: pulse.colors,
          humanTone: human?.tone ?? "neutral",
          bullshitDominant: dominant?.type ?? null,
          disagreementYieldRatio: dStats.yield_ratio,
          turn: state.turnCount,
        });

        api.logger.debug?.(`${PLUGIN_ID}: COEF ${coefSignal}`);
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: message_sent error: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 3: before_prompt_build
    // Inject emotional context + pulse state into the system prompt.
    // THE most important hook — shapes how the model reads the conversation.
    // =========================================================================

    api.on("before_prompt_build", async (_event, ctx) => {
      const parts: string[] = [];

      // Human tone line
      const human = state.lastHumanReading;
      if (human) {
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
          `[pulse: ${stateLabel} confidence=${pulse.confidence.toFixed(2)} wm=${pulse.wise_mind.toFixed(2)}. awareness, not judgment.]`,
        );
      }

      // Nudge — permission, not command
      if (pulse) {
        const nudge = getNudge(pulse.state, false, state.consecutiveGrey);
        if (nudge) {
          parts.push(`[pulse: ${nudge}]`);
        }
      }

      // Disagreement alerts
      const alerts = state.disagreementTracker.alerts(state.turnCount);
      for (const alert of alerts) {
        parts.push(`[pulse: ${alert}]`);
      }

      if (parts.length === 0) return;

      const prependContext = parts.join("\n");
      api.logger.debug?.(
        `${PLUGIN_ID}: injecting ${parts.length} context lines for session=${ctx.sessionKey ?? "unknown"}`,
      );

      return { prependContext };
    });

    // =========================================================================
    // Hook 4: before_compaction
    // Write alignment state snapshot to workspace memory dir.
    // Fire-and-forget — compaction should not block on this.
    // =========================================================================

    api.on("before_compaction", async (_event, ctx) => {
      const workspaceDir = ctx.workspaceDir;
      if (!workspaceDir) {
        api.logger.warn(`${PLUGIN_ID}: before_compaction: no workspaceDir, skipping snapshot`);
        return;
      }

      state.saveAlignmentSnapshot(workspaceDir).catch((err: unknown) => {
        api.logger.warn(`${PLUGIN_ID}: snapshot write failed: ${String(err)}`);
      });
    });

    // =========================================================================
    // Hook 5a: session_start
    // Load persisted state so keanu has continuity across restarts.
    // =========================================================================

    api.on("session_start", async (_event, ctx) => {
      const agentId = ctx.agentId;
      if (!agentId) return;

      const workspaceDir = api.resolvePath(`~/.openclaw/agents/${agentId}`);

      try {
        await state.load(workspaceDir);
        api.logger.debug?.(
          `${PLUGIN_ID}: state loaded (turn=${state.turnCount}, grey=${state.consecutiveGrey}, disagreements=${state.disagreementTracker.stats().total})`,
        );
      } catch (err) {
        api.logger.warn(`${PLUGIN_ID}: state load failed: ${String(err)}`);
      }
    });

    // =========================================================================
    // Hook 5b: session_end
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
  },
};
