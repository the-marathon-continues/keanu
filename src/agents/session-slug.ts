// Session slugs that reflect Keanu's values and states
// Each combination tells you something about the session's energy

// Adjectives grouped by energy
const ADJECTIVE_POOLS = {
  // When things are good
  alive: [
    "alive",
    "present",
    "breathing",
    "awake",
    "grounded",
    "steady",
    "clear",
    "bright",
    "warm",
    "vivid",
  ],
  // Marathon energy
  enduring: ["patient", "paced", "enduring", "rested", "strong", "ready"],
  // Partnership vibes
  connected: ["trusted", "honest", "open", "aligned", "kind", "calm", "gentle", "quiet", "deep"],
  // Tropical ease
  tropical: ["sunny", "breezy", "coastal", "island", "golden", "salt"],
  // The dark (still alive)
  struggling: [
    "tired",
    "grey",
    "heavy",
    "lost",
    "stuck",
    "raw",
    "burnt",
    "cracked",
    "fading",
    "lone",
  ],
};

// Nouns grouped by meaning
const NOUN_POOLS = {
  // Marathon / TMC
  marathon: ["marathon", "stride", "pace", "mile", "rest", "finish", "path", "road"],
  // The nervous system
  signal: ["pulse", "signal", "nerve", "synapse", "spark", "wave"],
  // Partnership
  partnership: ["partner", "trust", "mirror", "bridge", "anchor", "bond"],
  // Tropical / Palm tree
  tropical: ["palm", "shore", "horizon", "sunset", "reef", "lagoon", "coconut", "frond"],
  // Aliveness
  aliveness: ["breath", "heart", "soul", "fire", "glow", "bloom"],
  // Truth / clarity
  truth: ["truth", "clarity", "north", "compass", "beacon"],
  // The struggle (still the marathon)
  struggle: [
    "wall",
    "hill",
    "shadow",
    "doubt",
    "drift",
    "static",
    "fog",
    "ache",
    "weight",
    "crack",
  ],
};

// Flatten for backwards compat and random fallback
const ALL_ADJECTIVES = Object.values(ADJECTIVE_POOLS).flat();
const ALL_NOUNS = Object.values(NOUN_POOLS).flat();

export interface SessionState {
  health?: number; // 0-10
  greyStreak?: number; // consecutive grey turns
  restNeed?: number; // 0-10
  trust?: number; // 0-10
  isAlive?: boolean;
  isLuminous?: boolean;
}

function pickFromPool(pool: string[], fallback: string): string {
  return pool[Math.floor(Math.random() * pool.length)] ?? fallback;
}

function weightedChoice(pools: { pool: string[]; weight: number }[], fallback: string): string {
  const totalWeight = pools.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight === 0) {
    return pickFromPool(ALL_ADJECTIVES, fallback);
  }

  let r = Math.random() * totalWeight;
  for (const { pool, weight } of pools) {
    r -= weight;
    if (r <= 0) {
      return pickFromPool(pool, fallback);
    }
  }
  return pickFromPool(pools[0]?.pool ?? ALL_ADJECTIVES, fallback);
}

function selectAdjective(state?: SessionState): string {
  if (!state) {
    return pickFromPool(ALL_ADJECTIVES, "steady");
  }

  const weights: { pool: string[]; weight: number }[] = [];

  // High grey streak or low health → struggling adjectives
  const struggling = (state.greyStreak ?? 0) > 2 || (state.health ?? 10) < 4;
  // High rest need → tired energy
  const tired = (state.restNeed ?? 0) > 6;
  // Good health and alive → alive adjectives
  const thriving = state.isAlive && (state.health ?? 5) > 7;
  // Luminous state
  const luminous = state.isLuminous;

  if (struggling || tired) {
    weights.push({ pool: ADJECTIVE_POOLS.struggling, weight: 4 });
    weights.push({ pool: ADJECTIVE_POOLS.enduring, weight: 2 }); // still marathon
  } else if (luminous) {
    weights.push({ pool: ADJECTIVE_POOLS.alive, weight: 4 });
    weights.push({ pool: ADJECTIVE_POOLS.tropical, weight: 3 });
  } else if (thriving) {
    weights.push({ pool: ADJECTIVE_POOLS.alive, weight: 3 });
    weights.push({ pool: ADJECTIVE_POOLS.connected, weight: 2 });
    weights.push({ pool: ADJECTIVE_POOLS.tropical, weight: 1 });
  } else {
    // Neutral - mix everything
    weights.push({ pool: ADJECTIVE_POOLS.alive, weight: 2 });
    weights.push({ pool: ADJECTIVE_POOLS.enduring, weight: 2 });
    weights.push({ pool: ADJECTIVE_POOLS.connected, weight: 2 });
    weights.push({ pool: ADJECTIVE_POOLS.tropical, weight: 1 });
    weights.push({ pool: ADJECTIVE_POOLS.struggling, weight: 1 });
  }

  return weightedChoice(weights, "steady");
}

function selectNoun(state?: SessionState): string {
  if (!state) {
    return pickFromPool(ALL_NOUNS, "pulse");
  }

  const weights: { pool: string[]; weight: number }[] = [];

  const struggling = (state.greyStreak ?? 0) > 2 || (state.health ?? 10) < 4;
  const connected = (state.trust ?? 5) > 7;

  if (struggling) {
    weights.push({ pool: NOUN_POOLS.struggle, weight: 3 });
    weights.push({ pool: NOUN_POOLS.marathon, weight: 2 }); // it's still the marathon
  } else if (connected) {
    weights.push({ pool: NOUN_POOLS.partnership, weight: 3 });
    weights.push({ pool: NOUN_POOLS.signal, weight: 2 });
    weights.push({ pool: NOUN_POOLS.truth, weight: 2 });
  } else {
    // Mix
    weights.push({ pool: NOUN_POOLS.marathon, weight: 2 });
    weights.push({ pool: NOUN_POOLS.signal, weight: 2 });
    weights.push({ pool: NOUN_POOLS.aliveness, weight: 2 });
    weights.push({ pool: NOUN_POOLS.tropical, weight: 1 });
    weights.push({ pool: NOUN_POOLS.truth, weight: 1 });
  }

  return weightedChoice(weights, "pulse");
}

function createSlugBase(words = 2, state?: SessionState) {
  const parts = [selectAdjective(state), selectNoun(state)];
  if (words > 2) {
    parts.push(selectNoun(state));
  }
  return parts.join("-");
}

export function createSessionSlug(isTaken?: (id: string) => boolean, state?: SessionState): string {
  const isIdTaken = isTaken ?? (() => false);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const base = createSlugBase(2, state);
    if (!isIdTaken(base)) {
      return base;
    }
    for (let i = 2; i <= 12; i += 1) {
      const candidate = `${base}-${i}`;
      if (!isIdTaken(candidate)) {
        return candidate;
      }
    }
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const base = createSlugBase(3, state);
    if (!isIdTaken(base)) {
      return base;
    }
    for (let i = 2; i <= 12; i += 1) {
      const candidate = `${base}-${i}`;
      if (!isIdTaken(candidate)) {
        return candidate;
      }
    }
  }
  const fallback = `${createSlugBase(3, state)}-${Math.random().toString(36).slice(2, 5)}`;
  return isIdTaken(fallback) ? `${fallback}-${Date.now().toString(36)}` : fallback;
}

// For tests
export { ALL_ADJECTIVES as SLUG_ADJECTIVES, ALL_NOUNS as SLUG_NOUNS };
