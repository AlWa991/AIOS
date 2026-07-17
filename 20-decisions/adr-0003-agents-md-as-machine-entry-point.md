# ADR-0003: AGENTS.md as machine entry point

- **Status:** accepted
- **Date:** 2026-07-17
- **Deciders:** alex
- **Related:** [ADR-0002](adr-0002-english-as-handbook-language.md), [AGENTS.md](../AGENTS.md), [CLAUDE.md](../CLAUDE.md)

## Context

AIOS is explicitly model-agnostic: Claude, GPT, Gemini, and future models must
all be able to work in this repository under the same rules. Vendor-specific
instruction files (e.g., `CLAUDE.md`) are read automatically by their
respective tools, but placing the binding contract in a vendor file would
couple the repository to one vendor.

## Options Considered

### Option A — CLAUDE.md as the single instruction file
Automatically loaded by Claude Code. Cons: invisible to other vendors' tooling;
contradicts the Model Agnostic principle at the documentation layer.

### Option B — AGENTS.md as primary contract, thin vendor files pointing to it
`AGENTS.md` is an emerging cross-vendor convention. Vendor files (CLAUDE.md,
and later others) stay thin and only add vendor-specific conventions.
Cons: two files instead of one; vendor files must not drift.

## Decision

**`AGENTS.md` is the single binding contract for all AI systems. Vendor-specific
files are thin pointers that must not duplicate or contradict it.** Rule: if
content applies to more than one vendor, it belongs in AGENTS.md.

## Consequences

- **Positive:** one contract for all models; adding a new vendor costs one thin file.
- **Negative / accepted cost:** vendor files require discipline to stay thin.
- **Follow-ups:** keep [CLAUDE.md](../CLAUDE.md) limited to Claude-specific
  conventions; review vendor files whenever AGENTS.md changes.
