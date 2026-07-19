# ADR-0006: Modular monolith instead of day-one microservices

- **Status:** accepted
- **Date:** 2026-07-17
- **Deciders:** alex
- **Related:** [principles.md A3/A4](../00-product/principles.md), [ADR-0004](adr-0004-cognitive-load-as-primary-criterion.md)

## Context

Principles A3 (Event Driven) and A4 (Service Oriented), read literally, imply a
distributed system: independently deployed services communicating over a
network. But AIOS is single-user, self-hosted, and must run reliably 24/7 with
near-zero operations effort — **the operational complexity of AIOS itself is
cognitive load for its user** (ADR-0004). A distributed system for one user
maximizes exactly the failure modes (partial outages, version skew, deploy
orchestration, distributed debugging) that consume attention.

## Options Considered

### Option A — Microservices from day one
Matches A4 literally; components independently deployable and replaceable.
Cons: 8+ deployables for one user; network failure modes without scale
benefits; iteration speed collapses during the phase where the domain is least
understood; the system most likely to page its own user.

### Option B — Unstructured monolith
Fastest start. Cons: boundaries erode immediately; replacing a capability
(A4's actual goal) becomes impossible; the codebase becomes hostile to
AI-driven modification — module contracts are what make AI edits safe.

### Option C — Modular monolith with enforced contracts
One deployable. Each capability (Memory Engine, Agent Runtime, Integrations,
Voice, …) is a module with an explicit public contract; modules communicate
only via the internal event bus and contract interfaces — never via imports of
internals. Extraction path: any module can be lifted into a separate service
later because its contract already exists.

## Decision

**Option C.** A4 is interpreted as **service-oriented contracts, not
service-oriented deployment**: replaceability is guaranteed at the contract
level from day one; separate deployment happens per module only when evidence
demands it (e.g., isolation of a crashing integration, divergent scaling).

## Consequences

- **Positive:** one deployable to run, back up, and debug; fast iteration;
  contracts still enforce A4's intent; extraction remains possible.
- **Negative / accepted cost:** boundary discipline must be enforced by
  tooling (import lint rules, contract tests), not by network separation; a
  misbehaving module can degrade the whole process until extracted.
- **Future risks:** if boundary enforcement is neglected early, later
  extraction becomes expensive — mitigation: contract tests are part of every
  module spec (A1).
- **ADR:** yes — this reinterprets a binding principle (A4) and is hard to
  reverse once module structure hardens.
