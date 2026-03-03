// contradiction-detector.ts
// Cross-reference claims, assign severity, surface conflicts BEFORE agent commits.
//
// Severity matters:
// - HIGH: Both claims confident (>=4). One of us is wrong. Stop and think.
// - MEDIUM: One confident, one exploratory. Worth noting, not blocking.
// - LOW: Both exploratory. Contradictions expected. Part of learning.
//
// The goal isn't to prevent contradictions — it's to notice them.

import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  getAllClaims,
  crossCheck,
  contradictByText,
  trackClaimWithSource,
} from "../layer-3-causal/silverado.js";
import { memoryContradictionCheck } from "../layer-3-causal/truth.js";
import type { TrackedClaim } from "../shared/types.js";

// ============================================================
// Types
// ============================================================

export type ContradictionSeverity = "HIGH" | "MEDIUM" | "LOW";

export type ContradictionResolution =
  | "claim1_wins"
  | "claim2_wins"
  | "both_valid" // different contexts, both true
  | "both_retracted" // both were wrong
  | "synthesis"; // Phase 3: dialectical synthesis created a new claim

// Phase 3: Disagreement classification per compass artifact
export type DisagreementType =
  | "factual" // Contradicting data points — verifiable
  | "definitional" // Using terms differently
  | "value" // Different priorities — preserve both
  | "scope"; // Different contexts — boundary conditions

// Phase 3: Synthesis architecture per compass artifact
export type SynthesisType =
  | "boundary_conditions" // SCOPE: "Both are right in different contexts"
  | "complementary_integration" // DEFINITIONAL/VALUE: "Both perspectives contribute"
  | "ontological_transcendence"; // FACTUAL: "Higher-level framework resolves"

// Phase 3: Result of dialectical resolution
export interface DialecticalResolutionResult {
  resolved: boolean;
  synthesisType?: SynthesisType;
  synthesisClaim?: TrackedClaim;
  disagreementType?: DisagreementType;
  reason: string;
}

export interface DetectedContradiction {
  id: string;
  claim1: {
    id: string;
    text: string;
    confidence: number;
  };
  claim2: {
    id: string;
    text: string;
    confidence: number;
  };
  severity: ContradictionSeverity;
  detected: string; // timestamp
  resolved: boolean;
  resolution?: ContradictionResolution;
  resolutionReason?: string;
  resolvedAt?: string;
  session: string;
}

// ============================================================
// State
// ============================================================

const _contradictions: DetectedContradiction[] = [];
const MAX_CONTRADICTIONS = 50;
let _currentSession = "";

// ============================================================
// Severity Calculation
// ============================================================

/**
 * Calculate severity based on confidence levels.
 */
export function calculateSeverity(conf1: number, conf2: number): ContradictionSeverity {
  // HIGH: Both confident (>=4), one must be wrong
  if (conf1 >= 4 && conf2 >= 4) {
    return "HIGH";
  }

  // MEDIUM: One confident, one exploratory
  if (conf1 >= 4 || conf2 >= 4) {
    return "MEDIUM";
  }

  // LOW: Both exploratory, contradictions expected
  return "LOW";
}

// ============================================================
// Detection
// ============================================================

/**
 * Check if a new claim contradicts existing beliefs.
 * Returns the detected contradiction if found, null otherwise.
 */
export function detectContradiction(
  newClaimText: string,
  newConfidence: number,
): DetectedContradiction | null {
  // Use silverado's cross-check (which uses truth.ts underneath)
  const contradictions = crossCheck(newClaimText);

  if (contradictions.length === 0) {
    return null;
  }

  // Find the conflicting claim
  const conflict = contradictions[0];
  const claims = getAllClaims();
  const existingClaim = claims.find((c) =>
    c.text.toLowerCase().includes(conflict.previous.toLowerCase().slice(0, 30)),
  );

  if (!existingClaim) {
    return null;
  }

  const detected: DetectedContradiction = {
    id: randomUUID(),
    claim1: {
      id: existingClaim.id,
      text: existingClaim.text,
      confidence: existingClaim.decayedConfidence,
    },
    claim2: {
      id: "new-" + randomUUID().slice(0, 8),
      text: newClaimText,
      confidence: newConfidence,
    },
    severity: calculateSeverity(existingClaim.decayedConfidence, newConfidence),
    detected: new Date().toISOString(),
    resolved: false,
    session: _currentSession,
  };

  _contradictions.push(detected);

  // Rolling window
  if (_contradictions.length > MAX_CONTRADICTIONS) {
    _contradictions.splice(0, _contradictions.length - MAX_CONTRADICTIONS);
  }

  return detected;
}

/**
 * Scan the full ledger for contradictions between existing claims.
 * Useful for periodic audits.
 */
