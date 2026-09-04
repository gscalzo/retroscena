# AGENTS.md — Retroscena

A private bench and reading room for each of the owner's presentations.
Read `docs/adr/README.md` and the relevant records before non-trivial work.
The artifacts' feature set and visual language are the product specification.

## The ADR rule

Every architecturally significant decision — dependency, schema, hosting,
auth, state, delivery, or quality threshold — needs a record in `docs/adr/`
using `template.md`, in the same commit as its implementation. Update the
index. Contradicting an accepted record needs a superseding record and the
old record marked accordingly; never change an accepted decision silently.

## Quality gates

- Before committing, run `npm run gate`, `npm run mutation`,
  `npm run build`, and `npm run smoke:cli`.
- Never lower thresholds or narrow a gate's scope without a superseding ADR.
- `src/styles.css` is the sole source of raw colours, fonts, radii, shadows
  and motion. Other UI files use tokens; `npm run design` checks this.
- Production is `main`. Pushes deploy to both Retroscena hostnames behind
  Cloudflare Access; see `docs/DEPLOYMENT.md`.
- Never add an AI co-author trailer to a commit message.

## Invariants

- Code only in Git. Never commit real artifact HTML, captures, notes, seed
  JSON, local credentials, or private content in test fixtures. Use synthetic
  fixtures. `seed/` is ignored.
- Every note is placed exactly once: one act's pool, one act's run, or
  backstage. IDs are unique; note categories belong to that bench. Use the
  pure operations in `shared/bench.ts`.
- Preserve the owner's words and detail markup. Agents retire notes rather
  than delete them. Migration must preserve captures, read marks and notes.
- Documents are saved whole with a base revision. Conflicts return 409;
  every accepted save inserts a revision. Never prune history or delete a
  presentation; archive and unarchive instead.
- Saving is explicit. A clean page follows remote edits; a dirty page asks
  the owner to resolve the conflict. Session storage is a recovery copy.
- One auth path: Cloudflare Access, with the JWT verified again by the
  Worker. Local bypass requires both Access settings to be blank.
- Render captured HTML safely without changing the stored source.

## Key paths

- `shared/` — types, schemas, bench and room operations, templates, outline,
  detail markup and legacy conversion
- `worker/` — Access verification, API routes, D1 and response views;
  `worker/test/` uses the real migrations with a SQLite D1 fake
- `agent/` — CLI verbs, config, API, rendering and I/O
- `src/lib/` — typed HTTP, document lifecycle, polling, stash and drag data
- `src/components/` — reusable UI; `src/screens/` — presentation surfaces
- `skills/retroscena/SKILL.md` — the installed agent-facing workflow
- `scripts/` — metrics, design check, installer and smoke test
- `docs/adr/` — accepted decisions; `migrations/` — database schema
