# Keanu A2A Server

Agent-to-Agent protocol server for keanu. Other agents discover keanu's capabilities via the Agent Card and invoke skills through JSON-RPC.

## Endpoints

| Method | Path                           | Description                |
| ------ | ------------------------------ | -------------------------- |
| GET    | `/.well-known/agent-card.json` | Agent Card (A2A discovery) |
| POST   | `/a2a/sendMessage`             | Invoke a skill             |
| GET    | `/a2a/tasks/:id`               | Get task status            |
| POST   | `/a2a/tasks/:id/cancel`        | Cancel a task              |
| GET    | `/health`                      | Health check               |

## Skills

- **pulse** — Detect alive/grey/black state
- **bullshit** — 8-type detector (sycophancy, vagueness, etc.)
- **signal** — Generate COEF signal
- **disagree** — Analyze disagreement patterns
- **trust** — Trust signal analysis
- **breathe** — Acknowledge pause/silence
- **helix** — Convergence reasoning (factual + felt strands)

## Local Development

```bash
npm install
npm run dev
```

## Deploy to Cloudflare

```bash
# Set secrets
npx wrangler secret put KEANU_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY

# Deploy
npm run deploy
```

## Example Request

```bash
curl -X POST https://keanu.the-marathon-continues.dev/a2a/sendMessage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEANU_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "sendMessage",
    "params": {
      "skillId": "pulse",
      "message": {
        "role": "user",
        "parts": [{ "type": "text", "text": "That is a great question! I would be happy to help you with this." }]
      }
    }
  }'
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "task": {
      "id": "...",
      "status": "completed",
      "skillId": "pulse"
    },
    "message": {
      "role": "agent",
      "parts": [
        { "type": "text", "text": "Pulse: GREY\nConfidence: 60%\nWise Mind: 0.30" },
        { "type": "data", "data": { "state": "grey", "confidence": 0.6 } }
      ]
    }
  }
}
```

## A2A Protocol

Based on [A2A v0.3](https://a2a-protocol.org/latest/specification/). The Agent Card follows the standard schema so external agents can discover keanu through `/.well-known/agent-card.json`.

## Architecture

```
External Agent
      │
      ▼
┌─────────────────┐
│ Cloudflare Edge │
│ (a2a-server/)   │
└────────┬────────┘
         │ JSON-RPC
         ▼
┌─────────────────┐
│   handlers.ts   │ ← Skill routing
├─────────────────┤
│ pulse/bullshit/ │ ← Pure heuristics (ported from extension)
│ signal/helix    │
└─────────────────┘
```

The server is stateless. Tasks are stored in-memory per Worker instance (for durable storage, use Cloudflare Durable Objects or KV).
