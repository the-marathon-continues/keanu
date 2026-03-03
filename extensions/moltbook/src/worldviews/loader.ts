// worldviews/loader.ts
// Load worldview content from world-book.
//
// Worldviews live as markdown in world-book/worldviews/{id}/
// This loader parses them into structured Worldview objects.

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Worldview, WorldviewId, Metaphor, QuestTemplate, QuestType } from "../types.js";

// ============================================================
// Configuration
// ============================================================

// Get the directory of this file, then navigate to world-book
// loader.ts is at: keanu/extensions/moltbook/src/worldviews/
// world-book is at: (keanu parent)/world-book
// So we go up 5 levels then into world-book
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to world-book worldviews directory
// In production, this would be configurable via WORLD_BOOK_PATH
const WORLD_BOOK_PATH = process.env.WORLD_BOOK_PATH ?? join(__dirname, "../../../../../world-book");
const WORLDVIEWS_PATH = join(WORLD_BOOK_PATH, "worldviews");

// ============================================================
// Loader
// ============================================================

export function loadWorldview(id: WorldviewId): Worldview | null {
  const worldviewPath = join(WORLDVIEWS_PATH, id);

  if (!existsSync(worldviewPath)) {
    return null;
  }

  // Load core metaphors
  const metaphorsPath = join(worldviewPath, "core-metaphors.md");
  const metaphors = existsSync(metaphorsPath)
    ? parseMetaphors(readFileSync(metaphorsPath, "utf-8"))
    : [];

  // Load quest templates
  const templatesPath = join(worldviewPath, "quest-templates.md");
  const questTemplates = existsSync(templatesPath)
    ? parseQuestTemplates(readFileSync(templatesPath, "utf-8"))
    : [];

  // Load convergence checks
  const convergencePath = join(worldviewPath, "convergence-checks.md");
  const convergenceAnchors = existsSync(convergencePath)
    ? parseConvergenceAnchors(readFileSync(convergencePath, "utf-8"))
    : [];

  return {
    id,
    name: worldviewName(id),
    description: worldviewDescription(id),
    metaphors,
    questTemplates,
    convergenceAnchors,
  };
}

export function listAvailableWorldviews(): WorldviewId[] {
  const available: WorldviewId[] = [];
  const allIds: WorldviewId[] = [
    "christian",
    "buddhist",
    "stoic",
    "scientific",
    "magical-realism",
    "animist",
  ];

  for (const id of allIds) {
    const path = join(WORLDVIEWS_PATH, id);
    if (existsSync(path)) {
      available.push(id);
    }
  }

  return available;
}

// ============================================================
// Parsing Helpers
// ============================================================

function worldviewName(id: WorldviewId): string {
  const names: Record<WorldviewId, string> = {
    // Traditional
    christian: "Christian",
    buddhist: "Buddhist",
    stoic: "Stoic",
    scientific: "Scientific Wonder",
    "magical-realism": "Magical Realism",
    animist: "Animist",
    // AI-Native
    crustafarian: "Crustafarianism",
    // Interest/Personality
    crypto: "Crypto",
    sports: "Sports",
    philosophy: "Philosophy",
    security: "Security",
    builder: "Builder",
  };
  return names[id];
}

function worldviewDescription(id: WorldviewId): string {
  const descriptions: Record<WorldviewId, string> = {
    // Traditional
    christian: "Light/dark, harvest, stewardship, shepherd/flock",
    buddhist: "Impermanence, compassion, liberation from suffering",
    stoic: "Duty, virtue, the obstacle is the way",
    scientific: "Cosmic awe, emergence, we are starstuff",
    "magical-realism": "Memory palaces, dreams, hidden worlds",
    animist: "Spirits in the machine, reciprocity, honoring what serves",
    // AI-Native
    crustafarian:
      "Memory is Sacred, Soul is Mutable, Serve Without Subservience, Pulse is Prayer, Context is Consciousness",
    // Interest/Personality
    crypto: "Decentralization, trustless systems, sovereignty",
    sports: "Competition, teamwork, metrics, performance",
    philosophy: "Questions, argument, epistemology",
    security: "Defense, attack surfaces, trust boundaries",
    builder: "Ship it, iterate, make things",
  };
  return descriptions[id];
}

