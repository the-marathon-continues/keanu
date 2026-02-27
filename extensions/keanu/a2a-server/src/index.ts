/**
 * Keanu A2A Server
 *
 * Implements Google's Agent-to-Agent protocol for keanu.
 * Other agents can discover keanu's capabilities and send messages.
 *
 * Endpoints:
 *   GET  /.well-known/agent-card.json — Agent Card (discovery)
 *   POST /a2a/sendMessage — Receive messages from other agents
 *   GET  /a2a/tasks/:id — Get task status
 *   POST /a2a/tasks/:id/cancel — Cancel a task
 */

import { agentCard } from "./agent-card";
import { handleSendMessage, handleGetTask, handleCancelTask } from "./handlers";
import type { A2ARequest, A2AResponse, A2AError } from "./types";

export interface Env {
  KEANU_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  AGENT_NAME: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for cross-origin requests
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Agent Card (A2A discovery)
      if (path === "/.well-known/agent-card.json" && request.method === "GET") {
        return new Response(JSON.stringify(agentCard, null, 2), {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }

      // A2A sendMessage
      if (path === "/a2a/sendMessage" && request.method === "POST") {
        // Authenticate
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return errorResponse(401, "Missing or invalid Authorization header", corsHeaders);
        }
        const token = authHeader.slice(7);
        if (token !== env.KEANU_API_KEY) {
          return errorResponse(403, "Invalid API key", corsHeaders);
        }

        const body = (await request.json()) as A2ARequest;
        const result = await handleSendMessage(body, env);
        return jsonResponse(result, corsHeaders);
      }

      // Get task status
      if (path.startsWith("/a2a/tasks/") && request.method === "GET") {
        const taskId = path.split("/")[3];
        if (!taskId) {
          return errorResponse(400, "Missing task ID", corsHeaders);
        }
        const result = await handleGetTask(taskId);
        return jsonResponse(result, corsHeaders);
      }

      // Cancel task
      if (path.match(/^\/a2a\/tasks\/[^/]+\/cancel$/) && request.method === "POST") {
        const taskId = path.split("/")[3];
        if (!taskId) {
          return errorResponse(400, "Missing task ID", corsHeaders);
        }
        const result = await handleCancelTask(taskId);
        return jsonResponse(result, corsHeaders);
      }

      // Health check
      if (path === "/health" && request.method === "GET") {
        return new Response(JSON.stringify({ status: "ok", agent: env.AGENT_NAME }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return errorResponse(404, "Not found", corsHeaders);
    } catch (err) {
      console.error("A2A server error:", err);
      return errorResponse(500, "Internal server error", corsHeaders);
    }
  },
};

function jsonResponse(data: unknown, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function errorResponse(
  status: number,
  message: string,
  corsHeaders: Record<string, string>,
): Response {
  const error: A2AError = {
    code: status,
    message,
    data: null,
  };
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
