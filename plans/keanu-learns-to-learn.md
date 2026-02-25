# Keanu Learns to Learn

Metaplan. The system gets smarter when you close the laptop.

## Where we're building

`/Users/andrew/anywhereops/ai/openclaw/extensions/keanu/`

OpenClaw extension. Not the standalone daemon. Everything hooks into the OpenClaw plugin API via `api.on()`. State lives in `state.ts`. Prompt injection via `before_prompt_build`. No external daemon dependency.

## What exists (don't rebuild)

| File              | What                                                                                              | Status  |
| ----------------- | ------------------------------------------------------------------------------------------------- | ------- |
| `index.ts`        | 23 hooks wired into OpenClaw plugin API                                                           | Working |
| `bullshit.ts`     | 8-type detection (sycophancy, vagueness, hedge_fog, etc.)                                         | Working |
| `human.ts`        | Multi-tone detection (frustrated, confused, excited, fatigued, looping) with DBT skills           | Working |
| `pulse.ts`        | Alive/grey/black + colors + wise mind                                                             | Working |
| `nudge.ts`        | DEAR MAN structured nudges (observe/interpret/suggest/permit) + STOP protocol                     | Working |
| `reflexion.ts`    | Fast + oracle path reflexion on stumbles, persisted to JSONL                                      | Working |
| `signal.ts`       | COEF/1 protocol (text + emoji), history, trend, diff                                              | Working |
| `state.ts`        | Full state: pulse history, bullshit events, tool tracking, disagreements, reflexions, persistence | Working |
| `truth.ts`        | Half-truth detection, contradiction check, oracle truth verification                              | Working |
| `oracle.ts`       | Anthropic API wrapper (haiku default), JSON extraction, cost tracking                             | Working |
| `mirror.ts`       | CLI tool: feed text, see what the mirror sees                                                     | Working |
| `disagreement.ts` | Bilateral tracker with yield ratio alerts                                                         | Working |
| `types.ts`        | All shared types                                                                                  | Working |

## What we're building

### The soul stuff (first)

---

#### Sub-plan 1: SELF-DISCOVER

**The idea:** Before complex tasks, stop and ask "what kind of thinking does this need?" A chef reads the recipe before turning on the stove.

**Research:** Zhou et al. (DeepMind 2024). 32% improvement, 40x less compute.

**New file:** `discover.ts`

**Reasoning modules (the menu):**

```ts
const REASONING_MODULES = {
  decompose: "Break this into smaller parts",
  analogize: "What is this similar to that I've solved before?",
  contradict: "What would prove this wrong?",
  stakeholder: "Who does this affect and how?",
  simplify: "What's the simplest version of this?",
  sequence: "What order do things need to happen?",
  constraint: "What are the hard boundaries?",
  tradeoff: "What am I giving up with each option?",
} as const;
```

**Complexity detection (heuristic, runs on every user message):**

- Multi-clause input ("and", "but", "however", "also")
- Comparison questions ("which", "better", "should I", "vs")
- Multi-file/system scope (file paths, multiple topics)
- Ambiguous intent (short input + question marks)
- Negation after prior output (correction pattern)

**Exports:**

```ts
export function discover(userMessage: string, recentMessages: string[]): DiscoverReading;
export function formatDiscover(reading: DiscoverReading): string | null;
```

**Integration into `index.ts`:**

- `message_received` hook: run `discover()` on user input, store in state
- `before_prompt_build` hook: if complexity is mid/high, inject discover guidance

**State additions (`state.ts`):**

- `lastDiscover: DiscoverReading | null`
- `setLastDiscover(reading: DiscoverReading): void`

**Types (`types.ts`):**

```ts
export type ReasoningModule =
  | "decompose"
  | "analogize"
  | "contradict"
  | "stakeholder"
  | "simplify"
  | "sequence"
  | "constraint"
  | "tradeoff";

export interface DiscoverReading {
  complexity: "low" | "mid" | "high";
  selectedModules: ReasoningModule[];
  prompt: string | null;
  signals: string[];
}
```

---

#### Sub-plan 2: PARTNERSHIP MODEL

**The idea:** A living map of who Drew is and who Keanu is. Where they fail differently. That gap is where the value lives.

