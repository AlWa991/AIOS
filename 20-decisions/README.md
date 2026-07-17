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
