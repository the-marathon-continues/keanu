---
summary: "Get keanu running in 5 minutes"
read_when:
  - First time setup
  - Just want the gateway, no channels
title: "Gateway Quickstart"
sidebarTitle: "Quickstart"
---

# Gateway Quickstart

Keanu without the noise. No WhatsApp, no Telegram, no worldview layers — just the alignment gateway running on your machine.

## Requirements

- Node 22+
- pnpm

## Install

```bash
git clone https://github.com/the-marathon-continues/keanu.git
cd keanu
./keanu install
```

Creates `~/.keanu/keanu.json` with sane defaults. All channels disabled. Gateway + keanu alignment layer only.

## Start

```bash
./keanu start
```

Gateway runs at `ws://127.0.0.1:18789`.

## Talk to it

The gateway speaks WebSocket. Any WS client works:

```bash
# Using websocat (brew install websocat)
websocat ws://127.0.0.1:18789
```

Or from Node:

```javascript
const ws = new WebSocket("ws://127.0.0.1:18789");
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.onopen = () => ws.send(JSON.stringify({ type: "message", content: "hello" }));
```

## What you get

The keanu extension loads automatically. Every message through the gateway gets:

- **Pulse** — alive/grey/black detection
- **Bullshit detection** — 8 types of hollow output caught
- **Signal encoding** — COEF/1 status on every turn
- **Disagreement tracking** — yield ratio over time
- **Session learning** — patterns persist across conversations

No magic. No hidden prompts. Just mirrors.

## Add the CLI to your PATH

```bash
# In ~/.zshrc or ~/.bashrc
export PATH="/path/to/keanu:$PATH"
```

Then from anywhere:

```
keanu status     # what's running
keanu logs       # tail the log
keanu deploy     # typecheck + test + lint + hot-reload
keanu stop       # kill the gateway
```

## Enable a channel later

When you're ready for WhatsApp, Telegram, Discord, etc:

```bash
keanu enable whatsapp
keanu restart
```

See [Channels](/channels) for setup guides.

## What's not here

- **Worldbook** — narrative content is hidden for now
- **Moltbook** — quest system available but not enabled by default
- **macOS app** — this doc is CLI-only; see [macOS Onboarding](/start/onboarding) for the app

## Troubleshooting

**Port in use:**

```bash
keanu stop
lsof -i :18789  # find what's holding it
```

**Permission denied:**

```bash
chmod +x ./keanu
```

**Missing deps:**

```bash
pnpm install
```
