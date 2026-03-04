import { describe, expect, it } from "vitest";
import {
  resolveGatewayAuthFromEnv,
  resolveGatewayBindFromEnv,
  resolveGatewayTrustedProxiesFromEnv,
} from "./env-auth.js";

describe("resolveGatewayAuthFromEnv", () => {
  it("returns undefined when no relevant env vars set", () => {
    expect(resolveGatewayAuthFromEnv({} as NodeJS.ProcessEnv)).toBeUndefined();
  });

  it("reads KEANU_GATEWAY_AUTH_MODE", () => {
    const result = resolveGatewayAuthFromEnv({
      KEANU_GATEWAY_AUTH_MODE: "trusted-proxy",
    } as NodeJS.ProcessEnv);
    expect(result).toEqual({ mode: "trusted-proxy" });
  });

  it("accepts all valid auth modes", () => {
    for (const mode of ["none", "token", "password", "trusted-proxy"]) {
      const result = resolveGatewayAuthFromEnv({
        KEANU_GATEWAY_AUTH_MODE: mode,
      } as NodeJS.ProcessEnv);
      expect(result?.mode).toBe(mode);
    }
  });

  it("ignores invalid auth mode", () => {
    expect(
      resolveGatewayAuthFromEnv({
        KEANU_GATEWAY_AUTH_MODE: "bogus",
      } as NodeJS.ProcessEnv),
    ).toBeUndefined();
  });

  it("reads trusted proxy config from env", () => {
    const result = resolveGatewayAuthFromEnv({
      KEANU_GATEWAY_TRUSTED_PROXY_USER_HEADER: "x-amzn-oidc-identity",
      KEANU_GATEWAY_TRUSTED_PROXY_REQUIRED_HEADERS: "x-amzn-oidc-data",
    } as NodeJS.ProcessEnv);
    expect(result).toEqual({
      trustedProxy: {
        userHeader: "x-amzn-oidc-identity",
        requiredHeaders: ["x-amzn-oidc-data"],
      },
    });
  });

  it("splits comma-separated required headers", () => {
    const result = resolveGatewayAuthFromEnv({
      KEANU_GATEWAY_TRUSTED_PROXY_USER_HEADER: "x-user",
      KEANU_GATEWAY_TRUSTED_PROXY_REQUIRED_HEADERS:
        "x-forwarded-proto, x-forwarded-host, x-amzn-oidc-data",
    } as NodeJS.ProcessEnv);
    expect(result?.trustedProxy?.requiredHeaders).toEqual([
      "x-forwarded-proto",
      "x-forwarded-host",
      "x-amzn-oidc-data",
    ]);
  });

  it("reads allowUsers from env", () => {
    const result = resolveGatewayAuthFromEnv({
      KEANU_GATEWAY_TRUSTED_PROXY_USER_HEADER: "x-user",
      KEANU_GATEWAY_TRUSTED_PROXY_ALLOW_USERS: "drew@example.com, admin@example.com",
    } as NodeJS.ProcessEnv);
    expect(result?.trustedProxy?.allowUsers).toEqual(["drew@example.com", "admin@example.com"]);
  });

  it("combines mode and proxy config", () => {
    const result = resolveGatewayAuthFromEnv({
      KEANU_GATEWAY_AUTH_MODE: "trusted-proxy",
      KEANU_GATEWAY_TRUSTED_PROXY_USER_HEADER: "x-amzn-oidc-identity",
      KEANU_GATEWAY_TRUSTED_PROXY_REQUIRED_HEADERS: "x-amzn-oidc-data",
    } as NodeJS.ProcessEnv);
    expect(result).toEqual({
      mode: "trusted-proxy",
      trustedProxy: {
        userHeader: "x-amzn-oidc-identity",
        requiredHeaders: ["x-amzn-oidc-data"],
      },
    });
  });

  it("trims whitespace from values", () => {
    const result = resolveGatewayAuthFromEnv({
      KEANU_GATEWAY_AUTH_MODE: "  none  ",
    } as NodeJS.ProcessEnv);
    expect(result?.mode).toBe("none");
  });
});

describe("resolveGatewayTrustedProxiesFromEnv", () => {
  it("returns undefined when env var not set", () => {
    expect(resolveGatewayTrustedProxiesFromEnv({} as NodeJS.ProcessEnv)).toBeUndefined();
  });

  it("parses single CIDR", () => {
    expect(
      resolveGatewayTrustedProxiesFromEnv({
        KEANU_GATEWAY_TRUSTED_PROXIES: "10.0.0.0/16",
      } as NodeJS.ProcessEnv),
    ).toEqual(["10.0.0.0/16"]);
  });

  it("splits comma-separated CIDRs", () => {
    expect(
      resolveGatewayTrustedProxiesFromEnv({
        KEANU_GATEWAY_TRUSTED_PROXIES: "10.0.0.0/16, 172.16.0.0/12",
      } as NodeJS.ProcessEnv),
    ).toEqual(["10.0.0.0/16", "172.16.0.0/12"]);
  });

  it("returns undefined for empty string", () => {
    expect(
      resolveGatewayTrustedProxiesFromEnv({
        KEANU_GATEWAY_TRUSTED_PROXIES: "  ",
      } as NodeJS.ProcessEnv),
    ).toBeUndefined();
  });
});

describe("resolveGatewayBindFromEnv", () => {
  it("returns undefined when env var not set", () => {
    expect(resolveGatewayBindFromEnv({} as NodeJS.ProcessEnv)).toBeUndefined();
  });

  it("reads valid bind modes", () => {
    for (const mode of ["loopback", "lan", "auto", "custom", "tailnet"]) {
      expect(
        resolveGatewayBindFromEnv({
          KEANU_GATEWAY_BIND: mode,
        } as NodeJS.ProcessEnv),
      ).toBe(mode);
    }
  });

  it("ignores invalid bind mode", () => {
    expect(
      resolveGatewayBindFromEnv({
        KEANU_GATEWAY_BIND: "invalid",
      } as NodeJS.ProcessEnv),
    ).toBeUndefined();
  });
});
