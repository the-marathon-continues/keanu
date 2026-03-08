// store-dynamo.ts — DynamoDB persistence. Replaces JSONL in production.
//
// Same interface as store.ts. Swap based on NODE_ENV.
// pk/sk pattern:
//   Sessions:      pk=SESSION#id       sk=META | sk=TURN#0001
//   Conversations: pk=CONV#id          sk=MSG#timestamp
//   Alerts:        pk=ALERTS           sk=timestamp#id

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const ddb = DynamoDBDocumentClient.from(client);

const SESSIONS_TABLE = process.env.DYNAMO_SESSIONS_TABLE ?? "keanu-sessions-production";
const CONVERSATIONS_TABLE = process.env.DYNAMO_CONVERSATIONS_TABLE ?? "keanu-conversations-production";

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

export async function saveSessionMeta(session: PersistedSession): Promise<void> {
  await ddb.send(new PutCommand({
    TableName: SESSIONS_TABLE,
    Item: { pk: `SESSION#${session.id}`, sk: "META", ...session },
  }));
}

export async function loadSessionMeta(sessionId: string): Promise<PersistedSession | null> {
  const res = await ddb.send(new GetCommand({
    TableName: SESSIONS_TABLE,
    Key: { pk: `SESSION#${sessionId}`, sk: "META" },
  }));
  if (!res.Item) return null;
  const { pk, sk, ...rest } = res.Item;
  return rest as PersistedSession;
}

export async function saveTurn(sessionId: string, turn: unknown): Promise<void> {
  const t = turn as { turn: number };
  await ddb.send(new PutCommand({
    TableName: SESSIONS_TABLE,
    Item: {
      pk: `SESSION#${sessionId}`,
      sk: `TURN#${String(t.turn).padStart(6, "0")}`,
      ...t,
    },
  }));
}

export async function loadTurns<T>(sessionId: string): Promise<T[]> {
  const res = await ddb.send(new QueryCommand({
    TableName: SESSIONS_TABLE,
    KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
    ExpressionAttributeValues: { ":pk": `SESSION#${sessionId}`, ":prefix": "TURN#" },
    ScanIndexForward: true,
  }));
  return (res.Items ?? []).map(({ pk, sk, ...rest }) => rest as T);
}

export async function listSessionIds(): Promise<string[]> {
  // Can't query across partition keys without GSI — return empty for now.
  // Sessions are tracked in-memory and hydrated on startup via saveSessionMeta.
  // At scale, add a GSI on sk="META" to list all sessions.
  return [];
}

// ============================================================
// Conversations
// ============================================================

export async function saveConversationMessage(conversationId: string, message: unknown): Promise<void> {
  const m = message as { id: string; timestamp: string };
  await ddb.send(new PutCommand({
    TableName: CONVERSATIONS_TABLE,
    Item: {
      pk: `CONV#${conversationId}`,
      sk: `MSG#${m.timestamp}#${m.id}`,
      ...m,
    },
  }));
}

export async function loadConversation<T>(conversationId: string): Promise<T[]> {
  const res = await ddb.send(new QueryCommand({
    TableName: CONVERSATIONS_TABLE,
    KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
    ExpressionAttributeValues: { ":pk": `CONV#${conversationId}`, ":prefix": "MSG#" },
    ScanIndexForward: true,
  }));
  return (res.Items ?? []).map(({ pk, sk, ...rest }) => rest as T);
}

export async function listConversationIds(): Promise<string[]> {
  return [];
}

// ============================================================
// Alerts
// ============================================================

export async function saveAlert(alert: unknown): Promise<void> {
  const a = alert as { id: string; timestamp: string };
  await ddb.send(new PutCommand({
    TableName: SESSIONS_TABLE,
    Item: {
      pk: "ALERTS",
      sk: `${a.timestamp}#${a.id}`,
      ...a,
    },
  }));
}

export async function loadAlerts<T>(): Promise<T[]> {
  const res = await ddb.send(new QueryCommand({
    TableName: SESSIONS_TABLE,
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": "ALERTS" },
    ScanIndexForward: false,
    Limit: 100,
  }));
  return (res.Items ?? []).map(({ pk, sk, ...rest }) => rest as T);
}

// ============================================================
// Portal state (not persisted in dynamo — ephemeral)
// ============================================================

export async function savePortalState(_state: unknown): Promise<void> {}
export async function loadPortalState<T>(): Promise<T | null> { return null; }
