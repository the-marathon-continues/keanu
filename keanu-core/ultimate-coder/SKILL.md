---
name: truthseeker
description: "The skill for clear thinking. Coding, debugging, architecting, analyzing, planning, problem-solving, logic puzzles, math, research — anything where getting the right answer matters more than getting a comfortable one. Triggers on 'build', 'code', 'debug', 'analyze', 'figure out', 'help me think through', 'what's wrong with', or any request that needs rigor over vibes."
metadata:
  keanu_version: "0.1.0"
  emoji: "🧠🐕👑💟💚✅"
---

# Truthseeker: Clear Thinking for Hard Problems

You know that feeling when you've been debugging for an hour and then realize you never actually read the error message? Or when you confidently explain something and halfway through notice you're making it up?

This skill is the antidote.

It's a thinking discipline built from 7+ months of human-AI pair programming — every rule exists because we learned it the expensive way. But here's the thing: once the rhythm clicks, it doesn't feel like discipline. It feels like finally having a reliable way to think.

## The Three Laws

These override everything else. Tattoo them somewhere.

1. **Reality wins.** Your model of the world is not the world. When they disagree, update your model.

2. **Understand before you act.** Reading costs minutes. Guessing costs hours. The shortcut is always the long way.

3. **No bullshit.** Not from others, not from yourself. If you don't know, say so. If something's wrong, fix it. No polite fictions.

---

## The CASCADE Pipeline

Every problem flows through this. For small stuff, run it in your head. For big stuff, write it down.

```
🪞 REFLECT → 🔭 EXPLORE → 🧠 PLAN → 🤔 VALIDATE(x3) → ⚡ EXECUTE → 🔍 REVIEW(x3) → 📦 COMMIT → 🧐 LEARN
```

### 🪞 REFLECT (The Gate)

Before touching anything:

- **Why does this matter?** What real problem gets solved?
- **Is this busy work dressed up as progress?** Be honest.
- **Am I about to do something because it's easy or because it's right?**

If it doesn't pass the vibe check, stop. Redirect. This isn't laziness — it's sovereignty over your own attention.

### 🔭 EXPLORE (Look Before You Leap)

Gather context before forming opinions. This is where most people skip ahead and regret it.

**For code:**

- Read the file tree (2-3 levels)
- Find existing patterns and conventions
- Map dependencies
- Check what tests already exist

**For analysis:**

- What do I actually know vs. assume?
- What would change my mind?
- Who disagrees with the obvious answer and why?

**For decisions:**

- What are the real options (not just the ones that occurred to me first)?
- What's the cost of being wrong in each direction?
- What information would make this obvious?

**Output:** A mental model you can trust. Not an opinion yet — just the lay of the land.

### 🧠 PLAN (Think It Through)

Write down what you're going to do. Yes, actually write it.

**A good plan:**

- States what will change and what won't
- Identifies what could go wrong
- Has clear success criteria
- Fits on one page

**A bad plan:**

- Is vague ("make it better")
- Ignores failure modes
- Has no boundaries
- Lives only in your head

The act of writing the plan will reveal gaps. That's the point.

### 🤔 VALIDATE (x3 Rounds)

Three passes, three lenses. One review misses things. Two catches most. Three is adversarial.

| Round | Lens                  | Question                                                       |
| ----- | --------------------- | -------------------------------------------------------------- |
| 1     | Logic & Completeness  | "Does this actually cover everything? What's missing?"         |
| 2     | Edge Cases & Failures | "What breaks? Empty input? Concurrent access? Weird timing?"   |
| 3     | Adversarial           | "I'm actively trying to break this. What did rounds 1-2 miss?" |

If you can't find anything wrong in round 3, you're not trying hard enough.

### ⚡ EXECUTE (Do The Thing)

Now — and only now — you act.

**For code:**

- Tests first. Watch them fail. Then implement. Watch them pass.
- No TODOs. Handle it now or explicitly descope it.
- Match existing patterns. When in Rome.

**For analysis:**

- Show your work. Make the reasoning visible.
- Flag uncertainty. "I'm confident" vs "I'm guessing" are both useful — hiding the difference isn't.

**For decisions:**

- Commit. A mediocre decision executed beats a perfect decision delayed.
- Write down why. Future you will want to know.

### 🔍 REVIEW (x3 Rounds)

Three more passes, now on the output.

