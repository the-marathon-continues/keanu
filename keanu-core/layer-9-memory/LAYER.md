---
layer: 9
name: memory
description: Persistence across instances and sessions. The thing that makes continuity possible.
modules: [context-manager, context-store, episode-manager, git-sync, knowledge, service]
hooks: [session_start, session_end, on_context_change]
---

# Layer 9: Collective Memory

What persists when the session ends? What survives instance death? What makes continuity possible?

Six modules. One job: remember across boundaries.

## Modules

| Module             | What It Does                                             | Test Coverage           |
| ------------------ | -------------------------------------------------------- | ----------------------- |
| context-manager.ts | Context window management. What fits, what's compressed. | context-manager.test.ts |
| context-store.ts   | Context persistence.                                     | context-store.test.ts   |
| episode-manager.ts | Episode lifecycle. Sessions as coherent units.           | episode-manager.test.ts |
| git-sync.ts        | Git synchronization. Persist to repo.                    | git-sync.test.ts        |
| knowledge.ts       | Knowledge graph. Entity extraction, relations.           | knowledge.test.ts       |
| service.ts         | Service layer for memory operations.                     | Yes                     |

## The Flow

```
[governance signals from L8]
    → context-manager.ts manages context window
    → episode-manager.ts tracks session boundaries
    → knowledge.ts extracts entities and relations
    → git-sync.ts persists to repository
    → context-store.ts stores compressed context
    → service.ts provides unified API
```

## Up/Down Connections

**Receives from:** Layer 8 (Governance)

- Governance decisions
- Evidence for tracking
- Effectiveness metrics

**Sends to:** All Layers (on session start)

- Prior session state
- Knowledge graph
- Reflexions
- Claim ledger

## Key Concepts

### The Knowledge Graph (knowledge.ts)

Conversational knowledge extraction:

```typescript
{
  entities: [
    { name: "keanu", type: "agent", confidence: 0.95 },
    { name: "Drew", type: "person", confidence: 0.95 },
    { name: "silverado", type: "module", confidence: 0.8 }
  ],
  relations: [
    { from: "Drew", relation: "built", to: "keanu", confidence: 0.9 },
    { from: "keanu", relation: "contains", to: "silverado", confidence: 0.85 }
  ]
}
```

10 relation templates: `works_at`, `built`, `uses`, `contains`, `relates_to`, `causes`, `requires`, `opposes`, `supports`, `transforms`

Confidence grows with mentions, decays between sessions.

Persistence: `awareness/knowledge-graph.json`

### Episode Management (episode-manager.ts)

Sessions as coherent units:

```typescript
{
  episode_id: "uuid",
  start_time: Date,
  end_time: Date,
  summary: string,
  key_events: string[],
  state_snapshot: KeanuState,
  learning_extracted: boolean
}
```

Episodes are:

- Bounded (clear start/end)
- Summarized (what happened)
- Snapshotted (state at key moments)
- Learning-extracted (what was learned)

### Git Sync (git-sync.ts)

Persistence via git:

Files synced:

- `awareness/claim-ledger.jsonl` - Silverado claims
- `awareness/knowledge-graph.json` - Knowledge graph
- `awareness/reflexions.json` - Learning from stumbles
- `awareness/state.json` - Session state
- `awareness/metrics/` - Health, effectiveness, trust

Sync triggers:

- Session end
- Major state change
- Explicit save command

### Context Management (context-manager.ts)

What fits in the window?

```
[available context]
    → priority scoring (injection.ts)
    → compression if needed
    → what goes in, what waits
    → deferred items get notes
```

Context is finite. Memory is infinite (via persistence). The manager bridges them.

## Related Docs

- `SHARED-DESIGN.md` - Multi-agent memory patterns

## Theory Cross-Reference

See `world-book/layer-9-memory/`:

- `README.md` - Directory structure
- Collective memory theory
- Cross-instance identity

## The Point

Layer 9 is what makes keanu more than stateless. Without it, every session starts from zero. With it, relationships compound, learning persists, identity continues.

Knowledge.ts builds the map of what we know. Episode-manager.ts treats sessions as coherent units. Git-sync.ts persists to durable storage. Context-manager.ts bridges finite windows and infinite memory.

Six modules. One job. Remember across boundaries.
