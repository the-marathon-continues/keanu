// Archived convergence re-exports (for self-train tests)
export { Signal, clamp } from "./gradient.ts";
export { Duality, DualityGraph, ConvergenceOps } from "./graph.ts";
export { GradientGate, DualityProcessor, GradientMachine } from "./firmware.ts";
export type { GradientReading, MachineOutput } from "./firmware.ts";
export { DialecticalEngine, formatResult } from "./dialectic.ts";
export type { DialecticalStep, DialecticalResult, LLMConfig, LLMProvider } from "./dialectic.ts";
export { FireAndAsh } from "./fire-and-ash.ts";
export type { FireAndAshConfig, FireAndAshResult } from "./fire-and-ash.ts";
