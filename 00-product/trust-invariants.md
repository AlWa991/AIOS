---
status: active
owner: alex
last_updated: 2026-07-21
---

# Trust Invariants

Living register under [P8 — Trust before intelligence](principles.md). Each
invariant is a rule AIOS must never break, because breaking it once costs more
trust than a hundred good recommendations can rebuild. New invariants are added
as real usage reveals them ([ADR-0020](../20-decisions/adr-0020-living-phase-trust-before-intelligence.md)).
Every invariant must be **enforced in code, never delegated to a prompt**, and
must carry an adversarial test (the spec-0004 lesson: fabricated provenance was
invisible to a fully green suite).

| # | Invariant | Rule | Enforcement |
|---|---|---|---|
| TI-1 | No memory, no claim | Every "you told me…" must trace to a recorded event. No provenance ⇒ AIOS says it doesn't know and argues from the situation alone. | Renderer drops unresolvable citations + logs violation; end-to-end provenance test (spec-0004). |
| TI-2 | Blind spots are always stated | "Was ich nicht sehe" is never removed — not in v1, not in v10. Low confidence is explained (thin data, stale source, conflicting signals). | Briefing layout: blind-spots section unconditional. |
| TI-3 | Degradation announces itself | If the model is unavailable or its output invalid, the fallback says so in the opening line. AIOS never silently pretends full capability. | Rule-based fallback triage with honest opening line; tested without network. |
| TI-4 | An overrule is final for the day | Disagreement is stated once with an impact comparison, then AIOS yields. The overrule is recorded and never re-litigated the same day. | Conversation loop state; override events. |

## Candidate invariants (observed, not yet ratified)

*(added during the living phase as they are encountered)*
