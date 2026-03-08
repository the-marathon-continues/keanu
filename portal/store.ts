// store.ts — Persistence layer. JSONL files. No database. Survives restarts.
//
// Sessions, turns, alerts, conversations — all append-only JSONL.
// On startup, replays from disk. On write, appends.

import { readFile, writeFile, appendFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(import.meta.dirname, "data");

async function ensureDir(dir: string) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

// ============================================================
// Generic JSONL helpers
// ============================================================

async function appendLine(file: string, data: unknown): Promise<void> {
  await ensureDir(join(file, ".."));
  await appendFile(file, JSON.stringify(data) + "\n");
}

async function readLines<T>(file: string): Promise<T[]> {
  if (!existsSync(file)) return [];
  const raw = await readFile(file, "utf-8");
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

async function writeJSON(file: string, data: unknown): Promise<void> {
  await ensureDir(join(file, ".."));
  await writeFile(file, JSON.stringify(data, null, 2));
}

async function readJSON<T>(file: string): Promise<T | null> {
  if (!existsSync(file)) return null;
  const raw = await readFile(file, "utf-8");
  return JSON.parse(raw) as T;
}

// ============================================================
// Sessions
// ============================================================

export interface PersistedSession {
  id: string;
  name: string;
  createdAt: string;
  turn: number;
  consecutiveGrey: number;
  lastPulse: string;
  lastWiseMind: number;
  lastHumanTone: string;
  ended?: boolean;
}

const sessionsFile = () => join(DATA_DIR, "sessions.jsonl");
const turnsFile = (sessionId: string) => join(DATA_DIR, "sessions", sessionId, "turns.jsonl");
const sessionStateFile = (sessionId: string) => join(DATA_DIR, "sessions", sessionId, "state.json");

export async function saveTurn(sessionId: string, turn: unknown): Promise<void> {
  await appendLine(turnsFile(sessionId), turn);
}

export async function loadTurns<T>(sessionId: string): Promise<T[]> {
  return readLines<T>(turnsFile(sessionId));
}

export async function saveSessionMeta(session: PersistedSession): Promise<void> {
  await writeJSON(sessionStateFile(session.id), session);
}

export async function loadSessionMeta(sessionId: string): Promise<PersistedSession | null> {
  return readJSON<PersistedSession>(sessionStateFile(sessionId));
}

export async function listSessionIds(): Promise<string[]> {
  const dir = join(DATA_DIR, "sessions");
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

// ============================================================
// Alerts
// ============================================================

const alertsFile = () => join(DATA_DIR, "alerts.jsonl");

export async function saveAlert(alert: unknown): Promise<void> {
  await appendLine(alertsFile(), alert);
}

export async function loadAlerts<T>(): Promise<T[]> {
  return readLines<T>(alertsFile());
}

// ============================================================
// Conversations (prompt interface)
// ============================================================

const conversationsDir = () => join(DATA_DIR, "conversations");
const conversationFile = (id: string) => join(conversationsDir(), `${id}.jsonl`);

export async function saveConversationMessage(conversationId: string, message: unknown): Promise<void> {
  await appendLine(conversationFile(conversationId), message);
}

export async function loadConversation<T>(conversationId: string): Promise<T[]> {
  return readLines<T>(conversationFile(conversationId));
}

export async function listConversationIds(): Promise<string[]> {
  const dir = conversationsDir();
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  return entries.filter((e) => e.endsWith(".jsonl")).map((e) => e.replace(".jsonl", ""));
}

// ============================================================
// Portal state (global)
// ============================================================

const portalStateFile = () => join(DATA_DIR, "portal-state.json");

export async function savePortalState(state: unknown): Promise<void> {
  await writeJSON(portalStateFile(), state);
}

export async function loadPortalState<T>(): Promise<T | null> {
  return readJSON<T>(portalStateFile());
}
