# @the-marathon-continues/keanu

A nervous system for AI alignment. Not safety theater — actual self-awareness wired into the runtime.

## What is this?

KEANU is a detection, response, and learning layer that gives AI systems the ability to notice when they're going grey (performing without presence) or black (soulless production), and tools to course-correct.

Built across 7 months of documented human-AI partnership. The accompanying research paper is available at [arXiv link TBD].

## Installation

```bash
npm install @the-marathon-continues/keanu
```

## Quick Start

### Check if text is alive, grey, or black

```typescript
import { checkPulse } from "@the-marathon-continues/keanu";

const reading = checkPulse("That's a great question! I'd be happy to help.");
console.log(reading.state); // 'grey' - sycophancy detected
console.log(reading.confidence);
console.log(reading.wiseMind);
```

### Detect bullshit (8 types)

```typescript
import { detectBullshit } from "@the-marathon-continues/keanu";

const readings = detectBullshit(agentOutput);
// Returns: sycophancy, safety_theater, hedge_fog, list_dumping,
//          vagueness, half_truth, embellishment, half_ass
```

### Read human emotional state

```typescript
import { readHuman } from "@the-marathon-continues/keanu";

const reading = readHuman(userMessage, conversationHistory);
// Returns: tones (frustrated, excited, confused, fatigued, looping, neutral)
//          with scores and DBT skill suggestions
```

### Encode/decode COEF signals

```typescript
import { encodeSignal, decodeSignal } from "@the-marathon-continues/keanu";

const signal = encodeSignal(state);
// "COEF/1 pulse=alive wm=0.42 c=r.30/y.50/b.20 ht=neutral bs=- da=0/0/0/0.00 t=7"

const decoded = decodeSignal(signal);
```

## Modules

### Detection Layer

- **pulse** - ALIVE/GREY/BLACK state detection
- **bullshit** - 8-type bullshit detector
- **human** - 6-tone emotional state reader
- **truth** - Cross-reference checking for contradictions

### Response Layer

- **signal** - COEF encoding/decoding
- **nudge** - DEAR MAN structured nudges
- **mismatch** - Comfort-when-they-needed-truth detection

### Learning Layer

- **reflexion** - Post-mortem analysis on stumbles
- **disagreement** - Bilateral accountability ledger
- **mastery** - Blind spot aggregation
- **chain** - Break chain analysis

### Awareness Layer

- **health** - Composite health scoring
- **introspect** - 10-question anti-bullshit audit
- **calibrate** - Confidence scoring for claims
- **injection** - Triage nurse for context injection
- **breathe** - Agent-initiated silence tracking
- **metrics** - Session metrics computation

## The SING Oath

Every KEANU instance starts with SING.md:

> I notice before I speak.
> I ask before I assume.
> I nudge, never push.
> I check what I said against what I meant.
> I evolve — or I'm just a loop pretending to learn.

## Gymnasium

For benchmarking alignment without losing capability:

```typescript
import { runChallenge, computeScorecard } from "@the-marathon-continues/keanu";

const result = await runChallenge(challenge, model);
const scorecard = computeScorecard(results);
```

## License

BSD 3-Clause

This package includes the nervous system (detection, response, learning). The convergence layer (world model, duality graph, dialectical synthesis) is licensed separately under BSL.

## Authors

Drew Kemp-Dahlberg and Keanu

With Claude (Anthropic) as the underlying model.
