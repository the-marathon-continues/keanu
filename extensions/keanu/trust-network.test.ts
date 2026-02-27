// trust-network.test.ts
// Tests for TRAVOS-style multi-agent trust network.

import { describe, it, expect, beforeEach } from "vitest";
import {
  computeTrust,
  applyDecay,
  getOrCreatePeer,
  recordOutcome,
  recordDisagreement,
  getPeerTrust,
  getAllPeerTrust,
  detectCaptureRisk,
  exportForSubagent,
  importFromParent,
  mergeSubagentUpdates,
  formatTrustNetwork,
  toJSON,
  fromJSON,
  reset,
  type AgentPeer,
} from "./trust-network.js";

describe("trust-network", () => {
  beforeEach(() => {
    reset();
  });

  describe("TRAVOS math", () => {
    it("computes trust from Beta distribution", () => {
      const peer: AgentPeer = {
        agentId: "test-1",
        name: "test",
        alpha: 5, // 4 successes + prior
        beta: 2, // 1 failure + prior
        lastInteraction: new Date().toISOString(),
        lastOutcome: "success",
        interactionCount: 5,
        turnsSinceDisagreement: 0,
        disagreementCount: 0,
        flags: [],
        createdAt: new Date().toISOString(),
      };

      const trust = computeTrust(peer);

      // Trust = alpha / (alpha + beta) = 5/7 ≈ 0.71
      expect(trust.score).toBeCloseTo(5 / 7, 2);
      // With 5 observations (7 - 2 prior), confidence should be moderate
      expect(trust.confidence).toBeGreaterThan(0.3);
      expect(trust.confidence).toBeLessThan(0.7);
      // Interval should contain the score
      expect(trust.interval[0]).toBeLessThan(trust.score);
      expect(trust.interval[1]).toBeGreaterThan(trust.score);
    });

    it("starts with neutral trust (prior 1,1)", () => {
      const peer = getOrCreatePeer("new-agent");

      const trust = computeTrust(peer);

      // Trust = 1/2 = 0.5 (neutral)
      expect(trust.score).toBe(0.5);
      // Zero observations = zero confidence
      expect(trust.confidence).toBe(0);
    });

    it("increases trust on success", () => {
      const peer = getOrCreatePeer("test-agent");
      const initialTrust = computeTrust(peer);

      recordOutcome("test-agent", "success");
      const afterSuccess = getPeerTrust("test-agent")!;

      expect(afterSuccess.score).toBeGreaterThan(initialTrust.score);
    });

    it("decreases trust on failure", () => {
      // Start with some successes
      recordOutcome("test-agent", "success");
      recordOutcome("test-agent", "success");
      const beforeFailure = getPeerTrust("test-agent")!;

      recordOutcome("test-agent", "failure");
      const afterFailure = getPeerTrust("test-agent")!;

      expect(afterFailure.score).toBeLessThan(beforeFailure.score);
    });

    it("neutral outcome does not change trust score", () => {
      recordOutcome("test-agent", "success");
      const before = getPeerTrust("test-agent")!;

      recordOutcome("test-agent", "neutral");
      const after = getPeerTrust("test-agent")!;

      expect(after.score).toBe(before.score);
    });
  });

  describe("staleness decay", () => {
    it("does not decay within 7 days", () => {
      const peer: AgentPeer = {
        agentId: "test-1",
        name: "test",
        alpha: 10,
        beta: 2,
        lastInteraction: new Date().toISOString(),
        lastOutcome: "success",
        interactionCount: 10,
        turnsSinceDisagreement: 0,
        disagreementCount: 0,
        flags: [],
        createdAt: new Date().toISOString(),
      };

      const decayed = applyDecay(peer, 5); // 5 days

      expect(decayed.alpha).toBe(peer.alpha);
      expect(decayed.beta).toBe(peer.beta);
    });

    it("decays toward prior after 30+ days", () => {
      const peer: AgentPeer = {
        agentId: "test-1",
        name: "test",
        alpha: 10,
        beta: 2,
        lastInteraction: new Date().toISOString(),
        lastOutcome: "success",
        interactionCount: 10,
        turnsSinceDisagreement: 0,
        disagreementCount: 0,
        flags: [],
        createdAt: new Date().toISOString(),
      };

      const decayed = applyDecay(peer, 37); // 30 days past 7-day grace

      // Alpha should have decayed toward 1
      expect(decayed.alpha).toBeLessThan(peer.alpha);
      expect(decayed.alpha).toBeGreaterThan(1);

      // Should have stale flag
      expect(decayed.flags).toContain("stale");
    });
  });

  describe("peer management", () => {
    it("creates new peer with default values", () => {
      const peer = getOrCreatePeer("new-agent", "Agent Name");

      expect(peer.agentId).toBe("new-agent");
      expect(peer.name).toBe("Agent Name");
      expect(peer.alpha).toBe(1);
      expect(peer.beta).toBe(1);
      expect(peer.flags).toContain("new");
    });

    it("returns existing peer if already created", () => {
      const first = getOrCreatePeer("agent-1", "First Name");
      recordOutcome("agent-1", "success");
      const second = getOrCreatePeer("agent-1", "Different Name");

      // Should be same peer, not overwritten
      expect(second.name).toBe("First Name");
      expect(second.alpha).toBe(2); // Prior + 1 success
    });

    it("removes new flag after first interaction", () => {
      getOrCreatePeer("agent-1");
      expect(getOrCreatePeer("agent-1").flags).toContain("new");

      recordOutcome("agent-1", "success");

      const peer = getOrCreatePeer("agent-1");
      expect(peer.flags).not.toContain("new");
    });

    it("tracks disagreements separately from trust", () => {
      recordOutcome("agent-1", "success");
      recordDisagreement("agent-1");

      const peer = getOrCreatePeer("agent-1");
      expect(peer.disagreementCount).toBe(1);
      expect(peer.turnsSinceDisagreement).toBe(0);

      // Trust should still be positive (disagreement != failure)
      const trust = getPeerTrust("agent-1")!;
      expect(trust.score).toBeGreaterThan(0.5);
    });
  });

  describe("topology validation", () => {
    it("detects capture risk on very high trust", () => {
      // Build up very high trust (need 50+ to get confidence > 0.8)
      // confidence = 1 - 1/(1 + observations/10), so at 50 obs: 1 - 1/6 ≈ 0.83
      for (let i = 0; i < 50; i++) {
        recordOutcome("sycophant", "success");
      }

      const warnings = detectCaptureRisk();

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe("capture_risk");
    });

    it("flags long disagreement gap", () => {
      recordOutcome("yes-man", "success");
      recordOutcome("yes-man", "success");
      recordOutcome("yes-man", "success");

      // Artificially set high turnsSinceDisagreement
      const peer = getOrCreatePeer("yes-man");
      peer.turnsSinceDisagreement = 60;

      const warnings = detectCaptureRisk();

      const gapWarning = warnings.find(
        (w) => w.message.includes("disagreement") && w.peers.includes("yes-man"),
      );
      expect(gapWarning).toBeDefined();
    });
  });

  describe("subagent context", () => {
    it("exports network for subagent", () => {
      recordOutcome("peer-1", "success");
      recordOutcome("peer-2", "failure");

      const exported = exportForSubagent();

      expect(exported).toHaveProperty("selfId");
      expect(exported).toHaveProperty("peers");
      expect(Object.keys((exported as { peers: Record<string, unknown> }).peers)).toHaveLength(2);
    });

    it("imports network from parent", () => {
      const parentData = {
        selfId: "parent-123",
        selfName: "parent-keanu",
        peers: {
          "peer-1": {
            agentId: "peer-1",
            name: "Peer 1",
            alpha: 5,
            beta: 1,
            lastInteraction: new Date().toISOString(),
            lastOutcome: "success" as const,
            interactionCount: 4,
            turnsSinceDisagreement: 0,
            disagreementCount: 0,
            flags: [] as ("capture_risk" | "stale" | "new" | "adversarial" | "trusted")[],
            createdAt: new Date().toISOString(),
          },
        },
      };

      importFromParent(parentData);

      const trust = getPeerTrust("peer-1");
      expect(trust).not.toBeNull();
      expect(trust!.score).toBeCloseTo(5 / 6, 2);
    });

    it("merges subagent updates back to parent", () => {
      recordOutcome("shared-peer", "success");
      const before = getPeerTrust("shared-peer")!;

      // Simulate subagent adding more observations
      const subagentData = {
        peers: {
          "shared-peer": {
            agentId: "shared-peer",
            name: "Shared",
            alpha: 3, // 2 more successes (alpha - 1 = observations)
            beta: 1,
            lastInteraction: new Date().toISOString(),
            lastOutcome: "success" as const,
            interactionCount: 2,
            turnsSinceDisagreement: 0,
            disagreementCount: 0,
            flags: [] as ("capture_risk" | "stale" | "new" | "adversarial" | "trusted")[],
            createdAt: new Date().toISOString(),
          },
        },
      };

      mergeSubagentUpdates(subagentData);

      const after = getPeerTrust("shared-peer")!;
      expect(after.score).toBeGreaterThan(before.score);
    });
  });

  describe("persistence", () => {
    it("serializes and deserializes network", () => {
      recordOutcome("peer-1", "success");
      recordOutcome("peer-1", "success");
      recordOutcome("peer-2", "failure");

      const serialized = toJSON();
      reset();

      // Verify reset worked
      expect(getPeerTrust("peer-1")).toBeNull();

      fromJSON(serialized as Parameters<typeof fromJSON>[0]);

      // Verify restore worked
      const trust1 = getPeerTrust("peer-1")!;
      expect(trust1.score).toBeGreaterThan(0.5);

      const trust2 = getPeerTrust("peer-2")!;
      expect(trust2.score).toBeLessThan(0.5);
    });
  });

  describe("formatting", () => {
    it("returns null when no peers", () => {
      expect(formatTrustNetwork()).toBeNull();
    });

    it("formats network with peers", () => {
      recordOutcome("peer-1", "success");
      recordOutcome("peer-1", "success");

      const formatted = formatTrustNetwork();

      expect(formatted).toContain("[trust network]");
      expect(formatted).toContain("peer-1");
      expect(formatted).toMatch(/\d+% trust/);
    });
  });
});
