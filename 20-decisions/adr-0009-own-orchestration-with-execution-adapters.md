# ADR-0009: Own orchestration layer with execution adapters

- **Status:** accepted
- **Date:** 2026-07-17
- **Deciders:** alex
- **Related:** [principles.md A4/A5, P7](../00-product/principles.md), [ADR-0006](adr-0006-modular-monolith-topology.md), [scope.md](../00-product/scope.md)

## Context

The Brain Agent and Agent Runtime need an execution substrate. The agent
framework ecosystem (LangGraph, CrewAI, AutoGen, …) is churning fast; betting
the core of a years-long system on any of them contradicts A5 in spirit even
where they claim multi-model support — the lock-in shifts from the model to
the framework. Meanwhile, AIOS's actual domain logic (intentions → plans →
delegated tasks → decision points, P7) exists in no framework: it is the
COO behavior that *is* the product. A further constraint: Claude Code sessions
are a primary worker type and are best driven through their native tooling
(Claude Agent SDK / CLI), not re-implemented.

## Options Considered

### Option A — Adopt a full agent framework
Fastest visible progress; community patterns. Cons: framework lock-in with
high churn risk; the COO domain must be bent into someone else's graph
abstraction; debugging happens in foreign internals; A5 compromised at the
framework layer.

### Option B — Raw provider SDKs, everything self-built
Maximum control and durability. Cons: rebuilds solved problems (tool-call
loops, session management, streaming) — cost without differentiation.

### Option C — Own thin domain orchestration + execution adapters
AIOS owns the durable layer: intention/plan/task model, scheduling,
prioritization, delegation, decision-point protocol. Each execution engine
sits behind an `ExecutionAdapter` contract: Claude Agent SDK/CLI for Claude
Code sessions, direct provider APIs (via the Model Abstraction Layer) for
lightweight workers, other frameworks adoptable per adapter if ever justified.

## Decision

**Option C.** The domain orchestration layer is the durable, differentiating
asset and is owned by AIOS; execution engines are commodities behind adapters.
No engine concept (graph nodes, framework state, provider session formats) may
leak above the adapter contract.

## Consequences

- **Positive:** COO logic survives every framework and model generation;
  engines are replaceable per task class; native, first-class Claude Code
  integration without framework indirection.
- **Negative / accepted cost:** we own scheduling and delegation logic
  ourselves; each new engine costs one adapter.
- **Future risks:** adapter contract designed too narrowly around today's
  engines — mitigation: contract is specified (A1) against the domain model,
  not against any engine's API; leakage caught by contract tests.
- **ADR:** yes — this is the structural bet of the whole system and nearly
  irreversible once domain logic entangles with a framework.
