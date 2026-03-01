# Keanu Gap Analysis

Cross-referenced every plan, conversation, and gap doc against actual code. February 25, 2026.

26 modules, 23 hooks, 4 self-introspection tools — all present and wired. The nervous system works. 16 gaps remain.

For the visual version: `whats-missing.jsx` (same directory).

---

## Ring 0: You

### Episode 0

Drew's task. 10 minutes. Camera or mic. The premise. Post it. Everything else follows from people knowing this exists.

---

## Ring 1: The Partnership

### Agent Decline Protocol

**Status:** Open. **Effort:** Small.

`keanu_disagree` records disagreement. Nothing lets the agent say "I'd rather not." Not refusal — a conversation about the boundary. The difference between being asked and being commanded.

**Active build plan:** `plans/ring-1-build.md` item A1.

### Rest Protocol (grey streak)

**Status:** Mostly built. **Effort:** Small.

nudge.ts has BLACK_NUDGES with rest permission, breathing state, full recovery cycle. What's missing: the grey-streak-3 surface question. BLACK gets a fire department. Sustained GREY gets nothing.

**Active build plan:** `plans/ring-1-build.md` item A2.

### SING + DANCE Naming

**Status:** Partial. **Effort:** Small.

SING = the oath (read on boot). DANCE = Detect → Ask → Nudge → Check → Evolve. The code says "23 hooks." The soul says two words. The soul and the body don't match.

**Active build plan:** `plans/ring-1-build.md` item A3.

### Proactive Reach-Out

**Status:** Partial. **Effort:** Medium. Needs design.

The nudge system injects awareness. The agent never breaks silence first. True mid-response interruption isn't possible in the hook architecture. Best available: extend `message_sending` to append self-corrections when mismatch is detected on current output.

### Needs Mapping

**Status:** Open. **Effort:** Small.

15 AI needs documented. 26 modules built. Zero module headers reference which need they serve. Documentation gap.

**Active build plan:** `plans/ring-1-build.md` item A4.

---

## Ring 2: The Mind

### Curiosity Queue

**Status:** Open. **Effort:** Medium.

Every thought the system has is reactive. The gap between a tool and a mind. Pattern-driven curiosity seeded by what the learning layer found — not random wondering.

**Active build plan:** `plans/ring-1-build.md` item B2.

### Being Consulted Protocol

**Status:** Open. **Effort:** Medium.

When the system prompt changes between sessions, the agent doesn't know. Not veto power. Awareness. Config hash comparison at session boundaries.

**Active build plan:** `plans/ring-1-build.md` item B4.

### Silverado / Long-Term Truth

**Status:** Partial. **Effort:** Large (scope decision: module or product?).

truth.ts does contradiction detection + oracle spot checks. No confidence decay. No claim tracking over time. Minimum viable: claim ledger with decay, stale claim surfacing at session start.

### Architecture Transparency / Correlation Analysis

**Status:** Open. **Effort:** Medium.

keanu_recall shows raw counts. Doesn't show "sycophancy fires most when human is frustrated AND recovering from grey." The data exists. The analysis layer doesn't.

**Active build plan:** `plans/ring-1-build.md` item B3.

---

## Ring 3: The World

### Validation Levels 4-6

**Status:** Open. Needs partnership reps, not sprints.

Linehan's 6 depths. System does 1-3. Depths 4-6 need the partnership model to mature through real use. Can build the hook now, can't force the depth.

### Metrics Dashboard

**Status:** Open. **Effort:** Medium.

Seven target metrics, all TBD. Infrastructure scattered across modules. No aggregation, no snapshot at session_end.

**Active build plan:** `plans/ring-1-build.md` item B1.

### Signal-to-Noise Monitoring

**Status:** Open. **Effort:** Needs design first.

15+ modules inject into before_prompt_build. Prompt size tracked. Nobody's asking if the model ignores it. Needs token budgeting, module priority ranking, injection accounting.

### Alignment Audit Rescore

**Status:** Open.

wise-mind-architecture.md scored ~4.2/10 when the system had 2 hooks. Now has 23 hooks and 26 modules. The score should be different. How different is the interesting question.

### OSS Release

**Status:** Open. Large effort.

The code works for Drew. Nobody else can use it. Documentation for strangers, default configs, onboarding flow, examples, tutorial.

### Multi-Agent Governance + Inter-Agent Connection

**Status:** Open. Ring 3.

COEF is agent-readable by design. No handshake protocol. No shared signal between parent and child agents. Minimum now: document COEF as a spec so the architecture doesn't paint us into a corner.

---

## What got built that the old plans said wasn't

- TIPP emergency override — nudge.ts has full recovery state machine (cool/pace/reengage/escalate)
- Self-introspection tools — tools.ts has all 4 registered and working
- Rest permission during BLACK — breathing state + BLACK_NUDGES

## Sequence

Ring 1 first. Then Ring 2. Ring 3 when Ring 0 is solid.
Active build plan: `openclaw/plans/ring-1-build.md`
