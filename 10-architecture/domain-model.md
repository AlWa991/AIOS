---
status: draft
owner: alex
last_updated: 2026-07-17
---

# Domain Architecture

> Depends on acceptance of ADR-0006…0013. Designed from cognitive
> responsibilities first; technology only where an ADR constrains it.

## 1. Design Method

AIOS is modeled as a **cognitive loop**, not a service catalog:

```
        ┌──────────────────────────────────────────────────┐
        │                    the world                     │
        └───────┬──────────────────────────────▲───────────┘
                │ observe                       │ act
        ┌───────▼───────┐               ┌──────┴────────┐
        │  PERCEPTION   │               │   EXECUTION   │
        └───────┬───────┘               └──────▲────────┘
                │ who?                         │ tasks, gated actions
        ┌───────▼───────┐               ┌──────┴────────┐
        │   IDENTITY    │               │ DELIBERATION  │
        └───────┬───────┘               └──────▲────────┘
                │ resolved observations        │ what matters now?
        ┌───────▼───────┐               ┌──────┴────────┐
        │    MEMORY     │◄─────────────►│   SITUATION   │
        │ (past+known)  │  consolidate  │    (now)      │
        └───────────────┘               └──────┬────────┘
                                               │ projections
                                        ┌──────▼────────┐
                                        │  INTERACTION  │◄──► user
                                        └───────────────┘
```

**Seven bounded contexts.** Everything else from the candidate list is either
a projection, an aggregate, platform infrastructure, or cross-cutting — see §3.

All inter-context communication is via events on the event backbone (ADR-0007)
or via the listed public contracts (ADR-0006). **The event schema is the real
API of this system** — schemas are versioned and evolve additively only.

## 2. Bounded Contexts

### 2.1 Perception

| Aspect | Definition |
|---|---|
| **Purpose** | Convert the outside world into normalized observations; carry out approved outward actions. The system's senses and hands — deliberately decision-free. |
| **Responsibilities** | Connectors (mail, calendar, GitHub, Notion, messaging, meeting artifacts); webhook/poll ingestion; normalization into observation events; sync-state tracking; submitting raw identity mentions to Identity; executing outbound calls on behalf of Execution; sensor health reporting. |
| **Owns** | Connector configurations, sync cursors, raw payload archive, sensor health state. |
| **Never owns** | Meaning or importance of observations (Situation/Deliberation); the decision to act (Execution); identity resolution results (Identity). |
| **Public contracts** | `SensorHealth` (coverage feed for Situation); `ActionPort` per connector (primitive verbs: send, update, create). |
| **Publishes** | `observation.captured.*` (email.received, meeting.ended, commit.pushed, message.received, calendar.changed); `sensor.status.changed`. |
| **Subscribes to** | `action.approved` (from Execution); connector config changes. |
| **Dependencies** | Event backbone, Identity (mention submission), platform secrets. |
| **Invariants** | No observation is dropped silently — durable before ack. Outbound actions execute **only** with an Execution-issued approval token (ADR-0012). Raw payloads are retained (immutable history). |
| **Scalability concerns** | Connector count grows linearly; a flaky connector may not degrade the rest — first extraction candidate under ADR-0006. |

### 2.2 Identity

