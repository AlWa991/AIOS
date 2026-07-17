# AIOS — Personal AI Operating System

AIOS is a **cognitive operating system**: a single conversational
**Brain Agent** — acting as a trusted Chief Operating Officer — that unifies
personal and company knowledge, memory, background agents, events, and
integrations. Model-agnostic, voice-first. Its purpose is reducing cognitive
load and increasing strategic capacity
([ADR-0004](20-decisions/adr-0004-cognitive-load-as-primary-criterion.md)).

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
| Handbook stage | **Stage 1 complete** — Product Handbook (`00-product/`) active |
| Next | Stage 2 — Architecture core (`10-architecture/`: overview, brain-agent, memory, runtime, model abstraction, security) |
| Code | None yet — by design (Documentation First, [ADR-0001](20-decisions/adr-0001-documentation-first-development.md)) |

## Core Principles

Documentation First · AI First · Event Driven · Service Oriented ·
Model Agnostic · Voice First · Knowledge Centric · Memory Native
— binding, see [AGENTS.md §4](AGENTS.md).
