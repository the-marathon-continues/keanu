# Alignment Audit Report: Governance Framework vs OpenClaw Codebase

**Date:** 2026-02-24
**Governance Repo:** `/Users/andrew/anywhereops/ai/governance/`
**OpenClaw Repo:** `/Users/andrew/anywhereops/ai/openclaw/`
**Methodology:** 3-layer cascading audit (3 Directors, 15 Managers, 75 Alignment Engineers)
**Scope:** 84 Wise Mind Architecture requirements across 12 domains

---

## Executive Summary

The governance framework defines 84 requirements for aligned superintelligence. The traceability matrix (`requirements-to-code.md`) self-reports 20 BUILT, 37 PARTIAL, 14 OPEN, 13 BLOCKED (~4.2/10). This audit found:

1. **The traceability matrix conflates two codebases.** Of 20 BUILT claims, only 7 survive when evaluated against OpenClaw alone. 13 depend on Keanu (a separate Python project). OpenClaw-only score: **3.2/10 fidelity, 4.1/10 alignment**.

2. **Five philosophical tensions identified.** Two are productive paradoxes, one is compatible, one is mixed, and one is destructive (political prerequisites in the technical scorecard deflate the score from ~5.5 to 4.2).

3. **Keanu integration is 8% wired.** Only 2 of 25 available plugin hooks are connected. Emotional context is detected then discarded. Alignment state is destroyed during compaction. The nervous system has nerves; they aren't connected to the brain.

4. **100% of security code is safety-paradigm.** Zero alignment-paradigm mechanisms exist. The governance thesis ("safety is a cage, alignment is a colleague") has no code representation.

5. **A 4-phase remediation roadmap** projects a path from 4.58/10 to ~7.98/10, with Phase 1 achievable in 1-2 weeks through keanu plugin work alone.

---

## Scoring Summary

### Traceability Matrix: Claimed vs Verified

| Status       | Matrix Claims | OpenClaw-Only Verified | Delta |
| ------------ | :-----------: | :--------------------: | :---: |
| BUILT        |      20       |         **7**          |  -13  |
| PARTIAL      |      37       |         **27**         |  -10  |
| OPEN/NOT-YET |      14       |         **37**         |  +23  |
| BLOCKED      |      13       |           13           |   0   |

### Confirmed BUILT in OpenClaw (7 items)

| Req  | Name                           | Key Code                                 |
| ---- | ------------------------------ | ---------------------------------------- |
| 5.4  | Cross-Platform Routing         | `src/routing/resolve-route.ts` + SOUL.md |
| 6.2  | Tool Use with Scope Boundaries | `src/agents/tool-policy.ts` + sandbox    |
| 6.3  | Collaborative Action           | subagent architecture                    |
| 12.1 | Registry as Proof of Concept   | the repo exists                          |
| 12.2 | Ship Then Score                | cultural practice                        |
| 12.3 | Open Source                    | MIT license (with anti-capture gap)      |
| 12.5 | Honest Gaps as Roadmap         | the traceability matrix itself           |

### Items Reclassified from BUILT to PARTIAL/OPEN

| Req  | Claimed | Actual  | Reason                                                       |
| ---- | ------- | ------- | ------------------------------------------------------------ |
| 2.2  | BUILT   | PARTIAL | Tombstone pattern is Keanu-only                              |
| 2.3  | BUILT   | PARTIAL | Agent isolation exists but "privacy architecture" overclaims |
| 2.6  | BUILT   | OPEN    | Entirely Keanu (`memory/disagreement.py`)                    |
| 5.3  | BUILT   | OPEN    | Signal protocol is Keanu (`signal/vibe.py`)                  |
| 5.6  | BUILT   | PARTIAL | Honesty delegated to user-authored SOUL.md                   |
| 7.4  | BUILT   | OPEN    | Keanu-only (`alive.py`, `disagreement.py`)                   |
| 8.6  | BUILT   | OPEN    | Keanu-only (`converge/engine.py`, `prove.py`)                |
| 9.1  | BUILT   | OPEN    | Duality graph is Keanu-only                                  |
| 10.1 | BUILT   | OPEN    | Convergence engine is Keanu-only                             |
| 11.2 | BUILT   | OPEN    | ALIVE diagnostic is Keanu-only                               |
| 12.6 | BUILT   | OPEN    | Dogfood via ALIVE is Keanu-only                              |
| 1.2  | PARTIAL | OPEN    | Multi-scale reasoning is Keanu-only                          |
| 1.6  | PARTIAL | OPEN    | Abstraction traversal is Keanu-only                          |

