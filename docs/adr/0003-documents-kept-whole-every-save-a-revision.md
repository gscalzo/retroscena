# 0003 — Documents kept whole; every save a revision; writes carry their base

**Status:** accepted
**Date:** 2026-09-04

## Context

The bench and the room are each one JSON blob today, and an agent must be
able to read and rewrite them. The reading room with all its captured
bodies is about 200 KB; D1 allows 2 MB per value.

## Decision

- **Storage**: `presentations` holds the metadata; `documents` holds one
  row per `(presentation, kind, rev)` with the author, the time and the
  JSON body. The current document is the highest rev; older rows are the
  history. Nothing is ever deleted (ADR-0006).
- **API** (`worker/routes.ts`): `GET /api/presentations`, `POST`, `GET
/:slug`, `PATCH /:slug`; per document `GET /:slug/:kind`, `GET
…/meta`, `PUT`, `GET …/history`, `GET …/history/:rev`. `PUT` carries
  `{ baseRev, doc }`: the document is validated whole (`shared/schema.ts`,
  including that every note is placed exactly once) and the write is
  refused with **409 and the current revision** when `baseRev` is not the
  current rev. The primary key is the lock for a lost race: the second
  insert of the same rev fails and answers 409 as well.
- **Author**: the Access identity (ADR-0005) becomes the revision's author
  — `owner`, `agent:<token name>`, or `local` in development.
- **Summaries** for the home list (minutes on the run, beats, articles
  read) are computed from the current documents at read time.

## Consequences

An agent adding one note fetches the bench, edits it, and puts it back
with the rev it got: one round trip, free conflict detection. A normalised
schema would have needed a dozen endpoints and a merge story.

## Alternatives considered

- **Normalised tables** — fine-grained writes, at the cost of many
  endpoints, migrations for every field, and merge rules nobody asked for.
- **Last writer wins** — silently loses an agent's or the owner's work.
