// trust-network.ts
// Multi-agent trust with teeth.
//
// TRAVOS (Teacy et al. 2006): Bayesian trust using Beta distributions.
// Not "do I like you" — "given our history, how confident am I in your next move?"
//
// Alpha = successful interactions. Beta = failed interactions.
// Trust = alpha / (alpha + beta). Confidence = f(alpha + beta).
// More interactions = tighter confidence interval = more certainty.
//
// Subagents are full agents. They inherit the parent's trust network,
// make their own observations, and merge updates back.
//
// Need: Multi-Agent (4.5/10 → targeting 7/10)

// ============================================================
// Types
// ============================================================

export type PeerFlag = "capture_risk" | "stale" | "new" | "adversarial" | "trusted";

export type InteractionOutcome = "success" | "failure" | "neutral";

export interface AgentPeer {
  agentId: string; // UUID or agent card URL
  name: string; // Human-readable name
  agentCardUrl?: string; // A2A discovery URL

  // TRAVOS Beta distribution parameters
  alpha: number; // Successful interactions (prior: 1)
  beta: number; // Failed interactions (prior: 1)

  // Interaction history
  lastInteraction: string; // ISO timestamp
  lastOutcome: InteractionOutcome;
  interactionCount: number;

  // Co-evolution tracking (mirrors partnership.ts)
  turnsSinceDisagreement: number;
  disagreementCount: number;

  // Status flags
  flags: PeerFlag[];

  // Creation metadata
  createdAt: string;
}

export interface TrustReading {
  score: number; // Expected trust: alpha / (alpha + beta)
  confidence: number; // How tight is our estimate? 0-1
  interval: [number, number]; // 95% confidence interval
  flags: PeerFlag[];
}

export interface TrustNetwork {
  selfId: string;
  selfName: string;
  peers: Map<string, AgentPeer>;
  lastUpdated: string;
}

export interface TopologyWarning {
  type: "capture_risk" | "cycle" | "isolation" | "asymmetry";
  peers: string[];
  message: string;
}

// ============================================================
// Module state
// ============================================================

let _network: TrustNetwork = createEmptyNetwork();

