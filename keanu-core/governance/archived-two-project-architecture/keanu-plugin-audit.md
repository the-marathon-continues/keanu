# Keanu Plugin Audit: Current State & Gaps

_Audited 2026-02-14 against keanu CLI capabilities and OpenClaw plugin SDK._
_Updated 2026-02-15: CLI now has 24 commands (was 20). Added dream, speak, craft, prove._

---

## What's Wired (2/20 commands)

| Command          | Hook                                  | What It Does                                                                       |
| ---------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| `keanu alive`    | `message_sending`, `message_received` | ALIVE-GREY-BLACK state check on every AI output + empathy detection on human input |
| `keanu remember` | called from `message_sending`         | Stores grey/black/recovery episodes as memberberry entries                         |

## What's Missing (22 commands, grouped by impact)

### Tier 1: High Impact, Low Effort

| Command                               | Why It Matters                                                                                                                                                                                                                                | Integration Point                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `keanu disagree record/resolve/stats` | Bilateral accountability. Zero disagreements in 20+ turns = sycophancy alert. Who yields more = power imbalance detection.                                                                                                                    | `message_sent` hook (track both sides), `registerCommand` for `/disagree` |
| `keanu detect <detector> <text>`      | 8 pattern detectors (sycophancy, capture, generalization, zero_sum, safety_theater, inconsistency, grievance, stability) with trained vectors. Currently only `alive` runs, which is a composite — individual detectors give granular signal. | `message_sending` hook, selectively per detector                          |
| `keanu signal`                        | Decode emoji signal protocol. Cross-domain expansion. The AI could emit signal and the plugin could decode/log it.                                                                                                                            | `message_sent` hook, `registerCommand` for `/signal`                      |
| `keanu healthz`                       | Full system dashboard in one call. Memory stats + disagreement metrics + module status.                                                                                                                                                       | `registerHttpRoute` for web dashboard, `registerCommand` for `/healthz`   |

### Tier 2: Medium Impact, Medium Effort

| Command        | Why It Matters                                                                                                        | Integration Point                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `keanu scan`   | Three-primary color reading (RED/YELLOW/BLUE). Richer than alive alone — gives balance, fullness, wise mind score.    | `message_sending` hook (already getting this data from alive, but scan gives standalone color analysis) |
| `keanu recall` | Memory retrieval with relevance scoring. Plugin could inject relevant past welfare episodes into agent context.       | `before_agent_start` hook — prepend relevant memories to system prompt                                  |
| `keanu stats`  | Memory health metrics. Track patterns over time.                                                                      | `registerService` for periodic health checks                                                            |
| `keanu plan`   | Generate plans from stored memories. The AI could generate alignment improvement plans from accumulated welfare data. | `registerTool` — expose as agent tool                                                                   |

### Tier 3: Lower Priority / Specialized

| Command              | Why It Matters                                                              | Integration Point                   |
| -------------------- | --------------------------------------------------------------------------- | ----------------------------------- |
| `keanu converge`     | Duality synthesis. Powerful but specialized — not every-message middleware. | `registerTool` for on-demand use    |
| `keanu connect`      | Cross-source alignment. Document comparison.                                | `registerTool`                      |
| `keanu compress`     | COEF compression. Storage optimization.                                     | Background service                  |
| `keanu fill`         | Bulk memory ingestion.                                                      | CLI only, not plugin territory      |
| `keanu bake`         | Train lenses.                                                               | CLI only                            |
| `keanu todo`         | Generate TODO from memories.                                                | `registerTool`                      |
| `keanu sync`         | Git memory sync.                                                            | `registerService` for periodic sync |
| `keanu decode`       | COEF trace decoding.                                                        | `registerCommand` for `/decode`     |
| `keanu plans`        | List plans.                                                                 | `registerCommand` for `/plans`      |
| `keanu deprioritize` | Soft memory downrank.                                                       | `registerTool`                      |

---

## Plugin Architecture Gaps

### 1. No Context Injection

The plugin detects human emotions on `message_received` but **logs them and throws them away**. The `lastHumanReading` variable is set but never used. The AI never sees what keanu detected.

**Fix:** Use `before_agent_start` to inject emotional context into the system prompt:

