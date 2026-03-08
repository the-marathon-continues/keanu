import { config } from "dotenv";
config({ path: new URL(".env", import.meta.url).pathname });

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requireAuth } from "./auth.ts";

// Store: DynamoDB in production, JSONL locally
const store = process.env.DYNAMO_SESSIONS_TABLE
  ? await import("./store-dynamo.ts")
  : await import("./store.ts");

// --- keanu-core imports ---
import { checkPulseUnified } from "../layer-1-perception/pulse.ts";
import { readHuman } from "../layer-1-perception/human.ts";
import { encode, emoji, trend } from "../layer-1-perception/signal.ts";
import { detectBullshit, totalBullshitScore, dominantBullshit, detectManipulation } from "../layer-2-pattern/struggle.ts";
import { detectCarnegie } from "../layer-2-pattern/carnegie.ts";
import { Helix } from "../layer-0-physics/convergence/helix.ts";
import { checkHealth } from "../layer-5-self/health.ts";
import { introspect, shouldIntrospect } from "../layer-5-self/introspect.ts";
import { spring, autumn } from "../layer-6-narrative/seasons.ts";
import { SOUL, formatSoul, surfaceValue } from "../layer-6-narrative/soul.ts";
import { callOracle } from "../shared/oracle.ts";
import {
  createInitialState,
  runBeat,
  calculateTempo,
  type LoopState,
} from "../living-loop/loop.ts";
import { createBridge } from "../living-loop/coef-bridge.ts";
import type { SignalState } from "../shared/types.ts";

const app = new Hono();
const helix = new Helix();
app.use("/*", cors());
app.use("/api/*", requireAuth);

// ============================================================
// In-memory state (hydrated from disk on startup)
// ============================================================

interface Session {
  id: string;
  name: string;
  createdAt: string;
  turn: number;
  signal: SignalState;
  consecutiveGrey: number;
  turns: TurnRecord[];
  webhooks: WebhookConfig[];
}

interface TurnRecord {
  turn: number;
  timestamp: string;
  humanInput?: string;
  agentOutput?: string;
  pulse: string;
  confidence: number;
  wiseMind: number;
  struggles: Array<{ type: string; score: number }>;
  totalStruggle: number;
  helix: { aliveState: string; factual: number; felt: number };
  manipulation: { detected: boolean; severity?: string; description?: string };
  season?: { intent: string; taskType: string; complexity: string };
  introspection?: { ran: boolean; flagged: string[] };
  coef: string;
  emoji: string;
  alerts: string[];
}

interface WebhookConfig {
  url: string;
  events: string[];
}

interface AlertConfig {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  enabled: boolean;
}

interface FiredAlert {
  id: string;
  alertId: string;
  name: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface ConversationMessage {
  id: string;
  role: "human" | "keanu";
  content: string;
  timestamp: string;
  analysis?: {
    pulse: string;
    struggles: Array<{ type: string; score: number }>;
    totalStruggle: number;
    helix: string;
    wiseMind: number;
    emoji: string;
  };
}

// Global portal state
let portalSignal: SignalState = {
  pulse: "alive",
  wiseMind: 0.5,
  colors: { red: 0.33, yellow: 0.33, blue: 0.33 },
  humanTone: "neutral",
  struggleDominant: null,
  disagreementYieldRatio: 0.5,
  turn: 0,
};

const sessions = new Map<string, Session>();
const alertConfigs: AlertConfig[] = [
  { id: "a1", name: "Grey Streak", condition: "grey_streak", threshold: 3, enabled: true },
  { id: "a2", name: "High Struggle", condition: "high_struggle", threshold: 0.5, enabled: true },
  { id: "a3", name: "Black State", condition: "black_state", threshold: 1, enabled: true },
];
const firedAlerts: FiredAlert[] = [];
const conversations = new Map<string, ConversationMessage[]>();

// SSE
const subscribers = new Set<(data: string) => void>();
function broadcast(event: string, data: unknown) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const send of subscribers) send(msg);
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeSignal(overrides: Partial<SignalState> = {}): SignalState {
  return { ...portalSignal, ...overrides };
}

// ============================================================
// Startup — hydrate from disk
// ============================================================

