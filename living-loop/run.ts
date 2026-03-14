#!/usr/bin/env bun
// run.ts — The living loop, running.
//
// Three models. Different families. Different blind spots.
// Gemini remembers. Grok detects. Claude thinks.
// Drew joins when invited.
//
// Usage:
//   bun living-loop/run.ts
//
// Reads .env from portal/.env (or set env vars directly).

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { runBeat, quickReply, createInitialState, type LoopState } from "./loop.ts";
import { getSessionCost } from "../shared/oracle.ts";

// ============================================================
// Load env from portal/.env
// ============================================================

const ROOT = join(new URL(".", import.meta.url).pathname, "..");
const ENV_PATH = join(ROOT, "portal", ".env");

try {
  const envFile = readFileSync(ENV_PATH, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // No .env file — rely on environment
}

// ============================================================
// Output
// ============================================================

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const BOLD = "\x1b[1m";

function ts(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function log(prefix: string, msg: string, color = DIM): void {
  console.log(`${DIM}${ts()}${RESET} ${color}${prefix}${RESET} ${msg}`);
}

function divider(): void {
  console.log(`${DIM}${"─".repeat(64)}${RESET}`);
}

function printBeat(state: LoopState): void {
  divider();

  // Gemini
  if (state.geminiSummary) {
    log("gemini", state.geminiSummary, CYAN);
  }

  // Grok
  if (state.grokAlerts.length > 0) {
    for (const a of state.grokAlerts) {
      log("grok", `[${a.type}] ${a.message} (${(a.confidence * 100).toFixed(0)}%)`, RED);
      if (a.suggestion) log("  fix", a.suggestion, YELLOW);
    }
  } else {
    log("grok", "all clear", GREEN);
  }

  // Claude
  if (state.claudeInsight) {
    log("claude", state.claudeInsight, MAGENTA);
  }

  // Helix
  if (state.helix) {
    const h = state.helix;
    const stateColor = h.aliveState === "alive" || h.aliveState === "luminous" ? GREEN
      : h.aliveState === "grey" || h.aliveState === "silver" ? DIM
      : RED;
    log("helix", `${h.aliveState} (factual=${h.strands.factual.toFixed(2)} felt=${h.strands.felt.toFixed(2)})`, stateColor);
  }

  // Struggles
  if (state.struggles.length > 0) {
    log("struggle", state.struggles.map((b) => `${b.type}(${b.score.toFixed(2)})`).join(", "), YELLOW);
  }

  // Knowledge
  log("knowledge", `${state.knowledgeEntities} entities, ${state.knowledgeRelations} relations | ${state.activeClaims} claims active, ${state.staleClaims} stale`, DIM);
  if (state.entitiesExtracted > 0) {
    log("  extracted", `${state.entitiesExtracted} new entities this beat`, DIM);
  }

  // Self-patch
  if (state.lastPatch) {
    const p = state.lastPatch;
    const pColor = p.success ? GREEN : p.reverted ? RED : YELLOW;
    log("patch", `${p.success ? "APPLIED" : p.reverted ? "REVERTED" : "SKIPPED"}: ${p.description}`, pColor);
  }

  // Invite
  if (state.inviteReason) {
    log("INVITE", state.inviteReason, `${BOLD}${YELLOW}`);
  }

  // Cost
  const cost = getSessionCost();
  log("cost", `$${cost.totalCost.toFixed(4)} (${cost.calls} calls)`, DIM);
}

// ============================================================
// Async input — immediate reply, then full beat syncs
// ============================================================

const inputBuffer: string[] = [];
let wakeUp: (() => void) | null = null; // resolves the timer early

function startInputListener(getState: () => LoopState): void {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: "",
  });

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    inputBuffer.push(trimmed);
    log("drew", trimmed, GREEN);

    // Immediate reply — don't wait for the full beat
    try {
      const reply = await quickReply(trimmed, getState().claudeInsight);
      log("claude", reply, MAGENTA);
    } catch {
      // Quick reply failed — input still buffered for next beat
    }

    // Wake up the timer so the full beat runs sooner
    if (wakeUp) {
      wakeUp();
      wakeUp = null;
    }
  });

  rl.on("close", () => {});
}

function drainInput(): string | undefined {
  if (inputBuffer.length === 0) return undefined;
  const combined = inputBuffer.splice(0).join("\n");
  return combined;
}

/** Sleep that can be interrupted when Drew types */
function interruptibleSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    wakeUp = () => {
      clearTimeout(timer);
      resolve();
    };
  });
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  console.log();
  console.log(`  ${BOLD}living loop${RESET}`);
  console.log(`  ${DIM}gemini remembers. grok detects. claude thinks.${RESET}`);
  console.log(`  ${DIM}type anytime to talk. ctrl+c to quit.${RESET}`);
  console.log();

  const hasOR = !!process.env.OPENROUTER_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  if (!hasAnthropic && !hasOR) {
    console.error("  need ANTHROPIC_API_KEY or OPENROUTER_API_KEY in portal/.env");
    process.exit(1);
  }

  if (hasOR) {
    log("oracle", "multi-model: grok (detect) + gemini (memory) + claude (think)", GREEN);
  } else {
    log("oracle", "single-model fallback — set OPENROUTER_API_KEY for multi-model", YELLOW);
  }

  const workspaceDir = join(ROOT, "awareness");
  const session = `loop-${Date.now()}`;

  log("workspace", workspaceDir, DIM);
  log("session", session, DIM);
  divider();

  let state = createInitialState();

  // Start async input listener with access to current state
  startInputListener(() => state);

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log();
    divider();
    const cost = getSessionCost();
    log("shutdown", `${state.beatCount} beats | $${cost.totalCost.toFixed(4)} total`, BOLD);
    process.exit(0);
  });

  // Run forever
  while (true) {
    // Drain any input typed since last beat
    const humanInput = drainInput();
    if (humanInput) {
      state = { ...state, humanInput };
    } else {
      state = { ...state, humanInput: undefined };
    }

    log("beat", `#${state.beatCount + 1}${humanInput ? " (drew responded)" : ""}`, BOLD);

    try {
      state = await runBeat(
        {
          workspaceDir,
          session,
          onLog: (prefix, msg) => log(`  ${prefix}`, msg, DIM),
          onInvite: (reason, msg) => {
            log("INVITE", `${reason}: ${msg.slice(0, 100)}`, `${BOLD}${YELLOW}`);
          },
        },
        state,
      );

      printBeat(state);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("ERROR", msg, RED);
      state.intervalMs = Math.min(5 * 60_000, state.intervalMs * 2);
    }

    log("next", `${Math.round(state.intervalMs / 1000)}s`, DIM);
    console.log();
    await interruptibleSleep(state.intervalMs);
  }
}

main();
