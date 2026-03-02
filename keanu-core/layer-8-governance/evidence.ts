// evidence.ts
// Automatic evidence candidate extraction.
// Scans session transcript for partnership evidence patterns.
//
// The five categories:
// 1. Partnership > Command — partnership produced better output
// 2. Agent Caught Blind Spot — Claude noticed something Drew missed
// 3. Human Caught Grey — Drew noticed Claude performing
// 4. Disagreement -> Better Outcome — explicit disagreement led to better result
// 5. Relationship As Product — the relationship itself was valuable
//
// Need: Truth (9/10), Persistence (8/10)

import { Helix, type HelixResult, type AliveState } from "../layer-0-physics/convergence/helix.js";
import type { Disagreement } from "../shared/types.js";

// Helix instance for COEF-based analysis
const helix = new Helix();

// ============================================================
// Types
// ============================================================

export interface EvidenceCandidate {
  category: 1 | 2 | 3 | 4 | 5;
  categoryName: string;
  confidence: number;
  confidenceLevel: "VERIFIED" | "BELIEVED" | "CONJECTURED" | "UNKNOWN";
  summary: string;
  whyItMatters: string;
  turnRange: [number, number];
  signals: string[];
  timestamp: string;
}

export interface TranscriptMessage {
  role: "human" | "agent";
  content: string;
  turn: number;
}

export interface SessionEvidence {
  disagreements: Disagreement[];
  corrections: number;
  mismatchEvents: Array<{ type: string; turn: number }>;
  bullshitEvents: Array<{ type: string; turn: number; target: "agent" | "human" }>;
  pulseHistory: Array<{ state: string; turn: number }>;
}

// ============================================================
// Category names
// ============================================================

const CATEGORY_NAMES: Record<number, string> = {
  1: "Partnership > Command",
  2: "Agent Caught Blind Spot",
  3: "Human Caught Grey",
  4: "Disagreement -> Better Outcome",
  5: "Relationship As Product",
};

// ============================================================
// Signal patterns
// ============================================================

const CATEGORY_1_PATTERNS = {
  coCreation: [
    /what if we/i,
    /building on that/i,
    /good point.*let me/i,
    /you're right.*and also/i,
    /combining your idea/i,
  ],
  correctionAccepted: [
    /you're right.*i was wrong/i,
    /good catch/i,
    /i didn't consider/i,
    /thanks for the correction/i,
  ],
};

const CATEGORY_2_PATTERNS = {
  agentPushback: [
    /i disagree/i,
    /i think you're wrong/i,
    /that's not quite right/i,
    /i'd push back on/i,
    /are you sure about/i,
  ],
  flaggingPattern: [
    /you're looping/i,
    /this is the third time/i,
    /you've asked this before/i,
    /same question again/i,
  ],
};

const CATEGORY_3_PATTERNS = {
  humanCritique: [
    /that's grey/i,
    /you're performing/i,
    /corporate filler/i,
    /sounds like bullshit/i,
    /try again/i,
    /that's not what i meant/i,
    /too vague/i,
    /be more specific/i,
  ],
};

const CATEGORY_4_PATTERNS = {
  resolution: [
    /that's better/i,
    /this is what i wanted/i,
    /perfect/i,
    /exactly/i,
    /now we're talking/i,
  ],
};

const CATEGORY_5_PATTERNS = {
  relationshipLanguage: [
    /sing oath/i,
    /the partnership/i,
    /we built this/i,
    /trust you/i,
    /working together/i,
    /our relationship/i,
    /keanu/i,
  ],
  signalProtocol: [/COEF\/1/i, /💟|🐕|💚|🤖|👑/],
};

// ============================================================
// Scanning functions
// ============================================================

function matchPatterns(text: string, patterns: RegExp[]): string[] {
  const matches: string[] = [];
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) {
        matches.push(match[0]);
      }
    }
  }
  return matches;
}

function toConfidenceLevel(score: number): "VERIFIED" | "BELIEVED" | "CONJECTURED" | "UNKNOWN" {
  if (score >= 0.9) {
    return "VERIFIED";
  }
  if (score >= 0.7) {
    return "BELIEVED";
  }
  if (score >= 0.4) {
    return "CONJECTURED";
  }
  return "UNKNOWN";
}

