---
status: active
owner: alex
last_updated: 2026-07-17
---

# Documentation Guide

Conventions for every document in this repository. These rules exist so that
any AI system or human can read, trust, and extend the handbook without
ambiguity.

---

## 1. Language & Style

- **English only.** No German in repository documents ([ADR-0002](../20-decisions/adr-0002-english-as-handbook-language.md)).
- Precise over eloquent. Every sentence must carry information; no marketing
  language, no filler.
- Prefer tables and lists for structured facts, prose for reasoning.
- Statements must be **testable or falsifiable** where possible. "The system is
  fast" is invalid; "retrieval returns within 500 ms p95" is valid.
- Use only terms defined in [`GLOSSARY.md`](../GLOSSARY.md).

## 2. Front-Matter

Every document starts with:

```yaml
---
status: draft | active | superseded
owner: alex
last_updated: YYYY-MM-DD
---
```

- `draft` — content incomplete or not yet approved; do not treat as authoritative.
- `active` — authoritative within the source-of-truth hierarchy ([AGENTS.md §2](../AGENTS.md)).
- `superseded` — kept for history; must link to its replacement in the first line.

ADRs use their own status vocabulary (see [`../20-decisions/README.md`](../20-decisions/README.md)).

## 3. Document Lifecycle

1. Created as `draft` (from a template in [`templates/`](templates/)).
2. Reviewed against scope, principles, and existing ADRs.
3. Promoted to `active` — from now on it binds all future work.
4. When replaced: new document becomes `active`, old one becomes `superseded`
   with a forward link. Documents are never silently deleted.

## 4. Choosing the Right Document Type

| You want to record… | Write a… | Location |
|---|---|---|
| A decision with lasting consequences and its reasoning | ADR | `20-decisions/` |
| How a component works conceptually (responsibilities, flows) | Component doc | `10-architecture/` |
| A precise, buildable contract (schema, API, protocol) | Spec | `30-specs/` |
| Product intent (what/why/boundaries) | Product doc | `00-product/` |
| How to operate the running system | Runbook | `40-operations/` |

Rule of thumb: **ADRs capture "why", architecture docs capture "how",
specs capture "exactly how".**

## 5. Cross-Referencing

- Always link with **relative paths** (`../20-decisions/adr-0001-….md`).
- Every architecture doc links the ADRs that constrain it.
- Every spec links its architecture doc.
- Never duplicate content between documents — link to the single source.

## 6. File Naming

- Lowercase, hyphen-separated: `memory-system.md`, `adr-0003-….md`.
- ADRs: `adr-NNNN-short-title.md`, zero-padded, strictly sequential.
- One topic per file. If a file needs a table of contents longer than ten
  entries, split it.

## 7. Templates

Start every new document from the matching template:

- [`templates/adr.md`](templates/adr.md)
- [`templates/component.md`](templates/component.md)
- [`templates/spec.md`](templates/spec.md)
