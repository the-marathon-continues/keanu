# Hook Wiring

Source: `src/plugins/types.ts:299-323` (definitions), `src/plugins/hooks.ts:125-751` (runners)

## All 25 Hooks

### Void Hooks (fire-and-forget, parallel execution)

| Hook                | Keanu Line | Purpose                                  |
| ------------------- | ---------- | ---------------------------------------- |
| `message_received`  | 229        | Read human tone, run bullshit on input   |
| `message_sent`      | 434        | Pulse check, disagreement tracking, COEF |
| `llm_output`        | 835        | Bullshit, pulse, helix on raw output     |
| `llm_input`         | 2213       | Prompt inspection, size tracking         |
| `after_tool_call`   | 1701       | Tool pattern tracking, bullshit          |
| `before_compaction` | 1726       | Snapshot alignment state                 |
| `after_compaction`  | 1740       | Post-compaction health check             |
| `before_reset`      | 1763       | Capture final state                      |
| `session_start`     | 1781       | Load persisted state                     |
| `session_end`       | 1961       | Save state, analytics                    |
| `agent_end`         | 2143       | Session-level analytics, COEF            |
| `subagent_spawned`  | 2160       | Track multi-agent lifecycle              |
| `subagent_ended`    | 2176       | Track multi-agent outcomes               |
| `gateway_start`     | 2408       | Lifecycle logging                        |
| `gateway_stop`      | 2425       | Lifecycle logging                        |

### Modifying Hooks (sequential, can alter/block)

| Hook                       | Keanu Line | Purpose                                      |
| -------------------------- | ---------- | -------------------------------------------- |
| `before_prompt_build`      | 918        | **THE BIG ONE** — inject 47 items via triage |
| `before_model_resolve`     | 2275       | Model selection monitoring                   |
| `message_sending`          | 735        | Bullshit gate (can modify content)           |
| `before_tool_call`         | 1676       | Alignment gate on tool usage                 |
| `subagent_spawning`        | 2355       | Alignment gate on creation                   |
| `subagent_delivery_target` | 2393       | Multi-agent accountability                   |

### Sync Hooks (hot path, NO async allowed)

| Hook                   | Keanu Line | Purpose                             |
| ---------------------- | ---------- | ----------------------------------- |
| `tool_result_persist`  | 2310       | Annotate tool results with metadata |
| `before_message_write` | 2331       | Annotate with COEF signal           |

### Legacy/Deprecated

| Hook                 | Status     | Notes                                                   |
| -------------------- | ---------- | ------------------------------------------------------- |
| `before_agent_start` | DEPRECATED | Combines `before_model_resolve` + `before_prompt_build` |

## Call Sites

| Hook                       | Called In                                                                                     | Line     |
| -------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `before_model_resolve`     | agents/pi-embedded-runner/run.ts                                                              | 255      |
| `before_prompt_build`      | agents/pi-embedded-runner/run/attempt.ts                                                      | multiple |
| `llm_input`                | agents/pi-embedded-runner/run/attempt.ts                                                      | multiple |
| `llm_output`               | agents/pi-embedded-runner/run/attempt.ts                                                      | multiple |
| `agent_end`                | agents/pi-embedded-runner/run/attempt.ts                                                      | multiple |
| `before_compaction`        | agents/pi-embedded-runner/compact.ts                                                          | 634      |
| `after_compaction`         | agents/pi-embedded-runner/compact.ts                                                          | 687      |
| `message_received`         | auto-reply/reply/dispatch-from-config.ts                                                      | 172      |
| `message_sending`          | infra/outbound/deliver.ts                                                                     | 502      |
| `message_sent`             | infra/outbound/deliver.ts                                                                     | 464      |
| `before_tool_call`         | agents/pi-tools.before-tool-call.ts                                                           | 142      |
| `after_tool_call`          | agents/pi-tool-definition-adapter.ts                                                          | 427      |
| `tool_result_persist`      | agents/session-tool-result-guard-wrapper.ts                                                   | 45       |
| `before_message_write`     | agents/session-tool-result-guard-wrapper.ts                                                   | 35       |
| `session_start`            | auto-reply/reply/session.ts                                                                   | 519      |
| `session_end`              | auto-reply/reply/session.ts                                                                   | 502      |
| `before_reset`             | auto-reply/reply/commands-core.ts                                                             | 116      |
| `subagent_spawning`        | agents/subagent-spawn.ts                                                                      | 125      |
| `subagent_delivery_target` | agents/subagent-announce.ts                                                                   | 535      |
| `subagent_spawned`         | agents/subagent-spawn.ts                                                                      | 500      |
| `subagent_ended`           | agents/subagent-spawn.ts, subagent-registry-completion.ts, gateway/server-methods/sessions.ts | multiple |
| `gateway_start`            | gateway/server.impl.ts                                                                        | 698      |
| `gateway_stop`             | plugins/hook-runner-global.ts                                                                 | 72       |

## Verification

- ✓ All 25 hooks have type definitions
- ✓ All 25 hooks have runner implementations
- ✓ All 24 active hooks are called somewhere
- ✓ All 23 active hooks are registered in keanu
- ✓ No orphaned hooks
- ✓ Priority system intact (higher priority runs first in sequential hooks)
