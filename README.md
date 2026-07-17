# AIOS — Personal AI Operating System

AIOS is a long-lived personal AI Operating System: a single conversational
**Brain Agent** that unifies personal and company knowledge, memory, background
agents, events, and integrations — model-agnostic and voice-first.

**This repository is not primarily source code.** It is the single source of
truth: a Product Handbook and Architecture Handbook, built documentation-first.
Code exists only where a specification exists.

> **AI systems:** your binding entry point is [`AGENTS.md`](AGENTS.md).
> Read it before anything else.

---

## Repository Map

| Location | Content |
|----------|---------|
| [`AGENTS.md`](AGENTS.md) | Binding contract & reading order for AI systems |
| [`CLAUDE.md`](CLAUDE.md) | Thin Claude-specific entry point |
| [`GLOSSARY.md`](GLOSSARY.md) | Canonical terminology |
| [`00-product/`](00-product/) | Vision · principles · scope · roadmap |
| [`10-architecture/`](10-architecture/) | System & component architecture |
| [`20-decisions/`](20-decisions/README.md) | Architecture Decision Records (ADRs) |
| [`30-specs/`](30-specs/) | Precise component specifications |
| [`40-operations/`](40-operations/) | Runbooks & operations (post-code) |
| [`50-meta/`](50-meta/documentation-guide.md) | Documentation conventions & templates |
| [`DOCUMENTATION_PLAN.md`](DOCUMENTATION_PLAN.md) | Master plan for building this handbook |

## Status

| Item | State |
|------|-------|
| Handbook stage | **Stage 0 complete** — skeleton, entry points, glossary, ADR process |
| Next | Stage 1 — Product Handbook (`00-product/`: scope, principles, refined vision & roadmap) |
| Code | None yet — by design (Documentation First, [ADR-0001](20-decisions/adr-0001-documentation-first-development.md)) |

## Core Principles

Documentation First · AI First · Event Driven · Service Oriented ·
Model Agnostic · Voice First · Knowledge Centric · Memory Native
— binding, see [AGENTS.md §4](AGENTS.md).