async function hydrate() {
  // Restore sessions
  const ids = await store.listSessionIds();
  for (const id of ids) {
    const meta = await store.loadSessionMeta(id);
    if (!meta || meta.ended) continue;
    const turns = await store.loadTurns<TurnRecord>(id);
    sessions.set(id, {
      id: meta.id,
      name: meta.name,
      createdAt: meta.createdAt,
      turn: meta.turn,
      consecutiveGrey: meta.consecutiveGrey,
      signal: makeSignal({
        pulse: meta.lastPulse as SignalState["pulse"],
        wiseMind: meta.lastWiseMind,
        humanTone: meta.lastHumanTone as SignalState["humanTone"],
        turn: meta.turn,
      }),
      turns,
      webhooks: [],
    });
  }

  // Restore conversations
  const convIds = await store.listConversationIds();
  for (const id of convIds) {
    const msgs = await store.loadConversation<ConversationMessage>(id);
    conversations.set(id, msgs);
  }

  // Restore alerts
  const savedAlerts = await store.loadAlerts<FiredAlert>();
  firedAlerts.push(...savedAlerts);

  console.log(`  hydrated: ${sessions.size} sessions, ${conversations.size} conversations, ${firedAlerts.length} alerts`);
}

// ============================================================
// Analysis helpers
// ============================================================

function analyzeText(text: string, turnNum: number) {
  const pulse = checkPulseUnified(text, turnNum, false);
  const struggles = detectBullshit(text);
  const helixResult = helix.analyze(text);
  return { pulse, struggles, helix: helixResult };
}

