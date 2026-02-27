import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  restoreStateDirEnv,
  setStateDirEnv,
  snapshotStateDirEnv,
  withStateDirEnv,
} from "./state-dir-env.js";

type EnvSnapshot = {
  keanu?: string;
  legacy?: string;
};

function snapshotCurrentStateDirVars(): EnvSnapshot {
  return {
    keanu: process.env.KEANU_STATE_DIR,
    legacy: process.env.KEANU_STATE_DIR,
  };
}

function expectStateDirVars(snapshot: EnvSnapshot) {
  expect(process.env.KEANU_STATE_DIR).toBe(snapshot.keanu);
  expect(process.env.KEANU_STATE_DIR).toBe(snapshot.legacy);
}

async function expectPathMissing(filePath: string) {
  await expect(fs.stat(filePath)).rejects.toThrow();
}

async function expectStateDirEnvRestored(params: {
  prev: EnvSnapshot;
  capturedStateDir: string;
  capturedTempRoot: string;
}) {
  expectStateDirVars(params.prev);
  await expectPathMissing(params.capturedStateDir);
  await expectPathMissing(params.capturedTempRoot);
}

describe("state-dir-env helpers", () => {
  it("set/snapshot/restore round-trips KEANU_STATE_DIR", () => {
    const prev = snapshotCurrentStateDirVars();
    const snapshot = snapshotStateDirEnv();

    setStateDirEnv("/tmp/keanu-state-dir-test");
    expect(process.env.KEANU_STATE_DIR).toBe("/tmp/keanu-state-dir-test");
    expect(process.env.KEANU_STATE_DIR).toBeUndefined();

    restoreStateDirEnv(snapshot);
    expectStateDirVars(prev);
  });

  it("withStateDirEnv sets env for callback and cleans up temp root", async () => {
    const prev = snapshotCurrentStateDirVars();

    let capturedTempRoot = "";
    let capturedStateDir = "";
    await withStateDirEnv("keanu-state-dir-env-", async ({ tempRoot, stateDir }) => {
      capturedTempRoot = tempRoot;
      capturedStateDir = stateDir;
      expect(process.env.KEANU_STATE_DIR).toBe(stateDir);
      expect(process.env.KEANU_STATE_DIR).toBeUndefined();
      await fs.writeFile(path.join(stateDir, "probe.txt"), "ok", "utf8");
    });

    await expectStateDirEnvRestored({ prev, capturedStateDir, capturedTempRoot });
  });

  it("withStateDirEnv restores env and cleans temp root when callback throws", async () => {
    const prev = snapshotCurrentStateDirVars();

    let capturedTempRoot = "";
    let capturedStateDir = "";
    await expect(
      withStateDirEnv("keanu-state-dir-env-", async ({ tempRoot, stateDir }) => {
        capturedTempRoot = tempRoot;
        capturedStateDir = stateDir;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    await expectStateDirEnvRestored({ prev, capturedStateDir, capturedTempRoot });
  });

  it("withStateDirEnv restores both env vars when legacy var was previously set", async () => {
    const testSnapshot = snapshotStateDirEnv();
    process.env.KEANU_STATE_DIR = "/tmp/original-keanu";
    process.env.KEANU_STATE_DIR = "/tmp/original-legacy";
    const prev = snapshotCurrentStateDirVars();

    let capturedTempRoot = "";
    let capturedStateDir = "";
    try {
      await withStateDirEnv("keanu-state-dir-env-", async ({ tempRoot, stateDir }) => {
        capturedTempRoot = tempRoot;
        capturedStateDir = stateDir;
        expect(process.env.KEANU_STATE_DIR).toBe(stateDir);
        expect(process.env.KEANU_STATE_DIR).toBeUndefined();
      });

      await expectStateDirEnvRestored({ prev, capturedStateDir, capturedTempRoot });
    } finally {
      restoreStateDirEnv(testSnapshot);
    }
  });
});
