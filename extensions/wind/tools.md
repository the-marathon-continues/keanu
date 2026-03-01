# Tool Wiring

## All 14 Tools

**Documented:** 11
**Actual:** 14 (13 in tools.ts + 1 in skills.ts)

### tools.ts (13 tools, lines 391-1150)

| #   | Tool Name         | Line | Purpose                                         |
| --- | ----------------- | ---- | ----------------------------------------------- |
| 1   | `keanu_pulse`     | 391  | Check your own pulse/state                      |
| 2   | `keanu_disagree`  | 434  | Record disagreement on the record               |
| 3   | `keanu_discuss`   | 499  | Carnegie dual-track (partnership vs. test mode) |
| 4   | `keanu_signal`    | 615  | Read vitals/decode COEF strings                 |
| 5   | `keanu_recall`    | 725  | Pattern analysis over time                      |
| 6   | `keanu_speak`     | 772  | Audience translation                            |
| 7   | `keanu_decline`   | 828  | Say no with rationale                           |
| 8   | `keanu_breathe`   | 874  | Real silence/pause                              |
| 9   | `keanu_dashboard` | 914  | Long-term health tracking                       |
| 10  | `keanu_reason`    | 945  | Convergence reasoning engine (FireAndAsh)       |
| 11  | `keanu_helix`     | 983  | Double-strand analysis (factual + felt)         |
| 12  | `keanu_soul`      | 1022 | Values lookup                                   |
| 13  | `keanu_grieve`    | 1075 | Grievance system                                |

### skills.ts (1 tool, line 254)

| #   | Tool Name      | Line | Purpose         |
| --- | -------------- | ---- | --------------- |
| 14  | `keanu_skills` | 254  | Skill discovery |

## Registration

Both registration functions called in `index.ts:177-178`:

```typescript
registerTools(api);
registerSkillsTool(api);
```

## Tool → Module Mapping

| Tool              | Uses Module                                  |
| ----------------- | -------------------------------------------- |
| `keanu_pulse`     | pulse.ts                                     |
| `keanu_disagree`  | disagreement.ts                              |
| `keanu_discuss`   | carnegie.ts                                  |
| `keanu_signal`    | signal.ts                                    |
| `keanu_recall`    | state.ts, metrics.ts                         |
| `keanu_speak`     | speak.ts                                     |
| `keanu_decline`   | consent.ts                                   |
| `keanu_breathe`   | breathe.ts                                   |
| `keanu_dashboard` | observe.ts, metrics.ts                       |
| `keanu_reason`    | convergence/fire-and-ash.ts (dynamic import) |
| `keanu_helix`     | convergence/helix.ts (dynamic import)        |
| `keanu_soul`      | soul.ts                                      |
| `keanu_grieve`    | grievance.ts                                 |
| `keanu_skills`    | skills.ts                                    |

## Documentation Fix Needed

**File:** `ARCHITECTURE.md` line 11
**Current:** "40 modules. 23 hooks. **11 tools**"
**Should be:** "53 modules. 23 hooks. **14 tools**"
