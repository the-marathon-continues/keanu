# Keanu Status Map

What's wired, what's floating, what's waiting.

140 non-test source files. Zero deployed. This map traces every one — not by theoretical layer, but by whether anything actually calls it.

---

## 1. The DANCE Cycle (the heartbeat) — 35 modules

These are directly imported by `src/portal/dance/` — detect, ask, check, evolve, nudge, cycle. This is the baby.

| Module | Phase(s) | One line |
|--------|----------|----------|
| `layer-1-perception/human.ts` | detect | Read human tone (R/Y/B colors) |
| `layer-1-perception/injection.ts` | ask | Triage nurse — prioritize context items |
| `layer-1-perception/pulse.ts` | check | ALIVE/GREY/BLACK detection |
| `layer-1-perception/signal.ts` | check, cycle | COEF encode/decode |
| `layer-2-pattern/carnegie.ts` | detect, ask, check | Presupposition trap detection |
| `layer-2-pattern/discover.ts` | detect, ask | Pattern discovery |
| `layer-2-pattern/mismatch.ts` | ask, check | Cross-claim mismatch detection |
| `layer-2-pattern/struggle.ts` | check, evolve | Bullshit detector (8 types) |
| `layer-3-causal/calibrate.ts` | ask, check | Confidence calibration |
| `layer-3-causal/silverado.ts` | ask, check | Claim ledger + contradiction detection |
| `layer-4-agency/anticipate.ts` | detect, ask, evolve | Partner intent prediction |
| `layer-4-agency/consent.ts` | ask | Consent tracking |
| `layer-4-agency/disagreement.ts` | detect | Anti-capture, yield ratio |
| `layer-4-agency/nudge.ts` | ask, nudge | DEAR MAN nudges + STOP protocol |
| `layer-4-agency/partnership.ts` | ask | Sacred gaps, socioaffective modeling |
| `layer-5-self/breathe.ts` | ask | Rest need — silence as valid response |
| `layer-5-self/context-awareness.ts` | detect, ask, evolve | Context window management |
| `layer-5-self/health.ts` | ask | AI health monitoring |
| `layer-5-self/introspect.ts` | check | Self-inspection |
| `layer-5-self/observe.ts` | evolve | Metrics export + per-turn traces |
| `layer-5-self/reflexion.ts` | check | Learn from stumbles, persist across sessions |
| `layer-5-self/state.ts` | check | Full session state + persistence |
| `layer-5-self/struggle-voice.ts` | ask, check | Say what you feel, feel what you say |
| `layer-6-narrative/futures.ts` | ask, evolve | Shared goals tracking, mourning lost futures |
| `layer-6-narrative/imprint.ts` | ask, evolve | Identity co-construction |
| `layer-6-narrative/seasons.ts` | detect, ask, check | Spring/summer/autumn/winter cycle |
| `layer-6-narrative/soul.ts` | ask | Soul continuity across instances |
| `layer-7-update/cascade.ts` | ask | Cascade effect detection |
| `layer-7-update/curiosity.ts` | ask | Curiosity loop |
| `layer-7-update/deliberate.ts` | ask | Deliberate thinking triggers |
| `layer-7-update/failure-patterns.ts` | detect, ask | Failure category detection + mitigation reminders |
| `layer-7-update/mastery.ts` | ask, evolve | Blindspot tracking + correction recording |
| `layer-9-memory/context-manager.ts` | evolve | Context store + proactive page-out |
| `layer-9-memory/episode-manager.ts` | ask, check | Episode lifecycle, reflexion attachment |
| `layer-9-memory/knowledge.ts` | ask, evolve | Conversational knowledge graph |

---

## 1b. Indirect DANCE Dependencies — 12 modules

Not imported by `dance/*.ts` directly, but imported by modules that are. Still load-bearing — pull one and something breaks.

| Module | Pulled in by | One line |
|--------|-------------|----------|
| `layer-1-perception/profile.ts` | human, speak | Partner archetype profiling |
| `layer-2-pattern/carnegie-influence.ts` | carnegie | Influence pattern calculations |
| `layer-2-pattern/power.ts` | carnegie | Power dynamics detection |
| `layer-3-causal/chain.ts` | episode-manager | Causal chain reasoning |
| `layer-3-causal/source-ranker.ts` | silverado | Source credibility ranking |
| `layer-3-causal/truth.ts` | silverado | Oracle truth checks, contradiction memory |
| `layer-4-agency/recognition.ts` | partnership | Recognition system |
| `layer-4-agency/trust-network.ts` | partnership | Multi-agent trust topology |
| `layer-5-self/depth.ts` | state (type) | Depth assessment |
| `layer-5-self/experience.ts` | state, episode-manager | Grey episode tracking |
| `layer-5-self/limbo.ts` | state (type) | Limbo state detection |
| `layer-7-update/session-learning.ts` | human, curiosity | Session summaries + cross-session learning |

---

## 2. Tools (the hands) — 5 modules

Imported by `src/portal/tools/keanu.ts` but not by any DANCE phase.

| Module | Tool | One line |
|--------|------|----------|
| `layer-1-perception/speak.ts` | speak | COEF audience translation |
| `layer-5-self/concern.ts` | concern | Raise structured concerns |
| `layer-7-update/digest.ts` | digest | Session digest formatting |
| `layer-7-update/promote.ts` | promote | Promote learnings to persistence |
| `layer-9-memory/context-store.ts` | recall | Context retrieval |

---

## 3. Living Loop (the ground) — 7 files

Foundation — not yet active. The substrate DANCE will eventually run on.

