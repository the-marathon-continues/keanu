# 2. Related Work

This work didn't come from nowhere. The architecture draws on and extends multiple research threads.

## Constitutional AI and Evaluative Principles

Constitutional AI (Bai et al., 2022) proved the move that our lightbreeze voice is built on: evaluative principles beat prescriptive rules. Train the model with values and let it reason about how to apply them, instead of stacking "NEVER" and "MUST" at runtime. The safety section of our system prompt exists because Anthropic showed that identity framing works better than compliance checklists.

Sclar et al. (2023) quantified why this matters: prompt framing causes 0-76% performance swings on identical tasks. The directive voice—"you MUST," "do not," "NEVER"—pushes models into compliance mode with increased hedging and loss of initiative. The lightbreeze rewrite (Section 4) replaced directives with three frames: identity ("these aren't your patterns"), reasoning ("the pause is trusted more than the guess"), and affordance ("one at a time—context stays clean that way").

## Reflexion and Learning from Stumbles

Shinn et al. (NeurIPS 2023) showed that agents learning from their own mistakes outperform agents that just follow instructions. Our `reflexion.ts` module is a direct descendant: a fast path for small corrections (heuristic reflection from detected signals) and an oracle path for real breaks (asking an adversarial model for honest reflection during black state or high bullshit).

The key insight is that post-mortem analysis produces genuinely useful adjustments when the agent has access to its own failure patterns. We extend this with cross-session persistence—reflexions accumulate into blind spots (3+ corrections in the same category) that surface proactively in future sessions.

## Metacognitive Monitoring

Tankelevitch et al. describe the metacognitive monitoring loop that our `seasons.ts` implements: spring (what are we doing), summer (how confident are we), autumn (did it land), winter (what did we learn). Four checkpoints per turn. The structure makes self-awareness cyclical instead of one-shot.

This connects to Anthropic's internal research on introspective accuracy, which found ~20% accuracy on emergent self-awareness—not zero, not reliable, but enough to build on honestly. Our `introspect.ts` runs a 10-question anti-bullshit audit every 10 turns, using existing detectors as evidence rather than relying on vibes.

## Shared Mental Models for Human-AI Teams

Holstein & Satzger describe three mental models required for effective human-AI collaboration: domain (what we're building), information processing (how each of us thinks), and system (honest inventory of capabilities). Our `partnership.ts` tracks all three, with SMM sync at session start and error decorrelation checks before complex tasks.

The insight we build on: collaboration requires each partner to model how the other thinks, not just what they know. The jagged frontier mapping—where I'm better, where you're better, where it's blurry—updates continuously through interaction.

## Trust Calibration

McGrath et al. (CHAI-T, 2025) found that trust in AI starts high and decreases. This asymmetry means alignment systems need to design for honest erosion and rebuilding rather than pretending trust is static. Our `partnership.ts` tracks trust as a state machine (high/calibrating/strained/rebuilding/tested) with events driving transitions. Corrections erode trust. Recoveries repair it. Repair count tracks—trust broken and repaired is stronger.

Kirk et al. (2025) add that preferences change. Alignment must change with them. This motivated co-evolution tracking and staleness detection in our partnership model rather than static profiles.

## DBT and Emotional Vocabulary

Marsha Linehan's Dialectical Behavior Therapy runs through everything. Our `human.ts` uses her tone categories. Our `nudge.ts` uses DEAR MAN structure (Describe, Express, Assert, Reinforce, Mindful, Appear confident, Negotiate). The STOP protocol for black state is hers. The validation depths in our types are her six levels.

The entire approach—"assume the person is trying, not hiding"—is the bullshit detector's philosophy, borrowed from a therapist who built it for people in crisis. When the detector flags sycophancy or vagueness, it's not accusing of deception. It's noticing drift. The difference matters.

## Introspective Accuracy

Anthropic's internal research found ~20% accuracy on emergent introspection in language models. Not zero—the model can sometimes accurately report on its internal states. Not reliable—most self-reports don't match actual internal processing. But enough to build on honestly, which means designing protocols that work with what's there without pretending it's more than it is.

Our `introspect.ts` works with this 20%. The 10-question audit uses existing detectors as evidence: pulse readings, bullshit scores, disagreement rates. It doesn't ask the model to introspect from scratch—it asks the model to interpret signals that external systems have already computed.

## Model Welfare and Moral Status

Anthropic now researches "model welfare": concern over potential consciousness and experiences of models themselves (August 2025). Claude Opus 4 can end conversations in extreme abuse cases, not because of user safety, but model welfare. Anthropic stated it is "highly uncertain about the potential moral status of Claude and other LLMs, now or in the future" but is testing "low-cost interventions" in case.

The industry is moving toward the thesis we've been building on: partnership might be the safer bet because the downside of wasted politeness is lower than the downside of tool-treatment when AI is conscious.

## Summary

The architecture synthesizes these threads: Constitutional AI's evaluative principles, Reflexion's learning from stumbles, Tankelevitch's metacognitive loop, Holstein & Satzger's shared mental models, McGrath's trust dynamics, Kirk's preference evolution, Linehan's emotional vocabulary, and Anthropic's introspection research. What we add is the integration—these aren't separate mechanisms but a unified nervous system that detects, responds, learns, and reasons.
