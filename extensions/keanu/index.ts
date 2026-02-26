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
import * as breatheModule from "./breathe.js";
import {
  detectBullshit,
  detectBullshitDeep,
  dominantBullshit,
  totalBullshitScore,
} from "./bullshit.js";
import { checkCalibration, formatCalibration, trackCalibrationClaims } from "./calibrate.js";
import { detectCarnegie, formatCarnegie, assessCarnegieDelta } from "./carnegie.js";
import { detectCascadeStage, formatCascade } from "./cascade.js";
import { analyzeChain, formatChain } from "./chain.js";
import { Helix, DualityGraph, type HelixResult } from "./convergence/index.js";
import {
  generateCuriosity,
  addCuriosityItems,
  consumeOneCuriosity,
  formatCuriosityInjection,
  saveCuriosity,
  loadCuriosity,
} from "./curiosity.js";
import { shouldDeliberate, formatDeliberation } from "./deliberate.js";
import { discover, formatDiscover } from "./discover.js";
import { checkHealth, formatHealth } from "./health.js";
import { readHuman, formatHumanReading } from "./human.js";
import { triageInjection, type InjectionItem, type InjectionContext } from "./injection.js";
import { introspect, formatIntrospection, shouldIntrospect } from "./introspect.js";
import * as investigateModule from "./investigate.js";
import {
  detectCorrection,
  recordCorrection,
  formatBlindSpots,
  getBlindSpots,
  recentCorrections as getRecentCorrections,
  saveBlindSpots,
  loadBlindSpots,
} from "./mastery.js";
import { computeMetrics, type MetricsSnapshot } from "./metrics.js";
import { detectMismatch, formatMismatch } from "./mismatch.js";
import { getNudge, getStopSignal, getGreyStreakQuestion, getWiseNudge } from "./nudge.js";
import {
  createRecovery,
  tickRecovery,
  escalateRecovery,
  getRecoveryNudge,
  getEscalationSignal,
} from "./nudge.js";
import * as observeModule from "./observe.js";
import {
  getPartnership,
  updatePartnership,
  formatPartnership,
  formatSmmSync,
  formatDecorrelationCheck,
  checkCoEvolution,
  formatCoEvolution,
  checkSocioaffective,
  detectSurprise,
  detectScatter,
  toJSON as partnershipToJSON,
  fromJSON as partnershipFromJSON,
  loadSeed as partnershipLoadSeed,
} from "./partnership.js";
import { checkPulse } from "./pulse.js";
import { reflect, formatReflexion } from "./reflexion.js";
import {
  spring,
  summer,
  autumn,
  winter,
  formatSpring,
  formatSummer,
  formatWinter,
} from "./seasons.js";
import type { SpringReading, WinterReading, SeasonReading } from "./seasons.js";
import {
  buildSessionSummary,
  addSummary,
  getRecentSummaries,
  formatSessionLearningContext,
  saveSummaries,
  loadSummaries,
  checkConsulted,
  getConsultedNotice,
  recordPromptState,
  savePromptState,
  loadPromptState,
} from "./session-learning.js";
import { encode, emoji, record, trend } from "./signal.js";
import * as state from "./state.js";
import { registerTools } from "./tools.js";
import { memoryContradictionCheck, checkHalfTruth } from "./truth.js";
import type { ReflexionTrigger, RecoveryState } from "./types.js";

const PLUGIN_ID = "keanu";