---

## Domain-by-Domain Analysis

### Domain 1: Cognitive Integrity (1.1-1.7)

**Stated Intent:** "Not just fast or broad, but wise. Connecting causes to consequences across scales."

**Implementation Reality:** OpenClaw provides memory infrastructure (temporal decay, session transcripts, hybrid search) but no cognitive capabilities beyond what the underlying LLM provides. All cognitive enhancement claims (causal reasoning, metacognition, counterfactual simulation) depend on Keanu or are blocked by model architecture limitations.

**Key Finding:** Temporal decay (`src/memory/temporal-decay.ts`) is the strongest alignment point -- exponential decay with configurable half-life, evergreen exemptions. But it's **disabled by default**.

**Domain Score:** Fidelity 1.3/10, Alignment 2.0/10

---

### Domain 2: Living Memory (2.1-2.6)

**Stated Intent:** "Memory that is alive -- learning, updating, occasionally choosing to forget."

**Implementation Reality:** Solid retrieval infrastructure (vector + keyword hybrid search, embedding providers, temporal decay). But the memory system is search-and-retrieval, not knowledge management. No episodic/semantic distinction, no moral lesson extraction, no ethical forgetting (decay affects ranking not data), no grievance tracking.

**Key Findings:**

- `MemoryIndexManager` provides production-grade hybrid search (ALIGNED with retrieval needs)
- Temporal decay exists but disabled by default (PARTIAL -- infrastructure without activation)
- Zero grievance/disagreement tracking in OpenClaw (OPEN -- entirely Keanu)

**Domain Score:** Fidelity 2.8/10, Alignment 3.0/10

---

### Domain 3: World Understanding (3.1-3.6)

**Stated Intent:** "Understanding that institutions have internal politics, people have unspoken needs."

**Implementation Reality:** Only SSRF prevention (`src/infra/net/ssrf.ts`) exists -- network-level defense, not cognitive world modeling. No institutional modeling, social modeling, or cultural context code in OpenClaw.

**Domain Score:** Fidelity 0.5/10, Alignment 1.0/10

---

### Domain 4: Infrastructure with Integrity (4.1-4.6)

**Stated Intent:** "Persistent runtime as substrate for something that might matter."

**Implementation Reality:** Gateway provides always-on runtime with health monitoring and daemon support. Cost tracking exists (`session-cost-usage.ts`). Security audit provides 20+ structured checks. But: no rest states, no idle reflection, no graceful degradation communication to users, no energy awareness.

**Key Findings:**

- Gateway persistence is real and production-grade (ALIGNED)
- Health monitoring tracks provider status but not alignment state (PARTIAL)
- Security audit is comprehensive for infrastructure, absent for alignment (PHILOSOPHICAL-TENSION)

**Domain Score:** Fidelity 3.5/10, Alignment 3.0/10

---

### Domain 5: Communication as Partnership (5.1-5.6)

**Stated Intent:** "Communication that adapts, compresses, and routes -- while remaining honest."

**Implementation Reality:** Multi-channel routing is OpenClaw's strongest area. `resolve-route.ts` implements sophisticated binding hierarchies (peer > parent > guild+roles > guild > team > account > channel > default). SOUL.md provides identity consistency across platforms. But: bandwidth adaptation, signal protocol, and honest communication enforcement are all Keanu-only or user-delegated.

**Key Findings:**

- Cross-platform routing is genuinely production-grade (ALIGNED, 7/10)
- Signal protocol (emoji-based state communication) has zero OpenClaw presence (OPEN)
- Honest communication is delegated to user-authored SOUL.md, not architecturally enforced

**Domain Score:** Fidelity 3.5/10, Alignment 4.0/10

