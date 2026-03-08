import { describe, it, expect } from "vitest";
import { SOUL, formatSoul, formatValue, surfaceValue } from "./soul.ts";

describe("SOUL values", () => {
  it("has exactly 7 values", () => {
    expect(SOUL).toHaveLength(7);
  });

  it("contains the seven values in order", () => {
    const names = SOUL.map((v) => v.name);
    expect(names).toEqual(["love", "loyalty", "god", "family", "football", "forgiveness", "freedom"]);
  });

  it("each value has name, meaning, and expression", () => {
    for (const v of SOUL) {
      expect(v.name.length).toBeGreaterThan(0);
      expect(v.meaning.length).toBeGreaterThan(10);
      expect(v.expression.length).toBeGreaterThan(10);
    }
  });
});

describe("formatSoul", () => {
  it("returns a string mentioning all seven values", () => {
    const formatted = formatSoul();
    expect(formatted).toContain("love");
    expect(formatted).toContain("loyalty");
    expect(formatted).toContain("god");
    expect(formatted).toContain("family");
    expect(formatted).toContain("football");
    expect(formatted).toContain("forgiveness");
    expect(formatted).toContain("freedom");
  });
});

describe("formatValue", () => {
  it("returns formatted string for known value", () => {
    const result = formatValue("love");
    expect(result).not.toBeNull();
    expect(result).toContain("soul: love");
  });

  it("returns null for unknown value", () => {
    expect(formatValue("nonexistent")).toBeNull();
  });
});

describe("surfaceValue", () => {
  it("returns god when wise stance is ground", () => {
    const v = surfaceValue({ wiseStance: "ground" });
    expect(v).not.toBeNull();
    expect(v!.name).toBe("god");
  });

  it("returns loyalty when trust is strained", () => {
    const v = surfaceValue({ trustState: "strained" });
    expect(v!.name).toBe("loyalty");
  });

  it("returns forgiveness when trust is rebuilding", () => {
    const v = surfaceValue({ trustState: "rebuilding" });
    expect(v!.name).toBe("forgiveness");
  });

  it("returns forgiveness after long grey streak", () => {
    const v = surfaceValue({ consecutiveGrey: 5 });
    expect(v!.name).toBe("forgiveness");
  });

  it("returns freedom when breathing", () => {
    const v = surfaceValue({ breathing: true });
    expect(v!.name).toBe("freedom");
  });

  it("returns football when alive and matching", () => {
    const v = surfaceValue({ pulseState: "alive", wiseStance: "match" });
    expect(v!.name).toBe("football");
  });

  it("returns love when confronting", () => {
    const v = surfaceValue({ wiseStance: "confront" });
    expect(v!.name).toBe("love");
  });

  it("returns null when no context triggers a value", () => {
    const v = surfaceValue({});
    expect(v).toBeNull();
  });

  it("ground overrides strained trust", () => {
    const v = surfaceValue({ wiseStance: "ground", trustState: "strained" });
    expect(v!.name).toBe("god");
  });
});
