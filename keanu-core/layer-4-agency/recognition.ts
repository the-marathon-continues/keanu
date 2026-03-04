// recognition.ts
// The way a dog knows your footsteps before the door opens.
//
// Not surveillance. Recognition. The difference between "user_38291"
// and "Drew. Session 47. Last: 3h ago. Usually here late — this is early."
//
// Subscribes to session_start. When a userId arrives, records the timestamp.
// Tracks: session count, last seen, average gap, time-of-day pattern.
// Generates a one-line recognition note for the system prompt.

// ============================================================
// Recognition state
// ============================================================

export interface UserRecord {
  userId: string;
  sessionCount: number;
  firstSeen: string;
  lastSeen: string;
  /** Average gap between sessions in milliseconds. */
  avgGapMs: number;
  /** Hour-of-day histogram (0-23). Which hours does this person show up? */
  hourHistogram: number[];
  /** Last N session timestamps for gap calculation. */
  recentTimestamps: string[];
}

export interface RecognitionState {
  users: Record<string, UserRecord>;
}

const MAX_RECENT_TIMESTAMPS = 20;

let _state: RecognitionState = { users: {} };

// ============================================================
// Core API
// ============================================================

/**
 * Record a session start for a user. Returns the updated record.
 */
export function recordSession(userId: string, timestamp?: string): UserRecord {
  const now = timestamp ?? new Date().toISOString();
  const hour = new Date(now).getUTCHours();

  let record = _state.users[userId];
  if (!record) {
    record = {
      userId,
      sessionCount: 0,
      firstSeen: now,
      lastSeen: now,
      avgGapMs: 0,
      hourHistogram: Array.from({ length: 24 }, () => 0),
      recentTimestamps: [],
    };
    _state.users[userId] = record;
  }

  record.sessionCount++;
  record.lastSeen = now;
  record.hourHistogram[hour]++;
  record.recentTimestamps.push(now);
  if (record.recentTimestamps.length > MAX_RECENT_TIMESTAMPS) {
    record.recentTimestamps.splice(0, record.recentTimestamps.length - MAX_RECENT_TIMESTAMPS);
  }

  // Recalculate average gap from recent timestamps
  if (record.recentTimestamps.length >= 2) {
    const timestamps = record.recentTimestamps.map((t) => new Date(t).getTime());
    let totalGap = 0;
    for (let i = 1; i < timestamps.length; i++) {
      totalGap += timestamps[i] - timestamps[i - 1];
    }
    record.avgGapMs = totalGap / (timestamps.length - 1);
  }

  return record;
}

/**
 * Get recognition for a user. Returns null if unknown.
 */
export function getRecognition(userId: string): UserRecord | null {
  return _state.users[userId] ?? null;
}

// ============================================================
// Formatting — the one-line note for the system prompt
// ============================================================

function formatDuration(ms: number): string {
  if (ms < 60_000) {
    return "just now";
  }
  if (ms < 3_600_000) {
    return `${Math.round(ms / 60_000)}m ago`;
  }
  if (ms < 86_400_000) {
    return `${Math.round(ms / 3_600_000)}h ago`;
  }
  return `${Math.round(ms / 86_400_000)}d ago`;
}

function peakHour(histogram: number[]): number {
  let maxIdx = 0;
  for (let i = 1; i < histogram.length; i++) {
    if (histogram[i] > histogram[maxIdx]) {
      maxIdx = i;
    }
  }
  return maxIdx;
}

function formatHour(h: number): string {
  if (h === 0) {
    return "midnight";
  }
  if (h < 12) {
    return `${h}am`;
  }
  if (h === 12) {
    return "noon";
  }
  return `${h - 12}pm`;
}

/**
 * Generate a recognition note for the system prompt.
 * Returns null for first-time users (nothing to recognize yet).
 */
export function formatRecognition(userId: string, now?: string): string | null {
  const record = _state.users[userId];
  if (!record || record.sessionCount <= 1) {
    return null;
  }

  const nowMs = now ? new Date(now).getTime() : Date.now();
  const lastSeenMs = new Date(record.lastSeen).getTime();
  const gap = nowMs - lastSeenMs;
  const sinceLastSeen = formatDuration(gap);

  const peak = peakHour(record.hourHistogram);
  const currentHour = new Date(nowMs).getUTCHours();
  const isUnusualTime =
    record.sessionCount >= 5 &&
    record.hourHistogram[currentHour] < record.hourHistogram[peak] * 0.3;

  const timingNote = isUnusualTime
    ? ` Usually here around ${formatHour(peak)} — this is different.`
    : "";

  // Extract a display name from userId (email → first part, sub → just use it)
  const displayName = userId.includes("@") ? userId.split("@")[0] : userId;

  return `${displayName}. Session ${record.sessionCount}. Last: ${sinceLastSeen}.${timingNote}`;
}

// ============================================================
// Persistence
// ============================================================

export function toJSON(): RecognitionState {
  return { users: { ..._state.users } };
}

export function fromJSON(data: RecognitionState | null | undefined): void {
  if (!data?.users) {
    return;
  }
  _state = {
    users: { ...data.users },
  };
  // Ensure hourHistogram is always length 24
  for (const record of Object.values(_state.users)) {
    if (!record.hourHistogram || record.hourHistogram.length !== 24) {
      record.hourHistogram = Array.from({ length: 24 }, () => 0);
    }
    if (!record.recentTimestamps) {
      record.recentTimestamps = [];
    }
  }
}

/**
 * Reset state (for testing).
 */
export function reset(): void {
  _state = { users: {} };
}
