---
status: active
owner: alex
last_updated: 2026-07-17
---

# Roadmap

> Supersedes the German seed document (`ROADMAP.md`, moved here 2026-07-17).

Seven phases. Each phase has entry criteria (may not start before) and exit
criteria (not done before). Phases may overlap where the sequencing note allows
it. Status values: `planned` · `in progress` · `done`.

## Sequencing Note

The phase order follows system layering, with one deliberate exception:
**minimal read-only integrations (calendar, GitHub, Notion, email) are pulled
into Phase 2**, because the Brain Agent's core value — briefings and context
restoration (J1, J2) — is impossible without real data. Full, bidirectional
integrations remain Phase 6.

## Phases

### Phase 1 — Foundation *(in progress)*
Build the handbook that makes all further work steerable.

- **Deliverables:** documentation structure, product handbook, architecture
  core, ADR process (= Stages 0–2 of [DOCUMENTATION_PLAN.md](../DOCUMENTATION_PLAN.md)).
- **Entry:** —
- **Exit:** Stage 2 complete — Phase 2 can be planned from documents alone.
- **Progress:** Stage 0 done · Stage 1 done · Stage 2 open.

### Phase 2 — Brain Agent *(planned)*
The single interlocutor, v1. Scope anchored by the MVP definition in
[scope.md](scope.md).

- **Deliverables:** conversation system, context assembly, prioritization,
  daily briefing, project context restoration, initial model selection;
  read-only data feeds (calendar, GitHub, Notion, email).
- **Entry:** Phase 1 exit + accepted specs for Brain Agent v1 and its data feeds.
- **Exit:** the user starts a real workday with the briefing (J1) and restores
  project context via the Brain Agent instead of manually (J2), for two
  consecutive weeks.

### Phase 3 — Memory Engine *(planned)*
Working, episodic, semantic, and procedural memory; Knowledge Graph and vector
search as the retrieval backbone.

- **Deliverables:** memory write/read paths for every Brain Agent interaction,
  retrieval policy, token-efficiency measures.
- **Entry:** Brain Agent v1 in daily use (produces real memory demand).
- **Exit:** sessions never start from zero; the Brain Agent answers questions
  about past decisions and project history correctly from memory (A8).

### Phase 4 — Agent Runtime *(planned)*
Lifecycle management for Worker Agents, including Claude Code sessions.

- **Deliverables:** start/pause/resume/monitor/prioritize/delegate; limits on
  cost and resources; events for every lifecycle transition.
- **Entry:** Event System design accepted (Phase 1 architecture) + runtime spec.
- **Exit:** zero manual polling — the user learns about agent completions and
  blockers exclusively through the Brain Agent (J3).

### Phase 5 — Dashboard *(planned)*
Real-time visibility complementing the conversation.

- **Deliverables:** running agents, priorities, costs, token usage, status,
  ETAs, notifications; voice interface integration point.
- **Entry:** Agent Runtime emitting events (Phase 4).
- **Exit:** system state is observable at a glance without asking; no capability
  is gated on the dashboard (A6).

### Phase 6 — Integrations *(planned)*
Full, bidirectional integrations as replaceable services.

- **Deliverables:** write actions (send, schedule, update) for Outlook, Gmail,
  calendar, Notion, GitHub, messaging; per-integration contracts and approval
  boundaries.
- **Entry:** per-integration spec including permitted write actions and
  approval rules.
- **Exit:** routine cross-tool workflows run without the user acting as the
  integration layer (P2).

### Phase 7 — Autonomy *(planned)*
The system increasingly initiates and completes work on its own.

- **Deliverables:** intention management (J7), proactive task detection,
  self-monitoring, escalation policy.
- **Entry:** Phases 2–6 stable in daily use; trust and reversibility
  demonstrated per action class.
- **Exit:** open-ended — autonomy expands per action class via ADRs, never
  implicitly (see non-goal "autonomy as an end in itself" in [scope.md](scope.md)).

## Change Rules

Re-sequencing phases or changing exit criteria requires an ADR. Progress
updates (status, progress lines) are routine edits.
