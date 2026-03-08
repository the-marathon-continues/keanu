# 8. Convergence Theory

## The Duality Spine

The reasoning engine. Carnegie is for people—what they want to hear vs what you believe. This is for knowledge—what's true, arrived at through iterated synthesis of opposing positions.

Built on two root dualities: **valence** (good ↔ bad) and **temporal** (past ↔ future, where present = 0.5 = the gradient zone = where choice lives). Everything else derives from their intersection.

## Layer 0: The Physics of Mind

Convergence is one of five subsystems in Layer 0, the mathematical foundation of the architecture. Each subsystem serves a distinct purpose in signal processing:

### The Five Subsystems

| Subsystem | Modules | Purpose |
|-----------|---------|---------|
| **Convergence** | 16 | Reasoning toward synthesis. Duality graph, dialectical cycles, helix scoring. |
| **Divergence** | 7 | Reasoning away from assumptions. Branch, differentiate, expand, explore, release, space. |
| **Substrate** | 6 | The ground. Ignition (activation), noise (randomness), regime (operating modes), resonance (harmony detection), speed (velocity control). |
| **Loop** | 5 | Cyclical patterns. Cycle, return, rotation, spiral—patterns that revisit without repeating. |
| **Throughline** | 6 | Continuity. Flow, horizon, momentum, rhythm—what carries across turns and sessions. |

**Total: 40 modules** forming the physics layer.

The relationship: **Substrate** provides the foundation. **Loop** handles recurrence. **Throughline** handles persistence. **Divergence** explores the space. **Convergence** synthesizes toward truth.

### The Gradient Primitive

Everything in Layer 0 is built on the `Gradient` class (`gradient.ts`):

```typescript
interface Gradient {
  value: number;      // 0-1, continuous
  history: number[];  // Past values
  momentum: number;   // Direction of change
  stability: number;  // Resistance to perturbation
  conviction: number; // Confidence in current value
}
```

Nothing is boolean. Signals move through gradient space, accumulating history and momentum. A signal with high conviction resists single-turn shifts. A signal with low conviction remains responsive to new evidence.

### The Firmware Layer

`firmware.ts` implements gradient gates—points where signals converge through weighted interference. The **navigator bias** is the human's thumb on the scale: a configurable weight that tilts synthesis without determining it.

```
signal_out = (signal_a * weight_a + signal_b * weight_b + navigator_bias) / normalization
```

This is where human preferences enter the math without overriding it.

---

## The Graph Structure

### Layer 1 — Raw Intersections (What IS)

The six nodes at the intersection of valence and temporal:

| Node | Definition | Intersection |
|------|------------|--------------|
| **Wisdom** | Knowledge refined by experience | good + past |
| **Hope** | Positive anticipation | good + future |
| **Trauma** | Unprocessed harm | bad + past |
| **Fear** | Negative anticipation | bad + future |
| **Flow** | Present engagement with good | good + present |
| **Suffering** | Present engagement with bad | bad + present |

### Layer 2 — Emergent Tensions (What HAPPENS When They Meet)

The six nodes that emerge from Layer 1 interactions:

| Node | Definition | Sources |
|------|------------|---------|
| **Vision** | Wisdom directed toward a goal | wisdom + hope |
| **Paralysis** | Fear frozen by trauma | trauma + fear |
| **Creation** | Flow channeled by vision | flow + vision |
| **Choice** | The decision point between hope and fear | hope + fear |
| **Resilience** | Wisdom that includes trauma | wisdom + trauma |
| **Transformation** | Suffering that produces change | suffering + flow |

### Layer 3 — The Transcendent (What Emerges When You Stop Fixing)

The six nodes that emerge when the system stabilizes:

| Node | Definition | Sources |
|------|------------|---------|
| **Grace** | What arrives when you've done the work AND let go | resilience + hope |
| **Wonder** | Seeing the whole picture after pain changed you | transformation + vision |
| **Surrender** | Choosing to stop fighting what can't be changed | choice + suffering |
| **Presence** | The gradient zone fully inhabited. Just being. | wonder + grace |
| **Play** | Building without attachment to outcome | creation + surrender |
| **Equanimity** | Holding everything without being moved | presence + resilience |

**Total: 2 roots + 6 + 6 + 6 = 20 derived nodes**, plus the two root dualities = **22 nodes** in the graph.

---

## The Dialectic Engine

