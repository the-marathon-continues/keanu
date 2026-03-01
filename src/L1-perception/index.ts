/**
 * L1-perception: Input Processing and Signals
 *
 * The eye. Raw signal intake and processing.
 *
 * Modules:
 * - types.ts — signal shapes, pulse reading, human reading, etc.
 * - signal.ts — COEF encoding/decoding, trend tracking
 * - injection.ts — context injection, the triage nurse
 * - human.ts — human tone reading (R/Y/B colors)
 * - observe.ts — metrics export, dashboard
 *
 * Currently re-exports from extensions/keanu/.
 * Will migrate modules here incrementally.
 */

// Types — the shapes of signals
export * from "../../keanu-core/shared/types.js";

// Signal — COEF encoding/decoding, trend tracking
export { encode, decode, emoji } from "../../keanu-core/layer-1-perception/signal.js";

// Injection — context prioritization (the triage nurse)
export {
  triageInjection,
  type Priority,
  type InjectionCategory,
  type InjectionItem,
  type InjectionResult,
  type InjectionBudget,
  type InjectionContext,
} from "../../keanu-core/layer-1-perception/injection.js";

// Human — tone reading
export {
  readHuman,
  readHumanCOEF,
  readHumanUnified,
  formatHumanReading,
  type COEFHumanReading,
} from "../../keanu-core/layer-1-perception/human.js";

// Observe — metrics export
export {
  configure as configureObservability,
  getConfig as getObservabilityConfig,
  recordTurn,
  getTurnTraces,
  resetTraces,
  exportMetrics,
  exportTraces,
  buildDashboard,
  formatDashboard,
  type ObservabilityConfig,
  type MetricsExport,
  type TurnTrace,
  type DashboardData,
} from "../../keanu-core/layer-5-self/observe.js";
