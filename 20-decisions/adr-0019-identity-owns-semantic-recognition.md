# ADR-0019: Perception owns syntax; Identity owns meaning

- **Status:** accepted
- **Date:** 2026-07-20
- **Deciders:** alex
- **Related:** [ADR-0010](adr-0010-identity-as-bounded-context.md), [ADR-0013](adr-0013-seven-context-domain-architecture.md), [Exploration 0001](../10-architecture/explorations/0001-entity-resolution-in-unstructured-content.md), [spec-0003](../30-specs/spec-0003-email-eml-integration.md)

## Context

Slice 3 surfaced the first implementation-driven boundary tension: the
richest situational signal lives in free text ("Petra asked about the IMH
proposal"), but recognizing known entities there requires the alias
knowledge that is Identity-internal. Exploration 0001 mapped the design
space (status quo, lexicon-pull contract, Identity-side recognition,
platform heuristics, dedicated understanding context) against ADR-0004.
Alex approved Option C — and sharpened it: this decision is **about
ownership, not about matching techniques**. Not fuzzy matching, not
embeddings, not LLMs — those are implementations that may change.

## Decision

A stable responsibility boundary, independent of implementation:

1. **Perception owns syntax.** It extracts what the *format* defines:
   headers (From/To/Cc), calendar ATTENDEE, `@handles`, addresses,
   explicit structural references. Perception needs format knowledge only —
   never knowledge of who exists.
2. **Identity owns meaning.** Semantic entity recognition — identifying
   people, organizations, and projects inside content — belongs to
   Identity, **across all information sources**, present and future.
   Identity consumes observations (as it already does) and recognizes
   entities in their content using the knowledge it owns.
3. **Implementations may evolve; ownership must not.** Exact alias match
   today, fuzzy matching, embeddings, or LLM-assisted recognition tomorrow —
   all of it evolves *inside Identity* without any boundary, contract, or
   adapter change. No other context may grow its own recognition capability;
   a future dedicated understanding context would require a superseding ADR
   on new evidence (Exploration 0001, Option E note).

## Alternatives Considered

Per Exploration 0001: (A) structural mentions only — preserves purity,
quietly breaks J2/J6; (B) alias-lexicon contract pulled by Perception —
same user value, but permanently inverts the loop's entry-point dependency
and splits recognition ownership; (D) platform-level heuristics — domain
semantics in the platform plus false-positive noise, i.e. added cognitive
load; (E) dedicated understanding context — a boundary around a function,
premature today.

## Consequences

- **Positive:** zero new coupling (Identity already subscribes to
  observations); one owner for "why was this missed?"; recognition upgrades
  are Identity-local forever; the boundary follows knowledge ownership,
  making the useful answer and the clean answer coincide.
- **Negative / accepted cost:** Identity grows into the second-largest
  context (charter-consistent per ADR-0010: recognizing someone is part of
  "who someone is"); observations must carry fuller content than a display
  snippet (additive event field) — larger event log, accepted since the log
  is episodic-memory raw material (ADR-0007) where fuller text is a benefit.
- **Future risks:** recognition quality pressure may tempt shortcuts in
  Perception adapters ("just match this one name here") — mitigation: this
  ADR makes any non-syntactic matching outside Identity a boundary
  violation; review against it.
- **Follow-ups:** smallest proving slice (spec-0004): additive `text` field
  on observations + Identity-side exact alias scan — no fuzzy matching, no
  NER, ownership proof only.
