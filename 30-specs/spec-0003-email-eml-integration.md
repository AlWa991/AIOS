---
status: approved
owner: alex
last_updated: 2026-07-20
---

# Spec: Vertical Slice 3 — read-only email integration (RFC 822 / .eml)

- **Architecture doc:** [../10-architecture/domain-model.md](../10-architecture/domain-model.md)
- **Constraining ADRs:** 0009 (adapters), 0011 (coverage first-class), 0013 (contexts), 0015 (UTC), 0017 (Situation = sole read surface), 0018 (slice review)
- **Approved:** by Alex 2026-07-20 ("Vertical Slice 3 is approved")

## Purpose & Scope

First read-only email integration. Objective is NOT email management — it is
proving that AIOS can **transform unstructured communication into
situational awareness** without changing any bounded context.

**Source decision:** a directory of RFC 822 `.eml` files
(`AIOS_EMAIL_EML_DIR`), parsed with `mailparser`. Rationale: `.eml` is the
real-world standard carrying the actual hard problems (HTML bodies,
quoted-printable encoding, umlauts, reply quoting, signatures, threading
headers) with zero auth infrastructure; any mailbox (Outlook export, Mail
rule, later an n8n bridge or MS Graph sync) can feed the directory. Graph/
IMAP become later adapters behind the same perception port — adapter swap,
no architecture change (Slice 2 precedent).

**The transformation (the point of this slice):** Perception normalizes,
it does not relay:

1. **Thread folding:** `In-Reply-To`/`References` (fallback: normalized
   subject) group messages into one thread; `externalId` = thread id. N
   emails in a thread become ONE situation item — one open loop, updated by
   the latest message — instead of N rows of noise. (Cognitive load, ADR-0004.)
2. **Mention extraction:** From/To/Cc display names and names in the body
   matched against known entity aliases become mentions → existing Identity
   resolution; unknown senders surface as coverage gaps (already-built
   behavior, now on real mail).
3. **Content reduction:** HTML → text, quoted reply tails and signature
   blocks stripped, body reduced to a short snippet; `Date` header → UTC.

**Non-goals:** IMAP/Graph/OAuth, sending or drafting real email, folder
management, attachment handling (skipped with structured warning), spam
logic, background watching (ingest runs on `aios day`), LLM-based content
understanding (deterministic skeleton; MAL slice later).

## Hard Constraint (Slice 2 precedent — the acceptance criterion)

`git diff` may touch ONLY: `src/contexts/perception/**`, `src/runtime/**`
(+ CLI bootstrap env wiring), `src/contracts/events/registry.ts` (additive
optional fields only, e.g. `threadId`, `messageCount`), `fixtures/`
(sample `.eml` set), `tests/`, `package.json`/lockfile, docs. Reuse the
existing `perception_watermarks` table (`source = 'email'`, item_uid =
thread id, hash over latest message id + count) — expected: **zero new
migrations**. Zero diffs in all other contexts/contracts. If impossible:
STOP and report — no workarounds.

## Behavior

1. `aios day` with `AIOS_EMAIL_EML_DIR` set: read `*.eml`, parse, group
   into threads, normalize (UTC, snippet, mentions), emit
   `perception.observation.captured` (source `email`) per **new or changed
   thread** (watermark check — unchanged directory ⇒ 0 events on re-run).
2. A new reply to a known thread updates the existing situation item
   (same `externalId`), it does not create a second one.
3. Malformed `.eml` files are skipped with a structured warning; valid ones
   proceed. Unset env ⇒ fixture adapter (golden test untouched).
4. Everything downstream (Identity → Memory → Situation → Deliberation →
   briefing/dashboard) runs UNCHANGED.

## Error Handling

Unreadable directory: non-fatal, structured error, other sources continue.
Per-file parse failures: skip + warn (partial ingest beats total failure).

## Acceptance Criteria

- [ ] Diff proof via `git diff --stat`: only allowed paths, zero new migrations
- [ ] Committed realistic sample set `fixtures/sample-emails/` (≥6 files):
      plain text, HTML-only, quoted-printable with umlauts, a 3-message
      thread, unknown sender, one with attachment (skipped content)
- [ ] Unit: thread grouping (References + subject fallback), HTML→text,
      snippet/quote stripping, UTC from Date header, umlauts intact
- [ ] Idempotency: same directory twice → 0 new events; adding one reply
      `.eml` to the thread → exactly 1 update event, still 1 situation item
- [ ] Integration: full pipeline → threads in SituationView + briefing as
      single items; unknown sender as coverage gap
- [ ] Existing 24 tests stay green unchanged (golden file untouched)
- [ ] Container proof: compose green; `.eml` dir mounted into the app
      container, `aios day` + `aios brief` show the threads

## Open Questions

None.

## Slice Review (ADR-0018)

1. **New user capability:** real email (any mailbox exporting `.eml`)
   becomes situational awareness: an N-message thread appears as ONE open
   loop in briefing and dashboard, updated by the latest message — not N
   rows of noise. Unknown senders surface as coverage gaps automatically.
2. **Architecture learning:** unstructured data forced real normalization
   *into* Perception (thread folding, quote/signature stripping) — and the
   boundaries held again: zero changes to any other context, zero
   migrations. But the slice exposed a blind spot in the additive-event
   strategy: new optional payload fields (`threadId`, `messageCount`) are
   silently dropped at the Situation fold's payload whitelist. **Additive ≠
   automatically consumed** — schema evolution needs a consumption check,
   not just a compatibility check.
3. **Did any bounded context become weaker?** No boundary weakened — but
   two tensions are now on record: (a) Perception is accumulating
   normalization logic per source; acceptable while per-adapter, watch for
   god-module growth. (b) The Identity boundary blocked body-text mention
   matching (alias registry is Identity-internal, Perception cannot read
   it) — the boundary held at the cost of capability; resolving it
   (queryable alias contract vs. Identity-side body scanning) is a genuine
   ADR candidate for a future slice, not a workaround.
4. **Proposed quality metric — "Understanding Coverage":** per source:
   (resolved mentions / total mentions) as resolution ratio, plus staleness
   (time since last successful ingest). Both are already derivable from the
   existing event log (`identity.entity.resolved` confidence ×
   `observation.captured` counts) — no new data needed, only a projection.
   This measures exactly what AIOS claims to provide: how much of the
   user's world it actually understands, and how fresh that understanding
   is. Candidate for a future slice as part of `SituationView.coverage`.