export function scanForContradictions(): DetectedContradiction[] {
  const claims = getAllClaims().filter((c) => c.status === "active" && c.decayedConfidence > 0);

  const found: DetectedContradiction[] = [];

  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const c1 = claims[i];
      const c2 = claims[j];

      // Check for contradiction
      const contradictions = memoryContradictionCheck(c1.text, [c2.text]);

      if (contradictions.length > 0) {
        // Check if we already have this pair
        const existing = _contradictions.find(
          (d) =>
            (d.claim1.id === c1.id && d.claim2.id === c2.id) ||
            (d.claim1.id === c2.id && d.claim2.id === c1.id),
        );

        if (!existing) {
          const detected: DetectedContradiction = {
            id: randomUUID(),
            claim1: {
              id: c1.id,
              text: c1.text,
              confidence: c1.decayedConfidence,
            },
            claim2: {
              id: c2.id,
              text: c2.text,
              confidence: c2.decayedConfidence,
            },
            severity: calculateSeverity(c1.decayedConfidence, c2.decayedConfidence),
            detected: new Date().toISOString(),
            resolved: false,
            session: _currentSession,
          };

          _contradictions.push(detected);
          found.push(detected);
        }
      }
    }
  }

  // Rolling window
  if (_contradictions.length > MAX_CONTRADICTIONS) {
    _contradictions.splice(0, _contradictions.length - MAX_CONTRADICTIONS);
  }

  return found;
}

// ============================================================
// Resolution
// ============================================================

/**
 * Resolve a detected contradiction.
 */
export function resolveContradiction(
  id: string,
  resolution: ContradictionResolution,
  reason?: string,
): boolean {
  const contradiction = _contradictions.find((c) => c.id === id);

  if (!contradiction) {
    return false;
  }

  contradiction.resolved = true;
  contradiction.resolution = resolution;
  contradiction.resolutionReason = reason;
  contradiction.resolvedAt = new Date().toISOString();

  // Update silverado based on resolution
  if (resolution === "claim1_wins") {
    contradictByText(contradiction.claim2.text, contradiction.claim1.text);
  } else if (resolution === "claim2_wins") {
    contradictByText(contradiction.claim1.text, contradiction.claim2.text);
  } else if (resolution === "both_retracted") {
    contradictByText(contradiction.claim1.text, "both claims retracted");
    contradictByText(contradiction.claim2.text, "both claims retracted");
  }
  // "both_valid" doesn't mark either as contradicted

  return true;
}

/**
 * Get unresolved contradictions.
 */
export function getUnresolved(): DetectedContradiction[] {
  return _contradictions.filter((c) => !c.resolved);
}

/**
 * Get unresolved HIGH severity contradictions.
 */
export function getHighSeverityUnresolved(): DetectedContradiction[] {
  return _contradictions.filter((c) => !c.resolved && c.severity === "HIGH");
}

/**
 * Get all contradictions.
 */
export function getAllContradictions(): DetectedContradiction[] {
  return [..._contradictions];
}

// ============================================================
// Injection Formatting
// ============================================================

/**
 * Format for before_prompt_build injection.
 * Only surfaces HIGH severity unresolved contradictions.
 */
export function formatInjection(): string | null {
  const high = getHighSeverityUnresolved();

  if (high.length === 0) {
    return null;
  }

  const c = high[0];
  return (
    `[contradiction: ${c.severity} — ` +
    `"${c.claim1.text.slice(0, 40)}..." (conf ${c.claim1.confidence}) vs ` +
    `"${c.claim2.text.slice(0, 40)}..." (conf ${c.claim2.confidence}). ` +
    `resolve before proceeding.]`
  );
}

/**
 * Format all unresolved for dashboard.
 */
export function formatDashboard(): string {
  const unresolved = getUnresolved();

  if (unresolved.length === 0) {
    return "No unresolved contradictions.";
  }

  const lines = unresolved.map((c) => {
    return `[${c.severity}] "${c.claim1.text.slice(0, 30)}..." vs "${c.claim2.text.slice(0, 30)}..."`;
  });

  return `Unresolved contradictions (${unresolved.length}):\n${lines.join("\n")}`;
}

// ============================================================
// Hooks Integration
// ============================================================

/**
 * Called at session_start.
 */
export function onSessionStart(sessionId: string): void {
  _currentSession = sessionId;
}

/**
 * Called on llm_output to check for new contradictions.
 * Returns detected contradictions if any.
 */
export function onLlmOutput(text: string): DetectedContradiction[] {
  // Extract claim-like statements from output
  // Simple heuristic: sentences that make assertions
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);

  const detected: DetectedContradiction[] = [];

  for (const sentence of sentences) {
    // Skip questions, hedged statements
    if (/\?|might|maybe|perhaps|could be|not sure/i.test(sentence)) {
      continue;
    }

    // Check for contradiction with confidence 3 (mid-range for auto-detected)
    const result = detectContradiction(sentence.trim(), 3);
    if (result) {
      detected.push(result);
    }
  }

  return detected;
}

