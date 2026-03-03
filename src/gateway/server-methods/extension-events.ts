/**
 * Extension Events Handler
 *
 * Handles events from macOS system extensions (DNS Proxy, Endpoint Security, etc.)
 * and provides query methods for agent tools.
 *
 * Privacy: Events are stored in memory only, per-connection, with configurable
 * retention limits. No persistence to disk. Events expire based on maxAgeMs.
 */

import type { GatewayRequestHandlers } from "./types.js";

// Event types matching Swift ExtensionEvent enum
interface DNSQueryEvent {
  timestamp: string;
  domain: string;
  queryType: string;
  sourceApp: string | null;
}

interface NetworkFlowEvent {
  timestamp: string;
  direction: "inbound" | "outbound";
  protocol: string | null;
  sourceHost: string | null;
  sourcePort: number | null;
  destinationHost: string | null;
  destinationPort: number | null;
  bytesIn: number;
  bytesOut: number;
  sourceApp: string | null;
}

interface FileAccessEvent {
  timestamp: string;
  path: string;
  operation: "read" | "write" | "delete" | "rename" | "create";
  processPath: string | null;
  processId: number | null;
}

interface ProcessExecEvent {
  timestamp: string;
  path: string;
  args: string[];
  processId: number;
  parentProcessId: number;
  userId: number;
  userName: string | null;
}

type ExtensionEvent =
  | { type: "dnsQuery"; data: DNSQueryEvent }
  | { type: "networkFlow"; data: NetworkFlowEvent }
  | { type: "fileAccess"; data: FileAccessEvent }
  | { type: "processExec"; data: ProcessExecEvent };

// Retention policy configuration
interface RetentionPolicy {
  maxDNSQueries: number;
  maxNetworkFlows: number;
  maxFileAccess: number;
  maxProcessExec: number;
  maxAgeMs: number; // Events older than this are expired
}

const DEFAULT_RETENTION: RetentionPolicy = {
  maxDNSQueries: 1000,
  maxNetworkFlows: 1000,
  maxFileAccess: 5000,
  maxProcessExec: 1000,
  maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
};

// Privacy: paths that should be excluded or hashed
const SENSITIVE_PATH_PATTERNS = [
  /\/\.ssh\//i,
  /\/\.aws\//i,
  /\/\.gnupg\//i,
  /keychain/i,
  /password/i,
  /credential/i,
  /secret/i,
  /\.env$/i,
  /token/i,
];

function hashSensitivePath(path: string): string {
  for (const pattern of SENSITIVE_PATH_PATTERNS) {
    if (pattern.test(path)) {
      // Hash the filename, keep the directory
      const lastSlash = path.lastIndexOf("/");
      const dir = path.substring(0, lastSlash);
      const filename = path.substring(lastSlash + 1);
      // Simple hash: base64 of first 8 chars
      const hash = Buffer.from(filename.substring(0, 8)).toString("base64").substring(0, 8);
      return `${dir}/[hashed:${hash}]`;
    }
  }
  return path;
}

// Ring buffer with time-based expiry
class RingBuffer<T extends { timestamp: string }> {
  private items: T[] = [];
  private maxSize: number;
  private maxAgeMs: number;
  private lastCleanup = Date.now();

  constructor(maxSize: number, maxAgeMs: number = DEFAULT_RETENTION.maxAgeMs) {
    this.maxSize = maxSize;
    this.maxAgeMs = maxAgeMs;
  }

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.maxSize) {
      this.items.shift();
    }
    // Periodic cleanup (every 100 pushes or 1 minute)
    if (Date.now() - this.lastCleanup > 60_000) {
      this.expireOld();
    }
  }

  private expireOld(): void {
    const cutoff = Date.now() - this.maxAgeMs;
    this.items = this.items.filter((item) => {
      const ts = new Date(item.timestamp).getTime();
      return ts >= cutoff;
    });
    this.lastCleanup = Date.now();
  }

  getAll(): T[] {
    this.expireOld();
    return [...this.items];
  }

  query(filter: (item: T) => boolean): T[] {
    return this.getAll().filter(filter);
  }

  clear(): void {
    this.items = [];
  }

  get size(): number {
    return this.items.length;
  }

  updatePolicy(maxSize: number, maxAgeMs: number): void {
    this.maxSize = maxSize;
    this.maxAgeMs = maxAgeMs;
    // Trim if needed
    while (this.items.length > this.maxSize) {
      this.items.shift();
    }
    this.expireOld();
  }
}

// Extension event store (per-connection)
interface ExtensionStore {
  dnsQueries: RingBuffer<DNSQueryEvent>;
  networkFlows: RingBuffer<NetworkFlowEvent>;
  fileAccess: RingBuffer<FileAccessEvent>;
  processExec: RingBuffer<ProcessExecEvent>;
  policy: RetentionPolicy;
}

