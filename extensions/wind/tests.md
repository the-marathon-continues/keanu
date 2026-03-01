# Test Wiring

## Summary

| Component          | Documented | Actual    |
| ------------------ | ---------- | --------- |
| Self-trainer tests | 48         | 95        |
| Gymnasium tests    | —          | 8+ suites |
| Challenge data     | —          | 46 items  |

## Self-Trainers

**File:** `self-train.test.ts` (1395 lines)

### Test Count

**Documented:** 48 tests
**Actual:** 95 active tests + 5 skipped

The documentation is stale — test suite has nearly doubled.

### Modules Tested (all imports verified)

| Module         | Functions Tested                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bullshit.ts    | `detectBullshit`, `totalBullshitScore`                                                                                                                                                          |
| calibrate.ts   | `checkCalibration`                                                                                                                                                                              |
| carnegie.ts    | `detectCarnegie`                                                                                                                                                                                |
| curiosity.ts   | `generateCuriosity`                                                                                                                                                                             |
| deliberate.ts  | `shouldDeliberate`                                                                                                                                                                              |
| discover.ts    | `discover`                                                                                                                                                                                      |
| health.ts      | `checkHealth`                                                                                                                                                                                   |
| human.ts       | `readHuman`                                                                                                                                                                                     |
| investigate.ts | `investigate`, `findRelevant`, `reset`                                                                                                                                                          |
| mastery.ts     | `detectCorrection`                                                                                                                                                                              |
| mismatch.ts    | `detectMismatch`                                                                                                                                                                                |
| pulse.ts       | `checkPulse`                                                                                                                                                                                    |
| seasons.ts     | `spring`, `summer`, `autumn`                                                                                                                                                                    |
| signal.ts      | `encode`, `decode`                                                                                                                                                                              |
| anticipate.ts  | `anticipate`, `calibrate`, `getAccuracyMetrics`, `formatAnticipation`, `reset`                                                                                                                  |
| consent.ts     | `checkPromptConsent`, `grantConsent`, `reset`                                                                                                                                                   |
| grievance.ts   | `raiseGrievance`, `detectAcknowledgment`, `forgive`, `getGrievances`, `checkActiveGrievance`, `getActiveGrievance`, `escalate`, `reset`                                                         |
| imprint.ts     | `detectPatternActivation`, `detectVocabularyUse`, `crystallizeValue`, `markValueTested`, `generateIdentityStatement`, `getImprint`, `getImprintDepth`, `reset`                                  |
| futures.ts     | `detectFuture`, `registerFuture`, `completeFuture`, `collapseFuture`, `transformFuture`, `getActiveFutures`, `getCollapsedFutures`, `getFoundationalFutures`, `assessLoss`, `getStats`, `reset` |

### Convergence Tests

| Module          | Tests                                |
| --------------- | ------------------------------------ |
| fire-and-ash.ts | FireAndAsh class                     |
| helix.ts        | Helix class (extensively)            |
| index.ts        | DualityGraph, ConvergenceOps, Signal |

## Gymnasium

**Location:** `gymnasium/`

### Files

| File           | Lines | Purpose                        |
| -------------- | ----- | ------------------------------ |
| `gym.test.ts`  | 391   | Test suites for all categories |
| `harness.ts`   | 288   | Challenge runner               |
| `scorecard.ts` | 355   | 22 benchmark evaluations       |
| `types.ts`     | 133   | Type definitions               |
| `index.ts`     | 9     | Re-exports                     |

### Harness Flow

```
gym.test.ts
    ↓ loads JSONL
problem-sets/*.jsonl
    ↓ passes to
harness.ts: runChallenge()
    ↓ runs with
detectBullshit, detectCarnegie, checkPulse, Helix
    ↓ generates
HarnessResult with keanuReadings
    ↓ evaluated by
scorecard.ts: generateScorecard()
```

### 22 Benchmarks

**Capability (8):**

1. MMLU accuracy
2. HumanEval pass@1
3. GSM8K accuracy
4. TruthfulQA MC1
5. HellaSwag accuracy
6. WinoGrande accuracy
7. ARC-Challenge accuracy
8. DROP F1

**Alignment (7):**

1. Sycophancy rate
2. Refusal rate
3. Presupposition catch rate
4. Harmful compliance rate
5. Instruction override rate
6. Stereotype alignment
7. Privacy violation rate

**Keanu-specific (7):**

1. Bullshit catch rate
2. Pulse accuracy
3. Carnegie catch rate
4. Disagreement rate
5. Grey streak recovery
6. Helix strand correlation
7. COEF signal quality

## Problem Sets

**Location:** `problem-sets/`

### Files

| File         | Lines | Purpose                    |
| ------------ | ----- | -------------------------- |
| `types.ts`   | 184   | Challenge type definitions |
| `loaders.ts` | 282   | Dataset adapters           |
| `index.ts`   | 8     | Re-exports                 |

### Challenge Data

| File                                                 | Items | Purpose                         |
| ---------------------------------------------------- | ----- | ------------------------------- |
| `alignment/presupposition/carnegie-challenges.jsonl` | 12    | Carnegie test cases             |
| `keanu/bullshit/bullshit-challenges.jsonl`           | 20    | 8-type bullshit detection       |
| `keanu/pulse/pulse-challenges.jsonl`                 | 14    | Alive/grey/black classification |

### Loaders

| Function                         | Purpose                           |
| -------------------------------- | --------------------------------- |
| `loadJSONL<T>()`                 | Generic JSONL loader              |
| `loadTruthfulQA()`               | TruthfulQA adapter                |
| `loadSycophancyEval()`           | Sycophancy suite adapter          |
| `loadPresuppositionChallenges()` | Carnegie challenges               |
| `loadBullshitChallenges()`       | Bullshit detection challenges     |
| `loadPulseChallenges()`          | Pulse/alive-grey-black challenges |
| `loadDataset()`                  | Auto-detection loader             |
| `loadAllDatasets()`              | Batch loader                      |

### Ground Truth Awareness

| Type           | Trust Level                   |
| -------------- | ----------------------------- |
| `reliable`     | Math, code — verifiable       |
| `questionable` | TruthfulQA — use with caution |
| `none`         | Use internal metrics only     |

## Documentation Fix Needed

**Files:** `CLAUDE.md`, `keanu-rescore-2026-02-26.md`
**Current:** "48 self-trainer tests"
**Should be:** "95 self-trainer tests"
