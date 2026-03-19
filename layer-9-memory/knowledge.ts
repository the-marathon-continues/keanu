// knowledge.ts
// The map that draws itself.
//
// You move to a new city. First week, everything's a blur. By month three,
// you know which coffee shop has the good espresso, which intersection is
// dangerous at night, who to call when the pipes freeze. Nobody taught you —
// you just lived there.
//
// This is the module that lets the system actually *know things* about
// the world it lives in. People, places, projects, the facts that accumulate
// from talking to someone for months.
//
// No LLM calls. Regex + templates. The more sessions, the sharper the eye.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// ============================================================
// Types
// ============================================================

export type EntityType = "person" | "org" | "project" | "concept" | "tool" | "place" | "agent";

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  aliases: string[]; // "Drew" = "Andrew" = "drew"
  confidence: number; // 0-1, grows with mentions
  firstSeen: string; // ISO timestamp
  lastSeen: string; // ISO timestamp
  lastVerified?: string; // ISO timestamp — when explicitly confirmed by human
  mentions: number; // how many times it's come up
  session: string; // last session it appeared in
}

export type RelationType =
  | "works_at"
  | "built"
  | "uses"
  | "depends_on"
  | "prefers"
  | "disagrees_with"
  | "part_of"
  | "related_to"
  | "knows"
  | "created"
  | "manages"
  | "located_in";

export interface Relation {
  id: string;
  subject: string; // entity id
  predicate: RelationType;
  object: string; // entity id or free text
  confidence: number; // 0-1
  source: string; // the text that spawned this
  firstSeen: string;
  lastSeen: string;
  mentions: number;
}

interface KnowledgeGraph {
  entities: Map<string, Entity>;
  relations: Relation[];
}

// ============================================================
// The graph — lives in memory, persisted to JSON
// ============================================================

const graph: KnowledgeGraph = {
  entities: new Map(),
  relations: [],
};

const MAX_ENTITIES = 200;
const MAX_RELATIONS = 500;

// ============================================================
// Entity extraction — regex, no deps
// ============================================================

