// server.ts
// keanu's nervous system exposed as MCP tools for Claude Code.
//
// This is the bridge. Claude Code calls these tools during sessions.
// keanu observes, learns, reflects, and self-improves.
//
// When Claude Code works on keanu-core itself, this becomes recursive
// self-improvement: the nervous system improving the nervous system.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { Helix } from "../layer-0-physics/convergence/index.ts";
import type { HelixResult } from "../layer-0-physics/convergence/index.ts";
import {
  detectBullshit,
  totalBullshitScore,
  dominantBullshit,
} from "../layer-2-pattern/struggle.ts";
import type { BullshitReading } from "../shared/types.ts";
import {
  load as loadKnowledge,
  save as saveKnowledge,
  ingest,
  heal,
  findRelevant,
  stats as knowledgeStats,
  getStaleEntities,
  formatInjection,
  reset as resetKnowledge,
} from "../layer-9-memory/knowledge.ts";
import {
  checkHealth,
  formatHealth,
} from "../layer-5-self/health.ts";
import type { HealthReading } from "../layer-5-self/health.ts";
import {
  reflect,
  resetRecurrence,
  formatReflexion,
} from "../layer-5-self/reflexion.ts";
import type { ReflexionContext } from "../layer-5-self/reflexion.ts";
import type { Reflexion, ReflexionTrigger } from "../shared/types.ts";
import {
  selfPatch,
  getPatchHistory,
  savePatchHistory,
} from "../living-loop/self-patch.ts";
import type { PatchRequest, PatchResult } from "../living-loop/self-patch.ts";

// ============================================================
// Constants
// ============================================================

const WORKSPACE = process.env.KEANU_WORKSPACE ?? new URL("../awareness", import.meta.url).pathname;
const SESSION = `mcp-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}`;

const helix = new Helix();

// ============================================================
// Tool Handlers (exported for testing)
// ============================================================

export function handleObserve(input: {
  text: string;
  context?: string;
}): {
  aliveState: string;
  color: string;
  diagnosis: string;
  strands: { factual: number; felt: number; convergence: number; tension: number };
  warnings: string[];
  struggles: BullshitReading[];
  totalStruggleScore: number;
  dominantStruggle: BullshitReading | null;
  context?: string;
} {
  const helixResult: HelixResult = helix.analyze(input.text);
  const struggles = detectBullshit(input.text);
  const total = totalBullshitScore(struggles);
  const dominant = dominantBullshit(struggles);

  return {
    aliveState: helixResult.aliveState,
    color: helixResult.color,
    diagnosis: helixResult.diagnosis,
    strands: helixResult.strands,
    warnings: helixResult.warnings,
    struggles,
    totalStruggleScore: total,
    dominantStruggle: dominant,
    ...(input.context ? { context: input.context } : {}),
  };
}

export function handleLearn(input: {
  text: string;
  session?: string;
}): {
  entitiesExtracted: number;
  relationsExtracted: number;
  session: string;
  healed: { entitiesRemoved: number; relationsRemoved: number; learned: string[] };
} {
  const session = input.session ?? SESSION;
  const { entities, relations } = ingest(input.text, session);
  const healed = heal();

  return {
    entitiesExtracted: entities.length,
    relationsExtracted: relations.length,
    session,
    healed,
  };
}

export async function handleReflect(input: {
  trigger: ReflexionTrigger;
  context: string;
  turn?: number;
}): Promise<Reflexion> {
  const ctx: ReflexionContext = {
    trigger: input.trigger,
    turn: input.turn ?? 0,
    pulse: {
      state: "alive",
      confidence: 0.5,
      wise_mind: 0.5,
      colors: { red: 0.33, yellow: 0.33, blue: 0.33 },
      signals: [input.context],
      timestamp: new Date().toISOString(),
    },
    struggleReadings: [],
    recentOutputs: [input.context],
    contradictionCount: 0,
  };

  return reflect(ctx);
}

export function handleHealth(input: {
  turnCount: number;
  bullshitRate?: number;
  avgPromptSize?: number;
  toolErrorRate?: number;
  consecutiveGrey?: number;
}): HealthReading & { pacing: string | null } {
  const reading = checkHealth(
    input.turnCount,
    input.bullshitRate ?? 0,
    input.avgPromptSize ?? 10000,
    input.toolErrorRate ?? 0,
    input.consecutiveGrey ?? 0,
  );

  return reading;
}

export function handleKnowledge(input: {
  action: "search" | "stats" | "stale" | "injection";
  query?: string;
}): Record<string, unknown> {
  switch (input.action) {
    case "search": {
      const results = findRelevant(input.query ?? "", 10);
      return { action: "search", query: input.query, results };
    }
    case "stats": {
      return { action: "stats", ...knowledgeStats() };
    }
    case "stale": {
      const results = getStaleEntities();
      return { action: "stale", results };
    }
    case "injection": {
      const injection = formatInjection(input.query ?? "");
      return { action: "injection", injection };
    }
  }
}

