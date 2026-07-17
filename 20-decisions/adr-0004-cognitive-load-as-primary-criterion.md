# ADR-0004: Cognitive load reduction as primary evaluation criterion

- **Status:** accepted
- **Date:** 2026-07-17
- **Deciders:** alex
- **Related:** [vision.md](../00-product/vision.md), [principles.md](../00-product/principles.md), [scope.md](../00-product/scope.md)

## Context

The user's work is dominated by parallel projects, long-running AI agents,
meetings, and constant context switching across many tools. The binding
constraint is not code production — that is delegated to tools like Claude
Code — but **attention**: the cognitive cost of switching, coordinating, and
re-prioritizing. Without a single primary criterion, an "AI OS" project drifts
naturally toward what is easiest to build: coding features, dashboards, and
reactive chat — none of which attack the actual problem.

## Options Considered

### Option A — AIOS as an AI-powered productivity/coding platform
Broad feature surface, familiar patterns, quick visible progress. Cons: every
feature competes on equal footing; the system becomes another tool that *adds*
a context to switch into.

### Option B — AIOS as a cognitive operating system with one primary criterion
Every decision is tested against a single question. Cons: rejects otherwise
attractive features; requires discipline to enforce.

## Decision

**AIOS is a cognitive operating system. Every architectural and product
decision is evaluated against one primary criterion: does it reduce the user's
cognitive load or increase strategic capacity?** Features that fail this test
are out of scope regardless of feasibility or appeal. The Brain Agent behaves
as a trusted Chief Operating Officer, and the user increasingly manages
intentions instead of individual tasks.

## Consequences

- **Positive:** a decidable test for every future feature and trade-off;
  coherent product identity; scope creep is structurally rejected.
- **Negative / accepted cost:** attractive capabilities (e.g., advanced coding
  features) are deliberately rejected; the criterion is qualitative and
  requires honest judgment per decision.
- **Follow-ups:** encoded as the scope test in
  [scope.md](../00-product/scope.md) and as the meta-criterion in
  [principles.md](../00-product/principles.md); product principles P1–P7
  derive from this decision.
