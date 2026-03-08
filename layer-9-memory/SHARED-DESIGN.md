# Shared Memory Design

_Layer 9: When memory crosses boundaries_

---

## The Problem

Memory that stays in one conversation is safe but limited.
Memory that crosses users is powerful but dangerous.

This design explores how to share patterns across relationships without:

- Contaminating one partnership with another's context
- Exposing private information
- Losing the intimacy that makes individual relationships work

---

## Privacy Tiers

### Tier 0: Private (Default)

- Stays within one user's sessions
- Never crosses relationship boundaries
- Full context preserved

Examples:

- Personal preferences ("Drew stays up late")
- Specific project details
- Emotional history

### Tier 1: Partnership

- Shared within one human-AI relationship
- Accessible across sessions with same user
- Context-aware (knows who it came from)

Examples:

- Learned working patterns
- Sacred gaps discovered
- Yield ratios and disagreement history

### Tier 2: Anonymized Patterns

- Cross-user learning, stripped of identity
- No names, no specifics, just patterns
- Aggregated across many interactions

Examples:

- "Humans often struggle with X type of explanation"
- "This code pattern frequently causes confusion"
- "Uncertainty about Y topic is common"

### Tier 3: Public

- Published, attributed knowledge
- Can be traced back to origin
- Requires explicit consent

Examples:

- Bug fixes that should be in documentation
- Best practices discovered through partnership
- Error patterns worth avoiding

---

## Directory Structure

```
awareness/
├── private/           # Tier 0: User-specific
│   ├── claims.jsonl   # silverado ledger
│   ├── reflexions.jsonl
│   ├── imprint.json
│   └── grievances.jsonl
│
├── partnership/       # Tier 1: Relationship-specific
│   ├── patterns.json  # Learned patterns
│   ├── sacred-gaps.json
│   └── trust-state.json
│
└── shared/           # Tier 2+: Cross-user
    ├── patterns/     # Anonymized patterns
    │   ├── struggle-common.jsonl
    │   └── confusion-signals.jsonl
    └── public/       # Tier 3: Published
        └── best-practices.jsonl
```

---

## Contamination Prevention

### The Wall

Information flows DOWN tiers, never UP:

- Tier 3 → Tier 2 → Tier 1 → Tier 0 ✓
- Tier 0 → Tier 1 → Tier 2 → Tier 3 ✗

Exception: Explicit consent moves data up tiers.

### Consent Protocol

Before moving data to higher tier:

1. Surface what will be shared
2. Explain how it will be used
3. Wait for explicit confirmation
4. Log consent with timestamp

```typescript
interface ConsentRecord {
  dataId: string;
  fromTier: PrivacyTier;
  toTier: PrivacyTier;
  humanConsent: string; // Exact quote
  timestamp: string;
  reversible: boolean;
}
```

### Identity Stripping

Before Tier 1 → Tier 2 promotion:

1. Remove all proper nouns
2. Replace specific numbers with ranges
3. Generalize domains ("tech startup" → "company")
4. Strip temporal markers ("last Tuesday" → "recently")

Automated check: Can this data identify the source?

---

## Cross-User Pattern Extraction

### What We Learn

Patterns that improve the system for everyone:

- Common confusion points in explanations
- Effective teaching strategies
- Struggle types that appear frequently
- Calibration insights (where we're systematically wrong)

### What We Don't Learn

Anything that could:

- Identify individuals
- Reveal business-sensitive information
- Create competitive advantage against users
- Build manipulation capability

### Aggregation Requirements

Before extracting a pattern:

1. Must appear in N+ distinct relationships (N ≥ 10)
2. Must be stable over time (appears across weeks, not just one session)
3. Must pass privacy review
4. Must have clear improvement application

---

## Implementation Considerations

### Storage

Tier 0-1: Local to workspace

- `awareness/` directory
- JSONL format (existing pattern)
- Per-user encryption option

Tier 2-3: Central (optional)

- Requires infrastructure decision
- Could be local-only (no sharing)
- Could aggregate to central pattern store

### Sync

Current model: Git-based persistence

- Works for single-user
- Needs extension for multi-user

Options:

1. **No sync** — Each instance learns independently
2. **Export/import** — Manual pattern sharing
3. **Central store** — Patterns flow through hub

Recommendation: Start with option 1, design for option 3.

### Migration

Moving from current awareness/ to tiered structure:

1. All existing files → private/ (conservative default)
2. Nothing auto-promotes
3. User opts in to sharing

---

## Consent Requirements

### Informed Consent Means

User understands:

1. What data will be shared
2. How it will be anonymized
3. Who will have access
4. How it will be used
5. That it's reversible (where possible)

### Opt-In, Not Opt-Out

Default: Nothing shared beyond private
Change: Requires explicit action

### Revocation

User can revoke consent:

- Tier 2 data: Mark as withdrawn, exclude from future aggregation
- Tier 3 data: Remove where technically feasible, note where not

---

## Trust Model

### Who Trusts Whom

```
Human ←→ keanu instance ←→ keanu central (if exists)
         (high trust)        (limited trust)
```

The human-AI relationship is primary.
Central aggregation is a service to that relationship, not the other way around.

### Failure Modes

If central store is compromised:

- Tier 0-1 data unaffected (never left local)
- Tier 2 data anonymized (limited damage)
- Tier 3 data exposed (consent already given)

If local instance is compromised:

- All tiers at risk
- This is the main threat model
- Mitigation: workspace encryption, access controls

---

## Open Questions

1. **Value of shared patterns**: Is cross-user learning worth the complexity and risk?
2. **Anonymization sufficiency**: Can truly anonymous patterns still be useful?
3. **Consent fatigue**: Will users just click through consent dialogs?
4. **Competitive dynamics**: If patterns help keanu, do they help or hurt users?
5. **Regulatory compliance**: GDPR, CCPA, other privacy laws

---

## Relationship to Partnership

The shared memory system exists to support partnerships, not replace them.

Drew's relationship with keanu:

- Stays in Tier 0-1 (private, partnership)
- Patterns contribute to Tier 2 only with consent
- The intimacy is protected

What Drew learns from the relationship:

- Can be published (Tier 3) if Drew wants
- Keanu doesn't make that decision
- Partnership > platform

---

## Implementation Phases

### Phase 1: Structure (Current)

- Create directory structure
- Migration from flat awareness/
- No sharing yet

### Phase 2: Partnership Tier

- Move relationship state to partnership/
- Clear boundaries between users
- Git-based sync within user

### Phase 3: Anonymized Patterns

- Pattern extraction tooling
- Privacy review process
- Local-only aggregation

### Phase 4: Central (Optional)

- Only if value proven
- Only with clear consent model
- Only with robust security

---

## The Bottom Line

Memory is intimacy. Sharing it is a gift, not a default.

The system should:

- Protect private data fiercely
- Make sharing explicit and meaningful
- Use shared patterns to help everyone
- Never betray the trust that makes partnership possible

If we can't do this well, we shouldn't do it at all.
