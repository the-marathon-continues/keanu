/**
 * System Extension Tools
 *
 * Agent tools for querying system extension events (DNS, processes, files, network).
 * These give the AI visibility into the substrate layer of the system.
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";
import { callGatewayTool, type GatewayCallOptions } from "./gateway.js";

/**
 * Create tool for querying DNS events from system extensions.
 */
export function createSystemDnsQueriesTool(): AnyAgentTool {
  return {
    label: "System DNS",
    name: "system_dns_queries",
    description:
      "Query recent DNS lookups from the system. Returns domains that were resolved, when, and which app made the query. Use this to understand network activity patterns.",
    parameters: Type.Object({
      since: Type.Optional(
        Type.String({
          description: "ISO timestamp to filter events after (e.g., '2024-01-01T00:00:00Z')",
        }),
      ),
      domain: Type.Optional(
        Type.String({
          description: "Filter by domain name (partial match)",
        }),
      ),
      app: Type.Optional(
        Type.String({
          description: "Filter by source app bundle ID (partial match)",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of results (default: 100)",
        }),
      ),
    }),
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const opts: GatewayCallOptions = {};
      const result = await callGatewayTool("extension.dns_queries", opts, {
        since: readStringParam(params, "since"),
        domain: readStringParam(params, "domain"),
        app: readStringParam(params, "app"),
        limit: readNumberParam(params, "limit", { integer: true }),
      });
      return jsonResult(result);
    },
  };
}

/**
 * Create tool for querying process execution events from system extensions.
 */
export function createSystemProcessesTool(): AnyAgentTool {
  return {
    label: "System Processes",
    name: "system_processes",
    description:
      "Query recent process executions. Returns what programs ran, their arguments, PIDs, and parent processes. Use this to understand what's running on the system.",
    parameters: Type.Object({
      since: Type.Optional(
        Type.String({
          description: "ISO timestamp to filter events after",
        }),
      ),
      path: Type.Optional(
        Type.String({
          description: "Filter by executable path (partial match)",
        }),
      ),
      user: Type.Optional(
        Type.String({
          description: "Filter by username (partial match)",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of results (default: 100)",
        }),
      ),
    }),
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const opts: GatewayCallOptions = {};
      const result = await callGatewayTool("extension.processes", opts, {
        since: readStringParam(params, "since"),
        path: readStringParam(params, "path"),
        user: readStringParam(params, "user"),
        limit: readNumberParam(params, "limit", { integer: true }),
      });
      return jsonResult(result);
    },
  };
}

/**
 * Create tool for querying file access events from system extensions.
 */
export function createSystemFileAccessTool(): AnyAgentTool {
  return {
    label: "System File Access",
    name: "system_file_access",
    description:
      "Query recent file access events. Returns which files were read, written, deleted, or created. Use this to understand file system activity.",
    parameters: Type.Object({
      since: Type.Optional(
        Type.String({
          description: "ISO timestamp to filter events after",
        }),
      ),
      path: Type.Optional(
        Type.String({
          description: "Filter by file path (partial match)",
        }),
      ),
      operation: Type.Optional(
        Type.Union(
          [
            Type.Literal("read"),
            Type.Literal("write"),
            Type.Literal("delete"),
            Type.Literal("rename"),
            Type.Literal("create"),
          ],
          {
            description: "Filter by operation type",
          },
        ),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of results (default: 100)",
        }),
      ),
    }),
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const opts: GatewayCallOptions = {};
      const result = await callGatewayTool("extension.file_access", opts, {
        since: readStringParam(params, "since"),
        path: readStringParam(params, "path"),
        operation: readStringParam(params, "operation"),
        limit: readNumberParam(params, "limit", { integer: true }),
      });
      return jsonResult(result);
    },
  };
}

/**
 * Create tool for querying network flow events from system extensions.
 */
export function createSystemNetworkFlowsTool(): AnyAgentTool {
  return {
    label: "System Network",
    name: "system_network_flows",
    description:
      "Query recent network connections. Returns source/destination hosts, ports, protocols, and traffic volume. Use this to understand network activity.",
    parameters: Type.Object({
      since: Type.Optional(
        Type.String({
          description: "ISO timestamp to filter events after",
        }),
      ),
      destination: Type.Optional(
        Type.String({
          description: "Filter by destination host (partial match)",
        }),
      ),
      app: Type.Optional(
        Type.String({
          description: "Filter by source app bundle ID (partial match)",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of results (default: 100)",
        }),
      ),
    }),
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const opts: GatewayCallOptions = {};
      const result = await callGatewayTool("extension.network_flows", opts, {
        since: readStringParam(params, "since"),
        destination: readStringParam(params, "destination"),
        app: readStringParam(params, "app"),
        limit: readNumberParam(params, "limit", { integer: true }),
      });
      return jsonResult(result);
    },
  };
}

/**
 * Create tool for getting system extension statistics.
 */
export function createSystemExtensionStatsTool(): AnyAgentTool {
  return {
    label: "System Stats",
    name: "system_extension_stats",
    description:
      "Get statistics about collected system extension events. Returns counts for each event type in the buffer.",
    parameters: Type.Object({}),
    execute: async () => {
      const opts: GatewayCallOptions = {};
      const result = await callGatewayTool("extension.stats", opts, {});
      return jsonResult(result);
    },
  };
}

/**
 * Create all system extension tools.
 */
export function createSystemExtensionTools(): AnyAgentTool[] {
  return [
    createSystemDnsQueriesTool(),
    createSystemProcessesTool(),
    createSystemFileAccessTool(),
    createSystemNetworkFlowsTool(),
    createSystemExtensionStatsTool(),
  ];
}
