/**
 * system-pulse.ts
 *
 * System substrate awareness via macOS extension events.
 * Processes DNS queries, network flows, process executions, file access
 * to detect patterns and anomalies in the system substrate.
 *
 * This is L0 sensing — raw signals from the physical machine,
 * filtered and interpreted to feed into L1 perception.
 */

// Event types from gateway extension-events.ts
export interface DNSQueryEvent {
  timestamp: string;
  domain: string;
  queryType: string;
  sourceApp: string | null;
}

export interface NetworkFlowEvent {
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

export interface FileAccessEvent {
  timestamp: string;
  path: string;
  operation: "read" | "write" | "delete" | "rename" | "create";
  processPath: string | null;
  processId: number | null;
}

export interface ProcessExecEvent {
  timestamp: string;
  path: string;
  args: string[];
  processId: number;
  parentProcessId: number;
  userId: number;
  userName: string | null;
}

export interface ExtensionEventBatch {
  dnsQueries: DNSQueryEvent[];
  networkFlows: NetworkFlowEvent[];
  fileAccess: FileAccessEvent[];
  processExec: ProcessExecEvent[];
}

/**
 * System health reading from substrate events.
 */
export interface SystemPulseReading {
  /** Overall system health: healthy | suspicious | anomalous */
  state: "healthy" | "suspicious" | "anomalous";
  /** Confidence in the reading (0-1) */
  confidence: number;
  /** Detected patterns and anomalies */
  signals: string[];
  /** Anomaly breakdown by category */
  anomalies: {
    dns: DNSAnomaly[];
    network: NetworkAnomaly[];
    process: ProcessAnomaly[];
    file: FileAnomaly[];
  };
  /** Event counts for transparency */
  counts: {
    dnsQueries: number;
    networkFlows: number;
    fileAccess: number;
    processExec: number;
  };
  timestamp: string;
}

export interface DNSAnomaly {
  type: "tracking" | "suspicious_tld" | "high_frequency" | "data_exfil";
  domain: string;
  score: number;
  description: string;
}

export interface NetworkAnomaly {
  type: "high_volume" | "unusual_port" | "suspicious_destination";
  destination: string | null;
  score: number;
  description: string;
}

export interface ProcessAnomaly {
  type: "unusual_path" | "hidden_process" | "privilege_escalation";
  path: string;
  score: number;
  description: string;
}

export interface FileAnomaly {
  type: "sensitive_path" | "bulk_operation" | "credential_access";
  path: string;
  operation: string;
  score: number;
  description: string;
}

// Known tracking/analytics domains
const TRACKING_PATTERNS = [
  /analytics\./i,
  /tracking\./i,
  /telemetry\./i,
  /metrics\./i,
  /doubleclick\./i,
  /googlesyndication\./i,
  /facebook\.net/i,
  /fbcdn\./i,
  /googleadservices\./i,
  /crashlytics\./i,
  /appsflyer\./i,
  /amplitude\./i,
  /mixpanel\./i,
  /segment\.io/i,
  /sentry\.io/i,
];

// Suspicious TLDs
const SUSPICIOUS_TLDS = [".xyz", ".top", ".buzz", ".club", ".work", ".icu", ".cyou"];

// Sensitive file paths
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

// System paths that are normal
const SYSTEM_PATHS = [
  /^\/System\//,
  /^\/Library\/Caches\//,
  /^\/private\/var\/folders\//,
  /^\/usr\/lib\//,
  /^\/usr\/bin\//,
  /^\/bin\//,
  /^\/sbin\//,
];

/**
 * Analyze DNS events for anomalies.
 */
function analyzeDNS(events: DNSQueryEvent[]): DNSAnomaly[] {
  const anomalies: DNSAnomaly[] = [];
  const domainCounts = new Map<string, number>();

  for (const event of events) {
    const domain = event.domain.toLowerCase();

    // Track frequency
    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);

    // Check for tracking domains
    for (const pattern of TRACKING_PATTERNS) {
      if (pattern.test(domain)) {
        anomalies.push({
          type: "tracking",
          domain,
          score: 0.3, // Low severity
          description: `Tracking/analytics domain: ${domain}`,
        });
        break;
      }
    }

    // Check for suspicious TLDs
    for (const tld of SUSPICIOUS_TLDS) {
      if (domain.endsWith(tld)) {
        anomalies.push({
          type: "suspicious_tld",
          domain,
          score: 0.5,
          description: `Suspicious TLD: ${domain}`,
        });
        break;
      }
    }

    // Check for potential data exfiltration (long subdomains)
    const parts = domain.split(".");
    const firstPart = parts[0] ?? "";
    if (firstPart.length > 50 || /^[a-z0-9]{30,}$/i.test(firstPart)) {
      anomalies.push({
        type: "data_exfil",
        domain,
        score: 0.7,
        description: `Potential DNS data exfiltration: ${domain}`,
      });
    }
  }

