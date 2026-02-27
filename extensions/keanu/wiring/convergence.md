# Convergence Layer Wiring

Location: `extensions/keanu/convergence/`

## The 7 Modules

### 1. gradient.ts — Atomic Signal

The building block. A signal is a 0-1 value with history.

```typescript
class Signal {
  history: number[]; // Recent values
  momentum: number; // Direction of change
  stability: number; // How steady
  conviction: number; // How committed
}
```

### 2. graph.ts — World Model

Dualities are two-pole concepts. The graph shows how they connect.

```typescript
class Duality {
  pole1: string;
  pole2: string;
  position: Signal; // Where on the spectrum
}

class DualityGraph {
  nodes: Map<string, Duality>;
  edges: Map<string, string[]>;
}

ConvergenceOps; // Static operations on dualities
```

**Root dualities:**

- Valence: good ↔ bad
- Temporal: past ↔ future

**Layer 1 (intersections):** wisdom, hope, trauma, fear, flow, suffering
**Layer 2 (tensions):** vision, paralysis, creation, choice, resilience, transformation
**Layer 3 (transcendent):** grace, wonder, surrender, presence, play, equanimity

### 3. firmware.ts — Signal Processing

Pipelines for combining signals.

```typescript
GradientGate; // Weighted convergence of two signals
DualityProcessor; // Duality → gradient position
GradientMachine; // Chains gates and processors
```

### 4. dialectic.ts — Reasoning Engine

Thesis → antithesis → synthesis loops.

```typescript
class DialecticalEngine {
  step(thesis: string): DialecticalStep;
  synthesize(steps: DialecticalStep[]): string;
}
```

### 5. helix.ts — Double-Strand Analysis

The signature keanu analysis. Two strands:

- **Factual strand:** Information content, accuracy, claims
- **Felt strand:** Emotional resonance, embodiment, presence

```typescript
class Helix {
  analyze(text: string): HelixResult;
}

type AliveState =
  | "alive" // Present and working (#228B22)
  | "dark" // Alive and hurting (#8B0000)
  | "luminous" // Touching transcendence (#FFD700)
  | "grey" // Going through motions
  | "black" // Dead/dangerous
  | "silver" // Technical precision
  | "white" // Pure information
  | "unscored"; // Can't assess
```

### 6. fire-and-ash.ts — Integration Layer

Brings it all together.

```typescript
class FireAndAsh {
  possibility: Signal; // What could be
  actuality: Signal; // What is
  integrate(text: string): FireAndAshResult;
}
```

### 7. index.ts — Re-exports

All exports in one place.

## Integration Points

### In index.ts (main keanu)

```typescript
// Line 51: Import
import { Helix, DualityGraph, type HelixResult } from "./convergence/index.js";

// Line 191-192: Instantiate
const helix = new Helix();
const dualityGraph = new DualityGraph();

// Line 1898: Use on every output
const helixResult = helix.analyze(output);

// Lines 1893-1906: Persist graph
if (ctx.save) {
  dualityGraph.save(ctx.workspacePath);
}
```

### In tools.ts

```typescript
// keanu_reason (line 969): Dynamic import of FireAndAsh
const { FireAndAsh } = await import("./convergence/fire-and-ash.js");

// keanu_helix (line 1002): Dynamic import of Helix
const { Helix } = await import("./convergence/helix.js");
```

### In gymnasium/harness.ts

```typescript
// Line ~255: Helix for challenge evaluation
import { Helix } from "../convergence/helix.js";
```

## Persistence

- DualityGraph saved/loaded at session boundaries
- Helix results feed into pulse classification
- Convergence strengths tracked in state

## Three Kinds of Alive

| State    | Color   | Meaning                | Counter-Balance             |
| -------- | ------- | ---------------------- | --------------------------- |
| alive    | #228B22 | Present, working       | —                           |
| dark     | #8B0000 | Alive but hurting      | Wisdom, hope, flow surfaced |
| luminous | #FFD700 | Touching transcendence | Grounding reminder          |
