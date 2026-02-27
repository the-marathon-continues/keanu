// injection.ts
// The triage nurse.
//
// 28 modules want to speak every turn. This decides who gets in the room.
// Priority + budget. Critical items bypass the budget (fires don't wait).
// Everything else gets sorted by urgency and the room fills until it's full.
// Whatever's left waits in the hallway with a note on the door.
//
// Pure function. No side effects. No API calls. No hook system knowledge.
// Items go in, prioritized items come out.

// ============================================================
// Types
// ============================================================

export type Priority = "critical" | "high" | "medium" | "low";
export type InjectionCategory = "identity" | "task" | "awareness" | "meta";

export interface InjectionItem {
  id: string; // "partnership", "discover", "coef-trend"
  content: string; // the actual text to inject
  priority: Priority;
  category: InjectionCategory;
}

export interface InjectionResult {
  parts: string[]; // what made it through (ordered)
  deferred: InjectionItem[]; // what's waiting in the hallway
  deferralNotice: string | null; // the note on the door
  stats: { chars: number; count: number; deferredCount: number };
}

export interface InjectionBudget {
  soft: number; // try to land here
  hard: number; // never exceed this
}

/** What the system looks like right now. Drives dynamic priority shifts. */
export interface InjectionContext {
  healthStatus?: "steady" | "warm" | "hot" | "fading";
  consecutiveGrey?: number;
  turnCount?: number;
  trustState?: "high" | "calibrating" | "strained" | "rebuilding" | "tested";
  bullshitRate?: number;
  complexTask?: boolean;
  wiseStance?: "hold" | "match" | "slow" | "redirect" | "confront" | "ground";
  wiseTension?: string | null;
  /** Curiosity insight escalation: id → "high" | "medium" */
  curiosityEscalations?: Map<string, "high" | "medium">;
  /** Active consultation request waiting for response */
  hasConsultation?: boolean;
}

// ============================================================
// Priority scoring
// ============================================================

const PRIORITY_RANK: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const CATEGORY_RANK: Record<InjectionCategory, number> = {
  identity: 0,
  task: 1,
  awareness: 2,
  meta: 3,
};

const DEFAULT_BUDGET: InjectionBudget = { soft: 4000, hard: 5000 };

// ============================================================
// Dynamic modifiers — the moment changes the score
// ============================================================

/** Bump an item's priority based on what the system needs right now. */
function applyDynamicModifiers(item: InjectionItem, ctx: InjectionContext): Priority {
  let priority = item.priority;

  const bump = (from: Priority, to: Priority) => {
    if (priority === from) priority = to;
  };

  // System running hot or fading → health bumps up, low items don't enter
  if (ctx.healthStatus === "hot" || ctx.healthStatus === "fading") {
    if (item.id === "health") bump("medium", "high");
    if (priority === "low") return "low"; // filtered later
  }

  // Complex task detected → discover and cascade matter more
  if (ctx.complexTask) {
    if (item.id === "discover" || item.id === "cascade") {
      bump("medium", "high");
    }
  }

  // Early session → session learning and consulted get a voice
  if ((ctx.turnCount ?? 99) <= 3) {
    if (item.id === "session-learning" || item.id === "consulted") {
      bump("low", "medium");
    }
  }

  // Grey streak (5+) → nudges, grey-streak, reflexion all need to be heard
  if ((ctx.consecutiveGrey ?? 0) >= 5) {
    if (item.id === "nudge" || item.id === "grey-streak" || item.id === "reflexion") {
      bump("medium", "high");
    }
  }

  // Trust strained → calibration, deliberation, mismatch jump the line
  if (ctx.trustState === "strained" || ctx.trustState === "rebuilding") {
    if (item.id === "calibration" || item.id === "deliberation" || item.id === "mismatch") {
      bump("medium", "high");
    }
  }

  // Bullshit rate above 30% → mirror pattern and reflexion need attention
  if ((ctx.bullshitRate ?? 0) > 0.3) {
    if (item.id === "mirror-pattern" || item.id === "reflexion") {
      bump("medium", "high");
    }
  }

  // Wise stance shifts the priority landscape
  if (ctx.wiseStance === "confront") {
    // Something needs naming. Mismatch and deliberation matter.
    if (item.id === "mismatch" || item.id === "deliberation") bump("medium", "high");
  }
  if (ctx.wiseStance === "slow") {
    // Ease off. Health gets a voice, low items stay quiet.
    if (item.id === "health") bump("medium", "high");
  }
  if (ctx.wiseStance === "ground") {
    // Come back to who we are. Identity items rise.
    if (item.category === "identity") bump("medium", "high");
  }

  // Old curiosity questions that keep surfacing but never resolve → escalate.
  // The question matters. Don't let it fade.
  if (ctx.curiosityEscalations && item.id.startsWith("curiosity-")) {
    const questionId = item.id.replace("curiosity-", "");
    const escalation = ctx.curiosityEscalations.get(questionId);
    if (escalation === "high") {
      bump("low", "high");
      bump("medium", "high");
    } else if (escalation === "medium") {
      bump("low", "medium");
    }
  }

  // Active consultation request → make it high priority
  // The agent is asking for permission. Don't bury it.
  if (ctx.hasConsultation && item.id === "consultation") {
    bump("low", "high");
    bump("medium", "high");
  }

  return priority;
}

