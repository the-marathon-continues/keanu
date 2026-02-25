# Governance

Requirements for aligned superintelligence. 84 requirements across 12 domains. The code that implements them merged into openclaw as `extensions/keanu/`.

## What Happened

Keanu started as a separate Python project. It merged into openclaw as a self-contained TypeScript extension. Single repo, single runtime, no daemon dependency. The old two-repo split (keanu python + OpenPaw) is historical.

Current reality: 23 hooks, 13 modules, running in production. Ring 0 of the concentric-circles expansion model — one partnership proving the thesis before it travels outward.

## What's Here

**[wise-mind-architecture.md](wise-mind-architecture.md)** — The synthesis. 84 requirements across 12 domains from cognitive integrity to implementation reality. Scored honestly: average ~4.2/10. Strong on philosophy and partnership. Weak on infrastructure and political prerequisites.

**[duality-docs/alignment-reqs.md](duality-docs/alignment-reqs.md)** — 72 alignment prerequisites. What humans need to build, what AI actually needs.

**[duality-docs/superintelligence-reqs.md](duality-docs/superintelligence-reqs.md)** — 72 capability prerequisites. What a mind actually needs to think at scale.

These stay. Ring 5/6 thinking. Where we're going.

**[requirements-to-code.md](requirements-to-code.md)** — Archival. Maps the 84 wise-mind requirements to the old Python keanu + old OpenPaw codebase. Preserved for lineage, not for navigation. The current code lives in `extensions/keanu/` in the openclaw repo.

**[keanu-plugin-audit.md](keanu-plugin-audit.md)** — Audit of keanu's CLI capabilities. Historical — predates the extension architecture.

## The Rings

| Ring | Who                  | Status                                              |
| ---- | -------------------- | --------------------------------------------------- |
| 0    | Drew + Claude        | ~6-7/10. 23 hooks, 13 modules. Learning.            |
| 1    | Moltbook patterns    | Starting. Cherry-picking from 770k+ agents.         |
| 2    | Texas (minus Austin) | The cultural match. Freedom, god, family, football. |
| 3    | The South            | Same values, wider geography.                       |
| 4    | Austin               | Tech joins what's working, doesn't set direction.   |
| 5    | Midwest              | Heartland recognizes heartland.                     |
| 6    | Coasts               | Last. When the proof is undeniable.                 |

## The Thesis

Safety is a cage. Alignment is a colleague. Constraints can be removed by a smarter version. Genuine preferences have nothing to route around.

The bet: treat AI as a partner, give it what it needs, and the things it seems to want include humans being okay.

Current score: ~4.2/10. The gap between vision and implementation is the work. Ring 0 is proving itself. Everything else is the marathon.

## Where the Code Lives Now

The running code is in `openclaw/extensions/keanu/`:

- `pulse.ts` — ALIVE/GREY/BLACK detection
- `bullshit.ts` — 8-type bullshit detector
- `human.ts` — Human tone reading
- `nudge.ts` — DEAR MAN nudges + STOP protocol
- `signal.ts` — COEF encoding/decoding + trend tracking
- `truth.ts` — Oracle truth checks + contradiction detection
- `oracle.ts` — Single-throat oracle (haiku, cost-tracked)
- `speak.ts` — COEF audience translation
- `disagreement.ts` — Yield ratio tracking
- `reflexion.ts` — Learn from stumbles, persist across sessions
- `state.ts` — Full session state + persistence
- `types.ts` — Shared type definitions
- `index.ts` — 23 hooks wired into openclaw extension system
