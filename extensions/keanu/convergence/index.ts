/**
 * Convergence: The Reasoning Layer
 *
 * Two dualities. One world model. Fire (possibility) and Ash (actuality).
 * The epistemological integration layer — how keanu reasons about the world,
 * not just how it reads the room.
 *
 * Carnegie is for people. This is for knowledge.
 */

export { Signal, clamp } from "./gradient.js";
export { Duality, DualityGraph, ConvergenceOps } from "./graph.js";
export { GradientGate, DualityProcessor, GradientMachine } from "./firmware.js";
export type { GradientReading, MachineOutput } from "./firmware.js";
export { DialecticalEngine, formatResult } from "./dialectic.js";
export type { DialecticalStep, DialecticalResult, LLMConfig, LLMProvider } from "./dialectic.js";
export { Helix } from "./helix.js";
export type { StrandScore, AliveState, HelixResult } from "./helix.js";
export { FireAndAsh } from "./fire-and-ash.js";
export type { FireAndAshConfig, FireAndAshResult } from "./fire-and-ash.js";
