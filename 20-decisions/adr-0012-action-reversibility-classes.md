# ADR-0012: Action reversibility classes instead of absolute reversibility

- **Status:** accepted
- **Date:** 2026-07-17
- **Deciders:** alex
- **Related:** [ADR-0007](adr-0007-postgres-event-log-backbone.md), [ADR-0010](adr-0010-identity-as-bounded-context.md), [roadmap.md Phase 7](../00-product/roadmap.md)

## Context

Product clarification (2026-07-17) proposed the principle "every action must
be reversible", alongside immutable history, versioning over replacement, and
recoverability. For internal state these are fully adoptable and align with
the append-only event log (ADR-0007). But taken literally, absolute
reversibility is impossible for external actions — a sent email, a customer
message, a phone call cannot be unsent. A literal reading would forbid the
Employee role from ever acting autonomously toward the outside world,
crippling the product; ignoring the principle silently would be worse.

## Options Considered

### Option A — Absolute reversibility as stated
Honest consequence: no autonomous external communication, ever. Contradicts
the Employee role and P2/P5.

### Option B — Drop the principle for external actions
Autonomy without guardrails; violates the user's clear intent of safety and
recoverability.

### Option C — Reversibility classes with class-based policy
Every action is classified:

| Class | Definition | Examples | Policy |
|-------|------------|----------|--------|
| **Reversible** | Fully undoable within AIOS | internal state changes, drafts, scheduling worker agents | autonomous |
| **Compensable** | Not undoable, but correctable at acceptable cost | calendar changes, Notion edits, delayed-send email within undo window | autonomous within trust limits, always reported |
| **Irreversible** | Cannot be undone or compensated | sent external messages after undo window, financial actions, deletions in external systems | approval required until Phase 7 explicitly relaxes per action class |

## Decision

**Option C, plus full adoption of the internal-state principles:** internal
state is immutable, versioned, and recoverable — nothing important is ever
overwritten (aligned with ADR-0007's append-only log). External actions carry
a reversibility class, and autonomy is governed by the rule:

> **Autonomy = f(trust level of the affected relationship [ADR-0010] ×
> reversibility class of the action).**

This formula operationalizes Phase 7: autonomy expands per action class by
raising thresholds via ADR — never implicitly.

## Consequences

- **Positive:** the Employee role can act autonomously where it is safe;
  safety intent is preserved and made precise; Phase 7 gains a concrete,
  auditable expansion mechanism; undo windows (delayed send) convert many
  irreversible actions into compensable ones by design.
- **Negative / accepted cost:** every integration action must be classified in
  its spec (A1); classification errors are possible — mitigation: default to
  the stricter class when uncertain.
- **Future risks:** class inflation ("everything is compensable") — mitigation:
  class definitions are normative here; changing them requires a superseding
  ADR.
- **Follow-ups:** principles.md gains the immutability/versioning principle
  and this classification upon acceptance; every integration spec (Phase 6)
  must include a reversibility classification per action.
