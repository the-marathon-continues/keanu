import type { KeanuConfig } from "./config.js";

export function ensurePluginAllowlisted(cfg: KeanuConfig, pluginId: string): KeanuConfig {
  const allow = cfg.plugins?.allow;
  if (!Array.isArray(allow) || allow.includes(pluginId)) {
    return cfg;
  }
  return {
    ...cfg,
    plugins: {
      ...cfg.plugins,
      allow: [...allow, pluginId],
    },
  };
}
