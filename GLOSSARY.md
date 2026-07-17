---
status: active
owner: alex
last_updated: 2026-07-17
---

# Glossary — Canonical Terminology

This glossary is the **terminology contract** for the entire repository. Every
document must use these terms with exactly these meanings. New terms are added
here in the same change that introduces them (see [AGENTS.md §5](AGENTS.md)).

Terms are alphabetical. Cross-references use *italics*.

---

**ADR (Architecture Decision Record)**
An immutable record of one decision with lasting consequences: its context,
the options considered, the decision, and its consequences. Stored in
[`20-decisions/`](20-decisions/README.md). Accepted ADRs are never edited, only
superseded.

**Agent**
Any autonomous AI process within AIOS that pursues a goal using an LLM and
tools. Umbrella term for *Brain Agent* and *Worker Agents*.

**Agent Runtime**
The subsystem that manages the lifecycle of all *Worker Agents*: start, pause,
resume, monitor, prioritize, delegate, re-plan. Enforces resource and cost
limits.

**AIOS**
The personal AI Operating System described by this repository. A long-lived,
model-agnostic system that unifies knowledge, memory, agents, events, and
integrations behind a single *Brain Agent*.

**Brain Agent**
The single conversational interface between the user and AIOS. Acts as chief
operating officer: understands context, prioritizes, plans, selects models,
delegates to *Worker Agents*, and decides when to ask the user. There is
exactly one Brain Agent.

**Dashboard**
The visual, real-time surface of AIOS: running agents, priorities, costs,
token usage, status, ETAs, notifications. Secondary to the *Voice Interface*
(Voice First principle).

**Episodic Memory**
Memory of concrete past events and interactions ("what happened when").
One of the four memory types managed by the *Memory Engine*.

**Event**
An immutable fact that something happened, published to the *Event System*.
Components react to events instead of calling each other directly
(Event Driven principle).

**Event System**
The subsystem that transports *Events* between services. The backbone of
loose coupling in AIOS.

**Handbook**
This repository in its role as single source of truth: the Product Handbook
(`00-product/`) plus the Architecture Handbook (`10-architecture/`,
`20-decisions/`, `30-specs/`).

**Integration**
A connection between AIOS and an external system (e.g., GitHub, Notion,
Outlook, Gmail, calendar). Each integration is a replaceable service behind a
defined contract.

**Knowledge Graph**
The linked, queryable representation of entities (projects, people, customers,
documents, decisions) and their relationships. Core structure of the
*Knowledge System*.

**Knowledge System**
The subsystem that unifies personal knowledge and company knowledge into a
single, linked, queryable asset (Knowledge Centric principle). Includes the
*Knowledge Graph* and vector search.

**Memory Engine**
The subsystem that manages all memory types (*Working*, *Episodic*, *Semantic*,
*Procedural Memory*), storage, and retrieval. Goal: maximum knowledge quality
at minimum token cost (Memory Native principle).

**Model Abstraction Layer**
The layer that isolates AIOS from concrete LLM providers. Routes tasks to
models by policy, handles fallbacks. Guarantees the Model Agnostic principle.

**Model Provider**
A concrete LLM vendor or model family (e.g., Claude, GPT, Gemini) accessed
exclusively through the *Model Abstraction Layer*.

**Multi-LLM Orchestration**
The practice of routing different tasks to different *Model Providers* based
on capability, cost, and latency — decided by the *Brain Agent* via the
*Model Abstraction Layer*.

**Procedural Memory**
Memory of how to perform tasks: workflows, learned procedures, preferences in
execution. One of the four memory types managed by the *Memory Engine*.

**Semantic Memory**
Memory of facts and concepts independent of when they were learned. One of the
four memory types managed by the *Memory Engine*.

**Spec (Specification)**
A precise, testable description of a component: interfaces, data model,
behavior, error handling, acceptance criteria. Lives in `30-specs/`.
Prerequisite for any code (Documentation First principle).

**Voice Interface**
The primary interaction channel of AIOS: speech in, speech out (Voice First
principle). The *Dashboard* complements it; it never replaces it.

**Worker Agent**
A background *Agent* that executes a delegated task (research, coding,
drafting, integration work) under control of the *Agent Runtime*. Worker
Agents never interact with the user directly.

**Working Memory**
The short-lived context assembled for the current conversation or task. One of
the four memory types managed by the *Memory Engine*.
