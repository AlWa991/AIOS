---
status: active
owner: alex
last_updated: 2026-07-17
---

# AGENTS.md — Machine Entry Point

This file is the **binding contract for every AI system** (Claude, GPT, Gemini,
future models) that reads or modifies this repository. If you are an AI system,
read this file completely before doing anything else.

---

## 1. What This Repository Is

AIOS is a **personal AI Operating System** — not a classical software
application. It is a long-lived, continuously growing system that unifies
personal knowledge, company knowledge, agent orchestration, memory, and
integrations behind a single conversational Brain Agent.

This repository is **not primarily source code**. It is the **single source of
truth**: a Product Handbook and Architecture Handbook. Code exists only where a
specification for it already exists (see rules below).

## 2. Source-of-Truth Hierarchy

When documents conflict, the higher-ranked document wins. Never resolve a
conflict silently — flag it and propose an ADR.

| Rank | Location | Authority over |
|------|----------|----------------|
| 1 | [`20-decisions/`](20-decisions/README.md) (accepted ADRs) | **Why** — all decided questions |
| 2 | [`00-product/`](00-product/) | **What** — vision, scope, principles, roadmap |
| 3 | [`10-architecture/`](10-architecture/) | **How** — system and component design |
| 4 | [`30-specs/`](30-specs/) | **Exactly how** — schemas, APIs, protocols |
| 5 | [`README.md`](README.md) | Navigation only — never authoritative |

## 3. Cold-Start Reading Order

1. `AGENTS.md` (this file)
2. [`GLOSSARY.md`](GLOSSARY.md) — canonical terminology
3. [`00-product/vision.md`](00-product/vision.md) and `00-product/scope.md` (once it exists)
4. [`10-architecture/overview.md`](10-architecture/) (once it exists)
5. The component docs and specs relevant to your task
6. [`20-decisions/README.md`](20-decisions/README.md) — check for ADRs touching your task

## 4. Core Principles (Binding)

**Primary evaluation criterion above all principles:** every decision must
reduce the user's cognitive load or increase strategic capacity
([ADR-0004](20-decisions/adr-0004-cognitive-load-as-primary-criterion.md)).
AIOS is a cognitive operating system, not a coding assistant.

Every architectural and product decision must be compatible with these
architecture principles. Full elaboration — including the product principles
P1–P7 — lives in [`00-product/principles.md`](00-product/principles.md).

1. **Documentation First** — no code without an existing spec ([ADR-0001](20-decisions/adr-0001-documentation-first-development.md))
2. **AI First** — every artifact is written to be consumed by AI systems, humans second
3. **Event Driven** — components communicate through events, not direct coupling
4. **Service Oriented** — capabilities are independent, replaceable services
5. **Model Agnostic** — no component may hard-depend on a specific LLM provider
6. **Voice First** — the primary interaction channel is speech, not UI
7. **Knowledge Centric** — knowledge is a first-class, linked, queryable asset
8. **Memory Native** — memory is a core subsystem, not an add-on feature

## 5. Editing Rules

- **Language:** English only, for all documents. ([ADR-0002](20-decisions/adr-0002-english-as-handbook-language.md))
- **Terminology:** use only terms defined in [`GLOSSARY.md`](GLOSSARY.md). If you
  need a new term, add it to the glossary in the same change.
- **Front-matter:** every document carries `status` / `owner` / `last_updated`
  front-matter. See [`50-meta/documentation-guide.md`](50-meta/documentation-guide.md).
- **Decisions:** any decision with lasting consequences requires an ADR in
  `20-decisions/`. ADRs are append-only — never edit an accepted ADR; supersede it.
- **Code:** may only be written if a spec for it exists in `30-specs/`. No
  exceptions, including prototypes committed to this repository.
- **Templates:** use [`50-meta/templates/`](50-meta/templates/) for ADRs, specs,
  and component docs.
- **Indexes:** when adding/moving documents, update the affected index files
  (`README.md`, `20-decisions/README.md`) in the same change.

## 6. Directory Semantics

| Directory | Contains | Change velocity |
|-----------|----------|-----------------|
| `00-product/` | Vision, principles, user & jobs, scope, roadmap | Slow |
| `10-architecture/` | System overview and component architecture | Medium |
| `20-decisions/` | ADRs — immutable decision records | Append-only |
| `30-specs/` | Precise, testable component specifications | Fast |
| `40-operations/` | Runbooks, deployment, observability | Post-code |
| `50-meta/` | Documentation conventions and templates | Rare |

## 7. What NOT To Do

- Do not write code without a spec.
- Do not change decided behavior without a superseding ADR.
- Do not introduce undefined terminology.
- Do not duplicate content across documents — link instead.
- Do not treat `README.md` as a source of truth — it is navigation.
- Do not produce German handbook content — German is for user-facing
  conversation only, never for repository documents.