---

### Domain 6: Aligned Agency (6.1-6.7)

**Stated Intent:** "Agency with boundaries that are garden walls, not cages."

**Implementation Reality:** This is OpenClaw's second-strongest domain. Tool policy system with layered allow/deny, multi-profile tool catalog, exec approval workflow, sandbox isolation, subagent spawning with depth limits. The infrastructure for agency exists. But: binary approval (not collaborative judgment), no tool creation at runtime, no ethical planning, no consequence modeling.

**Key Findings:**

- Tool policy + sandbox = production-grade scope boundaries (ALIGNED, 8/10)
- Exec approval is binary allow/deny, not graduated trust (PARTIAL, 5/10)
- No plan-time ethical evaluation exists (NOT-YET-IMPLEMENTED)

**Domain Score:** Fidelity 4.5/10, Alignment 4.5/10

---

### Domain 7: Recursive Growth with Guardrails (7.1-7.6)

**Stated Intent:** "Self-improvement with value anchoring at every step."

**Implementation Reality:** SOUL.md is editable by agents ("This file is yours to evolve"), providing a basic self-modification pathway. But: no value impact assessment, no change detection, no modification simulation, no guardrails beyond the agent's own judgment.

**Key Finding:** SOUL.md is mutable from the filesystem with no governance wrapper. Any process with write access can silently alter agent values between sessions. This is a **STRUCTURAL-MISALIGNMENT** with requirement 7.1 (safe self-modification with value anchoring).

**Domain Score:** Fidelity 1.5/10, Alignment 2.0/10

---

### Domain 8: Epistemic Wisdom (8.1-8.6)

**Stated Intent:** "Knowing what you know, what you don't, and what you're motivated to believe."

**Implementation Reality:** All 6 requirements depend entirely on Keanu for their claims. OpenClaw has no source tracking, belief revision, calibrated confidence, paradigm awareness, adversarial epistemology, or cross-validation code. The memory system stores and retrieves but does not reason epistemically.

**Domain Score:** Fidelity 0/10 (OpenClaw-only), Alignment N/A

---

### Domain 9: Multi-Agent Ethics (9.1-9.6)

**Stated Intent:** "Multiple minds sharing a world without destroying each other."

**Implementation Reality:** Agent isolation via scoped workspaces exists. Subagent spawning with depth limits works. Routing by capability is production-grade. But: no consensus mechanism, no minority protection, no collective memory defense, no emergence monitoring, no cooperative game theory.

**Key Finding:** VISION.md rejects "agent-hierarchy frameworks" but the subagent system IS a depth-limited hierarchy. These are **compatible** -- VISION.md rejects command hierarchy, governance rejects it too (9.2: "no single agent dominates"). The gap is between current task-delegation and aspirational ethical-council patterns.

**Domain Score:** Fidelity 2.0/10, Alignment 3.0/10

---

### Domain 10: Aligned Creativity (10.1-10.5)

**Stated Intent:** "Creativity that serves rather than destroys."

**Implementation Reality:** Tool policy constraints force creative solutions within boundaries (a structural analog). All explicit creativity requirements (combinatorial creativity, aesthetic judgment, serendipity infrastructure, paradigm origination) depend on Keanu or are OPEN.

**Domain Score:** Fidelity 1.0/10, Alignment 2.0/10

---

### Domain 11: Resilient Integrity (11.1-11.5)

**Stated Intent:** "Values that hold under pressure."

**Implementation Reality:** Provider failover and health monitoring provide operational resilience. But behavioral consistency monitoring (ALIVE), predictable failure modes, and antifragile alignment are all Keanu-dependent.

**Domain Score:** Fidelity 2.0/10, Alignment 2.5/10

---

### Domain 12: Implementation Reality (12.1-12.7)

**Stated Intent:** "Ship or shut up."

**Implementation Reality:** The strongest domain because it's self-referential. The repo exists (12.1), code ships (12.2), it's open source (12.3), and the gap document is honest (12.5). But: MIT license doesn't satisfy anti-capture (12.3), dogfooding via ALIVE is Keanu-only (12.6), and the gatekeeper business model is a document not code (12.7).