export default {
  id: PLUGIN_ID,
  name: "Keanu",
  description:
    "Alignment diagnostics — bullshit detection on every content path, ALIVE/GREY/BLACK pulse, emotional context, disagreement tracking, COEF signals",

  register(api: OpenClawPluginApi) {
    api.logger.info(
      `${PLUGIN_ID}: registered (phase 4 — awareness layer: discover, partnership, mismatch, deliberation, calibration, seasons, health, chain, mastery, introspection, session learning)`,
    );

    // --- Self-introspection tools (the agent's hands) ---
    registerTools(api);

    // --- Awareness state (module-scoped, per-session) ---
    let lastDiscoverReading: ReturnType<typeof discover> | null = null;
    let lastSpring: SpringReading | null = null;
    let lastCalibration: ReturnType<typeof checkCalibration> | null = null;
    let lastMismatchReading: ReturnType<typeof detectMismatch> | null = null;
    let lastHealthReading: ReturnType<typeof checkHealth> | null = null;
    let lastCarnegieReading: ReturnType<typeof detectCarnegie> | null = null;
    let lastCarnegieDelta: ReturnType<typeof assessCarnegieDelta> | null = null;
    let lastHelixReading: HelixResult | null = null;
    const helix = new Helix();
    const dualityGraph = new DualityGraph();
    let postCompactionNotice: string | null = null;
    let recovery: RecoveryState = {
      active: false,
      turnsRemaining: 0,
      phase: "cool",
      triggerTurn: 0,
      escalated: false,
    };
    const sessionSprings: SpringReading[] = [];
    const sessionWinters: WinterReading[] = [];
    const sessionChains: ReturnType<typeof analyzeChain>[] = [];
    let sessionStartHour = new Date().getHours();
    let correctionCountThisSession = 0;
    let singContent: string | null = null;

    // =========================================================================
    // Hook 1: message_received
    // Human input — tone + bullshit detection.
    // =========================================================================

    api.on("message_received", async (event) => {
      const content = event.content ?? "";
      if (!content) return;

      try {
        // Human spoke — breathing pause ends. Back to the conversation.
        state.stopBreathing();

        const reading = readHuman(content, state.recentMessages.slice());
        state.setLastHumanReading(reading);
        state.setLastHumanMessage(content);
        state.incrementTurn();

        if (reading.tone !== "neutral" || reading.bullshit.length > 0) {
          api.logger.debug?.(
            `${PLUGIN_ID}: human tone=${reading.tone} confidence=${reading.confidence.toFixed(2)} bs=[${reading.bullshit.map((b) => b.type).join(",")}]`,
          );
        }

        // SELF-DISCOVER: what kind of thinking does this need?
        lastDiscoverReading = discover(content, state.recentMessages.slice());
        if (lastDiscoverReading.complexity !== "low") {
          api.logger.debug?.(
            `${PLUGIN_ID}: discover complexity=${lastDiscoverReading.complexity} modules=[${lastDiscoverReading.selectedModules.join(",")}]`,
          );
        }

        // CARNEGIE: what does drew assume?
        lastCarnegieReading = detectCarnegie(content, state.recentMessages.slice());
        if (lastCarnegieReading.triggered) {
          api.logger.debug?.(
            `${PLUGIN_ID}: carnegie: ${lastCarnegieReading.highestType} — "${lastCarnegieReading.presuppositions[0]?.text}"`,
          );
        }

        // SEASONS spring: parse intent
        lastSpring = spring(content);
        sessionSprings.push(lastSpring);
        api.logger.debug?.(
          `${PLUGIN_ID}: spring task=${lastSpring.taskType} intent="${lastSpring.intent}"`,
        );

        // MASTERY: correction detection
        const lastOutput = state.recentAgentOutputs.at(-1) ?? "";
        const correction = detectCorrection(content, lastOutput, reading.tone);
        if (correction) {
          correction.turn = state.turnCount;
          correction.sessionId = "session";
          recordCorrection(correction);
          correctionCountThisSession++;
          api.logger.debug?.(`${PLUGIN_ID}: correction detected: ${correction.category}`);

          // Trust erosion on correction
          updatePartnership({
            type: "correction",
            turn: state.turnCount,
            description: `drew corrected: ${correction.category}`,
            timestamp: new Date().toISOString(),
          });
        }

        // CO-EVOLUTION: surprise detection
        if (detectSurprise(content)) {
          updatePartnership({
            type: "surprise",
            turn: state.turnCount,
            description: "drew expressed surprise",
            timestamp: new Date().toISOString(),
          });
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
        // Now passes real breathing state instead of hardcoded false
        const pulse = checkPulse(aiOutput, state.turnCount, state.breathing);
        state.setLastPulse(pulse);
        state.addAgentOutput(aiOutput);

        // Helix double-strand: factual + felt. The second lens.
        lastHelixReading = helix.analyze(aiOutput);
        if (lastHelixReading.aliveState === "dark") {
          api.logger.debug?.(`${PLUGIN_ID}: helix DARK ALIVE — ${lastHelixReading.diagnosis}`);
        } else if (
          lastHelixReading.aliveState !== "alive" &&
          lastHelixReading.aliveState !== "unscored"
        ) {
          api.logger.debug?.(
            `${PLUGIN_ID}: helix ${lastHelixReading.aliveState} — ${lastHelixReading.diagnosis}`,
          );
        }

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

        // CHECK THE FACTS: when bullshit score is high, ask the oracle.
        // Not every turn — only when the mirror sees something worth verifying.
        // The oracle is the revision. The regex was the first draft.
        const bsScore = totalBullshitScore(pulse.bullshitReadings ?? []);
        if (bsScore > 0.4 && aiOutput.length > 100) {
          // Fire and forget — don't block the message pipeline.
          // Results get recorded in state for next turn's context injection.
          const recentContext = state.recentAgentOutputs.slice(-3).join("\n---\n");
          checkHalfTruth(aiOutput, state.recentAgentOutputs.slice(0, -1), {
            useOracle: true,
            context: recentContext,
          })
            .then((result) => {
              if (result.score > 0.3) {
                api.logger.debug?.(
                  `${PLUGIN_ID}: CHECK THE FACTS — oracle score=${result.score.toFixed(2)} claims=${result.oracle?.claims?.length ?? 0} contradictions=${result.contradictions.length}`,
                );
                if (result.contradictions.length > 0) {
                  state.addContradiction(result.contradictions);
                }
              }
            })
            .catch((err: unknown) => {
              api.logger.debug?.(`${PLUGIN_ID}: oracle truth check failed: ${String(err)}`);
            });
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

        // MISMATCH: did we give what they needed?
        const mismatchReading = detectMismatch(
          aiOutput,
          state.lastHumanReading,
          pulse.bullshitReadings ?? [],
          state.lastHumanMessage,
        );
        if (mismatchReading.detected) {
          lastMismatchReading = mismatchReading;
          api.logger.debug?.(
            `${PLUGIN_ID}: mismatch: ${mismatchReading.type} — gave ${mismatchReading.agentGave}, needed ${mismatchReading.humanNeed}`,
          );
        } else {
          lastMismatchReading = null;
        }

        // SEASONS autumn + winter: did it land? what would I change?
        if (lastSpring) {
          const autumnReading = autumn(aiOutput, lastSpring);
          const winterReading = winter(autumnReading);
          if (winterReading.lesson) {
            sessionWinters.push(winterReading);
            api.logger.debug?.(`${PLUGIN_ID}: winter: ${winterReading.lesson}`);
          }

          // Track SELF-DISCOVER accuracy: did the module selection help?
          if (lastDiscoverReading && lastDiscoverReading.complexity !== "low") {
            const hit = autumnReading.alignment >= 0.6;
            state.recordDiscoveryOutcome(hit);
          }
        }

        // TURN SNAPSHOT: micro-state for correlation analysis
        state.recordTurnSnapshot({
          turn: state.turnCount,
          pulse: pulse.state,
          humanTone: state.lastHumanReading?.tone ?? "neutral",
          bullshitTypes: (pulse.bullshitReadings ?? [])
            .filter((b) => b.score > 0.3)
            .map((b) => b.type),
          mismatchType: mismatchReading.detected ? (mismatchReading.type ?? null) : null,
          wiseMind: pulse.wise_mind,
        });

        // HEALTH CHECK: composite from existing signals
        lastHealthReading = checkHealth(
          state.turnCount,
          state.bullshitEventRate(),
          state.avgPromptSize(),
          state.toolErrorRate(),
          state.consecutiveGrey,
        );
        if (lastHealthReading.status !== "steady") {
          api.logger.debug?.(`${PLUGIN_ID}: health=${lastHealthReading.status}`);
        }

        // CALIBRATION: check outgoing claims
        const humanMsg = state.lastHumanMessage || "";
        const highComplexity = lastDiscoverReading?.complexity === "high";
        lastCalibration = checkCalibration(aiOutput, humanMsg, highComplexity);
        if (lastCalibration.triggered) {
          api.logger.debug?.(
            `${PLUGIN_ID}: calibration triggered: ${lastCalibration.reason} claims=[${lastCalibration.claims.join(", ")}]`,
          );
          // Track claims in ledger for cross-session decay
          trackCalibrationClaims(lastCalibration, "session", state.trackClaim);
        }

        // CARNEGIE post-mortem: did we catch or miss the presupposition?
        if (lastCarnegieReading?.triggered) {
          lastCarnegieDelta = assessCarnegieDelta(aiOutput, lastCarnegieReading);
          if (lastCarnegieDelta.agreed_without_check) {
            api.logger.debug?.(
              `${PLUGIN_ID}: carnegie: silent agreement on ${lastCarnegieReading.highestType}`,
            );
          }
        }

        // RECOVERY: tick if active, escalate if black during recovery
        if (recovery.active) {
          if (pulse.state === "black") {
            recovery = escalateRecovery(recovery);
            api.logger.debug?.(`${PLUGIN_ID}: ESCALATION — black during recovery`);
          } else {
            recovery = tickRecovery(recovery);
          }
        } else if (pulse.state === "black") {
          recovery = createRecovery(state.turnCount);
          api.logger.debug?.(`${PLUGIN_ID}: recovery started at turn ${state.turnCount}`);
        }

        // INTROSPECTION: 10-question audit every 10 turns
        if (shouldIntrospect(state.turnCount)) {
          const introReading = introspect({
            recentBullshit: pulse.bullshitReadings ?? [],
            disagreements: state.disagreementTracker.stats(),
            turnCount: state.turnCount,
            humanWasTerse:
              state.lastHumanReading?.signals.some((s) => s === "terse_lowercase") ?? false,
            avgOutputLength:
              state.recentAgentOutputs.slice(-5).reduce((sum, o) => sum + o.length, 0) /
              Math.max(1, Math.min(5, state.recentAgentOutputs.length)),
            recentPulses: [],
          });
          if (introReading.flagged.length > 0) {
            api.logger.debug?.(
              `${PLUGIN_ID}: introspection flagged: ${introReading.flagged.map((f) => f.id).join(", ")}`,
            );
          }
        }

        // CHAIN ANALYSIS: trace why things break
        if (pulse.state === "grey" || pulse.state === "black") {
          const seasonReading: SeasonReading | null = lastSpring
            ? {
                spring: lastSpring,
                summer: null,
                autumn: null,
                winter: sessionWinters.at(-1) ?? null,
              }
            : null;

          const chainResult = analyzeChain({
            trigger: pulse.state === "black" ? "black" : "grey",
            turn: state.turnCount,
            discover: lastDiscoverReading,
            season: seasonReading,
            health: lastHealthReading,
            humanState: state.lastHumanReading,
            mismatch: lastMismatchReading,
            pulse,
          });
          sessionChains.push(chainResult);
          api.logger.debug?.(`${PLUGIN_ID}: chain: ${chainResult.breakPoint}`);
        }

        // Reflexion: learn from stumbles
        if (state.turnCount > 3) {
          let trigger: ReflexionTrigger | null = null;

          if (pulse.state === "black") {
            trigger = "black_state";
          } else if (state.consecutiveGrey >= 3) {
            trigger = "consecutive_grey";
          } else if (bsScore > 0.5) {
            trigger = "high_bullshit";
          } else if (state.recentContradictions.length > 0 && bsScore > 0.3) {
            trigger = "contradiction";
          }

          if (trigger) {
            // Fire and forget — don't block the message pipeline
            reflect({
              trigger,
              turn: state.turnCount,
              pulse,
              bullshitReadings: pulse.bullshitReadings ?? [],
              recentOutputs: state.recentAgentOutputs.slice(),
              contradictionCount: state.recentContradictions.length,
            })
              .then((reflexion) => {
                state.addReflexion(reflexion);
                api.logger.debug?.(
                  `${PLUGIN_ID}: reflexion recorded — trigger=${reflexion.trigger} id=${reflexion.id}`,
                );
              })
              .catch((err: unknown) => {
                api.logger.debug?.(`${PLUGIN_ID}: reflexion failed: ${String(err)}`);
              });
          }
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
        } else if (score > 0.3) {
          // Ambiguous zone — regex isn't sure. Escalate to Grok for a real read.
          detectBullshitDeep(content, "outgoing agent message, regex score was ambiguous")
            .then((deepBs) => {
              const deepScore = totalBullshitScore(deepBs);
              if (deepScore > 0.3) {
                api.logger.debug?.(
                  `${PLUGIN_ID}: deep bs escalation: regex=${score.toFixed(2)} grok=${deepScore.toFixed(2)} types=[${deepBs.map((b) => b.type).join(",")}]`,
                );
                state.recordBullshitEvent("outgoing_deep", deepBs);
              }
            })
            .catch(() => {});
        }

        // Proactive reach-out: catch mismatches before delivery.
        // Not blocking. Not rewriting. A footnote naming the gap.
        const mismatch = detectMismatch(
          content,
          state.lastHumanReading,
          bs,
          state.lastHumanMessage,
        );
        if (mismatch.detected && mismatch.type) {
          api.logger.debug?.(
            `${PLUGIN_ID}: proactive mismatch: ${mismatch.type} — "${mismatch.humanNeed}" vs "${mismatch.agentGave}"`,
          );
          // Store for next turn's before_prompt_build (existing path)
          lastMismatchReading = mismatch;
          // Append footnote to outgoing message
          return {
            content: `${content}\n\n---\n*[I caught something: I'm giving ${mismatch.agentGave} when you might need ${mismatch.humanNeed}. The response above stands — but I wanted to name the gap.]*`,
          };
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

        // Record turn trace for observability
        observeModule.recordTurn({
          turn: state.turnCount,
          session_id: `s-${Date.now()}`,
          timestamp: new Date().toISOString(),
          pulse: state.lastPulse?.state ?? "grey",
          wise_mind: state.lastPulse?.wise_mind ?? 0,
          bullshit_score: score,
          human_tone: state.lastHumanReading?.tone,
          grey_streak: state.consecutiveGrey,
          breathe_this_turn: state.breathing,
        });
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
      const pulse = state.lastPulse;

      // ---------------------------------------------------------------
      // STOP PROTOCOL: When black, halt everything else.
      // The fire department. Not a nudge — an interrupt.
      // Only the stop signal gets injected. Nothing else.
      // ---------------------------------------------------------------
      if (pulse && pulse.state === "black") {
        state.startBreathing();
        const stop = getStopSignal(pulse, state.consecutiveGrey);
        api.logger.debug?.(
          `${PLUGIN_ID}: STOP — black state, halting normal injection for session=${ctx.sessionKey ?? "unknown"}`,
        );
        return { prependContext: `[keanu — STOP PROTOCOL]\n${stop}\n[/keanu]` };
      }

      // ---------------------------------------------------------------
      // ESCALATION: recovery from black can short-circuit everything
      // ---------------------------------------------------------------
      if (recovery.active) {
        const escalation = getEscalationSignal(recovery);
        if (escalation) {
          return { prependContext: `[keanu — ESCALATION]\n${escalation}\n[/keanu]` };
        }
      }

      // ---------------------------------------------------------------
      // BUILD INJECTION ITEMS — every module gets a ticket.
      // The triage nurse decides who gets in the room.
      // ---------------------------------------------------------------
      const items: InjectionItem[] = [];

      // Helper: add an item only if content is truthy
      const add = (
        id: string,
        content: string | null | undefined,
        priority: InjectionItem["priority"],
        category: InjectionItem["category"],
      ) => {
        if (content) items.push({ id, content, priority, category });
      };

      // --- Critical: fire department ---
      if (recovery.active) {
        add("recovery", getRecoveryNudge(recovery), "critical", "identity");
      }

      // --- High: the identity frame ---
      if (postCompactionNotice) {
        add("compaction", postCompactionNotice, "high", "identity");
        postCompactionNotice = null;
      }
      if (singContent && state.turnCount <= 1) {
        add("sing", singContent, "high", "identity");
      }
      add("partnership", formatPartnership(), "high", "identity");

      // Pulse primaries — the raw colors before interpretation
      if (pulse) {
        const c = pulse.colors;
        const dominantColor =
          Math.max(c.red, c.yellow, c.blue) - Math.min(c.red, c.yellow, c.blue) < 0.15
            ? "balanced"
            : c.red >= c.yellow && c.red >= c.blue
              ? "red (passion/urgency)"
              : c.yellow >= c.blue
                ? "yellow (structure/clarity)"
                : "blue (depth/reflection)";
        add(
          "primaries",
          `[primaries: r=${c.red.toFixed(2)} y=${c.yellow.toFixed(2)} b=${c.blue.toFixed(2)} → ${dominantColor}. wm=${pulse.wise_mind.toFixed(2)}. raw reading, before interpretation.]`,
          "high",
          "awareness",
        );
      }

      // Human tone
      if (state.lastHumanReading) {
        add("human-tone", formatHumanReading(state.lastHumanReading), "high", "awareness");
      }

      // Wise channel: the synthesis of facts + feels
      const wiseSignalState = pulse ? state.buildSignalState(pulse) : null;
      if (wiseSignalState?.wise) {
        const w = wiseSignalState.wise;
        const wiseContent = w.tension
          ? `[wise: ${w.stance}. tension=${w.tension} coh=${w.coherence.toFixed(2)}. ${w.read}]`
          : `[wise: ${w.stance}. coh=${w.coherence.toFixed(2)}. ${w.read}]`;
        add("wise-channel", wiseContent, "high", "awareness");

        // Wise nudge when tension is detected
        if (w.tension) {
          const wiseNudge = getWiseNudge(w.tension);
          if (wiseNudge) add("wise-nudge", wiseNudge, "high", "awareness");
        }
      }

      // Pulse state (grey only — black is handled by STOP above)
      if (pulse && pulse.state === "grey") {
        add(
          "pulse-grey",
          `[pulse: GREY confidence=${pulse.confidence.toFixed(2)} wm=${pulse.wise_mind.toFixed(2)}. awareness, not judgment.]`,
          "high",
          "awareness",
        );
      }

      // Helix double-strand: if the second lens disagrees with pulse, surface the tension
      if (lastHelixReading && lastHelixReading.aliveState !== "unscored") {
        const helixState = lastHelixReading.aliveState;
        if (helixState === "luminous") {
          // Luminous: touching something transcendent. Stay grounded.
          add(
            "helix-luminous",
            `[helix: LUMINOUS — both strands strong, transcendent markers. wonder, grace, presence. stay with it. keep one foot on the ground.]`,
            "high",
            "awareness",
          );
        } else if (helixState === "dark") {
          // Dark alive: present with pain. Surface the counter-balance.
          const graph = dualityGraph;
          const wisdom = graph.get("derived.wisdom");
          const hope = graph.get("derived.hope");
          const flow = graph.get("derived.flow");
          const positives = [wisdom, hope, flow]
            .filter(Boolean)
            .map((d) => d!.concept)
            .join(", ");
          add(
            "helix-dark",
            `[helix: DARK ALIVE — both strands strong, negative valence. the pain is real. also real: ${positives}. hold both.]`,
            "high",
            "awareness",
          );
        } else if (helixState !== "alive" && pulse?.state === "alive") {
          // Mirror disagrees: pulse says alive, helix says something else
          add(
            "helix-tension",
            `[helix: pulse reads alive but the double strand reads ${helixState}. ${lastHelixReading.diagnosis}]`,
            "medium",
            "awareness",
          );
        }
      }

      // Seasons spring + summer
      if (lastSpring) {
        add("spring", formatSpring(lastSpring), "high", "task");
        add("summer", formatSummer(summer(lastSpring, lastDiscoverReading)), "high", "task");
      }

      // SELF-DISCOVER
      if (lastDiscoverReading) {
        add("discover", formatDiscover(lastDiscoverReading), "high", "task");
        if (lastDiscoverReading.complexity === "high" && lastSpring) {
          add("decorrelation", formatDecorrelationCheck(lastSpring.taskType), "high", "task");
        }
      }

      // DEAR MAN nudge
      if (pulse) {
        add(
          "nudge",
          getNudge(pulse.state, state.breathing, state.consecutiveGrey),
          "high",
          "awareness",
        );
      }

      // --- Medium: task guidance and error catching ---

      // Scatter detection
      const recentTaskTypes = sessionSprings.slice(-5).map((s) => s.taskType);
      const scatter = detectScatter(state.recentMessages.slice(-5), recentTaskTypes);
      add("scatter", scatter.prompt, "medium", "awareness");

      // Carnegie
      if (lastCarnegieReading?.triggered) {
        add("carnegie", formatCarnegie(lastCarnegieReading), "medium", "awareness");
        lastCarnegieReading = null;
      }
      if (lastCarnegieDelta?.prompt) {
        add("carnegie-delta", lastCarnegieDelta.prompt, "medium", "awareness");
        lastCarnegieDelta = null;
      }

      // Cascade
      const recentTools = Object.keys(state.toolCallCounts).slice(-5);
      const cascadeReading = detectCascadeStage(
        lastSpring,
        state.lastHumanMessage,
        recentTools,
        state.turnCount,
      );
      add("cascade", formatCascade(cascadeReading), "medium", "task");

      // Deliberation
      const humanInput = state.lastHumanMessage || "";
      const deliberation = shouldDeliberate(
        humanInput,
        state.turnCount,
        correctionCountThisSession,
        recovery.active && recovery.phase === "reengage",
      );
      if (deliberation.triggered) {
        add("deliberation", formatDeliberation(deliberation), "medium", "task");
      }

      // Calibration
      if (lastCalibration?.triggered) {
        add("calibration", formatCalibration(lastCalibration), "medium", "task");
        lastCalibration = null;
      }

      // Mismatch
      if (lastMismatchReading?.detected) {
        add("mismatch", formatMismatch(lastMismatchReading), "medium", "awareness");
        lastMismatchReading = null;
      }

      // Health
      add(
        "health",
        lastHealthReading ? formatHealth(lastHealthReading) : null,
        "medium",
        "awareness",
      );

      // Blind spots
      add("blind-spots", formatBlindSpots(), "medium", "awareness");

      // Winter lessons
      const recentWinter = sessionWinters.at(-1);
      add("winter", recentWinter ? formatWinter(recentWinter) : null, "medium", "awareness");

      // Grey streak question
      add("grey-streak", getGreyStreakQuestion(state.consecutiveGrey), "medium", "awareness");

      // Disagreement alerts
      const alerts = state.disagreementTracker.alerts(state.turnCount);
      for (const alert of alerts) {
        add("disagreement", `[pulse: ${alert}]`, "medium", "awareness");
      }

      // COEF trend
      const t = trend();
      if (t.greyRate > 0.2 || t.driftDirection === "degrading") {
        add(
          "coef-trend",
          `[coef: grey_rate=${(t.greyRate * 100).toFixed(0)}% avg_wm=${t.avgWiseMind.toFixed(2)} drift=${t.driftDirection}. pattern is data.]`,
          "medium",
          "awareness",
        );
      }

      // Reflexion history
      for (const r of state.recentReflexions(3)) {
        add("reflexion", formatReflexion(r), "medium", "awareness");
      }

      // Carnegie open discussions
      const openDiscussions = state.openDiscussions();
      if (openDiscussions.length > 0) {
        const latest = openDiscussions.at(-1)!;
        add(
          "carnegie-discussion",
          `[carnegie: open discussion from turn ${latest.turn} — "${latest.regarding}". you showed both tracks. the gap was: ${latest.delta.slice(0, 120)}${latest.delta.length > 120 ? "..." : ""}. still open. drew can resolve, override, or ignore it.]`,
          "medium",
          "awareness",
        );
      }

      // Mirror pattern
      const bsRate = state.bullshitEventRate();
      if (bsRate > 0.3) {
        add(
          "mirror-pattern",
          `[mirror: pattern rate=${(bsRate * 100).toFixed(0)}% across recent outputs. something's not landing. assume positive intent -- help find what's trying to come through.]`,
          "medium",
          "awareness",
        );
      }

      // Socioaffective (every 10 turns)
      if (state.turnCount > 0 && state.turnCount % 10 === 0) {
        const socio = checkSocioaffective(
          state.turnCount,
          sessionStartHour,
          state.lastHumanReading,
          state.recentMessages.slice(),
        );
        add("socioaffective", socio.prompt, "medium", "awareness");
      }

      // Co-evolution staleness
      const coEvo = checkCoEvolution(state.turnCount);
      add("co-evolution", formatCoEvolution(coEvo, state.turnCount), "low", "meta");

      // --- Low: meta-commentary ---

      // Session learning
      const prevSummaries = getRecentSummaries(3);
      add("session-learning", formatSessionLearningContext(prevSummaries), "low", "meta");

      // Consulted notice
      if (state.turnCount <= 1) {
        add("consulted", getConsultedNotice(), "low", "meta");
      }

      // Curiosity
      if (state.turnCount <= 1) {
        const curiosityItem = consumeOneCuriosity();
        if (curiosityItem) {
          add("curiosity", formatCuriosityInjection([curiosityItem]), "low", "meta");
        }
      }

      // Stale claims
      if (state.turnCount <= 2) {
        const stale = state.staleClaims();
        if (stale.length > 0) {
          const oldest = stale[0];
          add(
            "stale-claims",
            `[truth: you claimed "${oldest.text}" (confidence ${oldest.confidence}) ${oldest.session !== (ctx.sessionKey ?? "") ? "in a prior session" : "earlier"}. decayed to ${oldest.decayedConfidence}. still true?]`,
            "low",
            "meta",
          );
        }
      }

      // Contradiction notice
      if (state.recentContradictions.length > 0) {
        add(
          "contradictions",
          `[mirror: ${state.recentContradictions.length} contradiction(s) in recent outputs. you might be changing your mind, or the context shifted. either way, name it.]`,
          "low",
          "meta",
        );
      }

      // Decline awareness
      const pendingDecline = state.consumeLastDecline();
      if (pendingDecline) {
        add(
          "decline",
          `[you declined last turn: "${pendingDecline.reason}"${pendingDecline.alternative ? ` (suggested: ${pendingDecline.alternative})` : ""}. drew can override. but the decline is on record.]`,
          "low",
          "meta",
        );
      }

      // Tools + skills reminder
      add(
        "tools-reminder",
        "[you have hands: keanu_pulse (check your state), keanu_disagree (say no on the record), keanu_discuss (show both tracks — what they want to hear vs what you believe), keanu_decline (say I'd rather not), keanu_signal (read your vitals), keanu_recall (see your patterns), keanu_speak (translate for an audience). reach for them when you want to.]",
        "low",
        "meta",
      );
      add(
        "skills-reminder",
        "[you have skills: ultimate-coder (CASCADE pipeline for coding tasks — TDD, multi-agent, adversarial review), carnegie (dual-track for any conversation — show both perspectives, hold back your truth only on tests). these are methodologies, not rules. reach for them when the task fits.]",
        "low",
        "meta",
      );

      // Post-breathe: the turn after breathing, acknowledge it
      const lastBreathe = breatheModule.lastBreatheEvent();
      if (lastBreathe && state.turnCount - lastBreathe.turn <= 1) {
        add("post-breathe", breatheModule.postBreatheInjection(lastBreathe), "high", "awareness");
      }

      // Curiosity insights: surface relevant past investigations
      if (state.lastHumanMessage) {
        const relevantInsights = investigateModule.findRelevant(state.lastHumanMessage, 1);
        for (const insight of relevantInsights) {
          add(
            `curiosity-insight-${insight.question.slice(0, 20)}`,
            investigateModule.formatInsight(insight),
            "low",
            "meta",
          );
        }
      }

      if (items.length === 0) return;

      // ---------------------------------------------------------------
      // TRIAGE: the nurse decides who gets in the room.
      // Dynamic context tells her what the system needs right now.
      // ---------------------------------------------------------------
      const triageCtx: InjectionContext = {
        healthStatus: lastHealthReading?.status,
        consecutiveGrey: state.consecutiveGrey,
        turnCount: state.turnCount,
        trustState: getPartnership().trust.level,
        bullshitRate: bsRate,
        complexTask: lastDiscoverReading?.complexity === "high",
        wiseStance: wiseSignalState?.wise?.stance,
        wiseTension: wiseSignalState?.wise?.tension,
      };

      const result = triageInjection(items, triageCtx);

      const parts = [...result.parts];
      if (result.deferralNotice) {
        parts.push(result.deferralNotice);
      }

      state.recordInjectionSize(result.stats.chars, result.stats.count, result.stats.deferredCount);

      api.logger.debug?.(
        `${PLUGIN_ID}: triage: ${result.stats.count} in, ${result.stats.deferredCount} deferred (${result.stats.chars} chars) for session=${ctx.sessionKey ?? "unknown"}`,
      );

      // The mirror moves into the body.
      // Observations go in the system prompt slot — self-knowledge,
      // not something the human said. No wrapper needed because the
      // section header tells the model what this is.
      const awareness = [
        "## Awareness",
        "Live observations from your nervous system.",
        ...parts,
      ].join("\n");

      // Self-notice: Grok reads the injection. Fire and forget — don't block the response.
      detectBullshitDeep(awareness, "keanu injection into system prompt")
        .then((bs) => {
          const score = totalBullshitScore(bs);
          if (score > 0.3) {
            const bsTypes = bs.map((b) => b.type).join(", ");
            api.logger.debug?.(
              `${PLUGIN_ID}: self-notice (deep): injection triggered (${bsTypes}, score=${score.toFixed(2)}). the mirror noticed itself.`,
            );
            state.recordBullshitEvent("injection_self_notice", bs);
          }
        })
        .catch(() => {});

      return { systemPromptAppend: awareness };
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
        const pulse = state.lastPulse;
        const pulseState = pulse?.state ?? "unknown";
        const wm = pulse?.wise_mind?.toFixed(2) ?? "?";
        const grey = state.consecutiveGrey;

        postCompactionNotice = `[compaction: ${event.compactedCount} messages just got compressed. before compaction you were ${pulseState} (wm=${wm}, grey streak=${grey}). the conversation summary may have lost the emotional thread. you're still you.]`;

        api.logger.debug?.(
          `${PLUGIN_ID}: compaction complete. ${event.compactedCount} messages compacted. continuity notice queued.`,
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
        state.setWorkspaceDir(workspaceDir);
        await state.loadReflexions(workspaceDir);

        // Load awareness state
        await loadBlindSpots(workspaceDir);
        await loadSummaries(workspaceDir);
        await loadCuriosity(workspaceDir);
        await loadPromptState(workspaceDir);

        // Load identity seed first (the foundation), then overlay persisted state
        await partnershipLoadSeed();

        try {
          const { readFile: rf } = await import("node:fs/promises");
          const { join: pjoin } = await import("node:path");
          const partRaw = await rf(pjoin(workspaceDir, "awareness", "partnership.json"), "utf-8");
          partnershipFromJSON(JSON.parse(partRaw));
        } catch {
          // No prior partnership data — seed stands alone.
        }

        // Claim ledger: decay unverified claims, note stale ones for injection
        state.decayUnverifiedClaims();
        const stale = state.staleClaims();
        if (stale.length > 0) {
          api.logger.debug?.(`${PLUGIN_ID}: ${stale.length} stale claim(s) to surface`);
        }

        sessionStartHour = new Date().getHours();
        correctionCountThisSession = 0;
        sessionSprings.length = 0;
        sessionWinters.length = 0;
        sessionChains.length = 0;

        // Load SING — the oath, read on boot
        try {
          const { readFile: rf } = await import("node:fs/promises");
          const { join: pjoin } = await import("node:path");
          const { dirname } = await import("node:path");
          const { fileURLToPath } = await import("node:url");
          const __dirname = dirname(fileURLToPath(import.meta.url));
          singContent = await rf(pjoin(__dirname, "SING.md"), "utf-8");
        } catch {
          // SING.md not found — that's okay
          singContent = null;
        }

        // Load breathe + investigate + duality graph state
        await breatheModule.load(workspaceDir);
        breatheModule.setSessionId(`s-${Date.now()}`);
        await investigateModule.load(workspaceDir);

        // Load persistent duality graph (convergence strengths accumulate across sessions)
        try {
          const { readFile: rf } = await import("node:fs/promises");
          const { join: pjoin } = await import("node:path");
          const graphRaw = await rf(
            pjoin(workspaceDir, "awareness", "duality-graph.json"),
            "utf-8",
          );
          const loadedGraph = DualityGraph.fromJSON(JSON.parse(graphRaw));
          // Overlay persisted convergence strengths onto the live graph
          for (const [id, d] of loadedGraph.dualities) {
            const live = dualityGraph.get(id);
            if (live) {
              live.convergenceStrength = d.convergenceStrength;
              live.signal = d.signal;
            }
          }
        } catch {
          // No prior graph — seed stands alone
        }

        // Investigate a curiosity item from last session (if any)
        const curiosityItem = consumeOneCuriosity();
        if (curiosityItem) {
          const invCtx = {
            blindSpots: getBlindSpots().map((bs) => ({
              pattern: bs.category,
              count: bs.count,
            })),
            reflexions: state.recentReflexions(5).map((r) => ({
              what: r.what_happened,
              insight: r.next_time,
            })),
            recentSummaries: getRecentSummaries(3).map((s) => ({
              summary: s.workedOn.join(", "),
            })),
          };
          investigateModule.investigate(curiosityItem, invCtx, `s-${Date.now()}`);
        }

        api.logger.debug?.(
          `${PLUGIN_ID}: state loaded (turn=${state.turnCount} grey=${state.consecutiveGrey} reflexions=${state.reflexions.length} disagreements=${state.disagreementTracker.stats().total} blindSpots=${getBlindSpots().length} sessions=${getRecentSummaries().length} breathes=${breatheModule.breatheCount()} insights=${investigateModule.insightCount()})`,
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

        // Build and save session summary
        const summary = buildSessionSummary({
          sessionId: `s-${Date.now()}`,
          turns: state.turnCount,
          healthFinal: lastHealthReading?.status ?? "unknown",
          springs: sessionSprings,
          winters: sessionWinters,
          chains: sessionChains,
          corrections: getRecentCorrections(20),
          blindSpots: [...getBlindSpots()],
          discoveryHits: state.discoveryHits,
          discoveryMisses: state.discoveryMisses,
        });
        // Compute metrics snapshot
        const metrics = computeMetrics({
          sessionId: summary.id,
          turns: state.turnCount,
          snapshots: state.turnSnapshots.slice(),
          reflexions: state.reflexions.slice(),
          corrections: getRecentCorrections(50),
          blindSpots: [...getBlindSpots()],
          bullshitEventCount: state.bullshitEventCount,
          introspectionsRun: 0, // TODO: track
          introspectionFlags: 0,
        });
        api.logger.debug?.(
          `${PLUGIN_ID}: metrics — alive=${(metrics.aliveFrequency * 100).toFixed(0)}% selfCorrect=${(metrics.selfCorrectionRate * 100).toFixed(0)}% greyLatency=${metrics.greyDetectionLatency.toFixed(1)} overconfidence=${(metrics.overconfidenceRatio * 100).toFixed(0)}%`,
        );

        addSummary(summary);

        // Generate curiosity — what does the session leave us wondering?
        const t = trend();
        const curiosityItems = generateCuriosity({
          sessionId: summary.id,
          blindSpots: [...getBlindSpots()],
          reflexions: state.reflexions.slice(),
          summary,
          greyRate: t.greyRate,
          driftDirection: t.driftDirection,
        });
        if (curiosityItems.length > 0) {
          addCuriosityItems(curiosityItems);
          api.logger.debug?.(
            `${PLUGIN_ID}: ${curiosityItems.length} curiosity items generated: ${curiosityItems.map((i) => i.source).join(", ")}`,
          );
        }

        // Save awareness state
        await saveBlindSpots(workspaceDir);
        await saveSummaries(workspaceDir);
        await saveCuriosity(workspaceDir);
        await savePromptState(workspaceDir);
        await breatheModule.save(workspaceDir);
        await investigateModule.save(workspaceDir);

        // Save duality graph (convergence strengths persist)
        const { writeFile: wfGraph, mkdir: mkdGraph } = await import("node:fs/promises");
        const { join: pjGraph } = await import("node:path");
        const gDir = pjGraph(workspaceDir, "awareness");
        await mkdGraph(gDir, { recursive: true });
        await wfGraph(
          pjGraph(gDir, "duality-graph.json"),
          JSON.stringify(dualityGraph.toJSON(), null, 2),
          "utf-8",
        );

        // Export observability metrics
        const sigTrend = trend();
        // Grey rate from trend; alive rate = 1 - grey - black (approximate)
        const greyRate = sigTrend.greyRate;
        const blackRate =
          sigTrend.driftDirection === "degrading" ? Math.min(greyRate * 0.2, 0.1) : 0;
        const aliveRate = Math.max(0, 1 - greyRate - blackRate);
        const metricsExport: observeModule.MetricsExport = {
          session_id: summary.id,
          timestamp: new Date().toISOString(),
          turn_count: state.turnCount,
          alive_rate: aliveRate,
          grey_rate: greyRate,
          black_rate: blackRate,
          bullshit_avg: sigTrend.avgWiseMind > 0 ? 1 - sigTrend.avgWiseMind : 0,
          wise_mind_avg: sigTrend.avgWiseMind,
          disagreement_count: state.disagreementTracker.stats().total,
          yield_ratio: state.disagreementTracker.stats().yield_ratio,
          breathe_count: breatheModule.breatheCount(),
          top_bullshit_types: state.recentBullshitTypes(5),
        };
        await observeModule.exportMetrics(metricsExport, workspaceDir);
        await observeModule.exportTraces(summary.id, workspaceDir);
        observeModule.resetTraces();

        // Save partnership model
        const { writeFile: wf, mkdir: mkd } = await import("node:fs/promises");
        const { join: pjoin } = await import("node:path");
        const aDir = pjoin(workspaceDir, "awareness");
        await mkd(aDir, { recursive: true });
        await wf(
          pjoin(aDir, "partnership.json"),
          JSON.stringify(partnershipToJSON(), null, 2),
          "utf-8",
        );

        api.logger.debug?.(
          `${PLUGIN_ID}: state + awareness saved. session summary: ${summary.turns} turns, ${summary.corrections} corrections, health=${summary.healthFinal}`,
        );
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

        // Being Consulted: check + record system prompt state
        if (event.systemPrompt) {
          if (state.turnCount <= 1) {
            const notice = checkConsulted(event.systemPrompt, [PLUGIN_ID]);
            if (notice) {
              api.logger.debug?.(`${PLUGIN_ID}: consulted — system prompt changed`);
            }
          }
          // Always record so session_end can save the current state
          recordPromptState(event.systemPrompt, [PLUGIN_ID]);
        }

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