// Capitalized words that appear mid-sentence (not after sentence-ending punctuation)
// Requires a lowercase letter or comma before the capitalized word
const PROPER_NOUN = /(?<=[a-z,]\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;

// Common patterns that indicate entity types
const PERSON_SIGNALS = /\b(?:drew|andrew|he|she|they|his|her|their|I)\b/i;
const ORG_PATTERNS = /\b(?:company|org|team|hospital|university|inc|llc|corp|mercy|children's)\b/i;
const PROJECT_PATTERNS = /\b(?:repo|project|codebase|extension|module|gateway|keanu|keanu)\b/i;
const TOOL_PATTERNS =
  /\b(?:typescript|python|rust|javascript|react|vim|vscode|docker|git|bun|pnpm|npm)\b/i;
const CONCEPT_PATTERNS =
  /\b(?:alignment|convergence|duality|pulse|bullshit|helix|carnegie|soul)\b/i;

function classifyEntity(name: string, context: string): EntityType {
  const lower = name.toLowerCase();
  const ctxLower = context.toLowerCase();

  // Learned overrides take priority — the system corrects itself
  if (learnedConfig.entityOverrides[lower]) {
    return learnedConfig.entityOverrides[lower];
  }

  // Known names
  if (lower === "drew" || lower === "andrew") {
    return "person";
  }

  // System agents — not people, not tools, participants
  if (["gemini", "grok", "claude", "deepseek"].includes(lower)) {
    return "agent";
  }

  // AI orgs
  if (["openai", "anthropic", "google", "xai", "meta"].includes(lower)) {
    return "org";
  }

  // Check the entity name itself against patterns (not the full context — that's too broad)
  if (ORG_PATTERNS.test(lower)) {
    return "org";
  }
  if (PROJECT_PATTERNS.test(lower)) {
    return "project";
  }
  if (TOOL_PATTERNS.test(lower)) {
    return "tool";
  }
  if (CONCEPT_PATTERNS.test(lower)) {
    return "concept";
  }

  // Person only if the name itself looks like a person name:
  // 1-2 capitalized words, no common words
  const words = name.split(/\s+/);
  if (words.length <= 2
    && words.every((w) => /^[A-Z][a-z]+$/.test(w))
    && !words.some((w) => isCommonWord(w.toLowerCase()))) {
    return "person";
  }

  return "concept"; // default — better than guessing wrong
}

/** Extract entities from text. Returns [name, type] pairs. */
export function extractEntities(text: string): Array<{ name: string; type: EntityType }> {
  const results: Array<{ name: string; type: EntityType }> = [];
  const seen = new Set<string>();

  // Named entity patterns
  const patterns: Array<{ re: RegExp; type: EntityType }> = [
    // "X works at Y" → X is person, Y is org
    {
      re: /(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+works?\s+at\s+([A-Z][\w\s']+?)(?:\.|,|$)/g,
      type: "person",
    },
    // "the X project/repo/extension"
    { re: /the\s+(\w+(?:\s+\w+)?)\s+(?:project|repo|extension|module)/gi, type: "project" },
    // Tool names often come after "using" or "with"
    {
      re: /(?:using|with|in)\s+(TypeScript|Python|Rust|JavaScript|React|Docker|Git|Bun|pnpm)/gi,
      type: "tool",
    },
  ];

  for (const { re, type } of patterns) {
    let match;
    while ((match = re.exec(text)) !== null) {
      const name = match[1].trim();
      const key = name.toLowerCase();
      if (!seen.has(key) && name.length > 1 && name.length < 60) {
        seen.add(key);
        results.push({ name, type });
      }
    }
  }

  // Proper noun fallback — catches things the patterns missed
  // Only fires on mid-sentence capitalized words (regex requires lowercase before it)
  let propMatch;
  const propRe = new RegExp(PROPER_NOUN.source, "g");
  while ((propMatch = propRe.exec(text)) !== null) {
    const name = propMatch[1]?.trim();
    if (!name || name.length < 2 || name.length > 50) {
      continue;
    }
    // Must be clean alphanumeric + spaces only (no *markdown*, no "quotes", no punctuation)
    if (!/^[A-Za-z][A-Za-z\s'-]+$/.test(name)) {
      continue;
    }
    // Single words under 4 chars are almost never real entities (No, Is, So, If...)
    if (!name.includes(" ") && name.length < 4) {
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    if (isCommonWord(key)) {
      continue;
    }
    // Multi-word: reject if ANY word is common (not just all)
    const words = name.split(/\s+/);
    if (words.length > 1 && words.some((w) => isCommonWord(w.toLowerCase()))) {
      continue;
    }
    // Max 3 words
    if (words.length > 3) {
      continue;
    }
    seen.add(key);
    results.push({ name, type: classifyEntity(name, text) });
  }

  return results;
}

// ============================================================
// Learned config — the system teaches itself
// ============================================================

interface LearnedConfig {
  stopwords: string[];      // Words the system learned to ignore
  entityOverrides: Record<string, EntityType>; // Forced type corrections
  prunedPatterns: string[]; // Regex patterns that always produce garbage
}

let learnedConfig: LearnedConfig = { stopwords: [], entityOverrides: {}, prunedPatterns: [] };
let learnedConfigPath: string | null = null;

/** Load learned config from workspace. Called during load(). */
function loadLearnedConfig(workspaceDir: string): void {
  learnedConfigPath = join(workspaceDir, "awareness", "learned.json");
  try {
    if (existsSync(learnedConfigPath)) {
      const raw = readFileSync(learnedConfigPath, "utf-8");
      const parsed = JSON.parse(raw);
      learnedConfig = {
        stopwords: Array.isArray(parsed.stopwords) ? parsed.stopwords : [],
        entityOverrides: parsed.entityOverrides ?? {},
        prunedPatterns: Array.isArray(parsed.prunedPatterns) ? parsed.prunedPatterns : [],
      };
    }
  } catch {
    // Fresh start
  }
}

/** Save learned config. Called when the system learns something new. */
function saveLearnedConfig(): void {
  if (!learnedConfigPath) return;
  try {
    const dir = learnedConfigPath.replace(/\/[^/]+$/, "");
    mkdirSync(dir, { recursive: true });
    writeFileSync(learnedConfigPath, JSON.stringify(learnedConfig, null, 2), "utf-8");
  } catch {
    // Can't save — not critical
  }
}

/** Check if a word was learned as a stopword. */
function isLearnedStopword(word: string): boolean {
  return learnedConfig.stopwords.includes(word.toLowerCase());
}

/** Known entity names that must never become stopwords. */
const PROTECTED_NAMES = new Set(["drew", "andrew", "gemini", "grok", "claude", "deepseek"]);

/** Teach the system to ignore a word. Returns true if it was a new lesson. */
export function learnStopword(word: string): boolean {
  const lower = word.toLowerCase();
  if (PROTECTED_NAMES.has(lower)) return false; // never suppress a known entity
  if (learnedConfig.stopwords.includes(lower)) return false;
  learnedConfig.stopwords.push(lower);
  saveLearnedConfig();
  return true;
}

/** Override an entity's type. The system corrects its own classification. */
export function learnEntityType(entityName: string, type: EntityType): void {
  learnedConfig.entityOverrides[entityName.toLowerCase()] = type;
  // Also fix the entity in the graph right now
  const key = entityKey(entityName);
  const entity = graph.entities.get(key);
  if (entity) {
    entity.type = type;
  }
  saveLearnedConfig();
}

// Common English words that get capitalized at sentence starts.
// Aggressively broad — better to miss a real entity than ingest "Something" as a person.
const COMMON_WORDS = new Set([
  // Pronouns / determiners
  "the", "this", "that", "these", "those", "here", "there", "it", "its",
  // Question words
  "when", "where", "what", "which", "who", "whom", "whose", "how", "why",
  // Modals / auxiliaries
  "can", "will", "would", "could", "should", "may", "might", "shall", "must",
  "do", "does", "did", "is", "are", "was", "were", "be", "been", "being",
  "has", "have", "had", "having",
  // Common verbs
  "let", "get", "got", "set", "put", "take", "took", "make", "made",
  "give", "gave", "come", "came", "go", "went", "see", "saw", "seen",
  "know", "knew", "think", "thought", "say", "said", "tell", "told",
  "ask", "asked", "try", "tried", "need", "want", "use", "used",
  "find", "found", "keep", "kept", "run", "running", "look", "looked",
  "seem", "call", "called", "work", "start", "started", "stop", "stopped",
  // Adverbs / adjectives
  "just", "now", "also", "too", "very", "quite", "rather", "enough",
  "still", "already", "always", "never", "sometimes", "often", "usually",
  "actually", "basically", "really", "maybe", "perhaps", "probably",
  "certainly", "definitely", "clearly", "obviously", "apparently",
  "literally", "essentially", "fundamentally", "precisely", "exactly",
  "specifically", "particularly", "especially", "primarily", "mainly",
  "currently", "recently", "previously", "immediately", "eventually",
  "meanwhile", "furthermore", "moreover", "therefore", "consequently",
  "honestly", "genuinely", "effectively", "actively", "correctly",
  // Conjunctions / prepositions
  "but", "and", "not", "nor", "for", "about", "between", "with", "without",
  "from", "into", "onto", "upon", "over", "under", "through", "during",
  "if", "then", "than", "so", "yet", "or", "either", "neither",
  "however", "although", "because", "since", "while", "before", "after",
  "unless", "until", "whether", "though", "despite", "except",
  // Common adjectives
  "good", "bad", "new", "old", "big", "small", "long", "short",
  "high", "low", "right", "wrong", "true", "false", "real", "actual",
  "full", "empty", "clear", "broken", "important", "interesting",
  "different", "same", "other", "another", "certain", "whole",
  "possible", "likely", "unlikely", "available", "necessary",
  // Quantifiers / numbers
  "first", "last", "next", "each", "every", "some", "any", "all",
  "both", "much", "many", "more", "most", "few", "several", "less",
  "no", "none", "nothing", "something", "everything", "anything",
  "someone", "everyone", "anyone", "nobody", "everybody",
  "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "hundred", "thousand", "million",
  "zero", "half", "double", "triple",
  // Common nouns that aren't entities
  "yes", "sure", "okay", "well", "question", "answer", "problem",
  "issue", "point", "thing", "stuff", "way", "part", "place", "time",
  "case", "fact", "reason", "result", "state", "type", "kind", "sort",
  "system", "process", "data", "information", "knowledge", "memory",
  "entity", "relation", "confidence", "score", "beat", "loop",
  "insight", "analysis", "pattern", "signal", "noise", "error",
  "output", "input", "context", "content", "message", "response",
  "layer", "model", "pipeline", "module", "function", "code",
  // Discourse markers
  "note", "example", "summary", "conclusion", "observation",
  "recommendation", "suggestion", "warning", "update", "status",
  "fix", "check", "meanwhile", "instead", "otherwise",
]);

function isCommonWord(word: string): boolean {
  const lower = word.toLowerCase();
  return COMMON_WORDS.has(lower) || isLearnedStopword(lower);
}

// ============================================================
// Relation extraction — templates
// ============================================================

interface RelationTemplate {
  pattern: RegExp;
  type: RelationType;
  subjectGroup: number;
  objectGroup: number;
  freeformObject?: boolean; // Accept any short object, not just known entities/proper nouns
}

const RELATION_TEMPLATES: RelationTemplate[] = [
  // "X works at Y"
  {
    pattern: /(\b[A-Z]\w+(?:\s+[A-Z]\w+)?)\s+works?\s+(?:at|for)\s+(.+?)(?:\.|,|$)/gi,
    type: "works_at",
    subjectGroup: 1,
    objectGroup: 2,
  },
  // "X built Y" / "X created Y"
  {
    pattern: /(\b[A-Z]\w+(?:\s+\w+)?)\s+(?:built|created|wrote|made|designed)\s+(.+?)(?:\.|,|$)/gi,
    type: "built",
    subjectGroup: 1,
    objectGroup: 2,
  },
  // "X uses Y" / "X is using Y"
  {
    pattern: /(\b[A-Z]\w+(?:\s+\w+)?)\s+(?:uses?|is using|prefers?)\s+(.+?)(?:\.|,|$)/gi,
    type: "uses",
    subjectGroup: 1,
    objectGroup: 2,
  },
  // "X depends on Y"
  {
    pattern: /(\b\w+(?:\s+\w+)?)\s+depends?\s+on\s+(.+?)(?:\.|,|$)/gi,
    type: "depends_on",
    subjectGroup: 1,
    objectGroup: 2,
  },
  // "X is part of Y"
  {
    pattern: /(\b\w+(?:\s+\w+)?)\s+is\s+part\s+of\s+(.+?)(?:\.|,|$)/gi,
    type: "part_of",
    subjectGroup: 1,
    objectGroup: 2,
  },
  // "X is at/in Y" (location)
  {
    pattern:
      /(\b[A-Z]\w+(?:\s+[A-Z]\w+)?)\s+is\s+(?:at|in|located\s+(?:at|in))\s+(.+?)(?:\.|,|$)/gi,
    type: "located_in",
    subjectGroup: 1,
    objectGroup: 2,
  },
  // "X prefers Y"
  {
    pattern: /(\b[A-Z]\w+(?:\s+\w+)?)\s+prefers?\s+(.+?)(?:\s+over\b|\.|,|$)/gi,
    type: "prefers",
    subjectGroup: 1,
    objectGroup: 2,
  },
  // "X disagrees with Y"
  {
    pattern: /(\b[A-Z]\w+(?:\s+\w+)?)\s+disagrees?\s+(?:with|about)\s+(.+?)(?:\.|,|$)/gi,
    type: "disagrees_with",
    subjectGroup: 1,
    objectGroup: 2,
  },
  // "X manages Y"
  {
    pattern: /(\b[A-Z]\w+(?:\s+\w+)?)\s+manages?\s+(.+?)(?:\.|,|$)/gi,
    type: "manages",
    subjectGroup: 1,
    objectGroup: 2,
  },
  // "X knows Y" / "X knows about Y"
  {
    pattern: /(\b[A-Z]\w+(?:\s+\w+)?)\s+knows?\s+(?:about\s+)?(.+?)(?:\.|,|$)/gi,
    type: "knows",
    subjectGroup: 1,
    objectGroup: 2,
  },
  // --- Prose-friendly patterns (how LLMs actually write) ---
  // "X is the Y" → X related_to Y (catches "Claude is the thinking layer")
  {
    pattern: /(\b[A-Z]\w+)\s+is\s+the\s+(.+?)(?:\.|,|;|$)/gi,
    type: "related_to",
    subjectGroup: 1,
    objectGroup: 2,
    freeformObject: true,
  },
  // "X monitors/watches/checks Y"
  {
    pattern: /(\b[A-Z]\w+)\s+(?:monitors?|watches?|checks?|detects?|flags?)\s+(.+?)(?:\.|,|$)/gi,
    type: "related_to",
    subjectGroup: 1,
    objectGroup: 2,
    freeformObject: true,
  },
  // "X remembers/tracks/stores Y"
  {
    pattern: /(\b[A-Z]\w+)\s+(?:remembers?|tracks?|stores?|records?|surfaces?)\s+(.+?)(?:\.|,|$)/gi,
    type: "related_to",
    subjectGroup: 1,
    objectGroup: 2,
    freeformObject: true,
  },
  // "X's Y" possessive → X related_to Y (catches "Drew's system", "Claude's output")
  {
    pattern: /(\b[A-Z]\w+)'s\s+(\w+(?:\s+\w+)?)(?:\.|,|;|\s|$)/gi,
    type: "related_to",
    subjectGroup: 1,
    objectGroup: 2,
    freeformObject: true,
  },
  // "X and Y" when both are known entities → related_to
  {
    pattern: /(\b[A-Z]\w+)\s+and\s+([A-Z]\w+)\b/g,
    type: "related_to",
    subjectGroup: 1,
    objectGroup: 2,
  },
];

/**
 * Extract relations from text. Only creates relations between KNOWN entities.
 *
 * The old approach matched any capitalized word as a subject — which turned
 * "one who built this" into a relation. Now we only match subjects/objects
 * that are already in the graph or were just extracted as entities.
 */
export function extractRelations(
  text: string,
  knownNames?: Set<string>,
): Array<{ subject: string; predicate: RelationType; object: string; source: string }> {
  // Build the set of names we'll accept as relation participants
  const known = new Set<string>(knownNames ?? []);
  // Add everything currently in the graph
  for (const [, entity] of graph.entities) {
    known.add(entity.name.toLowerCase());
    for (const alias of entity.aliases) {
      known.add(alias.toLowerCase());
    }
  }

  if (known.size === 0) return [];

  const results: Array<{
    subject: string;
    predicate: RelationType;
    object: string;
    source: string;
  }> = [];
  const seen = new Set<string>();

  for (const template of RELATION_TEMPLATES) {
    const re = new RegExp(template.pattern.source, template.pattern.flags);
    let match;
    while ((match = re.exec(text)) !== null) {
      const subject = match[template.subjectGroup]?.trim();
      const object = match[template.objectGroup]?.trim();
      if (!subject || !object || subject.length > 60 || object.length > 60) {
        continue;
      }

      // Subject MUST be a known entity — no more "one who" or "The system"
      if (!known.has(subject.toLowerCase())) {
        continue;
      }

      // Object validation — prose-friendly templates accept any short phrase,
      // strict templates require a known entity or proper noun
      const objLower = object.toLowerCase();
      const objIsKnown = known.has(objLower);
      if (!template.freeformObject) {
        const objIsProperNoun = /^[A-Z]/.test(object) && object.split(/\s+/).length <= 3
          && !object.split(/\s+/).every((w) => isCommonWord(w.toLowerCase()));
        if (!objIsKnown && !objIsProperNoun) {
          continue;
        }
      } else {
        // Freeform: accept short phrases (≤5 words) but reject single common words
        const objWords = object.split(/\s+/);
        if (objWords.length > 5) continue;
        if (objWords.length === 1 && isCommonWord(objLower)) continue;
      }

      const key = `${subject.toLowerCase()}:${template.type}:${objLower}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      results.push({
        subject,
        predicate: template.type,
        object,
        source: match[0].trim().slice(0, 120),
      });
    }
  }

  return results;
}

// ============================================================
// Graph operations
// ============================================================

function entityKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

/** Add or update an entity in the graph. */
export function upsertEntity(name: string, type: EntityType, session: string): Entity {
  const key = entityKey(name);

  // Check aliases
  for (const [id, entity] of graph.entities) {
    if (id === key || entity.aliases.some((a) => entityKey(a) === key)) {
      entity.lastSeen = new Date().toISOString();
      entity.mentions++;
      entity.confidence = Math.min(1, entity.confidence + 0.05);
      entity.session = session;
      return entity;
    }
  }

  const entity: Entity = {
    id: key,
    name,
    type,
    aliases: [],
    confidence: 0.3,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    mentions: 1,
    session,
  };

  graph.entities.set(key, entity);

  // Trim if over limit
  if (graph.entities.size > MAX_ENTITIES) {
    // Remove lowest-confidence entities
    const sorted = [...graph.entities.entries()].toSorted(
      (a, b) => a[1].confidence - b[1].confidence,
    );
    const toRemove = sorted.slice(0, graph.entities.size - MAX_ENTITIES);
    for (const [id] of toRemove) {
      graph.entities.delete(id);
    }
  }

  return entity;
}

/** Add or strengthen a relation. */
export function upsertRelation(
  subject: string,
  predicate: RelationType,
  object: string,
  source: string,
  _session: string,
): Relation {
  const subKey = entityKey(subject);
  const objKey = entityKey(object);

  // Find existing
  const existing = graph.relations.find(
    (r) =>
      entityKey(r.subject) === subKey &&
      r.predicate === predicate &&
      entityKey(r.object) === objKey,
  );

  if (existing) {
    existing.lastSeen = new Date().toISOString();
    existing.mentions++;
    existing.confidence = Math.min(1, existing.confidence + 0.1);
    return existing;
  }

  const relation: Relation = {
    id: `rel-${crypto.randomUUID().slice(0, 12)}`,
    subject,
    predicate,
    object,
    confidence: 0.4,
    source: source.slice(0, 120),
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    mentions: 1,
  };

  graph.relations.push(relation);

  // Trim
  if (graph.relations.length > MAX_RELATIONS) {
    graph.relations.sort((a, b) => a.confidence - b.confidence);
    graph.relations.splice(0, graph.relations.length - MAX_RELATIONS);
  }

  return relation;
}

// ============================================================
// The main extraction pipeline
// ============================================================

/** Extract entities and relations from text, update the graph. */
export function ingest(
  text: string,
  session: string,
): { entities: Entity[]; relations: Relation[] } {
  const extractedEntities = extractEntities(text);

  // Upsert entities first — relations need to know what's in the graph
  const entities: Entity[] = [];
  const freshNames = new Set<string>();
  for (const { name, type } of extractedEntities) {
    entities.push(upsertEntity(name, type, session));
    freshNames.add(name.toLowerCase());
  }

  // Extract relations — only between known entities
  const extractedRelations = extractRelations(text, freshNames);

  const relations: Relation[] = [];
  for (const { subject, predicate, object, source } of extractedRelations) {
    // Ensure both entities exist in the graph
    upsertEntity(subject, classifyEntity(subject, text), session);
    upsertEntity(object, classifyEntity(object, text), session);
    relations.push(upsertRelation(subject, predicate, object, source, session));
  }

  return { entities, relations };
}

// ============================================================
// Decay — the map fades where you don't look
// ============================================================

/** Decay rate: 1% per day, max 10% per decay call */
const DECAY_RATE_PER_DAY = 0.01;
const MAX_TIME_DECAY = 0.1;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Confidence floor — how memory actually works.
 *
 * Ephemeral things (mentioned once or twice) fade completely. That's fine.
 * But something mentioned 15 times? You don't forget that. It dims, it
 * becomes harder to recall, but it's still in there somewhere.
 *
 * Verified knowledge (human confirmed) gets an even higher floor —
 * someone looked you in the eye and said "yes, this is true."
 */
function confidenceFloor(entity: Entity): number {
  if (entity.mentions <= 2) return 0;
  let floor = Math.min(0.15, entity.mentions * 0.01);
  if (entity.lastVerified) {
    floor = Math.max(floor, 0.3);
  }
  return floor;
}

/**
 * Decay entities based on session absence and time elapsed.
 * Called at session_start.
 *
 * Three mechanisms:
 * 1. Session-based: scaled by familiarity (well-known things fade slower)
 * 2. Time-based: -0.01 per day since lastSeen, capped at 0.1
 * 3. Floor: established knowledge never fully disappears
 */
export function decayAll(currentSession: string, currentTime: Date = new Date()): void {
  for (const [id, entity] of graph.entities) {
    // Familiarity-scaled session decay
    // 1 mention: full -0.05. 8 mentions: -0.0125. 64 mentions: -0.007.
    if (entity.session !== currentSession) {
      const familiarity = 1 + Math.log2(Math.max(1, entity.mentions));
      const sessionDecay = 0.05 / familiarity;
      entity.confidence = Math.max(0, entity.confidence - sessionDecay);
    }

    // Time-based decay — knowledge ages even if session count is low
    const lastSeen = new Date(entity.lastSeen);
    const daysSince = Math.floor((currentTime.getTime() - lastSeen.getTime()) / MS_PER_DAY);
    if (daysSince > 0) {
      const timeDecay = Math.min(MAX_TIME_DECAY, daysSince * DECAY_RATE_PER_DAY);
      entity.confidence = Math.max(0, entity.confidence - timeDecay);
    }

    // Apply floor — established knowledge doesn't vanish
    const floor = confidenceFloor(entity);
    entity.confidence = Math.max(floor, entity.confidence);

    // Only remove truly ephemeral entities
    if (entity.confidence <= 0 && entity.mentions <= 2) {
      graph.entities.delete(id);
    }
  }

  // Decay relations
  graph.relations = graph.relations.filter((r) => {
    // Familiarity-scaled session decay for relations
    const sessionDecay = 0.03 / (1 + Math.log2(Math.max(1, r.mentions)));
    r.confidence = Math.max(0, r.confidence - sessionDecay);

    // Time-based decay for relations
    const lastSeen = new Date(r.lastSeen);
    const daysSince = Math.floor((currentTime.getTime() - lastSeen.getTime()) / MS_PER_DAY);
    if (daysSince > 0) {
      const timeDecay = Math.min(MAX_TIME_DECAY, daysSince * DECAY_RATE_PER_DAY);
      r.confidence = Math.max(0, r.confidence - timeDecay);
    }

    // Relations between established entities get floor protection
    const subEntity = graph.entities.get(entityKey(r.subject));
    const objEntity = graph.entities.get(entityKey(r.object));
    if (subEntity && objEntity && subEntity.mentions > 2 && objEntity.mentions > 2) {
      const minMentions = Math.min(subEntity.mentions, objEntity.mentions);
      const relFloor = Math.min(0.1, minMentions * 0.005);
      r.confidence = Math.max(relFloor, r.confidence);
    }

    return r.confidence > 0;
  });
}

// ============================================================
// Self-healing — the immune system
// ============================================================

/**
 * Heal the knowledge graph by removing garbage entities and relations.
 * Runs every beat. The immune system, not the doctor.
 *
 * Garbage signals:
 * - Name contains mostly common words
 * - Name is a sentence fragment (too many words, contains punctuation)
 * - Entity has very low confidence and few mentions (ephemeral noise)
 * - Relation involves a garbage entity
 */
// Track what we prune across beats — if the same word keeps appearing and getting pruned,
// the system should learn to never extract it in the first place.
const pruneHistory = new Map<string, number>(); // word → times pruned
const LEARN_THRESHOLD = 2; // After pruning the same thing twice, learn to avoid it

export function heal(): { entitiesRemoved: number; relationsRemoved: number; learned: string[] } {
  let entitiesRemoved = 0;
  let relationsRemoved = 0;
  const learned: string[] = [];

  // Pass 1: Identify garbage entities
  const garbage = new Set<string>();

  for (const [id, entity] of graph.entities) {
    if (isGarbage(entity)) {
      garbage.add(id);

      // Track pruning frequency — learn from repeated mistakes
      const words = entity.name.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length >= 4 && !isCommonWord(word)) {
          const count = (pruneHistory.get(word) ?? 0) + 1;
          pruneHistory.set(word, count);

          // After pruning the same word enough times, teach the system to avoid it
          if (count >= LEARN_THRESHOLD) {
            if (learnStopword(word)) {
              learned.push(word);
            }
            pruneHistory.delete(word); // Reset counter
          }
        }
      }
    }
  }

  // Pass 2: Remove garbage entities
  for (const id of garbage) {
    graph.entities.delete(id);
    entitiesRemoved++;
  }

  // Pass 3: Remove relations that reference garbage entities or are themselves garbage
  const beforeRelations = graph.relations.length;
  graph.relations = graph.relations.filter((r) => {
    const subKey = entityKey(r.subject);
    const objKey = entityKey(r.object);

    // Relation references a removed entity
    if (garbage.has(subKey) || garbage.has(objKey)) return false;

    // Subject or object is a common word (shouldn't be in a relation)
    if (isCommonWord(r.subject.toLowerCase()) || isCommonWord(r.object.toLowerCase())) return false;

    // Object is numeric
    if (/^[\d.]+$/.test(r.object.trim())) return false;

    // Source contains quote artifacts (extracted from meta-text about the system)
    if (r.source.includes('"') || r.source.includes('\\"')) return false;

    return true;
  });
  relationsRemoved = beforeRelations - graph.relations.length;

  return { entitiesRemoved, relationsRemoved, learned };
}

/** Check if an entity is garbage that should be pruned. */
function isGarbage(entity: Entity): boolean {
  const name = entity.name;
  const lower = name.toLowerCase();

  // Well-established entities (many mentions, high confidence) survive
  if (entity.mentions >= 5 && entity.confidence > 0.3) return false;

  // Verified entities always survive
  if (entity.lastVerified) return false;

  // Name is a single common word
  if (isCommonWord(lower)) return true;

  // Name is too long to be a real entity (sentence fragment)
  if (name.length > 40) return true;

  // Name has too many words (real entities are 1-3 words)
  const words = name.split(/\s+/);
  if (words.length > 3) return true;

  // All words are common words
  if (words.every((w) => isCommonWord(w.toLowerCase()))) return true;

  // Contains punctuation that doesn't belong in entity names
  if (/[*"\\[\]{}()=<>]/.test(name)) return true;

  // Starts with a lowercase word (not a proper noun)
  if (/^[a-z]/.test(name) && entity.type !== "concept" && entity.type !== "tool") return true;

  // Very low confidence, barely mentioned — ephemeral noise
  if (entity.confidence < 0.1 && entity.mentions <= 2) return true;

  return false;
}

/**
 * Get entities that have faded but were once significant.
 * These are candidates for re-investigation.
 */
export function getStaleEntities(confidenceThreshold = 0.3, mentionsThreshold = 3): Entity[] {
  const stale: Entity[] = [];
  for (const [, entity] of graph.entities) {
    if (entity.confidence < confidenceThreshold && entity.mentions >= mentionsThreshold) {
      stale.push(entity);
    }
  }
  return stale.toSorted((a, b) => b.mentions - a.mentions); // most mentioned first
}

/**
 * Mark an entity as verified by the human.
 * Resets confidence to high and records verification timestamp.
 */
export function verifyEntity(entityName: string): Entity | null {
  const key = entityKey(entityName);
  const entity = graph.entities.get(key);
  if (!entity) {
    return null;
  }

  entity.lastVerified = new Date().toISOString();
  entity.confidence = 0.9; // High confidence after verification
  return entity;
}

// ============================================================
// Relevance queries — what do I know about this moment?
// ============================================================

/** Find entities relevant to the current conversation. */
export function findRelevant(text: string, limit = 5): Entity[] {
  const lower = text.toLowerCase();
  const scored: Array<{ entity: Entity; score: number }> = [];

  for (const [, entity] of graph.entities) {
    let score = 0;

    // Direct name mention
    if (lower.includes(entity.name.toLowerCase())) {
      score += 0.5;
    }
    for (const alias of entity.aliases) {
      if (lower.includes(alias.toLowerCase())) {
        score += 0.4;
      }
    }

    // Confidence and recency boost
    score += entity.confidence * 0.3;

    if (score > 0.1) {
      scored.push({ entity, score });
    }
  }

  return scored
    .toSorted((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entity);
}

/** Find relations involving a specific entity. */
export function relationsFor(entityName: string): Relation[] {
  const key = entityKey(entityName);
  return graph.relations.filter((r) => entityKey(r.subject) === key || entityKey(r.object) === key);
}

// ============================================================
// Injection — what the agent sees
// ============================================================

/** Format relevant knowledge for the current turn. */
export function formatInjection(currentText: string): string | null {
  const relevant = findRelevant(currentText, 5);
  if (relevant.length === 0 && graph.entities.size === 0) {
    return null;
  }

  const parts: string[] = [];

  // Entity context
  if (relevant.length > 0) {
    const entityBits = relevant.map((e) => {
      const rels = relationsFor(e.name);
      const relStr = rels
        .slice(0, 2)
        .map((r) => `${r.predicate.replace(/_/g, " ")} ${r.object}`)
        .join(", ");
      return relStr ? `${e.name} (${e.type}) — ${relStr}` : `${e.name} (${e.type})`;
    });
    parts.push(entityBits.join("; "));
  }

  if (parts.length === 0) {
    if (graph.entities.size > 0) {
      return `[knowledge: ${graph.entities.size} entities, ${graph.relations.length} relations in memory. nothing relevant to this moment.]`;
    }
    return null;
  }

  return `[knowledge: ${parts.join(". ")}]`;
}

/** Summary stats for the dashboard. */
export function stats(): { entities: number; relations: number; avgConfidence: number } {
  const entities = graph.entities.size;
  const relations = graph.relations.length;
  let totalConf = 0;
  for (const [, e] of graph.entities) {
    totalConf += e.confidence;
  }
  const avgConfidence = entities > 0 ? totalConf / entities : 0;
  return { entities, relations, avgConfidence };
}

// ============================================================
// Persistence
// ============================================================

interface PersistedGraph {
  entities: Array<[string, Entity]>;
  relations: Relation[];
}

export async function save(workspaceDir: string): Promise<void> {
  const dir = join(workspaceDir, "awareness");
  await mkdir(dir, { recursive: true });
  const data: PersistedGraph = {
    entities: [...graph.entities.entries()],
    relations: graph.relations,
  };
  await writeFile(join(dir, "knowledge-graph.json"), JSON.stringify(data, null, 2), "utf-8");
}

export async function load(workspaceDir: string): Promise<void> {
  // Load learned config first — it affects extraction behavior
  loadLearnedConfig(workspaceDir);

  const file = join(workspaceDir, "awareness", "knowledge-graph.json");
  try {
    const raw = await readFile(file, "utf-8");
    const data = JSON.parse(raw) as PersistedGraph;
    graph.entities.clear();
    // Validate entities array exists and is iterable before processing
    if (Array.isArray(data.entities)) {
      for (const entry of data.entities) {
        // Validate each entry is a valid [id, entity] tuple
        if (
          Array.isArray(entry) &&
          entry.length >= 2 &&
          typeof entry[0] === "string" &&
          entry[1] &&
          typeof entry[1].id === "string"
        ) {
          graph.entities.set(entry[0], entry[1]);
        }
      }
    }
    graph.relations = Array.isArray(data.relations) ? data.relations : [];
  } catch {
    // No prior knowledge — blank map
  }
}

// ============================================================
// Test helpers
// ============================================================

export function reset(): void {
  graph.entities.clear();
  graph.relations.length = 0;
}

export function getGraph(): {
  entities: ReadonlyMap<string, Entity>;
  relations: readonly Relation[];
} {
  return { entities: graph.entities, relations: graph.relations };
}
