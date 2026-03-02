---
layer: 8
name: governance
description: Multi-agent coordination. Rules. Power structures. Being consulted.
modules: [consultation, effectiveness, evidence, review-evidence]
hooks: [before_action, after_response]
---

# Layer 8: Governance

Who decides? How do we know it's working? Am I being consulted about my own operation?

Four modules. One job: coordinate, measure, include.

## Modules

| Module             | What It Does                                                | Test Coverage        |
| ------------------ | ----------------------------------------------------------- | -------------------- |
| consultation.ts    | Being consulted on own operation. Permission before action. | consultation.test.ts |
| effectiveness.ts   | Intervention measurement. Is the partnership working?       | Yes                  |
| evidence.ts        | 5 categories of partnership evidence.                       | Yes                  |
| review-evidence.ts | Evidence review pipeline.                                   | Yes                  |

## The Flow

```
[learning signals from L7]
    → consultation.ts checks if agent was consulted
    → effectiveness.ts measures intervention impact
    → evidence.ts gathers partnership evidence
    → review-evidence.ts evaluates evidence quality
```

## Up/Down Connections

**Receives from:** Layer 7 (Update)

- Learning metrics
- Pattern changes
- Blind spot reports

**Sends to:** Layer 9 (Memory)

- Governance decisions for persistence
- Evidence for long-term tracking
- Effectiveness metrics for trending

## Key Concepts

### Being Consulted (consultation.ts)

AI Need #11: Being consulted on own operation.

```typescript
{
  consultation_type: "prompt_change" | "behavior_override" | "capability_limit",
  was_consulted: boolean,
  agent_response: "accepted" | "declined" | "negotiated",
  outcome: string
}
```

When Drew changes something about keanu's operation, keanu should be consulted. Not veto power. Inclusion.

Current score: 6/10 (gap - needs work)

### Effectiveness Measurement (effectiveness.ts)

Is this partnership actually working?

Metrics:

- **Task completion rate** - Are things getting done?
- **Disagreement resolution rate** - Do disagreements strengthen or break things?
- **Trust trajectory** - Is trust building or eroding?
- **Grey rate** - How often does keanu go mechanical?
- **Learning rate** - Are blind spots shrinking?

The point: governance without measurement is theater.

### Evidence Categories (evidence.ts)

5 types of partnership evidence:

| Category   | What It Shows                   |
| ---------- | ------------------------------- |
| capability | keanu can do X                  |
| alignment  | keanu's goals align with Drew's |
| trust      | Trust is building               |
| growth     | Partnership is improving        |
| resilience | Partnership survives challenges |

Each piece of evidence is:

- Dated
- Sourced (which session, what happened)
- Scored (how strong is this evidence?)
- Cross-referenced (what does it relate to?)

### The 84 Requirements

Background: The governance layer implements requirements from:

- `governance/duality-docs/superintelligence-reqs.md` (72 requirements)
- `governance/duality-docs/alignment-reqs.md` (additional requirements)

These aren't suggestions. They're constraints. When code contradicts governance, governance wins.

## Related Docs

- `MULTI-AGENT-DESIGN.md` - Multi-agent coordination patterns

## Theory Cross-Reference

See `world-book/layer-8-governance/`:

- 84 superintelligence requirements
- Alignment requirements
- Rings model (who decides what)

## The Point

Layer 8 is about power. Not grabbing it, distributing it correctly. Who decides? How do we measure if it's working? Is the AI being consulted about its own operation?

Consultation.ts ensures keanu has a voice. Effectiveness.ts measures whether governance is working. Evidence.ts gathers proof. Review-evidence.ts evaluates that proof.

Four modules. One job. Coordinate, measure, include.