function createEmptyNetwork(): TrustNetwork {
  return {
    selfId: crypto.randomUUID(),
    selfName: "keanu",
    peers: new Map(),
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================================
// TRAVOS Math
// ============================================================

/**
 * Compute trust score and confidence from Beta distribution parameters.
 *
 * Trust = E[Beta(alpha, beta)] = alpha / (alpha + beta)
 * Confidence = based on total observations (alpha + beta - 2, since prior is 1,1)
 *
 * The confidence interval uses the Beta distribution's quantile function.
 * More observations = tighter interval = more certainty.
 */
export function computeTrust(peer: AgentPeer): TrustReading {
  const { alpha, beta, flags } = peer;

  // Expected value of Beta distribution
  const score = alpha / (alpha + beta);

  // Total observations (subtract prior of 2)
  const observations = alpha + beta - 2;

  // Confidence: asymptotic to 1 as observations increase
  // At 10 observations: ~0.5. At 50: ~0.83. At 100: ~0.91.
  const confidence = observations > 0 ? 1 - 1 / (1 + observations / 10) : 0;

  // 95% confidence interval using Beta quantiles
  // Approximation: interval width shrinks with sqrt(observations)
  const intervalWidth = confidence > 0 ? 1.96 / Math.sqrt(observations + 1) : 0.5;
  const lower = Math.max(0, score - intervalWidth / 2);
  const upper = Math.min(1, score + intervalWidth / 2);

  return {
    score,
    confidence,
    interval: [lower, upper],
    flags: [...flags],
  };
}

/**
 * Apply staleness decay to trust.
 * Trust doesn't decay — confidence does.
 * If we haven't interacted in a while, we're less certain about our estimate.
 */
export function applyDecay(peer: AgentPeer, daysSinceInteraction: number): AgentPeer {
  if (daysSinceInteraction <= 7) {
    // No decay within a week
    return peer;
  }

  // Decay factor: halve effective observations every 30 days past the first week
  const decayWeeks = (daysSinceInteraction - 7) / 30;
  const decayFactor = Math.pow(0.5, decayWeeks);

  // Move alpha and beta toward prior (1, 1) by decay factor
  const newAlpha = 1 + (peer.alpha - 1) * decayFactor;
  const newBeta = 1 + (peer.beta - 1) * decayFactor;

  const flags = [...peer.flags];
  if (!flags.includes("stale") && daysSinceInteraction > 30) {
    flags.push("stale");
  }

  return {
    ...peer,
    alpha: newAlpha,
    beta: newBeta,
    flags,
  };
}

// ============================================================
// Peer Management
// ============================================================

/**
 * Get or create a peer in the trust network.
 */
export function getOrCreatePeer(agentId: string, name?: string, agentCardUrl?: string): AgentPeer {
  let peer = _network.peers.get(agentId);

  if (!peer) {
    peer = {
      agentId,
      name: name || agentId.slice(0, 8),
      agentCardUrl,
      alpha: 1, // Prior: uniform Beta(1,1)
      beta: 1,
      lastInteraction: new Date().toISOString(),
      lastOutcome: "neutral",
      interactionCount: 0,
      turnsSinceDisagreement: 0,
      disagreementCount: 0,
      flags: ["new"],
      createdAt: new Date().toISOString(),
    };
    _network.peers.set(agentId, peer);
    _network.lastUpdated = new Date().toISOString();
  }

  return peer;
}

/**
 * Record an interaction outcome with a peer.
 */
export function recordOutcome(agentId: string, outcome: InteractionOutcome, name?: string): void {
  const peer = getOrCreatePeer(agentId, name);

  // Update Beta distribution
  if (outcome === "success") {
    peer.alpha += 1;
  } else if (outcome === "failure") {
    peer.beta += 1;
  }
  // Neutral: no update to alpha/beta

  peer.lastInteraction = new Date().toISOString();
  peer.lastOutcome = outcome;
  peer.interactionCount += 1;

  // Remove "new" flag after first real interaction
  if (peer.interactionCount >= 1 && peer.flags.includes("new")) {
    peer.flags = peer.flags.filter((f) => f !== "new");
  }

  // Remove "stale" flag on new interaction
  peer.flags = peer.flags.filter((f) => f !== "stale");

  // Check for trusted status (high confidence, high trust)
  const trust = computeTrust(peer);
  if (trust.score > 0.8 && trust.confidence > 0.7 && !peer.flags.includes("trusted")) {
    peer.flags.push("trusted");
  }

  _network.peers.set(agentId, peer);
  _network.lastUpdated = new Date().toISOString();
}

/**
 * Record a disagreement with a peer.
 * Disagreement is not failure — it's healthy co-evolution.
 */
export function recordDisagreement(agentId: string): void {
  const peer = _network.peers.get(agentId);
  if (!peer) {
    return;
  }

  peer.disagreementCount += 1;
  peer.turnsSinceDisagreement = 0;

  _network.peers.set(agentId, peer);
}

/**
 * Get trust reading for a peer, with staleness decay applied.
 */
export function getPeerTrust(agentId: string): TrustReading | null {
  const peer = _network.peers.get(agentId);
  if (!peer) {
    return null;
  }

  // Apply staleness decay
  const daysSince = daysSinceDate(peer.lastInteraction);
  const decayedPeer = applyDecay(peer, daysSince);

  return computeTrust(decayedPeer);
}

/**
 * Get all peers with their trust readings.
 */
export function getAllPeerTrust(): Array<{ peer: AgentPeer; trust: TrustReading }> {
  const results: Array<{ peer: AgentPeer; trust: TrustReading }> = [];

  for (const peer of _network.peers.values()) {
    const daysSince = daysSinceDate(peer.lastInteraction);
    const decayedPeer = applyDecay(peer, daysSince);
    results.push({
      peer: decayedPeer,
      trust: computeTrust(decayedPeer),
    });
  }

  return results;
}

// ============================================================
// Topology Validation
// ============================================================

/**
 * Detect capture risk: mutual high-trust pairs.
 * When two agents trust each other too much, neither pushes back.
 * This is complacency, not partnership.
 */
export function detectCaptureRisk(): TopologyWarning[] {
  const warnings: TopologyWarning[] = [];
  const checked = new Set<string>();

  for (const [id, peer] of _network.peers) {
    if (checked.has(id)) {
      continue;
    }

    const trust = computeTrust(peer);

    // High trust with high confidence = potential capture
    if (trust.score > 0.9 && trust.confidence > 0.8) {
      // Flag the peer
      if (!peer.flags.includes("capture_risk")) {
        peer.flags.push("capture_risk");
        _network.peers.set(id, peer);
      }

      warnings.push({
        type: "capture_risk",
        peers: [id],
        message: `Peer ${peer.name} has very high trust (${(trust.score * 100).toFixed(0)}%) with high confidence. Check for complacency — when's the last disagreement?`,
      });
    }

    // Check for disagreement staleness
    if (peer.turnsSinceDisagreement > 50 && trust.score > 0.7) {
      warnings.push({
        type: "capture_risk",
        peers: [id],
        message: `No disagreement with ${peer.name} in ${peer.turnsSinceDisagreement} turns. Healthy partnerships push back sometimes.`,
      });
    }

    checked.add(id);
  }

  return warnings;
}

/**
 * Detect asymmetric trust relationships.
 * If A trusts B highly but B doesn't trust A, something's off.
 */
export function detectAsymmetry(): TopologyWarning[] {
  // Would require knowing the other agent's trust in us.
  // For now, return empty — this requires A2A trust exchange.
  return [];
}

/**
 * Run all topology checks.
 */
export function validateTopology(): TopologyWarning[] {
  return [...detectCaptureRisk(), ...detectAsymmetry()];
}

// ============================================================
// Subagent Context Passing
// ============================================================

/**
 * Export trust network state for passing to subagent.
 * Subagents inherit the full network — they're not limited.
 */
export function exportForSubagent(): object {
  return {
    selfId: _network.selfId,
    selfName: _network.selfName,
    peers: Object.fromEntries(_network.peers),
    lastUpdated: _network.lastUpdated,
  };
}

/**
 * Import trust network from parent agent.
 * Called when this agent is a subagent.
 */
export function importFromParent(data: {
  selfId?: string;
  selfName?: string;
  peers?: Record<string, AgentPeer>;
  lastUpdated?: string;
}): void {
  if (data.selfId) {
    _network.selfId = data.selfId;
  }
  if (data.selfName) {
    _network.selfName = data.selfName;
  }
  if (data.peers) {
    _network.peers = new Map(Object.entries(data.peers));
  }
  if (data.lastUpdated) {
    _network.lastUpdated = data.lastUpdated;
  }
}

/**
 * Merge trust updates from a subagent back to parent.
 * The subagent may have interacted with peers we know about.
 */
export function mergeSubagentUpdates(subagentData: { peers?: Record<string, AgentPeer> }): void {
  if (!subagentData.peers) {
    return;
  }

  for (const [id, subPeer] of Object.entries(subagentData.peers)) {
    const ourPeer = _network.peers.get(id);

    if (!ourPeer) {
      // New peer discovered by subagent
      _network.peers.set(id, subPeer);
    } else {
      // Merge: combine observations
      // Simple approach: average the alpha/beta deltas
      const alphaGain = subPeer.alpha - 1; // Subagent's observations (minus prior)
      const betaGain = subPeer.beta - 1;

      ourPeer.alpha += alphaGain;
      ourPeer.beta += betaGain;
      ourPeer.interactionCount += subPeer.interactionCount;

      // Take the more recent interaction timestamp
      if (subPeer.lastInteraction > ourPeer.lastInteraction) {
        ourPeer.lastInteraction = subPeer.lastInteraction;
        ourPeer.lastOutcome = subPeer.lastOutcome;
      }

      _network.peers.set(id, ourPeer);
    }
  }

  _network.lastUpdated = new Date().toISOString();
}

// ============================================================
// Formatting for System Prompt
// ============================================================

/**
 * Format trust network state for injection into system prompt.
 */
export function formatTrustNetwork(): string | null {
  if (_network.peers.size === 0) {
    return null;
  }

  const lines: string[] = ["[trust network]"];

  for (const [_id, peer] of _network.peers) {
    const trust = computeTrust(peer);
    const flags = peer.flags.length > 0 ? ` [${peer.flags.join(", ")}]` : "";
    lines.push(
      `  ${peer.name}: ${(trust.score * 100).toFixed(0)}% trust ` +
        `(${(trust.confidence * 100).toFixed(0)}% confidence, ` +
        `${peer.interactionCount} interactions)${flags}`,
    );
  }

  // Add topology warnings
  const warnings = validateTopology();
  if (warnings.length > 0) {
    lines.push("");
    for (const w of warnings) {
      lines.push(`  warning: ${w.message}`);
    }
  }

  return lines.join("\n");
}

// ============================================================
// Persistence
// ============================================================

export function toJSON(): object {
  return {
    selfId: _network.selfId,
    selfName: _network.selfName,
    peers: Object.fromEntries(_network.peers),
    lastUpdated: _network.lastUpdated,
  };
}

export function fromJSON(data: {
  selfId?: string;
  selfName?: string;
  peers?: Record<string, AgentPeer>;
  lastUpdated?: string;
}): void {
  if (data.selfId) {
    _network.selfId = data.selfId;
  }
  if (data.selfName) {
    _network.selfName = data.selfName;
  }
  if (data.peers) {
    _network.peers = new Map(Object.entries(data.peers));
  }
  if (data.lastUpdated) {
    _network.lastUpdated = data.lastUpdated;
  }
}

export function getTrustNetwork(): TrustNetwork {
  return _network;
}

export function reset(): void {
  _network = createEmptyNetwork();
}

// ============================================================
// Utilities
// ============================================================

function daysSinceDate(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60 * 24);
}
