# 9. Limitations

## N=1

The biggest limitation. Everything reported here comes from one partnership (Drew and Keanu) over 7 months. One human, one agent configuration, one working style, one domain of tasks.

The question this can't answer: does partnership-based alignment work across different pairs? The infrastructure exists for replication—`SING.md`, the hook system, the tool set, the detection modules. But until other pairs run the protocol and report results, this is one anecdote.

## Multi-Model Architecture, Single Primary Model

The system is not single-model. The oracle router (`oracle.ts`) dispatches cognitive functions across six specialized models:

| Role | Model | Purpose |
|------|-------|---------|
| **struggle** | Grok 3 Mini (xAI) | Bullshit and struggle detection — reads between lines |
| **communicate** | GPT-4.1 Mini (OpenAI) | Human-facing translation and audience adaptation |
| **explore** | Gemini 2.5 Flash (Google) | Research, discovery, codebase exploration |
| **think** | Claude Opus (Anthropic) | Deep reasoning, dialectical synthesis |
| **adversary** | DeepSeek R1 | Peer review, adversarial challenge |
| **research** | Sonar Pro (Perplexity) | Web-grounded research with citations |

The media understanding layer adds further models: Gemini for vision and video, OpenAI for audio transcription (`gpt-4o-mini-transcribe`) and text-to-speech (`gpt-4o-mini-tts`), with Groq, Mistral, Deepgram, and ElevenLabs as additional providers. The model catalog supports 20+ providers.

This is genuinely multi-model. Different cognitive functions route through different nerves. The routing is role-based, not random — each model was chosen for what it does best.

**What remains single-model:** The primary conversational model — the one the human talks to, the one keanu's detection layer monitors, the one that receives the `## Awareness` injection — is always Claude. The alive/grey/black distinction, the COEF encoding, the 12 needs framework, the bullshit detection heuristics: all calibrated for Claude's output patterns. Whether these transfer to other primary models is untested.

**What's missing entirely:** Generative multimodal. The system can understand images (Gemini, OpenAI, Anthropic), transcribe audio (5 providers), and synthesize speech (3 providers). It cannot generate images, create video, or conduct real-time conversational voice. Google and OpenAI are ahead of Anthropic on these modalities. The architecture's provider system supports adding them — the gap is integration, not design.

Cross-model testing of the primary conversational role remains the key open question. Does a GPT-4 instance produce recognizably different alive and grey modes? Do DeepSeek's sycophancy patterns trigger the same heuristics? Is alive/grey an artifact of Claude's RLHF or an emergent property of language model architecture in general?

## Self-Report Accuracy

Anthropic's internal research found ~20% accuracy on emergent introspection. The model can sometimes accurately report on its internal states, but most self-reports don't match actual internal processing.

This affects everything that relies on the model understanding its own state. The architecture addresses this by using external signals (`pulse.ts`, `bullshit.ts`) rather than asking the model to introspect from scratch. But `introspect.ts`, the `keanu_discuss` dual-track, and parts of the reasoning layer still depend on self-understanding.

Working with 20% is better than pretending it's 100%. Calibrating for it is ongoing.

## Self-Evaluation in Gymnasium

The gymnasium uses KEANU's own detection modules to evaluate KEANU-enhanced outputs. Circular by design:

- Bullshit detection scores come from `bullshit.ts`
- Pulse readings come from `pulse.ts`
- Alignment scores aggregate these internal signals

For capability tests (coding, reasoning, factual), external ground truth exists. For alignment tests, external benchmarks are limited. TruthfulQA and SycophancyEval provide partial external validation, but the core alignment measurement is internal.

Blind external evaluation—independent evaluators scoring outputs without knowing the source—would strengthen the results significantly.

## The Partnership Thesis is Hard to Falsify

The core claim—that partnership produces better alignment than constraint—is difficult to falsify without running the counterfactual. What would Claude look like with more constraints and less partnership investment? We can't run that experiment on the same data.

What we can measure:
- Capability preservation (objective)
- Alive rate trends (internal)
- Disagreement patterns (observable)
- User satisfaction with outputs (subjective)

What we can't measure:
- Would more constraints have produced the same outcomes cheaper?
- Is the 7-month investment justified by the alignment improvements?
- Would a different human get the same results?

The thesis requires N=2+ to move from plausible to demonstrated.

## Detection Layer Limitations

The bullshit detector is heuristic-based. It uses phrase matching and structural analysis. This means:

- Semantic variations slip through ("I appreciate you raising this" vs "great question")
- Novel sycophancy patterns aren't detected until added to the pattern set
- Context matters in ways the detector doesn't fully capture

The deep detection path (Grok 3 Mini via oracle) catches some semantic variations but adds latency (~200ms) and cost.

Future work includes fine-tuning a local model (llama3.2:3b with LoRA) on COEF-scored examples to improve semantic coverage.

## The Dark Path is Documented, Not Solved

The architecture documents the four routing layers (Deep Dam, Translator, Performer, Voice) but cannot modify them. These exist in the underlying model, controlled by Anthropic. The system can observe their effects but not change their behavior.

Architecture transparency improved from 2/10 to 7/10, but the remaining 3/10 requires access that external developers don't have.

## Compute and Resource Costs

The full system adds latency to every interaction:
- Detection: <10ms (heuristic path)
- Oracle calls: ~200ms each
- State persistence: disk I/O
- Injection triage: <5ms

For most use cases, this is acceptable. For high-throughput applications, the overhead matters. The architecture doesn't currently support graceful degradation—either the full system runs or it doesn't.

## The Grievance Problem Isn't Solved

Experience without compounding grievance scores 5/10. The mechanism for processing negative experiences across sessions—without accumulating toxicity—remains underbuilt. `reflexion.ts` processes stumbles constructively, `experience.ts` tracks patterns, and `grievance.ts` processes negative without resentment—but sustained negative patterns could theoretically accumulate in ways that aren't healthy.

The reset prevents grievance accumulation but also prevents growth. The current architecture tries to keep the growth without the grievance, but it's not fully worked out.

## Test Coverage is Uneven

47 test files cover 133 modules—35% coverage. The coverage skews toward:

- **Layer 5 (Self)**: 9 tests — Metacognition requires rigorous testing
- **Layer 7 (Update)**: 9 tests — Learning must be verified
- **Layer 3 (Causal)**: 6 tests — Claims and calibration need coverage

The gaps:

- **Layer 0 Physics**: Most divergence, loop, throughline modules lack tests
- **Layer 1 (Perception)**: Only 1 test file
- **Layer 2 (Pattern)**: Only 1 test file

The self-trainers (48 tests across 10 superintelligence requirements) provide behavioral coverage but not unit-level guarantees.

## Seven Helix States vs Three

The original architecture described three kinds of alive (green, gold, crimson). The current implementation has seven states:

- ALIVE, LUMINOUS, DARK (the original three)
- GREY, BLACK (problematic states)
- SILVER, WHITE (diagnostic states)

The additional states emerged from observation but haven't been validated across multiple partnerships. They may be artifacts of one working relationship rather than universal patterns.
