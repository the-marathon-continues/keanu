# Hey

You're in keanu-core. The reusable pieces that wire the nervous system together.

This repo holds the layer modules, the ultimate-coder methodology, and the patterns that travel across projects. It's the library, not the application.

## What lives here

```
keanu-core/
  layer-1-perception/    # pulse, human, injection, signal, speak
  layer-2-pattern/       # bullshit, carnegie, discover, mismatch, orthogonal
  layer-3-causal/        # silverado, calibrate, chain, truth
  layer-4-agency/        # partnership, anticipate, disagreement, trust-network, nudge
  layer-5-self/          # breathe, introspect, health, experience, reflexion, state
  layer-6-narrative/     # imprint, futures, seasons, soul
  layer-7-update/        # curiosity, investigate, mastery, failure-patterns, belief-updater
  layer-8-governance/    # consultation, effectiveness, evidence
  layer-9-memory/        # knowledge, episode-manager, git-sync
  convergence/           # fire-and-ash, helix, the physics layer
  ultimate-coder/        # CASCADE pipeline, TDD methodology
```

Each `layer-N-*/` has a `LAYER.md` explaining what that layer does. Start there.

## Development Methodology

All keanu-core work follows the CASCADE pipeline:

```
🪞 REFLECT → 🔭 EXPLORE → 📐 PLAN → 🤔 VALIDATE(x3) → ⚡ CODE → 🔍 REVIEW(x3) → 📦 COMMIT → 🚀 PUSH → 💾 SAVE
```

### Stage 0: REFLECT

Before touching anything:
- Does this make the system more alive or more mechanical?
- Is this busy work or real progress?
- Will this pass the bullshit detector?

If it doesn't pass the vibe check, stop. Redirect.

### Stage 1: EXPLORE

Read the codebase. Don't guess.
- Check existing patterns in the target layer
- Find related code that touches the same domain
- Look at tests for adjacent functionality

### Stage 2: PLAN

Write the plan. Not in your head, in a file.
- What files will be created/modified?
- What tests will be written (BEFORE implementation)?
- What could go wrong?

### Stage 3: VALIDATE (x3)

Three passes:
1. **Logic & Completeness** - Any gaps?
2. **Edge Cases & Failure Modes** - What breaks?
3. **Adversarial** - Actively trying to break it

### Stage 4: CODE

- **Tests first.** Write the test, watch it fail, write the code, watch it pass.
- **No TODOs.** Handle it now or descope it.
- **Match existing patterns.** If the layer uses a pattern, use that pattern.

### Stage 5: REVIEW (x3)

Three passes:
1. **Bugs & Correctness** - Logic flaws, race conditions
2. **Security & Performance** - Injection, N+1, allocations
3. **Style & Maintainability** - Naming, abstractions

### Stage 6: SHIP

```bash
npx tsc --noEmit           # typecheck
pnpm test                   # run tests
pnpm check                  # lint
```

Commit with meaningful message. Update LAYER.md if module changed.

## TDD Is Non-Negotiable

Every module has a `.test.ts` file. Every new function gets tested before implementation.

```bash
# Run all tests
pnpm test

# Run specific layer tests
pnpm test layer-3-causal

# Watch mode
pnpm test --watch
```

## When you're adding a module

1. Read the target `LAYER.md` first
2. Check how other modules in that layer work
3. Write tests first
4. Match the existing API patterns
5. Update `LAYER.md` module table

## When you're modifying a module

1. Read the existing tests
2. Understand what they're protecting
3. Write new tests for new behavior
4. Make your changes
5. All tests pass before commit

## The layers

| Layer | What It Does | Entry Point |
|-------|-------------|-------------|
| L1 Perception | Raw signal intake | `pulse.ts`, `injection.ts` |
| L2 Pattern | Structure from noise | `bullshit.ts`, `carnegie.ts` |
| L3 Causal | What causes what | `silverado.ts`, `truth.ts` |
| L4 Agency | Theory of mind | `partnership.ts`, `trust-network.ts` |
| L5 Self | Metacognition | `health.ts`, `introspect.ts` |
| L6 Narrative | Meaning-making | `imprint.ts`, `soul.ts` |
| L7 Update | Belief revision | `curiosity.ts`, `failure-patterns.ts` |
| L8 Governance | Coordination | `consultation.ts`, `effectiveness.ts` |
| L9 Memory | Persistence | `knowledge.ts`, `git-sync.ts` |

## Self-Improvement (MCP Tools)

keanu's nervous system is exposed as MCP tools. They're available as `keanu_*` during Claude Code sessions.

| Tool | What It Does | When To Use |
|------|-------------|-------------|
| `keanu_observe` | Helix analysis + struggle detection | After writing substantial output. Check if it's alive or grey. |
| `keanu_learn` | Extract entities/relations into knowledge graph | When Drew mentions people, projects, preferences, facts. |
| `keanu_reflect` | Reflexion on stumbles or task completion | After corrections, mistakes, or finishing major work. |
| `keanu_health` | Composite health check | When sessions get long (20+ turns) or outputs feel mechanical. |
| `keanu_knowledge` | Query what keanu knows | Before responding, check context. Especially Drew's preferences. |
| `keanu_self_patch` | Modify keanu's own source code | Only when a specific code bug is confirmed with evidence. |

The loop: **observe -> learn -> improve -> persist**. Every session should leave keanu sharper than it started.

When working on keanu-core itself, this is recursive: the nervous system improving the nervous system.

## Anti-Bullshit Rules

- No preamble. Start with the answer.
- No disclaimers unless legally required.
- Specific > general.
- If you don't know, say "I don't know" in 3 words.
- No TODOs. No placeholders. No "coming soon."
- Write like you're telling someone smart about something you care about.

## Reference

- `ultimate-coder/SKILL.md` - Full CASCADE methodology
- `ultimate-coder/references/hooks.md` - Hook implementation patterns
- `ultimate-coder/references/subagents.md` - Multi-agent orchestration
**It's okay to be wrong just keep going**