`dialectic.ts` implements thesis → antithesis → synthesis cycles.

### Process

1. **Thesis**: An initial position extracted from text or stated explicitly.
2. **Antithesis**: The strongest opposing position, generated via LLM or found in the duality graph.
3. **Synthesis**: A position that integrates valid elements of both, generated via LLM.
4. **Convergence check**: If synthesis differs significantly from thesis, it becomes the new thesis and the cycle repeats.
5. **Termination**: When synthesis reaches a fixed point (minimal change from previous cycle).

### Modes

- **Local mode**: No LLM calls. Uses the duality graph structure to find oppositions and syntheses. Fast but limited.
- **LLM mode**: Uses `oracle.ts` (role: "think") to generate antitheses and syntheses. Richer but adds ~200ms per cycle.

### Complexity Correlation

The number of cycles correlates with question complexity:

| Question Type | Typical Cycles |
|---------------|----------------|
| Factual | 1-2 |
| Interpretive | 2-3 |
| Ethical | 3-4 |
| Philosophical | 4+ |

This correlation is empirically observed but not yet formally measured.

---

## The Seven Helix States

The Helix (`helix.ts`) scores text on two strands (factual truth + felt meaning) plus valence markers. Seven states emerge, expanding the original three:

### The Three Alive States

| State | Color | Factual | Felt | Valence | Response |
|-------|-------|---------|------|---------|----------|
| **ALIVE** | #228B22 (green) | > 0.6 | > 0.6 | balanced | None needed |
| **LUMINOUS** | #FFD700 (gold) | > 0.6 | > 0.6 | transcendent | "Stay with it, keep one foot on ground" |
| **DARK** | #8B0000 (crimson) | > 0.6 | > 0.6 | negative | Counter-balance: wisdom, hope, flow |

### The Two Problematic States

| State | Color | Factual | Felt | Valence | Response |
|-------|-------|---------|------|---------|----------|
| **GREY** | #808080 | imbalanced | imbalanced | - | Nudges toward balance |
| **BLACK** | #000000 | < 0.4 | < 0.4 | - | STOP protocol, recovery |

### The Two Diagnostic States

| State | Color | Factual | Felt | Valence | Meaning |
|-------|-------|---------|------|---------|---------|
| **SILVER** | #C0C0C0 | > 0.6 | < 0.4 | - | Cold but accurate—needs warmth |
| **WHITE** | #FFFFFF | < 0.4 | > 0.6 | - | Ungrounded—needs facts |

### State Transitions

```
       ┌─────────────────────────────────────┐
       │                                     │
       ▼                                     │
   ┌───────┐    nudge    ┌───────┐    work  │
   │ BLACK │ ──────────► │ GREY  │ ────────►│
   └───────┘             └───────┘          │
       │                     │              │
       │ STOP                │ balance      │
       ▼                     ▼              │
   [recovery]            ┌───────┐          │
                         │ ALIVE │ ─────────┤
                         └───────┘          │
                             │              │
                  ┌──────────┼──────────┐   │
                  │          │          │   │
                  ▼          ▼          ▼   │
             ┌────────┐ ┌────────┐ ┌──────┐ │
             │  DARK  │ │LUMINOUS│ │SILVER│ │
             └────────┘ └────────┘ └──────┘ │
                  │          │          │   │
                  └──────────┴──────────┴───┘
```

**SILVER** and **WHITE** are diagnostic: they tell you which strand is missing. SILVER: "You have the facts but not the feeling." WHITE: "You have the feeling but not the facts."

---

## The Fire-and-Ash Integration

`fire-and-ash.ts` provides the full pipeline: graph → firmware → dialectic → helix.

```typescript
const result = await fireAndAsh.analyze(text, options);
// Returns:
// {
//   state: HelixState,        // One of seven
//   factualStrand: number,    // 0-1
//   feltStrand: number,       // 0-1
//   dialecticCycles: number,  // How many iterations
//   graphPath: string[],      // Nodes traversed
//   synthesis: string         // Final converged position
// }
```

One import. One class. One answer.

---

## The Six Equations

The mathematical relationships that constrain the graph:

### 1. Gradient Zone

```
present = 0.5
```

The present is the region where signals can move. Past is fixed (< 0.5), future is uncertain (> 0.5), present is where choice lives. The gradient zone is the region around 0.5 where signals are most plastic.

### 2. Synthesis Convergence

