# 0002 — A bench and a reading room per presentation

**Status:** accepted
**Date:** 2026-09-04

## Context

The owner prepares talks in two single-file claude.ai artifacts per talk: a
**workbench** (who is in the room, why the talk exists, the hook, the
material sorted into acts and timed) and a **reading room** (the sources,
captured whole, with read marks and margin notes). Two generations of the
workbench existed with different shapes; the newer one (schema 2, the
Confidence Gap) is the one the owner works in.

## Decision

- A **presentation** is the unit: a slug, a title, an event, a date and a
  slot in minutes. It owns exactly two documents, a **bench** and a
  **room**, created with it from a template.
- The **bench** is schema 2 of the workbench, with two additions lifted
  from the older generation: a `retired` flag on a note (the workbench
  wrote "RETIRED" into the text) and **categories defined per bench**,
  each mapped to one of seven fixed sticky-note swatches, so a talk can
  have "machine" or "person" notes without every talk having them. The
  milestones the workbench hardcoded in its script are data on the bench.
  Every note is placed exactly once: in one act's pool, one act's run, or
  backstage. The shape is `shared/types.ts`; the rules that move things
  are `shared/bench.ts`, pure and immutable.
- The **room** merges the artifact's content block and state block: a
  group list and an article list, each article carrying its capture, its
  read mark and its margin notes. Rules in `shared/room.ts`.
- The site keeps the artifacts' features, nothing more: WHO, WHY with
  Think/Feel/Do, the five hooks, acts with a pool and a run, the timeline,
  milestones, drag and drop, the long-form detail on every note, the
  Markdown outline export; read ticks, margin notes and progress in the
  room.
- Deliberately out: duplicating a presentation, a status field, richer
  metadata, a source library shared across presentations. Cheap later.

## Consequences

One shape to validate (`shared/schema.ts`), one to migrate to, one for an
agent to learn. A category's colour is a swatch name, never a hex, so the
design gate (ADR-0007) holds on data too.

## Alternatives considered

- **Keep both workbench generations** — two editors for one job.
- **Normalise notes, acts and articles into tables** — see ADR-0003.
