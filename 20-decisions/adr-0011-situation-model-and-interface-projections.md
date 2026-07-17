# ADR-0011: Situation Model as core; interfaces as projections

- **Status:** proposed
- **Date:** 2026-07-17
- **Deciders:** alex
- **Related:** [ADR-0007](adr-0007-postgres-event-log-backbone.md), [ADR-0006](adr-0006-modular-monolith-topology.md), [vision.md](../00-product/vision.md), [scope.md](../00-product/scope.md)

## Context

Product clarification (2026-07-17): the central product is not any single
feature (e.g., the morning briefing) but **Shared Situational Awareness** —
AIOS continuously understands what is happening across the user's digital work
life and makes it understandable through multiple interfaces (voice, briefing,
dashboard, notifications, mobile, future ones). Without an architectural
answer, each interface would assemble its own picture of the world, drift
apart, and multiply cognitive load instead of reducing it.

## Options Considered

### Option A — Interfaces assemble their own state
Each interface queries sources directly. Pros: no shared component. Cons:
N inconsistent world views; every new interface re-implements understanding;
briefing and dashboard can contradict each other — fatal for trust.

### Option B — The Brain Agent is the only access path for everything
All interfaces are conversations. Pros: single view by construction. Cons:
forces LLM inference into every glance at a dashboard; expensive, slow, and
wrong for at-a-glance transparency.

### Option C — Explicit Situation Model + interface projections (CQRS)
A **Situation Model** module continuously maintains the current world state as
a projection over the event log (ADR-0007), knowledge, agent states, calendar,
and communications. All interfaces — including the Brain Agent's own context
assembly — are **read models / projections** of this one model. No interface
owns state.

## Decision

**Option C.** Additions to the architecture:

1. New core module **Situation Model** (joins Brain Agent, Memory Engine,
   Knowledge System, Identity, Agent Runtime as the "Cognitive Engine").
2. **Interfaces are projections.** Voice, briefing, dashboard, notifications,
   mobile are views of the same model; a new interface is a new projection,
   never a new data path.
3. **Coverage and uncertainty are first-class.** The Situation Model
   represents what it does *not* observe (unconnected sources, stale sensors)
   and surfaces gaps. Feigned completeness is treated as a defect, because
   "simply trust that everything is running" is only safe if blind spots are
   visible.
4. **Integrations are sensors** feeding the model — confirming the Phase-2
   pull-forward of read-only integrations (roadmap sequencing note).
5. **The four roles (Second Brain, Employee, COO, Coach) are behavioral modes
   of the one Brain Agent** operating on this model — not separate agents or
   components. Mode arbitration follows ADR-0004 and progressive disclosure;
   Coach output is batched into reflection contexts, never injected inline.
6. The **Personal Model** is a named aggregate over the self identity record
   (ADR-0010) and memory about the user — not a new bounded context. It is
   fully inspectable by the user on demand.

## Consequences

- **Positive:** one consistent world view across all interfaces; dashboard
  (Phase 5) shrinks to a projection instead of a product; new interfaces
  become cheap; MVP is reframed as "Situation Model v1 with briefing + query
  views" — same build effort, correct target.
- **Negative / accepted cost:** projection maintenance (rebuild, versioning)
  is our responsibility; the Situation Model must be specified before Phase 2
  implementation (A1).
- **Future risks:** the Situation Model becoming a god-module — mitigation:
  it only *projects* state owned by other modules and holds no domain logic;
  projection staleness — mitigation: staleness is part of the coverage
  display (point 3).
- **Follow-ups:** update vision.md (four roles, SSA as central product),
  scope.md (MVP wording), roadmap.md (Phase 2/5 reframing), GLOSSARY
  (Situation Model, Personal Model, Projection) upon acceptance;
  `10-architecture/situation-model.md` joins the Stage 2 component set.
