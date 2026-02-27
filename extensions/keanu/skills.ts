// skills.ts
// The agent's ability to discover and pull skills.
// Not just a list — a mirror for capability awareness.
//
// keanu_skills — "what can I reach for?"
//
// Skills are methodologies, not rules. The agent should know what's
// available and be able to pull the full content when needed.
// This closes the loop: the injection mentions skills exist,
// this tool lets the agent actually read them.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

// Resolve config dir: ~/.keanu or ~/.openclaw (whichever exists)
function resolveConfigDir(): string {
  const override = process.env.KEANU_STATE_DIR?.trim() || process.env.OPENCLAW_STATE_DIR?.trim();
  if (override) return override;

  const home = os.homedir();
  const keanuDir = path.join(home, ".keanu");
  const legacyDir = path.join(home, ".openclaw");

  // Prefer .keanu if it exists
  if (fs.existsSync(keanuDir)) return keanuDir;
  if (fs.existsSync(legacyDir)) return legacyDir;
  return keanuDir; // default to new location
}

// Find bundled skills dir (ships with openclaw)
function resolveBundledSkillsDir(): string | undefined {
  const override = process.env.OPENCLAW_BUNDLED_SKILLS_DIR?.trim();
  if (override) return override;

  // Check sibling to executable (bun --compile)
  try {
    const sibling = path.join(path.dirname(process.execPath), "skills");
    if (fs.existsSync(sibling)) return sibling;
  } catch {
    // ignore
  }

  // Walk up from this module to find package root's skills/
  try {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    let current = moduleDir;
    for (let depth = 0; depth < 8; depth++) {
      const candidate = path.join(current, "skills");
      if (fs.existsSync(candidate) && looksLikeSkillsDir(candidate)) {
        return candidate;
      }
      const next = path.dirname(current);
      if (next === current) break;
      current = next;
    }
  } catch {
    // ignore
  }

  return undefined;
}

function looksLikeSkillsDir(dir: string): boolean {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) {
        if (fs.existsSync(path.join(dir, entry.name, "SKILL.md"))) {
          return true;
        }
      }
    }
  } catch {
    return false;
  }
  return false;
}

// Skill directory sources in precedence order (later overrides earlier)
type SkillDirSpec = {
  resolve: (ws: string) => string | undefined;
  source: string;
};

const SKILL_DIR_SPECS: SkillDirSpec[] = [
  { resolve: () => resolveBundledSkillsDir(), source: "bundled" },
  { resolve: () => path.join(resolveConfigDir(), "skills"), source: "managed" },
  { resolve: () => path.join(os.homedir(), ".agents", "skills"), source: "personal-agents" },
  { resolve: (ws) => path.join(ws, ".agents", "skills"), source: "project-agents" },
  { resolve: (ws) => path.join(ws, "skills"), source: "workspace" },
];

interface SkillMeta {
  name: string;
  description?: string;
  source: string;
  path: string;
}

function listChildDirs(dir: string): string[] {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries
      .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
      .filter((e) => {
        if (e.isDirectory()) return true;
        if (e.isSymbolicLink()) {
          try {
            return fs.statSync(path.join(dir, e.name)).isDirectory();
          } catch {
            return false;
          }
        }
        return false;
      })
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function parseSkillDescription(content: string): string | undefined {
  // Look for YAML frontmatter description
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m);
    if (descMatch) return descMatch[1].trim().replace(/^["']|["']$/g, "");
  }

  // Fallback: first non-heading paragraph
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("---")) {
      return trimmed.slice(0, 120) + (trimmed.length > 120 ? "..." : "");
    }
  }
  return undefined;
}

