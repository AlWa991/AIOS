---
status: active
owner: alex
last_updated: 2026-07-17
---

# Architecture Decision Records

This directory is the **highest-ranked source of truth** in the repository
([AGENTS.md §2](../AGENTS.md)). It preserves *why* AIOS is the way it is — the
one thing future AI sessions cannot reconstruct from code or structure.

## Process

1. **When to write an ADR:** any decision with lasting consequences —
   architecture, technology, process, scope boundaries, conventions. If a
   future session could reasonably ask "why is this like that?", it needs an ADR.
2. **How:** copy [`../50-meta/templates/adr.md`](../50-meta/templates/adr.md),
   number it sequentially (`adr-NNNN-short-title.md`), fill in every section.
3. **Statuses:** `proposed` → `accepted` → (optionally) `superseded by ADR-NNNN`.
4. **Immutability:** accepted ADRs are never edited except to change status to
   `superseded` with a forward link. To change a decision, write a new ADR.
5. **Index:** add every new ADR to the table below in the same change.

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](adr-0001-documentation-first-development.md) | Documentation-first development | accepted | 2026-07-17 |
| [0002](adr-0002-english-as-handbook-language.md) | English as handbook language | accepted | 2026-07-17 |
| [0003](adr-0003-agents-md-as-machine-entry-point.md) | AGENTS.md as machine entry point | accepted | 2026-07-17 |
| [0004](adr-0004-cognitive-load-as-primary-criterion.md) | Cognitive load reduction as primary evaluation criterion | accepted | 2026-07-17 |
| [0005](adr-0005-ai-systems-as-critical-reviewers.md) | AI systems act as critical architecture reviewers | accepted | 2026-07-17 |
| [0006](adr-0006-modular-monolith-topology.md) | Modular monolith instead of day-one microservices | accepted | 2026-07-17 |
| [0007](adr-0007-postgres-event-log-backbone.md) | Postgres event log as event backbone | accepted | 2026-07-17 |
| [0008](adr-0008-single-postgres-for-knowledge-and-memory.md) | Single Postgres for knowledge, memory, and vectors | accepted | 2026-07-17 |
| [0009](adr-0009-own-orchestration-with-execution-adapters.md) | Own orchestration layer with execution adapters | accepted | 2026-07-17 |
| [0010](adr-0010-identity-as-bounded-context.md) | Identity & Relationships as bounded context with shared-graph storage | accepted | 2026-07-17 |
| [0011](adr-0011-situation-model-and-interface-projections.md) | Situation Model as core; interfaces as projections | accepted | 2026-07-17 |
| [0012](adr-0012-action-reversibility-classes.md) | Action reversibility classes instead of absolute reversibility | accepted | 2026-07-17 |
| [0013](adr-0013-seven-context-domain-architecture.md) | Seven-context domain architecture | accepted | 2026-07-17 |
| [0014](adr-0014-goals-as-directive-hierarchy.md) | Goals as directive hierarchy inside Deliberation | accepted | 2026-07-17 |
| [0015](adr-0015-time-as-cross-cutting-dimension.md) | Time as cross-cutting dimension with platform conventions | accepted | 2026-07-17 |
| [0016](adr-0016-typescript-core-python-workers.md) | TypeScript as core language; Python limited to specialized workers | accepted | 2026-07-19 |