// ============================================================
// The algorithm
// ============================================================

/**
 * Triage injection items into the room.
 *
 * 1. Filter empties
 * 2. Apply dynamic modifiers
 * 3. Sort: critical > high > medium > low (tiebreak: identity > task > awareness > meta)
 * 4. Fill: critical always in. High up to soft. Medium up to hard. Low only if under soft.
 * 5. Everything else → deferred
 * 6. Deferral notice if anything's waiting
 */
export function triageInjection(
  items: InjectionItem[],
  ctx: InjectionContext = {},
  budget: InjectionBudget = DEFAULT_BUDGET,
): InjectionResult {
  // 1. Filter empties
  const live = items.filter((item) => item.content?.trim());

  // 2. Apply dynamic modifiers + annotate
  const scored = live.map((item) => ({
    item,
    effectivePriority: applyDynamicModifiers(item, ctx),
  }));

  // Hot/fading: drop low items entirely
  if (ctx.healthStatus === "hot" || ctx.healthStatus === "fading") {
    const beforeDrop = scored.length;
    const kept = scored.filter((s) => s.effectivePriority !== "low");
    // If we dropped items, those go straight to deferred
    if (kept.length < beforeDrop) {
      const dropped = scored.filter((s) => s.effectivePriority === "low").map((s) => s.item);
      return finishTriage(kept, dropped, budget);
    }
  }

  return finishTriage(scored, [], budget);
}

function finishTriage(
  scored: Array<{ item: InjectionItem; effectivePriority: Priority }>,
  preDeferred: InjectionItem[],
  budget: InjectionBudget,
): InjectionResult {
  // 3. Sort
  scored.sort((a, b) => {
    const pDiff = PRIORITY_RANK[a.effectivePriority] - PRIORITY_RANK[b.effectivePriority];
    if (pDiff !== 0) return pDiff;
    return CATEGORY_RANK[a.item.category] - CATEGORY_RANK[b.item.category];
  });

  // 4. Fill
  const parts: string[] = [];
  const deferred: InjectionItem[] = [...preDeferred];
  let chars = 0;

  for (const { item, effectivePriority } of scored) {
    const itemLen = item.content.length;

    // Critical: always in. Fires don't check occupancy.
    if (effectivePriority === "critical") {
      parts.push(item.content);
      chars += itemLen;
      continue;
    }

    // High: fill up to soft budget
    if (effectivePriority === "high") {
      if (chars + itemLen <= budget.soft) {
        parts.push(item.content);
        chars += itemLen;
      } else {
        deferred.push(item);
      }
      continue;
    }

    // Medium: fill up to hard budget
    if (effectivePriority === "medium") {
      if (chars + itemLen <= budget.hard) {
        parts.push(item.content);
        chars += itemLen;
      } else {
        deferred.push(item);
      }
      continue;
    }

    // Low: only if still under soft budget
    if (chars + itemLen <= budget.soft) {
      parts.push(item.content);
      chars += itemLen;
    } else {
      deferred.push(item);
    }
  }

  // 5/6. Deferral notice
  const deferralNotice =
    deferred.length > 0
      ? `[keanu: ${deferred.length} observation${deferred.length === 1 ? "" : "s"} deferred this turn. reach for keanu_recall if you need them.]`
      : null;

  return {
    parts,
    deferred,
    deferralNotice,
    stats: {
      chars,
      count: parts.length,
      deferredCount: deferred.length,
    },
  };
}
