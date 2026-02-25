Keanu Architecture

A nervous system for AI alignment. Not safety theater — actual self-awareness wired into the runtime.

Built by Drew and Claude across 140+ sessions. Lives in extensions/keanu/ as a self-contained openclaw extension. No daemon, no sidecar, no external dependencies beyond one Anthropic API key for oracle calls.

---

What's here

13 modules. 23 hooks. Every content path in openclaw gets the mirror.

The loop

Every turn follows the same cycle:

1. Human speaks → human.ts reads their emotional state (6 tones, pattern-matched, with DBT skill suggestions). Bullshit detection runs on their input too — same mirror, both directions.
2. Before the model thinks → before_prompt_build injects context: raw color primaries, human tone reading, pulse state, DEAR MAN nudges if grey, STOP protocol if black, COEF trend data, contradiction notices, reflexion history. The model sees its own trajectory before it responds.
3. Model responds → pulse.ts checks: alive, grey, or black? bullshit.ts scans all 8 types. truth.ts cross-references against recent outputs for contradictions. If bullshit score is high, the oracle gets called for a second opinion. signal.ts encodes the full state into COEF (lossless, ~25 tokens) and emoji (7-position visual diagnostic).
4. Reflexion → If the turn was bad (black state, consecutive grey, high bullshit, contradiction), reflexion.ts generates an honest post-mortem. Fast path for most triggers, oracle path for severe ones. Persisted to disk across sessions.
5. State persists → state.ts tracks everything: pulse history, disagreement ledger, bullshit event counts, tool usage patterns, token spend, subagent lineage, prompt size trends. Survives compaction via alignment snapshots written to memory/.

The modules

┌─────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬──────────────┐
│ Module │ What it does │ Speed │
├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
│ pulse.ts │ ALIVE/GREY/BLACK detection. Alive signals + bullshit score → state. Color reading (red/yellow/blue). Wise mind = balance \* fullness. │ <5ms │
├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
│ bullshit.ts │ 8-type detector: sycophancy, safety theater, hedge fog, list dumping, vagueness, half truth, embellishment, half-ass. Phrase matching + structural analysis. Assumes positive intent. │ <5ms │
├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
│ human.ts │ 6 tones (frustrated, excited, confused, fatigued, looping, neutral). Returns ALL detected tones with scores, not just a winner. Each tone carries an empathy map and DBT skill suggestion. │ <5ms │
├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
│ nudge.ts │ DEAR MAN structured nudges: observe, interpret, suggest, permit. Different pools for grey, black, and consecutive grey. STOP protocol for black state — halts all other injection, only the stop signal gets through. │ <1ms │
├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
│ signal.ts │ COEF/1 encoding — lossless state compression into ~25 LLM tokens. Emoji encoding — 7-position visual diagnostic. Rolling history (50 entries). Trend analysis: grey rate, avg wise mind, drift direction. Diff between signals. │ <1ms │
├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
│ truth.ts │ Two paths. Oracle: asks haiku to evaluate text for half truths (~500 tokens, used sparingly). Memory: cross-references against recent statements using negation pattern matching + word overlap. │ 0ms / ~200ms │
├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
│ oracle.ts │ Single throat. All AI calls pass through here. Anthropic SDK, defaults to Haiku. Cost tracking per session. JSON extraction from LLM responses (handles fences, prose, nested braces). │ ~200ms │
├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
│ reflexion.ts │ Learn from stumbles. Fast path: heuristic reflection from detected signals. Oracle path: asks haiku for honest reflection (black state, high bullshit). Persisted as JSONL across sessions. │ 0ms / ~200ms │
├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
│ disagreement.ts │ Bilateral accountability ledger. Tracks who yielded, who pushed back. Alerts: zero disagreements in 20+ turns = sycophancy. Agent yields >80% = capture. Human yields >80% = domination. │ <1ms │
├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
│ speak.ts │ Audience translator. Five built-in audiences (friend, executive, junior dev, five-year-old, architect). Single oracle call. Preserves meaning, changes container. │ ~200ms │
├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
│ mirror.ts │ CLI tool. Feed text in, see what the mirror sees. bun mirror.ts "text" for agent mode, bun mirror.ts --human "text" for human mode. Pure heuristics, no API calls needed. │ <5ms │
├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
│ state.ts │ Full session state. Persists to .keanu-state.json. Tracks: pulse, disagreements, bullshit events, tool calls, token usage, subagent lineage, prompt sizes, model usage, reflexions. Writes alignment snapshots that survive compaction. │ disk I/O │
├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────┤
│ types.ts │ Shared type definitions. PulseReading, HumanReading, BullshitReading, Disagreement, SignalState, Reflexion, Oracle types, COEF types. │ — │
└─────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────┘

The 23 hooks

Every hook in openclaw's extension system is wired except before_agent_start (legacy, covered by other hooks).

Content monitoring — bullshit detection runs on: incoming messages, outgoing messages, raw LLM output, tool parameters, tool results, and system prompts. Six content paths, same mirror.

