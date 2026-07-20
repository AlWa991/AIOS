---
status: approved
owner: alex
last_updated: 2026-07-20
---

# Spec: Vertical Slice 2 — real read-only calendar integration (ICS)

- **Architecture doc:** [../10-architecture/domain-model.md](../10-architecture/domain-model.md)
- **Constraining ADRs:** 0009 (adapters), 0011 (coverage first-class), 0013 (contexts), 0015 (time/UTC), 0017 (Situation = sole read surface)
- **Approved:** by Alex 2026-07-20 ("Build Vertical Slice 2")

## Purpose & Scope

Replace the calendar **fixture** with the first **real read-only calendar
integration**. The objective is architectural proof, not features:

> Real-world data enters through a new Perception adapter — and **no bounded
> context changes**. The Situation Model remains the single source of truth;
> interfaces keep reading only `Situation.current()` (ADR-0017).

**Provider decision:** ICS subscription URL (e.g. Outlook "Publish calendar")
instead of MS Graph OAuth. Rationale: ICS is a real-world standard carrying
the hard problems (recurrence rules, timezones, all-day events,
cancellations, attendees) with zero auth infrastructure; it is read-only by
construction; MS Graph becomes a *second* adapter behind the same port later
(ADR-0009 — adapter swap, no architecture change). Not an ADR: reversible by
design.

**Non-goals:** write access, MS Graph/OAuth, background polling daemon
(ingest runs on `aios day`), staleness display in Situation (deferred —
would touch Situation), timezone-localized rendering (deferred — would touch
Interaction; briefing stays UTC for now).

## Hard Constraint (THE acceptance criterion)

`git diff` for this slice may touch ONLY:
- `src/contexts/perception/**` (new adapter + ingest state)
- `src/runtime/**` and `src/apps/cli` bootstrap (adapter selection via env)
- `migrations/` (one Perception-owned table), `tests/`, fixtures/sample ICS,
  `package.json` (ICS parser dependency), docs
- `src/contracts/events/registry.ts` ONLY if additive (new optional payload
  fields) — no breaking change, no new contract files

Zero diffs in `src/contexts/{identity,memory,situation,deliberation,execution,interaction}/`
and in all other `src/contracts/*`. If the integration cannot be built within
this constraint, STOP and propose an ADR — no workarounds (Alex's directive).

## Interfaces / Contracts

- New Perception-internal adapter implementing the existing perception
  adapter port: `IcsCalendarAdapter`.
- Config: `AIOS_CALENDAR_ICS_URL` set → real adapter; unset → fixture
  adapter (tests and golden file stay deterministic).
- ICS parsing via `node-ical` (runtime dependency — goes in `dependencies`).
- Observation payload: reuse `perception.observation.captured v1` calendar
  shape; additive optional fields allowed (e.g. `attendees: string[]`,
  `location`, `allDay`, `sourceUid`). Attendee display names become mentions
  → existing Identity resolution handles them unchanged (unknown attendees
  surface as coverage gaps — already-built behavior, now on real data).

## Data Model

- `perception_watermarks(source text, item_uid text, content_hash text,
  last_seen_at timestamptz, PRIMARY KEY (source, item_uid))` — Perception-owned
  ingest state for idempotent re-runs.

## Behavior

1. `aios day` with `AIOS_CALENDAR_ICS_URL` set: fetch ICS (timeout 10 s,
   2 retries), parse, expand recurrences within window [today, today+7d],
   convert all times to UTC (ADR-0015; TZID + all-day handling).
2. Per event instance compute `content_hash` (uid + recurrence-instance date
   + SEQUENCE/DTSTAMP + summary + times + status). Emit
   `observation.captured` ONLY for new/changed instances (watermark check) —
   re-running `aios day` twice emits nothing new the second time.
3. Cancelled instances (STATUS:CANCELLED / EXDATE removal of a previously
   seen instance) emit an observation with `status: "cancelled"` — the
   existing Situation fold marks the item accordingly (no Situation change;
   if the current fold cannot express this, STOP per the hard constraint).
4. Fetch failure after retries: log structured error, keep last ingested
   state, exit non-fatally — the day still starts with email/github sources.
5. Everything downstream (Identity → Memory → Situation → Deliberation →
   briefing/dashboard) runs UNCHANGED.

## Error Handling

Timeout + 2 retries with backoff on the HTTP fetch (external call rule);
malformed ICS components are skipped with a structured warning, valid ones
proceed (partial ingest beats total failure).

## Acceptance Criteria

- [ ] Diff proof: slice touches only the paths in the Hard Constraint —
      verified via `git diff --stat` in the test/report
- [ ] Unit tests against a committed realistic sample `.ics` (Europe/Berlin
      TZID, weekly recurring event, all-day event, cancelled instance,
      attendees): correct UTC conversion, correct recurrence expansion in
      window, all-day handled
- [ ] Idempotency test: ingest same ICS twice → second run emits 0 events;
      modified SEQUENCE → exactly 1 update event
- [ ] Integration test: local HTTP server serves sample ICS → full pipeline →
      real events appear in `SituationView` and briefing; unknown attendee
      appears as coverage gap
- [ ] Existing tests stay green unchanged (golden file untouched — fixture
      default)
- [ ] Container proof: compose build passes; `aios day` + `aios brief` with
      `AIOS_CALENDAR_ICS_URL` pointing at a served sample inside the network
- [ ] Live demo (needs Alex's URL): a real Outlook appointment appears in
      `aios brief` without any manual input — the previously impossible
      capability

## Open Questions

None — provider decision documented above; live-demo URL supplied by Alex
after implementation.
