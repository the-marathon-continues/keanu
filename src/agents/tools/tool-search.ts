import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common.js";

/**
 * Metadata for tools in the search index.
 * Lightweight — doesn't include execute functions.
 */
export type ToolSearchEntry = {
  name: string;
  description: string;
  /** If true, tool is deferred (not in base context, discoverable via search) */
  deferred?: boolean;
  /** Source plugin if from a plugin */
  pluginId?: string;
};

const ToolSearchSchema = Type.Object({
  query: Type.String({
    description:
      "What capability you need (e.g., 'send a message', 'search the web', 'create an image')",
  }),
  limit: Type.Optional(
    Type.Number({
      description: "Maximum number of results to return (default: 10)",
    }),
  ),
});

/**
 * Score a tool against a search query.
 * Higher score = better match.
 */
function scoreToolMatch(tool: ToolSearchEntry, queryTerms: string[]): number {
  const nameLower = tool.name.toLowerCase();
  const descLower = tool.description.toLowerCase();

  let score = 0;

  for (const term of queryTerms) {
    // Exact name match is strongest signal
    if (nameLower === term) {
      score += 100;
    } else if (nameLower.includes(term)) {
      score += 50;
    }

    // Description match
    if (descLower.includes(term)) {
      score += 10;
    }
  }

  // Bonus for shorter names (more specific tools)
  if (score > 0) {
    score += Math.max(0, 20 - tool.name.length);
  }

  return score;
}

/**
 * Create the tool_search meta-tool.
 *
 * This tool enables deferred tool loading: instead of stuffing every tool
 * into context at boot, agents can discover tools at runtime.
 *
 * @param getToolIndex - Function that returns the current tool index.
 *                       Called at search time, not at creation time.
 */
export function createToolSearchTool(opts: {
  getToolIndex: () => ToolSearchEntry[];
}): AnyAgentTool {
  return {
    label: "Tool Search",
    name: "tool_search",
    description:
      "Find available tools by capability. Returns matching tool names and descriptions. Use when you need a capability not in your current toolset.",
    parameters: ToolSearchSchema,
    execute: async (_toolCallId, args) => {
      const params = args as { query?: string; limit?: number };
      const query = (params.query ?? "").trim().toLowerCase();
      const limit = Math.min(Math.max(1, params.limit ?? 10), 50);

      if (!query) {
        return {
          content: [{ type: "text", text: "Query required." }],
          details: { error: "query_required" },
        };
      }

      const toolIndex = opts.getToolIndex();
      const queryTerms = query.split(/\s+/).filter(Boolean);

      // Score and rank tools
      const scored = toolIndex
        .map((tool) => ({
          tool,
          score: scoreToolMatch(tool, queryTerms),
        }))
        .filter((entry) => entry.score > 0)
        .toSorted((a, b) => b.score - a.score)
        .slice(0, limit);

      if (scored.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No tools found matching "${params.query}". Try different terms or browse all tools with a broad query like "list" or "all".`,
            },
          ],
          details: { matches: 0, query: params.query },
        };
      }

      const lines = scored.map(({ tool, score }) => {
        const deferredTag = tool.deferred ? " [deferred]" : "";
        return `• ${tool.name}${deferredTag} (score: ${score})\n  ${tool.description}`;
      });

      const text = [
        `Found ${scored.length} tool${scored.length === 1 ? "" : "s"} matching "${params.query}":`,
        "",
        ...lines,
        "",
        "To use a tool, call it by name. Deferred tools are available but not in your base context.",
      ].join("\n");

      return {
        content: [{ type: "text", text }],
        details: {
          matches: scored.length,
          query: params.query,
          tools: scored.map(({ tool }) => ({
            name: tool.name,
            description: tool.description,
            deferred: tool.deferred ?? false,
          })),
        },
      };
    },
  };
}

/**
 * Build a tool index from an array of tools.
 * Extracts only the metadata needed for search.
 */
export function buildToolIndex(
  tools: AnyAgentTool[],
  opts?: {
    getDeferredFlag?: (tool: AnyAgentTool) => boolean;
    getPluginId?: (tool: AnyAgentTool) => string | undefined;
  },
): ToolSearchEntry[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    deferred: opts?.getDeferredFlag?.(tool) ?? false,
    pluginId: opts?.getPluginId?.(tool),
  }));
}
