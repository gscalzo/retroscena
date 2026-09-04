# 0012 — Explicit save, a live poll, and a banner when someone else saved first

**Status:** accepted
**Date:** 2026-09-04

## Context

The owner and an agent edit the same documents. The artifacts had an
explicit Save and only knew "a newer version exists, reloading".

## Decision

- **Explicit Save** (button and Cmd/Ctrl+S), not autosave: every save is
  a meaningful revision (ADR-0006).
- Every `PUT` carries the rev the page loaded (ADR-0003). The page polls
  `GET …/meta` every few seconds while visible. When the server rev moved
  and the page is clean, it **reloads silently**, so an agent's edit
  appears while the owner watches. When the page is dirty it shows a
  **banner** naming who saved and when, with two choices: reload and lose
  the local edits, or keep editing and resolve at save time, where the
  409 brings the banner back.
- Unsaved edits are **stashed per tab** in `sessionStorage`, restored
  when the stashed base rev is still current, dropped with a notice
  otherwise. `beforeunload` warns when dirty.

## Consequences

No silent loss in either direction; the cost is a Save the owner already
had the habit of pressing.

## Alternatives considered

- **Autosave, last writer wins** — simpler, and silently loses work when a
  stale tab is open.
- **Operational merge** — two editors of a 100-note board do not need CRDTs.
