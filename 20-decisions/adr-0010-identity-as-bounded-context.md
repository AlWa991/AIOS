# ADR-0010: Identity & Relationships as bounded context with shared-graph storage

- **Status:** accepted
- **Date:** 2026-07-17
- **Deciders:** alex
- **Related:** [ADR-0006](adr-0006-modular-monolith-topology.md), [ADR-0007](adr-0007-postgres-event-log-backbone.md), [ADR-0008](adr-0008-single-postgres-for-knowledge-and-memory.md), [principles.md A7](../00-product/principles.md), [user-and-jobs.md J1/J6](../00-product/user-and-jobs.md)

## Context

People and organizations are currently generic entities in the Knowledge
Graph. Three forces argue this is insufficient:

1. **Entity resolution is a distinct capability.** The same person appears as
   email address, WhatsApp number, GitHub handle, Notion collaborator, and
   meeting participant. Without a single owner for resolution, every
   integration solves it separately. This is needed in the **MVP** (J1
   briefing, J6 customer context), not in a later phase.
2. **Trust is COO core logic.** Autonomy decisions ("may I answer this
   autonomously?") depend on relationship class. Phase 7 scales autonomy per
   action class — that requires a queryable trust model with an owner.
3. **Bounded-context signal:** "person" means different things in Knowledge
   (mention in content) and Identity (canonical profile with policies) — two
   models of one term.

At the same time, person nodes are the **densest nodes in the graph**. A
storage boundary at exactly that point would fragment every meaningful query.

## Options Considered

### Option A — No separate domain (status quo)
People/orgs remain generic Knowledge entities. Pros: no new boundary. Cons:
resolution logic smears across integrations; trust and interaction policy have
no owner; the person model drifts per module.

### Option B — Full bounded context with its own storage (as proposed, maximal scope incl. projects and ownership)
Pros: textbook DDD isolation. Cons: fragments the graph at its densest point
(violates the intent of ADR-0008); including projects/ownership makes Identity
a god-module, since everything in the graph connects to people; premature
infrastructure before the MVP exists.

### Option C — Bounded context as module-with-authority over shared storage
Identity is a module (per ADR-0006) that **owns the model and the policies**:
canonical person/org registry, entity resolution (mentions → canonical IDs),
relationship classes and lifecycle, trust levels, interaction preferences,
temporal identity evolution (valid_from/valid_to edges + events). The **data
lives in the shared Postgres graph** (ADR-0008). Other modules reference
identities only via canonical IDs; only the Identity module writes identity
tables; integrations submit raw mentions to Identity for resolution.

## Decision

**Option C — with a deliberately narrowed scope.** Identity & Relationships
becomes a first-class bounded context owning: people, organizations, roles,
relationship classes and lifecycle, trust levels, interaction preferences, and
identity evolution. **Explicitly excluded: projects and ownership.** Projects
belong to the work domain; ownership is an edge between Identity and work,
queried via the Knowledge System. Boundary rule: *Identity owns who someone is
and how to interact with them — not what they are involved in.*

The user's own profile ("self") is the most important identity record and the
join point between Identity and procedural memory.

## Consequences

- **Positive:** one owner for entity resolution (needed at MVP); trust model
  has an architectural home before Phase 7 needs it; graph stays whole and
  atomically consistent; person model cannot drift.
- **Negative / accepted cost:** authority-without-storage-separation requires
  the same tooling-enforced discipline as ADR-0006; one more module contract
  to specify before Stage 2 component docs.
- **Future risks:** trust model over-engineered before autonomy exists —
  mitigation: MVP ships relationship classes only, the policy engine comes
  with Phase 7; scope creep back toward god-module — mitigation: the boundary
  rule above is normative, changes require a superseding ADR.
- **Follow-ups:** add `10-architecture/identity.md` to the Stage 2 component
  set; add Identity terms to GLOSSARY.md upon acceptance; MVP spec must
  include minimal resolution (email + calendar identities).
