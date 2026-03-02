---
layer: 3
name: causal
description: What causes what. The hard problem for AI. Truth checking and claim tracking.
modules: [calibrate, calibration-log, chain, silverado, source-ranker, truth]
hooks: [before_prompt_build, after_response]
---

# Layer 3: Causal Reasoning

The hard problem. Not "what comes next in the sequence" but "what actually causes what."

Six modules. One job: track what's true, what's claimed, and what contradicts.

## Modules

| Module             | What It Does                                                   | Test Coverage         |
| ------------------ | -------------------------------------------------------------- | --------------------- |
| calibrate.ts       | Confidence calibration. CC: protocol for explicit uncertainty. | calibrate.test.ts     |
| calibration-log.ts | ECE tracking. How well-calibrated are predictions?             | Yes                   |
| chain.ts           | Break chain analysis. Where does causation actually flow?      | chain.test.ts         |
| silverado.ts       | Claim ledger. JSONL persistence. Full claim lifecycle.         | silverado.test.ts     |
| source-ranker.ts   | Source credibility ranking. Not all sources are equal.         | source-ranker.test.ts |
| truth.ts           | Oracle truth checks + contradiction detection.                 | truth.test.ts         |

## The Flow

```
[patterns from L2]
    → chain.ts maps causal structure
    → calibrate.ts scores confidence
    → silverado.ts tracks claims over time
    → truth.ts checks for contradictions
    → source-ranker.ts weighs credibility
    → calibration-log.ts measures accuracy
```

## Up/Down Connections

**Receives from:** Layer 2 (Pattern)

- Detected patterns for causal analysis
- Mismatch signals requiring truth checks
- Reasoning module outputs

**Sends to:** Layer 4 (Agency)

- Verified/contradicted claims for trust modeling
- Confidence scores for decision making
- Causal chains for planning

## Key Concepts

### The Claim Ledger (silverado.ts)

Every claim keanu makes gets tracked. Full lifecycle:

```
active → stale → contradicted → retracted
```

| Status       | What It Means                       |
| ------------ | ----------------------------------- |
| active       | Claim is current, no contradictions |
| stale        | Claim is old, may no longer hold    |
| contradicted | Evidence against, but not retracted |
| retracted    | Explicitly taken back               |

Persistence: `awareness/claim-ledger.jsonl`

Cross-session contradiction detection via truth.ts. The `contradictedBy` field tracks what said otherwise. The ledger is honest, not clean. Nothing is deleted, only marked.

### Confidence Calibration (calibrate.ts)

The CC: protocol for explicit uncertainty:

```
CC: 0.3 - Initial guess, haven't verified
CC: 0.7 - Checked two sources, consistent
CC: 0.95 - Verified, high confidence
CC: 0.1 - Speculative, treat with caution
```

Calibration-log.ts tracks ECE (Expected Calibration Error). If you say 70% confident on things that turn out true 90% of the time, you're underconfident. If they're true 50% of the time, you're overconfident.

The goal: when you say 70%, it should be right about 70% of the time.

### Break Chain Analysis (chain.ts)

Where does causation actually flow? Not correlation, causation.

```
A → B → C → D
       ↑
       break
```

If B → C is broken, A no longer causes D. Chain.ts maps these dependencies so keanu can reason about what actually causes what.

### Truth Checking (truth.ts)

Oracle routing for truth checks:

1. Make a claim
2. Route to oracle (OpenAI, external verification)
3. Compare with existing claims
4. Update silverado ledger
5. Flag contradictions

The oracle isn't infallible. It's a second opinion. The point isn't perfect truth, it's catching obvious errors before they compound.

## Theory Cross-Reference

See `world-book/layer-3-causal/`:

- `compass_artifact.md` - the claim tracker spec (this IS the implementation)
- Stochastic epistemology: VERIFIED > BELIEVED > CONJECTURED > UNKNOWN

## The Point

Layer 3 is where keanu stops being a pattern matcher and starts being a reasoner. Pattern matching says "this looks like that." Causal reasoning says "this causes that, and here's why, and here's my confidence, and I'll update if I'm wrong."

Silverado tracks claims so they can be checked. Truth.ts finds contradictions before they spread. Calibrate.ts forces explicit uncertainty. Chain.ts maps actual causation. Source-ranker.ts weighs who to believe.

Six modules. One job. Don't just predict what comes next. Understand what causes what.