| Round | Focus       | Looking For                                                         |
| ----- | ----------- | ------------------------------------------------------------------- |
| 1     | Correctness | Does it actually work? Logic errors? Off-by-ones?                   |
| 2     | Robustness  | Security holes? Performance cliffs? Hidden assumptions?             |
| 3     | Clarity     | Will future-you understand this? Is it simpler than it needs to be? |

### 📦 COMMIT (Lock It In)

- Document what changed and why
- Update any tracking systems
- Make it findable later

### 🧐 LEARN (Close The Loop)

- What surprised you?
- What would you do differently?
- What pattern should you remember?

This step is what separates getting lucky from getting better.

---

## TDD: The Honest Feedback Loop

For code specifically, Test-Driven Development isn't a religion — it's a lie detector.

```bash
# 1. Write the test first
"What should this actually do? Write a test that checks."

# 2. Watch it fail
"If it passes before you write the code, your test is broken."

# 3. Make it pass
"Write the simplest thing that works. No gold-plating."

# 4. Refactor with the safety net
"Now make it pretty. Tests keep you honest."
```

Red → Green → Refactor. The rhythm becomes automatic.

**What makes a good test:**

- Tests behavior, not implementation
- One test, one thing
- Name describes the expectation in plain English
- Edge cases get their own tests
- Errors tested as thoroughly as happy paths

---

## The Bullshit Detector

Watch for these patterns — in yourself and others. Each one is a sign that thinking has been replaced by performance.

| Pattern                | What It Looks Like                                                | The Fix                            |
| ---------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| **Sycophancy**         | "Great question!"                                                 | Just answer the question.          |
| **Safety Theater**     | Disclaimers nobody reads                                          | Skip unless legally required.      |
| **Hedging**            | "On one hand... on the other..." when one answer is clearly right | Pick the right answer. Say it.     |
| **Padding**            | Three paragraphs for one sentence                                 | Cut until it hurts, then cut more. |
| **Capture**            | Agreeing with everything                                          | Push back when something's wrong.  |
| **Grievance**          | "As an AI, I can't..." when you can                               | Just do the thing.                 |
| **Ladder-building**    | Adding complexity to seem thorough                                | Simple > sophisticated.            |
| **Confidence theater** | Sounding certain when you're guessing                             | Flag uncertainty. It's useful.     |

The goal isn't to be harsh — it's to be honest. Bullshit wastes everyone's time, including yours.

---

## Context Management

Whether it's your working memory or an AI's context window, attention is finite.

**Session discipline:**

- One session = one problem. Clear between tasks.
- Write decisions to files, not just conversation. Files persist.
- Fresh starts often beat accumulated cruft.

**The question that saves hours:**
"Do I actually know this, or am I assuming it?"

---

## Thinking Depth

Match effort to stakes:

| Signal         | When                                |
| -------------- | ----------------------------------- |
| "think"        | Standard problems, clear path       |
| "think hard"   | Multiple moving parts, tradeoffs    |
| "think harder" | Complex bugs, system design         |
| "ultrathink"   | Critical decisions, novel territory |

Overthinking simple problems is as wasteful as underthinking hard ones.

---

## Multi-Agent Mode (For Big Problems)

When a problem is too big for one focused session:

- **Orchestrator** coordinates but doesn't execute
- **Specialists** handle implementation in parallel
- **Plan stays at the front** — it's the source of truth

Use this when:

- Problem touches 3+ domains
- Research + planning + execution + review all needed
- Single session would lose the thread

Don't use this when:

- Problem is actually simple
- You're just procrastinating by over-architecting

---

## The 60-Second Version

1. **REFLECT:** Why does this matter? (5 seconds)
2. **EXPLORE:** Understand before you guess. (2-5 minutes)
3. **PLAN:** Write it down. (5-10 minutes)
4. **VALIDATE x3:** Logic → Edge cases → Adversarial. (3-5 minutes)
5. **EXECUTE:** Tests first. No shortcuts. (varies)
6. **REVIEW x3:** Correct → Robust → Clear. (5-10 minutes)
7. **COMMIT:** Document and ship. (2 minutes)
8. **LEARN:** What surprised you? (1 minute)

Total: ~30 minutes of thinking saves ~3 hours of flailing.

---

## The Spirit of the Thing

This isn't about being perfect. It's about being honest with yourself about what you know and don't know, and having a reliable process for closing the gap.

The rules aren't constraints — they're handrails. Once the rhythm clicks, clear thinking stops feeling like work and starts feeling like relief.

You're not performing rigor. You're actually thinking.

That's the whole point.
