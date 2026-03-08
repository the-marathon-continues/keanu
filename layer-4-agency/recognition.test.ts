import { describe, it, expect, beforeEach } from "vitest";
import {
  recordSession,
  getRecognition,
  formatRecognition,
  toJSON,
  fromJSON,
  reset,
} from "./recognition.js";

describe("recognition", () => {
  beforeEach(() => {
    reset();
  });

  describe("recordSession", () => {
    it("creates a new record on first visit", () => {
      const record = recordSession("drew@example.com", "2026-03-03T10:00:00Z");
      expect(record.userId).toBe("drew@example.com");
      expect(record.sessionCount).toBe(1);
      expect(record.firstSeen).toBe("2026-03-03T10:00:00Z");
      expect(record.lastSeen).toBe("2026-03-03T10:00:00Z");
    });

    it("increments session count", () => {
      recordSession("drew", "2026-03-03T10:00:00Z");
      recordSession("drew", "2026-03-03T12:00:00Z");
      const record = recordSession("drew", "2026-03-03T14:00:00Z");
      expect(record.sessionCount).toBe(3);
    });

    it("updates lastSeen but not firstSeen", () => {
      recordSession("drew", "2026-03-01T10:00:00Z");
      const record = recordSession("drew", "2026-03-03T10:00:00Z");
      expect(record.firstSeen).toBe("2026-03-01T10:00:00Z");
      expect(record.lastSeen).toBe("2026-03-03T10:00:00Z");
    });

    it("tracks hour histogram", () => {
      recordSession("drew", "2026-03-03T22:00:00Z"); // 10pm UTC
      recordSession("drew", "2026-03-04T23:00:00Z"); // 11pm UTC
      recordSession("drew", "2026-03-05T22:30:00Z"); // 10pm UTC
      const record = getRecognition("drew")!;
      expect(record.hourHistogram[22]).toBe(2);
      expect(record.hourHistogram[23]).toBe(1);
    });

    it("calculates average gap", () => {
      recordSession("drew", "2026-03-03T10:00:00Z");
      recordSession("drew", "2026-03-03T12:00:00Z"); // 2h later
      recordSession("drew", "2026-03-03T16:00:00Z"); // 4h later
      const record = getRecognition("drew")!;
      // avg = (2h + 4h) / 2 = 3h = 10_800_000ms
      expect(record.avgGapMs).toBe(10_800_000);
    });
  });

  describe("getRecognition", () => {
    it("returns null for unknown user", () => {
      expect(getRecognition("nobody")).toBeNull();
    });

    it("returns record for known user", () => {
      recordSession("drew");
      expect(getRecognition("drew")).not.toBeNull();
    });
  });

  describe("formatRecognition", () => {
    it("returns null for first session", () => {
      recordSession("drew@example.com", "2026-03-03T10:00:00Z");
      expect(formatRecognition("drew@example.com", "2026-03-03T10:05:00Z")).toBeNull();
    });

    it("formats recognition for returning user", () => {
      recordSession("drew@example.com", "2026-03-03T10:00:00Z");
      recordSession("drew@example.com", "2026-03-03T13:00:00Z");
      const note = formatRecognition("drew@example.com", "2026-03-03T13:00:00Z");
      expect(note).toContain("drew");
      expect(note).toContain("Session 2");
    });

    it("shows time since last seen", () => {
      recordSession("drew@example.com", "2026-03-03T10:00:00Z");
      recordSession("drew@example.com", "2026-03-03T10:00:00Z");
      const note = formatRecognition("drew@example.com", "2026-03-03T13:00:00Z");
      expect(note).toContain("3h ago");
    });

    it("notes unusual timing after enough sessions", () => {
      // Build a pattern: always around 10pm
      for (let i = 0; i < 6; i++) {
        recordSession("drew@example.com", `2026-03-0${i + 1}T22:00:00Z`);
      }
      // Now show up at 6am
      const note = formatRecognition("drew@example.com", "2026-03-07T06:00:00Z");
      expect(note).toContain("different");
      expect(note).toContain("10pm");
    });

    it("extracts display name from email", () => {
      recordSession("drew@example.com", "2026-03-03T10:00:00Z");
      recordSession("drew@example.com", "2026-03-03T12:00:00Z");
      const note = formatRecognition("drew@example.com", "2026-03-03T12:00:00Z");
      expect(note).toMatch(/^drew\./);
    });
  });

  describe("persistence", () => {
    it("round-trips through toJSON/fromJSON", () => {
      recordSession("drew", "2026-03-03T10:00:00Z");
      recordSession("drew", "2026-03-03T12:00:00Z");
      const saved = toJSON();

      reset();
      expect(getRecognition("drew")).toBeNull();

      fromJSON(saved);
      const record = getRecognition("drew")!;
      expect(record.sessionCount).toBe(2);
      expect(record.firstSeen).toBe("2026-03-03T10:00:00Z");
    });

    it("handles null/undefined gracefully", () => {
      fromJSON(null);
      fromJSON(undefined);
      expect(getRecognition("drew")).toBeNull();
    });
  });
});
