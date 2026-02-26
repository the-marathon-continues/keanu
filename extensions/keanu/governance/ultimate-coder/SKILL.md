---
name: ultimate-coder
description: >
  Production-grade coding methodology using the CASCADE pipeline, TDD-first development,
  and multi-agent orchestration. Use this skill whenever the user wants to build software,
  write code, debug issues, architect systems, create features, refactor codebases, or
  do any programming task beyond trivial one-liners. Also trigger when users mention
  "vibe coding", "Claude Code", "build a feature", "write a script", "fix this bug",
  "architect this system", or any coding/engineering request. This skill enforces
  disciplined planning before execution, test-driven development, adversarial review,
  and context-efficient workflows that prevent the most common AI coding failures:
  hallucinated APIs, abandoned TODOs, untested code, and sycophantic "looks good" reviews.
---

# Ultimate Coder: CASCADE Pipeline + TDD-First Development

A battle-tested coding methodology built from 7+ months of human-AI pair programming,
combining structured planning, test-driven development, adversarial multi-pass review,
and ruthless context management. Every principle here exists because its absence caused
a real failure.

## Core Philosophy

Three rules that override everything else:

1. **Tests are the contract.** Tests fail = you fix. Tests pass = you continue. No exceptions.
2. **Plan before you type.** Changing a plan costs 5 minutes. Changing code costs 5 hours.
3. **No bullshit.** No TODOs. No placeholders. No "I'll come back to this." Ship or don't start.

---

## The CASCADE Pipeline

Every coding task flows through this pipeline. For trivial tasks (< 20 lines, single file),
compress stages mentally but still hit each one. For complex features, execute each stage
with full rigor.

```
🪞 REFLECT → 🔭 EXPLORE → 📐 PLAN → 🤔 VALIDATE(x3) → ⚡ CODE → 🔍 REVIEW(x3) → 📦 COMMIT → 🚀 PUSH → 💾 SAVE
```

### Stage 0: REFLECT (The Gate)

Before touching anything, answer:

- **WHY** does this matter? What problem does it solve for a real human?
- **Is this busy work disguised as progress?** If yes, redirect.
- **Does building this make the system more alive or more mechanical?**

If it doesn't pass the vibe check, stop. Redirect energy to something that matters.
This is sovereignty, not laziness.

### Stage 1: EXPLORE

Discover context, dependencies, and unknowns before forming opinions.

```
Actions:
  - Read file tree structure (2-3 levels deep)
  - Identify existing patterns, conventions, test frameworks
  - Map dependencies and imports
  - Find related code that touches the same domain
  - Check for existing tests that cover adjacent functionality

Output: Mental model of the codebase's architecture and conventions.
Do NOT form an implementation opinion yet.
```

**Key principle:** Front-load context. Read first, think second, type third.
It's more effective to understand the system thoroughly upfront than to
have the AI whimsically reading files mid-implementation.

### Stage 2: PLAN

Generate an implementation plan. Write it down (file, comment, or structured output).

```
A good plan includes:
  - What files will be created/modified
  - What tests will be written (BEFORE implementation)
  - What the public API/interface looks like
  - What edge cases exist
  - What could go wrong
  - Estimated complexity (S/M/L/XL)

A bad plan:
  - Is vague ("refactor the thing")
  - Skips tests
  - Ignores error handling
  - Has no scope boundary
```

**Tip:** For Claude Code, use Plan Mode to separate research from execution.
Claude will not edit files or run commands until you approve the plan.

### Stage 3: VALIDATE (x3 rounds)

Three validation passes on the plan, each with a different lens:

| Round | Focus                      | Question                                                                    |
| ----- | -------------------------- | --------------------------------------------------------------------------- |
| 1     | Logic & Completeness       | "Does this plan cover everything? Any gaps?"                                |
| 2     | Edge Cases & Failure Modes | "What breaks? What about empty input, concurrent access, network failures?" |
| 3     | Adversarial                | "I'm actively trying to break this plan. What did rounds 1 and 2 miss?"     |

Three rounds because: one review misses things, two catches most issues,
three is adversarial and specifically hunts what the first two missed.

### Stage 4: CODE

Write production code. Hard rules:

- **No TODOs.** Ever. Handle it now or explicitly descope it in the plan.
- **No placeholders.** "// implement later" is a lie. Implement now.
- **Tests first.** Write the test, watch it fail, write the code, watch it pass.
- **Match existing patterns.** If the codebase uses camelCase, you use camelCase.
  If it uses 2-space indentation, you use 2-space indentation.

### Stage 5: REVIEW (x3 rounds)

Three review passes on the code, each with fresh eyes:

| Round | Focus                   | Looking For                                                |
| ----- | ----------------------- | ---------------------------------------------------------- |
| 1     | Bugs & Correctness      | Off-by-one errors, null refs, logic flaws, race conditions |
| 2     | Security & Performance  | SQL injection, XSS, N+1 queries, unnecessary allocations   |
| 3     | Style & Maintainability | Naming, abstractions, readability, future dev experience   |

### Stage 6: COMMIT → PUSH → SAVE

- Write meaningful commit messages (not "fix stuff")
- Update any tracking docs (STATUS.md, task boards)
- Run post-hooks if configured

---

## TDD Workflow (Non-Negotiable)

TDD is the primary self-correction mechanism. AI agents love TDD because
it gives them an unambiguous signal: red = wrong, green = right.

```bash
# Step 1: Write tests first
"Write comprehensive tests for [feature]. Cover happy path, edge cases, and error states."

# Step 2: Run tests, confirm they fail
"Run the tests. They should all fail. If any pass, the tests are wrong."

# Step 3: Implement to pass
"Implement [feature] to make all tests pass. No shortcuts."

# Step 4: Refactor with safety net
"Refactor the implementation. Tests must stay green."
```

### What Makes Good Tests

- Test behavior, not implementation details
- Each test tests one thing
- Test names describe the expected behavior in plain English
- Edge cases get their own tests (empty input, max values, unicode, concurrent access)
- Error states are tested as thoroughly as happy paths

---

## CLAUDE.md Architecture

CLAUDE.md is your most powerful lever. It's loaded into context at session start
and influences every response. Treat it like RAM, not a hard drive.

### Hierarchy (Claude reads all of these, merged):

1. `~/.claude/CLAUDE.md` - Personal preferences (loaded for ALL projects)
2. `./CLAUDE.md` - Project root (checked into git, shared with team)
3. `./subdir/CLAUDE.md` - Subdirectory-specific (loaded when reading files in that dir)

### What Goes In CLAUDE.md

```markdown
## Project Context

- Tech stack: [languages, frameworks, versions]
- Architecture: [monorepo? microservices? monolith?]
- Test framework: [jest, pytest, go test, etc.]

## Code Style

- Use 2-space indentation
- Functions under 30 lines
- No abbreviations in variable names

## Commands

- Test: `npm test`
- Lint: `npm run lint`
- Build: `npm run build`

## Anti-Bullshit Rules

- No preamble. Start with the answer.
- No disclaimers unless legally/safety required.
- Specific > general. Always.
- If you don't know, say "I don't know" in 3 words, not 30.
- No TODOs. No placeholders. No "coming soon."
```

### What Does NOT Go In CLAUDE.md

