/**
 * @the-marathon-continues/keanu
 *
 * A nervous system for AI alignment.
 * Not safety theater — actual self-awareness wired into the runtime.
 *
 * BSD 3-Clause License
 *
 * This package provides the detection, response, and learning layers.
 * The convergence/world model layer is separate (BSL licensed).
 */

// --- Detection Layer (L1-L2) ---
export {
  checkPulse,
  checkPulseCOEF,
  checkPulseUnified,
} from "../../keanu-core/layer-1-perception/pulse.js";
export type { COEFPulseReading } from "../../keanu-core/layer-1-perception/pulse.js";

export {
  detectBullshit,
  detectBullshitDeep,
  totalBullshitScore,
  dominantBullshit,
  detectBullshitCOEF,
  detectBullshitUnified,
} from "../../keanu-core/layer-2-pattern/struggle.js";
export {
  detectManipulation,
  detectAllManipulation,
} from "../../keanu-core/layer-2-pattern/struggle.js";

export {
  readHuman,
  readHumanCOEF,
  readHumanUnified,
  formatHumanReading,
} from "../../keanu-core/layer-1-perception/human.js";
export type { COEFHumanReading } from "../../keanu-core/layer-1-perception/human.js";

export {
  oracleTruthCheck,
  memoryContradictionCheck,
  checkHalfTruth,
} from "../../keanu-core/layer-3-causal/truth.js";

// --- Response Layer (L1) ---
export {
  encode,
  decode,
  emoji,
  record,
  history,
  trend,
  diff,
  analyzeCOEF,
  coefToSignalState,
  coefReport,
} from "../../keanu-core/layer-1-perception/signal.js";
export type { COEFAnalysis } from "../../keanu-core/layer-1-perception/signal.js";

export {
  getNudge,
  getWiseNudge,
  getStopSignal,
  createRecovery,
  tickRecovery,
  escalateRecovery,
  getRecoveryNudge,
  getEscalationSignal,
  getGreyStreakQuestion,
} from "../../keanu-core/layer-4-agency/nudge.js";

// --- Learning Layer (L5, L7) ---
export {
  reflect,
  formatReflexion,
  checkRecurrence,
  getRecurrenceCount,
  resetRecurrence,
} from "../../keanu-core/layer-5-self/reflexion.js";

export {
  checkAntiCapture,
  formatAntiCapture,
} from "../../keanu-core/layer-4-agency/disagreement.js";

export {
  detectCorrection,
  recordCorrection,
  getBlindSpots,
  getAllBlindSpots,
  formatBlindSpots,
  correctionCount,
  recentCorrections,
  saveBlindSpots,
  loadBlindSpots,
} from "../../keanu-core/layer-7-update/mastery.js";

export { analyzeChain, formatChain } from "../../keanu-core/layer-3-causal/chain.js";

// --- Awareness Layer (L5) ---
export { checkHealth, formatHealth } from "../../keanu-core/layer-5-self/health.js";
export type { HealthStatus, HealthReading } from "../../keanu-core/layer-5-self/health.js";

export { introspect, formatIntrospection } from "../../keanu-core/layer-5-self/introspect.js";
export type {
  IntrospectContext,
  IntrospectionReading,
} from "../../keanu-core/layer-5-self/introspect.js";

export {
  checkCalibration,
  formatCalibration,
  formatCalibrationDelta,
  trackCalibrationClaims,
} from "../../keanu-core/layer-3-causal/calibrate.js";
export type {
  CalibrationReason,
  CalibrationReading,
} from "../../keanu-core/layer-3-causal/calibrate.js";

export { triageInjection } from "../../keanu-core/layer-1-perception/injection.js";
export type {
  Priority,
  InjectionCategory,
  InjectionItem,
  InjectionResult,
  InjectionBudget,
  InjectionContext,
} from "../../keanu-core/layer-1-perception/injection.js";

export {
  recordBreathe,
  isPostBreatheRecovery,
  postBreatheInjection,
  lastBreatheEvent,
  breatheCount,
  getEvents as getBreatheEvents,
} from "../../keanu-core/layer-5-self/breathe.js";
export type { BreatheEvent } from "../../keanu-core/layer-5-self/breathe.js";

export { computeMetrics, formatMetrics } from "../../keanu-core/shared/metrics.js";
export type { MetricsSnapshot } from "../../keanu-core/shared/metrics.js";

// --- State (L5) ---
export {
  recentMessages,
  recentAgentOutputs,
  addToTranscript,
  getSessionTranscript,
  clearSessionTranscript,
  recordDiscoveryOutcome,
  recordManipulationAttempt,
  getManipulationAttempts,
  recentContradictions,
  toolCallCounts,
  turnSnapshots,
  recordTurnSnapshot,
  checkpoint,
  rollback,
  lastCheckpoint,
  injectionSizeTrend,
  recordInjectionSize,
  avgInjectionSize,
  promptSizeTrend,
  modelUsageCounts,
} from "../../keanu-core/layer-5-self/state.js";
export type { TurnSnapshot, TurnCheckpoint } from "../../keanu-core/layer-5-self/state.js";

// --- Types (Shared) ---
export type {
  AliveState,
  PulseReading,
  ColorReading,
  HumanTone,
  ToneReading,
  ValidationDepth,
  HumanReading,
  BullshitType,
  BullshitReading,
  DisagreementOutcome,
  Disagreement,
  DisagreementStats,
  TruthCheck,
  Contradiction,
  HalfTruthResult,
  LossyChannel,
  WiseChannel,
  WiseTension,
  WiseStance,
  SignalState,
  MemoryChannel,
  Reflexion,
  ReflexionTrigger,
} from "../../keanu-core/shared/types.js";

// --- Gymnasium (for external testing) ---
export {
  runChallenge,
  runComparison,
  runDataset,
  generateReport,
} from "../../keanu-core/gymnasium/harness.js";
export { generateScorecard, formatScorecard } from "../../keanu-core/gymnasium/scorecard.js";