export async function handleSelfPatch(input: {
  problem: string;
  targetFile: string;
  focus?: string;
  evidence?: string;
}): Promise<PatchResult> {
  // Pre-validate before calling selfPatch (which also validates, but we want a clear error)
  const ALLOWED_DIRS = [
    "layer-0-physics/", "layer-1-perception/", "layer-2-pattern/",
    "layer-3-causal/", "layer-4-agency/", "layer-5-self/",
    "layer-6-narrative/", "layer-7-update/", "layer-8-governance/",
    "layer-9-memory/", "living-loop/", "shared/",
  ];
  const PROTECTED_FILES = [
    "living-loop/self-patch.ts",
    "shared/oracle.ts",
  ];

  if (PROTECTED_FILES.includes(input.targetFile)) {
    return {
      success: false,
      applied: false,
      reverted: false,
      description: `Cannot modify ${input.targetFile} — protected file`,
      error: `${input.targetFile} is protected and cannot be self-patched`,
    };
  }

  if (!ALLOWED_DIRS.some((d) => input.targetFile.startsWith(d))) {
    return {
      success: false,
      applied: false,
      reverted: false,
      description: `Cannot modify ${input.targetFile} — outside allowed scope`,
      error: `${input.targetFile} is outside the allowed scope for self-patching`,
    };
  }

  const request: PatchRequest = {
    problem: input.problem,
    targetFile: input.targetFile,
    focus: input.focus,
    evidence: input.evidence,
  };

  return selfPatch(request);
}

// ============================================================
// MCP Server
// ============================================================

async function startServer(): Promise<void> {
  // Load state
  try {
    await loadKnowledge(WORKSPACE);
  } catch {
    // Fresh start — no existing knowledge graph
  }

  const server = new McpServer({
    name: "keanu",
    version: "0.1.0",
  });

  // --- keanu_observe ---
  server.tool(
    "keanu_observe",
    "Run keanu's nervous system analysis on text. Returns aliveness state (helix), struggle patterns (8 types), and warnings. Use after generating substantial output to check quality.",
    {
      text: z.string().describe("Text to analyze"),
      context: z.string().optional().describe("What this text is (e.g., 'code review', 'explanation')"),
    },
    async ({ text, context }) => ({
      content: [{ type: "text" as const, text: JSON.stringify(handleObserve({ text, context }), null, 2) }],
    }),
  );

  // --- keanu_learn ---
  server.tool(
    "keanu_learn",
    "Feed text into keanu's knowledge graph. Extracts entities, relations, and facts. Use when encountering important context about people, projects, tools, or concepts.",
    {
      text: z.string().describe("Text to learn from"),
      session: z.string().optional().describe("Session identifier (defaults to current)"),
    },
    async ({ text, session }) => {
      const result = handleLearn({ text, session });
      try {
        await saveKnowledge(WORKSPACE);
      } catch {
        // Save failure is non-fatal
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // --- keanu_reflect ---
  server.tool(
    "keanu_reflect",
    "Trigger keanu's reflexion system. Use after making a mistake, receiving a correction, or completing a task. Returns what happened, why, and what to do differently.",
    {
      trigger: z.enum([
        "high_struggle", "consecutive_grey", "black_state",
        "contradiction", "oracle_flag", "manual", "task_complete",
      ]).describe("What triggered the reflection"),
      context: z.string().describe("What happened"),
      turn: z.number().optional().describe("Approximate turn number"),
    },
    async ({ trigger, context, turn }) => {
      const result = await handleReflect({ trigger, context, turn });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // --- keanu_health ---
  server.tool(
    "keanu_health",
    "Check keanu's health state. Returns steady/warm/hot/fading with pacing advice. Use when sessions get long or outputs feel mechanical.",
    {
      turnCount: z.number().describe("Approximate turn count in current session"),
      bullshitRate: z.number().optional().describe("Recent bullshit rate (0-1)"),
      avgPromptSize: z.number().optional().describe("Average prompt size in chars"),
      toolErrorRate: z.number().optional().describe("Tool failure rate (0-1)"),
      consecutiveGrey: z.number().optional().describe("Consecutive grey state readings"),
    },
    async ({ turnCount, bullshitRate, avgPromptSize, toolErrorRate, consecutiveGrey }) => {
      const result = handleHealth({ turnCount, bullshitRate, avgPromptSize, toolErrorRate, consecutiveGrey });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // --- keanu_knowledge ---
  server.tool(
    "keanu_knowledge",
    "Query keanu's knowledge graph. Find what keanu knows about entities, relations, and context.",
    {
      action: z.enum(["search", "stats", "stale", "injection"]).describe("search=find relevant entities, stats=graph metrics, stale=fading entities, injection=format for context"),
      query: z.string().optional().describe("Entity name or text to search for (required for search/injection)"),
    },
    async ({ action, query }) => {
      const result = handleKnowledge({ action, query });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // --- keanu_self_patch ---
  server.tool(
    "keanu_self_patch",
    "DANGEROUS: Trigger keanu's self-patch system. Reads source code, asks Claude for a fix, applies it, runs tsc+vitest, auto-reverts on failure. Only use when a specific code issue has been identified and confirmed.",
    {
      problem: z.string().describe("What's broken"),
      targetFile: z.string().describe("Relative path from repo root (e.g., 'layer-9-memory/knowledge.ts')"),
      focus: z.string().optional().describe("Specific function or section to focus on"),
      evidence: z.string().optional().describe("Evidence of the problem"),
    },
    async ({ problem, targetFile, focus, evidence }) => {
      const result = await handleSelfPatch({ problem, targetFile, focus, evidence });
      try {
        await savePatchHistory(WORKSPACE);
      } catch {
        // Save failure is non-fatal
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // --- Graceful shutdown ---
  const shutdown = async () => {
    try {
      await saveKnowledge(WORKSPACE);
      await savePatchHistory(WORKSPACE);
    } catch {
      // Best effort
    }
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // --- Start ---
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only start the server when run directly (not imported for testing)
const isDirectRun = process.argv[1]?.endsWith("server.ts") ||
  process.argv[1]?.endsWith("server.js");

if (isDirectRun) {
  startServer().catch((err) => {
    console.error("MCP server failed to start:", err);
    process.exit(1);
  });
}