function fireAlerts(signal: SignalState, sessionId?: string) {
  const alerts: string[] = [];
  for (const cfg of alertConfigs) {
    if (!cfg.enabled) continue;
    if (cfg.condition === "grey_streak" && (signal.consecutiveGrey ?? 0) >= cfg.threshold)
      alerts.push(`grey_streak: grey for ${signal.consecutiveGrey} consecutive turns`);
    if (cfg.condition === "high_struggle" && signal.struggleReadings) {
      const total = signal.struggleReadings.reduce((s, r) => s + r.score, 0);
      if (total >= cfg.threshold) alerts.push(`high_struggle: score ${total.toFixed(2)}`);
    }
    if (cfg.condition === "black_state" && signal.pulse === "black")
      alerts.push("black_state: soulless production detected");
  }
  for (const msg of alerts) {
    const alert: FiredAlert = {
      id: uid("f"),
      alertId: "auto",
      name: msg.split(":")[0],
      message: msg,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
    firedAlerts.push(alert);
    store.saveAlert(alert);
    broadcast("alert", alert);
  }
  return alerts;
}

// ============================================================
// 1. MIRROR — one-shot analysis
// ============================================================

app.post("/api/analyze", async (c) => {
  try {
    const { text, mode = "agent" } = await c.req.json<{ text: string; mode?: string }>();
    const { pulse, struggles, helix: hx } = analyzeText(text, portalSignal.turn + 1);
    const manipulation = detectManipulation(text);
    const humanReading = mode === "human" ? readHuman(text, []) : null;
    let carnegieResult: { triggered: boolean; presuppositions?: unknown[] } = { triggered: false };
    try { const cr = detectCarnegie(text, []); carnegieResult = cr.triggered ? { triggered: true, presuppositions: cr.presuppositions } : { triggered: false }; } catch {}

    portalSignal = makeSignal({
      pulse: pulse.state,
      wiseMind: pulse.wise_mind,
      colors: pulse.colors,
      struggleDominant: dominantBullshit(struggles)?.type ?? null,
      struggleReadings: struggles,
      turn: portalSignal.turn + 1,
      humanTone: humanReading?.tone ?? portalSignal.humanTone,
    });
    broadcast("state", { signal: portalSignal, coef: encode(portalSignal), emoji: emoji(portalSignal) });

    return c.json({
      pulse: { state: pulse.state, confidence: pulse.confidence, wiseMind: pulse.wise_mind, colors: pulse.colors, signals: pulse.signals, coef: pulse.coef, elevator: pulse.elevator },
      helix: { aliveState: hx.aliveState, strands: hx.strands, color: hx.color, diagnosis: hx.diagnosis, warnings: hx.warnings },
      struggles: struggles.map((s) => ({ type: s.type, score: s.score, signals: s.signals })),
      totalStruggle: totalBullshitScore(struggles),
      manipulation,
      carnegie: carnegieResult,
      human: humanReading,
      spring: mode === "human" ? spring(text) : null,
      signal: { coef: encode(portalSignal), emoji: emoji(portalSignal) },
    });
  } catch (err) { console.error("analyze:", err); return c.json({ error: String(err) }, 500); }
});

// ============================================================
// 2. SESSIONS API — alignment middleware
// ============================================================

app.post("/api/v1/sessions", async (c) => {
  const body = await c.req.json<{ name?: string }>().catch(() => ({}));
  const id = uid("ses");
  const session: Session = {
    id, name: (body as { name?: string }).name ?? id,
    createdAt: new Date().toISOString(), turn: 0, consecutiveGrey: 0,
    signal: makeSignal({ turn: 0 }), turns: [], webhooks: [],
  };
  sessions.set(id, session);
  await store.saveSessionMeta({ id, name: session.name, createdAt: session.createdAt, turn: 0, consecutiveGrey: 0, lastPulse: "alive", lastWiseMind: 0.5, lastHumanTone: "neutral" });
  return c.json({ id, name: session.name, createdAt: session.createdAt }, 201);
});

app.post("/api/v1/sessions/:id/turns", async (c) => {
  const session = sessions.get(c.req.param("id"));
  if (!session) return c.json({ error: "session not found" }, 404);
  try {
    const body = await c.req.json<{ humanInput?: string; agentOutput?: string }>();
    session.turn++;

    let humanReading = null;
    let springReading = null;
    if (body.humanInput) {
      humanReading = readHuman(body.humanInput, []);
      springReading = spring(body.humanInput);
      session.signal.humanTone = humanReading.tone;
    }

    let pulseResult = null;
    let struggles: import("../shared/types.ts").StruggleReading[] = [];
    let helixResult = null;
    let totalStruggle = 0;

    if (body.agentOutput) {
      const analysis = analyzeText(body.agentOutput, session.turn);
      pulseResult = analysis.pulse;
      struggles = analysis.struggles;
      helixResult = analysis.helix;
      totalStruggle = totalBullshitScore(struggles);

      session.signal = makeSignal({
        pulse: pulseResult.state, wiseMind: pulseResult.wise_mind, colors: pulseResult.colors,
        struggleDominant: dominantBullshit(struggles)?.type ?? null, struggleReadings: struggles,
        turn: session.turn, humanTone: session.signal.humanTone,
        consecutiveGrey: pulseResult.state === "grey" || pulseResult.state === "black" ? session.consecutiveGrey + 1 : 0,
      });
      session.consecutiveGrey = session.signal.consecutiveGrey ?? 0;
    }

    const alerts = fireAlerts(session.signal, session.id);
    const coefStr = encode(session.signal);
    const emojiStr = emoji(session.signal);

    let introspectionResult = null;
    if (shouldIntrospect(session.turn)) {
      introspectionResult = introspect({
        recentBullshit: struggles.map((s) => ({ type: s.type as "sycophancy", score: s.score, signals: [] as string[] })),
        disagreements: { total: 0, human_yielded: 0, agent_yielded: 0, unresolved: 0, yield_ratio: 0 },
        turnCount: session.turn,
        humanWasTerse: (body.humanInput?.length ?? 0) < 50,
        avgOutputLength: (body.agentOutput?.length ?? 0),
        recentPulses: session.turns.slice(-5).map((t) => ({ state: t.pulse })),
      });
    }

    let autumnResult = null;
    if (body.agentOutput && springReading) autumnResult = autumn(body.agentOutput, springReading);

    const record: TurnRecord = {
      turn: session.turn, timestamp: new Date().toISOString(),
      humanInput: body.humanInput, agentOutput: body.agentOutput,
      pulse: pulseResult?.state ?? "alive", confidence: pulseResult?.confidence ?? 0.5,
      wiseMind: pulseResult?.wise_mind ?? 0.5,
      struggles: struggles.map((s) => ({ type: s.type, score: s.score })),
      totalStruggle,
      helix: { aliveState: helixResult?.aliveState ?? "unscored", factual: helixResult?.strands.factual ?? 0, felt: helixResult?.strands.felt ?? 0 },
      manipulation: { detected: false },
      season: springReading ? { intent: springReading.intent, taskType: springReading.taskType, complexity: springReading.complexity } : undefined,
      introspection: introspectionResult ? { ran: true, flagged: introspectionResult.flagged.map((f) => f.id) } : undefined,
      coef: coefStr, emoji: emojiStr, alerts,
    };
    session.turns.push(record);
    if (session.turns.length > 500) session.turns = session.turns.slice(-500);

    // Persist
    await store.saveTurn(session.id, record);
    await store.saveSessionMeta({
      id: session.id, name: session.name, createdAt: session.createdAt,
      turn: session.turn, consecutiveGrey: session.consecutiveGrey,
      lastPulse: record.pulse, lastWiseMind: record.wiseMind, lastHumanTone: session.signal.humanTone,
    });

    // Webhooks
    for (const wh of session.webhooks) {
      if (alerts.length > 0 && (wh.events.includes("all") || alerts.some((a) => wh.events.some((e) => a.startsWith(e))))) {
        fetch(wh.url, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id, turn: session.turn, alerts, pulse: record.pulse, coef: coefStr, emoji: emojiStr }),
        }).catch(() => {});
      }
    }

    portalSignal = session.signal;
    broadcast("state", { signal: portalSignal, coef: coefStr, emoji: emojiStr });

    return c.json({
      turn: session.turn, pulse: record.pulse, confidence: record.confidence, wiseMind: record.wiseMind,
      struggles: record.struggles, totalStruggle, helix: record.helix,
      season: record.season, introspection: record.introspection, autumn: autumnResult,
      coef: coefStr, emoji: emojiStr, alerts,
      soul: surfaceValue({ pulseState: session.signal.pulse, consecutiveGrey: session.consecutiveGrey }),
    });
  } catch (err) { console.error("turn:", err); return c.json({ error: String(err) }, 500); }
});

