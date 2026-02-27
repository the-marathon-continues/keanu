import { vi } from "vitest";
import { installChromeUserDataDirHooks } from "./chrome-user-data-dir.test-harness.js";

const chromeUserDataDir = { dir: "/tmp/keanu" };
installChromeUserDataDirHooks(chromeUserDataDir);

vi.mock("./chrome.js", () => ({
  isChromeCdpReady: vi.fn(async () => true),
  isChromeReachable: vi.fn(async () => true),
  launchKeanuChrome: vi.fn(async () => {
    throw new Error("unexpected launch");
  }),
  resolveKeanuUserDataDir: vi.fn(() => chromeUserDataDir.dir),
  stopKeanuChrome: vi.fn(async () => {}),
}));
