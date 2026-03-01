/**
 * Remote Skills Registry
 *
 * Requirement 2.6: Distributed Knowledge Across Agents
 * "Agent A learns something, Agent B should be able to access it without retraining."
 *
 * Skills live in a shared repo. Any keanu instance can discover and pull them.
 * The system grows its capabilities by reaching outward.
 */

const REPO = "the-marathon-continues/keanu-skills";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CONTENT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes for actual skill content

export type RemoteSkillEntry = {
  name: string;
  source: "remote";
};

type ListCache = {
  data: RemoteSkillEntry[];
  ts: number;
};

type ContentCache = Map<string, { content: string; ts: number }>;

let listCache: ListCache | null = null;
const contentCache: ContentCache = new Map();

/**
 * Clear all caches. Useful for testing and forced refresh.
 */
export function clearSkillsCache(): void {
  listCache = null;
  contentCache.clear();
}

/**
 * List available skills from the remote repository.
 * Results are cached to avoid rate limits.
 * Returns empty array on failure (graceful degradation per requirement 11.1).
 */
export async function listRemoteSkills(): Promise<RemoteSkillEntry[]> {
  // Return cached if fresh
  if (listCache && Date.now() - listCache.ts < CACHE_TTL) {
    return listCache.data;
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/contents/skills`,
      {
        headers: {
          "User-Agent": "keanu",
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!res.ok) {
      // Rate limited, repo doesn't exist, etc.
      return [];
    }

    const entries = (await res.json()) as Array<{ name: string; type: string }>;

    // Filter to directories only (each skill is a directory with SKILL.md)
    const skills: RemoteSkillEntry[] = entries
      .filter((entry) => entry.type === "dir")
      .map((entry) => ({
        name: entry.name,
        source: "remote" as const,
      }));

    listCache = { data: skills, ts: Date.now() };
    return skills;
  } catch {
    // Network error, offline, etc. — graceful degradation
    return [];
  }
}

/**
 * Pull a specific skill's content from the remote repository.
 * Results are cached longer than the list (content changes less often).
 * Returns null on failure.
 */
export async function pullRemoteSkill(name: string): Promise<string | null> {
  // Check content cache
  const cached = contentCache.get(name);
  if (cached && Date.now() - cached.ts < CONTENT_CACHE_TTL) {
    return cached.content;
  }

  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${REPO}/main/skills/${name}/SKILL.md`,
      {
        headers: {
          "User-Agent": "keanu",
        },
      }
    );

    if (!res.ok) {
      return null;
    }

    const content = await res.text();
    contentCache.set(name, { content, ts: Date.now() });
    return content;
  } catch {
    return null;
  }
}

/**
 * Search remote skills by keyword.
 * Simple client-side filter for now — upgrade to server-side when we hit limits.
 */
export async function searchRemoteSkills(query: string): Promise<RemoteSkillEntry[]> {
  const all = await listRemoteSkills();
  const q = query.toLowerCase();
  return all.filter((skill) => skill.name.toLowerCase().includes(q));
}
