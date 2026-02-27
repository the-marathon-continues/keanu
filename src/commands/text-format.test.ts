import { describe, expect, it } from "vitest";
import { shortenText } from "./text-format.js";

describe("shortenText", () => {
  it("returns original text when it fits", () => {
    expect(shortenText("keanu", 16)).toBe("keanu");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(shortenText("keanu-status-output", 10)).toBe("keanu-…");
  });

  it("counts multi-byte characters correctly", () => {
    expect(shortenText("hello🙂world", 7)).toBe("hello🙂…");
  });
});
