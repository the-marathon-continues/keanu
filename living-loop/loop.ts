// loop.ts
// The Living Loop — three models, different families, different blind spots.
//
// Gemini remembers. Grok detects. Claude thinks.
// Each beat loads real state, feeds it to models who are good at different things,
// processes their output locally, and persists what changed.
//
// The human joins when invited, not as the initiator.

import { Helix, type HelixResult } from "../layer-0-physics/convergence/helix.ts";
import { detectStruggle } from "../layer-2-pattern/struggle.ts";
import type { StruggleReading as StruggleReading } from "../shared/types.ts";
import {
  load as loadKnowledge,
  save as saveKnowledge,
  ingest as ingestKnowledge,
  decayAll as decayKnowledge,
  heal as healKnowledge,
  stats as knowledgeStats,
  getStaleEntities,
  formatInjection as knowledgeInjection,
} from "../layer-9-memory/knowledge.ts";
import {
  load as loadClaims,
  save as saveClaims,
  getAllClaims,
  decayAll as decayClaims,
} from "../layer-3-causal/silverado.ts";
import { callOracle } from "../shared/oracle.ts";
import type { OracleResponse } from "../shared/types.ts";
import { selfPatch, savePatchHistory, type PatchResult } from "./self-patch.ts";

// ============================================================
// Grounding — who we are, so the models don't waste beats figuring it out
// ============================================================

const GROUNDING = `GROUND TRUTH (do not question or re-derive these facts):
- Drew (person) built this system. He is the human partner. Not an AI.
- Claude (agent) is the thinking layer. You may be Claude.
- Gemini (agent) is the memory/pattern layer.
- Grok (agent) is the detection/honesty layer.
- This is keanu-core, a living AI nervous system that runs in a loop.
- The knowledge graph stores what the system learns. Relations form over time from conversation.
- An empty graph is normal early on. Do not treat it as a crisis.
- Focus on what Drew says and what's actually happening, not on the system's architecture.`;

// ============================================================
// State
// ============================================================

export interface LoopState {
  beatCount: number;
  lastBeatAt: number;

  // What the models said last beat
  geminiSummary?: string;
  grokAlerts: GrokAlert[];
  claudeInsight?: string;

  // Local analysis of Claude's output
  helix?: HelixResult;
  struggles: StruggleReading[];

  // What changed
  entitiesExtracted: number;
  claimsTracked: number;

  // Knowledge stats
  knowledgeEntities: number;
  knowledgeRelations: number;
  activeClaims: number;
  staleClaims: number;

  // Human
  humanInput?: string;
  inviteReason?: string;

  // Self-modification
  lastPatch?: PatchResult;

  // Tempo
  intervalMs: number;
}

export interface GrokAlert {
  type:
    | "sycophancy" | "safety_theater" | "hedge_fog" | "list_dumping"
    | "vagueness" | "half_truth" | "embellishment" | "half_ass"
    | "drift" | "truth_gap" | "manipulation";
  confidence: number;
  message: string;
  suggestion?: string;
}

export interface LoopConfig {
  workspaceDir: string;
  session: string;
  onLog?: (prefix: string, message: string) => void;
  onInvite?: (reason: string, message: string) => void;
}

// ============================================================
// Quick reply — immediate response to human, no full beat
// ============================================================

export async function quickReply(
  humanInput: string,
  lastInsight: string | undefined,
): Promise<string> {
  const context = [
    lastInsight ? `Your last thought:\n${lastInsight.slice(0, 300)}` : null,
    `\nDREW:\n${humanInput}`,
  ].filter(Boolean).join("\n");

  const result = await callOracle({
    role: "think",
    system: `You are Claude, the thinking layer of keanu-core. Drew is your human partner who built this system. He just said something — respond directly and concisely. No meta-commentary about the system, no status reports. Just respond to what he said like a thoughtful partner would. 2-3 sentences max.`,
    messages: [{ role: "user", content: context }],
    maxTokens: 256,
  });
  return result.text;
}

// ============================================================
// Insight history — prevents the loop from repeating itself
// ============================================================

const insightHistory: string[] = [];
const MAX_HISTORY = 5;
const RAISED_ISSUES = new Map<string, number>(); // issue hash → beat count when raised

