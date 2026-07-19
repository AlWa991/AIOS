---
status: draft
owner: alex
last_updated: 2026-07-19
---

# Spec: Walking Skeleton — one day through the cognitive loop

- **Architecture doc:** [../10-architecture/domain-model.md](../10-architecture/domain-model.md)
- **Constraining ADRs:** 0006 (modular monolith), 0007 (Postgres event log), 0008 (single Postgres), 0009 (adapters), 0011 (projections), 0012 (reversibility), 0013 (seven contexts), 0014 (goals), 0015 (time), 0016 (TypeScript)

## Purpose & Scope

The smallest end-to-end slice that exercises **all seven contexts + the
platform layer** on one flow:

> Day starts → Perception captures (mocked) calendar/email/GitHub data →
> Identity resolves entities → Memory records episodes → Situation folds the
> current state → Deliberation produces goal-cited recommendations →
> Interaction renders a Morning Briefing (CLI) → Dashboard serves the **same**
> Situation Model → user approves one recommendation → Execution runs a mock
> adapter → result flows back into Memory/Situation.

**Goal is learning, not features.** Every element exists to validate an
architectural decision; anything that doesn't is out of scope.

**Non-goals (postponed):** real integrations (fixtures only), voice,
embeddings/pgvector retrieval (column reserved, unused), real LLM calls
(MAL seam with MockModel; real model optional behind env flag), auth,
multi-user, notifications, scheduling beyond `day.started`.

## Repository & Module Layout

Code lives in this repo beside the handbook (monorepo, single package):

```
AIOS/
├── 00-product/ … 50-meta/        # handbook (unchanged)
├── src/
│   ├── platform/
│   │   ├── db/                   # pg pool, migrations (node-pg-migrate)
│   │   ├── events/               # append, subscribe, consumer cursors, registry
│   │   └── scheduler/            # Clock interface + time events
│   ├── contracts/                # ONLY cross-context import surface
│   │   ├── events/               # zod schemas, versioned (the event registry)
│   │   ├── identity.ts  memory.ts  situation.ts  deliberation.ts
│   │   ├── execution.ts  interaction.ts  model.ts (MAL port)
│   └── contexts/
│       ├── perception/           # fixture adapters: calendar, email, github
│       ├── identity/             # mention → entity resolution, edges
│       ├── memory/               # episodes, recall()
│       ├── situation/            # projection folder + rebuild
│       ├── deliberation/         # goals, rule-based recommender
│       ├── execution/            # ActionGate (reversibility) + MockEmailDraftAdapter
│       └── interaction/          # briefing renderer (Markdown)
├── src/apps/
│   ├── cli/                      # `aios day`, `aios brief`, `aios approve <id>`
│   └── dashboard/                # Fastify: GET /situation + one static HTML page
├── tests/                        # vitest: golden, replay, same-model, boundaries
├── migrations/
├── fixtures/                     # calendar.json, emails.json, github.json, goals.json
├── docker-compose.yml            # postgres:16 + app
└── package.json                  # Node 22, TypeScript strict, pnpm
```

**Boundary rule (enforced by dependency-cruiser in CI/test):** a context may
import only from `contracts/` and `platform/` — never from another context's
internals. Violations fail the build. This mechanically enforces ADR-0006.

## Interfaces / Contracts

```ts
// contracts/identity.ts
interface Identity { resolve(mention: Mention): Promise<EntityRef>; }

// contracts/memory.ts
interface Memory { recall(q: { entityIds?: string[]; horizon?: Horizon; text?: string }): Promise<Episode[]>; }

// contracts/situation.ts — consumed by BOTH briefing and dashboard
interface Situation { current(horizon: Horizon): Promise<SituationView>; }
type SituationView = { asOf: string; items: SituationItem[]; coverage: CoverageNote[] };

// contracts/deliberation.ts
interface Deliberation { recommendations(): Promise<Recommendation[]>; }
type Recommendation = { id: string; rationale: string; goalIds: string[]; action?: ActionRequest };

// contracts/execution.ts
interface Execution { request(a: ActionRequest): Promise<ActionResult>; }
type ActionRequest = { adapter: string; reversibility: "reversible" | "compensable" | "irreversible"; payload: unknown };

// contracts/model.ts — MAL seam (MockModel default)
interface ModelPort { complete(req: ModelRequest): Promise<ModelResponse>; }

// platform/scheduler
interface Clock { now(): Date; }   // no context reads Date.now() directly (ADR-0015)
```

