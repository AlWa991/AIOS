---
status: active
owner: alex
last_updated: 2026-07-17
---

# User & Jobs-to-be-Done

## The User

The initial and primary user of AIOS is **Alex** — founder/CEO of an AI
consulting agency (DACH market). AIOS is single-user by design for now (see
[scope.md](scope.md)). The user combines three roles in one workday:

| Role | Activities |
|------|-----------|
| Architect / builder | Software architecture, code review, running multiple Claude Code sessions and long-running AI agents in parallel |
| Consultant | Customer meetings, AI consulting, proposals, documentation |
| Business owner | Prioritization across projects, email, WhatsApp, calendar, Notion, strategic decisions |

**The defining characteristic:** many projects run simultaneously, and much of
the actual production work is done by AI agents. The user's day is dominated by
*coordination* — starting agents, waiting for agents, reviewing results,
switching contexts — not by producing artifacts personally.

**The core pain:** cognitive load from continuous context switching. Not lack
of tools, not lack of model capability.

## Jobs-to-be-Done

Format: *When [situation], I want [outcome], so that [value].* Every AIOS
capability must trace back to at least one of these jobs.

| # | Job | Cognitive load removed |
|---|-----|------------------------|
| J1 | When I start my day, I want a single briefing of what happened, what matters, and what awaits my decision, so that I don't assemble it from six tools. | Morning triage across tools |
| J2 | When I switch to a project, I want its full context restored in seconds (state, open loops, agent status, last decisions), so that I don't rebuild it mentally. | Context-switch rebuild cost |
| J3 | When a long-running agent finishes or gets stuck, I want to be informed only if it needs me, with the decision pre-framed, so that I don't poll sessions. | Agent babysitting |
| J4 | When several things compete for my attention, I want the system to prioritize and sequence them, so that I don't re-decide "what's next" all day. | Repeated micro-prioritization |
| J5 | When I have a thought — walking, driving, between meetings — I want to speak it and have it captured, routed, and acted on, so that nothing lives only in my head. | Open loops held in memory |
| J6 | When a customer contacts me (email, WhatsApp, meeting), I want the relevant history and commitments surfaced, so that I respond well without searching. | Manual context retrieval |
| J7 | When I state an intention ("get project X demo-ready by Friday"), I want the system to decompose, delegate, and track it, so that I manage outcomes, not tasks. | Manual task decomposition & tracking |
| J8 | When my day ends, I want open loops explicitly closed or parked with a plan, so that work doesn't follow me into the evening. | Background rumination |

## Key Scenarios

Concrete situations the architecture must serve. Each scenario names the jobs
it exercises.

1. **Parallel-agent morning** *(J1, J3, J4)* — Three Claude Code sessions ran
   overnight. Two finished, one is blocked on an ambiguous requirement. The
   briefing summarizes results, surfaces the one blocking question as a framed
   decision, and proposes today's sequence.
2. **Meeting sandwich** *(J2, J6)* — Between two customer calls, 20 minutes
   remain. The Brain Agent proposes the one project task that fits the slot and
   restores its context verbally; before the next call, it briefs on the
   customer's history and open commitments.
3. **Voice capture on the move** *(J5, J7)* — After a meeting, the user speaks
   three thoughts into the phone: a proposal idea, a bug suspicion, a reminder.
   Each is transcribed, linked to its project in the knowledge graph, and
   turned into either an agent task, a note, or a scheduled follow-up.
4. **Intention, not tasks** *(J7, J3, J4)* — The user states one sentence:
   "IMH must be demo-ready by Thursday." The system produces a plan, starts
   worker agents, monitors progress, and comes back exactly twice: once with a
   scope question, once with the completed result.
5. **Interrupt filtering** *(J4, J6)* — During deep work, twelve emails and
   agent events arrive. Eleven are handled or queued silently. One — a customer
   escalation — interrupts, with context and a proposed response.

## Success Signals

Directional, user-perceived measures (formal metrics belong in specs):

- Context restoration after a switch: **seconds, not minutes**.
- Interruptions per day: **only decision-relevant ones** reach the user.
- Agent coordination: **zero manual polling** of running sessions.
- Open loops: **none held only in the user's head** at end of day.
- Share of user time spent on strategy and decisions: **rising over time**.
