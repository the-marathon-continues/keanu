import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs(["node", "keanu", "gateway", "--dev", "--allow-unconfigured"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "keanu", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "keanu", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "keanu", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "keanu", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "keanu", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "keanu", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it.each([
    ["--dev first", ["node", "keanu", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "keanu", "--profile", "work", "--dev", "status"]],
  ])("rejects combining --dev with --profile (%s)", (_name, argv) => {
    const res = parseCliProfileArgs(argv);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".keanu-dev");
    expect(env.KEANU_PROFILE).toBe("dev");
    expect(env.KEANU_STATE_DIR).toBe(expectedStateDir);
    expect(env.KEANU_CONFIG_PATH).toBe(path.join(expectedStateDir, "keanu.json"));
    expect(env.KEANU_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      KEANU_STATE_DIR: "/custom",
      KEANU_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.KEANU_STATE_DIR).toBe("/custom");
    expect(env.KEANU_GATEWAY_PORT).toBe("19099");
    expect(env.KEANU_CONFIG_PATH).toBe(path.join("/custom", "keanu.json"));
  });

  it("uses KEANU_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      KEANU_HOME: "/srv/keanu-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/keanu-home");
    expect(env.KEANU_STATE_DIR).toBe(path.join(resolvedHome, ".keanu-work"));
    expect(env.KEANU_CONFIG_PATH).toBe(path.join(resolvedHome, ".keanu-work", "keanu.json"));
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "keanu doctor --fix",
      env: {},
      expected: "keanu doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "keanu doctor --fix",
      env: { KEANU_PROFILE: "default" },
      expected: "keanu doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "keanu doctor --fix",
      env: { KEANU_PROFILE: "Default" },
      expected: "keanu doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "keanu doctor --fix",
      env: { KEANU_PROFILE: "bad profile" },
      expected: "keanu doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "keanu --profile work doctor --fix",
      env: { KEANU_PROFILE: "work" },
      expected: "keanu --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "keanu --dev doctor",
      env: { KEANU_PROFILE: "dev" },
      expected: "keanu --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("keanu doctor --fix", { KEANU_PROFILE: "work" })).toBe(
      "keanu --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("keanu doctor --fix", { KEANU_PROFILE: "  jbkeanu  " })).toBe(
      "keanu --profile jbkeanu doctor --fix",
    );
  });

  it("handles command with no args after keanu", () => {
    expect(formatCliCommand("keanu", { KEANU_PROFILE: "test" })).toBe("keanu --profile test");
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm keanu doctor", { KEANU_PROFILE: "work" })).toBe(
      "pnpm keanu --profile work doctor",
    );
  });
});