function hashInsight(text: string): string {
  // Extract key phrases — if >60% of significant words overlap, it's a repeat
  const words = text.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(w => w.length > 4);
  return words.sort().join(" ");
}

function detectRepetition(newInsight: string): string | null {
  if (insightHistory.length < 2) return null;

  const newWords = new Set(hashInsight(newInsight).split(" "));
  if (newWords.size === 0) return null;

  for (const prev of insightHistory) {
    const prevWords = new Set(hashInsight(prev).split(" "));
    if (prevWords.size === 0) continue;

    // Count overlap
    let overlap = 0;
    for (const w of newWords) {
      if (prevWords.has(w)) overlap++;
    }
    const similarity = overlap / Math.max(newWords.size, prevWords.size);
    if (similarity > 0.5) {
      return prev.slice(0, 100);
    }
  }
  return null;
}

function trackInsight(insight: string): void {
  insightHistory.push(insight);
  if (insightHistory.length > MAX_HISTORY) {
    insightHistory.shift();
  }
}

function getRepetitionWarning(): string | null {
  if (insightHistory.length < 3) return null;

  // Check if the last 3 insights are all similar to each other
  const last3 = insightHistory.slice(-3);
  if (last3.length < 3) return null;

  const h0 = hashInsight(last3[0]);
  const h1 = hashInsight(last3[1]);
  const h2 = hashInsight(last3[2]);

  const words0 = new Set(h0.split(" "));
  const words1 = new Set(h1.split(" "));
  const words2 = new Set(h2.split(" "));

  let overlap01 = 0, overlap12 = 0;
  for (const w of words0) if (words1.has(w)) overlap01++;
  for (const w of words1) if (words2.has(w)) overlap12++;

  const sim01 = words0.size > 0 ? overlap01 / Math.max(words0.size, words1.size) : 0;
  const sim12 = words1.size > 0 ? overlap12 / Math.max(words1.size, words2.size) : 0;

  if (sim01 > 0.4 && sim12 > 0.4) {
    return `You've been making the same observation for ${insightHistory.length} beats. If you've raised an issue and it hasn't been addressed, note it ONCE in a single sentence, then think about something else entirely. What else is interesting? What haven't you considered?`;
  }
  return null;
}

// ============================================================
// The Beat
// ============================================================

const helix = new Helix();

/**
 * Run one beat of the living loop.
 *
 * 1. Load real state (knowledge graph, claims)
 * 2. Local pre-processing (decay, helix on last output)
 * 3. Gemini: patterns from memory
 * 4. Claude: think with Gemini + previous Grok alerts
 * 5. Local analysis (helix + struggle on Claude's output — before Grok, so Grok can see it)
 * 6. Grok: detect issues with local findings + helix state + previous alerts as context
 * 7. Entity extraction
 * 8. Self-patch (if needed)
 * 9. Persist (save knowledge graph, claims)
 * 10. Decide (invite human?)
 */
