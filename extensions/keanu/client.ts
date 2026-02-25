// keanu/client.ts
// Async client for the keanu daemon unix socket.
// Fail-open: if the daemon isn't running, log a warning and return null.

import { connect, type Socket } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_SOCKET_PATH = join(homedir(), ".keanu", "daemon.sock");
const CONNECT_TIMEOUT_MS = 2000;
const REQUEST_TIMEOUT_MS = 5000;

export type KeanuRequest =
  | { type: "command"; name: "pulse" }
  | { type: "command"; name: "remember"; content: string; memory_type: string }
  | { type: "command"; name: "recall"; content: string }
  | { type: "command"; name: "disagree_stats" };

export type PulseResponse = {
  type: "pulse";
  pulse: {
    state: "alive" | "grey" | "black";
    confidence: number;
    wise_mind: number;
    signals: string[];
    timestamp: string;
  };
};

export type AckResponse = {
  type: "ack";
  content: string;
};

export type MemoriesResponse = {
  type: "memories";
  [key: string]: unknown;
};

export type StatsResponse = {
  type: "stats";
  data: {
    total: number;
    agent_yielded: number;
    human_yielded: number;
    unresolved: number;
    yield_ratio: number;
  };
};

export type KeanuResponse = PulseResponse | AckResponse | MemoriesResponse | StatsResponse;

export type KeanuLogger = {
  warn: (msg: string) => void;
  debug?: (msg: string) => void;
};

export class KeanuClient {
  private socketPath: string;
  private logger: KeanuLogger;

  constructor(socketPath?: string, logger?: KeanuLogger) {
    this.socketPath = socketPath ?? DEFAULT_SOCKET_PATH;
    this.logger = logger ?? { warn: () => {} };
  }

  /**
   * Send a request to the keanu daemon and return the response.
   * Fails open: returns null on any connection or protocol error.
   */
  async send(request: KeanuRequest): Promise<KeanuResponse | null> {
    return new Promise((resolve) => {
      let socket: Socket | null = null;
      let settled = false;
      let buffer = "";

      const done = (result: KeanuResponse | null) => {
        if (settled) return;
        settled = true;
        try {
          socket?.destroy();
        } catch {
          // ignore cleanup errors
        }
        resolve(result);
      };

      const connectTimer = setTimeout(() => {
        this.logger.warn?.(`keanu: connect timeout (${this.socketPath})`);
        done(null);
      }, CONNECT_TIMEOUT_MS);

      const requestTimer = setTimeout(() => {
        this.logger.warn?.(`keanu: request timeout for "${request.name}"`);
        done(null);
      }, REQUEST_TIMEOUT_MS);

      try {
        socket = connect({ path: this.socketPath });

        socket.once("connect", () => {
          clearTimeout(connectTimer);
          const payload = JSON.stringify(request) + "\n";
          socket!.write(payload);
        });

        socket.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf-8");
          const newlineIdx = buffer.indexOf("\n");
          if (newlineIdx !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            clearTimeout(requestTimer);
            try {
              const parsed = JSON.parse(line) as KeanuResponse;
              done(parsed);
            } catch (e) {
              this.logger.warn?.(`keanu: malformed response: ${String(e)}`);
              done(null);
            }
          }
        });

        socket.once("error", (err: Error) => {
          clearTimeout(connectTimer);
          clearTimeout(requestTimer);
          // ENOENT means daemon not running — expected, don't spam logs.
          const isExpected =
            (err as NodeJS.ErrnoException).code === "ENOENT" ||
            (err as NodeJS.ErrnoException).code === "ECONNREFUSED";
          if (!isExpected) {
            this.logger.warn?.(`keanu: socket error: ${err.message}`);
          } else {
            this.logger.debug?.(
              `keanu: daemon not available (${(err as NodeJS.ErrnoException).code})`,
            );
          }
          done(null);
        });

        socket.once("end", () => {
          clearTimeout(requestTimer);
          if (!settled) {
            this.logger.warn?.("keanu: connection closed before response");
            done(null);
          }
        });
      } catch (err) {
        clearTimeout(connectTimer);
        clearTimeout(requestTimer);
        this.logger.warn?.(`keanu: failed to create socket: ${String(err)}`);
        done(null);
      }
    });
  }

  /** Convenience: fetch current pulse. Returns null if daemon unavailable. */
  async pulse(): Promise<PulseResponse["pulse"] | null> {
    const res = await this.send({ type: "command", name: "pulse" });
    if (res?.type === "pulse") return res.pulse;
    return null;
  }

  /** Convenience: record a memory. Returns ack content or null. */
  async remember(content: string, memoryType: string): Promise<string | null> {
    const res = await this.send({
      type: "command",
      name: "remember",
      content,
      memory_type: memoryType,
    });
    if (res?.type === "ack") return res.content;
    return null;
  }

  /** Convenience: fetch disagreement stats. Returns stats data or null. */
  async disagreeStats(): Promise<StatsResponse["data"] | null> {
    const res = await this.send({ type: "command", name: "disagree_stats" });
    if (res?.type === "stats") return res.data;
    return null;
  }
}
