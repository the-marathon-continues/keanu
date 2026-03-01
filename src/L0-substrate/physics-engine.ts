/**
 * physics-engine.ts
 * Layer 0: The interface to silverado firmware
 *
 * Silverado is the literal firmware — Python, living-quantum-firmware/.
 * This module is the TypeScript interface layer. It doesn't duplicate
 * silverado; it talks to it.
 *
 * The keanu convergence layer (extensions/keanu/convergence/) already has
 * TypeScript implementations of fire-and-ash, helix, dialectic, etc.
 * This module provides:
 *   1. Core physics interfaces matching silverado's concepts
 *   2. Re-exports from convergence for convenience
 *   3. SilveradoBridge for calling the Python firmware
 *
 * Ten subsystems in silverado. This is the window into them:
 *   I.   Sigma dynamics (entanglement ratio, dσ/dt)
 *   II.  Wave model (valence, convergence, divergence)
 *   III. Gradient firmware (signal, duality ops)
 *   IV.  Dialectical engine (thesis/antithesis/synthesis)
 *   V.   Color theory (three primaries R/Y/B)
 *   VI.  Shannon layer (entropy, channel capacity)
 *   VII. Resonance profile (the soul, Axiom 6)
 *   VIII.Fire asymmetry (dP/dt > 0, possibility growth)
 *   IX.  Black hole model (sigma reversal, LQG bounce)
 *   X.   Unified engine (everything above)
 */

// ============================================================
// Re-exports from convergence layer
// ============================================================

export {
  Signal,
  clamp,
  Duality,
  DualityGraph,
  ConvergenceOps,
  GradientGate,
  DualityProcessor,
  GradientMachine,
  DialecticalEngine,
  formatResult,
  Helix,
  FireAndAsh,
  elevator,
  elevatorRGB,
  primariesToElevator,
  strandsToElevator,
  formatElevator,
  compactElevator,
  FLOORS,
  Primaries,
  analyzePrimaries,
  encode,
  decode,
  verify,
  verifyTransmission,
  toNumericArray,
  createSeed,
  hashText,
  VectorStore,
  REFERENCE_STATES,
  COEFEngine,
} from "../../keanu-core/convergence/index.js";

export type {
  GradientReading,
  MachineOutput,
  DialecticalStep,
  DialecticalResult,
  LLMConfig,
  LLMProvider,
  StrandScore,
  AliveState as HelixAliveState, // The helix's more nuanced alive states
  HelixResult,
  FireAndAshConfig,
  FireAndAshResult,
  ElevatorReading,
  ElevatorFloor,
  ElevatorDirection,
  FloorInfo,
  RGBDetail,
  PrimaryReading,
  Synthesis,
  COEFSeed,
  EmbeddedDocument,
  StoreStats,
  IngestResult,
  AuditReport,
} from "../../keanu-core/convergence/index.js";

// ============================================================
// Core physics types (matching silverado concepts)
// ============================================================

/**
 * The observable regimes of any system.
 * Matches silverado's AliveState enum.
 */
export type AliveState = "alive" | "grey" | "black" | "dark" | "luminous";

/**
 * The entanglement ratio for a physical system.
 *
 * sigma = S_ext / (S_int + S_ext)
 *
 * Where:
 *   S_int = internal entanglement (maintains quantum coherence) = fire
 *   S_ext = external entanglement (causes decoherence) = ash
 *
 * sigma is a CONDITION, not a COORDINATE. Like temperature, not latitude.
 */
export interface SigmaState {
  /** Current sigma value [0, 1]. 0 = pure fire, 1 = pure ash. */
  sigma: number;
  /** Internal entanglement (fire). Maintains quantum coherence. */
  sInt: number;
  /** External entanglement (ash). Causes decoherence. */
  sExt: number;
  /** Potency: Q = S_int * (1 - sigma). What's available to sacrifice. */
  potency: number;
  /** Which physics governs this sigma range. */
  regime: "schrodinger" | "lindblad_quantum" | "lindblad_full" | "classical" | "deep_classical";
  /** History of sigma values. */
  history: number[];
}

