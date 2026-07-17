# ADR-0015: Time as cross-cutting dimension with platform conventions

- **Status:** proposed
- **Date:** 2026-07-17
- **Deciders:** alex
- **Related:** [ADR-0007](adr-0007-postgres-event-log-backbone.md), [ADR-0011](adr-0011-situation-model-and-interface-projections.md), [ADR-0013](adr-0013-seven-context-domain-architecture.md), [domain-model.md §5a](../10-architecture/domain-model.md)

## Context

The stress test (2026-07-17) asked whether AIOS needs a unified temporal
model or whether time belongs inside each bounded context. Time appears
everywhere: event timestamps (Perception), validity of assertions (Memory,
Identity), horizons and staleness (Situation), deadlines and scheduling
(Deliberation, Execution), quiet hours (Interaction). Two failure modes must
be avoided: a "Time context" that every other context depends on (a god
dependency around a concept, not a responsibility), and seven private,
incompatible notions of time that make cross-context reasoning ("what did
AIOS believe on Tuesday?") impossible.

## Options Considered

### Option A — Dedicated Time bounded context
Time is not a responsibility; nothing *owns* time. A Time context would be a
universal dependency with no cohesive behavior — pure coupling.

### Option B — Each context models time privately
Guarantees drift: Memory's `valid_until` vs Situation's `stale_after` vs
Identity's `since` become subtly incompatible; replay and audit ("state as
of date X") become unanswerable across contexts.

### Option C — Time as cross-cutting dimension: platform conventions, local semantics
Time semantics stay local (a deadline means something different from a trust
decay), but the *representation and mechanics* are platform-level
conventions every context must follow.

## Decision

**Option C.** Four binding conventions, normative for all contexts:

1. **One clock:** all persisted timestamps are UTC (RFC 3339). Europe/Berlin
   is a rendering concern of Interaction only.
2. **Bitemporal pattern:** any assertion about the world carries
   `valid_from` / `valid_to` (when it was true) *and* `recorded_at` (when
   AIOS learned it). Memory and Identity reuse the identical pattern — this
   is what makes "what did AIOS believe on date X?" answerable, and it is
   the basis for versioned, never-overwritten state (ADR-0012 principles).
3. **Horizon taxonomy:** one shared vocabulary — `now / today / week /
   quarter / year` — used by Situation (horizon rule), Deliberation
   (prioritization windows), and Interaction (progressive disclosure).
   Contexts may not invent private horizon scales.
4. **Time enters as events:** no context polls the wall clock for business
   logic. A platform **Scheduler** emits time events (`time.tick`,
   `schedule.due`, `deadline.approaching`) onto the event log. Consequence:
   replays are deterministic and tests run against a simulated clock.

## Consequences

- **Positive:** cross-context temporal queries and audits work; deterministic
  replay of any past state; testability without waiting or mocking per
  context; no god-module.
- **Negative / accepted cost:** the Scheduler is new platform surface and a
  single point of temporal truth — it must be boringly reliable; bitemporal
  columns add schema weight even where naive timestamps would do.
- **Future risks:** convention erosion (a context "just this once" reads the
  wall clock) breaks replay determinism silently — mitigation: contract
  tests assert no direct clock access outside the platform layer.
- **Follow-ups:** platform doc `event-backbone.md` gains the Scheduler;
  GLOSSARY gains *Bitemporality* and *Horizon*; the event registry reserves
  the `time.*` / `schedule.*` namespaces.
