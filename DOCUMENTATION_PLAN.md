# AIOS — Documentation Plan & Information Architecture

> Status: PROPOSED · 2026-07-17
> This file is the master plan for building the AIOS handbook. It defines the
> target structure, the purpose of every document, and the build order.
> No document content is written until this plan is approved.

---

## 1. Current State Analysis

| File | Assessment |
|------|------------|
| `README.md` | Vision text, duplicates `Vision.md`. No navigation, no status, no entry point function. |
| `Vision.md` | Good north-star material, but mixes mission, principles, and system properties. |
| `ROADMAP.md` | Phase list without acceptance criteria, dependencies, or status tracking. |

**Gaps:**
- No machine-readable entry point for AI systems (the primary consumers).
- No architecture documentation at all (the repo's stated purpose).
- No decision log — future AI sessions cannot know *why* anything is the way it is.
- No terminology contract — "Brain Agent", "Agent Runtime", "Memory System" are undefined.
- No scope/non-goals — the vision is unbounded, which makes every future decision ambiguous.
- Redundancy: README ≈ Vision.

**Language decision:** All handbook documents in **English** (per global policy:
architecture docs = English; maximizes cross-model comprehension). User-facing
summaries can be generated in German on demand.

---

## 2. Target Structure

```
AIOS/
├── README.md                      # Navigation hub + status (short, links only)
├── AGENTS.md                      # Machine entry point: how AI systems must read/use this repo
├── CLAUDE.md                      # Thin pointer to AGENTS.md + Claude-specific rules
├── GLOSSARY.md                    # Canonical terminology contract
│
├── 00-product/                    # PRODUCT HANDBOOK — what & why
│   ├── vision.md                  # North star (refined from Vision.md)
│   ├── principles.md              # Non-negotiable design principles
│   ├── user-and-jobs.md           # The user, jobs-to-be-done, key scenarios
│   ├── scope.md                   # In scope · out of scope · explicit non-goals
│   └── roadmap.md                 # Phases with acceptance criteria & status
│
├── 10-architecture/               # ARCHITECTURE HANDBOOK — how (arc42-inspired)
│   ├── overview.md                # System context, C4 L1–L2, component map
│   ├── brain-agent.md             # Orchestrator: dialogue, planning, delegation
│   ├── memory-system.md           # Working/episodic/semantic/procedural, retrieval
│   ├── agent-runtime.md           # Lifecycle, scheduling, monitoring, limits
│   ├── model-abstraction.md       # Model-agnostic layer, routing, fallbacks
│   ├── integrations.md            # External systems, auth, sync strategy
│   ├── security-and-privacy.md    # Data classes, secrets, permissions, blast radius
│   └── tech-stack.md              # Chosen technologies + rationale links to ADRs
│
├── 20-decisions/                  # DECISION LOG (ADRs)
│   ├── README.md                  # Index + ADR process
│   └── adr-NNNN-*.md              # One decision per file, immutable
│
├── 30-specs/                      # COMPONENT SPECS — precise, testable
│   └── (schemas, APIs, protocols — created per component as it's built)
│
├── 40-operations/                 # RUNBOOK — deploy, observe, recover (later)
│
└── 50-meta/
    ├── documentation-guide.md     # Writing conventions, doc lifecycle, review rules
    └── templates/                 # ADR, spec, component-doc templates
```

**Structural rationale:**
- **Numbered prefixes** → deterministic reading order for AI systems.
- **Product / Architecture / Decisions / Specs separation** → vision changes slowly,
  architecture changes sometimes, decisions are append-only, specs change often.
  Different change velocity = different directory.
- **AGENTS.md as machine contract** → open standard, works for Claude, GPT, Gemini.
- **ADRs from day one** → the repo's core value is *preserved reasoning*, exactly
  what future AI sessions need and can't reconstruct.

---

## 3. Document Register

Priority: **P0** = required before anything else · **P1** = required before Phase-2 work · **P2** = as components are built.

| Document | Purpose | Content | Depends on | Prio |
|---|---|---|---|---|
| `README.md` | Human entry point & status board | 10 lines pitch, structure map, current phase, links | all (links) | P0 |
| `AGENTS.md` | Machine entry point | Reading order, terminology pointer, editing rules, source-of-truth hierarchy | GLOSSARY | P0 |
| `CLAUDE.md` | Claude-specific rules | Pointer to AGENTS.md + Claude Code specifics | AGENTS.md | P0 |
| `GLOSSARY.md` | Terminology contract | Canonical definition per core term (Brain Agent, Runtime, Memory types, …) | — | P0 |
| `50-meta/documentation-guide.md` | Doc quality rules | Conventions, status headers, lifecycle, templates usage | — | P0 |
| `00-product/vision.md` | North star | Mission, target state, what success looks like | — | P0 |
| `00-product/scope.md` | Boundary contract | In/out of scope, non-goals, MVP definition | vision | P0 |
| `00-product/principles.md` | Decision guardrails | 5–10 principles (e.g., model-agnostic, one interlocutor, docs-first) | vision | P1 |
| `00-product/user-and-jobs.md` | Grounding in reality | User profile, jobs-to-be-done, 5–8 concrete scenarios | vision | P1 |
| `00-product/roadmap.md` | Execution sequence | Phases with entry/exit criteria, dependencies, status | scope | P1 |
| `10-architecture/overview.md` | Architectural frame | Context diagram, component map, data flows | scope, principles | P1 |
| `10-architecture/brain-agent.md` | Core component design | Responsibilities, interfaces, dialogue/planning model | overview, GLOSSARY | P1 |
| `10-architecture/memory-system.md` | Memory design | Memory types, storage, retrieval, token economy | overview | P1 |
| `10-architecture/agent-runtime.md` | Runtime design | Lifecycle states, scheduling, limits, observability | overview | P1 |
| `10-architecture/model-abstraction.md` | Model independence | Provider interface, routing policy, fallback | overview, principles | P1 |
| `10-architecture/integrations.md` | External world | Per-integration: purpose, auth, data, sync | overview, scope | P2 |
| `10-architecture/security-and-privacy.md` | Trust boundaries | Data classification, secrets, permission model | overview | P1 |
| `10-architecture/tech-stack.md` | Technology choices | Stack table, each row linked to an ADR | ADRs | P2 |
| `20-decisions/README.md` | ADR process | Index, template, status rules (proposed/accepted/superseded) | doc-guide | P0 |
| `20-decisions/adr-*.md` | Preserved reasoning | Context, options, decision, consequences | varies | P2 (ongoing) |
| `30-specs/*` | Buildable precision | Schemas, API contracts, protocols per component | architecture docs | P2 |
| `40-operations/*` | Run the system | Deploy, monitoring, recovery | tech-stack | P2 (post-code) |

---

## 4. Build Plan (Stages)

### Stage 0 — Skeleton & Meta (½ day)
Create directory tree, templates, `documentation-guide.md`, `GLOSSARY.md` (initial terms),
`AGENTS.md`, `CLAUDE.md`, rewrite `README.md` as hub, `20-decisions/README.md`.
Migrate: `Vision.md` → `00-product/vision.md`, `ROADMAP.md` → `00-product/roadmap.md` (raw move, refine later).
**Exit criterion:** an AI system cold-starting on this repo knows exactly what to read in which order.

### Stage 1 — Product Handbook (1 day)
Refine `vision.md`, write `scope.md`, `principles.md`, `user-and-jobs.md`, restructure `roadmap.md`
with entry/exit criteria per phase.
**Exit criterion:** every future feature idea can be tested against scope + principles.

### Stage 2 — Architecture Core (1–2 days)
`overview.md`, then `brain-agent.md`, `memory-system.md`, `agent-runtime.md`,
`model-abstraction.md`, `security-and-privacy.md`. First ADRs fall out of this work
(e.g., ADR-0001 repo-as-source-of-truth, ADR-0002 model-abstraction approach).
**Exit criterion:** Phase-2 implementation (Brain Agent) could be planned from docs alone.

### Stage 3 — Specs & Decisions (ongoing)
Per component, immediately before building it: spec in `30-specs/`, decisions as ADRs.
**Rule:** no component is built without spec + linked ADRs.

### Stage 4 — Operations (post-code)
`40-operations/` once the first deployable component exists.

---

## 5. Open Decisions (need Alex's call)

1. **English confirmed** for all handbook docs? (Recommended; German summaries on demand.)
2. Keep repo **docs-only** until Stage 2 is done, or allow code earlier?
3. `AGENTS.md` + thin `CLAUDE.md` (recommended, multi-model) vs. `CLAUDE.md` only?
