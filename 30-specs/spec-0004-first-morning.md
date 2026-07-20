---
status: draft
owner: alex
last_updated: 2026-07-20
---

# Spec: Vertical Slice 4 — The First Morning

- **Experience doc (drives this spec):** [../00-product/experience/first-morning.md](../00-product/experience/first-morning.md)
- **Architecture doc:** [../10-architecture/domain-model.md](../10-architecture/domain-model.md)
- **Constraining ADRs:** 0004 (cognitive load = primary criterion), 0014 (goal hierarchy, traceability invariant), 0016 (TS core), 0017 (Situation = sole read surface, recommendations folded back), 0018 (slice review)
- **Approved:** pending

## Purpose & Scope

Turn the briefing from a rendered list into **the first conversation of the
day with an operating partner**. The experience doc is the requirement; this
spec only derives the mechanics. Success is measured by the 30-second
contract, not by technical correctness.

Capabilities in scope:

1. **Triage judgment (Deliberation, real model).** From the SituationView,
   Deliberation produces a structured triage: opening line, "needs you"
   (max 3, each with a one-sentence reason), "decide first" (max 1),
   "changed since yesterday" (delta), "blocked" (split: your move / not
   your move), "ignorable" (count + summary, items collapsed), "blind
   spots", optional disagreement, optional single question. Emitted as an
   event and folded back into Situation (ADR-0017); CLI and dashboard
   render the identical view.
2. **First real model behind the MAL seam.** An Anthropic adapter
   (env-selected, e.g. `AIOS_MODEL=anthropic:claude-sonnet-4-6` +
   `ANTHROPIC_API_KEY`). Unset ⇒ MockModel exactly as today. Model output
   is zod-validated against the triage contract; one retry on invalid
   output; on failure ⇒ deterministic rule-based fallback triage
   (deadline/blocked ordering) that says so honestly in the opening line.
3. **Conversation verbs (CLI v1).** `aios brief` becomes an interactive
   session: `warum <n>` · `mehr <n>` · `ignorier <n> [dauerhaft]` ·
   `wichtiger <n>` / `prio <text>` · `widerspruch <n>` · `zeig ignorierte` ·
   `start <n>` (context handoff) · answer to the daily question. Every
   response is recorded as an event.
4. **Personal memory with provenance.** Stated priorities, overrules and
   permanent-ignores become recorded events. Triage may cite them —
   **only** with a resolvable reference to the source event. The renderer
   enforces "no memory, no claim": a citation without provenance is
   dropped and logged as a contract violation.
5. **Delta & seen-state.** The briefing shows what changed since the last
   presented briefing and never repeats acknowledged items. Presented item
   ids are recorded (additive field on `interaction.briefing.delivered`);
   Situation folds them into per-item `lastPresentedAt`.
6. **Real data as normal dev workflow.** Outlook ICS live via existing
   `AIOS_CALENDAR_ICS_URL` (env only, adapter unchanged); email via
   existing `AIOS_EMAIL_EML_DIR` with real exports.

**User-facing language:** the briefing and all conversation output are
German (workspace language policy). Code, events, docs stay English.

**Non-goals:** voice, dashboard redesign (it renders the same view, minimal
markup only), new integrations (Graph/IMAP/Notion/GitHub), background
scheduling, multi-question onboarding, ML beyond the model call, autonomy
changes (execution still approval-gated).

## New / changed events (additive only)

- `deliberation.triage.created@1` — triageId, day, openingLine, needsYou
  (≤3: itemId, reason, citedPriorityIds[]), decideFirst? (itemId, reason),
  changed[] (itemId, change), blocked[] (itemId, whoseMove), ignorable
  (count, summary, itemIds[]), disagreement? (itemId, recommendation,
  impactComparison), question?, blindSpots[], modelId.
- `deliberation.priority.stated@1` — priorityId, text, scope
  (day|week|month), sourceEventId (provenance to the user response).
- `deliberation.override.recorded@1` — itemId, kind
  (promote|ignore|ignore_permanent|disagree_overruled), sourceEventId.
- `interaction.user.responded@1` — day, verb, itemId?, text.
- `interaction.briefing.delivered@1` — additive optional field
  `presentedItemIds: string[]`.

## Hard Constraints

- `git diff` may touch ONLY: `src/contexts/deliberation/**`,
  `src/contexts/situation/**`, `src/contexts/interaction/**`,
  `src/platform/model/**`, `src/contracts/events/registry.ts` (additive),
  `src/apps/**`, `src/runtime/**`, `migrations/` (new projection tables
  only — event log untouched), `fixtures/`, `tests/`, `package.json`/lock,
  docs. **Zero diffs in Perception, Identity, Execution, Memory** — if a
  change there seems necessary: STOP and report (expected architecture
  learning, not a workaround).
- Golden/replay/same-model tests stay on MockModel and stay green. No test
  may require a network call or API key.
- Triage contract tests assert structure, never wording.
- The one-question rule and the ≤3 / ≤1 caps are enforced in code (schema),
  not in the prompt.

## Behavior

1. `aios day` ingests (calendar live, email dir) unchanged; then
   Deliberation produces the triage from `Situation.current()` + recorded
   priorities/overrides; triage folds back into Situation.
2. `aios brief` renders the experience-doc layout in German from the
   SituationView, then enters the conversation loop; `aios brief
   --no-interactive` prints and exits. Dashboard shows the same view.
3. Re-running `aios brief` the same day re-presents without duplicating
   seen-state; next day, "changed since yesterday" is computed against the
   last presented briefing.
4. Model unavailable/invalid twice ⇒ fallback triage, honest opening line.
5. A disagreement is stated once with an impact comparison; `ok` or
   silence = no action; an overrule is recorded and not re-litigated that
   day.

## Acceptance Criteria

Technical:
- [ ] Diff proof: only allowed paths; zero changes in Perception/Identity/
      Execution/Memory; event log schema untouched (additive registry only)
- [ ] Triage contract test: zod schema, caps (≤3 needsYou, ≤1 decideFirst,
      ≤1 question) enforced; invalid model output ⇒ retry ⇒ fallback
- [ ] Provenance test: a triage citing a non-existent priority event ⇒
      citation dropped + violation logged (no memory, no claim)
- [ ] Delta test: same-day re-brief idempotent; next-day brief lists only
      changes since last presented briefing
- [ ] Conversation test: each verb emits its event; `prio` → priority event
      with provenance; next triage (Mock) can cite it
- [ ] All existing tests green on MockModel without network/API key
- [ ] Container proof: compose green, real ICS URL + `.eml` dir via env,
      `aios day && aios brief` end-to-end in the container

Product (the actual bar):
- [ ] Three consecutive real mornings on live data
- [ ] Alex's 30-second verdict recorded in the slice review: cognitive load
      noticeably lower — yes/no, and why

## Open Questions

1. **Outlook ICS URL** (Alex) — required before the real-morning acceptance.
2. **Anthropic API key** for the first real model call (env/secret handling
   via compose `.env`).
3. Daily `.eml` supply: manual export acceptable for now, or defer email to
   fixture for the first real mornings? (No new integration in this slice.)

## Slice Review (ADR-0018) — to be completed after implementation

1. **New user capability:** the first morning conversation — triage with
   reasons, safe-to-ignore, honest blind spots, memory citations with
   provenance, disagreement with impact comparison.
2. **Architecture learning (expected, verify):** does the frozen
   architecture bear product pressure — recommendation fold (ADR-0017) at
   full briefing scale; first real model through the MAL seam; where
   seen-state naturally lives (Situation projection vs Memory); whether
   goal linkage (ADR-0014) is needed earlier than planned.