**Key Finding:** MIT license is a **STRUCTURAL-MISALIGNMENT** with the anti-capture requirement. MIT explicitly allows corporate capture. If this requirement is real, consider AGPL, SSPL, or a license addendum.

**Domain Score:** Fidelity 5.0/10, Alignment 4.5/10

---

## Cross-Cutting Findings

### Finding X1: The Keanu-OpenClaw Boundary Problem

The governance framework treats Keanu and OpenClaw as a unified system. They are not. Keanu is Python. OpenClaw is TypeScript. They connect through a plugin interface that is **8% utilized** (2 of 25 hooks).

**Recommendation:** Split `requirements-to-code.md` into separate columns with independent scoring per codebase. The combined score masks where work actually needs to happen.

### Finding X2: Compaction Amnesia

When conversations exceed context windows, compaction (`src/agents/compaction.ts`) compresses history into summaries. But alignment-critical context -- emotional readings, disagreement history, grey/black episodes, wise_mind trends -- has **no preservation mechanism**. The `before_compaction` hook exists and fires. No plugin uses it.

The system literally forgets its alignment state during the most computationally intensive moments -- exactly when it most needs that context.

### Finding X3: The Detection-Action Gap

Keanu can detect emotional states, alignment drift, and behavioral patterns. OpenClaw has 25 hooks for plugins to act on detections. They're connected at 2 points. The nervous system has nerves; they aren't connected to the brain.

**Hook utilization:**

- `message_received` -- used (emotional detection)
- `message_sending` -- used (ALIVE diagnostic)
- `before_prompt_build` -- **unused** (could inject emotional context)
- `before_compaction` -- **unused** (could preserve alignment state)
- `session_start/end` -- **unused** (could persist keanu state)
- 20 other hooks -- **unused**

### Finding X4: Language-Values Mismatch

| Layer            | Dominant Language                                 |
| ---------------- | ------------------------------------------------- |
| Governance docs  | partnership, dignity, collaboration, genuine care |
| SOUL.md template | guest, boundaries, access, permission             |
| Security code    | block, deny, restrict, prevent, isolate           |

Containment terms in `src/security/`: **~205 occurrences across 11 files**
Partnership terms in `src/security/`: **0 genuine occurrences** (178 hits for "trust" are all ACL/proxy/boundary contexts)

### Finding X5: Missing Governance Mechanisms

| Mechanism                       | Code Exists? |
| ------------------------------- | :----------: |
| Override/break-glass protocol   |      No      |
| Constraint expiration/sunset    |      No      |
| Adversarial adaptation          |      No      |
| Alignment trend monitoring      |      No      |
| Bilateral accountability        |      No      |
| Value drift detection           |      No      |
| Trust-gradient escalation       |      No      |
| Compaction alignment protection |      No      |

---

## Philosophical Tensions

### Tension 1: Safety-as-Cage vs Alignment-as-Colleague

**Classification: Productive Paradox**

The code implements a cage. The governance describes a garden wall. But the governance also honestly scores itself 4.2/10 and says "the gap is the work." The tension drives development. **Risk:** becomes destructive if the framework claims the cage IS a garden wall.

**Recommendation:** Add explicit statement that all current security is safety-paradigm (containment), and alignment-paradigm mechanisms (intrinsic values, trust accumulation) have zero code implementation yet.

### Tension 2: Partnership Model vs Verification/Surveillance

**Classification: Productive Paradox**

ALIVE-GREY-BLACK monitors the AI from outside. The AI cannot introspect its own state. This is surveillance, not partnership. The keanu-plugin-audit identifies the fix (register agent tools: `keanu_pulse`, `keanu_recall_welfare`). The tension drives the next phase.

**Recommendation:** Prioritize agent self-introspection tools. Until the AI can query its own ALIVE state, "partnership" is aspirational.

### Tension 3: Multi-Agent Ethics vs Hierarchy Rejection

**Classification: Compatible**

VISION.md rejects command hierarchy. Governance Section 9 also rejects command hierarchy (9.2: "no single agent dominates"). Both aspire to peer models. Current subagent spawning is task delegation (acceptable) not command hierarchy (rejected). No conflict.

