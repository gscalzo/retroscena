# 0009 — Deploy to retroscena.effectivecode.co.uk and retroscena.gioscalzo.com from main, behind Access

**Status:** accepted
**Date:** 2026-09-04

## Context

The siblings deploy every push to `main` to a custom subdomain on the same
Cloudflare account, no `workers.dev` hostname, one Access application each
sharing the reusable "Allow owner" policy, through a GitHub Actions
workflow authenticated by the `CLOUDFLARE_API_TOKEN` secret. Bottega
later added a second hostname on gioscalzo.com; the owner wants both here
from the start.

## Decision

- **Hostnames** `retroscena.effectivecode.co.uk` and
  `retroscena.gioscalzo.com`, custom domains in `wrangler.jsonc`, both on
  the one Access application (one AUD); `workers_dev` and `preview_urls`
  false. Both zones live in the same account.
- **Database** D1 `retroscena`, bound as `DB`, migrations applied by CI
  before each deploy.
- **Repository** `gscalzo/retroscena`, public like the siblings, MIT. The
  code holds nothing more sensitive than the team domain and AUD. The
  content — talk preparation, captured essays — lives only in D1
  (ADR-0010).
- **Workflows**: `ci.yml` (gate, build, CLI smoke, and a mutation job) on
  every push; `deploy.yml` on `main` and on demand: gate, build,
  migrations, `wrangler deploy`.

## Consequences

`main` is production. Recreating the Access application changes the AUD
and needs a config change.

## Alternatives considered

- **One hostname first** — the owner asked for both.
- **Private repository** — the siblings are public; the content is not in
  the repository.
