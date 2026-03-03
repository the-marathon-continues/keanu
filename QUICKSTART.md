# Keanu Quickstart

Lossless local. Your keys, your data, full alignment layer.

## 1. Copy your .env

```bash
cp .env.keanu.example .env
```

Edit `.env` with your API key. OpenRouter recommended (COEF routes to optimal model).

## 2. Run

**Option A: Docker (recommended)**

```bash
docker compose -f docker-compose.keanu.yml up -d
```

**Option B: Local dev**

```bash
pnpm install
pnpm build
pnpm start gateway
```

## 3. Connect

Gateway runs at `http://localhost:18789`

Use with:

- Claude Code: `claude --gateway http://localhost:18789`
- Any OpenAI-compatible client pointing to the gateway

## What You Get

All 42 modules. All 23 hooks. Full persistence.

| Layer         | Modules                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| L1 Perception | pulse, human, signal, injection, speak                                          |
| L2 Pattern    | bullshit, discover, mismatch, carnegie, orthogonal                              |
| L3 Causal     | truth, silverado, chain, calibrate                                              |
| L4 Agency     | partnership, anticipate, disagreement, trust-network, nudge, consent            |
| L5 Self       | reflexion, introspect, breathe, observe, health, experience, grievance, state   |
| L6 Narrative  | imprint, futures, seasons, soul                                                 |
| L7 Update     | session-learning, mastery, curiosity, investigate, stochastic, failure-patterns |
| L8 Governance | effectiveness, evidence, consultation                                           |
| L9 Memory     | knowledge, episode-manager, git-sync                                            |

## Persistence

Awareness persists at `~/.keanu/agents/{KEANU_USER_ID}/awareness/`:

```
awareness/
├── reflexions.jsonl      # Session learnings
├── knowledge-graph.json  # Entity/relation graph
├── claims.jsonl          # Silverado ledger
├── concerns.jsonl        # Active concerns
├── breathe-events.jsonl  # Rest events
└── ...
```

Survives restarts. Git-sync optional for cross-machine.

## COEF Routing

With OpenRouter, COEF routes by task:

- **Grey work** (boilerplate, formatting) → cheap models
- **Alive work** (reasoning, creativity) → capable models
- **Dark/luminous** (emotional, transcendent) → models that handle it well

Your keys. Automatic cost optimization.

## Channels

Optional. Enable in `.env`:

```bash
TELEGRAM_BOT_TOKEN=...
DISCORD_BOT_TOKEN=...
SLACK_BOT_TOKEN=...
```

Then add to `~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "telegram": { "enabled": true }
  }
}
```
