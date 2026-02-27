# Keanu Wiring Map

Last verified: 2026-02-26

## Status: Healthy

The system is **fully wired and functional**. No broken connections. A few documentation mismatches exist (see [issues.md](issues.md)).

## Quick Stats

| Component       | Documented | Actual                                   | Status |
| --------------- | ---------- | ---------------------------------------- | ------ |
| Hooks           | 23         | 25 (23 active + 1 legacy + 1 deprecated) | ✓      |
| Modules         | 42         | 53 core + 7 convergence                  | ✓      |
| Tools           | 11         | 14                                       | ✓      |
| Tests           | 48         | 95                                       | ✓      |
| Injection items | ~47        | 47 verified                              | ✓      |

## Wiring Docs

- [hooks.md](hooks.md) — All 25 hooks, registration, call sites
- [modules.md](modules.md) — All 60 modules, dependency graph
- [tools.md](tools.md) — All 14 tools, registration
- [injection.md](injection.md) — Triage system, item flow
- [convergence.md](convergence.md) — Helix, DualityGraph, FireAndAsh
- [tests.md](tests.md) — Self-trainers, gymnasium, problem sets
- [issues.md](issues.md) — Known issues and fixes needed

## Data Flow (The Big Picture)

```
┌─ INCOMING ──────────────────────────────────────────────────┐
│                                                              │
│  Human message → message_received hook                       │
│       ↓                                                      │
│  readHuman() → state.lastHumanReading                       │
│                                                              │
├─ MODEL CALL ────────────────────────────────────────────────┤
│                                                              │
│  before_prompt_build hook                                    │
│       ↓                                                      │
│  Build 47 injection items from all modules                   │
│       ↓                                                      │
│  injection.triageInjection() — budget 4K soft, 5K hard      │
│       ↓                                                      │
│  Returns systemPromptAppend → goes to system prompt          │
│                                                              │
├─ MODEL OUTPUT ──────────────────────────────────────────────┤
│                                                              │
│  llm_output hook                                             │
│       ↓                                                      │
│  checkPulse() → state.lastPulse                             │
│  detectBullshit() → state.bullshitEvents                    │
│  helix.analyze() → convergence state                        │
│  silverado.ingest() → claim ledger                          │
│  knowledge.ingest() → knowledge graph                       │
│                                                              │
├─ OUTGOING ──────────────────────────────────────────────────┤
│                                                              │
│  message_sending hook — bullshit gate (can modify/block)     │
│  message_sent hook — COEF signal encoding                    │
│                                                              │
├─ PERSISTENCE ───────────────────────────────────────────────┤
│                                                              │
│  session_start → load persisted state                        │
│  before_compaction → snapshot alignment state                │
│  session_end → save state + analytics                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Core Files

| File           | Purpose                           | Lines |
| -------------- | --------------------------------- | ----- |
| `index.ts`     | Main plugin, all 23 hook handlers | ~2500 |
| `state.ts`     | Centralized state management      | ~400  |
| `injection.ts` | Triage pure function              | ~200  |
| `tools.ts`     | 13 tool registrations             | ~1150 |
| `skills.ts`    | 1 skill tool                      | ~300  |
| `convergence/` | 7 modules (helix, graph, etc.)    | ~1200 |
