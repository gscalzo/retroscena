# 0011 — The agent door: a CLI installed to ~/.retroscena and a skill; MCP deferred

**Status:** accepted
**Date:** 2026-09-04

## Context

The content must be readable and editable by a coding agent from any
repository — the book, the talks folder — in Claude Code and Codex alike.
Bottega's client (its ADR-0010) is a dependency-free bundle installed to
the home directory plus a skill that tells an agent the verbs.

## Decision

- `agent/` is bundled by `npm run install:agent` to
  `~/.retroscena/bin/retroscena.mjs` with a shell shim, reads
  `~/.retroscena/env` (`RETROSCENA_URL`, the Access service token, ADR-0005),
  and offers: `list`, `create`, `get <slug> bench|room`, `put <slug>
bench|room <file>` (with the base rev from the envelope, `--rev`, or
  `--force`), `history`, `outline`, `archive` / `unarchive`, `migrate`
  (ADR-0010), `ping`, `whoami`.
- `skills/retroscena/SKILL.md`, linked into `~/.agents/skills`,
  `~/.claude/skills` and `~/.codex/skills`, tells an agent the document
  shapes, the get → edit → put loop, what to do on a conflict, and the
  rules: place every note exactly once, unique ids, retire rather than
  delete, keep the detail markup.
- **MCP is deferred** until the owner feels the need: a second transport
  to secure and test, and Codex sessions would still want the CLI.

## Consequences

The same door works from every harness and every repository; the Worker
sees an agent as its machine's token.

## Alternatives considered

- **An MCP server only** — nicer inside Claude Code, useless from a shell.
- **Both from day one** — more surface than the need justifies.
