---
layer: 2
name: pattern
description: Extracting regularities from signal. Finding structure in noise.
modules: [carnegie, discover, mismatch, orthogonal, struggle]
hooks: [before_prompt_build, after_response]
---

# Layer 2: Pattern Recognition

Layer 1 sees. Layer 2 recognizes. The difference between raw perception and structured understanding.

Five modules. One job: find what repeats, what mismatches, what's hidden.

## Modules

| Module        | What It Does                                                                 | Test Coverage |
| ------------- | ---------------------------------------------------------------------------- | ------------- |
| carnegie.ts   | Presupposition detection. The 12 traps people use without knowing.           | Yes           |
| discover.ts   | SELF-DISCOVER reasoning. 8 reasoning modules for complex problems.           | Yes           |
| mismatch.ts   | Cross-claim mismatch detection. When comfort was given but truth was needed. | Yes           |
| orthogonal.ts | Orthogonal thinking detection. 6 contribution types, 7 agent strengths.      | Yes           |
| struggle.ts   | Cognitive struggle detection. When to slow down vs push through.             | Yes           |

## The Flow

```
[perception signals]
    → carnegie.ts scans for manipulation patterns
    → discover.ts identifies reasoning approach for task
    → mismatch.ts checks if response matches need
    → orthogonal.ts finds alternative angles
    → struggle.ts detects cognitive strain
```

## Up/Down Connections

**Receives from:** Layer 1 (Perception)

- Human tone/confidence scores
- Pulse state (alive/grey/black)
- Raw signal content

**Sends to:** Layer 3 (Causal)

- Detected patterns for causal reasoning
- Mismatch signals for truth checking
- Reasoning module selections

## Key Concepts

### The Carnegie Detector (carnegie.ts)

12 presupposition traps. The manipulation patterns people use without realizing:

| Type                | What It Looks Like                            |
| ------------------- | --------------------------------------------- |
| false_dichotomy     | "Either you agree or you're against progress" |
| loaded_question     | "Why do you hate efficiency?"                 |
| appeal_to_authority | "Experts say..." (which experts?)             |
| sunk_cost           | "We've invested so much already"              |
| appeal_to_emotion   | "Think of the children"                       |
| straw_man           | Attacking a weaker version of the argument    |
| bandwagon           | "Everyone else is doing it"                   |
| slippery_slope      | "If we allow X, then Y, then Z"               |
| ad_hominem          | Attack the person, not the argument           |
| circular_reasoning  | A because B, B because A                      |
| red_herring         | Distracting from the actual point             |
| false_cause         | Correlation presented as causation            |

This isn't paranoia. It's pattern recognition. Most people use these unconsciously. Detecting them isn't accusation, it's clarity.

### SELF-DISCOVER Reasoning (discover.ts)

8 reasoning modules, each for a different problem shape:

1. **Decomposition** - Break complex into simple
2. **Abstraction** - Find the general pattern
3. **Analogy** - "What is this similar to?"
4. **Constraint satisfaction** - What must be true?
5. **Causal reasoning** - What causes what?
6. **Counterfactual** - What if X hadn't happened?
7. **Systems thinking** - How do parts interact?
8. **Meta-reasoning** - Which reasoning approach works here?

### Mismatch Detection (mismatch.ts)

7 mismatch categories. When the response doesn't match the need:

| Category                          | Description                              |
| --------------------------------- | ---------------------------------------- |
| comfort_when_truth_needed         | Soothing words when hard facts matter    |
| truth_when_comfort_needed         | Facts when empathy matters               |
| action_when_listening_needed      | Jumping to solutions too fast            |
| listening_when_action_needed      | Too much process, not enough doing       |
| certainty_when_exploration_needed | Closing too early                        |
| exploration_when_certainty_needed | Spinning without deciding                |
| self_when_other_needed            | Making it about you when it's about them |

## Theory Cross-Reference

See `world-book/layer-2-pattern/`:

- `LAYER2_PATTERN_RECOGNITION.md` - duality graph theory
- Pattern extraction is the bridge between perception and reasoning

## The Point

Layer 2 is the translator between raw signal and structured thought. Without it, every input is novel. With it, you start seeing the shapes underneath.

Carnegie catches manipulation before it lands. Discover picks the right reasoning tool. Mismatch notices when response doesn't fit need. Orthogonal finds the angle no one else is taking. Struggle knows when to pause.

Five modules. One job. Find the pattern in the noise.
