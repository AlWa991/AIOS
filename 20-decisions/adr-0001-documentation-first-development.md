# ADR-0001: Documentation-first development

- **Status:** accepted
- **Date:** 2026-07-17
- **Deciders:** alex
- **Related:** [AGENTS.md](../AGENTS.md), [DOCUMENTATION_PLAN.md](../DOCUMENTATION_PLAN.md)

## Context

AIOS is a personal AI Operating System intended to evolve over years and to be
developed primarily *by* AI systems. Individual models, sessions, and even
codebases will come and go; the durable asset is the preserved intent and
reasoning. Without an enforced ordering between documentation and code,
AI-driven development drifts: code accumulates faster than understanding, and
future sessions inherit artifacts they cannot explain or safely change.

## Options Considered

### Option A — Code-first with documentation as follow-up
Fast initial progress. Cons: documentation reliably lags, reasoning is lost,
and the repository's stated purpose (single source of truth) fails structurally.

### Option B — Documentation-first: no code without an existing spec
Slower start, but every artifact is explained before it exists. The repository
remains readable and steerable by any AI system at any time.

## Decision

**This repository is developed documentation-first: code may only be written
once a specification for it exists in `30-specs/`.** This applies without
exception, including prototypes committed to this repository. The repository
itself — not the code — is the single source of truth for AIOS.

## Consequences

- **Positive:** preserved reasoning; any AI system can cold-start from the
  handbook; scope creep is caught at spec time, not in review.
- **Negative / accepted cost:** deliberate friction before writing code;
  experiments must live outside this repository until specified.
- **Follow-ups:** enforce via editing rules in [AGENTS.md §5](../AGENTS.md);
  every spec must contain acceptance criteria before implementation starts.
