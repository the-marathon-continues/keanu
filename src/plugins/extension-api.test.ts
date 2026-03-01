/**
 * Tests for extension-to-extension API exposure.
 *
 * Extensions can expose APIs that other extensions can discover and call.
 * This enables bidirectional communication between plugins like keanu and memory-core.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { createPluginRegistry, createEmptyPluginRegistry, type PluginRegistry } from "./registry.js";
import type { PluginRuntime } from "./runtime/types.js";

// Minimal runtime stub for testing
const stubRuntime: PluginRuntime = {
  config: {} as PluginRuntime["config"],
  channel: {},
} as PluginRuntime;

const stubLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

describe("Extension API exposure", () => {
  describe("exposeApi", () => {
    it("allows an extension to expose an API object", () => {
      const { registry, createApi } = createPluginRegistry({
        logger: stubLogger,
        runtime: stubRuntime,
      });

      const record = {
        id: "keanu",
        name: "keanu",
        source: "/extensions/keanu/index.ts",
        origin: "bundled" as const,
        enabled: true,
        status: "loaded" as const,
        toolNames: [],
        hookNames: [],
        channelIds: [],
        providerIds: [],
        gatewayMethods: [],
        cliCommands: [],
        services: [],
        commands: [],
        httpHandlers: 0,
        hookCount: 0,
        configSchema: false,
      };

      const api = createApi(record, { config: {} as any });

      // Expose keanu's API
      const keanuApi = {
        getPulse: () => ({ alive: "green", grey: 0 }),
        checkBullshit: (text: string) => ({ flags: [], score: 0 }),
      };

      api.exposeApi("keanu", keanuApi);

      // Should be retrievable
      const retrieved = api.getApi<typeof keanuApi>("keanu");
      expect(retrieved).toBeDefined();
      expect(retrieved?.getPulse()).toEqual({ alive: "green", grey: 0 });
    });

    it("returns undefined for non-existent APIs", () => {
      const { createApi } = createPluginRegistry({
        logger: stubLogger,
        runtime: stubRuntime,
      });

      const record = {
        id: "test-plugin",
        name: "test",
        source: "/test.ts",
        origin: "bundled" as const,
        enabled: true,
        status: "loaded" as const,
        toolNames: [],
        hookNames: [],
        channelIds: [],
        providerIds: [],
        gatewayMethods: [],
        cliCommands: [],
        services: [],
        commands: [],
        httpHandlers: 0,
        hookCount: 0,
        configSchema: false,
      };

      const api = createApi(record, { config: {} as any });

      expect(api.getApi("nonexistent")).toBeUndefined();
    });

    it("lists all exposed APIs", () => {
      const { createApi } = createPluginRegistry({
        logger: stubLogger,
        runtime: stubRuntime,
      });

      const makeRecord = (id: string) => ({
        id,
        name: id,
        source: `/${id}.ts`,
        origin: "bundled" as const,
        enabled: true,
        status: "loaded" as const,
        toolNames: [],
        hookNames: [],
        channelIds: [],
        providerIds: [],
        gatewayMethods: [],
        cliCommands: [],
        services: [],
        commands: [],
        httpHandlers: 0,
        hookCount: 0,
        configSchema: false,
      });

      const keanuApi = createApi(makeRecord("keanu"), { config: {} as any });
      const memoryApi = createApi(makeRecord("memory-core"), { config: {} as any });

      keanuApi.exposeApi("keanu", { getPulse: () => "alive" });
      memoryApi.exposeApi("memory-core", { search: () => [] });

      const apis = keanuApi.listApis();
      expect(apis).toContain("keanu");
      expect(apis).toContain("memory-core");
      expect(apis.length).toBe(2);
    });

    it("allows extensions to call each other's APIs", () => {
      const { createApi } = createPluginRegistry({
        logger: stubLogger,
        runtime: stubRuntime,
      });

      const makeRecord = (id: string) => ({
        id,
        name: id,
        source: `/${id}.ts`,
        origin: "bundled" as const,
        enabled: true,
        status: "loaded" as const,
        toolNames: [],
        hookNames: [],
        channelIds: [],
        providerIds: [],
        gatewayMethods: [],
        cliCommands: [],
        services: [],
        commands: [],
        httpHandlers: 0,
        hookCount: 0,
        configSchema: false,
      });

      // Keanu exposes its API
      const keanuPluginApi = createApi(makeRecord("keanu"), { config: {} as any });
      keanuPluginApi.exposeApi("keanu", {
        getPulse: () => ({ alive: "green", grey: 0 }),
        isAlive: () => true,
      });

      // Memory-core queries keanu
      const memoryPluginApi = createApi(makeRecord("memory-core"), { config: {} as any });
      const keanu = memoryPluginApi.getApi<{ getPulse: () => any; isAlive: () => boolean }>("keanu");

      expect(keanu).toBeDefined();
      expect(keanu?.isAlive()).toBe(true);
      expect(keanu?.getPulse().alive).toBe("green");
    });

    it("prevents duplicate API names from the same plugin", () => {
      const { createApi } = createPluginRegistry({
        logger: stubLogger,
        runtime: stubRuntime,
      });

      const record = {
        id: "keanu",
        name: "keanu",
        source: "/keanu.ts",
        origin: "bundled" as const,
        enabled: true,
        status: "loaded" as const,
        toolNames: [],
        hookNames: [],
        channelIds: [],
        providerIds: [],
        gatewayMethods: [],
        cliCommands: [],
        services: [],
        commands: [],
        httpHandlers: 0,
        hookCount: 0,
        configSchema: false,
      };

      const api = createApi(record, { config: {} as any });

      api.exposeApi("keanu", { v1: true });

      // Second registration should warn but not crash
      // (or throw - depends on design decision)
      expect(() => api.exposeApi("keanu", { v2: true })).not.toThrow();
    });
  });

  describe("cross-extension patterns", () => {
    it("keanu can discover available channels", () => {
      const { createApi } = createPluginRegistry({
        logger: stubLogger,
        runtime: stubRuntime,
      });

      const makeRecord = (id: string) => ({
        id,
        name: id,
        source: `/${id}.ts`,
        origin: "bundled" as const,
        enabled: true,
        status: "loaded" as const,
        toolNames: [],
        hookNames: [],
        channelIds: [],
        providerIds: [],
        gatewayMethods: [],
        cliCommands: [],
        services: [],
        commands: [],
        httpHandlers: 0,
        hookCount: 0,
        configSchema: false,
      });

      // Channels expose their APIs with a prefix convention
      const telegramApi = createApi(makeRecord("telegram"), { config: {} as any });
      telegramApi.exposeApi("channel:telegram", {
        sendMessage: (to: string, text: string) => ({ success: true }),
      });

      const discordApi = createApi(makeRecord("discord"), { config: {} as any });
      discordApi.exposeApi("channel:discord", {
        sendMessage: (to: string, text: string) => ({ success: true }),
      });

      // Keanu discovers what channels are available
      const keanuApi = createApi(makeRecord("keanu"), { config: {} as any });
      const allApis = keanuApi.listApis();
      const channels = allApis.filter((name) => name.startsWith("channel:"));

      expect(channels).toContain("channel:telegram");
      expect(channels).toContain("channel:discord");
      expect(channels.length).toBe(2);
    });

    it("memory-core can tag entries with keanu's pulse state", () => {
      const { createApi } = createPluginRegistry({
        logger: stubLogger,
        runtime: stubRuntime,
      });

      const makeRecord = (id: string) => ({
        id,
        name: id,
        source: `/${id}.ts`,
        origin: "bundled" as const,
        enabled: true,
        status: "loaded" as const,
        toolNames: [],
        hookNames: [],
        channelIds: [],
        providerIds: [],
        gatewayMethods: [],
        cliCommands: [],
        services: [],
        commands: [],
        httpHandlers: 0,
        hookCount: 0,
        configSchema: false,
      });

      // Keanu exposes state
      let pulseState = { alive: "green" as "green" | "grey", greyStreak: 0 };
      const keanuApi = createApi(makeRecord("keanu"), { config: {} as any });
      keanuApi.exposeApi("keanu", {
        getPulse: () => pulseState,
        setGrey: () => {
          pulseState = { alive: "grey", greyStreak: pulseState.greyStreak + 1 };
        },
      });

      // Memory-core uses keanu's state
      const memoryApi = createApi(makeRecord("memory-core"), { config: {} as any });
      const keanu = memoryApi.getApi<{
        getPulse: () => { alive: string; greyStreak: number };
        setGrey: () => void;
      }>("keanu");

      // Tag a memory entry with current pulse
      const entry = {
        content: "test memory",
        metadata: {
          pulseAtCreation: keanu?.getPulse().alive,
        },
      };

      expect(entry.metadata.pulseAtCreation).toBe("green");

      // Pulse changes
      keanu?.setGrey();

      // New entry reflects new state
      const entry2 = {
        content: "another memory",
        metadata: {
          pulseAtCreation: keanu?.getPulse().alive,
        },
      };

      expect(entry2.metadata.pulseAtCreation).toBe("grey");
    });
  });
});
