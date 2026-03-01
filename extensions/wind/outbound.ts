/**
 * outbound.ts
 * Learnings flow from keanu (L1-L6) to world-book (L7-L9).
 *
 * At session_end, Wind gathers:
 * - Reflexions (what we stumbled on)
 * - Grievances (what hurt but shouldn't fester)
 * - Contradictions (what we changed our mind about)
 * - Blind spots (patterns we keep missing)
 *
 * These are persisted to awareness/wind-outbound.jsonl for L7 to process.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import * as silverado from "../../keanu-core/layer-3-causal/silverado.js";
import * as grievance from "../../keanu-core/layer-5-self/grievance.js";
// Import from keanu modules for session state access
import { reflexions } from "../../keanu-core/layer-5-self/state.js";
import * as mastery from "../../keanu-core/layer-7-update/mastery.js";

// ============================================================
// Types
// ============================================================

export interface OutboundPayload {
  timestamp: string;
  sessionId: string;
  reflexions: ReflexionSummary[];
  grievances: GrievanceSummary[];
  contradictions: ContradictionSummary[];
  blindSpots: BlindSpotSummary[];
}

interface ReflexionSummary {
  trigger: string;
  whatHappened: string;
  nextTime: string;
}

interface GrievanceSummary {
  type: string;
  description: string;
  resolved: boolean;
}

interface ContradictionSummary {
  original: string;
  contradictedBy: string;
  turn: number;
}

interface BlindSpotSummary {
  category: string;
  count: number;
}

// ============================================================
// Outbound flow
// ============================================================

/**
 * Gather learnings from the current session.
 */
async function gather(): Promise<OutboundPayload | null> {
  const reflexionSummaries = reflexions.map((r) => ({
    trigger: r.trigger,
    whatHappened: r.what_happened,
    nextTime: r.next_time,
  }));

  const grievanceSummaries = grievance.getGrievances().map((g) => ({
    type: g.type,
    description: g.description,
    resolved: g.resolved,
  }));

  const contradictions = silverado
    .contradictedClaims()
    .slice(-10)
    .map((c) => ({
      original: c.text.slice(0, 100),
      contradictedBy: c.contradictedBy ?? "unknown",
      turn: c.turn,
    }));

  const blindSpots = mastery.getBlindSpots().map((b) => ({
    category: b.category,
    count: b.count,
  }));

  // Only create payload if there's something to report
  if (
    reflexionSummaries.length === 0 &&
    grievanceSummaries.length === 0 &&
    contradictions.length === 0 &&
    blindSpots.length === 0
  ) {
    return null;
  }

  return {
    timestamp: new Date().toISOString(),
    sessionId: `session-${Date.now()}`, // TODO: get actual session ID
    reflexions: reflexionSummaries,
    grievances: grievanceSummaries,
    contradictions,
    blindSpots,
  };
}

/**
 * Flush outbound learnings to disk for L7 to pick up.
 */
async function flush(workspaceDir: string, payload: OutboundPayload): Promise<void> {
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });

  const file = join(dir, "wind-outbound.jsonl");
  const line = JSON.stringify(payload) + "\n";

  await writeFile(file, line, { flag: "a" });
}

export const outboundFlow = {
  gather,
  flush,
};
