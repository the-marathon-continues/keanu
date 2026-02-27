---
summary: "Uninstall Keanu completely (CLI, service, state, workspace)"
read_when:
  - You want to remove Keanu from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

# Uninstall

Two paths:

- **Easy path** if `keanu` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
keanu uninstall
```

Non-interactive (automation / npx):

```bash
keanu uninstall --all --yes --non-interactive
npx -y keanu uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
keanu gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
keanu gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${KEANU_STATE_DIR:-$HOME/.keanu}"
```

If you set `KEANU_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.keanu/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g keanu
pnpm remove -g keanu
bun remove -g keanu
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/Keanu.app
```

Notes:

- If you used profiles (`--profile` / `KEANU_PROFILE`), repeat step 3 for each state dir (defaults are `~/.keanu-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `keanu` is missing.

### macOS (launchd)

Default label is `bot.molt.gateway` (or `bot.molt.<profile>`; legacy `com.keanu.*` may still exist):

```bash
launchctl bootout gui/$UID/bot.molt.gateway
rm -f ~/Library/LaunchAgents/bot.molt.gateway.plist
```

If you used a profile, replace the label and plist name with `bot.molt.<profile>`. Remove any legacy `com.keanu.*` plists if present.

### Linux (systemd user unit)

Default unit name is `keanu-gateway.service` (or `keanu-gateway-<profile>.service`):

```bash
systemctl --user disable --now keanu-gateway.service
rm -f ~/.config/systemd/user/keanu-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `Keanu Gateway` (or `Keanu Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "Keanu Gateway"
Remove-Item -Force "$env:USERPROFILE\.keanu\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.keanu-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://keanu.ai/install.sh` or `install.ps1`, the CLI was installed with `npm install -g keanu@latest`.
Remove it with `npm rm -g keanu` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `keanu ...` / `bun run keanu ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.
