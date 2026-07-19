# ADR-0008: Single Postgres for knowledge, memory, and vectors

- **Status:** accepted
- **Date:** 2026-07-17
- **Deciders:** alex
- **Related:** [ADR-0006](adr-0006-modular-monolith-topology.md), [ADR-0007](adr-0007-postgres-event-log-backbone.md), [principles.md A7/A8](../00-product/principles.md), [GLOSSARY.md](../GLOSSARY.md)

## Context

The vision names a Knowledge Graph, vector search, and four memory types.
The reflexive architecture is three storage systems: a graph database (Neo4j),
a vector database (Pinecone/Qdrant/Weaviate), and a relational database. For a
single-user system this triples the operational surface, backup complexity,
and failure modes — and forces cross-database consistency problems that
Postgres solves natively in one transaction.

**Key insight: "Knowledge Graph" is a data model, not a database product.**
At single-user scale (10⁴–10⁶ entities, not 10⁹), typed edges in a relational
table with recursive CTE traversal cover every query the Brain Agent needs
(neighborhood expansion, path finding, typed filtering).

## Options Considered

### Option A — Best-of-breed: graph DB + vector DB + relational DB
Maximum per-workload capability. Cons: three systems to run, back up, and keep
consistent; entity identity must be synchronized across all three; capability
headroom that a single user can never exercise.

### Option B — Single Postgres
Entities and memory as relational tables, `edges` (source, target, type,
properties, confidence, timestamps) as the explicit graph, `pgvector` for
embeddings, the event log (ADR-0007) in the same database. One transaction can
update an entity, its edges, its embedding, and emit an event atomically.

### Option C — SQLite (+ extensions)
Even lighter. Cons: weak concurrent-writer story for a 24/7 multi-module
process, weaker vector ecosystem, no LISTEN/NOTIFY — poor fit for the event
backbone.

## Decision

**Option B.** One Postgres instance holds relational state, the knowledge
graph (as typed edges), vector embeddings (pgvector), and the event log.
Access only through the Knowledge System and Memory Engine module contracts —
no other module touches these tables directly (ADR-0006).

## Consequences

- **Positive:** one system to operate and back up; atomic consistency across
  entities, edges, embeddings, and events; the graph is explicit and portable
  (an export to a graph DB is a mechanical migration).
- **Negative / accepted cost:** no native graph algorithms (PageRank,
  community detection) — must be implemented or deferred; pgvector is adequate,
  not best-in-class, for vector recall at large scale.
- **Future risks:** if graph queries ever exceed CTE ergonomics or vector
  corpus grows into tens of millions, extract behind the existing module
  contracts — the data model already matches.
- **ADR:** yes — storage topology is among the most expensive decisions to
  reverse after data accumulates.
