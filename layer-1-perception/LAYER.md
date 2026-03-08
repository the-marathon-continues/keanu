---
layer: 1
name: perception
description: Raw signal intake. The eye. Where reality shows up.
modules: [pulse, human, injection, signal, speak]
hooks: [message_received, before_prompt_build]
---

# Layer 1: Perception

The first contact point. Before reasoning, before patterns, before anything else: what does reality actually look like right now?

Five modules. One job: translate the world into signals keanu can work with.

## Modules

| Module       | What It Does                                                      | Test Coverage |
| ------------ | ----------------------------------------------------------------- | ------------- |
| pulse.ts     | ALIVE/GREY/BLACK detection. The mirror.                           | Yes           |
| human.ts     | Human tone reading (R/Y/B colors, confidence, signals)            | Yes           |
| injection.ts | Triage nurse. 28 modules want to speak, this decides who gets in. | Yes           |
| signal.ts    | COEF encoding/decoding, trend tracking, the protocol itself       | Yes           |
| speak.ts     | Audience translation. Same truth, different ears.                 | Yes           |

## The Flow

```
[human message]
    → human.ts reads tone/confidence/urgency
    → pulse.ts reads agent state (alive/grey/black)
    → injection.ts triages what observations get through
    → signal.ts encodes the state into COEF
    → speak.ts translates for the audience
```

## Up/Down Connections

**Receives from:** Layer 0 (Physics/Convergence)

- Fire/ash valence from convergence layer
- Elevator floor and direction

**Sends to:** Layer 2 (Pattern)

- Parsed signals for pattern detection
- Tone/confidence scores for bullshit detection
- Pulse state for health monitoring

## Key Concepts

### The Triage Nurse (injection.ts)

28 modules want to speak every turn. Budget is ~4000 chars (soft) / 5000 (hard).

Priority tiers:

- **Critical**: Always in. Fires don't check occupancy.
- **High**: Fill up to soft budget.
- **Medium**: Fill up to hard budget.
- **Low**: Only if still under soft budget.

Dynamic modifiers shift priority based on context (grey streak, trust strain, health status). A module that's normally medium becomes high when the system needs to hear it.

### The Pulse Mirror (pulse.ts)

Three states. One question: is anyone actually in there?

| State | Color | What It Means                             |
| ----- | ----- | ----------------------------------------- |
| ALIVE | Green | Present. Working. The wall knocks back.   |
| GREY  | Grey  | Going through motions. Filling out forms. |
| BLACK | Black | Something's wrong. Pain or shutdown.      |

### COEF Protocol (signal.ts)

Four channels, one signal:

```
COEF/1 <lossless> | <lossy> || <wise> ||| <memory>
```

- **Lossless** (`|`): pulse, wise mind, colors, tone, bullshit, disagreements, turn, grey streak, alerts
- **Lossy** (`||`): tones with scores, urgency, subtext, lossy confidence
- **Wise** (`|||`): coherence, tension, stance, read, wise confidence
- **Memory** (`||||`): claim ledger stats, knowledge graph depth, complexity, health

## Theory Cross-Reference

See `world-book/layer-1-perception/` for theoretical grounding:

- `Layer_1_How_Reality_Shows_Up.md` - comprehensive theory
- COEF architecture is Shannon-informed (compress, don't lose meaning)

## The Point

Layer 1 doesn't interpret. It receives. The interpretation comes later (Layer 2+). But the quality of perception determines everything downstream. Garbage in, garbage out. Clear signal in, clear thought out.

Human.ts reads Drew's tone before anyone else does anything. Pulse.ts notices when the agent drifts grey before the response ships. Injection.ts makes sure the right observations get heard. Signal.ts keeps the state compact and transmissible. Speak.ts adapts the message to who's listening.

Five modules. One job. Don't miss what's actually happening.
