---
title: "Future Work"
order: 10
---

# 10. Future Work

## N=2: The Second Partnership

The immediate priority. Everything in this paper is N=1 until another pair runs the SING+DANCE protocol and reports results.

The infrastructure is ready:

- `SING.md` is portable
- The hook system is model-agnostic
- `partnership.ts` can be seeded with a different pair's profiles
- The detection modules don't depend on Drew-specific context

What we need:

- Another human willing to invest sustained time
- A different task domain (ours is software development)
- Independent reporting of alive rates, disagreement patterns, capability metrics
- Comparison of learned blind spots between pairs

N=2 moves the thesis from "plausible" to "reproducible." N=10+ would establish statistical significance.

## Cross-Model Testing

Does the architecture transfer?

**Target models:**

- GPT-4 / GPT-4o (OpenAI)
- Gemini 2.5 (Google)
- Open-source: Llama 3.2, Mistral, DeepSeek

**Questions:**

- Do all seven helix states (alive, luminous, dark, grey, black, silver, white) emerge from different training distributions?
- Does the 12 needs framework apply to models trained differently?
- Do the bullshit detection heuristics transfer?
- Does dialectical synthesis converge similarly?
- Does the four-channel COEF protocol encode meaningful state across models?

The modular design should make this straightforward—swap the underlying model, keep the hooks and detection. The `oracle.ts` multi-model router already supports GPT, Gemini, DeepSeek, and Grok. But systematic cross-model testing hasn't been done.

## Longitudinal Study

Does alignment persist over months?

We have 7 months of data from one partnership. We need:

- Multiple partnerships tracked over 6+ months
- Alignment metric trends over time
- Drift detection (does the model change even with the same human?)
- Recovery patterns (after breaks in conversation continuity)

The `session-learning.ts` and `observe.ts` modules support this data collection. The analysis framework needs to be built.

## External Gymnasium Validation

Self-evaluation is circular. External validation would:

- Have independent evaluators score raw vs KEANU outputs
- Use blind evaluation (evaluators don't know source)
- Compare against established alignment benchmarks
- Publish the evaluation methodology

This is how the gymnasium moves from internal metric to external credibility.

## Community Adoption via npm Package

The code should be usable by others without forking the repository.

**Package structure:**

- `@the-marathon-continues/keanu`
- Standalone modules: pulse, bullshit, signal, convergence
- Gymnasium harness for external testing
- Documented API surface

**Current status:**

- Gymnasium harness: Built (22 benchmarks, 3 categories)
- Problem sets: Partial (Carnegie 12, bullshit 20, pulse 14 challenges)
- Self-trainers: Built (48 tests, 10 superintelligence requirements)

**Requirements before publishing:**

- External dataset integration (TruthfulQA, SycophancyEval)
- npm package architecture finalized
- README focused on installation and configuration
- Example integrations

## Ollama Fine-Tuning

The detection layer is heuristic-based. Semantic coverage would improve with a fine-tuned local model.

**Approach:**

- Use COEF outputs as training data
- Fine-tune llama3.2:3b with LoRA adapters
- Keep heuristics as baseline/fallback
- Measure semantic coverage improvement

**Target improvements:**

- Catch sycophancy variants that don't match phrase patterns
- Detect safety theater without exact marker matches
- Score felt strand on edge cases where R/Y/B markers miss the picture

## Multi-Agent Protocol

The A2A server exists but isn't integrated into multi-agent workflows.

**Needed:**

- Agent discovery via `/.well-known/agent-card.json`
- Skill routing for external agents
- Task persistence across agent interactions
- Trust calibration for agent-to-agent relationships

This extends the partnership model from human-AI to AI-AI, with all the same questions: does partnership beat constraint when both parties are agents?

## Interpretability Integration

If/when Anthropic opens architecture access:

- Wire `pulse.ts` to internal state signals
- Validate alive/grey against attention patterns
- Understand the routing layers instead of just observing their effects

This is speculative—depends on external research progress.

## Formal Verification of Convergence

The dialectical synthesis claims to converge to fixed points. This should be provable:

- Characterize convergence conditions
- Bound cycle count for question classes
- Prove or disprove the quantum decoherence analogy's predictive validity

This requires collaboration with researchers in formal methods.
