# ADR-0013: Seven-context domain architecture

- **Status:** accepted
- **Date:** 2026-07-17
- **Deciders:** alex
- **Related:** [domain-model.md](../10-architecture/domain-model.md), [ADR-0006](adr-0006-modular-monolith-topology.md), [ADR-0008](adr-0008-single-postgres-for-knowledge-and-memory.md), [ADR-0009](adr-0009-own-orchestration-with-execution-adapters.md), [ADR-0010](adr-0010-identity-as-bounded-context.md), [ADR-0011](adr-0011-situation-model-and-interface-projections.md)

## Context

Stage 2 requires a domain architecture designed from cognitive
responsibilities, stable enough for a decade. Fifteen candidate domains were
evaluated (full analysis: [domain-model.md](../10-architecture/domain-model.md)).
The goal is the smallest set of bounded contexts in which every cognitive
responsibility has exactly one owner.

## Options Considered

### Option A — Fine-grained: ~12+ contexts (one per candidate)
Dashboard, Notifications, Audit, Security, Event System etc. as own domains.
Cons: boundaries without behavioral difference; contradicts ADR-0011
(surfaces are projections) and ADR-0007 (the log is the audit).

### Option B — Coarse: 3 contexts (Perceive / Think / Act)
Attractively simple. Cons: "Think" would fuse memory, identity, situation, and
deliberation — four different data natures, change velocities, and invariants
in one module; the god-context by construction.

### Option C — Seven contexts along the cognitive loop
**Perception · Identity · Memory · Situation · Deliberation · Execution ·
Interaction**, plus a thin platform layer (event backbone, model abstraction,
storage, secrets, observability).

## Decision

**Option C**, as specified in [domain-model.md](../10-architecture/domain-model.md),
including two amendments to prior working decisions:

1. **Knowledge System is merged into Memory.** Semantic knowledge is a memory
   type; retrieval is one problem (`Recall` ranks across episodic, semantic,
   procedural in one token budget); consolidation would otherwise permanently
   cross a context boundary. ADR-0008's wording "Knowledge System and Memory
   Engine contracts" becomes "the Memory contract".
2. **"Brain Agent" is a persona, not a component** — implemented by
   Deliberation (thinking) + Interaction (conversing). GLOSSARY to be updated
   on acceptance.

Demotions: Personal Model → aggregate (Identity + Memory); Agent Runtime →
inside Execution; Dashboard/Notifications → Interaction projections;
Integrations → Perception; Audit → event log + Memory versioning; Security →
cross-cutting; Event System → platform.

## Consequences

- **Positive:** every responsibility has one owner; contexts are modules, not
  services (ADR-0006), so seven is organizationally free; surfaces and future
  interfaces stay cheap (ADR-0011); the COO domain layer (ADR-0009) gets a
  precise home (Deliberation + Execution).
- **Negative / accepted cost:** the event schema becomes the system's real API
  and needs registry + additive-only discipline; two known-fuzzy boundaries
  (Situation/Memory horizon rule, Deliberation/Interaction commit rule) must
  be enforced in review.
- **Future risks:** first expected amendment is the Situation/Memory horizon;
  Memory merge reversal stays internal behind `Recall`. The expensive mistake
  would be a careless event schema, not a wrong module cut.
- **Follow-ups on acceptance:** update GLOSSARY (Brain Agent as persona,
  Memory merge, new terms: Situation, Deliberation, Perception, ActionGate,
  Personal Model, Projection); update ADR-0008 wording; component docs per
  context; event schema registry spec before Phase 2 code.