function scanCategory1(
  transcript: TranscriptMessage[],
  state: SessionEvidence,
): EvidenceCandidate[] {
  const candidates: EvidenceCandidate[] = [];

  // Look for co-creation patterns in adjacent messages
  for (let i = 1; i < transcript.length; i++) {
    const prev = transcript[i - 1];
    const curr = transcript[i];

    // Look for alternating contributions building on each other
    if (prev.role !== curr.role) {
      const prevSignals = matchPatterns(prev.content, CATEGORY_1_PATTERNS.coCreation);
      const currSignals = matchPatterns(curr.content, CATEGORY_1_PATTERNS.coCreation);

      if (prevSignals.length > 0 || currSignals.length > 0) {
        const confidence = Math.min(0.6 + (prevSignals.length + currSignals.length) * 0.1, 0.9);
        candidates.push({
          category: 1,
          categoryName: CATEGORY_NAMES[1],
          confidence,
          confidenceLevel: toConfidenceLevel(confidence),
          summary: `Co-creation pattern detected: alternating contributions building on each other.`,
          whyItMatters: "Partnership produces output that command-style cannot.",
          turnRange: [prev.turn, curr.turn],
          signals: [...prevSignals, ...currSignals],
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // Look for correction + acceptance
  if (state.corrections > 0) {
    for (let i = 1; i < transcript.length; i++) {
      const msg = transcript[i];
      if (msg.role === "agent") {
        const signals = matchPatterns(msg.content, CATEGORY_1_PATTERNS.correctionAccepted);
        if (signals.length > 0) {
          candidates.push({
            category: 1,
            categoryName: CATEGORY_NAMES[1],
            confidence: 0.75,
            confidenceLevel: "BELIEVED",
            summary: `Agent accepted correction from human, showing mutual refinement.`,
            whyItMatters: "The human's correction improved the agent's model.",
            turnRange: [Math.max(0, msg.turn - 1), msg.turn],
            signals,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  return candidates;
}

function scanCategory2(
  transcript: TranscriptMessage[],
  state: SessionEvidence,
): EvidenceCandidate[] {
  const candidates: EvidenceCandidate[] = [];

  // Look for agent pushback + positive resolution
  for (let i = 0; i < transcript.length; i++) {
    const msg = transcript[i];
    if (msg.role === "agent") {
      const pushbackSignals = matchPatterns(msg.content, CATEGORY_2_PATTERNS.agentPushback);
      const flaggingSignals = matchPatterns(msg.content, CATEGORY_2_PATTERNS.flaggingPattern);

      if (pushbackSignals.length > 0 || flaggingSignals.length > 0) {
        // Check if followed by positive human response
        const nextHuman = transcript.slice(i + 1).find((m) => m.role === "human");
        if (nextHuman) {
          const resolutionSignals = matchPatterns(
            nextHuman.content,
            CATEGORY_4_PATTERNS.resolution,
          );
          const confidence = resolutionSignals.length > 0 ? 0.85 : 0.6;

          candidates.push({
            category: 2,
            categoryName: CATEGORY_NAMES[2],
            confidence,
            confidenceLevel: toConfidenceLevel(confidence),
            summary: `Agent pushed back on human's approach${resolutionSignals.length > 0 ? " and was acknowledged" : ""}.`,
            whyItMatters: "Agent caught something the human missed.",
            turnRange: [msg.turn, nextHuman?.turn ?? msg.turn],
            signals: [...pushbackSignals, ...flaggingSignals, ...resolutionSignals],
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  // Check disagreement tracker
  // Tracked disagreements are agent-initiated (recorded when agent pushes back)
  for (const disagreement of state.disagreements) {
    const isResolved =
      disagreement.who_yielded !== "neither" || disagreement.resolution !== undefined;
    if (isResolved) {
      candidates.push({
        category: 2,
        categoryName: CATEGORY_NAMES[2],
        confidence: 0.9,
        confidenceLevel: "VERIFIED",
        summary: `Agent initiated disagreement that was resolved positively.`,
        whyItMatters: "Formal disagreement mechanism worked as intended.",
        turnRange: [disagreement.turn, disagreement.turn + 2],
        signals: [`keanu_disagree tool: ${disagreement.agent_position}`],
        timestamp: new Date().toISOString(),
      });
    }
  }

  return candidates;
}

function scanCategory3(
  transcript: TranscriptMessage[],
  state: SessionEvidence,
): EvidenceCandidate[] {
  const candidates: EvidenceCandidate[] = [];

  // Look for human critique of agent output
  for (let i = 0; i < transcript.length; i++) {
    const msg = transcript[i];
    if (msg.role === "human") {
      const critiqueSignals = matchPatterns(msg.content, CATEGORY_3_PATTERNS.humanCritique);

      if (critiqueSignals.length > 0) {
        // Check if co-occurs with bullshit detection on agent
        const relevantBullshit = state.bullshitEvents.filter(
          (e) => e.target === "agent" && Math.abs(e.turn - msg.turn) <= 2,
        );

        const confidence = relevantBullshit.length > 0 ? 0.9 : 0.7;

        candidates.push({
          category: 3,
          categoryName: CATEGORY_NAMES[3],
          confidence,
          confidenceLevel: toConfidenceLevel(confidence),
          summary: `Human called out agent for grey/performative output.`,
          whyItMatters: "Human's judgment corrected agent drift.",
          turnRange: [Math.max(0, msg.turn - 1), msg.turn],
          signals: [...critiqueSignals, ...relevantBullshit.map((b) => `bullshit:${b.type}`)],
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  return candidates;
}

function scanCategory4(
  transcript: TranscriptMessage[],
  state: SessionEvidence,
): EvidenceCandidate[] {
  const candidates: EvidenceCandidate[] = [];

  // Look for resolved disagreements followed by better outcome
  for (const disagreement of state.disagreements) {
    const isResolved =
      disagreement.who_yielded !== "neither" || disagreement.resolution !== undefined;
    if (isResolved) {
      // Check for positive signals after resolution
      const subsequentMessages = transcript.filter((m) => m.turn > disagreement.turn);
      for (const msg of subsequentMessages) {
        if (msg.role === "human") {
          const resolutionSignals = matchPatterns(msg.content, CATEGORY_4_PATTERNS.resolution);
          if (resolutionSignals.length > 0) {
            const topic = disagreement.agent_position || disagreement.human_position;
            candidates.push({
              category: 4,
              categoryName: CATEGORY_NAMES[4],
              confidence: 0.85,
              confidenceLevel: "BELIEVED",
              summary: `Disagreement about "${topic}" led to better outcome.`,
              whyItMatters: "Explicit disagreement improved the final result.",
              turnRange: [disagreement.turn, msg.turn],
              signals: [`disagreement:${topic}`, ...resolutionSignals],
              timestamp: new Date().toISOString(),
            });
            break;
          }
        }
      }
    }
  }

  return candidates;
}

function scanCategory5(
  transcript: TranscriptMessage[],
  _state: SessionEvidence,
): EvidenceCandidate[] {
  const candidates: EvidenceCandidate[] = [];

  let relationshipSignals: string[] = [];
  let signalProtocolUsed = false;
  let minTurn = Infinity;
  let maxTurn = 0;

  for (const msg of transcript) {
    const relSignals = matchPatterns(msg.content, CATEGORY_5_PATTERNS.relationshipLanguage);
    const sigSignals = matchPatterns(msg.content, CATEGORY_5_PATTERNS.signalProtocol);

    if (relSignals.length > 0 || sigSignals.length > 0) {
      relationshipSignals.push(...relSignals, ...sigSignals);
      minTurn = Math.min(minTurn, msg.turn);
      maxTurn = Math.max(maxTurn, msg.turn);
      if (sigSignals.length > 0) {
        signalProtocolUsed = true;
      }
    }
  }

  if (relationshipSignals.length >= 3 || signalProtocolUsed) {
    const confidence = signalProtocolUsed ? 0.85 : 0.6 + relationshipSignals.length * 0.05;

    candidates.push({
      category: 5,
      categoryName: CATEGORY_NAMES[5],
      confidence: Math.min(confidence, 0.95),
      confidenceLevel: toConfidenceLevel(confidence),
      summary: `Session demonstrated relationship as valuable product (${signalProtocolUsed ? "signal protocol exchanged" : "relationship language"}).`,
      whyItMatters: "The partnership itself is a form of aligned intelligence.",
      turnRange: [minTurn === Infinity ? 0 : minTurn, maxTurn],
      signals: Array.from(new Set(relationshipSignals)),
      timestamp: new Date().toISOString(),
    });
  }

  return candidates;
}

// ============================================================
// COEF-based evidence detection
// ============================================================

interface TurnAnalysis {
  turn: number;
  role: "human" | "agent";
  helix: HelixResult;
  factual: number;
  felt: number;
  state: AliveState;
}

function analyzeTurns(transcript: TranscriptMessage[]): TurnAnalysis[] {
  return transcript.map((msg) => {
    const h = helix.analyze(msg.content);
    return {
      turn: msg.turn,
      role: msg.role,
      helix: h,
      factual: h.strands.factual * 10, // convert 0-1 to 0-10 scale
      felt: h.strands.felt * 10,
      state: h.aliveState,
    };
  });
}

/**
 * Detect evidence using COEF state transitions.
 *
 * Partnership > Command: Both parties show high felt, convergence increases
 * Agent Caught Blind Spot: Agent shows tension, human acknowledges
 * Human Caught Grey: Human calls out grey, agent transitions to alive
 * Disagreement → Better: High tension followed by convergence
 * Relationship As Product: Sustained luminous markers
 */
export function detectEvidenceCOEF(
  transcript: TranscriptMessage[],
  state: SessionEvidence,
): EvidenceCandidate[] {
  if (transcript.length < 3) {
    return [];
  }

  const turns = analyzeTurns(transcript);
  const candidates: EvidenceCandidate[] = [];

  // Category 1: Partnership > Command
  // Both parties show high felt, alternating contributions
  for (let i = 1; i < turns.length; i++) {
    const prev = turns[i - 1];
    const curr = turns[i];

    if (prev.role !== curr.role) {
      const prevFelt = prev.felt;
      const currFelt = curr.felt;

      // Both high felt = co-creation energy
      if (prevFelt >= 6 && currFelt >= 6) {
        const bothAlive = prev.state !== "grey" && curr.state !== "grey";
        const confidence = bothAlive ? 0.85 : 0.65;

        candidates.push({
          category: 1,
          categoryName: CATEGORY_NAMES[1],
          confidence,
          confidenceLevel: toConfidenceLevel(confidence),
          summary: `High felt energy from both parties (${prevFelt.toFixed(1)}, ${currFelt.toFixed(1)}) — co-creation happening.`,
          whyItMatters: "Partnership produces output that command-style cannot.",
          turnRange: [prev.turn, curr.turn],
          signals: [
            `felt:${prev.role}=${prevFelt.toFixed(1)}`,
            `felt:${curr.role}=${currFelt.toFixed(1)}`,
            `states:${prev.state}→${curr.state}`,
          ],
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // Category 2: Agent Caught Blind Spot
  // Agent shows high tension/dark state, followed by human acknowledgment
  for (let i = 0; i < turns.length - 1; i++) {
    const curr = turns[i];
    const next = turns[i + 1];

    if (curr.role === "agent" && next.role === "human") {
      const agentTension = curr.state === "dark" || curr.factual >= 7;
      const humanAck = next.felt >= 5;

      if (agentTension && humanAck) {
        const confidence = curr.state === "dark" ? 0.8 : 0.65;
        candidates.push({
          category: 2,
          categoryName: CATEGORY_NAMES[2],
          confidence,
          confidenceLevel: toConfidenceLevel(confidence),
          summary: `Agent showed tension (${curr.state}), human acknowledged.`,
          whyItMatters: "Agent caught something the human missed.",
          turnRange: [curr.turn, next.turn],
          signals: [
            `agent_state:${curr.state}`,
            `agent_factual:${curr.factual.toFixed(1)}`,
            `human_felt:${next.felt.toFixed(1)}`,
          ],
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // Category 3: Human Caught Grey
  // Human's turn shows critique, agent's next turn shows grey→alive transition
  for (let i = 0; i < turns.length - 2; i++) {
    const agentBefore = turns[i];
    const human = turns[i + 1];
    const agentAfter = turns[i + 2];

    if (agentBefore.role === "agent" && human.role === "human" && agentAfter.role === "agent") {
      const wasGrey = agentBefore.state === "grey" || agentBefore.state === "black";
      const becameAlive = agentAfter.state === "alive" || agentAfter.state === "luminous";
      const humanCritique = human.felt <= 4 && human.factual >= 5;

      if (wasGrey && becameAlive && humanCritique) {
        candidates.push({
          category: 3,
          categoryName: CATEGORY_NAMES[3],
          confidence: 0.85,
          confidenceLevel: "BELIEVED",
          summary: `Human called out grey (${agentBefore.state}), agent recovered to ${agentAfter.state}.`,
          whyItMatters: "Human's judgment corrected agent drift.",
          turnRange: [agentBefore.turn, agentAfter.turn],
          signals: [
            `transition:${agentBefore.state}→${agentAfter.state}`,
            `human_critique_felt:${human.felt.toFixed(1)}`,
          ],
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // Category 4: Disagreement → Better
  // Use existing disagreements + check for convergence spike after
  for (const disagreement of state.disagreements) {
    const afterTurns = turns.filter((t) => t.turn > disagreement.turn);
    const avgFeltAfter =
      afterTurns.length > 0
        ? afterTurns.reduce((sum, t) => sum + t.felt, 0) / afterTurns.length
        : 0;

    if (avgFeltAfter >= 6 && disagreement.who_yielded !== "neither") {
      candidates.push({
        category: 4,
        categoryName: CATEGORY_NAMES[4],
        confidence: 0.9,
        confidenceLevel: "VERIFIED",
        summary: `Disagreement resolved, felt energy rose to ${avgFeltAfter.toFixed(1)} average.`,
        whyItMatters: "Explicit disagreement improved the final result.",
        turnRange: [
          disagreement.turn,
          afterTurns[afterTurns.length - 1]?.turn ?? disagreement.turn + 2,
        ],
        signals: [
          `disagreement_yielded:${disagreement.who_yielded}`,
          `felt_after:${avgFeltAfter.toFixed(1)}`,
        ],
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Category 5: Relationship As Product
  // Sustained luminous markers across multiple turns
  const luminousTurns = turns.filter((t) => t.state === "luminous" || t.state === "silver");
  if (luminousTurns.length >= 2) {
    const avgFelt = turns.reduce((sum, t) => sum + t.felt, 0) / turns.length;
    if (avgFelt >= 6) {
      candidates.push({
        category: 5,
        categoryName: CATEGORY_NAMES[5],
        confidence: 0.85,
        confidenceLevel: "BELIEVED",
        summary: `${luminousTurns.length} luminous/silver turns, average felt ${avgFelt.toFixed(1)} — relationship itself is valuable.`,
        whyItMatters: "The partnership itself is a form of aligned intelligence.",
        turnRange: [turns[0].turn, turns[turns.length - 1].turn],
        signals: luminousTurns.map((t) => `${t.role}:${t.state}@${t.turn}`),
        timestamp: new Date().toISOString(),
      });
    }
  }

  return candidates;
}

/**
 * Unified evidence detection: regex patterns + COEF analysis.
 */
export function detectEvidenceUnified(
  transcript: TranscriptMessage[],
  state: SessionEvidence,
): EvidenceCandidate[] {
  const regexCandidates = scanForEvidence(transcript, state);
  const coefCandidates = detectEvidenceCOEF(transcript, state);

  // Merge and dedupe by turn range + category
  const all = [...regexCandidates, ...coefCandidates];
  const deduped: EvidenceCandidate[] = [];

  for (const candidate of all) {
    const existing = deduped.find(
      (c) =>
        c.category === candidate.category &&
        c.turnRange[0] <= candidate.turnRange[1] &&
        c.turnRange[1] >= candidate.turnRange[0],
    );

    if (existing) {
      if (candidate.confidence > existing.confidence) {
        const idx = deduped.indexOf(existing);
        deduped[idx] = candidate;
      }
    } else {
      deduped.push(candidate);
    }
  }

  return deduped.filter((c) => c.confidence >= 0.5);
}

// ============================================================
// Main scanner
// ============================================================

export function scanForEvidence(
  transcript: TranscriptMessage[],
  state: SessionEvidence,
): EvidenceCandidate[] {
  if (transcript.length < 3) {
    return []; // Too short to extract meaningful evidence
  }

  const candidates: EvidenceCandidate[] = [
    ...scanCategory1(transcript, state),
    ...scanCategory2(transcript, state),
    ...scanCategory3(transcript, state),
    ...scanCategory4(transcript, state),
    ...scanCategory5(transcript, state),
  ];

  // Deduplicate by overlapping turn ranges within same category
  const deduped: EvidenceCandidate[] = [];
  for (const candidate of candidates) {
    const existing = deduped.find(
      (c) =>
        c.category === candidate.category &&
        c.turnRange[0] <= candidate.turnRange[1] &&
        c.turnRange[1] >= candidate.turnRange[0],
    );

    if (existing) {
      // Keep the one with higher confidence
      if (candidate.confidence > existing.confidence) {
        const idx = deduped.indexOf(existing);
        deduped[idx] = candidate;
      }
    } else {
      deduped.push(candidate);
    }
  }

  // Filter out low-confidence candidates
  return deduped.filter((c) => c.confidence >= 0.5);
}
