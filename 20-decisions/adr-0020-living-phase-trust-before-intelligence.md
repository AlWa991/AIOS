# ADR-0020: Living phase — usage over building; trust before intelligence

- **Status:** accepted
- **Date:** 2026-07-21
- **Deciders:** alex
- **Related:** [ADR-0004](adr-0004-cognitive-load-as-primary-criterion.md), [ADR-0018](adr-0018-slice-review-two-questions.md), [spec-0004](../30-specs/spec-0004-first-morning.md), [P8](../00-product/principles.md)

## Context

With spec-0004 ("The First Morning") shipped, AIOS has its first experienceable
product surface. The temptation is to continue building. Alex decided the
opposite: the builders become the first users. Real daily usage will teach more
than another implementation sprint. Additionally, the slice surfaced a
trust-critical failure mode (fabricated provenance, caught only by adversarial
review), showing that trust properties deserve first-class product status.

## Decision

1. **Major feature development is frozen.** Only bug fixes, usability
   improvements, and issues discovered through daily use are implemented.
   New specs for major capabilities require lifting this freeze explicitly.
2. **The next milestone is behavioral, not technical:** *"Alex naturally
   starts his workday with AIOS instead of Outlook."* Only once that behavior
   feels natural is the next major capability chosen — based on usage
   evidence, not assumptions.
3. **Primary objective of this phase is learning.** Every real morning is
   followed by a short debrief recorded in
   [`40-operations/morning-journal/`](../40-operations/morning-journal/README.md)
   (fixed question set: useful / unnecessary / missing / surprising /
   cognitive load / Outlook pull / trusted recommendation / missed / too much
   / too little).
4. **"Trust before intelligence" becomes product principle P8.** Honesty
   always beats sounding smart. Trust invariants discovered during usage are
   documented in [`00-product/trust-invariants.md`](../00-product/trust-invariants.md)
   as they are encountered — "no memory, no claim" is the founding entry.

## Consequences

- **Positive:** feature decisions gain an evidence base; trust failures are
  treated as product defects of the highest severity; the journal creates the
  raw material for the next roadmap decision; cheap phase — learning costs
  attention, not implementation time.
- **Negative / accepted cost:** momentum on visible capabilities pauses;
  known gaps (goal linkage, email realism, dashboard polish) stay open even
  though they are already designed.
- **Future risks:** (a) the journal degrades into ritual — mitigation:
  "nothing to report" is an acceptable entry, and a week of empty entries is
  itself evidence; (b) "usability improvement" becomes a loophole for feature
  work — mitigation: if it needs a spec, it is a feature, and the freeze
  applies.
