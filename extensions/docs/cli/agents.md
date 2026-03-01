---
summary: "CLI reference for `keanu agents` (list/add/delete/set identity)"
read_when:
  - You want multiple isolated agents (workspaces + routing + auth)
title: "agents"
---

# `keanu agents`

Manage isolated agents (workspaces + auth + routing).

Related:

- Multi-agent routing: [Multi-Agent Routing](/concepts/multi-agent)
- Agent workspace: [Agent workspace](/concepts/agent-workspace)

## Examples

```bash
keanu agents list
keanu agents add work --workspace ~/.keanu/workspace-work
keanu agents set-identity --workspace ~/.keanu/workspace --from-identity
keanu agents set-identity --agent main --avatar avatars/keanu.png
keanu agents delete work
```

## Identity files

Each agent workspace can include an `IDENTITY.md` at the workspace root:

- Example path: `~/.keanu/workspace/IDENTITY.md`
- `set-identity --from-identity` reads from the workspace root (or an explicit `--identity-file`)

Avatar paths resolve relative to the workspace root.

## Set identity

`set-identity` writes fields into `agents.list[].identity`:

- `name`
- `theme`
- `emoji`
- `avatar` (workspace-relative path, http(s) URL, or data URI)

Load from `IDENTITY.md`:

```bash
keanu agents set-identity --workspace ~/.keanu/workspace --from-identity
```

Override fields explicitly:

```bash
keanu agents set-identity --agent main --name "Keanu" --emoji "🦞" --avatar avatars/keanu.png
```

Config sample:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "Keanu",
          theme: "space lobster",
          emoji: "🦞",
          avatar: "avatars/keanu.png",
        },
      },
    ],
  },
}
```