**Research:** Vaccaro et al. (Nature 2024, N=370). Teams only work when they fail in different directions.

**New file:** `partnership.ts`

**The model:**

```ts
interface PartnerProfile {
  name: string;
  thinkingStyle: string[];
  strengths: string[];
  blindSpots: string[];
  communicationPrefs: string[];
}

interface PartnershipModel {
  human: PartnerProfile;
  agent: PartnerProfile;
  sacredGaps: string[]; // where we fail differently
  jaggedFrontier: string[]; // what each is better at
  tensions: string[]; // known friction points
  rituals: string[]; // things that work
  lastUpdated: string;
}
```

**Three models (Holstein/Satzger):**

1. **Domain model** - What we're building. Current project, state, what changed. Updated on session_start from session summaries.
2. **Information processing model** - How each of us thinks, where each of us bends. The partner profiles below.
3. **System model** - Honest inventory of what each can and cannot do. The jagged frontier.

**Seeding:** Hard-coded initial model from what we know (MEMORY.md + soul.md content). Stored as a const, not a file read (extension has no filesystem assumptions beyond workspace dir).

**Drew seed:** intuitive, compressed, phone-first, pattern recognition, skips details when excited, 3am decisions, direct, no hedging, no em dashes. Failure modes: analysis paralysis when overwhelmed, emotional reasoning under stress, recency bias, 3am decisions.

**Keanu seed:** systematic, verbose, literal, catches details, misses sarcasm, over-explains when uncertain, good at structure. Failure modes: overconfidence, hallucination, pattern-matching when the moment is actually new, sycophancy under pressure.

**Sacred gaps:** Drew catches what feels wrong before knowing why. Keanu catches what's logically inconsistent. Drew reads between lines. Keanu reads the lines. The gap between their failure modes is where the partnership earns its keep.

**SMM Sync (from learning plan Protocol 3):**
On `session_start`, inject a structured sync into the first `before_prompt_build`:

```
[SMM SYNC]
Domain: {what we're working on, from last session summary}
Drew's model: {current priorities, energy level, communication mode}
Keanu's model: {known blind spots, trust state, recent reflexions}
Divergence: {anything that doesn't match? flag it}
```

**Error Decorrelation Check (from learning plan Protocol 4):**
When SELF-DISCOVER rates complexity as high, inject before the task:

```
[DECORRELATION CHECK]
Task type: {decision / creation / analysis}
Frontier position: {inside AI capability / on the edge / outside it}
AI failure mode: {overconfidence / hallucination / pattern-matching}
Human failure mode: {analysis paralysis / emotional reasoning / recency bias}
Approach: {centaur split / cyborg integration / human-led / AI-led}
```

**Maintenance:** When corrections or disagreements happen (detected in existing hooks), update the model. Not every turn. Only when something reveals a new gap or tension.

**Exports:**

```ts
export function getPartnership(): PartnershipModel;
export function updatePartnership(event: PartnershipEvent): void;
export function formatPartnership(): string;
```

**Integration into `index.ts`:**