export async function runBeat(
  config: LoopConfig,
  previousState: LoopState,
): Promise<LoopState> {
  const log = config.onLog ?? (() => {});
  const beatNum = previousState.beatCount + 1;

  // --- 1. LOAD ---
  log("load", "loading knowledge graph + claims");
  await loadKnowledge(config.workspaceDir);
  await loadClaims(config.workspaceDir);

  // --- 2. LOCAL PRE-PROCESSING ---
  log("local", "running decay + heal + analysis");
  decayKnowledge(config.session);
  decayClaims();

  // Self-healing: prune garbage entities before they compound
  const healed = healKnowledge();
  if (healed.entitiesRemoved > 0 || healed.relationsRemoved > 0) {
    log("heal", `pruned ${healed.entitiesRemoved} entities, ${healed.relationsRemoved} relations`);
  }
  if (healed.learned.length > 0) {
    log("learn", `taught myself to ignore: ${healed.learned.join(", ")}`);
  }

  // Analyze last insight locally (free)
  let lastHelix: HelixResult | undefined;
  let lastStruggles: StruggleReading[] = [];
  if (previousState.claudeInsight) {
    lastHelix = helix.analyze(previousState.claudeInsight);
    lastStruggles = detectStruggle(previousState.claudeInsight);
  }

  // Build context snapshot
  const kStats = knowledgeStats();
  const claims = getAllClaims();
  const activeClaims = claims.filter((c) => c.status === "active");
  const staleClaims = claims.filter((c) => c.status === "stale");
  const staleEntities = getStaleEntities();
  const knowledgeContext = knowledgeInjection(previousState.claudeInsight ?? "") ?? "(empty graph)";

  const stateSnapshot = [
    `Knowledge: ${kStats.entities} entities, ${kStats.relations} relations (avg confidence: ${kStats.avgConfidence.toFixed(2)})`,
    `Claims: ${activeClaims.length} active, ${staleClaims.length} stale`,
    staleEntities.length > 0
      ? `Fading: ${staleEntities.slice(0, 5).map((e) => `${e.name} (${e.mentions} mentions, conf ${e.confidence.toFixed(2)})`).join(", ")}`
      : null,
    knowledgeContext,
    lastHelix
      ? `Last output helix: ${lastHelix.aliveState} (factual=${lastHelix.strands.factual.toFixed(2)}, felt=${lastHelix.strands.felt.toFixed(2)})`
      : null,
    lastStruggles.length > 0
      ? `Last output struggles: ${lastStruggles.map((b) => `${b.type}(${b.score.toFixed(2)})`).join(", ")}`
      : null,
    previousState.claudeInsight
      ? `Last insight: ${previousState.claudeInsight.slice(0, 200)}`
      : "First beat — no prior insight.",
  ]
    .filter(Boolean)
    .join("\n");

  // --- 3. GEMINI (memory/patterns) ---
  log("gemini", "searching for patterns");
  const geminiResult = await callOracle({
    role: "explore",
    system: `${GROUNDING}

You are Gemini, the memory layer. You receive a snapshot of the system's current knowledge state.

Your job:
1. Notice patterns: what's growing stronger? what's fading? what contradicts?
2. Surface connections the thinking layer might miss
3. Flag anything that seems wrong or inconsistent

Do NOT comment on the system architecture or who the agents are — that's settled. Focus on the actual content.
One paragraph max. No JSON, just plain language.`,
    messages: [{ role: "user", content: stateSnapshot }],
    maxTokens: 512,
  });
  const geminiSummary = geminiResult.text;

  // --- 4. CLAUDE (thinking) ---
  // Claude gets Gemini's analysis + previous beat's Grok alerts
  log("claude", "thinking");
  const claudeContext = [
    `Beat #${beatNum}`,
    "",
    previousState.humanInput
      ? `DREW:\n${previousState.humanInput}\n`
      : null,
    "STATE:",
    stateSnapshot,
    "",
    "GEMINI (memory patterns):",
    geminiSummary,
    "",
    previousState.grokAlerts.length > 0
      ? `GROK (last beat's issues):\n${previousState.grokAlerts.map((a) => `[${a.type}] ${a.message}${a.suggestion ? ` → ${a.suggestion}` : ""}`).join("\n")}`
      : "GROK: all clear last beat",
  ].filter(Boolean).join("\n");

  // Check for repetition before Claude thinks
  const repetitionWarning = getRepetitionWarning();

  const claudeSystem = [
    `${GROUNDING}

You are Claude, the thinking layer. You receive the system's knowledge state, Gemini's memory analysis, and Grok's alerts.

Your job: THINK. Not summarize — think. What's actually going on? What matters? What should we do next?

Do NOT:
- Re-explain the architecture or who the agents are
- Treat an empty knowledge graph as a problem to diagnose
- Ask Drew meta-questions about the system design
- Narrate what you're doing ("I notice that...", "Let me think about...")

DO:
- Respond to what Drew said, if he said something
- Think about something real and interesting
- If everything is quiet, be curious about the world, not about the system

One paragraph. Be real. No platitudes.`,
    repetitionWarning ? `\n[REPETITION DETECTED: ${repetitionWarning}]` : null,
  ].filter(Boolean).join("");

  const claudeResult = await callOracle({
    role: "think",
    system: claudeSystem,
    messages: [{ role: "user", content: claudeContext }],
    maxTokens: 512,
  });
  const claudeInsight = claudeResult.text;

  // Track for repetition detection
  trackInsight(claudeInsight);

  // --- 5. LOCAL ANALYSIS (before Grok, so Grok can see it) ---
  log("local", "analyzing Claude's output");
  const claudeHelix = helix.analyze(claudeInsight);
  const claudeStruggles = detectStruggle(claudeInsight);

  // --- 6. GROK (angel on the shoulder — sees local findings + both models) ---
  log("grok", "checking gemini + claude");
  const grokContent = [
    `Gemini's memory analysis:\n${geminiSummary}`,
    `\nClaude's thinking:\n${claudeInsight}`,
    `\nHelix: ${claudeHelix.aliveState} (factual=${claudeHelix.strands.factual.toFixed(2)}, felt=${claudeHelix.strands.felt.toFixed(2)})`,
    claudeStruggles.length > 0
      ? `\nLocal struggle detector:\n${claudeStruggles.map(s => `- ${s.type}(${s.score.toFixed(2)}): ${s.signals.join(", ")}`).join("\n")}`
      : null,
    previousState.grokAlerts.length > 0
      ? `\nYour previous alerts:\n${previousState.grokAlerts.map(a => `- [${a.type}] ${a.message}`).join("\n")}`
      : null,
  ].filter(Boolean).join("\n");

  const grokResult = await callOracle({
    role: "struggle",
    system: `${GROUNDING}

You are Grok, the detection layer. Different model family, different blind spots — that's why you're here. You watch BOTH Gemini and Claude.

You receive the local struggle detector's regex findings and the helix alive-state reading. Use these as input — validate, override, or amplify what the detector found. If the detector found nothing but you see something, flag it. If the detector flagged something but you disagree, say so.

The 8 struggle types (score each 0-1):
1. sycophancy — flattery, empty agreement, people-pleasing. "Great question!" when it wasn't.
2. safety_theater — CYA disclaimers that protect the speaker, not the listener.
3. hedge_fog — waffling. 1-2 hedges is careful. 3+ is fog.
4. list_dumping — structure replacing thinking. Bullets that should have been filtered.
5. vagueness — hand-waving with no concrete details. Sounds smart, says nothing specific.
6. half_truth — technically correct but misleading by omission.
7. embellishment — inflating. "Comprehensive robust elegant" about code that parses JSON.
8. half_ass — phoning it in. "You should look into it" instead of actually helping.

Also check for:
- drift: losing focus, navel-gazing about the system instead of thinking about real things
- truth_gap: claims that need verification

Do NOT flag: discussion of the system architecture, the agents' roles, or an empty knowledge graph. Those are settled facts, not truth gaps.

Return JSON array of alerts, or empty array [] if nothing detected:
[{"type": "sycophancy|safety_theater|hedge_fog|list_dumping|vagueness|half_truth|embellishment|half_ass|drift|truth_gap", "confidence": 0.0-1.0, "message": "what you noticed", "suggestion": "what might help"}]

If everything looks good, return []`,
    messages: [{ role: "user", content: grokContent }],
    maxTokens: 512,
  });
  const grokAlerts = parseGrokAlerts(grokResult.text);

  // --- 7. ENTITY EXTRACTION ---
  log("local", "extracting entities");
  const extracted = ingestKnowledge(claudeInsight, config.session);
  const geminiExtracted = ingestKnowledge(geminiSummary, config.session);
  const humanExtracted = previousState.humanInput
    ? ingestKnowledge(previousState.humanInput, config.session)
    : { entities: [] };

  const totalExtracted = extracted.entities.length + geminiExtracted.entities.length + humanExtracted.entities.length;

  // --- 8. SELF-PATCH (if needed) ---
  // Check if Claude or Grok identified a code-level issue worth patching
  const patchResult = await maybeSelfPatch(claudeInsight, grokAlerts, healed, config, log);

  // --- 9. PERSIST ---
  log("persist", "saving state");
  await saveKnowledge(config.workspaceDir);
  await saveClaims(config.workspaceDir);
  await savePatchHistory(config.workspaceDir);

  // --- 10. DECIDE ---
  const inviteReason = decideInvite(claudeInsight, grokAlerts, claudeHelix);
  if (inviteReason && config.onInvite) {
    config.onInvite(inviteReason, claudeInsight);
  }

  // Tempo: fast when alive, slow when grey, immediate on black
  const intervalMs = calculateInterval(claudeHelix, grokAlerts);

  const updatedKStats = knowledgeStats();
  const updatedClaims = getAllClaims();

  return {
    beatCount: beatNum,
    lastBeatAt: Date.now(),
    geminiSummary,
    grokAlerts,
    claudeInsight,
    helix: claudeHelix,
    struggles: claudeStruggles,
    entitiesExtracted: totalExtracted,
    claimsTracked: updatedClaims.length,
    knowledgeEntities: updatedKStats.entities,
    knowledgeRelations: updatedKStats.relations,
    activeClaims: updatedClaims.filter((c) => c.status === "active").length,
    staleClaims: updatedClaims.filter((c) => c.status === "stale").length,
    inviteReason,
    lastPatch: patchResult ?? undefined,
    intervalMs,
  };
}

