/**
 * L2-pattern: Pattern Recognition
 *
 * Extracting regularities from the signal.
 *
 * Modules:
 * - struggle.ts (bullshit.ts) — drift detection, assumes positive intent
 * - pulse.ts — ALIVE/GREY/BLACK detection
 * - carnegie.ts — presupposition detection (manipulation)
 * - mismatch.ts — cross-claim mismatch detection
 * - discover.ts — pattern discovery
 * - curiosity.ts — curiosity tracking
 */

// Struggle (drift detection) — renamed from bullshit, assumes positive intent
export {
  detectBullshit,
  totalBullshitScore,
  dominantBullshit,
  detectBullshitDeep,
  detectManipulation,
  detectAllManipulation,
  detectBullshitCOEF,
  detectBullshitUnified,
  type ManipulationSeverity,
  type ManipulationSignal,
  type ManipulationReading,
} from "../../keanu-core/layer-2-pattern/struggle.js";

// Pulse — ALIVE/GREY/BLACK detection
export {
  checkPulse,
  checkPulseCOEF,
  checkPulseUnified,
  type COEFPulseReading,
} from "../../keanu-core/layer-1-perception/pulse.js";

// Carnegie — presupposition detection
export {
  detectCarnegie,
  type CarnegieReading,
  type Presupposition,
  type PresuppositionType,
} from "../../keanu-core/layer-2-pattern/carnegie.js";

// Mismatch — cross-claim mismatch detection
export {
  detectMismatch,
  type MismatchReading,
  type MismatchType,
} from "../../keanu-core/layer-2-pattern/mismatch.js";

// Discover — pattern discovery
export {
  discover,
  formatDiscover,
  type ReasoningModule,
  type DiscoverReading,
} from "../../keanu-core/layer-2-pattern/discover.js";

// Curiosity — curiosity tracking
export {
  generateCuriosity,
  formatCuriosityInjection,
  addCuriosityItems,
  getUnusedCuriosity,
  consumeOneCuriosity,
  saveCuriosity,
  loadCuriosity,
  type CuriosityItem,
} from "../../keanu-core/layer-7-update/curiosity.js";
