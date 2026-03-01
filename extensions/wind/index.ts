/**
 * Wind: The Hook Layer
 *
 * The breath that connects keanu's nervous system (L1-L6) to
 * world-book's governance layers (L7-L9).
 *
 * Wind is the WIRING, not the modules. It owns:
 * - Outbound flow: learnings → L7 (revision)
 * - Inbound flow: L7-L9 knowledge → injection
 * - Bridge: silverado L0 ↔ keanu L1-L6
 *
 * Currently supplements extensions/keanu/index.ts.
 * Will eventually absorb its hook responsibilities.
 */

import type { KeanuPluginApi } from "keanu/plugin-sdk";
import { silveradoBridge, type BridgeStatus } from "./bridge.js";
import { consolidate, formatReport, type ConsolidationReport } from "./consolidate.js";
import { inboundFlow, type InboundPayload } from "./inbound.js";
import { outboundFlow, type OutboundPayload } from "./outbound.js";

// ============================================================
// Plugin registration
// ============================================================

export default function wind(api: KeanuPluginApi): void {
  // Session start: initialize bridges
  api.on("session_start", async (_event, ctx) => {
    const agentId = ctx.agentId;
    if (!agentId) return;

    const workspaceDir = api.resolvePath(`~/.keanu/agents/${agentId}`);

    // Initialize silverado bridge
    await silveradoBridge.initialize(workspaceDir);

    // Load inbound knowledge
    await inboundFlow.load(workspaceDir);
  });

  // Session end: flush outbound learnings + sleep-time compute
  api.on("session_end", async (_event, ctx) => {
    const agentId = ctx.agentId;
    if (!agentId) return;

    const workspaceDir = api.resolvePath(`~/.keanu/agents/${agentId}`);
    const sessionId = `s-${Date.now()}`;

    // Gather learnings
    const payload = await outboundFlow.gather();

    // Persist for L7 to pick up
    if (payload) {
      await outboundFlow.flush(workspaceDir, payload);
    }

    // Sleep-time compute: consolidate memories
    try {
      const report = await consolidate(sessionId);
      if (report.clustersFormed > 0 || report.patternsDetected > 0) {
        api.logger.debug?.(`wind: ${formatReport(report)}`);
      }
    } catch (err) {
      api.logger.warn?.(`wind: consolidation failed: ${String(err)}`);
    }

    // Save inbound state
    await inboundFlow.save(workspaceDir);
  });

  // Before prompt build: inject inbound knowledge
  api.on("before_prompt_build", async () => {
    const injection = inboundFlow.getInjection();
    return injection ? { systemPromptAppend: injection } : undefined;
  });
}

// Export for external use
export { outboundFlow, inboundFlow, silveradoBridge, consolidate, formatReport };
export type { OutboundPayload, InboundPayload, BridgeStatus, ConsolidationReport };
