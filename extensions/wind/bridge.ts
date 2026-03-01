/**
 * bridge.ts
 * Silverado (L0) ↔ Keanu (L1-L6) bridge.
 *
 * Silverado is Python firmware (living-quantum-firmware/).
 * This bridge provides:
 * - Health check (is silverado available?)
 * - Call forwarding (keanu → silverado for physics ops)
 * - Result translation (silverado responses → TypeScript types)
 *
 * Falls back to TypeScript convergence layer when silverado unavailable.
 */

import { getSilveradoBridge } from "../../src/L0-substrate/physics-engine.js";

// ============================================================
// Types
// ============================================================

export interface BridgeStatus {
  available: boolean;
  lastCheck: string;
  fallbackMode: boolean;
  silveradoUrl?: string;
}

// ============================================================
// State
// ============================================================

let status: BridgeStatus = {
  available: false,
  lastCheck: new Date().toISOString(),
  fallbackMode: true,
};

// ============================================================
// Bridge
// ============================================================

/**
 * Initialize the bridge. Check if silverado is available.
 */
async function initialize(workspaceDir: string): Promise<BridgeStatus> {
  const bridge = getSilveradoBridge();

  try {
    const available = await bridge.ping();
    status = {
      available,
      lastCheck: new Date().toISOString(),
      fallbackMode: !available,
      silveradoUrl: available ? "http://localhost:8765" : undefined,
    };
  } catch {
    status = {
      available: false,
      lastCheck: new Date().toISOString(),
      fallbackMode: true,
    };
  }

  return status;
}

/**
 * Get current bridge status.
 */
function getStatus(): BridgeStatus {
  return { ...status };
}

/**
 * Check if silverado is available (cached result).
 */
function isAvailable(): boolean {
  return status.available;
}

/**
 * Forward a physics analysis request to silverado.
 * Falls back to TypeScript implementation if unavailable.
 */
async function analyze(params: { name: string; sigma: number; agency?: number }): Promise<{
  sigma: { value: number; regime: string; potency: number };
  aliveState: "alive" | "grey" | "black" | "dark" | "luminous";
  wiseMind: number;
} | null> {
  const bridge = getSilveradoBridge();

  const result = await bridge.analyzeSystem({
    name: params.name,
    sigma: params.sigma,
    agency: params.agency,
  });

  if (!result) return null;

  return {
    sigma: {
      value: result.sigma.sigma,
      regime: result.sigma.regime,
      potency: result.sigma.potency,
    },
    aliveState: result.color.state,
    wiseMind: result.color.wiseMind,
  };
}

/**
 * Forward a reasoning request to silverado.
 * Falls back to null if unavailable (reasoning requires LLM).
 */
async function reason(query: string): Promise<{
  synthesis: string;
  converged: boolean;
  aliveState: "alive" | "grey" | "black" | "dark" | "luminous";
} | null> {
  const bridge = getSilveradoBridge();
  const result = await bridge.reason(query);

  if (!result) return null;

  return {
    synthesis: result.synthesis,
    converged: result.converged,
    aliveState: result.aliveState,
  };
}

export const silveradoBridge = {
  initialize,
  getStatus,
  isAvailable,
  analyze,
  reason,
};