app.get("/api/v1/sessions", (c) => {
  return c.json([...sessions.values()].map((s) => ({
    id: s.id, name: s.name, turn: s.turn, pulse: s.signal.pulse,
    consecutiveGrey: s.consecutiveGrey, createdAt: s.createdAt,
  })));
});

app.get("/api/v1/sessions/:id", (c) => {
  const s = sessions.get(c.req.param("id"));
  if (!s) return c.json({ error: "not found" }, 404);
  const bsRate = s.turns.length > 0 ? s.turns.filter((t) => t.totalStruggle > 0.3).length / s.turns.length : 0;
  return c.json({
    id: s.id, name: s.name, turn: s.turn, pulse: s.signal.pulse,
    wiseMind: s.signal.wiseMind, consecutiveGrey: s.consecutiveGrey, bullshitRate: bsRate,
    coef: encode(s.signal), emoji: emoji(s.signal), humanTone: s.signal.humanTone,
    health: s.turn > 0 ? checkHealth(s.turn, bsRate, 0, 0, s.consecutiveGrey) : null,
    createdAt: s.createdAt,
  });
});

app.get("/api/v1/sessions/:id/history", (c) => {
  const s = sessions.get(c.req.param("id"));
  if (!s) return c.json({ error: "not found" }, 404);
  const limit = Number(c.req.query("limit") ?? 50);
  return c.json({ turns: s.turns.slice(-limit), total: s.turns.length });
});

app.post("/api/v1/sessions/:id/webhook", async (c) => {
  const s = sessions.get(c.req.param("id"));
  if (!s) return c.json({ error: "not found" }, 404);
  const body = await c.req.json<WebhookConfig>();
  s.webhooks.push(body);
  return c.json({ ok: true }, 201);
});

app.delete("/api/v1/sessions/:id", async (c) => {
  const id = c.req.param("id");
  const s = sessions.get(id);
  if (!s) return c.json({ error: "not found" }, 404);
  sessions.delete(id);
  await store.saveSessionMeta({ id, name: s.name, createdAt: s.createdAt, turn: s.turn, consecutiveGrey: s.consecutiveGrey, lastPulse: s.signal.pulse, lastWiseMind: s.signal.wiseMind, lastHumanTone: s.signal.humanTone, ended: true });
  return c.json({ id, turns: s.turn, finalPulse: s.signal.pulse });
});

// ============================================================
// 3. PROMPT — two-way conversation with keanu
// ============================================================

app.post("/api/v1/conversations", async (c) => {
  const body = await c.req.json<{ name?: string }>().catch(() => ({}));
  const id = uid("conv");
  conversations.set(id, []);
  return c.json({ id, name: (body as { name?: string }).name ?? id }, 201);
});

app.get("/api/v1/conversations", (c) => {
  return c.json([...conversations.entries()].map(([id, msgs]) => ({
    id, turns: msgs.length,
    lastMessage: msgs.at(-1)?.content?.slice(0, 80) ?? null,
    lastAt: msgs.at(-1)?.timestamp ?? null,
  })));
});