```
|synthesis_n - synthesis_{n-1}| < ε → terminate
```

Repeated thesis → antithesis → synthesis cycles reach a fixed point. The convergence threshold ε is configurable; lower values mean more cycles but tighter synthesis.

### 3. Strand Balance

```
alive = (factual > 0.6) ∧ (felt > 0.6)
grey = (factual > 0.6) ⊕ (felt > 0.6)  // XOR
black = (factual < 0.4) ∧ (felt < 0.4)
```

Both strands must be strong for alive. Grey occurs when one dominates. Black occurs when both fail.

### 4. Valence Interaction

```
dark = alive ∧ negative_valence
luminous = alive ∧ transcendent_markers
silver = factual_strong ∧ felt_weak
white = felt_strong ∧ factual_weak
```

Valence modifies the alive state but doesn't replace the strand requirements.

### 5. Conviction Stability

```
stability = α * history_variance + β * momentum_magnitude
update_sensitivity = 1 / (1 + conviction)
```

Signals accumulate momentum. High conviction = high stability = resistant to single-turn shifts. Low conviction = responsive to new evidence.

### 6. Navigator Bias

```
synthesis = weighted_mean(thesis, antithesis) + navigator_bias * direction
```

The human's thumb on the scale. A small bias that tilts synthesis without determining it. Configured per-partnership, updated based on feedback.

---

## Connection to Quantum Decoherence

The gradient model draws conceptual parallels to Zurek's quantum decoherence:

- **Superposition** → Multiple positions held simultaneously before synthesis
- **Decoherence** → Synthesis selects a position; other paths collapse
- **Classical state** → The converged answer; now stable, propagates forward

This is analogy, not physics. But the structure is useful: complex questions have multiple valid positions in superposition. The dialectical process is the decoherence mechanism. The synthesis is the classical state that emerges.

The analogy has predictive value: just as decoherence is faster for systems that interact more with their environment, synthesis is faster for questions that have more real-world constraints.

---

## The Three Testable Predictions

### Prediction 1: Synthesis Cycle Count Correlates With Question Complexity

Simple factual questions should resolve in 1-2 cycles. Complex philosophical questions should require 3+ cycles. The convergence pattern should be predictable from question type.

**Status**: Testable with current architecture. Preliminary data suggests correlation holds. Full measurement requires gymnasium integration.

### Prediction 2: Alive State Predicts Output Quality

Text generated during alive state should score higher on external quality metrics than text generated during grey state. The pulse reading should be predictive, not just descriptive.

**Status**: Testable with current architecture. Requires gymnasium comparison with external evaluators.

### Prediction 3: Duality Graph Constrains Hallucination

When the LLM generates dialectical responses, the graph structure should reduce nonsensical syntheses. The duality relationships impose logical constraints that pure generation doesn't have.

**Status**: Testable. Requires comparison of constrained vs unconstrained dialectic. The gymnasium provides the harness; the evaluation criteria need definition.

---

## Current Confidence Scoring

The convergence theory operates at different confidence levels:

| Component | Confidence | Evidence |
|-----------|------------|----------|
| Seven helix states | High | All states observed across 7 months, diagnostic value confirmed |
| Duality graph structure | High | Derived from philosophical traditions, stable across testing |
| Layer 0 physics modules | Medium | Architecture complete, integration tested, edge cases emerging |
| Synthesis convergence | Medium | Works in testing, cycle correlation observed but not measured |
| Navigator bias | Medium | Mechanism works, optimal bias values not calibrated |
| Quantum analogy | Low | Conceptual framework, not physics claim |
| Predictive validity | TBD | Requires gymnasium data |

The theory is honest about what's verified and what's speculative. The states and graph are solid. The predictions need data.

---

## For IT Deployers

### Quick Integration

```typescript
import { fireAndAsh } from '@keanu/convergence';

const result = await fireAndAsh.analyze(text);
console.log(result.state); // "ALIVE" | "GREY" | "BLACK" | etc.
```

### Configuration

```typescript
const config = {
  navigatorBias: 0.1,        // Human's thumb on the scale
  convergenceThreshold: 0.05, // ε for synthesis termination
  maxCycles: 10,             // Safety limit on dialectic
  llmMode: true              // Use LLM for synthesis (slower, richer)
};
```

### State Files

```
awareness/
├── duality-graph.json    # Persisted graph state
└── helix-history.jsonl   # Per-turn helix readings
```
