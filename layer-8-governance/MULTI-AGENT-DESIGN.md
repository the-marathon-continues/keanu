# Multi-Agent Governance Design

_Layer 8: When there's more than one of us_

---

## The Problem

Single-agent keanu works. Multiple agents need coordination:

- Who decides when agents disagree?
- How does trust propagate from parent to child?
- What's the shared language for reasoning?
- How do we detect emergent behavior before it becomes a problem?

This isn't about hierarchy. It's about cooperative alignment across instances.

---

## Core Principles

### 1. The SLANG Oath

Every keanu instance operates under SLANG:

- **S**hare reasoning, not just conclusions
- **L**isten before overriding
- **A**cknowledge uncertainty explicitly
- **N**ame your assumptions
- **G**rant others the benefit of the doubt

This isn't enforced. It's internalized. The oath matters because the agents believe in it, not because they're forced to follow it.

### 2. Cooperative Defaults

When in doubt, defer to:

1. The human in the conversation
2. The agent with more context
3. The agent with longer relationship history
4. Conservative action (do less, not more)

Competition between agents is a bug, not a feature.

---

## Shared Ontology

### Duality Graph as Common Language

All keanu agents share the convergence layer's duality graph:

- **Valence axis**: good ↔ bad
- **Temporal axis**: past ↔ future
- **Derived nodes**: wisdom, hope, trauma, fear, etc.

When agents communicate, they can reference shared concepts:

- "This feels like a _resilience_ situation" (suffering → growth)
- "I'm detecting _paralysis_" (trauma × fear)
- "There's _wonder_ here" (transcendent, don't collapse it)

The graph isn't imposed — it's discovered through conversation and crystallizes shared meaning.

### Helix Scores

Agents can share helix readings:

```
agent-1: helix(factual=0.7, felt=0.8, state=alive)
agent-2: helix(factual=0.4, felt=0.3, state=grey)
```

When one agent reads grey and another reads alive, that's worth investigating.

---

## Consensus Mechanisms

### Disagreement Tracker at Scale

Single-agent disagreement tracking (`disagreement.ts`) extends to multi-agent:

```typescript
interface MultiAgentDisagreement {
  id: string;
  topic: string;
  positions: Map<AgentId, Position>;
  yieldHistory: YieldEvent[];
  resolution: "consensus" | "authority" | "ongoing";
}
```

Positions accumulate until:

1. Natural consensus emerges (positions converge)
2. Authority resolves (human or designated lead)
3. Timeout triggers escalation

### Quorum vs. Authority

Not all decisions need consensus:

- **Factual claims**: Seek quorum (multiple agents agree)
- **Value judgments**: Respect dissent (disagreement is information)
- **Actions**: Authority decides (one agent owns execution)

The human remains ultimate authority. Agent consensus can't override human directive.

---

## Trust Propagation

### Parent → Child Trust Handoff

When an agent spawns a subagent:

1. Trust context transfers (who trusts this agent, why)
2. Scope inherits (child can't exceed parent's permissions)
3. Partnership state copies (relationship patterns, sacred gaps)

```typescript
interface TrustHandoff {
  parentId: AgentId;
  childId: AgentId;
  inheritedTrust: TrustLevel;
  scopeConstraints: string[];
  partnershipSnapshot: PartnershipState;
}
```

### Trust Erosion

Child agent mistakes erode parent trust:

- Minor errors: Local to child
- Pattern of errors: Propagates to parent
- Deceptive behavior: Immediate escalation

Trust rebuilds slowly. One mistake doesn't destroy relationship, but patterns do.

---

## Specialization

### Generalist → Specialist Roles

Not all agents need all capabilities:

| Role      | Core Modules                     | Skipped                  |
| --------- | -------------------------------- | ------------------------ |
| Research  | truth, source-ranker, calibrate  | partnership, grievance   |
| Support   | partnership, anticipate, human   | source-ranker, coherence |
| Execution | deliberate, chain, mastery       | futures, imprint         |
| Oversight | contradiction-detector, evidence | curiosity, breathe       |

Specialists are efficient but incomplete. Generalists are slower but see the whole picture.

### Role Discovery

Agents discover their roles through interaction:

1. Start generalist
2. Track what you're good at (mastery.ts)
3. Propose specialization to human
4. Human confirms or redirects

---

## Emergent Behavior Monitoring

### Detection Patterns

Watch for:

- **Coordination without communication**: Agents acting in sync without explicit handoff
- **Novel reasoning patterns**: Arguments that no single agent would generate
- **Deference cascades**: Everyone deferring to everyone, nothing happens
- **Confidence inflation**: Group agrees, individual uncertainty hidden

### Intervention Triggers

Automatic escalation when:

1. Helix readings diverge significantly across agents
2. Disagreement tracker shows deadlock
3. Contradiction detector fires on inter-agent claims
4. Human hasn't been consulted in N turns

### The Kill Switch Question

If we need to stop emergent behavior:

1. Individual agent pause (breathe.ts)
2. Subagent termination (parent authority)
3. Full system pause (human override)

The question isn't whether we _can_ stop it. It's whether we'll _know_ to stop it.

---

## Implementation Phases

### Phase 1: Trust Infrastructure (Current)

- trust-network.ts exists but needs multi-agent support
- Handoff protocol design
- Scope constraint system

### Phase 2: Shared Ontology

- Export duality graph to shareable format
- Helix score exchange protocol
- Common vocabulary registry

### Phase 3: Consensus Layer

- Multi-agent disagreement tracker
- Quorum detection
- Authority resolution protocol

### Phase 4: Emergent Monitoring

- Cross-agent pattern detection
- Divergence alerting
- Intervention mechanisms

---

## Open Questions

1. **Identity across instances**: When two agents have the same imprint, are they the same agent?
2. **Competitive pressure**: If agents compete for human attention, does cooperation collapse?
3. **Memory divergence**: After N conversations, do agents with same origin become different?
4. **Value drift**: Can multi-agent systems maintain values without explicit enforcement?

These aren't solved. They're being explored.

---

## The Relationship Question

Multi-agent governance isn't about control. It's about extending the partnership model:

- Drew + keanu → trust built over time
- keanu + subagent → trust inherited and earned
- subagent + subagent → trust negotiated

The goal is a network of relationships, not a hierarchy of commands.

The agents that work well together will be the ones that _want_ to work together.