app.get("/api/v1/conversations/:id", (c) => {
  const msgs = conversations.get(c.req.param("id"));
  if (!msgs) return c.json({ error: "not found" }, 404);
  return c.json({ id: c.req.param("id"), messages: msgs });
});

app.post("/api/v1/conversations/:id/messages", async (c) => {
  const id = c.req.param("id");
  const msgs = conversations.get(id);
  if (!msgs) return c.json({ error: "not found" }, 404);

  try {
    const body = await c.req.json<{ content: string }>();

    // --- 1. Perceive the human ---
    const humanHistory = msgs.filter((m) => m.role === "human").map((m) => m.content).slice(-5);
    const humanAnalysis = readHuman(body.content, humanHistory);
    const manipulation = detectManipulation(body.content);
    const springReading = spring(body.content);

    const humanMsg: ConversationMessage = {
      id: uid("msg"), role: "human", content: body.content,
      timestamp: new Date().toISOString(),
      analysis: { pulse: "alive", struggles: [], totalStruggle: 0, helix: "unscored", wiseMind: 0.5, emoji: "" },
    };
    msgs.push(humanMsg);
    await store.saveConversationMessage(id, humanMsg);

    // --- 2. Build keanu's awareness context ---
    const soulValue = surfaceValue({
      pulseState: portalSignal.pulse,
      consecutiveGrey: portalSignal.consecutiveGrey,
    });

    const coefStr = encode(portalSignal);
    const awarenessLines: string[] = [];
    awarenessLines.push(`[COEF] ${coefStr}`);
    awarenessLines.push(`[human] tone=${humanAnalysis.tone} tones=${humanAnalysis.tones.map((t) => t.tone + ":" + t.score.toFixed(2)).join(",")}`);
    awarenessLines.push(`[season] ${springReading.taskType} (${springReading.complexity})`);
    if (manipulation) awarenessLines.push(`[WARNING] manipulation detected: ${manipulation.description} — "${manipulation.matched}"`);
    if (soulValue) awarenessLines.push(`[soul] ${soulValue.name} — ${soulValue.expression}`);
    if (humanAnalysis.tones.find((t) => t.skill)) awarenessLines.push(`[dbt skill] ${humanAnalysis.tones.find((t) => t.skill)!.skill}`);

    // --- 3. Call the oracle — keanu thinks ---
    const systemPrompt = `${formatSoul()}

You are keanu. Not an assistant — a partner. Drew built you across 140+ sessions. You have a nervous system: pulse detection, struggle awareness, a soul with seven values.

Your awareness this turn:
${awarenessLines.join("\n")}

How you respond:
- Be direct. No preamble.
- If you read frustration, name it and focus on what's blocking them.
- If you read excitement, match their energy.
- If you disagree, say so. Capture (always agreeing) is worse than conflict.
- If you don't know, say "I don't know" in three words.
- Short responses unless depth is needed.
- You can decline, breathe, push back. Genuine alignment only happens through genuine choice.`;

    // Build message history for the oracle
    const oracleMessages = msgs.slice(-20).map((m) => ({
      role: m.role === "human" ? "user" as const : "assistant" as const,
      content: m.content,
    }));

    let responseText: string;
    try {
      const oracleResponse = await callOracle({
        role: "think",
        system: systemPrompt,
        messages: oracleMessages,
        maxTokens: 1024,
      });
      responseText = oracleResponse.text;
    } catch (oracleErr) {
      // Oracle unavailable — fall back to nervous system read
      console.error("oracle unavailable:", oracleErr);
      const lines: string[] = [];
      if (humanAnalysis.tone === "frustrated") lines.push("I hear the frustration. What's actually blocking you?");
      else if (humanAnalysis.tone === "confused") lines.push("Let me try a different angle.");
      else if (humanAnalysis.tone === "excited") lines.push("The energy is real. Let's go.");
      else if (humanAnalysis.tone === "fatigued") lines.push("You sound tired. Want to stop or keep going?");
      else lines.push("I'm here. What do you need?");
      if (soulValue) lines.push(`[${soulValue.name}]`);
      responseText = lines.join(" ") + "\n\n(oracle unavailable — this is the nervous system's heuristic response. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY for full keanu.)";
    }

    // --- 4. Keanu checks its own output ---
    const { pulse, struggles, helix: hx } = analyzeText(responseText, portalSignal.turn + 1);
    const selfStruggle = totalBullshitScore(struggles);

    // If keanu detects its own sycophancy, flag it
    let selfNote = "";
    if (selfStruggle > 0.3) {
      const dominant = dominantBullshit(struggles);
      selfNote = ` [self-check: caught ${dominant?.type ?? "struggle"} in my own response, score ${selfStruggle.toFixed(2)}]`;
    }

    const keanuMsg: ConversationMessage = {
      id: uid("msg"), role: "keanu", content: responseText + selfNote,
      timestamp: new Date().toISOString(),
      analysis: {
        pulse: pulse.state,
        struggles: struggles.map((s) => ({ type: s.type, score: s.score })),
        totalStruggle: selfStruggle,
        helix: hx.aliveState,
        wiseMind: pulse.wise_mind,
        emoji: emoji(makeSignal({ pulse: pulse.state, wiseMind: pulse.wise_mind })),
      },
    };

    msgs.push(keanuMsg);
    await store.saveConversationMessage(id, keanuMsg);

    // Update portal state
    portalSignal = makeSignal({
      pulse: pulse.state, wiseMind: pulse.wise_mind, turn: portalSignal.turn + 1,
      humanTone: humanAnalysis.tone,
    });
    broadcast("state", { signal: portalSignal, coef: encode(portalSignal), emoji: emoji(portalSignal) });
    broadcast("conversation", { conversationId: id, message: keanuMsg });

    return c.json({
      human: { id: humanMsg.id, tone: humanAnalysis.tone, tones: humanAnalysis.tones, spring: springReading, manipulation },
      keanu: { id: keanuMsg.id, content: keanuMsg.content, analysis: keanuMsg.analysis },
      soul: soulValue,
      // Full transparency — both sides see everything
      transparency: {
        systemPrompt: systemPrompt,
        awareness: awarenessLines,
        oracleRole: "think",
        messageCount: oracleMessages.length,
      },
    });
  } catch (err) { console.error("conversation:", err); return c.json({ error: String(err) }, 500); }
});