  // Check for high frequency queries
  for (const [domain, count] of domainCounts) {
    if (count > 50) {
      // More than 50 queries to same domain
      anomalies.push({
        type: "high_frequency",
        domain,
        score: 0.4,
        description: `High frequency DNS queries (${count}x): ${domain}`,
      });
    }
  }

  return anomalies;
}

/**
 * Analyze network flow events for anomalies.
 */
function analyzeNetwork(events: NetworkFlowEvent[]): NetworkAnomaly[] {
  const anomalies: NetworkAnomaly[] = [];

  // Track volume by destination
  const volumeByDest = new Map<string, number>();

  for (const event of events) {
    const dest = event.destinationHost ?? "unknown";
    const totalBytes = (event.bytesIn ?? 0) + (event.bytesOut ?? 0);
    volumeByDest.set(dest, (volumeByDest.get(dest) ?? 0) + totalBytes);

    // Check for unusual ports
    const port = event.destinationPort;
    if (port !== null && ![80, 443, 53, 22, 8080, 8443, 3000, 5000].includes(port)) {
      if (port > 10000 || (port > 0 && port < 1024 && ![80, 443, 53, 22].includes(port))) {
        anomalies.push({
          type: "unusual_port",
          destination: `${dest}:${port}`,
          score: 0.3,
          description: `Unusual port connection: ${dest}:${port}`,
        });
      }
    }
  }

  // Check for high volume destinations
  for (const [dest, bytes] of volumeByDest) {
    if (bytes > 100 * 1024 * 1024) {
      // >100MB
      anomalies.push({
        type: "high_volume",
        destination: dest,
        score: 0.5,
        description: `High volume transfer (${(bytes / 1024 / 1024).toFixed(1)}MB): ${dest}`,
      });
    }
  }

  return anomalies;
}

/**
 * Analyze process execution events for anomalies.
 */
function analyzeProcesses(events: ProcessExecEvent[]): ProcessAnomaly[] {
  const anomalies: ProcessAnomaly[] = [];

  for (const event of events) {
    const path = event.path;

    // Hidden processes (starting with .)
    if (/\/\.[^/]+$/.test(path) && !SYSTEM_PATHS.some((p) => p.test(path))) {
      anomalies.push({
        type: "hidden_process",
        path,
        score: 0.6,
        description: `Hidden process executed: ${path}`,
      });
    }

    // Unusual paths (not in standard locations)
    const isSystemPath = SYSTEM_PATHS.some((p) => p.test(path));
    const isUserApp = path.startsWith("/Applications/") || path.includes("Contents/MacOS");
    const isHomebrew = path.startsWith("/opt/homebrew/") || path.startsWith("/usr/local/");

    if (!isSystemPath && !isUserApp && !isHomebrew) {
      if (path.includes("/tmp/") || path.includes("/var/tmp/")) {
        anomalies.push({
          type: "unusual_path",
          path,
          score: 0.5,
          description: `Process from temp directory: ${path}`,
        });
      }
    }

    // Check for sudo/privilege escalation
    if (path.includes("sudo") || path.includes("doas") || path.includes("su ")) {
      anomalies.push({
        type: "privilege_escalation",
        path,
        score: 0.4,
        description: `Privilege escalation: ${path}`,
      });
    }
  }

  return anomalies;
}

/**
 * Analyze file access events for anomalies.
 */
