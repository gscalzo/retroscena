# 0010 — Migration: a code-only repository; the artifacts converted and pushed through the CLI

**Status:** accepted
**Date:** 2026-09-04

## Context

Three artifacts hold the content: the Confidence Gap workbench (schema 2),
the Junior Crisis reading room, and the older Just One More Prompt
workbench. The reading room holds verbatim captures of other people's
essays; the benches hold private preparation. The repository is public.

## Decision

- The repository carries **code only**. Neither the artifact files nor
  the converted documents are committed; `seed/` is git-ignored.
- `shared/legacy.ts` converts a saved artifact HTML into a bench or a
  room: schema 2 as is, plus `retired: false` and the four categories;
  the older workbench by turning hook / intro / body sections / outro into
  acts, placed notes into their act's run, and everything unplaced into
  backstage, cut notes as retired; the reading room by merging its content
  and state blocks. It is tested on synthetic fixtures only.
- `retroscena migrate <artifact.html> -o <doc.json>` (ADR-0011) runs the
  converter and validates the result; `retroscena create` and `retroscena
put --force` push it. The claude.ai artifacts stay untouched as a
  frozen backup.

## Consequences

Anyone can run the code; only the owner has the content. Re-running the
migration is a matter of three commands.

## Alternatives considered

- **Committing the seed JSON** — publishes third-party essays and private
  notes.
