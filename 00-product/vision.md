---
status: active
owner: alex
last_updated: 2026-07-17
---

# Product Vision

> Supersedes the German seed document (`Vision.md`, moved here 2026-07-17).

## North Star

**AIOS is a cognitive operating system.** Its purpose is to reduce the user's
cognitive load and increase the share of attention available for strategic
thinking.

AIOS is explicitly **not a coding assistant**. Producing code is a largely
solved problem, delegated to tools like Claude Code. The unsolved problem sits
one layer above: coordinating many parallel projects, agents, customers, and
information streams without burning the user's attention on it.

Every architectural and product decision is evaluated against one question:

> **Does this reduce cognitive load or increase strategic capacity?**
> ([ADR-0004](../20-decisions/adr-0004-cognitive-load-as-primary-criterion.md))

## The Problem

The user's workday is not a linear development day. It is a stream of parallel,
asynchronous threads: multiple Claude Code sessions, long-running agents that
finish at unpredictable times, customer meetings, code review, voice notes,
email, messaging, GitHub, Notion, calendar, architecture work, and consulting —
all interleaved.

The scarce resource is not typing speed and not model intelligence. It is
**attention**. Every context switch destroys mental working state that must be
rebuilt manually: What was I doing here? What finished while I was away? What
needs a decision from me? Today, the user is the integration layer between all
tools and agents — and pays for it in cognitive load.

## What AIOS Is

There is exactly one interlocutor: the **Brain Agent**. It behaves like a
trusted **Chief Operating Officer**, not like a chatbot:

- It holds the complete picture — projects, customers, agents, calendar,
  commitments, past decisions — so the user doesn't have to.
- It is **proactive**: it briefs, follows up, escalates, and closes loops on
  its own initiative; it does not wait to be prompted.
- It **filters**: only decision-relevant information reaches the user;
  everything else is handled or held.
- It **coordinates**: worker agents, models, and integrations operate in the
  background under its control — the user never orchestrates them manually.
- It shifts the user from managing **tasks** to managing **intentions**: the
  user states outcomes; the system decomposes, schedules, delegates, and
  reports back at decision points.

## What AIOS Is Not

| Not this | Because |
|----------|---------|
| A coding assistant | It orchestrates coding tools; it does not compete with them |
| A chatbot | It initiates and maintains state; it doesn't just answer |
| Another dashboard | Surfaces support the conversation; they never replace it (Voice First) |
| A replacement for Notion, Outlook, GitHub | It is the orchestration layer above source systems, not a rebuild of them |

## Target State

A workday with AIOS: the day starts with a spoken briefing — what happened
overnight, what matters today, which decisions are queued. Agent completions,
mails, and messages are triaged in the background; the user is interrupted only
when a decision is genuinely needed. Switching to a project takes seconds,
because the Brain Agent restores the context verbally. Thoughts are captured by
voice and routed automatically. At the end of the day, open loops are closed or
explicitly parked — nothing lives only in the user's head.

## Long-Term Evolution

AIOS grows over years. Models, agents, and tools are replaceable (Model
Agnostic); the operating system — its knowledge, memory, and decision history —
persists. The user evolves from operator to strategic decision-maker inside
their own cognitive operating system.