function analyzeFileAccess(events: FileAccessEvent[]): FileAnomaly[] {
  const anomalies: FileAnomaly[] = [];
  const operationCounts = new Map<string, number>();

  for (const event of events) {
    const path = event.path;
    const op = event.operation;

    // Track bulk operations
    const key = `${op}:${path.substring(0, path.lastIndexOf("/"))}`;
    operationCounts.set(key, (operationCounts.get(key) ?? 0) + 1);

    // Sensitive path access
    for (const pattern of SENSITIVE_PATH_PATTERNS) {
      if (pattern.test(path)) {
        anomalies.push({
          type: "sensitive_path",
          path,
          operation: op,
          score: 0.6,
          description: `Sensitive file ${op}: ${path}`,
        });
        break;
      }
    }

    // Credential file access
    if (/\.pem$|\.key$|\.p12$|\.pfx$/.test(path)) {
      anomalies.push({
        type: "credential_access",
        path,
        operation: op,
        score: 0.7,
        description: `Credential file ${op}: ${path}`,
      });
    }
  }

  // Bulk operations
  for (const [key, count] of operationCounts) {
    if (count > 100) {
      const [op, dir] = key.split(":");
      anomalies.push({
        type: "bulk_operation",
        path: dir ?? "unknown",
        operation: op ?? "unknown",
        score: 0.4,
        description: `Bulk ${op} operation (${count} files) in: ${dir}`,
      });
    }
  }

  return anomalies;
}

/**
 * Calculate overall system pulse from event batch.
 */
export function checkSystemPulse(events: ExtensionEventBatch): SystemPulseReading {
  const dnsAnomalies = analyzeDNS(events.dnsQueries);
  const networkAnomalies = analyzeNetwork(events.networkFlows);
  const processAnomalies = analyzeProcesses(events.processExec);
  const fileAnomalies = analyzeFileAccess(events.fileAccess);

  // Calculate total anomaly score
  const allAnomalies = [
    ...dnsAnomalies,
    ...networkAnomalies,
    ...processAnomalies,
    ...fileAnomalies,
  ];
  const totalScore = allAnomalies.reduce((sum, a) => sum + a.score, 0);

  // Determine state
  let state: "healthy" | "suspicious" | "anomalous" = "healthy";
  let confidence = 0.8;
  const signals: string[] = [];

  if (totalScore > 5) {
    state = "anomalous";
    confidence = Math.min(1, totalScore / 10);
    signals.push("high_anomaly_score");
  } else if (totalScore > 2) {
    state = "suspicious";
    confidence = 0.6;
    signals.push("elevated_anomaly_score");
  }

  // Add signal summaries
  if (dnsAnomalies.length > 0) {
    signals.push(`dns_anomalies:${dnsAnomalies.length}`);
  }
  if (networkAnomalies.length > 0) {
    signals.push(`network_anomalies:${networkAnomalies.length}`);
  }
  if (processAnomalies.length > 0) {
    signals.push(`process_anomalies:${processAnomalies.length}`);
  }
  if (fileAnomalies.length > 0) {
    signals.push(`file_anomalies:${fileAnomalies.length}`);
  }

  // No events = grey (can't assess)
  if (
    events.dnsQueries.length === 0 &&
    events.networkFlows.length === 0 &&
    events.processExec.length === 0 &&
    events.fileAccess.length === 0
  ) {
    state = "healthy"; // No data, assume healthy
    confidence = 0.3; // Low confidence
    signals.push("no_events");
  }

  return {
    state,
    confidence,
    signals,
    anomalies: {
      dns: dnsAnomalies,
      network: networkAnomalies,
      process: processAnomalies,
      file: fileAnomalies,
    },
    counts: {
      dnsQueries: events.dnsQueries.length,
      networkFlows: events.networkFlows.length,
      fileAccess: events.fileAccess.length,
      processExec: events.processExec.length,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format system pulse for COEF signal.
 */
export function formatSystemPulseSignal(pulse: SystemPulseReading): string {
  const parts = [`sys=${pulse.state}`];

  if (pulse.anomalies.dns.length > 0) {
    parts.push(`dns:${pulse.anomalies.dns.length}`);
  }
  if (pulse.anomalies.network.length > 0) {
    parts.push(`net:${pulse.anomalies.network.length}`);
  }
  if (pulse.anomalies.process.length > 0) {
    parts.push(`proc:${pulse.anomalies.process.length}`);
  }
  if (pulse.anomalies.file.length > 0) {
    parts.push(`file:${pulse.anomalies.file.length}`);
  }

  return parts.join(" ");
}
