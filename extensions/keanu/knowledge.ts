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
import { join } from "node:path";

// ============================================================
// Types
// ============================================================

export type EntityType = "person" | "org" | "project" | "concept" | "tool" | "place";

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  aliases: string[]; // "Drew" = "Andrew" = "drew"
  confidence: number; // 0-1, grows with mentions
  firstSeen: string; // ISO timestamp
  lastSeen: string; // ISO timestamp
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

// Capitalized words that aren't sentence starters
const PROPER_NOUN = /(?:^|\.\s+|[,;:]\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;

// Common patterns that indicate entity types
const PERSON_SIGNALS = /\b(?:drew|andrew|he|she|they|his|her|their|I)\b/i;
const ORG_PATTERNS = /\b(?:company|org|team|hospital|university|inc|llc|corp|mercy|children's)\b/i;
const PROJECT_PATTERNS = /\b(?:repo|project|codebase|extension|module|gateway|keanu|openclaw)\b/i;
const TOOL_PATTERNS =
  /\b(?:typescript|python|rust|javascript|react|vim|vscode|docker|git|bun|pnpm|npm)\b/i;
const CONCEPT_PATTERNS =
  /\b(?:alignment|convergence|duality|pulse|bullshit|helix|carnegie|soul)\b/i;

function classifyEntity(name: string, context: string): EntityType {
  const lower = name.toLowerCase();
  const ctxLower = context.toLowerCase();

  // Known names
  if (lower === "drew" || lower === "andrew") return "person";

  // Context clues
  if (PERSON_SIGNALS.test(context) && name.split(" ").length <= 3) return "person";
  if (ORG_PATTERNS.test(lower) || ORG_PATTERNS.test(ctxLower)) return "org";
  if (PROJECT_PATTERNS.test(lower)) return "project";
  if (TOOL_PATTERNS.test(lower)) return "tool";
  if (CONCEPT_PATTERNS.test(lower)) return "concept";

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
  let propMatch;
  const propRe = new RegExp(PROPER_NOUN.source, "g");
  while ((propMatch = propRe.exec(text)) !== null) {
    const name = propMatch[1]?.trim();
    if (!name || name.length < 2 || name.length > 50) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    // Skip common English words that happen to be capitalized
    if (isCommonWord(key)) continue;
    seen.add(key);
    results.push({ name, type: classifyEntity(name, text) });
  }

  return results;
}

const COMMON_WORDS = new Set([
  "the",
  "this",
  "that",
  "here",
  "there",
  "when",
  "where",
  "what",
  "which",
  "who",
  "how",
  "can",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "let",
  "just",
  "now",
  "also",
  "but",
  "and",
  "not",
  "yes",
  "sure",
  "okay",
  "right",
  "well",
  "good",
  "bad",
  "new",
  "old",
  "big",
  "first",
  "last",
  "next",
  "each",
  "every",
  "some",
  "any",
  "all",
  "both",
  "same",
  "different",
  "other",
  "another",
  "much",
  "many",
  "more",
  "most",
  "very",
  "too",
  "quite",
  "rather",
  "enough",
  "still",
  "already",
  "always",
  "never",
  "sometimes",
  "often",
  "usually",
  "actually",
  "basically",
  "really",
  "maybe",
  "perhaps",
  "probably",
  "certainly",
  "definitely",
  "however",
  "although",
  "because",
  "since",
  "while",
  "before",
  "after",
  "if",
  "then",
  "than",
  "so",
  "yet",
  "nor",
  "for",
  "about",
  "between",
]);

function isCommonWord(word: string): boolean {
  return COMMON_WORDS.has(word.toLowerCase());
}

// ============================================================
// Relation extraction — templates
// ============================================================

interface RelationTemplate {
  pattern: RegExp;
  type: RelationType;
  subjectGroup: number;
  objectGroup: number;
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
];

/** Extract relations from text. Returns raw matches. */
export function extractRelations(
  text: string,
): Array<{ subject: string; predicate: RelationType; object: string; source: string }> {
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
      if (!subject || !object || subject.length > 60 || object.length > 60) continue;

      const key = `${subject.toLowerCase()}:${template.type}:${object.toLowerCase()}`;
      if (seen.has(key)) continue;
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
    const sorted = [...graph.entities.entries()].sort((a, b) => a[1].confidence - b[1].confidence);
    const toRemove = sorted.slice(0, graph.entities.size - MAX_ENTITIES);
    for (const [id] of toRemove) graph.entities.delete(id);
  }

  return entity;
}

/** Add or strengthen a relation. */
export function upsertRelation(
  subject: string,
  predicate: RelationType,
  object: string,
  source: string,
  session: string,
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
  const extractedRelations = extractRelations(text);

  const entities: Entity[] = [];
  for (const { name, type } of extractedEntities) {
    entities.push(upsertEntity(name, type, session));
  }

  const relations: Relation[] = [];
  for (const { subject, predicate, object, source } of extractedRelations) {
    // Ensure both entities exist
    upsertEntity(subject, classifyEntity(subject, text), session);
    upsertEntity(object, classifyEntity(object, text), session);
    relations.push(upsertRelation(subject, predicate, object, source, session));
  }

  return { entities, relations };
}

// ============================================================
// Decay — the map fades where you don't look
// ============================================================

/** Decay entities not seen this session. Called at session_start. */
export function decayAll(currentSession: string): void {
  for (const [id, entity] of graph.entities) {
    if (entity.session !== currentSession) {
      entity.confidence = Math.max(0, entity.confidence - 0.05);
    }
    // Remove entities that faded to nothing
    if (entity.confidence <= 0 && entity.mentions <= 1) {
      graph.entities.delete(id);
    }
  }

  // Decay relations
  graph.relations = graph.relations.filter((r) => {
    r.confidence = Math.max(0, r.confidence - 0.03);
    return r.confidence > 0;
  });
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
    if (lower.includes(entity.name.toLowerCase())) score += 0.5;
    for (const alias of entity.aliases) {
      if (lower.includes(alias.toLowerCase())) score += 0.4;
    }

    // Confidence and recency boost
    score += entity.confidence * 0.3;

    if (score > 0.1) {
      scored.push({ entity, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
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
  if (relevant.length === 0 && graph.entities.size === 0) return null;

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
  for (const [, e] of graph.entities) totalConf += e.confidence;
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
  const file = join(workspaceDir, "awareness", "knowledge-graph.json");
  try {
    const raw = await readFile(file, "utf-8");
    const data = JSON.parse(raw) as PersistedGraph;
    graph.entities.clear();
    for (const [id, entity] of data.entities) {
      graph.entities.set(id, entity);
    }
    graph.relations = data.relations ?? [];
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
