import { describe, expect, it } from "vitest";
import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it.each([
    {
      name: "help flag",
      argv: ["node", "keanu", "--help"],
      expected: true,
    },
    {
      name: "version flag",
      argv: ["node", "keanu", "-V"],
      expected: true,
    },
    {
      name: "normal command",
      argv: ["node", "keanu", "status"],
      expected: false,
    },
    {
      name: "root -v alias",
      argv: ["node", "keanu", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "keanu", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with log-level",
      argv: ["node", "keanu", "--log-level", "debug", "-v"],
      expected: true,
    },
    {
      name: "subcommand -v should not be treated as version",
      argv: ["node", "keanu", "acp", "-v"],
      expected: false,
    },
    {
      name: "root -v alias with equals profile",
      argv: ["node", "keanu", "--profile=work", "-v"],
      expected: true,
    },
    {
      name: "subcommand path after global root flags should not be treated as version",
      argv: ["node", "keanu", "--dev", "skills", "list", "-v"],
      expected: false,
    },
  ])("detects help/version flags: $name", ({ argv, expected }) => {
    expect(hasHelpOrVersion(argv)).toBe(expected);
  });

  it.each([
    {
      name: "single command with trailing flag",
      argv: ["node", "keanu", "status", "--json"],
      expected: ["status"],
    },
    {
      name: "two-part command",
      argv: ["node", "keanu", "agents", "list"],
      expected: ["agents", "list"],
    },
    {
      name: "terminator cuts parsing",
      argv: ["node", "keanu", "status", "--", "ignored"],
      expected: ["status"],
    },
  ])("extracts command path: $name", ({ argv, expected }) => {
    expect(getCommandPath(argv, 2)).toEqual(expected);
  });

  it.each([
    {
      name: "returns first command token",
      argv: ["node", "keanu", "agents", "list"],
      expected: "agents",
    },
    {
      name: "returns null when no command exists",
      argv: ["node", "keanu"],
      expected: null,
    },
  ])("returns primary command: $name", ({ argv, expected }) => {
    expect(getPrimaryCommand(argv)).toBe(expected);
  });

  it.each([
    {
      name: "detects flag before terminator",
      argv: ["node", "keanu", "status", "--json"],
      flag: "--json",
      expected: true,
    },
    {
      name: "ignores flag after terminator",
      argv: ["node", "keanu", "--", "--json"],
      flag: "--json",
      expected: false,
    },
  ])("parses boolean flags: $name", ({ argv, flag, expected }) => {
    expect(hasFlag(argv, flag)).toBe(expected);
  });

  it.each([
    {
      name: "value in next token",
      argv: ["node", "keanu", "status", "--timeout", "5000"],
      expected: "5000",
    },
    {
      name: "value in equals form",
      argv: ["node", "keanu", "status", "--timeout=2500"],
      expected: "2500",
    },
    {
      name: "missing value",
      argv: ["node", "keanu", "status", "--timeout"],
      expected: null,
    },
    {
      name: "next token is another flag",
      argv: ["node", "keanu", "status", "--timeout", "--json"],
      expected: null,
    },
    {
      name: "flag appears after terminator",
      argv: ["node", "keanu", "--", "--timeout=99"],
      expected: undefined,
    },
  ])("extracts flag values: $name", ({ argv, expected }) => {
    expect(getFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "keanu", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "keanu", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "keanu", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it.each([
    {
      name: "missing flag",
      argv: ["node", "keanu", "status"],
      expected: undefined,
    },
    {
      name: "missing value",
      argv: ["node", "keanu", "status", "--timeout"],
      expected: null,
    },
    {
      name: "valid positive integer",
      argv: ["node", "keanu", "status", "--timeout", "5000"],
      expected: 5000,
    },
    {
      name: "invalid integer",
      argv: ["node", "keanu", "status", "--timeout", "nope"],
      expected: undefined,
    },
  ])("parses positive integer flag values: $name", ({ argv, expected }) => {
    expect(getPositiveIntFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("builds parse argv from raw args", () => {
    const cases = [
      {
        rawArgs: ["node", "keanu", "status"],
        expected: ["node", "keanu", "status"],
      },
      {
        rawArgs: ["node-22", "keanu", "status"],
        expected: ["node-22", "keanu", "status"],
      },
      {
        rawArgs: ["node-22.2.0.exe", "keanu", "status"],
        expected: ["node-22.2.0.exe", "keanu", "status"],
      },
      {
        rawArgs: ["node-22.2", "keanu", "status"],
        expected: ["node-22.2", "keanu", "status"],
      },
      {
        rawArgs: ["node-22.2.exe", "keanu", "status"],
        expected: ["node-22.2.exe", "keanu", "status"],
      },
      {
        rawArgs: ["/usr/bin/node-22.2.0", "keanu", "status"],
        expected: ["/usr/bin/node-22.2.0", "keanu", "status"],
      },
      {
        rawArgs: ["nodejs", "keanu", "status"],
        expected: ["nodejs", "keanu", "status"],
      },
      {
        rawArgs: ["node-dev", "keanu", "status"],
        expected: ["node", "keanu", "node-dev", "keanu", "status"],
      },
      {
        rawArgs: ["keanu", "status"],
        expected: ["node", "keanu", "status"],
      },
      {
        rawArgs: ["bun", "src/entry.ts", "status"],
        expected: ["bun", "src/entry.ts", "status"],
      },
    ] as const;

    for (const testCase of cases) {
      const parsed = buildParseArgv({
        programName: "keanu",
        rawArgs: [...testCase.rawArgs],
      });
      expect(parsed).toEqual([...testCase.expected]);
    }
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "keanu",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "keanu", "status"]);
  });

  it("decides when to migrate state", () => {
    const nonMutatingArgv = [
      ["node", "keanu", "status"],
      ["node", "keanu", "health"],
      ["node", "keanu", "sessions"],
      ["node", "keanu", "config", "get", "update"],
      ["node", "keanu", "config", "unset", "update"],
      ["node", "keanu", "models", "list"],
      ["node", "keanu", "models", "status"],
      ["node", "keanu", "memory", "status"],
      ["node", "keanu", "agent", "--message", "hi"],
    ] as const;
    const mutatingArgv = [
      ["node", "keanu", "agents", "list"],
      ["node", "keanu", "message", "send"],
    ] as const;

    for (const argv of nonMutatingArgv) {
      expect(shouldMigrateState([...argv])).toBe(false);
    }
    for (const argv of mutatingArgv) {
      expect(shouldMigrateState([...argv])).toBe(true);
    }
  });

  it.each([
    { path: ["status"], expected: false },
    { path: ["config", "get"], expected: false },
    { path: ["models", "status"], expected: false },
    { path: ["agents", "list"], expected: true },
  ])("reuses command path for migrate state decisions: $path", ({ path, expected }) => {
    expect(shouldMigrateStateFromPath(path)).toBe(expected);
  });
});
