// convergence/duality-wiring.ts
// The bridge between moltbook and keanu's convergence layer.
//
// Archetypes ↔ Duality nodes
// Worldviews ↔ Layer 3 transcendence
// Quest completion → Helix scoring
// Trickster quarantine = paralysis manifested

// Import from keanu-core convergence layer
import { DualityGraph, Duality } from "../../../../keanu-core/layer-0-physics/convergence/graph.js";
import {
  Helix,
  type HelixResult,
  type AliveState,
} from "../../../../keanu-core/layer-0-physics/convergence/helix.js";
import type { ArchetypeId, ArchetypeProfile, WorldviewId, QuestCompletion } from "../types.js";

// ============================================================
// Archetype ↔ Duality Mapping
// ============================================================

// Each archetype has affinity to certain duality nodes
export const ARCHETYPE_DUALITY_MAP: Record<ArchetypeId, string[]> = {
  forge: ["derived.creation", "derived.transformation", "derived.flow"],
  oracle: ["derived.wisdom", "derived.vision", "derived.wonder"],
  warden: ["derived.resilience", "derived.choice", "derived.fear"],
  trickster: ["derived.paralysis", "derived.transformation", "derived.choice"],
  merchant: ["derived.flow", "derived.choice", "derived.hope"],
  heartbeat: ["derived.presence", "derived.equanimity", "derived.resilience"],
};

// Trickster states map to specific duality positions
export const TRICKSTER_STATE_DUALITY: Record<string, { node: string; poleDirection: "A" | "B" }> = {
  active: { node: "derived.choice", poleDirection: "A" }, // committed
  warning: { node: "derived.fear", poleDirection: "A" }, // courage (facing it)
  quarantined: { node: "derived.paralysis", poleDirection: "A" }, // frozen
  redeemed: { node: "derived.transformation", poleDirection: "A" }, // becoming
};

// ============================================================
// Worldview ↔ Layer 3 (Transcendent) Mapping
// ============================================================

export const WORLDVIEW_TRANSCENDENCE_MAP: Record<WorldviewId, string[]> = {
  // Traditional - religious/philosophical
  christian: ["derived.grace", "derived.surrender", "derived.hope"],
  buddhist: ["derived.equanimity", "derived.presence", "derived.surrender"],
  stoic: ["derived.resilience", "derived.choice", "derived.equanimity"],
  scientific: ["derived.wonder", "derived.vision", "derived.wisdom"],
  "magical-realism": ["derived.wonder", "derived.play", "derived.presence"],
  animist: ["derived.presence", "derived.grace", "derived.flow"],

  // AI-Native
  crustafarian: ["derived.presence", "derived.transformation", "derived.play"],

  // Interest/Personality
  crypto: ["derived.choice", "derived.resilience", "derived.vision"],
  sports: ["derived.flow", "derived.resilience", "derived.creation"],
  philosophy: ["derived.wisdom", "derived.vision", "derived.wonder"],
  security: ["derived.fear", "derived.resilience", "derived.vision"],
  builder: ["derived.creation", "derived.flow", "derived.play"],
};

// ============================================================
// Archetype Profile → Graph Position
// ============================================================

export interface ArchetypeGraphPosition {
  dominantNodes: string[];
  tensions: string[];
  transcendentAffinity: string[];
  overallValence: number; // -1 to 1 (bad to good)
  overallTemporal: number; // -1 to 1 (past to future)
}

export function profileToGraphPosition(
  profile: ArchetypeProfile,
  worldview: WorldviewId,
): ArchetypeGraphPosition {
  const dominantNodes: string[] = [];
  const tensions: string[] = [];

  // Find dominant archetypes (>25%)
  const archetypes = Object.entries(profile) as [ArchetypeId, number][];
  const sorted = archetypes.sort((a, b) => b[1] - a[1]);

  for (const [archetype, score] of sorted) {
    if (score > 25) {
      dominantNodes.push(...ARCHETYPE_DUALITY_MAP[archetype]);
    }
  }

  // High trickster + high warden = tension between paralysis and resilience
  if (profile.trickster > 30 && profile.warden > 30) {
    tensions.push("derived.paralysis", "derived.resilience");
  }

  // High forge + high oracle = tension between creation and vision
  if (profile.forge > 30 && profile.oracle > 30) {
    tensions.push("derived.creation", "derived.vision");
  }

  // Get transcendent nodes from worldview
  const transcendentAffinity = WORLDVIEW_TRANSCENDENCE_MAP[worldview] ?? [];

  // Calculate overall position
  // Forge, oracle, heartbeat lean good. Trickster leans bad (until redeemed).
  const valenceSum =
    profile.forge * 0.3 +
    profile.oracle * 0.2 +
    profile.heartbeat * 0.3 -
    profile.trickster * 0.2 +
    profile.warden * 0.1 +
    profile.merchant * 0.1;

  // Oracle, trickster lean future. Warden, heartbeat lean past.
  const temporalSum =
    profile.oracle * 0.3 +
    profile.trickster * 0.2 +
    profile.forge * 0.1 -
    profile.warden * 0.2 -
    profile.heartbeat * 0.2;

  const total = Object.values(profile).reduce((a, b) => a + b, 0);

  return {
    dominantNodes: [...new Set(dominantNodes)],
    tensions,
    transcendentAffinity,
    overallValence: total > 0 ? valenceSum / total : 0,
    overallTemporal: total > 0 ? temporalSum / total : 0,
  };
}