function discoverSkills(workspaceDir: string): SkillMeta[] {
  const found = new Map<string, SkillMeta>();

  for (const spec of SKILL_DIR_SPECS) {
    let dir: string | undefined;
    try {
      dir = spec.resolve(workspaceDir);
    } catch {
      continue;
    }

    if (!dir || !fs.existsSync(dir)) continue;

    // Check for nested skills/ directory (repo-style layout)
    const nestedSkills = path.join(dir, "skills");
    const searchDir =
      fs.existsSync(nestedSkills) && looksLikeSkillsDir(nestedSkills) ? nestedSkills : dir;

    // Check if dir itself is a skill
    const rootSkill = path.join(searchDir, "SKILL.md");
    if (fs.existsSync(rootSkill)) {
      const name = path.basename(searchDir);
      if (!found.has(name)) {
        try {
          const content = fs.readFileSync(rootSkill, "utf-8");
          found.set(name, {
            name,
            description: parseSkillDescription(content),
            source: spec.source,
            path: rootSkill,
          });
        } catch {
          // skip unreadable
        }
      }
      continue;
    }

    // Check subdirectories for skills
    for (const child of listChildDirs(searchDir)) {
      const skillPath = path.join(searchDir, child, "SKILL.md");
      if (fs.existsSync(skillPath) && !found.has(child)) {
        try {
          const content = fs.readFileSync(skillPath, "utf-8");
          found.set(child, {
            name: child,
            description: parseSkillDescription(content),
            source: spec.source,
            path: skillPath,
          });
        } catch {
          // skip unreadable
        }
      }
    }
  }

  return Array.from(found.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function readSkillContent(
  name: string,
  workspaceDir: string,
): { content: string; path: string } | null {
  for (const spec of SKILL_DIR_SPECS) {
    let dir: string | undefined;
    try {
      dir = spec.resolve(workspaceDir);
    } catch {
      continue;
    }

    if (!dir || !fs.existsSync(dir)) continue;

    // Check for nested skills/ directory (repo-style layout)
    const nestedSkills = path.join(dir, "skills");
    const searchDir =
      fs.existsSync(nestedSkills) && looksLikeSkillsDir(nestedSkills) ? nestedSkills : dir;

    // Direct match: searchDir/name/SKILL.md
    const direct = path.join(searchDir, name, "SKILL.md");
    if (fs.existsSync(direct)) {
      try {
        return { content: fs.readFileSync(direct, "utf-8"), path: direct };
      } catch {
        continue;
      }
    }

    // Check if searchDir itself is the skill
    if (path.basename(searchDir) === name) {
      const rootSkill = path.join(searchDir, "SKILL.md");
      if (fs.existsSync(rootSkill)) {
        try {
          return { content: fs.readFileSync(rootSkill, "utf-8"), path: rootSkill };
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

// Workspace dir comes from state module
import * as state from "./state.js";

export function registerSkillsTool(api: OpenClawPluginApi): void {
  api.registerTool(
    {
      name: "keanu_skills",
      label: "Keanu Skills",
      description:
        "Discover and pull skills. Call with no args to list available skills. " +
        "Call with a skill name to read its full content. " +
        "Skills are methodologies — cascade, carnegie, ultimate-coder. " +
        "This is how you know what you can reach for.",
      parameters: Type.Object(
        {
          pull: Type.Optional(
            Type.String({
              description:
                'Name of a skill to pull (e.g., "ultimate-coder", "carnegie"). ' +
                "Omit to list all available skills.",
            }),
          ),
          filter: Type.Optional(
            Type.String({
              description: "Optional filter to narrow the list (e.g., 'code', 'review').",
            }),
          ),
        },
        { additionalProperties: false },
      ),
      execute: async (_toolCallId, params) => {
        const { pull, filter } = params as { pull?: string; filter?: string };
        const wsDir = state.getWorkspaceDir() ?? process.cwd();

        // Pull mode: read a specific skill
        if (pull) {
          const skill = readSkillContent(pull, wsDir);
          if (!skill) {
            const available = discoverSkills(wsDir);
            const suggestions = available
              .filter((s) => s.name.includes(pull) || pull.includes(s.name))
              .slice(0, 3);
            const hint =
              suggestions.length > 0
                ? ` Did you mean: ${suggestions.map((s) => s.name).join(", ")}?`
                : "";
            return {
              content: [{ type: "text" as const, text: `Skill "${pull}" not found.${hint}` }],
              details: {
                error: "not_found",
                requested: pull,
                suggestions: suggestions.map((s) => s.name),
              },
            };
          }

          return {
            content: [{ type: "text" as const, text: skill.content }],
            details: { skill: pull, path: skill.path },
          };
        }

        // List mode: show available skills
        const skills = discoverSkills(wsDir);
        const filtered = filter
          ? skills.filter(
              (s) =>
                s.name.toLowerCase().includes(filter.toLowerCase()) ||
                s.description?.toLowerCase().includes(filter.toLowerCase()),
            )
          : skills;

        if (filtered.length === 0) {
          const msg = filter
            ? `No skills matching "${filter}".`
            : "No skills found. Skills live in workspace/skills/ or ~/.keanu/skills/.";
          return {
            content: [{ type: "text" as const, text: msg }],
            details: { count: 0, filter },
          };
        }

        const lines: string[] = [
          `## Available Skills (${filtered.length})`,
          "",
          ...filtered.map((s) => {
            const desc = s.description ? ` — ${s.description}` : "";
            return `- **${s.name}**${desc} [${s.source}]`;
          }),
          "",
          'Use `pull: "skill-name"` to read a skill\'s full content.',
        ];

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          details: { count: filtered.length, skills: filtered, filter },
        };
      },
    },
    { name: "keanu_skills" },
  );

  api.logger.info?.("keanu: keanu_skills tool registered");
}