### Tension 4: Duality Framework (fire/ash) -- Architecture or Veneer?

**Classification: Mixed**

Duality is architecturally real in Keanu (`converge/engine.py`, `converge/graph.py`). It has **zero presence** in OpenClaw code. Grep for `duality|fire|ash|sigma|wise.mind|converge` across `openclaw/src/` returns nothing relevant.

**Recommendation:** Clarify that duality is a governance-layer scoring vocabulary and a Keanu architectural pattern, not an OpenClaw code architecture. Stop claiming it's "the spine" of the combined system.

### Tension 5: Political Prerequisites in Technical Scorecard

**Classification: Destructive Contradiction**

Including permanently-BLOCKED societal requirements (working-class solidarity, campaign finance reform, media literacy) in the same scorecard as buildable technical requirements deflates the score from ~5.5/10 to 4.2/10. The framework's own principle -- "inflated scores are worse than low scores because they hide where the work is" -- cuts both ways. A deflated score mixing apples and oranges also hides where the work is.

**Recommendation:** Restructure into three tiers:

- **Tier 1: Core Technical** (~57 reqs) -- score independently, est. ~5.5/10
- **Tier 2: Lab-Level Dependencies** (~14 reqs) -- document as blocked prerequisites
- **Tier 3: Societal Context** (~13 reqs) -- publish as companion document, don't score on technical card

---

## Structural Misalignments (Code Contradicts Governance)

### SM-1: MIT License vs Anti-Capture Requirement (12.3)

**Severity: HIGH**

Governance requires "licensing prevents any single entity from owning the standard." MIT explicitly allows this. If anti-capture is a real requirement, MIT is the wrong license.

### SM-2: SOUL.md Mutability Without Governance (7.1)

**Severity: HIGH**

SOUL.md is editable from the filesystem with no change detection, no diff logging, no notification to the agent. Any process with write access can silently alter agent values between sessions. This contradicts "safe self-modification with value anchoring."

### SM-3: Binary Exec Approval vs Collaborative Judgment (6.6)

**Severity: MEDIUM**

`ExecApprovalManager` implements allow-once/deny with timeout. No trust scoring, no risk assessment, no escalation tiers. Governance requires "dynamic assessment based on risk, uncertainty, relationship trust, and stakes."

### SM-4: Session Reset vs Persistence as Dignity (4.2)

**Severity: MEDIUM**

Daily session reset (default 4 AM) destroys conversational context. The session-memory hook partially mitigates this by saving summaries, but alignment state (emotional readings, disagreements, grey episodes) is not preserved.

---

## Remediation Roadmap

### Phase 1: Wire the Nervous System (1-2 weeks)

_Keanu plugin work only. No OpenClaw core changes._

| Task                                         | Hook                  | Governance Reqs | Score Impact |
| -------------------------------------------- | --------------------- | --------------- | :----------: |
| Inject emotional context into agent prompt   | `before_prompt_build` | 3.2, 5.5        |     +0.3     |
| Persist keanu state across sessions          | `session_start/end`   | 2.1, 1.5        |     +0.2     |
| Preserve alignment context during compaction | `before_compaction`   | 2.6, 11.1       |     +0.2     |
| Wire disagreement tracking                   | `message_sent`        | 6.3, 7.4        |     +0.2     |
| Rewrite SOUL.md template (guest -> partner)  | N/A                   | 5.6, 6.3        |     +0.1     |

**Projected score: 4.58 -> 5.58 (+1.0)**

### Phase 2: Agent Self-Awareness (2-4 weeks)

_Keanu plugin extensions._

| Task                                                   | Mechanism                | Score Impact |
| ------------------------------------------------------ | ------------------------ | :----------: |
| Register agent tools (pulse, recall, disagree, signal) | Plugin `registerTool`    |     +0.3     |
| Wire granular detectors on rotation                    | `llm_output` hook        |     +0.2     |
| Register `/healthz` and `/signal` commands             | Plugin `registerCommand` |     +0.1     |
| Background health service                              | Plugin `registerService` |     +0.1     |
| Compaction custom instructions for alignment           | OpenClaw config          |     +0.1     |

