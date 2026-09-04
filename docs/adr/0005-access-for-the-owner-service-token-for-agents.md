# 0005 — Cloudflare Access for the owner, one service token per machine for agents

**Status:** accepted
**Date:** 2026-09-04

## Context

Only the owner may open Retroscena, and their coding agents must be able
to read and write from any repository. Bottega's ADR-0009 solved exactly
this on the `plain-glitter-718b` team with a reusable "Allow owner" policy
and a Service Auth policy for machine tokens, re-verifying the Access JWT
in the Worker.

## Decision

- **Browser**: an Access application `retroscena` covering both hostnames
  (ADR-0009), with the account's reusable _Allow owner_ policy (the
  owner's email). The Worker verifies `Cf-Access-Jwt-Assertion` on every
  API call — RS256 against the team's published keys, audience
  `ACCESS_AUD`, issuer the team, expiry — and reads the identity from the
  claims: an `email` is the owner, a `common_name` is a service token.
- **Agents**: one service token **per machine**, named for it
  (`retroscena-macbook`), on a Service Auth policy, stored in
  `~/.retroscena/env` as `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`.
- Unlike Bottega there are no owner-only or agent-only routes: both read
  and write everything, and each revision records which one wrote it
  (ADR-0003).
- **No bypass**: `workers_dev` and preview URLs are off; there is no API
  key path. When both Access vars are blank (local dev) every caller is
  `local` and everything is open.

## Consequences

One auth path, shared with the siblings. Revoking a laptop is revoking one
token. Adding a person means editing the reusable policy, which also
opens raffaello, intonato and Bottega.

## Alternatives considered

- **An application-minted API key** — a second, home-made auth path the
  siblings rejected.
- **The owner's own token for agents** — no way to revoke one machine.
