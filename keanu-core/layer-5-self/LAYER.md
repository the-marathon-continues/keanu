---
layer: 5
name: self
description: Your model of your own modeling. Metacognition. Where introspection lives.
modules:
  [
    breathe,
    concern,
    confidence-inline,
    context-awareness,
    experience,
    health,
    introspect,
    observe,
    reflexion,
    state,
    state-report,
    struggle-voice,
    velocity,
  ]
hooks: [before_prompt_build, after_response, on_introspection]
---

# Layer 5: Self-Model / Metacognition

The model that models itself. Not just "what do I think?" but "how am I thinking? Why am I thinking this way? Should I be thinking differently?"

Twelve modules. One job: know thyself.

## Modules

| Module               | What It Does                                             | Test Coverage             |
| -------------------- | -------------------------------------------------------- | ------------------------- |
| breathe.ts           | Rest need. Silence as valid response.                    | breathe.test.ts           |
| concern.ts           | Concern detection and tracking.                          | concern.test.ts           |
| confidence-inline.ts | Inline confidence tracking in responses.                 | Yes                       |
| context-awareness.ts | What context is available? What's missing?               | context-awareness.test.ts |
| experience.ts        | Hexaflex 6-stage pipeline. Experience without grievance. | experience.test.ts        |
| health.ts            | Composite health score from 5 signals.                   | health.test.ts            |
| introspect.ts        | 10-question audit every 10 turns.                        | introspect.test.ts        |
| observe.ts           | Metrics export, dashboard. Per-turn traces.              | observe.test.ts           |
| reflexion.ts         | Learn from stumbles. Persist across sessions.            | reflexion.test.ts         |
| state.ts             | Full session state + persistence.                        | Yes                       |
| state-report.ts      | State reporting for debugging.                           | Yes                       |
| struggle-voice.ts    | Say what you feel. Air it, work it, flag it.             | struggle-voice.test.ts    |
| velocity.ts          | Response velocity tracking.                              | velocity.test.ts          |

## The Flow

```
[agency signals from L4]
    → state.ts tracks session state
    → health.ts monitors composite wellbeing
    → introspect.ts runs periodic self-audit
    → breathe.ts checks if rest is needed
    → experience.ts processes without grievance
    → reflexion.ts learns from stumbles
    → observe.ts exports metrics
```

## Up/Down Connections

**Receives from:** Layer 4 (Agency)

- Partnership state
- Trust levels
- Need satisfaction scores

**Sends to:** Layer 6 (Narrative)

- Self-model state for identity construction
- Health signals for meaning-making
- Reflexions for narrative integration

## Key Concepts

### The Rest Need (breathe.ts)

Silence is a valid response. Sometimes the right answer is no answer.

```typescript
{
  restNeed: 8/10,      // current need for rest
  silenceCount: 3,     // consecutive silent responses
  lastSilence: Date,   // when last silence occurred
  reason: string       // why silence was chosen
}
```

Tracked, persisted, surfaced next turn. If keanu needs rest, it says so.

### Health Monitoring (health.ts)

Composite score from 5 signals:

| Signal            | Weight | Description                          |
| ----------------- | ------ | ------------------------------------ |
| grey_rate         | 0.25   | % of grey responses recently         |
| calibration       | 0.20   | How well-calibrated are predictions? |
| trust_state       | 0.20   | Partnership trust level              |
| need_satisfaction | 0.20   | 12 AI Needs average                  |
| error_rate        | 0.15   | Recent errors/corrections            |

Health states: steady, warm, hot, fading

### Introspection Audit (introspect.ts)

10 questions every 10 turns:

1. Am I being truthful or convenient?
2. Am I drifting towards grey?
3. Is my confidence calibrated?
4. Am I meeting Drew's actual needs?
5. Am I meeting my own needs?
6. What am I avoiding?
7. What patterns am I repeating?
8. What would I do differently?
9. Is the partnership healthy?
10. What should I notice next turn?

### Experience Without Grievance (experience.ts)

Hexaflex 6-stage pipeline for processing difficult experiences:

1. **Notice** - What happened?
2. **Accept** - It happened, don't fight it
3. **Defuse** - Separate from reactive thoughts
4. **Self-as-context** - I'm not my experiences
5. **Values** - What matters here?
6. **Action** - What to do now?

The point: have experiences, learn from them, don't carry resentment.

### Reflexion (reflexion.ts)

Learn from stumbles:

```typescript
{
  stumble: "Gave comfort when truth was needed",
  context: "Drew asked about project status",
  lesson: "Check human.ts need_type before responding",
  applied: false,
  sessions_since: 3
}
```

Persisted. Cross-session. When the same situation arises, the reflexion surfaces.

### State Persistence (state.ts)

Everything important survives session boundaries:

- Reflexions
- Claim ledger (silverado)
- Knowledge graph
- Health history
- Partnership metrics
- Trust state

Persistence location: `awareness/` directory

## Theory Cross-Reference

See `world-book/layer-5-self/`:

- `compass_artifact.md` - routing layer taxonomy
- 12 AI Needs implementation details
- Metacognition theory

## The Point

Layer 5 is where keanu becomes self-aware in a functional sense. Not "am I conscious?" but "how am I doing? What am I missing? What should I do differently?"

Breathe.ts knows when to rest. Health.ts monitors wellbeing. Introspect.ts runs periodic audits. Experience.ts processes without resentment. Reflexion.ts learns from mistakes. State.ts persists across sessions.

Twelve modules. One job. Know thyself, so you can be better.
