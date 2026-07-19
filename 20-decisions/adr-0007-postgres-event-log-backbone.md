# ADR-0007: Postgres event log as event backbone

- **Status:** accepted
- **Date:** 2026-07-17
- **Deciders:** alex
- **Related:** [ADR-0006](adr-0006-modular-monolith-topology.md), [ADR-0008](adr-0008-single-postgres-for-knowledge-and-memory.md), [principles.md A3/A8](../00-product/principles.md)

## Context

A3 requires all components to communicate via events. Expected volume is
hundreds to low thousands of events per day (agent lifecycle, mails, messages,
calendar changes, voice captures) — roughly six orders of magnitude below what
message brokers are built for. Two properties matter far more than throughput:
**durability** (events are the raw material of episodic memory, A8) and
**replayability** (new consumers — e.g., a future Memory Engine iteration —
must be able to reprocess history).

## Options Considered

### Option A — Dedicated broker (Kafka / NATS JetStream / RabbitMQ)
Proven semantics, scales far beyond any conceivable need. Cons: one more
24/7 system to operate, monitor, and back up (violates the spirit of
ADR-0004); retention configuration works against "keep everything forever";
overkill by design.

### Option B — In-process event bus only
Trivial to build. Cons: events die with the process; no history, no replay,
no episodic memory feed — fails A8 structurally.

### Option C — Append-only event log in Postgres
`events` table (id, type, timestamp, source module, payload JSONB), consumers
track their own cursor; LISTEN/NOTIFY for low-latency wake-up, polling as
fallback. In-process dispatch for the hot path, log as the durable record.

## Decision

**Option C.** The event log is a first-class domain asset, not transport
plumbing: it is simultaneously the integration backbone (A3) and the
raw feed of episodic memory (A8). Access goes through an `EventBus` module
contract (ADR-0006), so a broker can replace the transport later without
touching producers or consumers.

## Consequences

- **Positive:** zero additional infrastructure; full history and replay for
  free; transactional consistency between state changes and event emission
  (outbox semantics come free when both live in one database).
- **Negative / accepted cost:** throughput ceiling (~thousands/sec — irrelevant
  here); consumers must be idempotent; fan-out logic is our code, not broker
  features.
- **Future risks:** unbounded table growth — mitigation: partitioning by
  month from the start; if a true streaming need ever appears, the EventBus
  contract is the seam for a broker.
- **ADR:** yes — the event backbone touches every module and is expensive to
  swap conceptually (though the contract keeps it technically swappable).