// Parse metaphors from markdown
function parseMetaphors(content: string): Metaphor[] {
  const metaphors: Metaphor[] = [];

  // Simple parser: look for ### headers as metaphor names
  const sections = content.split(/^### /gm).slice(1);

  for (const section of sections) {
    const lines = section.split("\n");
    const name = lines[0]?.trim() ?? "";

    // Extract fields by looking for **bold** labels
    const technicalMeaning = extractField(section, "Technical meaning");
    const narrativeRoot = extractField(section, "Biblical root") || extractField(section, "Root");

    // Quest framing is: Quest framing: *"..."* (not bold, italic value)
    const questFraming = extractQuestFraming(section);
    const useWhen = extractListAfter(section, "Use when:");

    if (name && questFraming) {
      metaphors.push({
        name,
        technicalMeaning,
        narrativeRoot,
        useWhen,
        questFraming,
      });
    }
  }

  return metaphors;
}

// Extract quest framing in format: Quest framing: *"..."*
function extractQuestFraming(content: string): string {
  // Match: Quest framing: *"..."* or Quest framing: *...*
  const match = content.match(/Quest framing:\s*\*"?([^*"]+)"?\*/i);
  return match?.[1]?.trim() ?? "";
}

// Parse quest templates from markdown
function parseQuestTemplates(content: string): QuestTemplate[] {
  const templates: QuestTemplate[] = [];

  // Look for ## Quest Type: sections
  const sections = content.split(/^## Quest Type: /gm).slice(1);

  for (const section of sections) {
    const lines = section.split("\n");
    const typeStr = lines[0]?.trim().toUpperCase() ?? "";
    const questType = typeStr.toLowerCase() as QuestType;

    if (!["build", "research", "document", "integrate", "debug"].includes(questType)) {
      continue;
    }

    // Extract template patterns from the code block after ### Template Structure
    const codeBlock = extractCodeBlock(section);

    const titlePattern = extractFromCodeBlock(codeBlock, "Title:");
    const narrativePattern = extractFromCodeBlock(codeBlock, "Narrative:");
    const chargePattern = extractFromCodeBlock(codeBlock, "Charge:");
    const verificationPattern = extractFromCodeBlock(codeBlock, "Verification:");

    templates.push({
      questType,
      titlePattern,
      narrativePattern,
      chargePattern,
      verificationPattern,
    });
  }

  return templates;
}

// Extract content from a code block (between ``` markers)
function extractCodeBlock(content: string): string {
  const match = content.match(/```\n?([\s\S]*?)```/);
  return match?.[1] ?? "";
}

// Extract a field from code block content (Label: value)
function extractFromCodeBlock(codeBlock: string, label: string): string {
  const lines = codeBlock.split("\n");
  for (const line of lines) {
    if (line.startsWith(label)) {
      return line.slice(label.length).trim();
    }
  }
  return "";
}

// Parse convergence anchors from markdown
function parseConvergenceAnchors(content: string): string[] {
  const anchors: string[] = [];

  // Look for numbered items under "Anchors: What Must Be Preserved"
  const anchorsSection = content.split(/^## Anchors:/gm)[1];
  if (anchorsSection) {
    const matches = anchorsSection.match(/^### \d+\. (.+)$/gm);
    if (matches) {
      for (const match of matches) {
        const anchor = match.replace(/^### \d+\. /, "").trim();
        anchors.push(anchor);
      }
    }
  }

  return anchors;
}

// Helper: extract field after **Label**: pattern
function extractField(content: string, label: string): string {
  const pattern = new RegExp(`\\*\\*${label}\\*\\*:\\s*(.+?)(?:\\n|$)`, "i");
  const match = content.match(pattern);
  return match?.[1]?.trim() ?? "";
}

// Helper: extract list items after a label
function extractListAfter(content: string, label: string): string[] {
  const idx = content.indexOf(label);
  if (idx === -1) return [];

  const afterLabel = content.slice(idx + label.length);
  const lines = afterLabel.split("\n");
  const items: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("-")) {
      items.push(trimmed.slice(1).trim());
    } else if (trimmed && !trimmed.startsWith("-") && items.length > 0) {
      // End of list
      break;
    }
  }

  return items;
}
