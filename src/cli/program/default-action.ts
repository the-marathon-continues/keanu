/**
 * Default action when `keanu` is run with no command.
 *
 * Checks if the gateway is running, starts it in background if not,
 * then launches the TUI for chatting.
 */

import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { resolveGatewayPort, loadConfig } from "../../config/config.js";
import { tryListenOnPort } from "../../infra/ports-probe.js";
import { defaultRuntime } from "../../runtime.js";
import { theme } from "../../terminal/theme.js";
import { runTui } from "../../tui/tui.js";

async function isPortInUse(port: number): Promise<boolean> {
  try {
    await tryListenOnPort({ port, host: "127.0.0.1" });
    return false; // We could listen, so nothing is using it
  } catch {
    return true; // Port in use
  }
}

async function startGatewayBackground(port: number): Promise<boolean> {
  const scriptPath = process.argv[1];
  if (!scriptPath) {
    return false;
  }

  defaultRuntime.log(theme.muted("Starting gateway..."));

  const child = spawn(
    process.execPath,
    [scriptPath, "gateway", "run", "--allow-unconfigured", "--port", String(port)],
    {
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    },
  );
  child.unref();

  // Wait for gateway to start listening
  for (let i = 0; i < 30; i++) {
    await setTimeout(200);
    if (await isPortInUse(port)) {
      return true;
    }
  }
  return false;
}

export async function runDefaultAction(): Promise<void> {
  const cfg = loadConfig();
  const port = resolveGatewayPort(cfg);

  // Check if gateway is already running (port in use)
  const running = await isPortInUse(port);

  if (!running) {
    const started = await startGatewayBackground(port);
    if (!started) {
      defaultRuntime.error("Failed to start gateway. Try running: keanu gateway run");
      defaultRuntime.exit(1);
      return;
    }
    defaultRuntime.log(theme.success("Gateway started."));
  }

  // Now launch the TUI
  try {
    await runTui({});
  } catch (err) {
    defaultRuntime.error(String(err));
    defaultRuntime.exit(1);
  }
}
