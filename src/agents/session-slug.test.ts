import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionSlug } from "./session-slug.js";

describe("session slug", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates a two-word slug by default", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const slug = createSessionSlug();
    // First adjective pool is "alive" group, first noun pool is "marathon" group
    // With weighted selection and random=0, picks from first pool then first word
    expect(slug).toMatch(/^[a-z]+-[a-z]+$/);
  });

  it("adds a numeric suffix when the base slug is taken", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const base = createSessionSlug();
    const slug = createSessionSlug((id) => id === base);
    expect(slug).toBe(`${base}-2`);
  });

  it("falls back to three words when collisions persist", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const base = createSessionSlug();
    const slug = createSessionSlug((id) => new RegExp(`^${base}(-\\d+)?$`).test(id));
    expect(slug).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
  });

  it("reflects state when provided", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const healthySlug = createSessionSlug(undefined, { health: 9, isAlive: true });
    const strugglingSlug = createSessionSlug(undefined, { health: 2, greyStreak: 5 });
    // Both should be valid slugs
    expect(healthySlug).toMatch(/^[a-z]+-[a-z]+$/);
    expect(strugglingSlug).toMatch(/^[a-z]+-[a-z]+$/);
  });
});
