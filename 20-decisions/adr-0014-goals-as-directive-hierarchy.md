# ADR-0014: Goals as directive hierarchy inside Deliberation

- **Status:** proposed
- **Date:** 2026-07-17
- **Deciders:** alex
- **Related:** [ADR-0004](adr-0004-cognitive-load-as-primary-criterion.md), [ADR-0011](adr-0011-situation-model-and-interface-projections.md), [ADR-0013](adr-0013-seven-context-domain-architecture.md), [domain-model.md](../10-architecture/domain-model.md)

## Context

The stress test (2026-07-17) asked whether AIOS needs an explicit Goal
domain. Goals are what turn a monitoring system into a guidance system:
prioritization (J4), coaching, and "intentions over tasks" (P7) are all
meaningless without a reference frame of what the user is trying to achieve.
The question is ownership and placement: own bounded context, Memory,
Situation, or Deliberation?

Observations that drove the analysis:

- Goals are **normative** ("what should be"), not descriptive. Memory records
  what happened; Situation describes what is. A goal is neither — it is a
  standing directive against which both are evaluated.
- Goals are consumed almost exclusively by Deliberation: prioritization,
  intention formation, plan selection, Coach-mode reflection.
- Goals are rare, slow-changing, and few in number (single user, perhaps
  dozens). They have no independent scaling, storage, or integration
  pressure.

## Options Considered

### Option A — Own bounded context "Goals"
Cleanest conceptual separation. But an eighth context for a handful of
slow-changing records violates the simplest-architecture mandate and
ADR-0004: every context adds contract surface, event registry entries, and
cognitive load for future readers. A context with one consumer (Deliberation)
is a module boundary drawn around a data structure, not a responsibility.

### Option B — Goals in Memory
Goals would be "just another remembered fact". Wrong category: Memory is
descriptive and append-driven by perception; goals are normative and changed
only by deliberate user decision. Burying the reference frame for all
prioritization inside recall also makes the Deliberation↔Memory dependency
circular in the worst way (prioritize using recall of what to prioritize by).

### Option C — Goals in Situation
Tempting because the Situation Model already answers "what matters now". But
Situation is a rebuildable CQRS projection (ADR-0011) with a horizon rule —
goals are durable source-of-truth state with year-scale horizons. Putting
source state inside a projection inverts ADR-0011.

### Option D — Goals inside Deliberation as top of a directive hierarchy
Deliberation already owns intentions, plans, and tasks. Goals complete this
into one **directive hierarchy: goals → intentions → plans → tasks** — one
owner for everything normative, one place where "why am I doing this?" has an
unbroken chain.

## Decision

**Option D.** Goals live in Deliberation as the top level of the directive
hierarchy, with these rules:

1. **User-sovereign:** AIOS (any mode, including Coach) may *propose* goal
   creation, revision, or abandonment — only the user decides. No autonomy
   level ever changes a goal.
2. **Versioned, never overwritten:** goal changes are events
   (`goal.created / revised / achieved / abandoned`) on the append-only log.
   Goal-drift history is first-class Coach-mode material.
3. **Traceability invariant:** every intention traces to a goal or is
   explicitly marked ad-hoc; every priority recommendation cites the goals it
   serves.
4. **Values are not goals:** values belong to the Personal Model (aggregate,
   per ADR-0011) — they constrain *how* AIOS acts; goals define *what for*.

## Consequences

- **Positive:** no eighth context; one owner for all normative state; the
  goal→task chain makes every recommendation explainable ("serves goal X");
  versioned goals give Coach mode real material instead of vibes.
- **Negative / accepted cost:** Deliberation grows — it is now the largest
  context. Accepted because its parts (goals, intentions, plans, tasks,
  prioritization) are one cohesive responsibility; splitting them would
  create chatty boundaries.
- **Future risks:** if goals ever gain multi-user ownership (family, team),
  sovereignty and trust semantics change — that would justify revisiting via
  a superseding ADR. Extraction seam exists: goals are event-sourced and
  contract-accessed like everything else.
- **Follow-ups:** GLOSSARY gains *Goal* and *Directive Hierarchy*;
  principles.md P7 wording extended from intentions to the full hierarchy
  upon acceptance; event registry entries for the four goal events.
