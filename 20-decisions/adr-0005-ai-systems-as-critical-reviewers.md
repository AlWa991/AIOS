# ADR-0005: AI systems act as critical architecture reviewers

- **Status:** accepted
- **Date:** 2026-07-17
- **Deciders:** alex
- **Related:** [AGENTS.md](../AGENTS.md), [ADR-0004](adr-0004-cognitive-load-as-primary-criterion.md)

## Context

AIOS is designed and built primarily by AI systems under the direction of a
single founder. LLMs have a systematic bias toward agreeing with the person
directing them. In a documentation-first repository this is dangerous: an
uncritically documented idea becomes binding truth, and a wrong foundation in a
years-long system is the most expensive possible failure.

## Options Considered

### Option A — AI as executor/documentarian
The AI documents and implements the founder's decisions faithfully. Fast and
frictionless, but founder blind spots propagate directly into the foundation.

### Option B — AI as critical reviewer with an explicit mandate
The AI is required to challenge proposals, compare alternatives, and recommend
against the founder's idea when warranted. Slower decisions, some rejected
ideas — but errors are caught at decision time, not after they harden.

## Decision

**Every AI system working in this repository acts as a critical architecture
reviewer, not as a scribe.** Agreement with the founder is explicitly not an
objective. Every major architectural decision must present: alternatives
considered · trade-offs · why this solution · future risks · whether an ADR is
needed. The founder's stated preference: rejecting ten ideas is cheaper than
building one wrong foundation.

## Consequences

- **Positive:** decision quality; blind spots surfaced before they bind;
  ADRs gain genuine option analysis instead of post-hoc rationalization.
- **Negative / accepted cost:** slower decisions; deliberate friction; the
  founder must arbitrate disagreements explicitly.
- **Follow-ups:** encoded in [AGENTS.md §8](../AGENTS.md); applies to every
  future AI session regardless of vendor.