/**
 * Called at before_prompt_build.
 */
export function onBeforePromptBuild(): string | null {
  return formatInjection();
}

// ============================================================
// Persistence
// ============================================================

export async function save(workspaceDir: string): Promise<void> {
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });
  const file = join(dir, "contradictions.jsonl");
  const lines = _contradictions.map((c) => JSON.stringify(c)).join("\n");
  await writeFile(file, lines + "\n", "utf-8");
}

export async function load(workspaceDir: string): Promise<void> {
  const file = join(workspaceDir, "awareness", "contradictions.jsonl");
  try {
    const raw = await readFile(file, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    _contradictions.length = 0;
    for (const line of lines) {
      try {
        const c = JSON.parse(line) as DetectedContradiction;
        // Validate required fields exist
        if (
          typeof c.id !== "string" ||
          !c.claim1 ||
          !c.claim2 ||
          typeof c.severity !== "string" ||
          typeof c.detected !== "string"
        ) {
          continue; // skip malformed
        }
        _contradictions.push(c);
      } catch {
        // skip malformed
      }
    }
    // Rolling window
    if (_contradictions.length > MAX_CONTRADICTIONS) {
      _contradictions.splice(0, _contradictions.length - MAX_CONTRADICTIONS);
    }
  } catch {
    // No prior file — start fresh
  }
}

/**
 * Reset for testing.
 */
export function reset(): void {
  _contradictions.length = 0;
  _currentSession = "";
}

// ============================================================
// Stats
// ============================================================

/**
 * Get summary stats for dashboard.
 */
export function getStats(): {
  total: number;
  unresolved: number;
  bySeverity: Record<ContradictionSeverity, number>;
  byResolution: Record<ContradictionResolution | "unresolved", number>;
} {
  const bySeverity: Record<ContradictionSeverity, number> = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  const byResolution: Record<ContradictionResolution | "unresolved", number> = {
    claim1_wins: 0,
    claim2_wins: 0,
    both_valid: 0,
    both_retracted: 0,
    synthesis: 0,
    unresolved: 0,
  };

  for (const c of _contradictions) {
    bySeverity[c.severity]++;
    if (c.resolved && c.resolution) {
      byResolution[c.resolution]++;
    } else {
      byResolution.unresolved++;
    }
  }

  return {
    total: _contradictions.length,
    unresolved: getUnresolved().length,
    bySeverity,
    byResolution,
  };
}

// ============================================================
// Phase 3: Dialectical Resolution (meta plan)
// ============================================================

/**
 * Classify the type of disagreement between two claims.
 * Used to route to appropriate synthesis architecture.
 */
export function classifyDisagreement(claim1: string, claim2: string): DisagreementType {
  const c1 = claim1.toLowerCase();
  const c2 = claim2.toLowerCase();

  // SCOPE: Different time/context markers
  const scopeMarkers = [
    /\b(before|after|when|during|in \d{4}|currently|previously|now|then)\b/,
    /\b(in this case|in that case|for this|for that|here|there)\b/,
    /\b(sometimes|usually|often|rarely|always|never)\b/,
  ];
  const c1HasScope = scopeMarkers.some((m) => m.test(c1));
  const c2HasScope = scopeMarkers.some((m) => m.test(c2));
  if (c1HasScope || c2HasScope) {
    return "scope";
  }

  // DEFINITIONAL: Definition/terminology markers
  const definitionMarkers = [
    /\b(means|defined as|is a|refers to|by .+ i mean)\b/,
    /\b(technically|literally|figuratively|colloquially)\b/,
  ];
  const c1HasDef = definitionMarkers.some((m) => m.test(c1));
  const c2HasDef = definitionMarkers.some((m) => m.test(c2));
  if (c1HasDef || c2HasDef) {
    return "definitional";
  }

  // VALUE: Opinion/preference markers
  const valueMarkers = [
    /\b(should|ought|better|worse|prefer|important|matters)\b/,
    /\b(i think|i believe|in my opinion|i feel)\b/,
    /\b(right|wrong|good|bad|best|worst)\b/,
  ];
  const c1HasValue = valueMarkers.some((m) => m.test(c1));
  const c2HasValue = valueMarkers.some((m) => m.test(c2));
  if (c1HasValue || c2HasValue) {
    return "value";
  }

  // Default to FACTUAL — claims about what IS
  return "factual";
}

/**
 * Select synthesis architecture based on disagreement type.
 */
export function selectSynthesisType(disagreementType: DisagreementType): SynthesisType {
  switch (disagreementType) {
    case "scope":
      return "boundary_conditions"; // Both right in different contexts
    case "definitional":
    case "value":
      return "complementary_integration"; // Both perspectives contribute
    case "factual":
      return "ontological_transcendence"; // Need higher-level framework
  }
}

/**
 * Attempt to resolve a contradiction via dialectical synthesis.
 *
 * Phase 3 of meta plan: Contradictions trigger the dialectic engine.
 * - Classifies the disagreement type
 * - Frames claim1 as thesis, claim2 as antithesis
 * - If converged, creates a synthesis claim in silverado
 * - Returns resolution result with new claim if successful
 *
 * NOTE: This is a LOCAL resolution (pattern-based, no LLM).
 * For full dialectic with LLM synthesis, use the DialecticalEngine directly.
 */
export function resolveViaDialectic(
  contradiction: DetectedContradiction,
  _session: string,
): DialecticalResolutionResult {
  const { claim1, claim2 } = contradiction;

  // Classify the disagreement
  const disagreementType = classifyDisagreement(claim1.text, claim2.text);
  const selectedSynthesisType = selectSynthesisType(disagreementType);

  // For LOCAL resolution, we use simple pattern-based synthesis
  // Full LLM-based synthesis would require the DialecticalEngine

  // If it's a SCOPE disagreement, we can resolve without synthesis
  if (disagreementType === "scope") {
    // Mark as both_valid — they're true in different contexts
    resolveContradiction(
      contradiction.id,
      "both_valid",
      "Scope-based: both claims valid in their context",
    );
    return {
      resolved: true,
      synthesisType: selectedSynthesisType,
      disagreementType,
      reason: "Both claims are valid in their respective contexts. No synthesis needed.",
    };
  }

  // If it's VALUE disagreement, preserve both
  if (disagreementType === "value") {
    resolveContradiction(contradiction.id, "both_valid", "Value-based: different perspectives");
    return {
      resolved: true,
      synthesisType: selectedSynthesisType,
      disagreementType,
      reason: "Value disagreement — both perspectives are valid priorities.",
    };
  }

  // For FACTUAL and DEFINITIONAL, we need more evidence to resolve
  // Flag for human review or LLM-based dialectic
  if (disagreementType === "factual") {
    return {
      resolved: false,
      synthesisType: selectedSynthesisType,
      disagreementType,
      reason: "Factual contradiction requires verification or LLM-based dialectic synthesis.",
    };
  }

  // DEFINITIONAL — could auto-resolve with definition clarification
  return {
    resolved: false,
    synthesisType: selectedSynthesisType,
    disagreementType,
    reason: "Definitional disagreement requires term clarification.",
  };
}

/**
 * Create a synthesis claim from a dialectical resolution.
 * Used when the dialectic engine produces a converged synthesis.
 */
export function createSynthesisClaim(
  contradiction: DetectedContradiction,
  synthesisText: string,
  synthesisType: SynthesisType,
  session: string,
): TrackedClaim {
  // Average confidence of the two claims, slightly boosted for successful synthesis
  const synthesisConfidence = Math.min(
    5,
    (contradiction.claim1.confidence + contradiction.claim2.confidence) / 2 + 0.5,
  );

  // Create the synthesis claim with derivedFrom linking to original claims
  const synthesisClaim = trackClaimWithSource(
    synthesisText,
    synthesisConfidence,
    session,
    0, // turn will be set by caller
    { confidenceReason: "synthesis" },
  );

  // Set the synthesis metadata (TrackedClaim now has these fields from Phase 1)
  synthesisClaim.derivedFrom = [contradiction.claim1.id, contradiction.claim2.id];
  synthesisClaim.synthesisType = synthesisType;

  // Mark the contradiction as resolved via synthesis
  resolveContradiction(
    contradiction.id,
    "synthesis",
    `Synthesized: "${synthesisText.slice(0, 50)}..."`,
  );

  return synthesisClaim;
}

/**
 * Attempt dialectical resolution for all unresolved HIGH severity contradictions.
 */
export function attemptDialecticResolutions(session: string): DialecticalResolutionResult[] {
  const highSeverity = getHighSeverityUnresolved();
  const results: DialecticalResolutionResult[] = [];

  for (const contradiction of highSeverity) {
    const result = resolveViaDialectic(contradiction, session);
    results.push(result);
  }

  return results;
}

/**
 * Format dialectical resolution attempt for injection.
 */
export function formatDialecticAttempt(result: DialecticalResolutionResult): string {
  if (result.resolved) {
    return `[dialectic: ${result.disagreementType} disagreement resolved via ${result.synthesisType}]`;
  }
  return `[dialectic: ${result.disagreementType} disagreement needs ${result.reason.slice(0, 50)}...]`;
}
