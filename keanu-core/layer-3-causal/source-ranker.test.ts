// source-ranker.test.ts
// Tests for source credibility evaluation.

import { describe, it, expect } from "vitest";
import type { TrackedClaim } from "../shared/types.js";
import {
  evaluateSource,
  rankSources,
  adjustClaimConfidence,
  formatInjection,
  formatDashboard,
  generateQuestions,
} from "./source-ranker.js";

describe("source-ranker", () => {
  describe("evaluateSource", () => {
    it("detects peer-reviewed sources", () => {
      const result = evaluateSource("https://pubmed.ncbi.nlm.nih.gov/12345");
      expect(result.tier).toBe("peer_review");
      expect(result.credibilityScore).toBeGreaterThanOrEqual(0.85);
    });

    it("detects government sources as original documents", () => {
      const result = evaluateSource("https://www.cdc.gov/covid/guidance");
      expect(result.tier).toBe("original_document");
      expect(result.credibilityScore).toBeGreaterThanOrEqual(0.8);
    });

    it("detects news sources", () => {
      const result = evaluateSource("https://www.reuters.com/article/breaking");
      expect(result.tier).toBe("news");
      expect(result.credibilityScore).toBeGreaterThanOrEqual(0.5);
      expect(result.credibilityScore).toBeLessThan(0.8);
    });

    it("detects blog sources", () => {
      const result = evaluateSource("https://medium.com/@author/my-thoughts");
      expect(result.tier).toBe("blog");
      expect(result.credibilityScore).toBeLessThan(0.5);
    });

    it("detects forum sources", () => {
      const result = evaluateSource("https://reddit.com/r/programming/123");
      expect(result.tier).toBe("forum");
      expect(result.credibilityScore).toBeLessThan(0.4);
    });

    it("treats unknown sources as anonymous", () => {
      const result = evaluateSource("https://random-site-12345.xyz/claim");
      expect(result.tier).toBe("anonymous");
      expect(result.credibilityScore).toBeLessThanOrEqual(0.2);
    });

    it("detects arxiv as peer review (preprints)", () => {
      const result = evaluateSource("https://arxiv.org/abs/2301.12345");
      expect(result.tier).toBe("peer_review");
    });
  });

  describe("flag detection", () => {
    it("flags sponsored content", () => {
      const result = evaluateSource(
        "https://example.com/article",
        "This sponsored post brings you great news",
      );
      expect(result.flags).toContain("commercial_interest");
      // Should lower score
      expect(result.credibilityScore).toBeLessThan(0.1);
    });

    it("flags sensationalism", () => {
      const result = evaluateSource(
        "https://news.example.com/story",
        "BREAKING: Shocking discovery changes everything!",
      );
      expect(result.flags).toContain("sensationalism");
    });

    it("flags overclaiming", () => {
      const result = evaluateSource(
        "https://health.example.com/cure",
        "This miracle cure is 100% guaranteed to work",
      );
      expect(result.flags).toContain("overclaiming");
    });

    it("flags conspiracy framing", () => {
      const result = evaluateSource(
        "https://truth.example.com/reveal",
        "What they don't want you to know about vaccines",
      );
      expect(result.flags).toContain("conspiracy_framing");
      expect(result.credibilityScore).toBeLessThan(0.1);
    });
  });

  describe("rankSources", () => {
    it("ranks sources by credibility, high to low", () => {
      const urls = [
        "https://reddit.com/r/news/12345",
        "https://nature.com/articles/study123",
        "https://www.bbc.com/news/article",
      ];

      const ranked = rankSources(urls);

      expect(ranked[0].tier).toBe("peer_review");
      expect(ranked[1].tier).toBe("news");
      expect(ranked[2].tier).toBe("forum");
    });
  });

  describe("adjustClaimConfidence", () => {
    it("maintains confidence for high-credibility sources", () => {
      const claim: TrackedClaim = {
        id: "test",
        text: "The study shows X",
        confidence: 4,
        decayedConfidence: 4,
        status: "active",
      };

      const source = evaluateSource("https://nature.com/paper");
      const adjusted = adjustClaimConfidence(claim, source);

      // Should be close to original (0.9 credibility ≈ 0.95 multiplier)
      expect(adjusted).toBeGreaterThan(3.5);
    });

    it("reduces confidence for low-credibility sources", () => {
      const claim: TrackedClaim = {
        id: "test",
        text: "Random claim from internet",
        confidence: 4,
        decayedConfidence: 4,
        status: "active",
      };

      const source = evaluateSource("https://random-anon-site.xyz/claim");
      const adjusted = adjustClaimConfidence(claim, source);

      // Should be significantly reduced (0.1 credibility ≈ 0.55 multiplier)
      expect(adjusted).toBeLessThan(2.5);
    });
  });

  describe("formatInjection", () => {
    it("returns null for high-credibility sources", () => {
      const evaluation = evaluateSource("https://nature.com/article");
      const injection = formatInjection(evaluation);
      expect(injection).toBeNull();
    });

    it("surfaces concerns for low-credibility sources", () => {
      const evaluation = evaluateSource("https://random-anon.xyz/claim");
      const injection = formatInjection(evaluation);
      expect(injection).not.toBeNull();
      expect(injection).toContain("source:");
      expect(injection).toContain("anonymous");
    });

    it("surfaces flags when present", () => {
      const evaluation = evaluateSource(
        "https://news.com/article",
        "BREAKING: Shocking exclusive!",
      );
      const injection = formatInjection(evaluation);
      expect(injection).not.toBeNull();
      expect(injection).toContain("sensationalism");
    });
  });

  describe("formatDashboard", () => {
    it("returns message when no sources", () => {
      const dashboard = formatDashboard([]);
      expect(dashboard).toBe("No sources evaluated.");
    });

    it("formats multiple sources", () => {
      const evaluations = rankSources([
        "https://nature.com/paper",
        "https://reddit.com/r/science/123",
      ]);
      const dashboard = formatDashboard(evaluations);
      expect(dashboard).toContain("peer_review");
      expect(dashboard).toContain("forum");
    });
  });

  describe("generateQuestions", () => {
    it("generates the six questions", () => {
      const questions = generateQuestions("https://example.com/claim");
      expect(questions).toContain("Who produced");
      expect(questions).toContain("incentives");
      expect(questions).toContain("track record");
      expect(questions).toContain("funded");
      expect(questions).toContain("independently confirmed");
      expect(questions).toContain("falsifiable");
    });

    it("warns about anonymous sources", () => {
      const questions = generateQuestions("https://unknown-site.xyz/claim");
      expect(questions).toContain("unknown provenance");
    });

    it("notes peer-reviewed sources", () => {
      const questions = generateQuestions("https://nature.com/paper");
      expect(questions).toContain("peer-reviewed");
    });
  });
});
