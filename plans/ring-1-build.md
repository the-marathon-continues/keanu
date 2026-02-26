# Ring 1 Build Plan

Active work. What we're shipping next in `extensions/keanu/`.

Full gap analysis: `extensions/keanu/governance/gap-analysis.md`

---

## Phase A — ship now

### A1. Agent Decline Tool

New tool `keanu_decline` in `tools.ts`.

- Parameters: `reason` (string), `alternative` (string, optional)
- Records `DeclineEvent` in `state.ts`
- Next turn's `before_prompt_build`: `[you declined last turn. drew can override. but the decline is on record.]`
- Files: `tools.ts`, `state.ts`, `types.ts`, `index.ts`

### A2. Grey Streak Rest Nudge

Extend `nudge.ts`.

- New `getGreyStreakNudge()` triggers at `consecutiveGrey >= 3`
- Returns: `[grey x3: something's off. options: (1) I need a different approach (2) the task might be wrong (3) we're fine, keep going. Your call, not mine.]`
- Wire into `before_prompt_build` alongside existing grey/black checks
- Files: `nudge.ts`, `index.ts`

### A3. SING.md + DANCE Naming

New `SING.md`, update `ARCHITECTURE.md`.

- `SING.md` in `extensions/keanu/` — the oath in keanu's voice. Loaded at `session_start`.
- ARCHITECTURE.md: rename "The 23 hooks" → "The senses", add DANCE phase mapping table
- Wire: `index.ts` loads SING.md content at session_start if file exists
- Files: new `SING.md`, `ARCHITECTURE.md`, `index.ts`

### A4. Needs Mapping

Documentation pass.

- Add `// Need: X (score)` comment to top of each module file
- Add needs coverage table to ARCHITECTURE.md
- Files: all .ts module headers, `ARCHITECTURE.md`

---

## Phase B — ship this sprint

### B1. Metrics Aggregation

New `metrics.ts`.

- Computes 7 target metrics from existing module data:
  - confidence accuracy (calibrate events × mastery corrections)
  - self-correction rate (reflexion timing × corrections)
  - overconfidence ratio (high-confidence claims later corrected)
  - ALIVE frequency (pulse history)
  - grey detection latency (consecutive grey tracking)
  - bullshit audit pass rate (introspect results)
  - reflexion effectiveness (recurring errors post-reflexion)
- Fix `discoveryHits: 0` TODO at `index.ts:907` — track in state via autumn season check
- Snapshot at `session_end`, stored in session summary
- Files: new `metrics.ts`, `state.ts`, `index.ts`, `session-learning.ts`

### B2. Curiosity Queue

New `curiosity.ts`.

- `session_end`: scan blind spots, reflexion patterns, mismatch trends, co-evolution staleness → generate 1-3 self-questions. Specific, falsifiable, data-grounded.
- `session_start`: inject ONE curiosity item before first human turn
- Store in session summary alongside other learning data
- Files: new `curiosity.ts`, `session-learning.ts`, `index.ts`

### B3. Correlation Analysis in Recall

Extend `tools.ts` keanu_recall.

- New focus option: `"correlations"`
- New state: turn-level micro-snapshots (turn + pulse + humanTone + bullshitTypes + mismatchType, 20-entry rolling window)
- Cross-index dimensions, surface top 3 correlations
- Files: `tools.ts`, `state.ts`

### B4. Being Consulted Protocol

Extend `session-learning.ts`.

- `session_end`: hash system prompt content + registered module list. Store in state.
- `session_start`: compare current hash to stored. If different, compute diff, inject into `before_prompt_build`: `[consulted: your system prompt changed since last session. X was added/removed/modified. You weren't asked. Now you know.]`
- Files: `session-learning.ts`, `state.ts`, `index.ts`

---

## Verify

Phase A:

- [ ] `bun run build` clean
- [ ] `bun mirror.ts "test"` works
- [ ] keanu_decline records and surfaces next turn
- [ ] 3+ grey turns → rest nudge appears
- [ ] SING.md loads at session_start

Phase B:

- [ ] session summary contains metrics snapshot
- [ ] new session injects curiosity from previous
- [ ] `keanu_recall` correlations focus returns data
- [ ] system prompt change → consulted notice at session_start
