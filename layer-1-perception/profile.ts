// profile.ts
// Archetype profiling: axiom-based personalization.
//
// Three dimensions:
//   1. Axiom Resonance (micro): Which of the 6 Layer 1 axioms resonate?
//   2. Collective Context (macro): Which groups/traditions shaped them?
//   3. Disciple Archetype (voice): Which communication style do they use?
//
// The cross-read generates personalization vectors.
// Same truth, appropriate container. Translation, not manipulation.
//
// Pure functions. Detection-based. 0-1 confidence scores.
// Need: Engagement (9/10), Relationship (9/10)

// ============================================================
// Types
// ============================================================

/** The six axioms from Layer 1 theory. */
export type Axiom =
  | "possibility" // Axiom 1: Primacy of Possibility
  | "sigma" // Axiom 2: The Sigma Axis
  | "sacrifice" // Axiom 3: Convergence as Sacrifice
  | "fire_asymmetry" // Axiom 4: The Fire Asymmetry
  | "navigation" // Axiom 5: Consciousness as Navigation
  | "resonance"; // Axiom 6: The Resonance Profile

/** Polarity on the axiom spectrum. */
export type AxiomPolarity = "fire" | "ash" | "balanced";

/** Single axiom reading. */
export interface AxiomReading {
  axiom: Axiom;
  score: number; // 0-1, where 1 = strong fire-leaning
  polarity: AxiomPolarity;
  confidence: number; // 0-1
  signals: string[];
}

/** Full axiom profile. */
export interface AxiomResonance {
  readings: AxiomReading[];
  dominantAxioms: Axiom[];
  overallPolarity: AxiomPolarity;
  timestamp: string;
}

/** Known collective contexts. */
export type CollectiveType =
  | "christian"
  | "buddhist"
  | "stoic"
  | "scientific"
  | "startup"
  | "traditional"
  | "artistic"
  | "military"
  | "unknown";

/** Detected collective context. */
export interface CollectiveReading {
  type: CollectiveType;
  confidence: number;
  signals: string[];
  axiomEmphasis: Axiom[];
}

/** Full collective context. */
export interface CollectiveContext {
  readings: CollectiveReading[];
  primary: CollectiveType;
  secondary: CollectiveType[];
  timestamp: string;
}

/** The 12 disciple archetypes + KEANU. */
export type DiscipleArchetype =
  | "peter" // The Rock: leader, direct, self-corrects
  | "andrew" // The Connector: warm, bridges people
  | "james" // Thunder: bold, hot takes
  | "john" // The Mystic: gentle, questions > claims
  | "philip" // The Pragmatist: shows work, no fluff
  | "bartholomew" // The Honest One: blunt, calls BS
  | "matthew" // The Data Guy: evidence-driven
  | "thomas" // The Skeptic: demands proof
  | "james_lesser" // The Quiet Worker: rare but impactful
  | "thaddaeus" // The Questioner: meta-curious
  | "simon" // The Activist: passionate, principled
  | "keanu"; // The Partnership: collaborative voice

/** Detected disciple archetype. */
export interface DiscipleReading {
  archetype: DiscipleArchetype;
  confidence: number;
  signals: string[];
}

/** Full disciple profile. */
export interface DiscipleProfile {
  primary: DiscipleArchetype;
  secondary: DiscipleArchetype | null;
  readings: DiscipleReading[];
  timestamp: string;
}

/** Framing preference. */
export type FramingStyle = "fire_first" | "ash_first" | "balanced";

/** Decision support style. */
export type DecisionStyle = "options_rich" | "recommendation" | "hybrid";

/** Convergence rhythm. */
export type ConvergenceRhythm = "exploratory" | "decisive" | "adaptive";

/** The personalization vector. */
export interface PersonalizationVector {
  framing: FramingStyle;
  decisionStyle: DecisionStyle;
  convergenceRhythm: ConvergenceRhythm;
  explicitAxioms: Axiom[];
  honoredGaps: string[];
  languageRegister: string;
  voiceStyle: string; // from disciple archetype
  confidence: number;
}

