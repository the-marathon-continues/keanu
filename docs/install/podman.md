---
summary: "Run Keanu in a rootless Podman container"
read_when:
  - You want a containerized gateway with Podman instead of Docker
title: "Podman"
---

# Podman

Run the Keanu gateway in a **rootless** Podman container. Uses the same image as Docker (build from the repo [Dockerfile](https://github.com/keanu/keanu/blob/main/Dockerfile)).

## Requirements

- Podman (rootless)
- Sudo for one-time setup (create user, build image)

## Quick start

**1. One-time setup** (from repo root; creates user, builds image, installs launch script):

```bash
./setup-podman.sh
```

This also creates a minimal `~keanu/.keanu/keanu.json` (sets `gateway.mode="local"`) so the gateway can start without running the wizard.

By default the container is **not** installed as a systemd service, you start it manually (see below). For a production-style setup with auto-start and restarts, install it as a systemd Quadlet user service instead:

```bash
./setup-podman.sh --quadlet
```

(Or set `KEANU_PODMAN_QUADLET=1`; use `--container` to install only the container and launch script.)

**2. Start gateway** (manual, for quick smoke testing):

```bash
./scripts/run-keanu-podman.sh launch
```

**3. Onboarding wizard** (e.g. to add channels or providers):

```bash
./scripts/run-keanu-podman.sh launch setup
```

Then open `http://127.0.0.1:18789/` and use the token from `~keanu/.keanu/.env` (or the value printed by setup).

## Systemd (Quadlet, optional)

If you ran `./setup-podman.sh --quadlet` (or `KEANU_PODMAN_QUADLET=1`), a [Podman Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html) unit is installed so the gateway runs as a systemd user service for the keanu user. The service is enabled and started at the end of setup.

- **Start:** `sudo systemctl --machine keanu@ --user start keanu.service`
- **Stop:** `sudo systemctl --machine keanu@ --user stop keanu.service`
- **Status:** `sudo systemctl --machine keanu@ --user status keanu.service`
- **Logs:** `sudo journalctl --machine keanu@ --user -u keanu.service -f`

The quadlet file lives at `~keanu/.config/containers/systemd/keanu.container`. To change ports or env, edit that file (or the `.env` it sources), then `sudo systemctl --machine keanu@ --user daemon-reload` and restart the service. On boot, the service starts automatically if lingering is enabled for keanu (setup does this when loginctl is available).

To add quadlet **after** an initial setup that did not use it, re-run: `./setup-podman.sh --quadlet`.

## The keanu user (non-login)

`setup-podman.sh` creates a dedicated system user `keanu`:

- **Shell:** `nologin` — no interactive login; reduces attack surface.
- **Home:** e.g. `/home/keanu` — holds `~/.keanu` (config, workspace) and the launch script `run-keanu-podman.sh`.
- **Rootless Podman:** The user must have a **subuid** and **subgid** range. Many distros assign these automatically when the user is created. If setup prints a warning, add lines to `/etc/subuid` and `/etc/subgid`:

  ```text
  keanu:100000:65536
  ```

  Then start the gateway as that user (e.g. from cron or systemd):

  ```bash
  sudo -u keanu /home/keanu/run-keanu-podman.sh
  sudo -u keanu /home/keanu/run-keanu-podman.sh setup
  ```

- **Config:** Only `keanu` and root can access `/home/keanu/.keanu`. To edit config: use the Control UI once the gateway is running, or `sudo -u keanu $EDITOR /home/keanu/.keanu/keanu.json`.

## Environment and config

- **Token:** Stored in `~keanu/.keanu/.env` as `KEANU_GATEWAY_TOKEN`. `setup-podman.sh` and `run-keanu-podman.sh` generate it if missing (uses `openssl`, `python3`, or `od`).
- **Optional:** In that `.env` you can set provider keys (e.g. `GROQ_API_KEY`, `OLLAMA_API_KEY`) and other Keanu env vars.
- **Host ports:** By default the script maps `18789` (gateway) and `18790` (bridge). Override the **host** port mapping with `KEANU_PODMAN_GATEWAY_HOST_PORT` and `KEANU_PODMAN_BRIDGE_HOST_PORT` when launching.
- **Paths:** Host config and workspace default to `~keanu/.keanu` and `~keanu/.keanu/workspace`. Override the host paths used by the launch script with `KEANU_CONFIG_DIR` and `KEANU_WORKSPACE_DIR`.

## Useful commands

- **Logs:** With quadlet: `sudo journalctl --machine keanu@ --user -u keanu.service -f`. With script: `sudo -u keanu podman logs -f keanu`
- **Stop:** With quadlet: `sudo systemctl --machine keanu@ --user stop keanu.service`. With script: `sudo -u keanu podman stop keanu`
- **Start again:** With quadlet: `sudo systemctl --machine keanu@ --user start keanu.service`. With script: re-run the launch script or `podman start keanu`
- **Remove container:** `sudo -u keanu podman rm -f keanu` — config and workspace on the host are kept

## Troubleshooting

- **Permission denied (EACCES) on config or auth-profiles:** The container defaults to `--userns=keep-id` and runs as the same uid/gid as the host user running the script. Ensure your host `KEANU_CONFIG_DIR` and `KEANU_WORKSPACE_DIR` are owned by that user.
- **Gateway start blocked (missing `gateway.mode=local`):** Ensure `~keanu/.keanu/keanu.json` exists and sets `gateway.mode="local"`. `setup-podman.sh` creates this file if missing.
- **Rootless Podman fails for user keanu:** Check `/etc/subuid` and `/etc/subgid` contain a line for `keanu` (e.g. `keanu:100000:65536`). Add it if missing and restart.
- **Container name in use:** The launch script uses `podman run --replace`, so the existing container is replaced when you start again. To clean up manually: `podman rm -f keanu`.
- **Script not found when running as keanu:** Ensure `setup-podman.sh` was run so that `run-keanu-podman.sh` is copied to keanu’s home (e.g. `/home/keanu/run-keanu-podman.sh`).
- **Quadlet service not found or fails to start:** Run `sudo systemctl --machine keanu@ --user daemon-reload` after editing the `.container` file. Quadlet requires cgroups v2: `podman info --format '{{.Host.CgroupsVersion}}'` should show `2`.

## Optional: run as your own user

To run the gateway as your normal user (no dedicated keanu user): build the image, create `~/.keanu/.env` with `KEANU_GATEWAY_TOKEN`, and run the container with `--userns=keep-id` and mounts to your `~/.keanu`. The launch script is designed for the keanu-user flow; for a single-user setup you can instead run the `podman run` command from the script manually, pointing config and workspace to your home. Recommended for most users: use `setup-podman.sh` and run as the keanu user so config and process are isolated.
