# 0004 — One Hono Worker, D1, Vite-built assets, a polling site

**Status:** accepted
**Date:** 2026-09-04

## Context

Bottega (ADR-0008 there) runs as one Cloudflare Worker: Hono under
`/api/*`, D1 for data, the Vite + React build served as static assets,
`run_worker_first` for the API. Raffaello uses Next.js via OpenNext. The
site is private and behind Access, so server rendering buys nothing.

## Decision

Bottega's shape, unchanged: `worker/` (Hono, D1, Access verification),
`src/` (Vite + React 19 + react-router), `shared/` (contracts and pure
rules used by both, and by the CLI), `agent/` (the CLI, ADR-0011). The
site polls a document's `meta` while visible (ADR-0012); there is no push.

## Consequences

Bottega's gate scripts, design-check, test harness (an in-memory SQLite
D1 fake over the real migrations, RS256 test tokens) and workflows port
almost unchanged.

## Alternatives considered

- **Next.js via OpenNext (raffaello)** — a build layer for public SEO
  pages this site does not have.
