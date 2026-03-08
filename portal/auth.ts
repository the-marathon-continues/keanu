// auth.ts — API key authentication middleware
//
// Two modes:
//   1. Portal UI — no auth (served from same origin)
//   2. API calls — Bearer token in Authorization header
//
// Keys are stored in KEANU_API_KEYS env var (comma-separated)
// or generated on first boot and printed to console.

import { createMiddleware } from "hono/factory";
import { randomBytes } from "node:crypto";

let apiKeys: Set<string>;

function loadKeys(): Set<string> {
  if (apiKeys) return apiKeys;

  const envKeys = process.env.KEANU_API_KEYS;
  if (envKeys) {
    apiKeys = new Set(envKeys.split(",").map((k) => k.trim()).filter(Boolean));
    console.log(`  auth: ${apiKeys.size} API key(s) loaded from env`);
    return apiKeys;
  }

  // Generate one on first boot
  const generated = `kp_${randomBytes(24).toString("hex")}`;
  apiKeys = new Set([generated]);
  console.log(`  auth: generated API key (set KEANU_API_KEYS to use your own)`);
  console.log(`  key:  ${generated}`);
  return apiKeys;
}

export function getApiKeys(): Set<string> {
  return loadKeys();
}

// Middleware — protects /api/v1/* routes
// Skips auth for dashboard (/) and portal state (/api/state, /api/stream, /api/soul)
export const requireAuth = createMiddleware(async (c, next) => {
  const path = c.req.path;

  // Public routes — no auth needed
  if (
    path === "/" ||
    path === "/api/state" ||
    path === "/api/stream" ||
    path === "/api/soul" ||
    path === "/api/trend" ||
    path === "/api/loop" ||
    path.startsWith("/public/")
  ) {
    return next();
  }

  // Everything else needs a key
  const auth = c.req.header("Authorization");
  if (!auth) {
    return c.json({ error: "Missing Authorization header. Use: Bearer <api-key>" }, 401);
  }

  const token = auth.replace("Bearer ", "").trim();
  const keys = loadKeys();

  if (!keys.has(token)) {
    return c.json({ error: "Invalid API key" }, 403);
  }

  return next();
});