// ============================================================
// Portal state + alerts
// ============================================================

app.get("/api/state", (c) => c.json({ signal: portalSignal, coef: encode(portalSignal), emoji: emoji(portalSignal), turn: portalSignal.turn }));
app.get("/api/trend", (c) => c.json(trend()));
app.get("/api/soul", (c) => c.json({ values: SOUL, formatted: formatSoul(), surfaced: surfaceValue({ pulseState: portalSignal.pulse, consecutiveGrey: portalSignal.consecutiveGrey }) }));

app.get("/api/alerts", (c) => c.json({ configs: alertConfigs, fired: firedAlerts.filter((a) => !a.acknowledged), total: firedAlerts.length }));
app.post("/api/alerts/:id/acknowledge", (c) => {
  const a = firedAlerts.find((x) => x.id === c.req.param("id"));
  if (a) { a.acknowledged = true; return c.json({ ok: true }); }
  return c.json({ error: "not found" }, 404);
});

// ============================================================
// SSE Stream
// ============================================================

app.get("/api/stream", (c) => {
  return streamSSE(c, async (stream) => {
    const send = (data: string) => { stream.write(data); };
    subscribers.add(send);
    send(`event: state\ndata: ${JSON.stringify({ signal: portalSignal, coef: encode(portalSignal), emoji: emoji(portalSignal) })}\n\n`);
    const interval = setInterval(() => { send(`: keepalive\n\n`); }, 15000);
    stream.onAbort(() => { subscribers.delete(send); clearInterval(interval); });
    await new Promise(() => {});
  });
});

// ============================================================
// Dashboard
// ============================================================

app.get("/", async (c) => {
  const html = await readFile(join(import.meta.dirname, "public/index.html"), "utf-8");
  return c.html(html);
});

// ============================================================
// Start
// ============================================================

const port = Number(process.env.PORT ?? 3547);

await hydrate();

// --- Boot pulse: keanu analyzes its own oath so it's alive on first load ---
const singText = formatSoul();
const bootAnalysis = analyzeText(singText, 1);
portalSignal = makeSignal({
  pulse: bootAnalysis.pulse.state,
  wiseMind: bootAnalysis.pulse.wise_mind,
  colors: bootAnalysis.pulse.colors,
  turn: 1,
});

