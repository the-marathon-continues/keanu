// The nerve that connects Terraform env vars to gateway auth.
// Without this, KEANU_GATEWAY_AUTH_MODE goes nowhere and docker-config.json
// hardcodes "none" — so keanu runs fully open behind the ALB.

import type {
  GatewayAuthConfig,
  GatewayAuthMode,
  GatewayBindMode,
  GatewayTrustedProxyConfig,
} from "../config/config.js";
import { trimToUndefined } from "./credentials.js";

const VALID_AUTH_MODES = new Set<GatewayAuthMode>(["none", "token", "password", "trusted-proxy"]);
const VALID_BIND_MODES = new Set<GatewayBindMode>(["loopback", "lan", "auto", "custom", "tailnet"]);

function splitComma(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Read gateway auth config from env vars.
 *
 * Env vars:
 *   KEANU_GATEWAY_AUTH_MODE                       → auth mode
 *   KEANU_GATEWAY_TRUSTED_PROXY_USER_HEADER       → trustedProxy.userHeader
 *   KEANU_GATEWAY_TRUSTED_PROXY_REQUIRED_HEADERS   → trustedProxy.requiredHeaders (comma-sep)
 *   KEANU_GATEWAY_TRUSTED_PROXY_ALLOW_USERS        → trustedProxy.allowUsers (comma-sep)
 */
export function resolveGatewayAuthFromEnv(env: NodeJS.ProcessEnv): GatewayAuthConfig | undefined {
  const result: GatewayAuthConfig = {};
  let hasValue = false;

  const modeRaw = trimToUndefined(env.KEANU_GATEWAY_AUTH_MODE);
  if (modeRaw && VALID_AUTH_MODES.has(modeRaw as GatewayAuthMode)) {
    result.mode = modeRaw as GatewayAuthMode;
    hasValue = true;
  }

  const userHeader = trimToUndefined(env.KEANU_GATEWAY_TRUSTED_PROXY_USER_HEADER);
  const requiredHeadersRaw = trimToUndefined(env.KEANU_GATEWAY_TRUSTED_PROXY_REQUIRED_HEADERS);
  const allowUsersRaw = trimToUndefined(env.KEANU_GATEWAY_TRUSTED_PROXY_ALLOW_USERS);

  if (userHeader || requiredHeadersRaw || allowUsersRaw) {
    const proxy: GatewayTrustedProxyConfig = {
      userHeader: userHeader ?? "",
    };
    if (requiredHeadersRaw) {
      proxy.requiredHeaders = splitComma(requiredHeadersRaw);
    }
    if (allowUsersRaw) {
      proxy.allowUsers = splitComma(allowUsersRaw);
    }
    result.trustedProxy = proxy;
    hasValue = true;
  }

  return hasValue ? result : undefined;
}

/**
 * Read gateway.trustedProxies (the IP/CIDR allowlist) from env.
 * Separate from auth config — this is the network-level "who's allowed to proxy."
 *
 * Env var: KEANU_GATEWAY_TRUSTED_PROXIES (comma-separated IPs/CIDRs)
 */
export function resolveGatewayTrustedProxiesFromEnv(env: NodeJS.ProcessEnv): string[] | undefined {
  const raw = trimToUndefined(env.KEANU_GATEWAY_TRUSTED_PROXIES);
  if (!raw) {
    return undefined;
  }
  const parsed = splitComma(raw);
  return parsed.length > 0 ? parsed : undefined;
}

/**
 * Read gateway.bind from env.
 *
 * Env var: KEANU_GATEWAY_BIND
 */
export function resolveGatewayBindFromEnv(env: NodeJS.ProcessEnv): GatewayBindMode | undefined {
  const raw = trimToUndefined(env.KEANU_GATEWAY_BIND);
  if (raw && VALID_BIND_MODES.has(raw as GatewayBindMode)) {
    return raw as GatewayBindMode;
  }
  return undefined;
}
