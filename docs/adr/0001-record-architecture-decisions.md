# 0001 — Record architecture decisions

**Status:** accepted
**Date:** 2026-09-04

## Context

Retroscena is the third sibling after raffaello and Bottega, both of which
keep their design as a numbered set of records. The owner asked for the same
rigour here, and for the quality gates to be defined by those siblings.

## Decision

Every architecturally significant decision — a new dependency, a schema
change, a hosting or auth change, a rule about state or delivery, a
quality-gate threshold — gets a record in this directory, from `template.md`,
in the same commit that implements it. Records are never edited silently:
contradicting one needs a superseding record, and the old one is marked
`superseded-by-NNNN`.

## Consequences

The design is readable in an afternoon, and an agent asked to change it
knows where the boundaries are. Writing the record is part of the change.

## Alternatives considered

- **A design document** — one file rots; records accumulate honestly.