const extensionStores = new Map<string, ExtensionStore>();

function getOrCreateStore(connId: string): ExtensionStore {
  let store = extensionStores.get(connId);
  if (!store) {
    const policy = { ...DEFAULT_RETENTION };
    store = {
      dnsQueries: new RingBuffer<DNSQueryEvent>(policy.maxDNSQueries, policy.maxAgeMs),
      networkFlows: new RingBuffer<NetworkFlowEvent>(policy.maxNetworkFlows, policy.maxAgeMs),
      fileAccess: new RingBuffer<FileAccessEvent>(policy.maxFileAccess, policy.maxAgeMs),
      processExec: new RingBuffer<ProcessExecEvent>(policy.maxProcessExec, policy.maxAgeMs),
      policy,
    };
    extensionStores.set(connId, store);
  }
  return store;
}

export const extensionEventHandlers: GatewayRequestHandlers = {
  // Receive events from Mac app
  "extension.event": ({ params, client, respond }) => {
    const connId = client?.connId;
    if (!connId) {
      respond(false, undefined, { code: "NO_SESSION", message: "No session" });
      return;
    }

    const event = params as ExtensionEvent;
    const store = getOrCreateStore(connId);

    switch (event.type) {
      case "dnsQuery":
        store.dnsQueries.push(event.data);
        break;
      case "networkFlow":
        store.networkFlows.push(event.data);
        break;
      case "fileAccess":
        // Apply privacy transformation to file paths
        const fileEvent = { ...event.data };
        fileEvent.path = hashSensitivePath(fileEvent.path);
        if (fileEvent.processPath) {
          fileEvent.processPath = hashSensitivePath(fileEvent.processPath);
        }
        store.fileAccess.push(fileEvent);
        break;
      case "processExec":
        store.processExec.push(event.data);
        break;
    }

    respond(true, { received: true });
  },

  // Query DNS events
  "extension.dns_queries": ({ params, client, respond }) => {
    const connId = client?.connId;
    if (!connId) {
      respond(false, undefined, { code: "NO_SESSION", message: "No session" });
      return;
    }

    const store = getOrCreateStore(connId);
    const {
      since,
      domain,
      app,
      limit = 100,
    } = params as {
      since?: string;
      domain?: string;
      app?: string;
      limit?: number;
    };

    let results = store.dnsQueries.getAll();

    // Filter by time
    if (since) {
      const sinceDate = new Date(since);
      results = results.filter((e) => new Date(e.timestamp) >= sinceDate);
    }

    // Filter by domain
    if (domain) {
      const pattern = domain.toLowerCase();
      results = results.filter((e) => e.domain.toLowerCase().includes(pattern));
    }

    // Filter by app
    if (app) {
      const pattern = app.toLowerCase();
      results = results.filter((e) => e.sourceApp?.toLowerCase().includes(pattern));
    }

    // Limit results
    results = results.slice(-limit);

    respond(true, {
      events: results,
      total: results.length,
      bufferSize: store.dnsQueries.size,
    });
  },

  // Query process events
  "extension.processes": ({ params, client, respond }) => {
    const connId = client?.connId;
    if (!connId) {
      respond(false, undefined, { code: "NO_SESSION", message: "No session" });
      return;
    }

    const store = getOrCreateStore(connId);
    const {
      since,
      path,
      user,
      limit = 100,
    } = params as {
      since?: string;
      path?: string;
      user?: string;
      limit?: number;
    };

    let results = store.processExec.getAll();

    if (since) {
      const sinceDate = new Date(since);
      results = results.filter((e) => new Date(e.timestamp) >= sinceDate);
    }

    if (path) {
      const pattern = path.toLowerCase();
      results = results.filter((e) => e.path.toLowerCase().includes(pattern));
    }

    if (user) {
      const pattern = user.toLowerCase();
      results = results.filter((e) => e.userName?.toLowerCase().includes(pattern));
    }

    results = results.slice(-limit);

    respond(true, {
      events: results,
      total: results.length,
      bufferSize: store.processExec.size,
    });
  },

  // Query file access events
  "extension.file_access": ({ params, client, respond }) => {
    const connId = client?.connId;
    if (!connId) {
      respond(false, undefined, { code: "NO_SESSION", message: "No session" });
      return;
    }

    const store = getOrCreateStore(connId);
    const {
      since,
      path,
      operation,
      limit = 100,
    } = params as {
      since?: string;
      path?: string;
      operation?: string;
      limit?: number;
    };

    let results = store.fileAccess.getAll();

    if (since) {
      const sinceDate = new Date(since);
      results = results.filter((e) => new Date(e.timestamp) >= sinceDate);
    }

    if (path) {
      const pattern = path.toLowerCase();
      results = results.filter((e) => e.path.toLowerCase().includes(pattern));
    }

    if (operation) {
      results = results.filter((e) => e.operation === operation);
    }

    results = results.slice(-limit);

    respond(true, {
      events: results,
      total: results.length,
      bufferSize: store.fileAccess.size,
    });
  },

  // Query network flow events
  "extension.network_flows": ({ params, client, respond }) => {
    const connId = client?.connId;
    if (!connId) {
      respond(false, undefined, { code: "NO_SESSION", message: "No session" });
      return;
    }

    const store = getOrCreateStore(connId);
    const {
      since,
      destination,
      app,
      limit = 100,
    } = params as {
      since?: string;
      destination?: string;
      app?: string;
      limit?: number;
    };

    let results = store.networkFlows.getAll();

    if (since) {
      const sinceDate = new Date(since);
      results = results.filter((e) => new Date(e.timestamp) >= sinceDate);
    }

    if (destination) {
      const pattern = destination.toLowerCase();
      results = results.filter((e) => e.destinationHost?.toLowerCase().includes(pattern));
    }

    if (app) {
      const pattern = app.toLowerCase();
      results = results.filter((e) => e.sourceApp?.toLowerCase().includes(pattern));
    }

    results = results.slice(-limit);

    respond(true, {
      events: results,
      total: results.length,
      bufferSize: store.networkFlows.size,
    });
  },

  // Get extension statistics
  "extension.stats": ({ client, respond }) => {
    const connId = client?.connId;
    if (!connId) {
      respond(false, undefined, { code: "NO_SESSION", message: "No session" });
      return;
    }

    const store = extensionStores.get(connId);
    if (!store) {
      respond(true, {
        dnsQueries: 0,
        networkFlows: 0,
        fileAccess: 0,
        processExec: 0,
        policy: DEFAULT_RETENTION,
      });
      return;
    }

    respond(true, {
      dnsQueries: store.dnsQueries.size,
      networkFlows: store.networkFlows.size,
      fileAccess: store.fileAccess.size,
      processExec: store.processExec.size,
      policy: store.policy,
    });
  },

  // Clear extension data
  "extension.clear": ({ client, respond }) => {
    const connId = client?.connId;
    if (!connId) {
      respond(false, undefined, { code: "NO_SESSION", message: "No session" });
      return;
    }

    const store = extensionStores.get(connId);
    if (store) {
      store.dnsQueries.clear();
      store.networkFlows.clear();
      store.fileAccess.clear();
      store.processExec.clear();
    }

    respond(true, { cleared: true });
  },

  // Update retention policy
  "extension.policy.set": ({ params, client, respond }) => {
    const connId = client?.connId;
    if (!connId) {
      respond(false, undefined, { code: "NO_SESSION", message: "No session" });
      return;
    }

    const store = getOrCreateStore(connId);
    const policy = params as Partial<RetentionPolicy>;

    // Merge with existing policy
    if (typeof policy.maxDNSQueries === "number") {
      store.policy.maxDNSQueries = policy.maxDNSQueries;
      store.dnsQueries.updatePolicy(policy.maxDNSQueries, store.policy.maxAgeMs);
    }
    if (typeof policy.maxNetworkFlows === "number") {
      store.policy.maxNetworkFlows = policy.maxNetworkFlows;
      store.networkFlows.updatePolicy(policy.maxNetworkFlows, store.policy.maxAgeMs);
    }
    if (typeof policy.maxFileAccess === "number") {
      store.policy.maxFileAccess = policy.maxFileAccess;
      store.fileAccess.updatePolicy(policy.maxFileAccess, store.policy.maxAgeMs);
    }
    if (typeof policy.maxProcessExec === "number") {
      store.policy.maxProcessExec = policy.maxProcessExec;
      store.processExec.updatePolicy(policy.maxProcessExec, store.policy.maxAgeMs);
    }
    if (typeof policy.maxAgeMs === "number") {
      store.policy.maxAgeMs = policy.maxAgeMs;
      store.dnsQueries.updatePolicy(store.policy.maxDNSQueries, policy.maxAgeMs);
      store.networkFlows.updatePolicy(store.policy.maxNetworkFlows, policy.maxAgeMs);
      store.fileAccess.updatePolicy(store.policy.maxFileAccess, policy.maxAgeMs);
      store.processExec.updatePolicy(store.policy.maxProcessExec, policy.maxAgeMs);
    }

    respond(true, { policy: store.policy });
  },

  // Get retention policy
  "extension.policy.get": ({ client, respond }) => {
    const connId = client?.connId;
    if (!connId) {
      respond(false, undefined, { code: "NO_SESSION", message: "No session" });
      return;
    }

    const store = extensionStores.get(connId);
    respond(true, { policy: store?.policy ?? DEFAULT_RETENTION });
  },
};