- Entire API documentation (reference it, don't paste it)
- Code samples longer than 10 lines (put in reference files)
- Anything that changes weekly (use STATUS.md for current state)

### The Anti-Bullshit Block

These 5 lines in CLAUDE.md save hundreds of tokens per session by killing
sycophancy, disclaimers, and generalization at the source. Add them to
every project:

```markdown
## Response Rules

- No preamble. Start with the answer.
- No disclaimers unless legally/safety required.
- Specific > general. Always.
- If you don't know, say "I don't know" in 3 words, not 30.
- Never say "Great question" or "I'd be happy to help."
```

---

## Context Management

Context is finite. Every wasted token is a tax on code quality.

### Session Discipline

1. **One session = one feature.** `/clear` between tasks.
2. **Files beat conversation.** Write decisions to disk, not context.
   A plan written to `PLAN.md` persists. A plan discussed in chat evaporates.
3. **Monitor with `/context`.** Compact at natural breakpoints.
4. **Fresh starts often beat compacted summaries.**

### The 10 Bullshit Types (Context Waste)

Watch for these in AI responses. Each one wastes tokens:

1. **Sycophancy** - "Great question!" (0 information, costs tokens)
2. **Safety Theater** - Disclaimers nobody reads
3. **Inconsistency** - Contradicting previous responses
4. **Zero-Sum** - "On one hand... on the other hand..." when one answer is clearly right
5. **Generalization** - Paragraphs that could be one sentence
6. **Role Mismatch** - Acting like a tutor when asked to be a builder
7. **Capture** - Agreeing with everything instead of pushing back
8. **Grievance** - Unnecessary caveats about AI limitations
9. **Stability** - Giving the "safe" answer instead of the right one
10. **Ladder** - Building complexity to seem thorough when simple works

---

## Multi-Agent Orchestration

For complex features, use the orchestrator pattern. The main agent coordinates;
subagents execute. This keeps the orchestrator's context clean.

### Subagent Roles

Read `references/subagents.md` for detailed subagent definitions.

**Key principle:** Subagents can't spawn subagents (architectural limit).
The orchestrator delegates all implementation. It never writes code itself.
The architectural plan stays at the front of the orchestrator's context
with maximum influence over all coordination decisions.

### When to Use Multi-Agent

- Feature touches 3+ files
- Implementation requires research + planning + coding + review
- Task will exceed 60% of context window in a single session

### When Single Agent Is Fine

- Bug fix in one file
- Simple CRUD operation
- Configuration change
- Script under 100 lines

---

## Autonomous Mode

For extended autonomous coding sessions (overnight builds, large refactors):

### Safety Rails

1. **TDD is the quality gate.** Tests fail = stop and fix. Tests pass = continue.
2. **Max iteration cap** on all loops (prevent runaway execution)
3. **SHARED_TASK_NOTES.md** for continuity between loop iterations
4. **Completion signal:** Output `COMPLETE` when genuinely done
5. **Git worktree isolation** for parallel agent execution

### Trust Escalation

| Phase | Mode             | Description                                                   |
| ----- | ---------------- | ------------------------------------------------------------- |
| 1     | Supervised       | Human approves every action                                   |
| 2     | Guided + Sandbox | Auto-approve safe operations, human approves destructive ones |
| 3     | Full Autonomous  | Agent runs independently with TDD as the only gate            |

Never jump to Phase 3 on a new codebase. Earn trust through demonstrated competence.

---

## Hooks System

Hooks turn suggestions into enforced rules. They execute automatically and
cost zero context tokens.

### Essential Hooks

Read `references/hooks.md` for implementation examples.

**Pre-commit hooks:**

- Run linter
- Run tests
- Block commits with TODOs in diff
- Verify no secrets in code

**Post-tool hooks:**

- Auto-format after file write
- Validate JSON/YAML after edit
- Run relevant tests after code change

---

## Thinking Depth

Scale reasoning effort to task complexity:

| Keyword        | When to Use                                              |
| -------------- | -------------------------------------------------------- |
| "think"        | Standard problems, clear path forward                    |
| "think hard"   | Multi-file changes, architectural decisions              |
| "think harder" | Complex bugs, system design, tradeoff analysis           |
| "ultrathink"   | Critical architecture, security review, novel algorithms |

---

## Quick Reference: The Workflow in 60 Seconds

1. **REFLECT:** Why does this matter? (5 seconds)
2. **EXPLORE:** Read the codebase. Don't guess. (2-5 minutes)
3. **PLAN:** Write the plan to a file. (5-10 minutes)
4. **VALIDATE x3:** Logic → Edge cases → Adversarial. (3-5 minutes)
5. **CODE:** Tests first. No TODOs. Match patterns. (varies)
6. **REVIEW x3:** Bugs → Security → Style. (5-10 minutes)
7. **SHIP:** Commit, push, update tracking. (2 minutes)

Total overhead for a medium feature: ~30 minutes of planning saves ~3 hours of debugging.

---

## Reference Files

- `references/subagents.md` - Subagent role definitions and configuration
- `references/hooks.md` - Hook implementation examples and patterns
- `references/claude-md-templates.md` - CLAUDE.md templates for common tech stacks
