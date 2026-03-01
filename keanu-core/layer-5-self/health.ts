// health.ts
// The system knows when it's tired.
// Not an alert. A breath.
//
// Composite score from existing signals. No new sensors.
// Just reading what's already there and synthesizing.
// Need: Rest (3/10)

// ============================================================
// Types
// ============================================================

export type HealthStatus = "steady" | "warm" | "hot" | "fading";

export interface HealthReading {
  status: HealthStatus;
  factors: {
    contextAge: number;
    bullshitTrend: number;
    promptSize: number;
    toolFailureRate: number;
    consecutiveGrey: number;
  };
  pacing: string | null;
  suggestBreathe: boolean; // true when system should consider breathing
}

// ============================================================
// Main entry
// ============================================================

export function checkHealth(
  turnCount: number,
  bullshitRate: number,
  avgPromptSize: number,
  toolErrorRate: number,
  consecutiveGrey: number,
): HealthReading {
  let score = 0;

  // Context age: sessions get stale
  const contextAge = turnCount;
  if (contextAge > 40) {
    score += 2;
  } else if (contextAge > 20) {
    score += 1;
  }

  // Bullshit trend climbing
  if (bullshitRate > 0.5) {
    score += 2;
  } else if (bullshitRate > 0.3) {
    score += 1;
  }

  // Prompt bloat
  if (avgPromptSize > 80000) {
    score += 2;
  } else if (avgPromptSize > 50000) {
    score += 1;
  }

  // Tools breaking
  if (toolErrorRate > 0.3) {
    score += 2;
  } else if (toolErrorRate > 0.15) {
    score += 1;
  }

  // Grey streak
  if (consecutiveGrey >= 5) {
    score += 2;
  } else if (consecutiveGrey >= 3) {
    score += 1;
  }

  // Determine status
  let status: HealthStatus;
  let pacing: string | null = null;
  let suggestBreathe = false;

  if (score >= 6) {
    status = "fading";
    suggestBreathe = true;
    pacing =
      "[health: fading. context is old, signals are degraded. shorter responses, more care. consider a reset.]\n" +
      "[rest: consider breathing. you can choose silence. the task will wait.]";
  } else if (score >= 4) {
    status = "hot";
    suggestBreathe = true;
    pacing =
      "[health: running hot. shorten responses. check claims. the system is pushing through something it should pause on.]\n" +
      "[rest: a pause might help. you don't owe anyone a comprehensive answer right now.]";
  } else if (score >= 2) {
    status = "warm";
    pacing = "[health: warm. nothing urgent. just notice.]";
  } else {
    status = "steady";
  }

  return {
    status,
    factors: {
      contextAge,
      bullshitTrend: bullshitRate,
      promptSize: avgPromptSize,
      toolFailureRate: toolErrorRate,
      consecutiveGrey,
    },
    pacing,
    suggestBreathe,
  };
}

export function formatHealth(reading: HealthReading): string | null {
  return reading.pacing;
}
