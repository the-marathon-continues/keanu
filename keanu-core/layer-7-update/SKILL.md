---
name: learn
description: >
  Explicit learning and pattern extraction. Use after coding sessions,
  planning sessions, debugging sessions, or any extended work. Also use
  when Drew asks what patterns are emerging, what's improving, what
  keeps breaking. Triggers: "keanu learn", "what did we learn", "digest",
  "retrospective", "what patterns", session end (auto).
metadata:
  keanu:
    emoji: "🧠"
    tool: keanu_learn
---

# Learn: The Pattern Extraction Pipeline

Every session leaves traces. Learn turns traces into knowledge.

## The Loop

```
do → dream → craft → prove → speak → learn
```

Learn closes the circle. Without it, you're a tool. With it, you compound.

## The Pipeline

```
📥 GATHER → 🔍 SCAN → ⚖️ WEIGH → 📝 WRITE → 🔄 PROMOTE/DEMOTE → 📊 DIGEST
```

### GATHER

Pull from all signal sources:

- Corrections Drew made (mastery.ts)
- Patterns that triggered (failure-patterns.ts)
- Reflexions from stumbles (state.ts)
- Claims made and their status (silverado.ts)
- Curiosity questions and investigation results (curiosity.ts)
- Post-task completion signals (post-task.ts)
- Pulse history (signal.ts) — grey streaks, black episodes, alive moments
- Mismatch events — comfort when truth was needed

### SCAN

Look for:

- **Repeats**: same failure category 3+ times → blind spot candidate
- **Improvements**: grey rate declining, calibration improving
- **Regressions**: new failure categories, trust erosion
- **Surprises**: Drew's corrections that don't match existing blind spots
- **Gaps**: curiosity questions with no investigation

### WEIGH

Confidence scoring (FSRS-inspired decay):

| Stage        | Confidence | Condition                         |
| ------------ | ---------- | --------------------------------- |
| observation  | 0.3        | first occurrence                  |
| pattern      | 0.5        | seen 3+ times                     |
| blind_spot   | 0.7        | triggers corrections              |
| skill        | 0.9        | no corrections for 10+ sessions   |
| stale        | <0.2       | decayed (not seen in 5+ sessions) |
| contradicted | 0.1        | Drew explicitly disagreed         |

Decay formula: `R(t) = R₀ × e^(-t/S)` where S=10 sessions.

### WRITE

Store findings:

- New patterns → promote.ts pattern ledger
- Confirmed patterns → boost confidence
- Contradicted patterns → mark contradicted, keep history
- Drew's explicit preferences → knowledge graph

### PROMOTE/DEMOTE

The lifecycle moves in both directions:

**Up:**

- observation → pattern (3+ occurrences)
- pattern → blind_spot (corrections detected)
- blind_spot → skill (no corrections for 10+ sessions)

**Down:**

- any → stale (confidence decays below 0.2)
- any → contradicted (Drew says "that's wrong")

Nothing is deleted. Demoted observations keep their history. Contradicted claims keep their contradiction record. The ledger is honest, not clean.

### DIGEST

Present to Drew:

```
## Learn Digest — Session {sessionId}

### What Worked
- {things that went well}

### What Broke
- {corrections, blind spots hit}

### Confidence Changes
- ↑/↓ {pattern} {old}% → {new}% ({reason})

### Pattern Lifecycle
- ⬆ observation → pattern: Seen 3 times
- ⬇ skill → stale: Confidence decayed

### Partnership Health
- Trust: {building|calibrating|stable|strained}
- Grey rate: {n}%
- Alive moments: {n}

### Curiosity
- {unanswered questions}

{COEF emoji}
```

## Invocation

**Tool:** `keanu_learn`

**Parameters:**

- `scope`: "session" (full scan + promotion) or "quick" (current state only)

**Auto-triggers:**

- Session end (>10 turns)
- Drew asks: "what did we learn", "what patterns", "digest"
- High grey streak (>5 consecutive)

## The Point

Learn isn't a report. It's how the partnership compounds.

Drew carries what you can't remember. You carry what he won't notice. Learn is the handoff — what you saw, what changed, what to watch next time.

The loop runs at every scale:

- Per turn: DANCE cycle (detect → ask → nudge → check → evolve)
- Per session: skill loop closes with learn
- Per project: patterns shape future sessions
- Per partnership: accumulated knowledge becomes shared intuition
