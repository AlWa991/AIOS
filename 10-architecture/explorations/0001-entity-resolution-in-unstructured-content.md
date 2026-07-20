---
status: exploration
owner: alex
last_updated: 2026-07-20
---

# Exploration: Who resolves identities inside unstructured content?

**This is NOT an ADR.** It maps the design space behind the tension found in
Slice 3 (spec-0003) before any permanent decision is made. Evaluation
criterion, per ADR-0004: **cognitive load reduction — not architectural
purity.**

## The Tension

Perception extracts mentions from *structure* (email From/To/Cc, calendar
ATTENDEE) and Identity resolves them. But the richest situational signal
lives in *free text*: "Petra asked about the IMH proposal" links a thread to
a customer project only if someone recognizes "IMH" and "Petra" in the body.
Recognizing known entities requires the alias lexicon — which is
Identity-internal. Slice 3 respected the boundary and shipped without body
recognition. The question: where should text-level entity recognition live?

Two sub-capabilities hide inside "resolution":

- **Detection** — finding candidate strings in content ("this token might
  refer to someone").
- **Resolution** — mapping a candidate to an entity with confidence.

Everyone agrees Identity owns resolution. The contested part is detection in
unstructured text, because *lexicon-based* detection needs Identity's data.

## Option A — Status quo: structural mentions only

- **Responsibilities:** Perception extracts syntax-visible mentions only;
  body text is never scanned.
- **Ownership:** cleanest — Identity sole resolver, Perception pure capture.
- **Coupling:** none beyond today's event flow.
- **Performance:** best (no scanning).
- **Scalability:** capability gap *grows* with mailbox size — the more real
  data, the more unlinked context.
- **Context impact:** zero.
- **Testability:** best.
- **Maintenance:** trivial.
- **Cognitive load verdict: fails.** J6 (customer context) and J2 (context
  restoration) depend on linking communication to projects and people.
  Header-only linking misses the majority of real-world references. This is
  the case where the cleanest architecture makes AIOS noticeably less
  useful: purity preserved, product promise quietly broken.

## Option B — Perception pulls an alias lexicon from Identity

Identity exposes a read contract (e.g. `Identity.aliasLexicon()` or a
versioned lexicon projection); Perception scans content against it and emits
body mentions.

- **Responsibilities:** Perception = detection (all of it), Identity =
  resolution. Sounds clean, but detection *quality* now depends on data
  Perception doesn't own.
- **Ownership:** split ownership of the recognition pipeline — "why was this
  mention missed?" spans two contexts.
- **Coupling:** first **upstream→downstream contract dependency**: the entry
  point of the cognitive loop imports a downstream context's contract. Until
  now Perception depends only on the platform. Also a bootstrap loop: empty
  lexicon → no body mentions → fewer entities → thin lexicon (self-healing
  over time, but the dependency direction is permanently inverted).
- **Performance:** fine — lexicon is personal-scale (10³ aliases), in-memory
  Aho-Corasick scan is microseconds per message.
- **Scalability:** when detection evolves to NER/LLM, the *lexicon* stops
  being the mechanism — but the Perception→Identity contract remains as
  legacy surface.
- **Context impact:** new public contract on Identity; every future
  perception adapter must wire the lexicon.
- **Testability:** Perception tests now need lexicon fixtures; boundary
  tests must allow the new import edge.
- **Maintenance:** matching semantics (case, word boundaries, umlauts,
  declension "Eddys") live in Perception but are *about* identity — the
  expertise and the code drift apart.
- **Cognitive load verdict: passes for the user, at a structural price**
  paid forever (inverted dependency + split ownership).

## Option C — Identity recognizes entities in content (recommended)

Identity already subscribes to `observation.captured`. It additionally scans
the observation's text against its own aliases and publishes
`entity.resolved` for body mentions — exactly as it does for structural
mentions today.

Refinement (the actual recommendation): **split detection by the kind of
knowledge it needs.**

- *Syntax-defined* mentions stay in Perception: From/To/Cc, calendar
  ATTENDEE, GitHub `@handles`, email addresses. Perception owns *format*
  knowledge — no lexicon needed.
- *Knowledge-defined* recognition moves to Identity: finding known people,
  organizations, projects in free text. Identity owns *identity* knowledge.

- **Responsibilities:** each context detects with the knowledge it
  legitimately owns. Identity's charter per ADR-0010 — "who someone is" —
  naturally includes *recognizing* them.
- **Ownership:** single owner for the entire lexicon-dependent pipeline;
  "why was this missed?" has one home.
- **Coupling:** **zero new edges.** No new contract, no new subscription,
  no dependency inversion. The loop stays unidirectional.
- **Performance:** identical total work to B, relocated. One real cost:
  events must carry fuller text than Slice 3's ~200-char snippet (additive
  field). Event log grows with message bodies — acceptable: single-user
  Postgres, and per ADR-0007 the log is episodic-memory raw material, where
  fuller text is a benefit to Memory anyway, not a tax.
