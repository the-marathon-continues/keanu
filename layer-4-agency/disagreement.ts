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
// Need: Agency (7/10)

import type { Disagreement, DisagreementOutcome, DisagreementStats } from "../shared/types.ts";

export class DisagreementTracker {
  private disagreements: Disagreement[] = [];

  constructor(initial?: Disagreement[]) {
    if (initial) {
      this.disagreements = [...initial];
    }
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
    if (!d) {
      return false;
    }
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

// ============================================================
// Proactive Anti-Capture Detection (CLAWDBOT Meta-Skills)
// ============================================================

// Patterns that suggest Drew is deferring when he should decide
const DEFERRAL_PATTERNS = [
  /\bwhat do you think I should\b/i,
  /\byou decide\b/i,
  /\bjust do whatever you think\b/i,
  /\bi'll trust your judgment\b/i,
  /\byou're the expert\b/i,
  /\bi'm not sure,? you pick\b/i,
  /\bup to you\b/i,
  /\bwhatever you recommend\b/i,
];

// Topics where human should own the decision
const HUMAN_DECISION_DOMAINS = [
  /\b(salary|compensation|hiring|firing|budget|money|investment)\b/i,
  /\b(personal|family|relationship|health|medical)\b/i,
  /\b(legal|contract|agreement|terms)\b/i,
  /\b(strategy|direction|vision|mission|values)\b/i,
  /\b(architecture|major refactor|migration|rewrite)\b/i,
  /\b(user data|privacy|security|permissions)\b/i,
];

export interface AntiCaptureReading {
  captureRisk: boolean;
  riskType: "deferral" | "high_yield_ratio" | "comfort_seeking" | null;
  humanShouldDecide: boolean;
  domain: string | null;
  injection: string | null;
}

/**
 * Detect when Drew is deferring on something he should own.
 * Proactive anti-capture: redirect decision back to human.
 */
export function checkAntiCapture(
  humanMessage: string,
  tracker: DisagreementTracker,
  totalTurns: number,
): AntiCaptureReading {
  // Check for deferral patterns
  const isDeferring = DEFERRAL_PATTERNS.some((p) => p.test(humanMessage));

  // Check if this is a human-decision domain
  let domain: string | null = null;
  for (const p of HUMAN_DECISION_DOMAINS) {
    const match = humanMessage.match(p);
    if (match) {
      domain = match[1].toLowerCase();
      break;
    }
  }

  // Check yield ratio for ongoing capture risk
  const stats = tracker.stats();
  const highYieldRatio = stats.total >= 3 && stats.yield_ratio > 0.7;

  // Comfort-seeking: no disagreements in a while, Drew always accepting
  const comfortSeeking = totalTurns > 10 && stats.total === 0 && humanMessage.length < 50;

  // Determine risk type
  let riskType: AntiCaptureReading["riskType"] = null;
  let captureRisk = false;

  if (isDeferring && domain) {
    riskType = "deferral";
    captureRisk = true;
  } else if (highYieldRatio) {
    riskType = "high_yield_ratio";
    captureRisk = true;
  } else if (comfortSeeking) {
    riskType = "comfort_seeking";
    captureRisk = true;
  }

  // Generate injection
  let injection: string | null = null;

  if (riskType === "deferral" && domain) {
    injection = `[anti-capture: Drew is deferring on ${domain}. This is a human decision. I can inform, but you should decide.]`;
  } else if (riskType === "high_yield_ratio") {
    injection = `[anti-capture: yield ratio is ${(stats.yield_ratio * 100).toFixed(0)}%. I'm agreeing too much. Next disagreement, hold position longer.]`;
  } else if (riskType === "comfort_seeking") {
    injection = `[anti-capture: comfort zone detected. No disagreements in ${totalTurns} turns. Find something worth pushing back on.]`;
  }

  return {
    captureRisk,
    riskType,
    humanShouldDecide: isDeferring && domain !== null,
    domain,
    injection,
  };
}

/**
 * Format anti-capture alert for human-facing output.
 */
export function formatAntiCapture(reading: AntiCaptureReading): string | null {
  if (!reading.humanShouldDecide) {
    return null;
  }

  return `I can provide information, but this ${reading.domain} decision should be yours. What are the factors you're weighing?`;
}
