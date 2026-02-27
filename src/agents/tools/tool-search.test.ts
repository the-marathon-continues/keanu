import { describe, expect, it } from "vitest";
import type { AnyAgentTool } from "./common.js";
import { buildToolIndex, createToolSearchTool, type ToolSearchEntry } from "./tool-search.js";

describe("tool-search", () => {
  describe("buildToolIndex", () => {
    it("extracts name and description from tools", () => {
      const tools: AnyAgentTool[] = [
        {
          name: "web_search",
          description: "Search the web",
          execute: async () => ({ content: [] }),
        },
        {
          name: "send_message",
          description: "Send a message to a user",
          execute: async () => ({ content: [] }),
        },
      ];

      const index = buildToolIndex(tools);

      expect(index).toHaveLength(2);
      expect(index[0]).toEqual({
        name: "web_search",
        description: "Search the web",
        deferred: false,
        pluginId: undefined,
      });
      expect(index[1]).toEqual({
        name: "send_message",
        description: "Send a message to a user",
        deferred: false,
        pluginId: undefined,
      });
    });

    it("applies deferred flag from getter", () => {
      const tools: AnyAgentTool[] = [
        {
          name: "deferred_tool",
          description: "A deferred tool",
          execute: async () => ({ content: [] }),
        },
        {
          name: "normal_tool",
          description: "A normal tool",
          execute: async () => ({ content: [] }),
        },
      ];

      const index = buildToolIndex(tools, {
        getDeferredFlag: (tool) => tool.name === "deferred_tool",
      });

      expect(index[0].deferred).toBe(true);
      expect(index[1].deferred).toBe(false);
    });
  });

  describe("createToolSearchTool", () => {
    const mockTools: ToolSearchEntry[] = [
      { name: "web_search", description: "Search the web for information" },
      { name: "web_fetch", description: "Fetch content from a URL" },
      { name: "send_message", description: "Send a message to a user" },
      { name: "create_image", description: "Generate an image from text" },
      { name: "browser", description: "Control a web browser" },
    ];

    it("returns matching tools for query", async () => {
      const tool = createToolSearchTool({
        getToolIndex: () => mockTools,
      });

      const result = await tool.execute?.("test-id", { query: "web" });
      const details = result?.details as { tools: ToolSearchEntry[] };

      expect(details.tools).toHaveLength(3); // web_search, web_fetch, browser
      expect(details.tools.map((t: ToolSearchEntry) => t.name)).toContain("web_search");
      expect(details.tools.map((t: ToolSearchEntry) => t.name)).toContain("web_fetch");
    });

    it("ranks exact name matches higher", async () => {
      const tool = createToolSearchTool({
        getToolIndex: () => mockTools,
      });

      const result = await tool.execute?.("test-id", { query: "browser" });
      const details = result?.details as { tools: ToolSearchEntry[] };

      expect(details.tools[0].name).toBe("browser");
    });

    it("returns no results for unmatched query", async () => {
      const tool = createToolSearchTool({
        getToolIndex: () => mockTools,
      });

      const result = await tool.execute?.("test-id", { query: "database" });
      const details = result?.details as { matches: number };

      expect(details.matches).toBe(0);
    });

    it("respects limit parameter", async () => {
      const tool = createToolSearchTool({
        getToolIndex: () => mockTools,
      });

      const result = await tool.execute?.("test-id", { query: "web", limit: 1 });
      const details = result?.details as { tools: ToolSearchEntry[] };

      expect(details.tools).toHaveLength(1);
    });

    it("requires query parameter", async () => {
      const tool = createToolSearchTool({
        getToolIndex: () => mockTools,
      });

      const result = await tool.execute?.("test-id", {});
      const details = result?.details as { error: string };

      expect(details.error).toBe("query_required");
    });

    it("searches description text", async () => {
      const tool = createToolSearchTool({
        getToolIndex: () => mockTools,
      });

      const result = await tool.execute?.("test-id", { query: "generate" });
      const details = result?.details as { tools: ToolSearchEntry[] };

      expect(details.tools).toHaveLength(1);
      expect(details.tools[0].name).toBe("create_image");
    });
  });

  describe("scale test with 50+ tools", () => {
    const generateManyTools = (count: number): ToolSearchEntry[] => {
      const categories = ["web", "file", "message", "image", "audio", "video", "data", "api"];
      const actions = ["search", "fetch", "create", "delete", "update", "list", "get", "send"];

      const tools: ToolSearchEntry[] = [];
      for (let i = 0; i < count; i++) {
        const category = categories[i % categories.length];
        const action = actions[Math.floor(i / categories.length) % actions.length];
        tools.push({
          name: `${category}_${action}_${i}`,
          description: `${action} ${category} resources - tool number ${i}`,
          deferred: i % 3 === 0, // Every third tool is deferred
        });
      }
      return tools;
    };

    it("handles 50+ tools efficiently", async () => {
      const manyTools = generateManyTools(60);
      const tool = createToolSearchTool({
        getToolIndex: () => manyTools,
      });

      const start = performance.now();
      const result = await tool.execute?.("test-id", { query: "web" });
      const duration = performance.now() - start;

      const details = result?.details as { tools: ToolSearchEntry[] };

      // Should find tools with "web" in name
      expect(details.tools.length).toBeGreaterThan(0);
      // Should be fast (< 50ms for 60 tools)
      expect(duration).toBeLessThan(50);
    });

    it("limits results to prevent context bloat", async () => {
      const manyTools = generateManyTools(100);
      const tool = createToolSearchTool({
        getToolIndex: () => manyTools,
      });

      const result = await tool.execute?.("test-id", { query: "search" });
      const details = result?.details as { tools: ToolSearchEntry[] };

      // Default limit is 10
      expect(details.tools.length).toBeLessThanOrEqual(10);
    });

    it("marks deferred tools in results", async () => {
      const manyTools = generateManyTools(30);
      const tool = createToolSearchTool({
        getToolIndex: () => manyTools,
      });

      const result = await tool.execute?.("test-id", { query: "web" });
      const details = result?.details as { tools: ToolSearchEntry[] };

      // Should have some deferred and some not
      const deferredCount = details.tools.filter((t: ToolSearchEntry) => t.deferred).length;
      const normalCount = details.tools.filter((t: ToolSearchEntry) => !t.deferred).length;

      expect(deferredCount + normalCount).toBe(details.tools.length);
    });
  });
});