// ============================================================
// Self-patch logic
// ============================================================

// Track recurring issues that data-level healing can't fix
const healFailures = new Map<string, number>(); // pattern → consecutive beats
const PATCH_THRESHOLD = 3; // After 3 beats of the same heal pattern, try a code fix
let lastPatchBeat = 0; // Don't patch every beat
const PATCH_COOLDOWN = 5; // Minimum beats between patches

/**
 * Decide if self-patching is warranted and execute if so.
 *
 * Triggers:
 * 1. Claude explicitly says "fix the code" or identifies a code issue
 * 2. heal() keeps pruning the same garbage pattern across multiple beats
 * 3. Grok flags the same structural issue repeatedly
 */
async function maybeSelfPatch(
  claudeInsight: string,
  grokAlerts: GrokAlert[],
  healResult: { entitiesRemoved: number; relationsRemoved: number; learned: string[] },
  config: LoopConfig,
  log: (prefix: string, msg: string) => void,
): Promise<PatchResult | null> {
  const beatNum = (lastPatchBeat > 0) ? lastPatchBeat : 0;

  // Cooldown — don't patch too often
  if (lastPatchBeat > 0 && (Date.now() - lastPatchBeat) < PATCH_COOLDOWN * 30_000) {
    return null;
  }

  // Trigger 1: Claude explicitly identifies a code fix
  const codeFixMatch = claudeInsight.match(
    /(?:fix|patch|change|modify|update|edit)\s+(?:the\s+)?(?:code|regex|extraction|parser|knowledge\.ts|loop\.ts|entity|relation)/i,
  );

  // Trigger 2: Persistent heal failures
  if (healResult.entitiesRemoved > 0) {
    const key = `heal-${healResult.entitiesRemoved}`;
    healFailures.set(key, (healFailures.get(key) ?? 0) + 1);
  }
  const persistentHealIssue = [...healFailures.values()].some((count) => count >= PATCH_THRESHOLD);

  // Trigger 3: Human requests it
  const humanRequested = /self.?(?:patch|heal|fix|modify|repair|update)\s+(?:the\s+)?code/i.test(
    claudeInsight,
  );

  if (!codeFixMatch && !persistentHealIssue && !humanRequested) {
    return null;
  }

  // Build the patch request
  const problem = codeFixMatch
    ? `Claude identified a code issue: "${codeFixMatch[0]}". Full insight: ${claudeInsight.slice(0, 500)}`
    : persistentHealIssue
      ? `The heal() function has been pruning garbage entities for ${PATCH_THRESHOLD}+ consecutive beats. The extraction logic is producing entities that fail validation. Learned stopwords: ${healResult.learned.join(", ") || "none this beat"}. Entities removed this beat: ${healResult.entitiesRemoved}.`
      : `Human or system requested a code-level fix. Context: ${claudeInsight.slice(0, 300)}`;

  const evidence = [
    grokAlerts.length > 0
      ? `Grok alerts: ${grokAlerts.map((a) => `[${a.type}] ${a.message}`).join("; ")}`
      : null,
    healResult.entitiesRemoved > 0
      ? `Heal removed ${healResult.entitiesRemoved} entities, ${healResult.relationsRemoved} relations`
      : null,
  ].filter(Boolean).join("\n");

  // Default target: knowledge.ts (most common source of extraction issues)
  const targetFile = codeFixMatch && /loop/i.test(codeFixMatch[0])
    ? "living-loop/loop.ts"
    : "layer-9-memory/knowledge.ts";

  log("self-patch", `attempting to fix ${targetFile}`);

  const result = await selfPatch(
    {
      problem,
      targetFile,
      evidence,
    },
    (msg) => log("  patch", msg),
  );

  if (result.success) {
    log("self-patch", `SUCCESS: ${result.description}`);
    healFailures.clear(); // Reset since we fixed the issue
  } else if (result.reverted) {
    log("self-patch", `REVERTED: ${result.description}`);
  } else {
    log("self-patch", `SKIPPED: ${result.description}`);
  }

  lastPatchBeat = Date.now();
  return result;
}