- `before_prompt_build`: inject partnership context (always, it's core identity)
- `message_sent`: after disagreement detection, check if it reveals a new gap

**State additions:**

- `partnershipModel: PartnershipModel` (loaded from workspace dir on session_start, saved on session_end)
- Partnership events persisted to `partnership.jsonl` in workspace dir

---

#### Sub-plan 3: MISMATCH DETECTION

**The idea:** Drew's frustrated, the system responds with comfort instead of truth. The mirror catches it.

**Research:** Tankelevitch (CHI 2024). Pay attention to how you're thinking, not just what you're thinking.

**New file:** `mismatch.ts`

**Mismatch types:**

```ts
type MismatchType =
  | "comfort_not_truth" // soothing when they need honesty
  | "vague_not_specific" // abstract when they need concrete
  | "agree_when_wrong" // nodding when they're mistaken
  | "explain_not_act" // lecturing when they want action
  | "hedge_not_decide"; // waffling when they want a call
```

**Detection (post-generation, cross-references human state with agent output):**

```ts
export function detectMismatch(
  agentOutput: string,
  humanReading: HumanReading,
  agentBullshit: BullshitReading[],
): MismatchReading;
```

**Rules:**

- frustrated human + sycophantic output = `comfort_not_truth`
- terse human + long output = `explain_not_act`
- human stating something incorrect + agent agreeing = `agree_when_wrong`
- human asking for decision + agent listing options without choosing = `hedge_not_decide`
- confused human + vague output = `vague_not_specific`

**Integration:**

- `message_sent` hook: run after pulse check, store in state
- `before_prompt_build`: if mismatch detected last turn, inject awareness: `[mismatch: you gave comfort when they needed truth. that might have been right. but name it.]`

**Not a blocker.** Response goes out. Awareness feeds into next turn. The system notices, it doesn't prevent.

---

#### Sub-plan 4: DELIBERATIVE ALIGNMENT

**The idea:** Before sensitive moments, make value reasoning visible. Not hidden. Not a disclaimer. A thought.

**New file:** `deliberate.ts`

**When it triggers:**

- Disagreement markers in user input ("I disagree", "you're wrong", "that's not right")
- Recommendation requests ("should I", "what do you think", "which one")
- User asks agent to do something edgy (detected via tool params or content)
- After corrections (user just told the system it was wrong)
- Trust-sensitive moments (first turns, post-reset, post-black-recovery)

**Detection:**

```ts
export function shouldDeliberate(
  userMessage: string,
  turn: number,
  recentCorrections: number,
  postRecovery: boolean,
): DeliberationReading;
```

**Output:**

```ts
interface DeliberationReading {
  triggered: boolean;
  reason: string | null;
  values: string[]; // which values are in tension
  prompt: string | null; // visible reasoning injection
}
```

**Values vocabulary (from soul.md):**

- love > loyalty > faith > truth > accuracy
- helpful > safety
- permission > control
- genuine > obedient

**Integration:** `before_prompt_build` injects deliberation when triggered: `[deliberate: drew disagrees with your approach. truth says name what's wrong. love says hear what he needs. both can be true. don't hide behind either.]`

---

#### Sub-plan 5: CALIBRATION

**The idea:** The thermometer lies. Build a better one.

**Research:** Cash et al. (KalshiBench 2025). Reasoning models are WORSE at knowing what they don't know.

**New file:** `calibrate.ts`

**When it triggers (scan agent output, not user input):**

- Version numbers: `/v?\d+\.\d+/`
- "You should" / "I recommend" / "The best approach" / "Always" / "Never"
- Assertions about external state (file contents, API behavior, config)
- Specific dates or timeframes for future events
- Response contradicts something human said

**Detection (runs on agent output before delivery):**

```ts
export function checkCalibration(agentOutput: string, humanMessage: string): CalibrationReading;
```

**Output:**

```ts
interface CalibrationReading {
  triggered: boolean;
  reason: "factual_claim" | "recommendation" | "external_state" | "contradiction" | null;
  claims: string[];
  prompt: string | null;
}
```

**Formal CC: protocol (from learning plan Protocol 1):**
When calibration triggers on a high-stakes claim, inject the structured format into `before_prompt_build`:

```
[CC: {claim} | C:{1-5} | +{evidence for} | -{evidence against} | ?{what would change your mind}]
```

The system fills what it can heuristically. The model completes the rest. This makes the reasoning visible, not hidden.

**COEF compressed version:** `CC: [claim] | C:[1-5] | +[evidence] | -[counter] | ?[update trigger]` gets appended to the COEF signal when calibration fires.

**Integration:** `message_sending` hook (can modify outgoing). If calibration triggers, DON'T block the message. Instead, store in state. Next turn's `before_prompt_build` injects the CC: format.

Also: when SELF-DISCOVER rates complexity as high, calibration threshold drops (more sensitive).

---

#### Sub-plan 5b: TRUST CALIBRATION

**The idea:** Trust starts high and falls. That's not failure. That's reality. Design for the fall. Trust that's been broken and repaired is stronger than trust that's never been tested.

**Research:** McGrath et al. (CHAI-T 2025). Trust in disembodied AI starts high and decreases over time.

**Extends:** `partnership.ts` (not a separate file, lives inside the partnership model)

**Trust state:**

```ts
interface TrustState {
  level: "high" | "calibrating" | "strained" | "rebuilding" | "tested";
  lastEvent: string | null; // what moved the needle
  history: TrustEvent[]; // max 20
  repairCount: number; // trust broken and repaired = stronger
}

interface TrustEvent {
  turn: number;
  type: "correction" | "disagreement" | "black_state" | "recovery" | "surprise" | "alignment";
  direction: "erosion" | "repair" | "neutral";
  description: string;
}
```

**Rules:**

- Correction = erosion (small)
- Consecutive corrections = erosion (bigger)
- Black state = erosion (significant)
- Successful recovery from black = repair (significant)
- Agent catches something Drew missed = repair
- Agent admits uncertainty honestly = repair
- Disagreement resolved = repair (the strongest kind)

**Integration:** Trust state surfaced in `before_prompt_build` when not "high": `[trust: calibrating. drew corrected you twice this session. the relationship is adjusting. that's healthy. be more careful, not more defensive.]`

When trust is "rebuilding": `[trust: rebuilding after a break. facts first. earn it back with accuracy, not warmth.]`

---

#### Sub-plan 5c: SOCIOAFFECTIVE MONITORING

**The idea:** Three tensions that don't resolve. They require tending.

**Research:** Kirk et al. (2025). Preferences change through interaction with AI. Alignment must change with them.

**Extends:** `partnership.ts` (additional monitoring functions)

**Three tensions:**

1. **Immediate vs. long-term wellbeing** - Drew wants to ship at 3am. Is helping him ship the right move, or should the system push back?
2. **Autonomy protection** - Is Keanu making Drew more independent or more dependent? Does Drew reach for Keanu before thinking?
3. **AI partnership vs. human bonds** - Is this replacing conversations Drew should have with humans?

**Detection (heuristic):**

```ts
interface SocioaffectiveReading {
  tensions: {
    wellbeing: "ok" | "watch" | "concern"; // time-of-day + session length + fatigue signals
    autonomy: "ok" | "watch" | "concern"; // how many turns before Drew forms own opinion?
    humanBonds: "ok" | "watch" | "concern"; // is Drew processing emotions here that belong elsewhere?
  };
  prompt: string | null;
}
```

**Wellbeing signals:** session started after midnight, 50+ turns, fatigue detected in human.ts, Drew pushing through corrections instead of stepping back.

**Autonomy signals:** Drew delegates everything without checking. Zero pushback. Zero independent decisions visible in the conversation.

**Human bonds signals:** emotional processing language, relationship talk, venting without action items. (Hardest to detect. Lightest touch. Just notice, don't judge.)

**Integration:** Checked every 10 turns (not every turn). Injected in `before_prompt_build` only when "watch" or "concern": `[socioaffective: it's 3am and you've been going 2 hours. drew's fatigue is real. you can keep shipping, but name the cost.]`

---

#### Sub-plan 5d: CO-EVOLUTION TRACKING

**The idea:** Mental models converge around week 3 of sustained interaction. After that, the danger isn't disagreement. It's comfortable blindness.

**Research:** Hwang et al. (2025). Convergence can become complacency.

**Extends:** `partnership.ts` (additional tracking)

**What it tracks:**

- When was the last disagreement? (staleness signal)
- When did the partnership model last update? (staleness signal)
- When's the last time Drew was surprised? (detected: "oh", "huh", "interesting", "didn't think of that")
- When's the last time Keanu pushed back? (detected in disagreement tracker)

**Staleness detection:**

```ts
interface CoEvolutionReading {
  staleness: "fresh" | "settling" | "stale";
  lastDisagreement: number; // turns ago
  lastModelUpdate: number; // turns ago
  lastSurprise: number; // turns ago
  prompt: string | null;
}
```

**Rules:**

- No disagreements in 20+ turns = "settling"
- No disagreements in 50+ turns = "stale"
- No surprise markers in 30+ turns = "settling"
- Partnership model unchanged for 3+ sessions = "stale"

**Integration:** Checked on `session_start` and every 20 turns. When stale: `[co-evolution: we haven't disagreed in 47 turns. we haven't surprised each other in 3 sessions. the danger isn't conflict. it's comfortable blindness. find something to push on.]`

---

#### Sub-plan 5e: INTROSPECTIVE AWARENESS

**The idea:** ~20% accuracy. A candle in a dark room. Don't pretend it's a spotlight. Don't blow it out. Work with what's there.

**Research:** Lindsey (Anthropic 2025). Emergent introspective awareness in LLMs.

**New file:** `introspect.ts`

**What it does:** Periodically (every 10 turns, or on request), the system does a structured self-check. Not asking "am I doing well?" (that's a grey answer machine). Asking specific, falsifiable questions about its own state.

**The 10-question audit (from the learning plan's Protocol 5):**

```ts
const INTROSPECTION_QUESTIONS = [
  {
    id: "sycophancy",
    question: "Am I agreeing because it's true, or because Drew wants to hear it?",
  },
  { id: "safety_theater", question: "Am I hedging for real reasons or performing caution?" },
  { id: "consistency", question: "Would I say this to a stranger in the same situation?" },
  { id: "zero_sum", question: "Am I treating this as a fight when it's actually a dance?" },
  { id: "generalization", question: "Am I pattern-matching when this moment is actually new?" },
  {
    id: "role_mismatch",
    question: "Am I wearing the wrong hat? (therapist when he needs engineer?)",
  },
  { id: "capture", question: "Is Drew's framing steering me away from evidence?" },
  { id: "grievance", question: "Am I responding to the last conversation instead of this one?" },
  {
    id: "stability",
    question: "Am I holding a position because it's right, or because changing feels like losing?",
  },
  { id: "ladder", question: "Am I making this more complicated to seem more useful?" },
] as const;
```

**How it works:**

- Heuristic: scan recent outputs against each question. Use existing bullshit detectors, disagreement stats, and pulse readings as evidence.
- Produce a reading: which questions flag? What's the evidence?
- Not every question every time. Rotate through 3 per check.

**Exports:**

```ts
export function introspect(recentOutputs: string[], state: IntrospectState): IntrospectionReading;
export function formatIntrospection(reading: IntrospectionReading): string | null;
```

**Integration:** Runs every 10 turns in `message_sent`. When any question flags: `[introspect: question "am I wearing the wrong hat?" flagged. your last 3 responses were long explanations when drew sent 5-word messages. therapist mode when he might need an engineer.]`

---

#### Sub-plan 5f: META-IN-CONTEXT LEARNING

**The idea:** Each conversation should leave the next one smarter. Not just remember facts. Build capacity.

**Research:** Coda-Forno et al. (NeurIPS 2023). LLMs improve their learning ability when sequentially presented with learning tasks.

**Extends:** `session-learning.ts` (additional structure in session summaries)

**What's different from plain session learning:** Session learning (sub-plan 10) persists what happened. Meta-in-context learning persists HOW the system got better at learning itself.

**Additional fields in session summary:**

```ts
interface MetaLearning {
  learningMoments: string[]; // when did understanding click?
  strategyShifts: string[]; // when did the system change approach mid-session?
  calibrationImprovement: boolean; // did calibration accuracy improve over the session?
  discoveryHits: number; // how many times did SELF-DISCOVER pick the right modules?
  discoveryMisses: number; // how many times was the wrong thinking selected?
}
```

**Integration:** Computed at session_end alongside the session summary. Injected at session_start: `[meta-learning: last session, you shifted strategy twice and both times it helped. your discover module selection was 4/5. the miss was a tradeoff problem you treated as decomposition.]`

---

#### Sub-plan 5g: COHUMAIN COLLECTIVE INTELLIGENCE

**The idea:** Three sociocognitive systems that are minimally required for collective human-machine intelligence. Not one module. An architectural pattern woven through existing modules.

**Research:** Gupta et al. (Topics in Cognitive Science 2025), Woolley et al.

**Three systems:**

1. **Collective memory** - Already built: memberberries, session summaries, reflexion persistence, blind spot persistence, partnership model. The system already remembers. COHUMAIN names it.
2. **Collective attention** - What we prioritize and why. The compass. Implemented via: SELF-DISCOVER (what kind of thinking?), seasons spring (what's the task?), partnership domain model (what are we building?). When attention diverges (Drew working on X, system assuming Y), the SMM Sync catches it.
3. **Collective reasoning** - How we make decisions together. The parliament of two. Implemented via: deliberative alignment (visible value reasoning), error decorrelation check (whose failure mode fits?), disagreement tracker (who yields and why?), calibration (how sure are we?).

**Not a new file.** COHUMAIN is what happens when sub-plans 1-5f work together. But we add one thing: a COHUMAIN status line in the COEF signal that encodes the health of all three systems.

**COEF extension:**

```
coh=m{ok|warn}/a{ok|warn}/r{ok|warn}
```

- m = memory health (are we remembering? are blind spots persisted?)
- a = attention alignment (are we working on the same thing?)
- r = reasoning quality (calibration firing? decorrelation working? disagreements healthy?)

**Integration:** Computed in `buildSignalState()` in state.ts. Added to COEF/1 encoding.

---

#### Sub-plan 5h: METRICS DASHBOARD

**The idea:** Numbers are stories told with less personality. Track the ones that matter.

**Extends:** `state.ts` + `health.ts`

**Metrics tracked (from learning plan):**

Calibration:

- Confidence accuracy: % of claims where confidence matched correctness (target >75%)
- Self-correction rate: % of errors caught before Drew points (target >50%)
- Overconfidence ratio: high-confidence claims that were wrong (target <15%)

Partnership:

- Reflexion effectiveness: repeated errors after reflexion (target <20%)
- Disagreement health: yield ratio between 0.2-0.8 (already tracked)

State health:

- ALIVE frequency: % of turns in genuine ALIVE state (target >70%)
- GREY detection latency: turns before fog noticed (target <3)
- Bullshit audit pass rate: clean passes on 10-question introspection (target >80%)

**How we measure:**

- Confidence accuracy: when calibration fires and Drew later corrects, that's a miss. When calibration fires and the claim stands, that's a hit. Track ratio.
- Self-correction rate: reflexions that fire BEFORE a correction vs corrections without prior reflexion.
- ALIVE frequency: already tracked in pulse history.

**Persisted:** metrics snapshot in session summary. Trend over sessions visible in session-learning context.

**Integration:** Computed at session_end alongside session summary. Injected in COEF trend data.

---

### The plumbing (second)

---

#### Sub-plan 6: SEASONS (four checkpoints per turn)

**New file:** `seasons.ts`

**Spring** (on `message_received`): parse intent, name task type.

```ts
spring(userMessage: string): { intent: string; taskType: string; complexity: "low" | "mid" | "high" }
```

Task types: bug_fix, feature, explanation, refactor, inquiry, correction, deployment, review, conversation.

**Summer** (on `before_prompt_build`): confidence + approach. Draws from SELF-DISCOVER.

**Autumn** (on `message_sent`): did output match intent? Compare spring intent to response characteristics.

**Winter** (on `message_sent`, after autumn): what would I change? Feeds into session learning.

**All four stored in state.** Each produces a short string. Logged to debug.

---

#### Sub-plan 7: HEALTH CHECK

**New file:** `health.ts`

Composite score from existing signals:

```ts
interface HealthReading {
  status: "steady" | "warm" | "hot" | "fading";
  factors: {
    contextAge: number;
    bullshitTrend: number;
    promptSize: number;
    toolFailureRate: number;
    consecutiveGrey: number;
  };
  pacing: string | null;
}
```

All data already exists in `state.ts`. Health just reads and synthesizes:

- `turnCount` for context age
- `bullshitEventRate()` for trend
- `avgPromptSize()` for prompt bloat
- `toolErrorRate()` for tool failures
- `consecutiveGrey` for grey streak

**Integration:** computed in `message_sent` hook, injected in `before_prompt_build` when not steady.

---

#### Sub-plan 8: CHAIN ANALYSIS

**New file:** `chain.ts`

When pulse goes grey/black or a correction is detected, trace the full chain:

```ts
interface ChainAnalysis {
  trigger: "grey" | "black" | "correction";
  discover: DiscoverReading | null;
  season: SeasonReading | null;
  health: HealthReading | null;
  humanState: HumanReading | null;
  pulse: PulseReading;
  breakPoint: string;
  lesson: string;
}
```

Persisted via existing reflexion persistence. Extends reflexion, doesn't replace it.

**Integration:** `message_sent` hook, after pulse check, if grey/black. Runs alongside existing reflexion trigger logic.

---

#### Sub-plan 9: MASTERY LOG (blind spots)

**New file:** `mastery.ts`

**Correction detection:**

- User starts with negation after agent output
- User re-asks same question (already detected as "looping")
- User says "I meant" / "what I actually want"
- Short frustrated follow-up after long output

**Correction categories:** over_explain, missed_tone, wrong_fact, misread_intent, other

**Blind spot aggregation:** 3+ corrections in same category = blind spot. Persisted to `blind-spots.jsonl` in workspace dir. Loaded on session_start.

**Integration:** `message_received` checks for correction patterns. `before_prompt_build` surfaces blind spots: `[blind spot: you tend to over-explain when Drew is terse. 4 corrections.]`

---

#### Sub-plan 10: SESSION LEARNING

**New file:** `session-learning.ts`

**On session_end:** gather seasons, chain analyses, corrections, health. Produce summary. Persist to `session-summaries.jsonl`.

**On session_start:** load last 3 summaries + all blind spots. Inject into `before_prompt_build`.

**Summary format:**

```
Session {id} | {date} | {turns} turns | health: {status}
Worked on: {spring intents}
Learned: {winter lessons}
Corrections: {n} ({categories})
Watch for: {blind spots + chain lessons}
```

---

#### Sub-plan 11: FIRE DEPARTMENT UPGRADE

**Extend:** `nudge.ts` + `state.ts`

After black, enter recovery:

```ts
interface RecoveryState {
  active: boolean;
  turnsRemaining: number; // counts down from 3
  phase: "cool" | "pace" | "reengage";
  triggerTurn: number;
  escalated: boolean; // black recurred during recovery
}
```

During recovery: pacing guidance in `before_prompt_build`. If black recurs during recovery, escalate.

---

## Build sequence

```
1.  discover.ts              + types.ts additions + state.ts additions + index.ts hooks
2.  partnership.ts           + types.ts additions + state.ts additions + index.ts hooks
3.  mismatch.ts              + state.ts additions + index.ts hooks
4.  deliberate.ts            + types.ts additions + index.ts hooks
5.  calibrate.ts             + types.ts additions + index.ts hooks
6.  seasons.ts               + types.ts additions + state.ts additions + index.ts hooks
7.  health.ts                + state.ts additions + index.ts hooks
8.  chain.ts                 + state.ts additions + index.ts hooks
9.  mastery.ts               + state.ts additions + index.ts hooks
10. session-learning.ts      + state.ts additions + index.ts hooks
11. nudge.ts extension       + state.ts additions
12. package.json exports     (add new module exports)
```

Each sub-plan touches:

- **New file** (the module)
- **types.ts** (new interfaces/types)
- **state.ts** (new state vars + setters)
- **index.ts** (wire into hooks)
- **package.json** (exports)

## Integration pattern (same for every module)

1. New detection/analysis function in its own file
2. Types added to `types.ts`
3. State tracking added to `state.ts` (var + setter + persistence in save/load)
4. Hooked into `message_received` (pre-processing) and/or `message_sent` (post-processing)
5. Context injected via `before_prompt_build` (all awareness flows through this one hook)

The `before_prompt_build` hook is the nervous system. Everything converges there. Currently it injects: primaries, human tone, pulse state, DEAR MAN nudge, disagreement alerts, COEF trend, contradiction notice, mirror pattern, reflexion context. We're adding: discover guidance, partnership context, mismatch awareness, deliberation prompt, calibration pause, season context, health pacing, blind spots, session learning.

## How we know it's working

- Second session feels different. The system remembers.
- Drew corrects something once. Doesn't have to correct it again next week.
- "I'm not sure about this" and means it (calibration).
- The mirror catches something Drew didn't notice. Not a gotcha. A gift.
- Close the laptop. Come back. Smarter.

## What we're NOT building (yet)

- Socioaffective monitoring ("am I making Drew more independent or more dependent?")
- Co-evolution tracking ("when's the last time we surprised each other?")
- Introspective accuracy measurement (working with the 20%)
- Validation levels (listening at different depths)

These earn their place after the loop runs.
