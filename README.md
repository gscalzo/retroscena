<div align="center">

# Retroscena

### The backstage of every talk.

A private place to prepare a presentation: a bench for the talk, a reading
room for its sources, and a CLI for the agents helping you write it.

[![CI](https://github.com/gscalzo/retroscena/actions/workflows/ci.yml/badge.svg)](https://github.com/gscalzo/retroscena/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Cloudflare](https://img.shields.io/badge/deploys%20to-Cloudflare%20Workers-f38020?logo=cloudflare&logoColor=white)
![CRAP](https://img.shields.io/badge/CRAP%20score-%E2%89%A415%20gated-2472ae)
![Mutation](https://img.shields.io/badge/mutation%20score-100%25%20gated-8a2be2)

</div>

## What it does

- **A bench for each presentation.** Define who is in the room, what they
  should think, feel and do, and how the talk opens. Sort sticky notes into
  acts, move material from the pool to the run, check timing and milestones,
  and export a Markdown outline. Keep sources and caveats in each note's
  long form.
- **A reading room beside it.** Read captured sources, mark articles read,
  and leave margin notes. Groups and progress keep the research manageable.
- **Explicit saves, preserved history.** Each save adds a revision. Another
  editor's changes appear while your tab is clean; unsaved work brings up a
  conflict banner. A tab keeps a recovery copy of its edits.
- **An agent door.** The CLI fetches and updates the same documents with the
  same revision checks. Presentations can be archived and restored.
- **Private content, public code.** Cloudflare Access protects both hostnames;
  agents use a service token per machine. Talk notes and captured articles
  live in D1 and never enter this repository.

The design is recorded in [`docs/adr/`](docs/adr/README.md).

## Getting started

```bash
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Open `http://localhost:5173`. Blank Access variables enable local development.
Production setup is in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## How an agent uses it

```bash
npm run install:agent
~/.retroscena/bin/retroscena ping
~/.retroscena/bin/retroscena list
~/.retroscena/bin/retroscena get my-talk bench -o /tmp/my-talk.json
# Edit the doc inside the envelope, keeping its revision.
~/.retroscena/bin/retroscena put my-talk bench /tmp/my-talk.json
~/.retroscena/bin/retroscena outline my-talk
```

Configure the machine's Access token in `~/.retroscena/env`. The installer
links the [Retroscena skill](skills/retroscena/SKILL.md) for Claude Code,
Codex and other agents. On a conflict, fetch the current document and
reapply the intended edit; do not overwrite someone else's work.

## Layout

```text
shared/      contracts, validation, immutable document rules, legacy migration
worker/      Hono API, D1 revisions, Access JWT verification
agent/       CLI bundled to ~/.retroscena/bin
src/         Vite + React: screens, components, API and document hooks
skills/      the Retroscena agent skill
scripts/     quality gates, client installer, CLI smoke test
migrations/  D1 schema
docs/        architecture records and deployment
```

## Quality

`npm run gate` runs typecheck, lint at zero warnings, formatting, design
checks, coverage thresholds, CRAP ≤ 15, Halstead ≤ 50, zero duplication and
zero dead code. `npm run mutation` requires no surviving mutants;
`npm run build` builds the Worker and site; `npm run smoke:cli` exercises the
bundled CLI against a local Worker and D1, including a stale write refusal.
CI runs these checks on every push. Thresholds are recorded in
[ADR-0008](docs/adr/0008-quality-gates-aligned-with-the-siblings.md).
