# 0006 — Keep everything: revisions never pruned, presentations archived, never deleted

**Status:** accepted
**Date:** 2026-09-04

## Context

Talk preparation is months of small decisions; the owner has lost work to
overwritten artifacts. Storage at this scale is negligible (hundreds of
saves of at most 200 KB against a 10 GB database).

## Decision

Every accepted write inserts a revision and no revision is ever deleted
(ADR-0003). A presentation can be **archived** (`archived_at` set, folded
away on the home list) and unarchived; there is no delete. A note is
**retired**, not deleted, when it leaves the talk for good — the site
allows deleting a note because history keeps it, but the skill tells an
agent to retire the owner's notes rather than remove them.

## Consequences

Undo is a `GET …/history/:rev` away. The history route is capped at the
newest 100 entries per document; older ones stay reachable by rev.

## Alternatives considered

- **Autosave with a rolling window** — many near-identical rows and no
  meaningful revisions; see ADR-0012.
