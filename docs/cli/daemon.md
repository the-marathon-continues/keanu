---
summary: "CLI reference for `keanu daemon` (legacy alias for gateway service management)"
read_when:
  - You still use `keanu daemon ...` in scripts
  - You need service lifecycle commands (install/start/stop/restart/status)
title: "daemon"
---

# `keanu daemon`

Legacy alias for Gateway service management commands.

`keanu daemon ...` maps to the same service control surface as `keanu gateway ...` service commands.

## Usage

```bash
keanu daemon status
keanu daemon install
keanu daemon start
keanu daemon stop
keanu daemon restart
keanu daemon uninstall
```

## Subcommands

- `status`: show service install state and probe Gateway health
- `install`: install service (`launchd`/`systemd`/`schtasks`)
- `uninstall`: remove service
- `start`: start service
- `stop`: stop service
- `restart`: restart service

## Common options

- `status`: `--url`, `--token`, `--password`, `--timeout`, `--no-probe`, `--deep`, `--json`
- `install`: `--port`, `--runtime <node|bun>`, `--token`, `--force`, `--json`
- lifecycle (`uninstall|start|stop|restart`): `--json`

## Prefer

Use [`keanu gateway`](/cli/gateway) for current docs and examples.