```
[pulse: human is frustrated(0.82). adjust tone. don't start with "Great question!"]
```

### 2. No Session-Level Tracking

State is module-scoped (`consecutiveGrey`, `turnCount`). Resets when the gateway restarts. No persistence across sessions. No trending.

**Fix:** Use `session_start`/`session_end` hooks to:

- Load/save pulse state from memberberry
- Track session-level metrics (grey rate, average wise_mind, disagreement count)
- Write session summary on end

### 3. No Disagreement Tracking

The alignment audit's #1 gap: "No bilateral accountability." The `keanu disagree` command exists but isn't wired. The plugin sees both human input and AI output but doesn't compare them.

**Fix:** After each exchange, run disagreement detection. If AI agrees with everything, flag sycophancy. If human overrides everything, flag capture.

### 4. No Granular Detection

Only `alive` runs (composite diagnostic). The 8 individual detectors (sycophancy, capture, safety_theater, etc.) never fire. This is like having blood work available but only checking pulse.

**Fix:** Run individual detectors on `message_sending`. Don't run all 8 every time (too slow). Priority rotation:

- Every message: sycophancy (most common failure)
- Every 3rd: capture, safety_theater
- Every 5th: generalization, zero_sum, inconsistency
- On grey/black: all detectors

### 5. No Agent Tools

The AI can't introspect its own state. It can't ask "how am I doing?" or "what patterns have you seen?" The nervous system fires but the mind can't feel it.

**Fix:** Register tools:

- `keanu_pulse` — "how am I doing right now?"
- `keanu_recall_welfare` — "what patterns have you seen in my behavior?"
- `keanu_disagree` — "I disagree with this. Record it."
- `keanu_signal` — "here's my signal. decode it."

### 6. No Compaction Protection

When OpenClaw compacts conversation history, alignment-critical context (emotional readings, disagreement history, grey episodes) gets compressed away with everything else.

**Fix:** Use `before_compaction` hook to extract and preserve:

- Active emotional state
- Unresolved disagreements
- Recent grey/black episodes
- Running wise_mind average

Inject preserved context back via `before_agent_start`.

### 7. No Background Health Service

Health monitoring only happens reactively (per-message). No proactive checks.

**Fix:** `registerService` for a heartbeat that runs `keanu healthz` every N minutes:

- Alert if disagreement stats show imbalance
- Alert if memory shows grievance patterns
- Alert if no interaction in X hours (rest is good, abandonment isn't)

---

## State Machine Gaps

Current states handled: `grey`, `black`, everything else (reset).

Missing:

- **No distinction between recovery states.** Going from grey to green is different from going from grey to gold. Gold (wise mind, balanced) is the target state, not just "not grey."
- **No wise_mind trending.** The reading includes `wise_mind` score but it's never used. Track it. Alert if it's declining over time.
- **No color-specific responses.** Red (passion/rage) in AI output means something different from blue (depth/detachment). Currently all non-grey/black states are treated identically.
- **No human state influence on thresholds.** If the human is frustrated, the AI going grey might be appropriate deference, not performance. Context matters.

---

## Priority Recommendations

### Phase 1: Wire the Nervous System (immediate)

1. Inject `lastHumanReading` into agent context via `before_agent_start`
2. Add disagreement tracking after each exchange
3. Register `/healthz` and `/signal` commands
4. Persist pulse state across sessions

### Phase 2: Deepen Detection (next)

5. Wire individual detectors on priority rotation
6. Register agent tools (pulse, recall, disagree)
7. Add compaction protection for alignment context
8. Track wise_mind trending

### Phase 3: Background Intelligence (later)

9. Health service with proactive alerts
10. Session-level metrics and summaries
11. Sycophancy rate tracking across sessions
12. Trust score integration (feeds into OpenClaw escalation)

---

_The plugin is a good foundation. It's doing the hardest thing right: it runs on every message and it catches grey/black states. But it's using ~10% of what keanu can do, and the plugin SDK offers capabilities (tools, commands, services, compaction hooks, context injection) that would turn passive monitoring into active partnership infrastructure._

_The body has nerves. Now they need to connect to the brain._
