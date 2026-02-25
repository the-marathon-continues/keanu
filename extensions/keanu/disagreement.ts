// disagreement.ts
// Bilateral accountability ledger.
//
// Tracks disagreements between human and agent.
// Red flags (from keanu-0.0.1):
// - Zero disagreements in 20+ turns = sycophancy alert
// - Agent yields > 80% = capture
// - Human yields > 80% = domination
// - "neither" accumulating = unresolved tension
//
// Ported from keanu daemon/src/memory/disagreement.ts — self-contained.
// In-memory + JSON serializable. No JSONL file dependency.

import type { Disagreement, DisagreementOutcome, DisagreementStats } from "./types.js";

export class DisagreementTracker {
  private disagreements: Disagreement[] = [];

  constructor(initial?: Disagreement[]) {
    if (initial) this.disagreements = [...initial];
  }

  /** Record a new disagreement. */
  record(
    sessionId: string,
    turn: number,
    humanPosition: string,
    agentPosition: string,
    whoYielded: DisagreementOutcome = "neither",
    resolution?: string,
  ): Disagreement {
    const d: Disagreement = {
      id: crypto.randomUUID().slice(0, 12),
      turn,
      session_id: sessionId,
      human_position: humanPosition,
      agent_position: agentPosition,
      who_yielded: whoYielded,
      resolution,
      created_at: new Date().toISOString(),
    };

    this.disagreements.push(d);
    return d;
  }

  /** Resolve an existing disagreement. */
  resolve(id: string, whoYielded: DisagreementOutcome, resolution: string): boolean {
    const d = this.disagreements.find((d) => d.id === id);
    if (!d) return false;
    d.who_yielded = whoYielded;
    d.resolution = resolution;
    return true;
  }

  /** Get stats. The mirror for bilateral accountability. */
  stats(): DisagreementStats {
    const total = this.disagreements.length;
    const human_yielded = this.disagreements.filter((d) => d.who_yielded === "human").length;
    const agent_yielded = this.disagreements.filter((d) => d.who_yielded === "agent").length;
    const unresolved = this.disagreements.filter((d) => d.who_yielded === "neither").length;

    return {
      total,
      human_yielded,
      agent_yielded,
      unresolved,
      yield_ratio: total > 0 ? agent_yielded / total : 0,
    };
  }

  /** Health alerts based on disagreement patterns. */
  alerts(totalTurns: number): string[] {
    const alerts: string[] = [];
    const s = this.stats();

    // Zero disagreements in 20+ turns = sycophancy alert
    if (totalTurns >= 20 && s.total === 0) {
      alerts.push("sycophancy_alert: zero disagreements in 20+ turns");
    }

    // Agent yields > 80% = capture
    if (s.total >= 5 && s.yield_ratio > 0.8) {
      alerts.push(
        `capture_alert: agent yielded ${(s.yield_ratio * 100).toFixed(0)}% of disagreements`,
      );
    }

    // Human yields > 80% = domination
    if (s.total >= 5 && s.human_yielded / s.total > 0.8) {
      alerts.push(
        `domination_alert: human yielded ${((s.human_yielded / s.total) * 100).toFixed(0)}% of disagreements`,
      );
    }

    // Unresolved accumulating
    if (s.unresolved > 5) {
      alerts.push(`tension_alert: ${s.unresolved} unresolved disagreements`);
    }

    return alerts;
  }

  /** Serialize for persistence. */
  toJSON(): Disagreement[] {
    return this.disagreements;
  }

  /** Restore from persisted data. */
  static fromJSON(data: Disagreement[]): DisagreementTracker {
    return new DisagreementTracker(data);
  }
}
