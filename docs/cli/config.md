---
summary: "CLI reference for `keanu config` (get/set/unset config values)"
read_when:
  - You want to read or edit config non-interactively
title: "config"
---

# `keanu config`

Config helpers: get/set/unset values by path. Run without a subcommand to open
the configure wizard (same as `keanu configure`).

## Examples

```bash
keanu config get browser.executablePath
keanu config set browser.executablePath "/usr/bin/google-chrome"
keanu config set agents.defaults.heartbeat.every "2h"
keanu config set agents.list[0].tools.exec.node "node-id-or-name"
keanu config unset tools.web.search.apiKey
```

## Paths

Paths use dot or bracket notation:

```bash
keanu config get agents.defaults.workspace
keanu config get agents.list[0].id
```

Use the agent list index to target a specific agent:

```bash
keanu config get agents.list
keanu config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Values

Values are parsed as JSON5 when possible; otherwise they are treated as strings.
Use `--strict-json` to require JSON5 parsing. `--json` remains supported as a legacy alias.

```bash
keanu config set agents.defaults.heartbeat.every "0m"
keanu config set gateway.port 19001 --strict-json
keanu config set channels.whatsapp.groups '["*"]' --strict-json
```

Restart the gateway after edits.
