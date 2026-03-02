// living-loop/index.ts
// The Living Loop — three models talking to each other via COEF.
//
// Claude thinks. Gemini remembers. Grok watches.
// Human joins when invited, not as the initiator.
//
// The heartbeat drives this. Each beat, the cycle runs.
// Pulse sets the tempo: alive = fast, grey = slow, black = immediate.

export {
  // Loop
  type LoopState,
  type LoopTempo,
  type LoopConfig,
  type GeminiContext,
  type GrokAlert,
  runBeat,
  createInitialState,
  pulseToTempo,
  tempoToMs,
} from "./loop.js";

export {
  // Bridge
  createBridge,
  callGeminiMemory,
  callGrokDetector,
  callClaudeThinker,
  quickMemory,
  quickDetect,
  quickThink,
} from "./coef-bridge.js";

export {
  // Invite
  type Reason,
  type Pull,
  type Invite,
  type InviteState,
  type InviteInput,
  type CheckInSchedule,
  shouldInvite,
  getInviteState,
  resetInviteState,
  recordHumanPresence,
  addPendingQuestion,
  addInterestingInsight,
  configureCheckIn,
  shouldCheckIn,
  recordCheckIn,
} from "./invite.js";

export {
  // Heartbeat Integration
  type LivingLoopResult,
  isLivingLoopEnabled,
  enableLivingLoop,
  disableLivingLoop,
  getLoopState,
  setSignalStateProvider,
  setInviteCallback,
  runLivingLoopBeat,
  getRecommendedIntervalMs,
  getCurrentPulse,
  humanEntered,
  humanLeft,
} from "./heartbeat-integration.js";

export {
  // Initialization
  initLivingLoop,
  isInitialized,
  updateSignalState,
  getSignalState,
  onInvite,
} from "./init.js";
