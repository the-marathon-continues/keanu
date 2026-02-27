/**
 * A2A Protocol Types
 *
 * Based on A2A v0.3 specification.
 * https://a2a-protocol.org/latest/specification/
 */

// --- Message Types ---

export interface A2AMessage {
  role: "user" | "agent";
  parts: A2APart[];
  metadata?: Record<string, unknown>;
}

export type A2APart = A2ATextPart | A2AFilePart | A2ADataPart;

export interface A2ATextPart {
  type: "text";
  text: string;
}

export interface A2AFilePart {
  type: "file";
  file: {
    name: string;
    mimeType: string;
    data: string; // base64 encoded
  };
}

export interface A2ADataPart {
  type: "data";
  data: Record<string, unknown>;
}

// --- Request/Response ---

export interface A2ARequest {
  jsonrpc: "2.0";
  id: string | number;
  method: "sendMessage" | "getTask" | "cancelTask";
  params: A2ASendMessageParams | A2AGetTaskParams | A2ACancelTaskParams;
}

export interface A2ASendMessageParams {
  message: A2AMessage;
  taskId?: string; // Continue existing task
  skillId?: string; // Target specific skill
  configuration?: {
    streaming?: boolean;
    timeout?: number;
  };
}

export interface A2AGetTaskParams {
  taskId: string;
}

export interface A2ACancelTaskParams {
  taskId: string;
}

export interface A2AResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: A2AResult;
  error?: A2AError;
}

export interface A2AResult {
  task: A2ATask;
  message?: A2AMessage; // Response message
}

export interface A2AError {
  code: number;
  message: string;
  data?: unknown;
}

// --- Task Types ---

export type TaskStatus = "pending" | "active" | "completed" | "failed" | "cancelled";

export interface A2ATask {
  id: string;
  status: TaskStatus;
  skillId?: string;
  createdAt: string;
  updatedAt: string;
  message?: A2AMessage; // Latest response
  history?: A2AMessage[]; // Full conversation history
  error?: A2AError;
}

// --- Keanu-specific extensions ---

export interface KeanuSkillResult {
  skillId: string;
  result: unknown;
  pulse?: {
    state: "alive" | "grey" | "black";
    confidence: number;
    wiseMind: number;
  };
  signal?: string; // COEF signal
}
