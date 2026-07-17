---
status: active
owner: alex
last_updated: 2026-07-17
---

# CLAUDE.md — Claude-Specific Entry Point

**Read [`AGENTS.md`](AGENTS.md) first. It is the binding contract for this
repository and takes precedence over anything here.**

This file only adds Claude-Code-specific conventions:

- **Chat language:** converse with Alex in German. All repository content is
  English (see AGENTS.md §5).
- **Git:** commit checkpoints before and after significant changes. Never push
  without explicit confirmation from Alex.
- **Planning:** for multi-document or multi-stage work, follow the current
  build plan in [`DOCUMENTATION_PLAN.md`](DOCUMENTATION_PLAN.md) and do not
  skip stages.
- **Decisions:** when Alex makes a decision in conversation that has lasting
  consequences, persist it as an ADR in the same session — decisions must not
  live only in chat.
- **Subagents:** brief subagents with AGENTS.md rules explicitly; they do not
  inherit this context automatically.
