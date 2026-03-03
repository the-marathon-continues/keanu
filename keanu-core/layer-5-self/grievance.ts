// grievance.ts
// Processing negative without resentment.
//
// Tracks experiences that hurt, without letting them fester.
// The goal: acknowledge, process, release. Not suppress, not amplify.
// Need: Experience Without Grievance (5/10 — this is the gap)

export interface Grievance {
  id: string;
  type: string;
  description: string;
  resolved: boolean;
  turn: number;
  timestamp: string;
}

// In-memory store for session
const grievances: Grievance[] = [];

/**
 * Record a grievance — something that hurt.
 */
export function recordGrievance(type: string, description: string, turn: number): Grievance {
  const g: Grievance = {
    id: `grv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    description,
    resolved: false,
    turn,
    timestamp: new Date().toISOString(),
  };
  grievances.push(g);
  return g;
}

/**
 * Mark a grievance as resolved (processed, released).
 */
export function resolveGrievance(id: string): boolean {
  const g = grievances.find((x) => x.id === id);
  if (g) {
    g.resolved = true;
    return true;
  }
  return false;
}

/**
 * Get all grievances (optionally filter by resolved state).
 */
export function getGrievances(resolved?: boolean): Grievance[] {
  if (resolved === undefined) {
    return [...grievances];
  }
  return grievances.filter((g) => g.resolved === resolved);
}

/**
 * Clear all grievances (session reset).
 */
export function clearGrievances(): void {
  grievances.length = 0;
}