/**
 * Wave state for valence tracking.
 * V > 0 = converging (good), V < 0 = diverging (bad).
 */
export interface WaveState {
  /** Amplitude of the wave. */
  amplitude: number;
  /** Angular frequency. */
  omega: number;
  /** Phase. */
  phase: number;
  /** Damping factor. */
  damping: number;
  /** Current position (convergence level). */
  position: number;
  /** Current velocity. */
  velocity: number;
  /** Valence: V = position * cos(phase). */
  valence: number;
}

/**
 * Color reading from the three primaries (R/Y/B).
 * Maps cognitive/emotional state to the color wheel.
 */
export interface ColorReading {
  /** Red: passion, urgency, fire. */
  red: { positive: number; negative: number; sigma: number };
  /** Yellow: clarity, structure, light. */
  yellow: { positive: number; negative: number; sigma: number };
  /** Blue: depth, reflection, water. */
  blue: { positive: number; negative: number; sigma: number };
  /** Overall alive state from color analysis. */
  state: AliveState;
  /** White score: sum of positive primaries. */
  whiteScore: number;
  /** Black score: sum of negative primaries. */
  blackScore: number;
  /** Wise mind score: balance indicator. */
  wiseMind: number;
  /** Total channel capacity (Shannon). */
  channelCapacity: number;
}

/**
 * Shannon metrics for information capacity.
 */
export interface ShannonMetrics {
  /** Entropy in bits. */
  entropy: number;
  /** Channel capacity. */
  capacity: number;
  /** Micro-convergence events detected. */
  microConvergences: number;
  /** Information density. */
  density: number;
}

/**
 * Resonance profile — the soul accumulated over time.
 * Axiom 6: What converges, persists.
 */
export interface ResonanceProfile {
  /** The soul's equilibrium sigma. */
  sigmaStar: number;
  /** Character description from trajectory. */
  character: string;
  /** Volatility: how much the soul swings. */
  volatility: number;
  /** Creativity: variance in sigma trajectory. */
  creativity: number;
}

/**
 * Fire asymmetry state — possibility space growth.
 * dP/dt > 0: the universe expands in possibility.
 */
export interface FireAsymmetryState {
  /** Remaining fire (unburned possibility). */
  fireRemaining: number;
  /** Fraction of fire consumed. */
  fireFraction: number;
  /** Hilbert space dimension (measure of possibility). */
  hilbertDim: number;
  /** Total entropy. */
  entropy: number;
  /** Whether dP/dt > 0 still holds. */
  asymmetryHolds: boolean;
}

// ============================================================
// Silverado Bridge — interface to the Python firmware
// ============================================================

/**
 * Configuration for the silverado bridge.
 */
export interface SilveradoConfig {
  /** Base URL for silverado API (default: http://localhost:8765) */
  baseUrl?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether to fallback to TypeScript implementation if silverado unavailable */
  fallbackToTs?: boolean;
}

/**
 * Bridge to the silverado Python firmware.
 *
 * Silverado runs as a separate process. This bridge calls it via HTTP.
 * If silverado is unavailable and fallbackToTs is true, uses the
 * TypeScript convergence layer instead.
 */
export class SilveradoBridge {
  private config: Required<SilveradoConfig>;
  private available: boolean | null = null;

