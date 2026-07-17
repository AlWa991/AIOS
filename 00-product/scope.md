---
status: active
owner: alex
last_updated: 2026-07-17
---

# Scope

Defines the boundary of AIOS. Every feature idea is tested here first: if it is
out of scope or a non-goal, it is rejected regardless of how attractive it is.

## The Scope Test

A capability is in scope only if it passes all three:

1. It reduces the user's cognitive load or increases strategic capacity
   ([ADR-0004](../20-decisions/adr-0004-cognitive-load-as-primary-criterion.md)).
2. It serves at least one job in [user-and-jobs.md](user-and-jobs.md).
3. It is compatible with all principles in [principles.md](principles.md).

## In Scope

| Area | Content |
|------|---------|
| Brain Agent | Single conversational interface; prioritization, planning, delegation, model selection, proactive briefings |
| Memory Engine | Working / episodic / semantic / procedural memory, retrieval, token-efficient context assembly |
| Knowledge System | Knowledge Graph + vector search over personal and company knowledge |
| Agent Runtime | Lifecycle management of Worker Agents (incl. Claude Code sessions): start, monitor, pause, resume, prioritize |
| Event System | Event backbone connecting all services |
| Voice Interface | Speech in/out as primary channel, voice capture on the move |
| Dashboard | Real-time visibility: agents, priorities, costs, tokens, ETAs, notifications |
| Integrations | GitHub, Notion, Outlook, Gmail, calendar, WhatsApp/messaging, Claude Code, ChatGPT — as replaceable services |
| Multi-LLM Orchestration | Policy-based routing across model providers via the Model Abstraction Layer |

## Out of Scope (current horizon)

- **Multi-user / multi-tenant operation.** AIOS is built for one user (Alex).
  Architecture should not actively preclude later users, but no feature is
  designed, tested, or complicated for them.
- **Rebuilding source systems.** AIOS orchestrates Notion, Outlook, GitHub etc.;
  it does not replace their storage, editing, or collaboration functions.
- **Being a coding assistant.** Code production belongs to Claude Code and
  similar tools. AIOS manages *them*, not the code.
- **Commercial productization** (packaging, licensing, onboarding for third
  parties). Possible much later; not a design driver now.

## Non-Goals (permanent)

- **A chatbot product.** Reactive Q&A is not the product (P5, P6).
- **A universal app platform.** AIOS integrates what the user actually uses;
  it does not aim for breadth of connectors as a feature.
- **Maximum autonomy as an end in itself.** Autonomy grows only where trust and
  reversibility are established; the user always owns consequential decisions.
- **UI-first experiences.** No capability may require a screen (A6).

## MVP Definition

The smallest AIOS that measurably reduces cognitive load, targeting the two
most expensive jobs (J1 morning triage, J2 context restoration):

> **A Brain Agent (v1) that (a) delivers a daily briefing and (b) restores
> project context on demand — fed by read-only integrations (calendar, GitHub,
> Notion, email) and a first Memory Engine iteration.**

Explicitly *not* in the MVP: write actions in external systems, autonomous
agent orchestration, full voice pipeline (text-first is acceptable for v1 if
voice adds delay). Details and acceptance criteria: spec in `30-specs/` before
implementation (A1).

## Scope Changes

Scope changes require an ADR. This document is then updated to reflect the
decision, linking the ADR.