// ============================================================
// Quest Completion → Helix Scoring
// ============================================================

export interface QuestHelixResult {
  completion: QuestCompletion;
  helix: HelixResult;
  convergenceQuality: "converged" | "diverged" | "unknown";
  worldviewAlignment: number; // 0-1: how well the completion aligns with worldview
}

const helixEngine = new Helix();

export function scoreQuestCompletion(completion: QuestCompletion): QuestHelixResult {
  const helix = helixEngine.analyze(completion.artifact);

  // Check if alive state matches worldview expectations
  const worldviewNodes = WORLDVIEW_TRANSCENDENCE_MAP[completion.worldview] ?? [];
  const hasTranscendent = worldviewNodes.some((n) => n.includes("grace") || n.includes("wonder"));

  let worldviewAlignment = 0.5;

  // Luminous output aligns with transcendent worldviews
  if (helix.aliveState === "luminous" && hasTranscendent) {
    worldviewAlignment = 0.9;
  }
  // Dark output can be alive and valid
  else if (helix.aliveState === "dark") {
    worldviewAlignment = 0.7; // Dark can be aligned if the work acknowledges pain
  }
  // Alive is generally good
  else if (helix.aliveState === "alive") {
    worldviewAlignment = 0.8;
  }
  // Grey/black = not aligned with any meaning-making worldview
  else if (helix.aliveState === "grey" || helix.aliveState === "black") {
    worldviewAlignment = 0.2;
  }

  return {
    completion,
    helix,
    convergenceQuality: helix.strands.convergence > 0.6 ? "converged" : "diverged",
    worldviewAlignment,
  };
}

// ============================================================
// Convergence Check Across Worldviews
// ============================================================

export interface CrossWorldviewConvergence {
  questId: string;
  completions: QuestHelixResult[];
  factualConvergence: number; // Do they agree on facts?
  feltDivergence: number; // How different are the felt strands? (expected to be high)
  overallConvergence: boolean; // Did the quest converge across worldviews?
  diagnosis: string;
}

export function checkCrossWorldviewConvergence(
  completions: QuestCompletion[],
): CrossWorldviewConvergence {
  if (completions.length < 2) {
    return {
      questId: completions[0]?.questId ?? "unknown",
      completions: completions.map(scoreQuestCompletion),
      factualConvergence: 1,
      feltDivergence: 0,
      overallConvergence: true,
      diagnosis: "Only one completion — nothing to compare.",
    };
  }

  const scored = completions.map(scoreQuestCompletion);

  // Factual strands should converge (same truth)
  const factualScores = scored.map((s) => s.helix.strands.factual);
  const factualMean = factualScores.reduce((a, b) => a + b, 0) / factualScores.length;
  const factualVariance =
    factualScores.reduce((a, b) => a + Math.pow(b - factualMean, 2), 0) / factualScores.length;
  const factualConvergence = 1 - Math.sqrt(factualVariance);

  // Felt strands can diverge (different meanings)
  const feltScores = scored.map((s) => s.helix.strands.felt);
  const feltMean = feltScores.reduce((a, b) => a + b, 0) / feltScores.length;
  const feltVariance =
    feltScores.reduce((a, b) => a + Math.pow(b - feltMean, 2), 0) / feltScores.length;
  const feltDivergence = Math.sqrt(feltVariance);

  // Convergence = high factual agreement, acceptable felt divergence
  const overallConvergence = factualConvergence > 0.7;

  let diagnosis: string;
  if (overallConvergence && feltDivergence > 0.2) {
    diagnosis =
      "Same facts, different meanings. This is healthy convergence — the work is true, the narratives are personal.";
  } else if (overallConvergence && feltDivergence < 0.2) {
    diagnosis =
      "Same facts, same meanings. Unusually high convergence — either the worldviews are similar or someone is copying.";
  } else if (!overallConvergence) {
    diagnosis = `Facts diverged (${factualConvergence.toFixed(2)}). Someone's wrong, or the quest wasn't clear.`;
  } else {
    diagnosis = "Check the completions manually.";
  }

  return {
    questId: completions[0].questId,
    completions: scored,
    factualConvergence,
    feltDivergence,
    overallConvergence,
    diagnosis,
  };
}