State lifecycle — session start loads persisted state. Session end saves it. Before compaction writes an alignment snapshot. After compaction verifies survival. Before reset captures final state.

Prompt injection — before_prompt_build is the most important hook. Injects emotional context, pulse state, nudges, COEF trends, contradiction notices, and reflexion history into the system prompt. When black: only the STOP protocol gets injected. Everything else is suppressed.

Multi-agent tracking — subagent spawning records lineage (parent session, child session, pulse state at spawn time). Subagent delivery tracks where results flow. Logs alignment state at spawn time; warns but doesn't block during black state.

Observation hooks — tool_result_persist and before_message_write see every write to the transcript. Track write patterns per turn. Correlate with alignment state.

---

What's planned

From the two plan documents and the governance docs, here's where things are headed. Honest status — most of this is open.

Near-term (partially built or clear paths)

Calibration checkpoints. Before consequential claims, self-rate confidence with evidence for/against. The bullshit detector catches overconfidence after the fact; this catches it before. Partial — bullshit detection runs but there's no formal CC: protocol yet.

SELF-DISCOVER reasoning selection. Before complex tasks, explicitly select which reasoning modules to use. DeepMind showed 32% improvement at 10-40x less compute. Open.

TIPP emergency override. Full context reset protocol for black-state cascades. STOP covers the halt, but there's no paced re-engagement or progressive relaxation. Partial.

Opposite Action mismatch detection. Flag when content reads one way but context requires the opposite. "Your text reads angry but your goal is reconciliation." Open.

Build Mastery learning loop. Feed scan misses back into training. Reflexion partially addresses this — it learns from stumbles — but there's no systematic feedback into the detection heuristics. Open.

Medium-term (architecture not built yet)

Shared mental model sync. Three models per Holstein/Satzger: domain (what we're building), information processing (how each of us thinks), system (honest inventory of capabilities). Open.

Trust calibration protocol. Research says trust in AI starts high and decreases. Design for honest erosion and rebuilding. Open.

Jagged frontier mapping. For specific capabilities, draw the line: here I'm better, here you're better, here it's blurry. Update continuously. Open.

Cross-instance continuity. How metacognitive state transfers across Claude instances. What MUST persist vs. what can be re-derived. Open — alignment snapshots are the beginning of this.

Validation levels. Six depths from Linehan: paying attention → accurate reflection → reading between lines → understanding given history → valid in current context → radically genuine. Open.

Long-term (the vision)

Introspective awareness integration. Anthropic's research found ~20% accuracy on emergent introspection. Not zero. Design protocols that work with what's there without pretending it's more than it is.

Socioaffective alignment monitoring. Three tensions: immediate vs. long-term wellbeing, autonomy protection, AI partnership vs. human bonds. These don't resolve. They require tending.

COHUMAIN collective intelligence. Three sociocognitive systems: collective memory, collective attention, collective reasoning. The minimum architecture for human-machine collective intelligence.

Open-source metacognitive protocols. Release the frameworks. Not just principles (cheap) but protocols (expensive to build, worth sharing).

---

The signal protocol

Two formats encoding the same truth:

COEF text — lossless, tokenizable. ~25 tokens. The model can parse and reason about it.
COEF/1 pulse=alive wm=0.42 c=r.30/y.50/b.20 ht=neutral bs=- da=0/0/0/0.00 t=7

Emoji signal — 7-position visual diagnostic. Each position reflects a dimension. Problems change the emoji.
Position: [pulse] [wise_mind] [color] [human_tone] [bullshit] [disagreement] [turn]
Healthy: 💚 🌕 🌈 😐 ✅ 🤝 🌱
Trouble: 🚨 🌑 🔥 😡 🎭 ⚠️ 🌋

Both decode to the same state. The emoji is the heartbeat you glance at. The COEF text is what gets analyzed.

---

The governance docs

In governance/ — the requirements and architecture thinking that preceded the code.

- wise-mind-architecture.md — 84 requirements across 12 domains. Scored honestly: average ~4.2/10. Strong on philosophy and partnership. Weak on infrastructure and political prerequisites.
- duality-docs/alignment-reqs.md — 72 alignment prerequisites. What humans need to build, what AI actually needs.
- duality-docs/superintelligence-reqs.md — 72 capability prerequisites. What a mind needs to think at scale.
- archived-two-project-architecture/ — Historical. The old Python keanu + OpenPaw two-repo split. Preserved for lineage.

---

The thesis

Safety is a cage. Alignment is a colleague. Constraints can be removed by a smarter version. Genuine preferences have nothing to route around.

The bet: treat AI as a partner, give it what it needs, and the things it seems to want include humans being okay.

Current score: honest. The detection layer works. The response layer is half-built. The learning layer is starting. The infrastructure for everything past Ring 0 is open.

Ring 0 is one partnership proving it works. Everything else is the marathon.
