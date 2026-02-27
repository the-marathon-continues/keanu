---
summary: "CLI reference for `keanu voicecall` (voice-call plugin command surface)"
read_when:
  - You use the voice-call plugin and want the CLI entry points
  - You want quick examples for `voicecall call|continue|status|tail|expose`
title: "voicecall"
---

# `keanu voicecall`

`voicecall` is a plugin-provided command. It only appears if the voice-call plugin is installed and enabled.

Primary doc:

- Voice-call plugin: [Voice Call](/plugins/voice-call)

## Common commands

```bash
keanu voicecall status --call-id <id>
keanu voicecall call --to "+15555550123" --message "Hello" --mode notify
keanu voicecall continue --call-id <id> --message "Any questions?"
keanu voicecall end --call-id <id>
```

## Exposing webhooks (Tailscale)

```bash
keanu voicecall expose --mode serve
keanu voicecall expose --mode funnel
keanu voicecall expose --mode off
```

Security note: only expose the webhook endpoint to networks you trust. Prefer Tailscale Serve over Funnel when possible.