**First events (registry v1, zod-validated, additive-only):**

| Event | Publisher |
|---|---|
| `time.day.started v1` | Scheduler |
| `perception.observation.captured v1` | Perception |
| `identity.entity.resolved v1` | Identity |
| `memory.episode.recorded v1` | Memory |
| `situation.item.updated v1` | Situation |
| `deliberation.recommendation.created v1` | Deliberation |
| `deliberation.approval.granted v1` | Deliberation (user via CLI) |
| `execution.action.completed v1` | Execution |
| `interaction.briefing.delivered v1` | Interaction |

## Data Model

- `events(id bigserial PK, type text, version int, occurred_at timestamptz, recorded_at timestamptz default now(), payload jsonb)` — append-only, no UPDATE/DELETE grants
- `consumer_cursors(consumer text PK, last_event_id bigint)`
- `entities(id uuid, kind text, canonical_name text)` · `entity_aliases(entity_id, alias)` · `edges(from_id, to_id, type, valid_from, valid_to, recorded_at)` — bitemporal (ADR-0015)
- `episodes(id, summary, entity_ids uuid[], valid_from, valid_to, recorded_at, embedding vector NULL)` — embedding reserved, unused
- `goals_current(id, title, status, revision)` — projection of `goal.*` events (seeded from fixtures as events)
- `situation_items(id, kind, horizon, status, entity_ids, source_event_id, updated_at)` — **rebuildable**: `TRUNCATE` + replay must reproduce identical state

## Behavior

1. `aios day` (or Scheduler with simulated clock) appends `time.day.started`.
2. Perception fixture adapters emit ~10 `observation.captured` events (3 sources).
3. Identity consumer resolves mentions ("Eddy", "IMH") → entities + edges; unknown mentions create low-confidence entities (coverage material).
4. Memory consumer records one episode per observation.
5. Situation consumer folds events into `situation_items` with horizon tags; unresolved mentions surface as `coverage` notes (ADR-0011: uncertainty first-class).
6. Deliberation (rule-based v1: deadline proximity × goal linkage) emits 3 `recommendation.created`, each citing ≥1 goal (ADR-0014 traceability).
7. `aios brief` renders Markdown briefing from `Situation.current("today")` + recommendations; prose optionally via ModelPort (MockModel = deterministic template).
8. `GET /situation?horizon=today` returns the byte-identical `SituationView` the briefing used. Static HTML renders it. **No second read path, no duplicated logic.**
9. `aios approve <rec-id>` → `approval.granted` → Execution checks reversibility class (compensable → allowed), runs MockEmailDraftAdapter → `action.completed` → Memory + Situation update.

## Error Handling

Skeleton-minimal: consumers are cursor-based and idempotent (replay-safe);
a failing event is retried 3×, then the consumer halts with a structured log
line (no silent skip — halting is honest). No other retry/fallback machinery.

## Acceptance Criteria

- [ ] Golden test: fixtures in → `briefing.md` matches committed golden file (simulated clock)
- [ ] Same-model test: dashboard JSON deep-equals the `SituationView` used by the briefing
- [ ] Replay test: truncate `situation_items` + `goals_current`, replay event log → identical rows
- [ ] Boundary test: dependency-cruiser reports zero cross-context imports
- [ ] Clock test: no direct `Date.now()`/`new Date()` outside `platform/` (lint rule)
- [ ] Execution path: approve → mock adapter runs → completion visible in next `aios brief`
- [ ] Container proof: `docker compose up -d --build` → all services Up, `curl /health` 2xx, `aios brief` works against containerized Postgres

## Open Questions

- Confirm: code lives in this repo (monorepo with handbook) — proposed above, needs Alex's OK.
- Confirm: skeleton stays fully deterministic (MockModel default); real LLM behind env flag only.
