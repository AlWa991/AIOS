---
status: active
owner: alex
last_updated: 2026-07-17
---

# Principles

Two layers of binding principles. **Product principles** define what AIOS must
feel like and are the test for every feature. **Architecture principles**
define how the system is built and are the test for every technical decision.
Summarized in [AGENTS.md §4](../AGENTS.md); decisions conflicting with a
principle require a superseding ADR.

The meta-criterion above all principles:
**every decision must reduce cognitive load or increase strategic capacity**
([ADR-0004](../20-decisions/adr-0004-cognitive-load-as-primary-criterion.md)).

---

## Product Principles

### P1 — Reduce context switching
Restoring mental state is the most expensive operation in the user's day. AIOS
carries context across switches and hands it back in seconds.
*Violation:* any flow that requires the user to re-read, re-search, or re-remember
state the system already had.

### P2 — Reduce manual coordination
The user never orchestrates agents, tools, or information flows by hand. If the
user acts as the integration layer between two systems, AIOS has failed there.
*Violation:* "check tool A, then paste into tool B" workflows.

### P3 — Reduce unnecessary decisions
Decisions with a clearly best option are made by the system and reported.
Only genuine trade-offs reach the user — pre-framed, with a recommendation.
*Violation:* asking the user anything the system could resolve from context.

### P4 — Surface only relevant information
Attention is the scarce resource. Information is filtered by decision
relevance, not by recency or volume. Silence is a feature.
*Violation:* notification streams, unread counters, raw feeds.

### P5 — Proactive over reactive
AIOS initiates: it briefs, follows up, escalates, and closes loops without
being asked. A purely reactive AIOS is just another tool to remember to use.
*Violation:* capabilities that only work when the user thinks to invoke them.

### P6 — COO, not chatbot
The Brain Agent carries responsibility: it holds state, owns follow-through,
maintains standing knowledge of all projects, and is accountable for outcomes —
like a trusted Chief Operating Officer.
*Violation:* stateless Q&A behavior; forgetting commitments between sessions.

### P7 — Intentions over tasks
The user states outcomes; the system decomposes, schedules, delegates, and
tracks. Task management is system-internal machinery, not the user interface.
*Violation:* interfaces centered on to-do lists the user must groom.

---

## Architecture Principles

### A1 — Documentation First
No code without an existing spec ([ADR-0001](../20-decisions/adr-0001-documentation-first-development.md)).
The handbook is the single source of truth; code is a derived artifact.
*Violation:* prototypes committed to this repository without a spec.

### A2 — AI First
Every artifact — documents, schemas, APIs, logs — is designed to be consumed by
AI systems first, humans second: explicit structure, defined terminology,
machine-readable formats.
*Violation:* knowledge that exists only in prose ambiguity or in someone's head.

### A3 — Event Driven
Components communicate through events on the Event System, never through
direct coupling. Proactive behavior (P5) is architecturally possible only if
everything relevant is an observable event.
*Violation:* component A importing or synchronously calling component B's internals.

### A4 — Service Oriented
Every capability (Memory Engine, Agent Runtime, Voice Interface, each
Integration) is an independent, replaceable service behind a defined contract.
*Violation:* capabilities that can only be deployed, scaled, or replaced together.

### A5 — Model Agnostic
No component may hard-depend on a specific LLM provider. All model access goes
through the Model Abstraction Layer; models are routed by policy
(capability, cost, latency).
*Violation:* provider SDK calls outside the abstraction layer; provider-specific
prompts embedded in business logic.

### A6 — Voice First
Speech is the primary interaction channel; every core flow must work eyes-free.
The Dashboard complements voice, it never gates a capability.
*Violation:* features reachable only by clicking.

### A7 — Knowledge Centric
Knowledge (projects, people, decisions, documents) is a first-class, linked,
queryable asset in the Knowledge System — not a side effect scattered across
tools.
*Violation:* information AIOS has processed but cannot retrieve by relationship.

### A8 — Memory Native
Memory is a core subsystem, not a bolt-on. Every interaction reads from and
writes to the Memory Engine; forgetting is a deliberate policy, not an accident
of context windows.
*Violation:* sessions that start from zero; knowledge lost at session end.