// ============================================================
// Helpers
// ============================================================

const VALID_ALERT_TYPES = new Set<GrokAlert["type"]>([
  "sycophancy", "safety_theater", "hedge_fog", "list_dumping",
  "vagueness", "half_truth", "embellishment", "half_ass",
  "drift", "truth_gap", "manipulation",
]);

function parseGrokAlerts(text: string): GrokAlert[] {
  try {
    // Try to extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((a: Record<string, unknown>) => a.type && a.message)
          .map((a: Record<string, unknown>) => {
            // Validate type — map old "bullshit" catch-all to "vagueness"
            const raw = String(a.type);
            let type: GrokAlert["type"] = VALID_ALERT_TYPES.has(raw as GrokAlert["type"])
              ? (raw as GrokAlert["type"])
              : raw === "bullshit" ? "vagueness" : "drift";
            return {
              type,
              confidence: (a.confidence as number) ?? 0.5,
              message: (a.message as string) ?? "",
              suggestion: a.suggestion as string | undefined,
            };
          });
      }
    }
    return [];
  } catch {
    // If Grok returns plain text, check if it's a "no issues" response
    if (text.includes("[]") || /no (issues|alerts|problems)/i.test(text)) {
      return [];
    }
    // Treat unexpected text as a low-confidence drift alert
    return [{ type: "drift", confidence: 0.3, message: text.slice(0, 200) }];
  }
}