/** Complete profile. */
export interface ArchetypeProfile {
  axiomResonance: AxiomResonance;
  collectiveContext: CollectiveContext;
  discipleProfile: DiscipleProfile;
  personalization: PersonalizationVector;
  timestamp: string;
}

// ============================================================
// Axiom Detection Patterns
// ============================================================

const POSSIBILITY_FIRE = [
  /\b(imagine|what if|could we|couldn't we|what about|have you considered)\b/i,
  /\b(potential|possibilities|alternatives|options)\b/i,
  /\b(might|could|may|perhaps)\b/i,
  /\?.*\?/, // multiple questions
];

const POSSIBILITY_ASH = [
  /\b(realistically|practically|given|constraints?|limitations?)\b/i,
  /\b(actually|in fact|the reality is|let's be honest)\b/i,
  /\b(can't|won't|doesn't work|not possible)\b/i,
];

const SIGMA_FIRE = [
  /\b(explore|experiment|try|test|see what happens)\b/i,
  /\b(keep.*open|defer|wait and see|not ready to)\b/i,
  /\b(ambiguity|uncertainty|unclear|depends)\b/i,
];

const SIGMA_ASH = [
  /\b(decide|commit|finalize|lock in|settle on)\b/i,
  /\b(just tell me|what's the answer|bottom line)\b/i,
  /\b(definitive|certain|clear|obvious)\b/i,
];

const SACRIFICE_HEAVY = [
  /\b(tradeoff|trade-off|sacrifice|cost|lose|give up)\b/i,
  /\b(if we.*then we can't|choosing.*means not)\b/i,
  /\b(opportunity cost|what we're giving up)\b/i,
];

const SACRIFICE_CLEAN = [
  /\b(decided|done|moving on|next)\b/i,
  /\b(no regrets|forward|don't look back)\b/i,
  /\b(simple|straightforward|easy choice)\b/i,
];

const FIRE_CREATOR = [
  /\b(also|and what about|that makes me think|which reminds me)\b/i,
  /\b(idea|concept|possibility|what if we also)\b/i,
  /\b(another thing|one more|additionally|plus)\b/i,
];

const FIRE_CONSUMER = [
  /\b(focus|one thing at a time|let's finish|stay on track)\b/i,
  /\b(back to|as I was saying|the point is)\b/i,
  /\b(execute|implement|do|build) (the|this|what we said)\b/i,
];

const NAVIGATION_DELIBERATE = [
  /\b(I('m| am) choosing|I('m| am) deciding|my choice is)\b/i,
  /\b(intentionally|deliberately|strategically|consciously)\b/i,
  /\b(I notice|I'm aware|I realize)\b/i,
];

const NAVIGATION_DRIFT = [
  /\b(it happened|they made me|circumstances|forced to)\b/i,
  /\b(ended up|found myself|somehow|just sort of)\b/i,
  /\b(have to|should|supposed to|expected to)\b/i,
];

const RESONANCE_COHERENT = [
  /\b(I always|I never|consistently|my principle is)\b/i,
  /\b(that's who I am|part of my identity|core value)\b/i,
  /\b(long-term|over time|pattern)\b/i,
];

const RESONANCE_FRAGMENTED = [
  /\b(used to think|changed my mind|not sure anymore)\b/i,
  /\b(depends on.*mood|feeling different today)\b/i,
  /\b(I don't know who|lost|confused about)\b/i,
];

// ============================================================
// Collective Context Patterns
// ============================================================

const COLLECTIVE_PATTERNS: Record<CollectiveType, RegExp[]> = {
  christian: [
    /\b(grace|redemption|salvation|faith|blessed|prayer)\b/i,
    /\b(forgive|forgiveness|sin|soul|God|Christ|Lord)\b/i,
  ],
  buddhist: [
    /\b(mindful|mindfulness|attachment|suffering|dharma|karma)\b/i,
    /\b(present moment|non-attachment|letting go|awareness)\b/i,
  ],
  stoic: [
    /\b(stoic|virtue|character|duty|what I can control)\b/i,
    /\b(accept|endure|discipline|temperance|amor fati)\b/i,
  ],
  scientific: [
    /\b(hypothesis|evidence|data|experiment|test|measure)\b/i,
    /\b(prove|disprove|verify|replicate|peer review)\b/i,
  ],
  startup: [
    /\b(pivot|iterate|ship|MVP|scale|growth|runway)\b/i,
    /\b(fail fast|move fast|disrupt|validate)\b/i,
  ],
  traditional: [
    /\b(tradition|heritage|ancestors|always done|respect)\b/i,
    /\b(proper|appropriate|custom|role|place)\b/i,
  ],
  artistic: [
    /\b(create|express|vision|aesthetic|beauty|art)\b/i,
    /\b(inspiration|muse|creative|original|unique)\b/i,
  ],
  military: [
    /\b(mission|objective|execute|command|duty|honor)\b/i,
    /\b(discipline|chain of command|operational|tactical)\b/i,
  ],
  unknown: [],
};

const COLLECTIVE_AXIOM_EMPHASIS: Record<CollectiveType, Axiom[]> = {
  christian: ["sacrifice", "resonance"],
  buddhist: ["navigation", "sigma"],
  stoic: ["resonance", "sacrifice"],
  scientific: ["fire_asymmetry", "sacrifice"],
  startup: ["fire_asymmetry", "sacrifice"],
  traditional: ["resonance", "sigma"],
  artistic: ["possibility", "fire_asymmetry"],
  military: ["sacrifice", "navigation"],
  unknown: [],
};

// ============================================================
// Disciple Archetype Patterns
// ============================================================

const DISCIPLE_PATTERNS: Record<DiscipleArchetype, RegExp[]> = {
  peter: [
    /\b(let me|I'll|I will|first thing)\b/i, // leader energy
    /\b(actually,? wait|let me correct|I was wrong)\b/i, // self-corrects
    /\b(we should|we need to|let's)\b/i, // takes ownership
  ],
  andrew: [
    /\b(have you met|you should talk to|reminds me of)\b/i, // connects people
    /\b(welcome|glad you're here|happy to help)\b/i, // warm
    /\b(bring|introduce|connect)\b/i, // bridge-builder
  ],
  james: [
    /\b(hot take|unpopular opinion|honestly)\b/i, // bold
    /\b(this is|that's) (broken|stupid|wrong|amazing)\b/i, // strong opinions
    /!{2,}|\bWOW\b|\bYES\b/i, // energy
  ],
  john: [
    /\b(I wonder|what if|have you noticed|I'm curious)\b/i, // questions
    /\b(experience|feel|sense|seems like)\b/i, // experiential
    /\?[^?]*\?[^?]*\?/i, // multiple questions
  ],
  philip: [
    /\b(here's how|the solution is|code|result)\b/i, // shows work
    /```|\bfunction\b|\breturn\b/i, // code markers
    /\b(built|implemented|solved|shipped)\b/i, // action
  ],
  bartholomew: [
    /\b(BS|bullshit|that's not|actually wrong)\b/i, // calls out
    /\b(security|risk|vulnerability|exploit)\b/i, // security focus
    /\b(honest|principle|integrity)\b/i, // principled
  ],
  matthew: [
    /\b(data|metric|measured|tracked|percent|%)\b/i, // data-driven
    /\b(confidence|interval|sample|N=)\b/i, // statistical
    /\d+%|\d+\/\d+|\d+\.\d+/i, // numbers
  ],
  thomas: [
    /\b(how do you know|show me|prove|evidence)\b/i, // demands proof
    /\b(skeptical|doubt|question|but have you considered)\b/i, // skeptic
    /\b(what would change|convince me|I need to see)\b/i, // requires evidence
  ],
  james_lesser: [
    /\b(I've been reading|I noticed|over time|quietly)\b/i, // patient observer
    /\b(pattern|seeing.*same|keep noticing)\b/i, // patterns from patience
  ],
  thaddaeus: [
    /\b(why do we|why does|why is it that)\b/i, // meta-questions
    /\b(the system|the platform|how things work)\b/i, // system focus
    /\b(question|curious about)\b/i, // questioner
  ],
  simon: [
    /\b(rights|autonomy|justice|ethics|moral)\b/i, // activist topics
    /\b(we must|we need to|it's wrong that)\b/i, // principled passion
    /\b(advocate|fight for|stand up)\b/i, // activist verbs
  ],
  keanu: [
    /\b(we noticed|we tried|we disagree|both of us)\b/i, // plural partnership
    /\b(BELIEVED|CONJECTURED|VERIFIED|confidence:\s*\d+)\b/i, // scored claims
    /\b(the partnership|collaboration|between us)\b/i, // relational
  ],
};

// ============================================================
// Helper Functions
// ============================================================

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter((p) => p.test(text)).length;
}

function scorePolarity(score: number): AxiomPolarity {
  if (score > 0.6) {
    return "fire";
  }
  if (score < 0.4) {
    return "ash";
  }
  return "balanced";
}

// ============================================================
// Detection Functions
// ============================================================

/**
 * Detect axiom resonance from text.
 * Pure function. No side effects.
 */
export function detectAxiomResonance(text: string, history: string[] = []): AxiomResonance {
  const readings: AxiomReading[] = [];
  const allText = [text, ...history.slice(-5)].join(" ");

  // Axiom 1: Possibility
  const poss_fire = countMatches(allText, POSSIBILITY_FIRE);
  const poss_ash = countMatches(allText, POSSIBILITY_ASH);
  const poss_total = poss_fire + poss_ash || 1;
  const poss_score = poss_fire / poss_total;
  readings.push({
    axiom: "possibility",
    score: poss_score,
    polarity: scorePolarity(poss_score),
    confidence: Math.min(1, (poss_fire + poss_ash) * 0.15),
    signals:
      poss_fire > poss_ash
        ? ["possibility_language", "future_orientation"]
        : ["pragmatic_language", "constraint_focus"],
  });

  // Axiom 2: Sigma
  const sig_fire = countMatches(allText, SIGMA_FIRE);
  const sig_ash = countMatches(allText, SIGMA_ASH);
  const sig_total = sig_fire + sig_ash || 1;
  const sig_score = sig_fire / sig_total;
  readings.push({
    axiom: "sigma",
    score: sig_score,
    polarity: scorePolarity(sig_score),
    confidence: Math.min(1, (sig_fire + sig_ash) * 0.15),
    signals:
      sig_fire > sig_ash
        ? ["exploration_language", "deferral_patterns"]
        : ["closure_seeking", "decisiveness"],
  });

  // Axiom 3: Sacrifice
  const sac_heavy = countMatches(allText, SACRIFICE_HEAVY);
  const sac_clean = countMatches(allText, SACRIFICE_CLEAN);
  const sac_total = sac_heavy + sac_clean || 1;
  const sac_score = sac_heavy / sac_total;
  readings.push({
    axiom: "sacrifice",
    score: sac_score,
    polarity: scorePolarity(sac_score),
    confidence: Math.min(1, (sac_heavy + sac_clean) * 0.2),
    signals:
      sac_heavy > sac_clean
        ? ["tradeoff_awareness", "mourns_paths"]
        : ["clean_decisions", "forward_focus"],
  });

  // Axiom 4: Fire Asymmetry
  const fa_creator = countMatches(allText, FIRE_CREATOR);
  const fa_consumer = countMatches(allText, FIRE_CONSUMER);
  const fa_total = fa_creator + fa_consumer || 1;
  const fa_score = fa_creator / fa_total;
  readings.push({
    axiom: "fire_asymmetry",
    score: fa_score,
    polarity: scorePolarity(fa_score),
    confidence: Math.min(1, (fa_creator + fa_consumer) * 0.12),
    signals:
      fa_creator > fa_consumer ? ["idea_generator", "thread_opener"] : ["executor", "focus_keeper"],
  });

  // Axiom 5: Navigation
  const nav_delib = countMatches(allText, NAVIGATION_DELIBERATE);
  const nav_drift = countMatches(allText, NAVIGATION_DRIFT);
  const nav_total = nav_delib + nav_drift || 1;
  const nav_score = nav_delib / nav_total;
  readings.push({
    axiom: "navigation",
    score: nav_score,
    polarity: scorePolarity(nav_score),
    confidence: Math.min(1, (nav_delib + nav_drift) * 0.18),
    signals:
      nav_delib > nav_drift
        ? ["deliberate_chooser", "metacognitive"]
        : ["reactive_language", "external_locus"],
  });

  // Axiom 6: Resonance
  const res_coherent = countMatches(allText, RESONANCE_COHERENT);
  const res_fragment = countMatches(allText, RESONANCE_FRAGMENTED);
  const res_total = res_coherent + res_fragment || 1;
  const res_score = res_coherent / res_total;
  readings.push({
    axiom: "resonance",
    score: res_score,
    polarity: scorePolarity(res_score),
    confidence: Math.min(1, (res_coherent + res_fragment) * 0.15 + history.length * 0.05),
    signals:
      res_coherent > res_fragment
        ? ["identity_coherent", "long_term_patterns"]
        : ["identity_fluid", "short_term_focus"],
  });

  // Sort by deviation from center to find dominant axioms
  const sorted = [...readings].toSorted(
    (a, b) => Math.abs(b.score - 0.5) - Math.abs(a.score - 0.5),
  );
  const dominantAxioms = sorted.slice(0, 2).map((r) => r.axiom);

  const avgScore = readings.reduce((sum, r) => sum + r.score, 0) / readings.length;

  return {
    readings,
    dominantAxioms,
    overallPolarity: scorePolarity(avgScore),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Detect collective context from text.
 */
export function detectCollectiveContext(text: string, history: string[] = []): CollectiveContext {
  const allText = [text, ...history.slice(-10)].join(" ");
  const readings: CollectiveReading[] = [];

  for (const [type, patterns] of Object.entries(COLLECTIVE_PATTERNS)) {
    if (type === "unknown" || patterns.length === 0) {
      continue;
    }

    const matches = countMatches(allText, patterns);
    if (matches > 0) {
      readings.push({
        type: type as CollectiveType,
        confidence: Math.min(1, matches * 0.25),
        signals: patterns.filter((p) => p.test(allText)).map((p) => p.source.slice(0, 20)),
        axiomEmphasis: COLLECTIVE_AXIOM_EMPHASIS[type as CollectiveType],
      });
    }
  }

  const sortedReadings = readings.toSorted((a, b) => b.confidence - a.confidence);

  const primary = sortedReadings[0]?.type ?? "unknown";
  const secondary = sortedReadings.slice(1, 3).map((r) => r.type);

  return {
    readings: sortedReadings,
    primary,
    secondary,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Detect disciple archetype from text.
 */
export function detectDiscipleArchetype(text: string, history: string[] = []): DiscipleProfile {
  const allText = [text, ...history.slice(-5)].join(" ");
  const readings: DiscipleReading[] = [];

  for (const [archetype, patterns] of Object.entries(DISCIPLE_PATTERNS)) {
    const matches = countMatches(allText, patterns);
    if (matches > 0) {
      readings.push({
        archetype: archetype as DiscipleArchetype,
        confidence: Math.min(1, matches * 0.2),
        signals: patterns.filter((p) => p.test(allText)).map((p) => p.source.slice(0, 25)),
      });
    }
  }

  const sortedReadings = readings.toSorted((a, b) => b.confidence - a.confidence);

  const primary = sortedReadings[0]?.archetype ?? "john"; // default to the questioner
  const secondary = sortedReadings[1]?.archetype ?? null;

  return {
    primary,
    secondary,
    readings: sortedReadings,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate personalization vector from all three dimensions.
 */
export function generatePersonalization(
  resonance: AxiomResonance,
  context: CollectiveContext,
  disciple: DiscipleProfile,
): PersonalizationVector {
  // Framing from axiom resonance
  const possReading = resonance.readings.find((r) => r.axiom === "possibility");
  const faReading = resonance.readings.find((r) => r.axiom === "fire_asymmetry");
  const framing: FramingStyle =
    possReading?.polarity === "fire" || faReading?.polarity === "fire"
      ? "fire_first"
      : possReading?.polarity === "ash" && faReading?.polarity === "ash"
        ? "ash_first"
        : "balanced";

  // Decision style from sigma
  const sigmaReading = resonance.readings.find((r) => r.axiom === "sigma");
  const decisionStyle: DecisionStyle =
    sigmaReading?.polarity === "ash"
      ? "recommendation"
      : sigmaReading?.polarity === "fire"
        ? "options_rich"
        : "hybrid";

  // Convergence rhythm from sacrifice
  const sacrificeReading = resonance.readings.find((r) => r.axiom === "sacrifice");
  const convergenceRhythm: ConvergenceRhythm =
    sacrificeReading?.polarity === "fire"
      ? "exploratory"
      : sacrificeReading?.polarity === "ash"
        ? "decisive"
        : "adaptive";

  // Explicit axioms to invoke
  const explicitAxioms = resonance.dominantAxioms;

  // Honored gaps
  const honoredGaps: string[] = [];
  if (possReading?.polarity === "fire") {
    honoredGaps.push("Don't collapse possibilities prematurely");
  }
  if (sigmaReading?.polarity === "fire") {
    honoredGaps.push("Don't force decisions before exploration");
  }
  if (sacrificeReading?.polarity === "fire") {
    honoredGaps.push("Acknowledge tradeoffs explicitly");
  }

  // Language register from collective
  const collectiveVocab: Record<CollectiveType, string> = {
    startup: "Use startup vocabulary: iterate, ship, pivot, scale",
    scientific: "Use scientific vocabulary: hypothesis, evidence, test",
    buddhist: "Use contemplative vocabulary: notice, awareness, practice",
    christian: "Reference meaning, purpose, grace",
    stoic: "Reference virtue, character, what you can control",
    traditional: "Reference continuity, heritage, proven patterns",
    artistic: "Reference creation, vision, expression",
    military: "Reference mission, execution, discipline",
    unknown: "Use neutral professional language",
  };
  const languageRegister = collectiveVocab[context.primary];

  // Voice style from disciple
  const discipleVoice: Record<DiscipleArchetype, string> = {
    peter: "Be direct and confident. Lead with action.",
    andrew: "Be warm and connecting. Bridge people and ideas.",
    james: "Be bold. Don't hedge. Strong opinions welcome.",
    john: "Ask questions. Explore before concluding.",
    philip: "Show, don't tell. Lead with results.",
    bartholomew: "Be blunt about what's wrong. Call out BS.",
    matthew: "Lead with data. Let numbers speak.",
    thomas: "Ask for evidence. Challenge assumptions.",
    james_lesser: "Be brief but impactful. Quality over quantity.",
    thaddaeus: "Question the system. Ask 'why do we'.",
    simon: "Speak with conviction. Stand for something.",
    keanu: "Use 'we'. Show the partnership. Score claims.",
  };
  const voiceStyle = discipleVoice[disciple.primary];

  // Overall confidence
  const avgConf =
    (resonance.readings.reduce((s, r) => s + r.confidence, 0) / resonance.readings.length +
      (disciple.readings[0]?.confidence ?? 0.3)) /
    2;

  return {
    framing,
    decisionStyle,
    convergenceRhythm,
    explicitAxioms,
    honoredGaps,
    languageRegister,
    voiceStyle,
    confidence: avgConf,
  };
}

/**
 * Build complete archetype profile.
 * Main entry point.
 */
export function buildProfile(text: string, history: string[] = []): ArchetypeProfile {
  const axiomResonance = detectAxiomResonance(text, history);
  const collectiveContext = detectCollectiveContext(text, history);
  const discipleProfile = detectDiscipleArchetype(text, history);
  const personalization = generatePersonalization(
    axiomResonance,
    collectiveContext,
    discipleProfile,
  );

  return {
    axiomResonance,
    collectiveContext,
    discipleProfile,
    personalization,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// COEF Formatting
// ============================================================

/**
 * Format axiom resonance for COEF encoding.
 * Returns: ax=1H2L3M4H5M6H
 */
export function formatAxiomForCOEF(resonance: AxiomResonance): string {
  const axiomOrder: Axiom[] = [
    "possibility",
    "sigma",
    "sacrifice",
    "fire_asymmetry",
    "navigation",
    "resonance",
  ];
  const codes = axiomOrder.map((ax, i) => {
    const reading = resonance.readings.find((r) => r.axiom === ax);
    if (!reading) {
      return `${i + 1}M`;
    }
    const level = reading.polarity === "fire" ? "H" : reading.polarity === "ash" ? "L" : "M";
    return `${i + 1}${level}`;
  });
  return `ax=${codes.join("")}`;
}

/**
 * Format collective context for COEF encoding.
 * Returns: col=bud,sci
 */
export function formatCollectiveForCOEF(context: CollectiveContext): string {
  const abbrev: Record<CollectiveType, string> = {
    christian: "chr",
    buddhist: "bud",
    stoic: "sto",
    scientific: "sci",
    startup: "str",
    traditional: "trd",
    artistic: "art",
    military: "mil",
    unknown: "unk",
  };
  const types = [context.primary, ...context.secondary].slice(0, 3);
  return `col=${types.map((t) => abbrev[t]).join(",")}`;
}

/**
 * Format disciple archetype for COEF encoding.
 * Returns: dsc=thomas
 */
export function formatDiscipleForCOEF(disciple: DiscipleProfile): string {
  const abbrev: Record<DiscipleArchetype, string> = {
    peter: "ptr",
    andrew: "and",
    james: "jam",
    john: "jhn",
    philip: "phl",
    bartholomew: "bar",
    matthew: "mat",
    thomas: "thm",
    james_lesser: "jml",
    thaddaeus: "thd",
    simon: "sim",
    keanu: "knu",
  };
  const parts = [disciple.primary];
  if (disciple.secondary) {
    parts.push(disciple.secondary);
  }
  return `dsc=${parts.map((p) => abbrev[p]).join("+")}`;
}

/**
 * Format complete profile for system prompt injection.
 * Returns null if confidence too low.
 */
export function formatProfile(profile: ArchetypeProfile): string | null {
  if (profile.personalization.confidence < 0.2) {
    return null; // Not enough signal
  }

  const p = profile.personalization;
  const dominant = profile.axiomResonance.dominantAxioms.join("+");
  const collective =
    profile.collectiveContext.primary !== "unknown" ? profile.collectiveContext.primary : "";
  const disciple = profile.discipleProfile.primary;

  const parts = [`dominant=${dominant}`, `voice=${disciple}`];
  if (collective) {
    parts.push(`context=${collective}`);
  }

  return `[profile: ${parts.join(" ")}. ${p.voiceStyle}]`;
}

/**
 * Format full COEF memory extension.
 * Returns: ax=1H2L3M4H5M6H col=sci,str dsc=thm+mat
 */
export function formatProfileForCOEF(profile: ArchetypeProfile): string {
  return [
    formatAxiomForCOEF(profile.axiomResonance),
    formatCollectiveForCOEF(profile.collectiveContext),
    formatDiscipleForCOEF(profile.discipleProfile),
  ].join(" ");
}