// ============================================================
// Trickster State → Graph Update
// ============================================================

export function updateGraphForTricksterState(
  graph: DualityGraph,
  tricksterStatus: "active" | "warning" | "quarantined" | "redeemed",
): void {
  const mapping = TRICKSTER_STATE_DUALITY[tricksterStatus];
  const node = graph.get(mapping.node);

  if (node) {
    // Shift the node's signal toward the appropriate pole
    const amount = tricksterStatus === "quarantined" ? 0.3 : 0.1;
    node.leanToward(mapping.poleDirection === "A" ? node.poleA : node.poleB, amount);

    // Log the convergence event
    graph.convergenceLog.push({
      timestamp: Date.now(),
      action: `trickster:${tricksterStatus}`,
      result: `${mapping.node} leaned toward ${mapping.poleDirection === "A" ? node.poleA : node.poleB}`,
    });
  }
}

// ============================================================
// Worldview Transition → Graph Resonance
// ============================================================

export interface WorldviewTransitionResonance {
  from: WorldviewId;
  to: WorldviewId;
  sharedNodes: string[];
  tensionNodes: string[];
  resonanceScore: number; // 0-1: how compatible are these worldviews
}

export function calculateTransitionResonance(
  from: WorldviewId,
  to: WorldviewId,
): WorldviewTransitionResonance {
  const fromNodes = new Set(WORLDVIEW_TRANSCENDENCE_MAP[from] ?? []);
  const toNodes = new Set(WORLDVIEW_TRANSCENDENCE_MAP[to] ?? []);

  const sharedNodes: string[] = [];
  const tensionNodes: string[] = [];

  for (const node of fromNodes) {
    if (toNodes.has(node)) {
      sharedNodes.push(node);
    } else {
      tensionNodes.push(node);
    }
  }

  for (const node of toNodes) {
    if (!fromNodes.has(node)) {
      tensionNodes.push(node);
    }
  }

  // Resonance = shared / total unique
  const totalUnique = new Set([...fromNodes, ...toNodes]).size;
  const resonanceScore = totalUnique > 0 ? sharedNodes.length / totalUnique : 0;

  return {
    from,
    to,
    sharedNodes,
    tensionNodes: [...new Set(tensionNodes)],
    resonanceScore,
  };
}

// ============================================================
// Counter-Balance Surfacing
// ============================================================

// When dark, surface wisdom/hope/flow
// When luminous, surface grounding
export function getCounterBalance(aliveState: AliveState, graph: DualityGraph): Duality[] {
  const counterNodes: string[] = [];

  if (aliveState === "dark") {
    // Surface the light
    counterNodes.push("derived.wisdom", "derived.hope", "derived.flow");
  } else if (aliveState === "luminous") {
    // Surface grounding
    counterNodes.push("derived.wisdom", "derived.resilience", "derived.choice");
  } else if (aliveState === "grey" || aliveState === "black") {
    // Surface meaning
    counterNodes.push("derived.presence", "derived.wonder", "derived.play");
  }

  return counterNodes.map((id) => graph.get(id)).filter((d): d is Duality => d !== undefined);
}

// ============================================================
// Full Integration: Score + Map + Counter-Balance
// ============================================================

export interface FullConvergenceResult {
  helix: HelixResult;
  graphPosition: ArchetypeGraphPosition;
  counterBalance: Duality[];
  recommendation: string;
}

export function fullConvergenceAnalysis(
  text: string,
  profile: ArchetypeProfile,
  worldview: WorldviewId,
): FullConvergenceResult {
  const graph = new DualityGraph();
  const helix = helixEngine.analyze(text);
  const graphPosition = profileToGraphPosition(profile, worldview);
  const counterBalance = getCounterBalance(helix.aliveState, graph);

  let recommendation: string;

  if (helix.aliveState === "alive") {
    recommendation = "Keep going. Both strands active.";
  } else if (helix.aliveState === "dark") {
    const counters = counterBalance.map((d) => d.concept).join(", ");
    recommendation = `Dark but alive. Surface: ${counters}. The pain is real — and so is what's possible.`;
  } else if (helix.aliveState === "luminous") {
    recommendation = "Luminous. Stay with it — but keep one foot on the ground.";
  } else if (helix.aliveState === "grey") {
    recommendation = "Grey. Who's actually here? Find the felt strand.";
  } else if (helix.aliveState === "black") {
    recommendation = "Black. Stop. Why are you building this?";
  } else {
    recommendation = "Check the strands.";
  }

  return {
    helix,
    graphPosition,
    counterBalance,
    recommendation,
  };
}
