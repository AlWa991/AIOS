# ADR-0016: TypeScript as core language; Python limited to specialized workers

- **Status:** accepted
- **Date:** 2026-07-19
- **Deciders:** alex
- **Related:** [ADR-0006](adr-0006-modular-monolith-topology.md), [ADR-0009](adr-0009-own-orchestration-with-execution-adapters.md), [ADR-0013](adr-0013-seven-context-domain-architecture.md)

## Context

The modular monolith (ADR-0006), the orchestration layer (ADR-0009), and all
seven bounded contexts (ADR-0013) need a core implementation language. The
requirements: one language across the entire cognitive loop (context
switching between languages is itself cognitive load, ADR-0004), first-class
type-level contracts to enforce module boundaries, strong async/event
ergonomics for the event backbone, and a single runtime serving both backend
logic and web-facing projections (dashboard).

## Options Considered

### Option A — Python core
Strongest AI/ML library ecosystem. But weaker type-level contract
enforcement, a second stack needed anyway for the dashboard, and Alex's
existing production tooling is predominantly TypeScript/Node.

### Option B — TypeScript core
One language from event log to dashboard; interfaces and discriminated
unions map directly onto the contract layer and event registry; Claude
Agent SDK and the Node ecosystem cover orchestration needs (ADR-0009).
Weakness: ML-adjacent workloads (embeddings pipelines, audio processing,
specialized parsers) are Python-native.

### Option C — Polyglot per context
Best tool per context, but multiplies build/deploy/test toolchains and
violates the modular-monolith premise of cheap in-process contracts.

## Decision

**Option B with a bounded escape hatch:** TypeScript (Node.js) is the core
language for the monolith — all seven contexts, the platform layer, and all
projections/interfaces.

**Python is permitted only for specialized workers** (e.g. ML/embedding
pipelines, audio/speech processing) and only **behind stable adapters**: a
Python worker is invoked through an ExecutionAdapter or a platform-level
worker contract, communicates via the event log or a versioned API, and
never imports or is imported by core modules. From the monolith's
perspective a Python worker is an external system.

## Consequences

- **Positive:** one toolchain (build, lint, test, deploy); type-checked
  contracts enforce ADR-0006 boundaries mechanically; dashboard and core
  share types; model-agnostic adapters (ADR-0009) are ecosystem-neutral.
- **Negative / accepted cost:** occasional friction when a Python-native
  library would be convenient — the adapter boundary must be paid for.
- **Future risks:** worker sprawl ("just one more Python service") eroding
  the monolith — mitigation: each new Python worker requires a spec in
  30-specs/ naming the reason TypeScript is insufficient.
- **Follow-ups:** tech-stack.md in 10-architecture/ (runtime/tooling
  versions) once the walking skeleton fixes them.