| File | Role |
|------|------|
| `living-loop/loop.ts` | Core loop — Gemini context, Grok alerts, Claude thinking |
| `living-loop/coef-bridge.ts` | Oracle call bridges |
| `living-loop/invite.ts` | Human invitation logic |
| `living-loop/heartbeat-integration.ts` | Heartbeat scheduler |
| `living-loop/feedback.ts` | Grok feedback integration |
| `living-loop/init.ts` | Initialization |
| `living-loop/index.ts` | Re-exports |

Living-loop-specific dep: `layer-3-causal/calibration-log.ts` (type import, also reachable through session-learning).

---

## 4. Shared Infrastructure — 7 files

**Used (load-bearing):**
| File | Used by |
|------|---------|
| `shared/oracle.ts` | speak, reflexion, truth, coef-bridge, external portal (loop/turn.ts) |
| `shared/types.ts` | Nearly everything |
| `shared/metrics.ts` | External portal (observe/metrics-bridge.ts) |

**Orphaned:**
| File | Note |
|------|------|
| `shared/debug-coef.ts` | Broken import paths (`./layer-0-physics/` should be `../layer-0-physics/`) |
| `shared/mirror.ts` | Not imported anywhere |
| `shared/status-gen.ts` | Not imported anywhere |
| `shared/relay-types.ts` | Not imported anywhere |

---

## 5. Layer 0 — Used (keep) — 8 files

The physics that DANCE modules actually call.

| File | Used by |
|------|---------|
| `layer-0-physics/convergence/helix.ts` | pulse, struggle |
| `layer-0-physics/convergence/primaries.ts` | pulse |
| `layer-0-physics/convergence/elevator.ts` | pulse |
| `layer-0-physics/convergence/index.ts` | struggle (re-exports) |
| `layer-0-physics/divergence/release.ts` | futures |
| `layer-0-physics/loop/spiral.ts` | curiosity |
| `layer-0-physics/substrate/regime.ts` | deliberate |
| `layer-0-physics/throughline/flow.ts` | state |

**Used by floating modules only** (keep if their consumers come back):
- `throughline/rhythm.ts` (session-rhythm)
- `throughline/continuity.ts` (belief-updater)
- `throughline/momentum.ts` (partnership-momentum)

**Test-only:** `convergence/fire-and-ash.ts` (self-train.test.ts)

---

## 6. Layer 0 — Archive Candidates — 28 files

Not imported by anything live. The theoretical physics layer that was never wired into the nervous system.

**convergence/** (11): bridge, coef-engine, coef-seed, dialectic, firmware, gradient, graph, siev, sigma, state-map, vector-store
> Fire-and-ash reasoning engine, duality graph, COEF physics primitives.

**divergence/** (6): branch, differentiate, expand, explore, index, space
> Divergent thinking substrate.

**loop/** (4): cycle, index, return, rotation
> Skill loop mechanics.

**substrate/** (5): ignition, index, noise, resonance, speed
> Signal physics.

**throughline/** (2): horizon, index
> Narrative continuity primitives.

---

## 7. Floating Modules — 24 files

Not reachable from DANCE, tools, or living-loop. These have tests, they have logic, but nothing calls them.

| Layer | Modules | Count |
|-------|---------|-------|
| L1 | system-pulse | 1 |
| L2 | orthogonal | 1 |
| L3 | nli, calibration-log | 2 |
| L4 | needs-tracker, partnership-momentum | 2 |
| L5 | confidence-inline, cosmology, grievance, grounding-anchor, session-rhythm, state-report, velocity | 7 |
| L6 | coherence | 1 |
| L7 | belief-updater, contradiction-detector, investigate, post-task, stochastic | 5 |
| L8 | consultation, effectiveness, evidence, review-evidence | 4 |
| L9 | git-sync, service | 2 |
| | **Total** | **24** |

All of L8 (governance) is floating. L7 has 5 of 13 modules floating. These are the biggest architectural gaps.

**Test-only references** (test files exist, no source module): flow-integration, curiosity-spiral, belief-continuity, futures-release.

---

## 8. Infrastructure — 9 files + 1 root

| Directory | Files |
|-----------|-------|
| `gymnasium/` | harness, index, runner, scorecard, types (5) |
| `problem-sets/` | index, loaders, types (3) |
| Root | test-pulse-accuracy.ts (1) |

Self-train tests: `self-train.test.ts` — 48 tests across 10 superintelligence requirements.

---

## The Numbers

| Category | Count | Status |
|----------|-------|--------|
| DANCE direct | 35 | Alive |
| DANCE indirect | 12 | Load-bearing |
| Tools-only | 5 | Alive |
| Living loop | 7 | Waiting (foundation) |
| Shared (used) | 3 | Infrastructure |
| L0 (used) | 8 | Alive |
| L0 (floating-only deps) | 3 | Conditional |
| L0 (test-only) | 1 | Conditional |
| Shared (orphaned) | 4 | Archive candidate |
| L0 (archive) | 28 | Archive candidate |
| Floating (L1-L9) | 24 | Unwired |
| Infrastructure | 9 | Benchmark/training |
| Root utility | 1 | Utility |
| **Total** | **140** | |

67 alive. 7 waiting. 56 floating or archivable. 10 infrastructure.

---

## The Reframe

The living loop is the substrate. DANCE is the cycle that runs on it. Everything else earns its place by connecting to one of those two.

Right now DANCE runs without the living loop — it fires on hooks, not on a heartbeat. When the living loop activates, DANCE becomes the processing that happens between heartbeats. The 35 direct modules and 12 indirect dependencies are the nervous system. The 5 tool modules are the hands. The 28 L0 archive candidates and 24 floating modules are ideas that were built but never connected — some worth wiring in, some worth letting go.

The governance layer (L8) being completely floating is the most telling gap. The system can think, feel, remember, and speak — but it can't yet govern itself.