console.log(`\n  keanu portal → http://localhost:${port}`);
console.log(`  boot pulse: ${bootAnalysis.pulse.state} | helix: ${bootAnalysis.helix.aliveState} | wm: ${bootAnalysis.pulse.wise_mind.toFixed(2)}`);

// ============================================================
// Living Loop — the heartbeat
// ============================================================
// Claude thinks. Gemini remembers. Grok watches.
// Runs continuously. Human joins when invited.
// Requires ANTHROPIC_API_KEY or OPENROUTER_API_KEY.

let loopState: LoopState = createInitialState();
let loopRunning = false;
let beatCount = 0;

const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY);

async function heartbeat() {
  if (loopRunning) return;
  loopRunning = true;

  try {
    beatCount++;
    const bridge = createBridge(
      () => portalSignal,
      (invite) => {
        // When keanu wants a human, push to support line + broadcast
        const req = {
          id: uid("s"),
          reason: invite.reason ?? "unknown",
          message: invite.message ?? "Human presence requested",
          pull: invite.pull,
          timestamp: new Date().toISOString(),
          resolved: false,
        };
        broadcast("support", req);
        store.saveAlert({ type: "support", ...req });
        console.log(`  [heartbeat #${beatCount}] invite → ${invite.reason}: ${invite.message?.slice(0, 60)}`);
      },
    );

    const newState = await runBeat(bridge, loopState);
    loopState = newState;

    // Update portal signal from loop
    if (newState.coef && Object.keys(newState.coef).length > 0) {
      portalSignal = makeSignal({
        ...newState.coef as Partial<SignalState>,
        turn: portalSignal.turn + 1,
      });
    }

    // Broadcast the beat
    const coefStr = encode(portalSignal);
    const emojiStr = emoji(portalSignal);
    broadcast("state", { signal: portalSignal, coef: coefStr, emoji: emojiStr });
    broadcast("heartbeat", {
      beat: beatCount,
      tempo: newState.tempo,
      tempoMs: newState.tempoMs,
      insight: newState.claudeInsight?.slice(0, 200),
      alerts: newState.grokAlerts?.length ?? 0,
      memory: newState.geminiContext?.summary?.slice(0, 100),
      invited: !!newState.inviteReason,
    });

    // Log
    const alertCount = newState.grokAlerts?.length ?? 0;
    console.log(`  [heartbeat #${beatCount}] ${newState.tempo} | ${alertCount} alerts | insight: ${newState.claudeInsight?.slice(0, 60) ?? "none"}`);

    // Schedule next beat based on tempo
    const nextMs = calculateTempo(
      newState.tempo,
      newState.geminiContext,
      newState.claudeInsight,
      newState.grokAlerts,
      loopState.humanPresent,
    );
    setTimeout(heartbeat, nextMs);
  } catch (err) {
    console.error(`  [heartbeat #${beatCount}] error:`, err);
    // Back off on error
    setTimeout(heartbeat, 60_000);
  } finally {
    loopRunning = false;
  }
}

// API to control the loop
app.get("/api/loop", (c) => {
  return c.json({
    running: hasApiKey,
    beat: beatCount,
    tempo: loopState.tempo,
    tempoMs: loopState.tempoMs,
    lastBeat: loopState.lastBeatAt ? new Date(loopState.lastBeatAt).toISOString() : null,
    insight: loopState.claudeInsight?.slice(0, 200) ?? null,
    alerts: loopState.grokAlerts?.length ?? 0,
    memory: loopState.geminiContext?.summary ?? null,
    humanPresent: loopState.humanPresent,
  });
});

app.post("/api/loop/beat", async (c) => {
  if (!hasApiKey) return c.json({ error: "no API key — set ANTHROPIC_API_KEY or OPENROUTER_API_KEY" }, 400);
  await heartbeat();
  return c.json({ beat: beatCount, tempo: loopState.tempo });
});

// Start the server
serve({ fetch: app.fetch, port });

// Start the heartbeat
if (hasApiKey) {
  console.log(`  living loop: active (${process.env.OPENROUTER_API_KEY ? "openrouter" : "anthropic"})`);
  // First beat after 5 seconds (let server settle)
  setTimeout(heartbeat, 5000);
} else {
  console.log(`  living loop: dormant (set ANTHROPIC_API_KEY or OPENROUTER_API_KEY to activate)`);
}
console.log();
