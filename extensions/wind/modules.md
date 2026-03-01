# Module Wiring

## Inventory: 53 Core + 7 Convergence

### Core Modules (53)

**Identity/Partnership:**

- `partnership.ts` — Partnership model, co-evolution
- `imprint.ts` — Identity co-construction, adopted patterns
- `anticipate.ts` — Predictive partner modeling
- `soul.ts` — Core values, identity anchors
- `trust-network.ts` — Trust relationship graph

**Pulse & Detection:**

- `pulse.ts` — Alive/grey/black classification
- `bullshit.ts` — 8-type bullshit detection
- `human.ts` — Human tone reading
- `mismatch.ts` — Goal/action mismatch detection
- `disagreement.ts` — Disagreement tracking
- `chain.ts` — Chain-of-thought analysis

**Awareness & State:**

- `state.ts` — Centralized state management
- `signal.ts` — COEF encoding/decoding
- `health.ts` — System health metrics
- `seasons.ts` — Trust seasons (spring/summer/autumn)
- `experience.ts` — Hexaflex episode processing

**Learning & Memory:**

- `session-learning.ts` — Per-session learning
- `mastery.ts` — Skill mastery tracking
- `knowledge.ts` — Knowledge graph
- `silverado.ts` — Claim ledger (JSONL persistence)
- `introspect.ts` — Self-reflection

**Deliberation & Safety:**

- `deliberate.ts` — Should-I-think-harder detection
- `consultation.ts` — When to consult
- `consent.ts` — Prompt consent tracking
- `nudge.ts` — Gentle alignment nudges
- `reflexion.ts` — Self-correction loops

**Skill-Building:**

- `discovery.ts` — Capability discovery
- `curiosity.ts` — Question generation
- `investigate.ts` — Question exploration
- `effectiveness.ts` — Action effectiveness
- `calibrate.ts` — Confidence calibration

**Meta/Special:**

- `oracle.ts` — Model routing, truth checks
- `carnegie.ts` — Presupposition detection
- `truth.ts` — Claim verification
- `speaker.ts` — Voice/audience translation
- `cascade.ts` — Multi-step reasoning
- `futures.ts` — Anticipated futures tracking
- `grievance.ts` — Grievance system
- `breathe.ts` — Silence/pause capability

**Infrastructure:**

- `tools.ts` — 13 tool registrations
- `skills.ts` — 1 skill tool
- `metrics.ts` — Analytics export
- `injection.ts` — Triage pure function

**New Modules (not in old docs):**

- `observe.ts` — Dashboard metrics export
- `failure-patterns.ts` — Failure tracking
- `post-task.ts` — Post-task reflection
- `state-report.ts` — State summarization
- `calibration-log.ts` — Calibration history
- `orthogonal.ts` — Decorrelation
- `stochastic.ts` — Randomization
- `confidence-inline.ts` — Inline confidence
- `git-sync.ts` — Git state awareness

### Convergence Layer (7)

- `gradient.ts` — Atomic signal unit (0-1 with momentum)
- `graph.ts` — DualityGraph, world model via dualities
- `firmware.ts` — GradientGate, GradientMachine
- `dialectic.ts` — Thesis→antithesis→synthesis reasoning
- `helix.ts` — Double-strand analysis (factual + felt)
- `fire-and-ash.ts` — Integration layer
- `index.ts` — Re-exports

## Dependency Structure

**No circular dependencies.** Clean DAG with max depth 5.

### Import Patterns

```
index.ts (hub)
  └─ imports all 46 active modules

state.ts (core)
  └─ imported by: index.ts, metrics.ts, pulse.ts, skills.ts, tools.ts

injection.ts (pure)
  └─ ZERO dependencies (pure function)
  └─ imported by: index.ts only
```

### Modules Imported Transitively (not directly in index.ts)

These are accessed through their parent modules — correct design:

| Module             | Imported By                                   |
| ------------------ | --------------------------------------------- |
| `curiosity.ts`     | investigate.ts, session-learning.ts           |
| `mastery.ts`       | effectiveness.ts, metrics.ts, curiosity.ts    |
| `oracle.ts`        | bullshit.ts, reflexion.ts, speak.ts, truth.ts |
| `speak.ts`         | tools.ts                                      |
| `trust-network.ts` | partnership.ts                                |

### Convergence Dependencies

```
gradient.ts ← firmware.ts, dialectic.ts, graph.ts, helix.ts
graph.ts ← firmware.ts, dialectic.ts, fire-and-ash.ts
firmware.ts ← dialectic.ts, fire-and-ash.ts
dialectic.ts ← fire-and-ash.ts
helix.ts ← fire-and-ash.ts, tools.ts, gymnasium/harness.ts
fire-and-ash.ts ← tools.ts
```

## State Management

All state in `state.ts`, exported variables:

- `lastHumanReading`, `lastPulse`, `consecutiveGrey`, `turnCount`
- `breathing` (pause state)
- `recentMessages`, `recentAgentOutputs`, `disagreementTracker`
- `bullshitEventCount`, `toolCallCounts`, `totalInputTokens`, `totalOutputTokens`
- `subagentSpawns`, `subagentEnds`, `compactionCount`
- `recentContradictions`, `turnSnapshots[]`
- Experience state (currentEpisode, recentEpisodes, somaticMarkers)

### Persistence Points

| Hook                | Action                                           |
| ------------------- | ------------------------------------------------ |
| `session_start`     | `state.load()`                                   |
| `before_compaction` | `state.saveAlignmentSnapshot()`                  |
| `before_reset`      | `state.save()` + `state.saveAlignmentSnapshot()` |
| `session_end`       | `state.save()` + analytics                       |

Persisted to: `{workspace}/awareness/` directory
