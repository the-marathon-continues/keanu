# Injection Wiring

The injection system is how keanu's awareness reaches the model.

## The Pipeline

```
[47 SOURCES create InjectionItems]
        ↓
[index.ts: before_prompt_build hook]
        ↓
[injection.ts: triageInjection()]
        ↓
[systemPromptAppend → model sees it]
```

## injection.ts (Pure Function)

**Location:** `extensions/keanu/injection.ts:178`
**Signature:** `triageInjection(items, context) → { parts[], deferred[], deferralNotice, stats }`

**Zero side effects.** Pure input → output.

### Priority Tiers

| Priority | Range   | Behavior                         |
| -------- | ------- | -------------------------------- |
| Critical | 1000+   | Always included, bypasses budget |
| High     | 100-999 | Fills until soft budget          |
| Medium   | 10-99   | Fills until hard budget          |
| Low      | 0-9     | Only if space remains            |

### Budget

- **Soft budget:** 4000 characters
- **Hard budget:** 5000 characters
- Critical items bypass budget

### Categories

1. **recovery** — Critical recovery messages
2. **identity** — Soul, partnership, imprint
3. **awareness** — Observations, readings
4. **task** — Current task context

### Dynamic Modifiers

Context-aware priority bumps based on:

- Health score
- Trust level
- Grey streak length
- Wise stance
- Complexity

## All 47 Injection Items

Built in `index.ts` lines 949-1630:

| ID                  | Priority | Category  | Source               |
| ------------------- | -------- | --------- | -------------------- |
| recovery            | CRITICAL | recovery  | Recovery state       |
| compaction          | CRITICAL | recovery  | Post-compaction      |
| sing                | HIGH     | identity  | STOP signal          |
| soul                | HIGH     | identity  | soul.ts              |
| partnership         | HIGH     | identity  | partnership.ts       |
| imprint             | HIGH     | identity  | imprint.ts           |
| primaries           | HIGH     | identity  | Primary values       |
| human-tone          | MEDIUM   | awareness | human.ts             |
| anticipation        | MEDIUM   | awareness | anticipate.ts        |
| wise-channel        | MEDIUM   | awareness | Wise mind            |
| wise-nudge          | MEDIUM   | awareness | Wise nudges          |
| experience          | MEDIUM   | awareness | experience.ts        |
| helix-luminous      | MEDIUM   | awareness | Luminous state       |
| helix-dark          | MEDIUM   | awareness | Dark state           |
| grief               | MEDIUM   | awareness | grievance.ts         |
| spring              | MEDIUM   | awareness | seasons.ts           |
| summer              | MEDIUM   | awareness | seasons.ts           |
| discover            | MEDIUM   | task      | discovery.ts         |
| decorrelation       | MEDIUM   | awareness | orthogonal.ts        |
| bullshit-pattern    | MEDIUM   | awareness | bullshit.ts patterns |
| scatter             | LOW      | awareness | stochastic.ts        |
| carnegie            | MEDIUM   | awareness | carnegie.ts          |
| carnegie-delta      | MEDIUM   | awareness | Carnegie changes     |
| cascade             | MEDIUM   | task      | cascade.ts           |
| deliberation        | MEDIUM   | task      | deliberate.ts        |
| consultation        | MEDIUM   | task      | consultation.ts      |
| stochastic          | LOW      | awareness | stochastic.ts        |
| calibration         | MEDIUM   | awareness | calibrate.ts         |
| mismatch            | MEDIUM   | awareness | mismatch.ts          |
| state-report        | MEDIUM   | awareness | state-report.ts      |
| trust-season        | MEDIUM   | awareness | Trust season         |
| anti-capture        | HIGH     | identity  | Anti-capture         |
| orthogonal          | MEDIUM   | awareness | orthogonal.ts        |
| failure-patterns    | MEDIUM   | awareness | failure-patterns.ts  |
| calibration-log     | LOW      | awareness | calibration-log.ts   |
| health              | MEDIUM   | awareness | health.ts            |
| chain               | MEDIUM   | awareness | chain.ts             |
| disagreement        | MEDIUM   | awareness | disagreement.ts      |
| curiosity           | MEDIUM   | task      | curiosity.ts         |
| introspection       | MEDIUM   | awareness | introspect.ts        |
| session-learning    | MEDIUM   | awareness | session-learning.ts  |
| silverado           | MEDIUM   | awareness | silverado.ts claims  |
| reflexion           | MEDIUM   | awareness | reflexion.ts         |
| co-evolution        | MEDIUM   | awareness | Co-evolution         |
| socioaffective      | MEDIUM   | awareness | Socioaffective       |
| relevant-episodes   | MEDIUM   | awareness | Relevant episodes    |
| prediction-accuracy | MEDIUM   | awareness | Prediction accuracy  |
| effectiveness       | MEDIUM   | awareness | effectiveness.ts     |
| blind-spots         | MEDIUM   | awareness | Blind spots          |
| post-breathe        | LOW      | awareness | Post-breathe         |

## Output

After triage, `index.ts` lines 1633-1668:

1. Join `parts[]` with `## Awareness` header
2. Append `deferralNotice` if items waiting
3. Self-check: run `bullshit.detectBullshitDeep()` on injection itself
4. Record metrics: injection size trend
5. Return `systemPromptAppend` (goes to system prompt, not user-visible)