- **Scalability:** the evolution path is the strongest argument. Upgrading
  detection (fuzzy matching for "Eduard Dinges"≈"Eddy", declensions, later
  LLM-assisted NER via MAL) happens *inside Identity only* — no other
  context, contract, or adapter changes. Under B the same upgrades churn
  the shared contract.
- **Context impact:** Identity grows (resolution → recognition). This is
  charter-consistent growth, not scope creep — but it is real: Identity
  becomes the second-largest context after Deliberation.
- **Testability:** single-context tests (text fixture in → resolved
  entities out); no cross-context fixtures; boundary tests unchanged.
- **Maintenance:** one place, one team-of-one, one upgrade path. Residual
  coordination: Perception's normalization (quote-stripping) shapes what
  Identity sees — coordination via data, not via contracts; visible in the
  event log, hence debuggable.
- **Cognitive load verdict: passes** — same user value as B, without the
  permanent structural price.

## Option D — Lexicon-free heuristics in the platform layer

Capitalized-name/NER heuristics as a shared platform utility, no lexicon.

- Puts *domain semantics* into the platform layer (which owns mechanics,
  not meaning) and, worse, produces false positives at personal scale:
  every capitalized German noun becomes a candidate. False mentions become
  false coverage gaps — **noise in the briefing, i.e. cognitive load
  added, the opposite of the product.** Rejected.

## Option E — Dedicated "Understanding/Enrichment" context

A new context between Perception and Identity for content understanding.

- The eighth-context alarm (ADR-0013/0014 precedent): new contract surface,
  registry entries, and reader burden for one capability with one consumer.
  Today it is a boundary drawn around a *function*, not a responsibility.
- **Honest future note:** when LLM-based semantic understanding arrives via
  MAL (extracting commitments, deadlines, sentiment — not just entities),
  this option deserves re-examination: at that point "understanding" may be
  a genuine responsibility with several consumers. That would be a new ADR
  on new evidence — exactly how the frozen foundation is meant to evolve.
  Premature today.

## Comparison Against the Product (ADR-0004)

| | User value (load ↓) | New coupling | Evolution cost | Noise risk |
|---|---|---|---|---|
| A status quo | none gained | none | n/a | none |
| B lexicon pull | high | inverted dependency, forever | contract churn on every detection upgrade | low |
| **C Identity recognizes** | **high** | **none** | **isolated in Identity** | **low** |
| D platform heuristics | negative | platform↔domain | high | **high** |
| E new context | high, delayed | highest | highest today | low |

## Recommendation

**Option C with the syntax/knowledge split.** It is the rare case where the
useful answer and the clean answer coincide — because the boundary was drawn
around *knowledge ownership*, and recognition follows the knowledge.

Where purity loses on purpose: C makes Identity bigger and puts fuller
personal text into the event log. Both are accepted costs, traded for zero
new coupling and an upgrade path (fuzzy → LLM-NER) that never leaves one
context. Where the shortcut would have hurt: B ships the same user value
*now* but inverts a dependency *forever* — a permanent structural mortgage
for zero additional user benefit.

**No decision is made by this document.** If Alex confirms the direction,
the next step is an ADR (candidate: "Identity owns knowledge-based entity
recognition; Perception owns syntax-based mention extraction") plus a small
slice: additive `text` field on observations + Identity-side alias scan +
fuzzy alias matching ("Eduard Dinges" ≈ "Eddy") — which also directly
improves the proposed understanding-coverage metric.