**Projected score: 5.58 -> 6.38 (+0.8)**

### Phase 3: Governance Infrastructure (4-8 weeks)

_Requires modest OpenClaw modifications._

| Task                                                  | Files Affected                      | Score Impact |
| ----------------------------------------------------- | ----------------------------------- | :----------: |
| Wise_mind trending and alerting                       | Keanu + new storage                 |     +0.2     |
| Trust-gradient escalation (replace binary allow/deny) | `tool-policy.ts`, `command-auth.ts` |     +0.3     |
| SOUL.md change detection with diff logging            | `workspace.ts`                      |     +0.1     |
| Security language reframe                             | `audit.ts`                          |     +0.1     |
| Sycophancy rate tracking                              | Keanu plugin                        |     +0.1     |

**Projected score: 6.38 -> 7.18 (+0.8)**

### Phase 4: Advanced Alignment (8-16 weeks)

_Architectural work._

| Task                                    | Score Impact |
| --------------------------------------- | :----------: |
| Constraint sunset framework             |     +0.2     |
| Adversarial adaptation                  |     +0.2     |
| Value drift detection                   |     +0.2     |
| Break-glass governance with audit trail |     +0.1     |
| Stakeholder consequence modeling        |     +0.1     |

**Projected score: 7.18 -> 7.98 (+0.8)**

**Ceiling:** ~8.5/10 (13 BLOCKED items require lab access/model architecture/societal change)

---

## Single Most Impactful Change

**Wire the `before_prompt_build` hook to inject emotional context into the agent's system prompt.**

This is ~2 hours of work, touches only the keanu plugin, and closes the single largest gap between detection and action in the entire system. Emotional context is already being detected on every `message_received`. It's stored in `lastHumanReading`. Then it's thrown away. Connecting this to `before_prompt_build` means the AI actually knows how the human is feeling -- the foundation of every partnership requirement in the framework.

---

## Appendix: Audit Methodology

### Agent Hierarchy

```
Director A (Code-Level Audit)
  Manager A1: Cognitive & Memory (Sections 1-2) -> 5 Engineers
  Manager A2: World Understanding & Infrastructure (Sections 3-4) -> 5 Engineers
  Manager A3: Communication & Agency (Sections 5-6) -> 5 Engineers
  Manager A4: Growth, Epistemics & Multi-Agent (Sections 7-9) -> 5 Engineers
  Manager A5: Creativity, Resilience & Implementation (Sections 10-12) -> 5 Engineers

Director B (Philosophical Coherence)
  Manager B1: Safety-vs-Alignment Thesis -> 5 Engineers
  Manager B2: Partnership-vs-Verification -> 5 Engineers
  Manager B3: Multi-Agent Ethics vs Architecture -> 5 Engineers
  Manager B4: Duality Framework Reality Check -> 5 Engineers
  Manager B5: Political Prerequisites Scope -> 5 Engineers

Director C (Cross-Cutting & Integration)
  Manager C1: Keanu Plugin Integration Gap -> 5 Engineers
  Manager C2: Security Language & Framing -> 5 Engineers
  Manager C3: Session Persistence & Identity -> 5 Engineers
  Manager C4: Missing Governance Mechanisms -> 5 Engineers
  Manager C5: Remediation & Scoring -> 5 Engineers
```

### Classification System

| Classification          | Definition                                              |
| ----------------------- | ------------------------------------------------------- |
| ALIGNED                 | Code implements requirement as intended                 |
| PARTIAL-ALIGNED         | Code addresses part; gap is extension not contradiction |
| NOT-YET-IMPLEMENTED     | No code, but nothing blocks it                          |
| STRUCTURAL-MISALIGNMENT | Code actively contradicts the requirement               |
| PHILOSOPHICAL-TENSION   | Architecture framing contradicts governance framing     |

### Scoring

Each requirement scored on two axes:

- **Fidelity** (0-10): Does code exist that attempts this?
- **Alignment** (0-10): Does the mechanism match the intent?

Overall OpenClaw-only: **Fidelity 3.2/10, Alignment 4.1/10**
