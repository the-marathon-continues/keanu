/**
 * Convergence: The Reasoning Layer
 *
 * Two dualities. One world model. Fire (possibility) and Ash (actuality).
 * The epistemological integration layer — how keanu reasons about the world,
 * not just how it reads the room.
 *
 * Carnegie is for people. This is for knowledge.
 */

export { Signal, clamp } from "./gradient.ts";
export { Duality, DualityGraph, ConvergenceOps } from "./graph.ts";
export { GradientGate, DualityProcessor, GradientMachine } from "./firmware.ts";
export type { GradientReading, MachineOutput } from "./firmware.ts";
export { DialecticalEngine, formatResult } from "./dialectic.ts";
export type { DialecticalStep, DialecticalResult, LLMConfig, LLMProvider } from "./dialectic.ts";
export { Helix } from "./helix.ts";
export type { StrandScore, AliveState, HelixResult } from "./helix.ts";
export { FireAndAsh } from "./fire-and-ash.ts";
export type { FireAndAshConfig, FireAndAshResult } from "./fire-and-ash.ts";

// Elevator (mood floor system)
export {
  elevator,
  elevatorRGB,
  primariesToElevator,
  strandsToElevator,
  formatElevator,
  compactElevator,
  FLOORS,
} from "./elevator.ts";
export type {
  ElevatorReading,
  ElevatorFloor,
  ElevatorDirection,
  FloorInfo,
  RGBDetail,
} from "./elevator.ts";

// Sigma — Theory Measurement Layer
export {
  computeSigma,
  predictAliveState,
  trackAccuracy,
  getAccuracyStats,
  getRecentPredictions,
} from "./sigma.ts";
export type { SigmaReading, SigmaInput, AccuracyStats } from "./sigma.ts";

// COEF Layer
export { Primaries, analyzePrimaries } from "./primaries.ts";
export type { PrimaryReading, Synthesis } from "./primaries.ts";
export {
  encode,
  decode,
  verify,
  verifyTransmission,
  toNumericArray,
  createSeed,
  hashText,
} from "./coef-seed.ts";
export type { COEFSeed } from "./coef-seed.ts";
export { VectorStore, REFERENCE_STATES } from "./vector-store.ts";
export type { EmbeddedDocument, StoreStats } from "./vector-store.ts";
export { COEFEngine } from "./coef-engine.ts";
export type { IngestResult, AuditReport } from "./coef-engine.ts";
