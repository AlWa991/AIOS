# ADR-0018: Every vertical slice must answer two questions

- **Status:** accepted
- **Date:** 2026-07-20
- **Deciders:** alex
- **Related:** [ADR-0004](adr-0004-cognitive-load-as-primary-criterion.md), [ADR-0005](adr-0005-ai-systems-as-critical-reviewers.md), [spec-0002](../30-specs/spec-0002-calendar-ics-integration.md)

## Context

After Slice 2 (real ICS calendar integration), Alex observed that the most
important result was not the feature but the proof: real-world data entered
the system without changing the domain architecture. That learning is worth
more than the integration itself — and it would have been easy to lose in an
implementation-focused report.

## Decision

From Slice 2 onward, every vertical slice must explicitly answer, in its
spec's closing review and in the report to Alex:

1. **What new capability does AIOS provide to the user?**
2. **What did this slice teach us about the architecture?**

These answers are as important as the implementation itself. A slice whose
report omits them is not complete. The spec template gains a
`## Slice Review` section carrying both answers (filled at completion).

## Consequences

- **Positive:** architectural learning is captured while fresh, in the repo,
  not in chat; slices stay honest about whether they validated anything
  (ADR-0004: learning over feature count); weaknesses surface as first-class
  results instead of being patched silently.
- **Negative / accepted cost:** slight reporting overhead per slice.
- **Future risks:** ritualization — answers degrade into boilerplate.
  Mitigation: the reviewer role (ADR-0005) applies to these answers too;
  "nothing learned" is an acceptable, honest answer and a signal to pick
  better slices.
