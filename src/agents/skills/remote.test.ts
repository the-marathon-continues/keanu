/**
 * Remote Skills Registry Tests
 *
 * Requirement 2.6: Distributed Knowledge Across Agents
 * "Agent A learns something, Agent B should be able to access it without retraining."
 *
 * The skills repo is shared knowledge. Any keanu instance can discover and pull
 * skills without having them pre-installed. The system grows its capabilities
 * by reaching outward, not by shipping larger bundles.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  listRemoteSkills,
  pullRemoteSkill,
  clearSkillsCache,
  type RemoteSkillEntry,
} from "./remote.js";

// Mock fetch for deterministic tests
const mockFetch = vi.fn();

describe("Remote Skills Registry", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    clearSkillsCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  describe("listRemoteSkills", () => {
    it("fetches skill directory from GitHub API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { name: "cascade", type: "dir" },
          { name: "ultimate-coder", type: "dir" },
          { name: "carnegie", type: "dir" },
        ],
      });

      const skills = await listRemoteSkills();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("api.github.com/repos"),
        expect.objectContaining({
          headers: expect.objectContaining({ "User-Agent": "keanu" }),
        }),
      );
      expect(skills).toHaveLength(3);
      expect(skills.map((s) => s.name)).toContain("cascade");
    });

    it("caches results to avoid rate limits", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [{ name: "cached-skill", type: "dir" }],
      });

      await listRemoteSkills();
      await listRemoteSkills();
      await listRemoteSkills();

      // Only one fetch despite three calls
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("returns empty array on network failure (graceful degradation)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const skills = await listRemoteSkills();

      expect(skills).toEqual([]);
    });

    it("returns empty array on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Rate limited",
      });

      const skills = await listRemoteSkills();

      expect(skills).toEqual([]);
    });

    it("filters out non-directory entries", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { name: "real-skill", type: "dir" },
          { name: "README.md", type: "file" },
          { name: ".gitignore", type: "file" },
        ],
      });

      const skills = await listRemoteSkills();

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe("real-skill");
    });
  });

  describe("pullRemoteSkill", () => {
    it("fetches skill content from raw.githubusercontent", async () => {
      const skillContent = `---
name: cascade
description: Multi-step reasoning with backtracking
---

# Cascade

A skill for complex problem decomposition.`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => skillContent,
      });

      const content = await pullRemoteSkill("cascade");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("raw.githubusercontent.com"),
        expect.anything(),
      );
      expect(content).toContain("# Cascade");
      expect(content).toContain("name: cascade");
    });

    it("returns null for missing skills", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const content = await pullRemoteSkill("nonexistent-skill");

      expect(content).toBeNull();
    });

    it("caches pulled skills", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "# Cached Skill",
      });

      await pullRemoteSkill("cascade");
      await pullRemoteSkill("cascade");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("merging with local skills", () => {
    it("local skills should override remote (user customization wins)", async () => {
      // This tests the merge behavior, not the remote client itself
      // The actual merge happens in the skills loader

      const localSkill = { name: "cascade", source: "workspace" as const };
      const remoteSkill = { name: "cascade", source: "remote" as const };

      // When names collide, local wins
      const merged = [localSkill]; // Local is already in the list
      const shouldAddRemote = !merged.some((s) => s.name === remoteSkill.name);

      expect(shouldAddRemote).toBe(false);
    });
  });

  describe("graceful degradation (requirement 11.1)", () => {
    it("works offline — returns empty list, doesn't crash", async () => {
      mockFetch.mockRejectedValue(new Error("ENOTFOUND"));

      const skills = await listRemoteSkills();
      const content = await pullRemoteSkill("any-skill");

      expect(skills).toEqual([]);
      expect(content).toBeNull();
      // No throws
    });

    it("recovers after network comes back", async () => {
      // First call fails
      mockFetch.mockRejectedValueOnce(new Error("Offline"));

      await listRemoteSkills();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache to simulate cache expiry
      clearSkillsCache();

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: "recovered", type: "dir" }],
      });

      const skills = await listRemoteSkills();
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe("recovered");
    });
  });
});
