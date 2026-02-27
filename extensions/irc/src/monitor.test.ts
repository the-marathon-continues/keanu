import { describe, expect, it } from "vitest";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#keanu",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#keanu",
      rawTarget: "#keanu",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "keanu-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "keanu-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "keanu-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "keanu-bot",
      rawTarget: "keanu-bot",
    });
  });
});