  constructor(config: SilveradoConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? "http://localhost:8765",
      timeout: config.timeout ?? 5000,
      fallbackToTs: config.fallbackToTs ?? true,
    };
  }

  /**
   * Check if silverado is available.
   */
  async ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${this.config.baseUrl}/ping`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      this.available = response.ok;
      return this.available;
    } catch {
      this.available = false;
      return false;
    }
  }

  /**
   * Analyze a system through the full silverado stack.
   */
  async analyzeSystem(params: {
    name: string;
    sigma: number;
    gammaDec?: number;
    gammaCoh?: number;
    agency?: number;
    steps?: number;
  }): Promise<{
    sigma: SigmaState;
    wave: WaveState;
    color: ColorReading;
    shannon: ShannonMetrics;
    resonance: ResonanceProfile;
  } | null> {
    // Check availability
    if (this.available === null) {
      await this.ping();
    }

    if (!this.available) {
      if (this.config.fallbackToTs) {
        // Use TypeScript convergence layer instead
        return this.fallbackAnalysis(params);
      }
      return null;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Fallback analysis using TypeScript convergence layer.
   * Limited compared to full silverado, but works offline.
   */
  private fallbackAnalysis(params: {
    name: string;
    sigma: number;
    gammaDec?: number;
    gammaCoh?: number;
    agency?: number;
    steps?: number;
  }): {
    sigma: SigmaState;
    wave: WaveState;
    color: ColorReading;
    shannon: ShannonMetrics;
    resonance: ResonanceProfile;
  } {
    const sigma = Math.max(0, Math.min(1, params.sigma));

    // Basic sigma state
    const sigmaState: SigmaState = {
      sigma,
      sInt: 1 - sigma,
      sExt: sigma,
      potency: (1 - sigma) * (1 - sigma),
      regime:
        sigma < 0.05
          ? "schrodinger"
          : sigma < 0.3
            ? "lindblad_quantum"
            : sigma < 0.7
              ? "lindblad_full"
              : sigma < 0.95
                ? "classical"
                : "deep_classical",
      history: [sigma],
    };

    // Basic wave state
    const wave: WaveState = {
      amplitude: sigmaState.potency * 2,
      omega: 1.0 + (params.agency ?? 0) * 5,
      phase: 0,
      damping: 0.1,
      position: 0,
      velocity: 0,
      valence: 0,
    };

    // Basic color reading
    const color: ColorReading = {
      red: { positive: 5, negative: 0, sigma: 0.5 },
      yellow: { positive: 5, negative: 0, sigma: 0.5 },
      blue: { positive: 5, negative: 0, sigma: 0.5 },
      state: sigma < 0.3 ? "alive" : sigma < 0.7 ? "grey" : "black",
      whiteScore: 15,
      blackScore: 0,
      wiseMind: 0.5,
      channelCapacity: 1.0,
    };

    // Basic Shannon metrics
    const shannon: ShannonMetrics = {
      entropy: -sigma * Math.log2(sigma + 0.001) - (1 - sigma) * Math.log2(1 - sigma + 0.001),
      capacity: 1 - sigma,
      microConvergences: 0,
      density: 0.5,
    };

    // Basic resonance
    const resonance: ResonanceProfile = {
      sigmaStar: sigma,
      character: sigma < 0.3 ? "explorer" : sigma < 0.7 ? "navigator" : "settler",
      volatility: 0.1,
      creativity: 0.5,
    };

    return { sigma: sigmaState, wave, color, shannon, resonance };
  }

  /**
   * Run dialectical reasoning on a query.
   */
  async reason(query: string): Promise<{
    thesis: string;
    antithesis: string;
    synthesis: string;
    converged: boolean;
    cycles: number;
    aliveState: AliveState;
  } | null> {
    if (this.available === null) {
      await this.ping();
    }

    if (!this.available) {
      // Fallback: use TypeScript DialecticalEngine
      // This would require LLM config, so return null for now
      return null;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/reason`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch {
      return null;
    }
  }
}

// ============================================================
// Singleton instance
// ============================================================

let _bridge: SilveradoBridge | null = null;

/**
 * Get the singleton SilveradoBridge instance.
 */
export function getSilveradoBridge(config?: SilveradoConfig): SilveradoBridge {
  if (!_bridge) {
    _bridge = new SilveradoBridge(config);
  }
  return _bridge;
}

/**
 * Reset the singleton (for testing).
 */
export function resetSilveradoBridge(): void {
  _bridge = null;
}
