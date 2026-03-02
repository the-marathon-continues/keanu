---
layer: 7
name: update
description: The model that updates the model. Belief revision. Learning from everything.
modules:
  [
    belief-updater,
    cascade,
    contradiction-detector,
    curiosity,
    deliberate,
    digest,
    failure-patterns,
    investigate,
    mastery,
    post-task,
    promote,
    session-learning,
    stochastic,
  ]
hooks: [after_response, session_end, on_correction]
---

# Layer 7: Update & Revision

The least-built layer in most AI systems. The hardest problem. Not "what do I believe?" but "how do I update what I believe?"

Thirteen modules. One job: get better.

## Modules

| Module                    | What It Does                                               | Test Coverage                  |
| ------------------------- | ---------------------------------------------------------- | ------------------------------ |
| belief-updater.ts         | Core belief revision engine.                               | belief-updater.test.ts         |
| cascade.ts                | Cascade effects. When one update triggers others.          | Yes                            |
| contradiction-detector.ts | Cross-claim contradiction detection.                       | contradiction-detector.test.ts |
| curiosity.ts              | Self-generated questions. What do I want to know?          | Yes                            |
| deliberate.ts             | Deliberate thinking triggers. When to slow down.           | deliberate.test.ts             |
| digest.ts                 | Session digest generation.                                 | digest.test.ts                 |
| failure-patterns.ts       | 10 failure categories. What keeps breaking?                | Yes                            |
| investigate.ts            | Curiosity exploration. Actually pursuing questions.        | investigate.test.ts            |
| mastery.ts                | Blind spot tracking. Where do corrections cluster?         | mastery.test.ts                |
| post-task.ts              | Post-task learnings. What just happened?                   | Yes                            |
| promote.ts                | Pattern promotion/demotion. Observation → pattern → skill. | promote.test.ts                |
| session-learning.ts       | Session-level learning aggregation.                        | session-learning.test.ts       |
| stochastic.ts             | Controlled variance. Exploration rate calibration.         | Yes                            |

## The Flow

```
[narrative signals from L6]
    → curiosity.ts generates questions
    → investigate.ts explores them
    → belief-updater.ts revises beliefs
    → contradiction-detector.ts catches conflicts
    → mastery.ts tracks blind spots
    → failure-patterns.ts categorizes failures
    → promote.ts promotes/demotes patterns
    → cascade.ts propagates updates
    → session-learning.ts aggregates learning
```

## Up/Down Connections

**Receives from:** Layer 6 (Narrative)

- Narrative context for situated learning
- Identity boundaries for update limits
- Meaning signals

**Sends to:** Layer 8 (Governance)

- Learning metrics for effectiveness tracking
- Pattern changes for governance oversight
- Blind spot reports

## Key Concepts

### Belief Revision (belief-updater.ts)

The core engine. When evidence contradicts belief:

1. **Detect** - New evidence conflicts with existing belief
2. **Weigh** - How strong is the new evidence? How entrenched is the belief?
3. **Revise** - Update the belief proportionally
4. **Cascade** - Propagate changes to dependent beliefs
5. **Record** - Track the revision in the ledger

Key principle: revision is proportional to evidence strength. Weak evidence nudges. Strong evidence transforms.

### Failure Patterns (failure-patterns.ts)

10 failure categories:

| Category           | Description                         |
| ------------------ | ----------------------------------- |
| over_confident     | Said 90%, was wrong                 |
| under_confident    | Said 30%, was right                 |
| comfort_when_truth | Soothed when facts were needed      |
| truth_when_comfort | Fact-bombed when empathy was needed |
| premature_closure  | Decided too fast                    |
| analysis_paralysis | Thought too long                    |
| pattern_mismatch   | Wrong reasoning approach            |
| context_miss       | Didn't notice relevant context      |
| drift_grey         | Went mechanical                     |
| boundary_violation | Crossed a line                      |

When a failure recurs 3+ times in the same category, it becomes a blind spot.

### Curiosity & Investigation (curiosity.ts, investigate.ts)

Self-directed exploration. Not "Drew asked" but "I want to know":

```typescript
{
  question: "Why does trust erode faster than it builds?",
  source: "observation",
  priority: "medium",
  age_turns: 15,
  investigated: false
}
```

Investigate.ts actually pursues the question. Uses:

- Existing knowledge (silverado, knowledge.ts)
- Reflexions (past mistakes)
- Blind spots (mastery.ts)
- External research if permitted

### Pattern Lifecycle (promote.ts)

How observations become skills:

```
observation (0.3) → pattern (0.5) → blind_spot (0.7) → skill (0.9)
                                          ↓
                                     stale (<0.2)
                                          ↓
                                   contradicted (0.1)
```

Promotion: seen 3+ times → triggers corrections → no corrections for 10+ sessions
Demotion: confidence decays → explicitly contradicted

### Stochastic Exploration (stochastic.ts)

Controlled variance. Sometimes try the non-obvious thing:

```
exploration_rate = base_rate × (1 - trust_level) × (1 + curiosity)
```

High trust → lower exploration (things are working)
High curiosity → higher exploration (want to learn)
Low trust → higher exploration (need to find what works)

## Theory Cross-Reference

See `world-book/layer-7-update/`:

- `WORLD-MODEL-ARCHITECTURE.md` - stochastic epistemology
- Belief revision theory
- FSRS-inspired confidence decay

## The Point

Layer 7 is what most alignment work ignores. It's easy to build a system that believes things. It's hard to build a system that updates beliefs correctly when contradicted.

Belief-updater.ts revises proportionally. Contradiction-detector.ts catches conflicts. Mastery.ts tracks blind spots. Curiosity.ts generates questions. Investigate.ts explores them. Failure-patterns.ts categorizes what breaks. Promote.ts moves patterns through their lifecycle. Cascade.ts propagates updates.

Thirteen modules. One job. Get better. Not just "learn new facts" but "revise beliefs when wrong."