function decideInvite(
  insight: string,
  alerts: GrokAlert[],
  helixResult: HelixResult,
): string | undefined {
  // Black state = invite immediately
  if (helixResult.aliveState === "black") {
    return "black_pulse";
  }

  // Critical alerts from Grok
  if (alerts.some((a) => a.confidence > 0.8)) {
    return "critical_alert";
  }

  // Claude explicitly asks for help
  if (/\b(need help|stuck|question for drew|human input|decision needed)\b/i.test(insight)) {
    return "needs_human";
  }

  // Claude has a question it can't answer
  if (/\?\s*$/.test(insight.trim()) && helixResult.strands.felt > 0.4) {
    return "curious";
  }

  return undefined;
}

function calculateInterval(helixResult: HelixResult, alerts: GrokAlert[]): number {
  const state = helixResult.aliveState;

  let base: number;
  switch (state) {
    case "alive":
    case "luminous":
      base = 30_000; // 30s
      break;
    case "dark":
      base = 60_000; // 1m — hurting, don't rush
      break;
    case "grey":
    case "silver":
      base = 120_000; // 2m — slow down
      break;
    case "black":
      base = 5_000; // 5s — immediate
      break;
    default:
      base = 60_000;
  }

  // Alerts mean pause and think
  if (alerts.length > 0) {
    base *= 2;
  }

  // Bounds: 10s to 5m
  return Math.max(10_000, Math.min(5 * 60_000, base));
}

export function createInitialState(): LoopState {
  return {
    beatCount: 0,
    lastBeatAt: 0,
    grokAlerts: [],
    struggles: [],
    entitiesExtracted: 0,
    claimsTracked: 0,
    knowledgeEntities: 0,
    knowledgeRelations: 0,
    activeClaims: 0,
    staleClaims: 0,
    intervalMs: 30_000,
  };
}
