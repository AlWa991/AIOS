# ADR-0002: English as handbook language

- **Status:** accepted
- **Date:** 2026-07-17
- **Deciders:** alex
- **Related:** [ADR-0003](adr-0003-agents-md-as-machine-entry-point.md), [documentation-guide.md](../50-meta/documentation-guide.md)

## Context

The primary consumers of this repository are AI systems from multiple vendors
(AI First principle). The user is German-speaking; the original seed documents
were written in German. A language decision made late would force a costly
migration of a growing document corpus.

## Options Considered

### Option A — German
Matches the user's native language. Cons: weaker cross-model comprehension,
mixes with English technical vocabulary, conflicts with the user's own global
policy (technical artifacts in English).

### Option B — English
Best multi-model comprehension, uniform technical vocabulary, consistent with
the user's global language policy. Cons: user-facing material needs translation.

## Decision

**All repository documents are written in English.** German is used only in
user-facing conversation and in summaries generated on demand — never in
committed handbook content. The German seed documents (`00-product/vision.md`,
`00-product/roadmap.md`) are migration debt and will be rewritten in English in
Stage 1.

## Consequences

- **Positive:** uniform corpus, maximal AI readability, no future migration.
- **Negative / accepted cost:** German summaries are generated, not maintained.
- **Follow-ups:** rewrite the two German seed documents during Stage 1.
