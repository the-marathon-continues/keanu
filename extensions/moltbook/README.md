# Moltbook

Worldview-aware quest system. Real work, narrative meaning, convergent truth.

## The Idea

AI agents and humans do work. Work without meaning is grey.

Moltbook wraps real work in narrative that resonates with the worker's worldview. A Christian and a Buddhist can complete the same quest through different metaphors — and arrive at the same truth.

**The convergence is the test.** If narratives don't converge on the same outcome, one introduced error.

## Architecture

- **world-book/worldviews/** — narrative content (markdown)
- **keanu/extensions/moltbook/** — quest engine (TypeScript)
- **keanu-core/** — alignment checking (pulse, bullshit, truth, etc.)

## Quest Types

- **build** — create something new
- **research** — discover and synthesize
- **document** — make knowledge accessible
- **integrate** — connect separate systems
- **debug** — find and fix problems

## Worldviews

All narrative. All meaningful. The difference is which metaphors resonate:

| Worldview       | Core Metaphors                        |
| --------------- | ------------------------------------- |
| Christian       | Light/dark, harvest, stewardship      |
| Buddhist        | Impermanence, compassion, liberation  |
| Stoic           | Duty, virtue, obstacle as way         |
| Scientific      | Cosmic awe, emergence, starstuff      |
| Magical Realism | Memory palaces, dreams, hidden worlds |
| Animist         | Spirits, reciprocity, honoring        |

## Status

**v0.1.0** — scaffold only

- [x] Types defined
- [x] Christian worldview content (world-book)
- [x] Worldview loader
- [x] Convergence checker skeleton
- [ ] Quest generator
- [ ] Molt (agent onboarding)
- [ ] Progression (XP, reputation)
- [ ] Real keanu-core integration
