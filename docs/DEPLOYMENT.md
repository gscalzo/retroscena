# Deployment

Retroscena is one Cloudflare Worker with D1 and Vite-built assets at
`retroscena.effectivecode.co.uk` and `retroscena.gioscalzo.com`. Both hosts
belong to one Access application and share one audience tag. The code is
public; the content is private.

## Cloudflare resources

```bash
npx wrangler d1 create retroscena
```

Put the returned database ID in `wrangler.jsonc`. Create a self-hosted
Access application named `retroscena` on the `plain-glitter-718b` team,
covering both hostnames. Attach the existing reusable **Allow owner**
policy. Copy the application's audience tag to `ACCESS_AUD` in
`wrangler.jsonc`; keep `ACCESS_TEAM_DOMAIN` set to the team name.

Create a service token named for this machine, `retroscena-macbook`.
Store its Client ID and Client Secret immediately in `~/.retroscena/env`
with mode `0600`. Create a **Service Auth** policy named `retroscena-agents`
whose Service Token rule selects that token, and attach it to the application
beside Allow owner. Do not modify the shared owner policy.

The Worker disables `workers.dev` and preview URLs. Configure Access before
publishing the custom domains. Recreating the Access application changes
its audience tag and requires a matching config update.

Cloudflare documents the [D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/)
and [Access service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/).

## GitHub and first deployment

The repository is `gscalzo/retroscena`. Add its `CLOUDFLARE_API_TOKEN` secret
using the owner's existing interactive-shell helper:

```bash
zsh -ic 'cf-secret gscalzo/retroscena'
npm run gate
npm run mutation
npm run build
npm run smoke:cli
npm run db:migrate:remote
npm run deploy
```

The token needs the relevant Workers, D1 and custom-domain permissions.
Access provisioning needs separate Access permissions if the deploy token
does not include them. Never place a token in source control or command
arguments.

CI runs the quality gate, build, CLI smoke test, and a separate mutation job
on every push. The deployment workflow applies migrations and deploys on
pushes to `main`, or when run manually.

## Install the agent client

```bash
npm run install:agent
```

The installer bundles `~/.retroscena/bin/retroscena.mjs`, adds a shell shim,
creates the env template if absent, and links the skill into `~/.agents/skills`
and existing Claude Code and Codex skill directories. Existing credentials
are preserved. Configure:

```dotenv
RETROSCENA_URL=https://retroscena.effectivecode.co.uk
CF_ACCESS_CLIENT_ID=<machine-client-id>
CF_ACCESS_CLIENT_SECRET=<machine-client-secret>
```

Run `~/.retroscena/bin/retroscena ping`; it should identify the caller as an
agent. Add `~/.retroscena/bin` to PATH or use the absolute path. Reinstall
after updating the code. Revoke a machine by revoking its Access token.

## Migrate existing artifacts

Keep originals outside the repository as frozen backups. Use an ignored
`seed/` directory for converted documents:

```bash
mkdir -p seed
retroscena migrate /private/path/bench.html -o seed/bench.json
retroscena create --slug my-talk --title 'My talk' --event 'Conference' --minutes 25
retroscena put my-talk bench seed/bench.json --force
retroscena get my-talk bench -o seed/verified.json
```

Repeat for the reading room and other presentations. Compare the returned
document with the conversion before declaring migration complete: every
note, act, placement, capture, read mark and margin note must survive.
`--force` fetches the latest base revision; it is for a deliberate import,
not a way around another editor's changes. Normal edits use the envelope
returned by `get`.

## Local development

```bash
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
RETROSCENA_URL=http://localhost:5173 ~/.retroscena/bin/retroscena ping
```

Both Access variables are blank locally, so the caller is `local`.
`npm run smoke:cli` starts its own local server using local D1, then checks
create, get, put, history and conflict behavior through the bundled CLI.

## Verify a release

Check both hosts without credentials: Access should require login. Open
both as the owner, then check the CLI with the machine token. Verify the
home list, a bench save, read marks and margin notes. An edit in a second
tab should reload a clean first tab and show a conflict in a dirty one.
Historical document revisions remain reachable through the CLI. Roll back
Worker code with Wrangler versions if necessary; do not delete stored
revisions or reverse a migration that contains owner data.
