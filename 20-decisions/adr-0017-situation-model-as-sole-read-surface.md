# ADR-0017: Situation Model as the sole read surface for all interfaces

- **Status:** accepted
- **Date:** 2026-07-19
- **Deciders:** alex
- **Related:** [ADR-0011](adr-0011-situation-model-and-interface-projections.md), [ADR-0013](adr-0013-seven-context-domain-architecture.md), [ADR-0014](adr-0014-goals-as-directive-hierarchy.md), [spec-0001](../30-specs/spec-0001-walking-skeleton.md)

## Context

Before implementation start (2026-07-19), Alex sharpened the product thesis:
the Situation Model is the real product; Morning Briefing, Dashboard, voice,
and future mobile apps are only projections of it. Everything after Situation
should be presentation; no user interface may own business logic.

Taken literally this conflicts with ADR-0013/0014: Deliberation
(recommendations, prioritization, goals) sits after Situation in the
cognitive loop and is cognition, not presentation. The walking-skeleton spec
as first drafted even contained a subtle violation: the briefing read
Situation *and* Deliberation directly, while the dashboard read only
Situation — two different effective models.

## Options Considered

### Option A — Interfaces read Situation and Deliberation separately
Every new interface must re-compose the same two sources; the "same model"
guarantee degrades into a testing hope instead of a structural property.

### Option B — Fold Deliberation into Situation (one context)
Merges normative cognition into a rebuildable projection — inverts ADR-0011
and re-opens the ADR-0014 placement decision. Rejected.

### Option C — Deliberation writes back into the Situation Model
Deliberation remains its own context (ADR-0013/0014) but its outputs
(recommendations with goal citations, pending approvals, action outcomes)
are published as events that the Situation projection folds in. The
canonical pipeline becomes:

> **Perception → Identity → Memory → Situation ⇄ Deliberation**, and
> **`Situation.current()` is the single read surface** for every interface.

## Decision

**Option C.** Normative rules:

1. All interfaces — CLI briefing, dashboard, voice, future mobile — read
   exclusively `Situation.current()`. No interface may call Memory,
   Identity, or Deliberation contracts for display purposes.
2. Deliberation's interface-relevant output travels via events into the
   Situation projection (`SituationView.recommendations`); Deliberation
   exposes no read contract to the presentation layer.
3. Interfaces own zero business logic: they render `SituationView` and
   capture user input as events (commands, approvals). Nothing else.
4. Enforced mechanically: dependency rules forbid `apps/` importing any
   context contract except Situation (read) and Interaction (render/input).

## Consequences

- **Positive:** the same-model guarantee is structural, not tested-only; a
  new interface costs one renderer, never re-composed logic; the Situation
  Model is now unambiguously the central output of the cognitive pipeline —
  the product.
- **Negative / accepted cost:** Situation's schema grows (it now carries
  recommendation views); Deliberation ↔ Situation event traffic increases.
- **Future risks:** interfaces needing data Situation doesn't carry will
  tempt direct context reads — mitigation: extend `SituationView` instead;
  the dependency rule makes the shortcut fail the build.
- **Follow-ups:** spec-0001 updated in the same change; component doc
  situation.md must document `SituationView` as the product's central
  artifact.