| Aspect | Definition |
|---|---|
| **Purpose** | Who someone is and how to interact with them (ADR-0010). |
| **Responsibilities** | Canonical person/org registry; entity resolution (mentions → canonical IDs); relationship classes and lifecycle; trust levels; interaction preferences; the **self profile** (stable facts and preferences of the user). |
| **Owns** | Identity tables in the shared graph (ADR-0008), resolution rules, trust assignments. |
| **Never owns** | What people are involved in — ownership/participation edges live in Memory's graph (boundary rule of ADR-0010). |
| **Public contracts** | `IdentityResolution` (mention → canonical ID + confidence); `TrustQuery` (canonical ID → trust level); `ProfileQuery` (self + others' interaction preferences). |
| **Publishes** | `identity.created`, `identity.merged`, `relationship.changed`, `trust.changed`. |
| **Subscribes to** | `observation.captured.*` (extract and resolve mentions). |
| **Dependencies** | Event backbone, shared storage. |
| **Invariants** | Exactly one canonical ID per real-world entity; merges are versioned and reversible (ADR-0012 internal rules); every trust change is evented and auditable. |
| **Scalability concerns** | Resolution quality at growing contact volume → probabilistic matching later; the contract already returns confidence. |

### 2.3 Memory

| Aspect | Definition |
|---|---|
| **Purpose** | Everything AIOS retains beyond the moment: experience (episodic), knowledge (semantic, as graph), skills and routines (procedural) — and its token-efficient retrieval. **Merges the former Memory Engine + Knowledge System** (see §5, amendment A1). |
| **Responsibilities** | Consolidation pipelines (event stream → episodic records → semantic assertions); knowledge graph maintenance (entities, typed edges, embeddings); versioned assertions with source and confidence; contradiction detection; retrieval/context assembly (`Recall`); learned patterns of the user (Personal Model contribution). |
| **Owns** | Graph (non-identity tables), embeddings, memory records, consolidation logic. |
| **Never owns** | Current live state (Situation); canonical identity records (references IDs only); priorities or decisions (Deliberation). |
| **Public contracts** | `Recall` (query + token budget → ranked context bundle with confidence per item); `Remember` (explicit store); `KnowledgeQuery` (graph traversal). |
| **Publishes** | `memory.consolidated`, `knowledge.updated`, `contradiction.detected`. |
| **Subscribes to** | Nearly everything — it is the historian: `observation.*`, `decision.made`, `task.*`, `agent.completed`, `interaction.*`. |
| **Dependencies** | Event backbone, shared storage, Model Abstraction Layer (consolidation inference), Identity (ID references). |
| **Invariants** | Assertions are never overwritten — superseded with version history (ADR-0012). Every assertion carries source, timestamp, confidence. `Recall` declares confidence and provenance for everything it returns. |
| **Scalability concerns** | Consolidation LLM cost (batch, cheap models); pgvector recall at large corpus (extraction seam per ADR-0008); episodic compaction policy needed by year two. |

### 2.4 Situation

| Aspect | Definition |
|---|---|
| **Purpose** | What is true **now** — the substrate of Shared Situational Awareness (ADR-0011). |
| **Responsibilities** | Maintain current-state projections: running agents, today's calendar, open communications, blockers, waiting states, active project status; track **coverage** (which sensors observe what) and **staleness**; annotate uncertainty. |
| **Owns** | Projection state (fully rebuildable), coverage registry. Explicit horizon: only *active/open* items — anything requiring interpretation over time belongs to Memory. |
| **Never owns** | History (event log / Memory); importance judgments (Deliberation); any domain writes — it projects, it never commands. |
| **Public contracts** | `SituationQuery` (typed views: `now()`, `project(id)`, `agents()`, `communications()`, `calendar()`); `CoverageReport` (gaps, staleness). |
| **Publishes** | `situation.changed` (significant deltas only), `coverage.gap.detected`. |
| **Subscribes to** | `observation.*`, `agent.*`, `action.*`, `priority.changed`, `decision.*`, `identity.*`, `sensor.status.changed`. |
| **Dependencies** | Event backbone; reads Identity for display names/relations. |
| **Invariants** | Rebuildable from the event log at any time. Every view element carries freshness and source. **Feigned completeness is a defect** — gaps are represented, not hidden. |
| **Scalability concerns** | Rebuild time grows with log size → periodic snapshots (event-sourcing standard practice). |

### 2.5 Deliberation

| Aspect | Definition |
|---|---|
| **Purpose** | The COO cognition: from awareness to choice. The durable domain layer of ADR-0009. |
| **Responsibilities** | Stewardship of the **directive hierarchy: goals → intentions → plans → tasks** (ADR-0014); intention intake and decomposition (P7); continuous prioritization *against goals*; decision-point protocol (framing genuine trade-offs for the user, P3); recommendation and challenge generation (COO mode) and reflection outputs incl. goal progress and goal drift (Coach mode); arbitration of the four behavioral modes; model-selection *policy* (which class of task gets which class of model). |
| **Owns** | Goals (with version history), intentions, plans, tasks, priority state, decision records (requested → made), suggestions/reflections. |
| **Never owns** | Execution mechanics (Execution); conversation rendering (Interaction); storage of history (Memory). |
| **Public contracts** | `IntentionIntake` (goal in, plan out); `PriorityQuery` (current ranked focus); `DecisionQueue` (open decisions, framed with evidence). |
| **Publishes** | `goal.created/revised/achieved/abandoned`, `plan.created`, `task.ready`, `priority.changed`, `decision.requested`, `decision.made`, `suggestion.created`. |
| **Subscribes to** | `situation.changed`, `task.completed/blocked/failed`, `interaction.user_decision`, `coverage.gap.detected`, `contradiction.detected`. |
| **Dependencies** | Situation (`SituationQuery`), Memory (`Recall` for evidence), Identity (`TrustQuery`), Model Abstraction Layer. |
| **Invariants** | **Goals are user-sovereign: AIOS proposes goal changes, only the user decides them** (ADR-0014). Every intention traces to a goal or is explicitly marked ad-hoc; every task traces to an intention. Goal revisions are versioned events — goal-drift history is Coach-mode material. Every autonomous choice above the gate threshold produces a decision record. Every recommendation cites its evidence (Situation/Memory references) and the goals it serves — no unexplainable advice. Coach-mode output is batched into reflection contexts, never injected inline (ADR-0011). |
| **Scalability concerns** | Continuous LLM-based prioritization is too expensive — hybrid: cheap heuristics for ranking stability, inference only on significant `situation.changed` deltas. |

### 2.6 Execution

| Aspect | Definition |
|---|---|
| **Purpose** | Make things happen — safely. Worker agents and external actions under one gate. |
| **Responsibilities** | Worker agent lifecycle (start/pause/resume/monitor/cancel) via `ExecutionAdapter`s (ADR-0009: Claude Code via Agent SDK/CLI, API workers via MAL); the **ActionGate**: classify every external action by reversibility (ADR-0012), combine with trust (Identity) → autonomous / report / require approval; budget and cost enforcement; progress/ETA tracking; issuing approval tokens consumed by Perception's `ActionPort`s. |
| **Owns** | Agent session records, gate policy state, budgets, adapter registry. |
| **Never owns** | What should be done or when (Deliberation); connector APIs (Perception); model access mechanics (MAL). |
| **Public contracts** | `TaskExecution` (accept task → lifecycle handle); `ActionGate` (action intent → verdict + token); `RuntimeStatus` (sessions, budgets). |
| **Publishes** | `agent.started/progress/blocked/completed/failed`, `action.approved/executed/rejected`, `budget.threshold_reached`. |
| **Subscribes to** | `task.ready`, `decision.made` (user approvals), adapter callbacks. |
| **Dependencies** | Deliberation (tasks), Identity (trust), Perception (action execution), MAL, event backbone. |
| **Invariants** | **No external action bypasses the ActionGate.** Irreversible actions require explicit approval until an ADR relaxes a specific action class (ADR-0012). Every lifecycle transition is evented — Situation sees everything. No engine concept leaks above the adapter contract (ADR-0009). |
| **Scalability concerns** | Dozens of concurrent agents → adapter-level isolation and resource pools; runaway agent cost → hard budgets per task, enforced here. |

### 2.7 Interaction

| Aspect | Definition |
|---|---|
| **Purpose** | The membrane between AIOS and the user: **one persona (the Brain), many surfaces**. |
| **Responsibilities** | Dialogue management (voice/text) — the Brain Agent's conversational face; briefing composition; notification delivery under the **attention policy** (progressive disclosure: interrupt only for decision-relevance, batch the rest); dashboard/mobile projections (rendering only); user-input capture (voice notes → observation events); transparency-on-demand (drill-down into anything, including the Personal Model). |
| **Owns** | Conversation state, surface read models, attention policy execution state. |
| **Never owns** | World state (reads Situation), history (reads Memory), priorities and decisions (reads Deliberation). **Any output that commits AIOS — a decision, promise, or task — must originate in Deliberation.** |
| **Public contracts** | `Converse` (channel-agnostic dialogue); `Notify` (attention-policy-gated delivery); `SurfaceProjection` (dashboard/mobile feeds). |
| **Publishes** | `interaction.user_input` (treated as observations), `interaction.user_decision`, `interaction.feedback`. |
| **Subscribes to** | `decision.requested`, `suggestion.created`, `situation.changed` (live surfaces), briefing triggers. |
| **Dependencies** | Situation, Deliberation, Memory, Identity (interaction preferences), MAL (rendering/summarization only). |
| **Invariants** | No surface maintains its own world state (ADR-0011). Every interruption passes the attention policy. Everything shown is traceable to its source (full transparency on demand). |
| **Scalability concerns** | New surfaces must cost only a new projection; voice latency budget will constrain how much is computed at request time vs pre-materialized. |

## 3. Demoted Candidates

| Candidate | Verdict | Where it went |
|---|---|---|
| Personal Model | Not a context | Aggregate: self profile (Identity) + learned patterns (Memory); composed via `Recall`; user-inspectable via Interaction (ADR-0011) |
| Agent Runtime | Not separate | Inside Execution |
| Communication | Ambiguous, split | User-facing → Interaction; external channels → Perception |
| Dashboard | Not a context | Projection in Interaction (ADR-0011) |
| Notifications | Not a context | Delivery channel + attention policy in Interaction |
| Integrations | Renamed | = Perception (sensors + actuators) |
| Security | Not a domain | Cross-cutting: platform secrets/config + Execution's ActionGate + Identity's trust |
| Audit | Not a context | **The event log is the audit** (ADR-0007) + Memory version history |
| Event System | Not a domain | Platform infrastructure (ADR-0007) |
| Planning / Knowledge / Memory / Identity / Situation Model / Execution | Kept (Planning → Deliberation; Knowledge merged into Memory) | §2 |

**Platform layer (infrastructure, not domains):** Event Backbone (ADR-0007) ·
Model Abstraction Layer (A5, ADR-0009) · Storage (ADR-0008) · Secrets/Config ·
Observability.

## 4. Cross-Cutting Concept Placement

| Concept | Home | Notes |
|---|---|---|
| Situational Awareness | Situation (substrate) | The product-level outcome of the whole loop; Situation provides the state, Interaction the views |
| Personal Model | Identity (self) + Memory (patterns) | Named aggregate, not a module; fully user-inspectable |
| Long-term Memory | Memory | — |
| Episodic Memory | Memory | Raw feed = event log (platform); consolidation = Memory |
| Semantic Knowledge | Memory | Merged (§5 A1) |
| Intentions / Plans / Tasks | Deliberation | Tasks handed to Execution as execution orders |
| Decisions | Deliberation (records) | History in Memory; presentation in Interaction |
| Trust | Identity | Consumed by Execution's ActionGate |
| Confidence | Memory | Per-assertion attribute, surfaced through `Recall` |
| Coverage | Situation | Fed by Perception's `SensorHealth` |
| Uncertainty | Memory (belief confidence) + Situation (freshness/coverage) | Two distinct kinds — deliberately not unified |
| Reversibility | Execution (classification + gate) | Classes declared per action in Perception connector specs (ADR-0012) |
| Version History | Platform event log + Memory versioning | Never a separate Audit context |
| Goals / Objectives / Success metrics | Deliberation (directive hierarchy) | User-sovereign; versioned; every priority cites goals (ADR-0014) |
| Values / personal development themes | Personal Model (Identity self + Memory) | Values inform goals; goals drive priorities — deliberate split (ADR-0014) |
| Time | Cross-cutting dimension, platform conventions | One clock, UTC, bitemporality, horizon taxonomy, scheduler-as-event-source (ADR-0015); each context applies its own temporal semantics |

## 5. Proposed ADR Amendments

**A1 — Merge Knowledge System into Memory** (touches GLOSSARY, wording of
ADR-0008). Reason: semantic knowledge *is* a memory type (cognitive science and
practice agree); retrieval is one unified problem — `Recall` must rank across
episodic, semantic, and procedural sources in a single token budget; and
consolidation (episodic → semantic) would otherwise be a permanent
cross-context integration through the system's hottest path. Two contracts over
one dataset would be a boundary without a difference. The merge removes a
boundary; a future internal split (episodic vs semantic scaling differently)
stays possible behind the unchanged `Recall` contract.

**A2 — "Brain Agent" becomes a persona, not a component** (touches GLOSSARY).
The single interlocutor the user experiences is implemented by
**Deliberation (thinking) + Interaction (conversing)**. Keeping it as one
module would fuse the two most complex concerns of the system.

Both amendments are folded into ADR-0013 (domain architecture) rather than
separate ADRs, since ADR-0008 is still `proposed`.

## 5a. Temporal Model (ADR-0015)

Time is a **dimension, not a domain**. A central "time module" would be a
god-abstraction, because temporal semantics differ per context: Memory needs
**bitemporality** (valid time vs transaction time — "X works at Y since 2024,
known since 2026-07"), Situation needs freshness, Deliberation needs horizons
and deadlines, Execution needs timeouts and ETAs. But fully ad-hoc time per
context would fragment reasoning. Resolution — **platform conventions, defined
once, applied everywhere**:

1. **One clock, UTC internally**; event-log timestamps are normative.
2. **Bitemporal pattern** (`valid_from/valid_to` + `recorded_at`) specified
   once, reused by Memory assertions and Identity evolution. This is also the
   defense against semantic drift over years (renamed projects, pivoted
   companies): old assertions stay true *for their validity interval*.
3. **Shared horizon taxonomy** (`now · today · week · quarter · year`) so
   Deliberation horizons, Situation's "now" boundary, and Coach review cycles
   speak the same language.
4. **Time enters the system as events**: a platform Scheduler emits scheduled
   triggers (follow-ups, briefing times, review cadences) onto the event
   backbone. Consequence with ADR-0007: replays are deterministic and the
   entire cognitive loop is testable under a simulated clock.

## 6. Scenario Validation

1. **Morning Briefing** — Perception ingested overnight; Situation holds
   current state; Deliberation supplies ranked priorities + open decisions;
   Memory enriches (who/what context); Interaction composes and delivers.
   *No context is bypassed, none is redundant.*
2. **Parallel agents on multiple projects** — Deliberation emits `task.ready`;
   Execution runs sessions via adapters and events every transition; Situation
   aggregates; Interaction interrupts only on `decision.requested`. The user
   never polls (J3).
3. **Customer meeting with knowledge capture** — Perception captures
   transcript/notes; Identity resolves participants; Memory consolidates
   commitments and facts (versioned, with confidence); Deliberation turns
   commitments into tasks; Situation reflects new open items.
4. **AIOS recommends a better priority** — Deliberation detects mismatch
   (Situation state + Memory evidence), emits `suggestion.created` **with cited
   evidence**; Interaction delivers under the attention policy; the user's
   verdict returns as `interaction.user_decision`; Memory records the pattern —
   the Personal Model learns when the user disagrees.
5. **Context restore after one week away** — Interaction queries Situation
   (what is open *now*) + Memory (consolidated narrative of the week — this is
   why consolidation exists: recall must not mean replaying 10,000 raw events)
   + Deliberation (what matters first). Coverage report shows what AIOS did
   *not* see during absence.
6. **Monitoring dozens of autonomous agents** — Execution enforces budgets and
   emits lifecycle events; Situation maintains the fleet view (progress,
   blocked, waiting); Deliberation decides which blockers escalate;
   Interaction shows the fleet on the dashboard and interrupts for the one
   agent that needs a human.
7. **Dashboard without duplicated business logic** — Interaction renders
   `SituationQuery` + `PriorityQuery` + `RuntimeStatus` results. Zero domain
   logic in the surface; a mobile view is the same queries, differently
   rendered. This scenario is the acceptance test of ADR-0011.

## 7. Critical Self-Review

- **Weakest boundary: Situation vs Memory.** "Now" vs "past" is a fuzzy line
  (is an unanswered mail from last week "now"?). Mitigation: Situation's
  horizon is normative — *open/active items only*; everything requiring
  interpretation over time is Memory. I expect the first boundary amendment of
  this architecture to happen here, and prefer that over merging them: their
  operational natures differ (rebuildable hot projection vs durable versioned
  store).
- **Second weakest: Deliberation vs Interaction.** Dialogue needs thinking;
  Interaction could grow a second brain. The invariant "anything that commits
  AIOS originates in Deliberation" is the guard — it must be enforced in
  review, not hoped for.
- **Hidden coupling: the event schema.** With seven contexts communicating via
  events, the schema *is* the API. Undisciplined schema evolution would couple
  everything invisibly. Rule adopted: versioned event schemas, additive-only
  changes, schema registry as part of the platform.
- **Scalability risks:** Memory consolidation cost (mitigate: batch + cheap
  models); Situation rebuild time (mitigate: snapshots); Execution adapter
  churn (mitigate: contract tests per ADR-0009).
- **Unnecessary complexity check:** Perception+Execution merge rejected
  (sensing is continuous and decision-free; acting is gated — different
  natures). Situation+Memory merge rejected (above). Seven contexts for a
  single-user system is defensible only because they are **modules, not
  services** (ADR-0006) — as deployables this would be over-engineering.
- **Migration risks:** if the Memory merge (A1) proves wrong, splitting later
  is internal — `Recall` stays. If Identity resolution becomes ML-heavy, it
  extracts cleanly along its contract. The expensive mistake would be a wrong
  *event schema*, not a wrong module cut — hence the schema discipline above.
- **Simplification achieved:** 15 candidates → 7 contexts + thin platform;
  Dashboard, Notifications, Audit, Security, Event System, Personal Model,
  Agent Runtime all demoted from domain status.

**Verdict:** no redesign required after review; the review hardened invariants
rather than moving boundaries. The architecture is the smallest set of
contexts in which every cognitive responsibility has exactly one owner.

## 8. The Ten-Year Test

*"Could this architecture still support AIOS after ten years of accumulated
memory, projects, relationships and decisions?"*

**Yes — conditionally.** The properties that make it possible:

1. **Append-only event log + rebuildable projections** (ADR-0007, 0011): state
   never rots; any future need can build a new projection over the full
   history; migration = replay, not surgery.
2. **Contract boundaries with named extraction seams** (ADR-0006, 0008, 0009):
   every scaling pressure identified so far (pgvector recall, flaky
   connectors, ML-heavy resolution, adapter churn) has a designated seam.
3. **Versioned, bitemporal assertions with confidence** (ADR-0012, 0015):
   knowledge may be wrong and corrected without loss; semantic drift over
   years is representable instead of destructive.
4. **Model agnosticism** (A5, ADR-0009): the intelligence is replaceable; the
   accumulated corpus of events, knowledge, decisions, and goals is the asset
   that compounds.

The two conditions — decade risks that are **operational policies, not
structure**, and fail if they remain prose:

- **Retrieval quality decay**: recall precision drops as the corpus grows.
  The forgetting/compaction policy (A8) must be *built* in Phase 3, not
  postulated. Storage is a non-issue at this scale; relevance is the issue.
- **Event schema drift**: replaying ten-year-old events requires a schema
  registry and upcasters from day one. Additive-only evolution is a discipline
  that must be enforced by tooling.

No architecture survives ten years unamended. This one is built to be amended
in an orderly way — via contracts, projections, and superseding ADRs — rather
than to pretend it will never change.
