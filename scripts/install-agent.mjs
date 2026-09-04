#!/usr/bin/env node
/**
 * Install the agent client on this machine (ADR-0011):
 *   1. bundle agent/ into one dependency-free file at ~/.retroscena/bin/retroscena.mjs
 *      (plus a `retroscena` shell shim next to it)
 *   2. write ~/.retroscena/env from the template if it does not exist
 *   3. link the skill into ~/.agents/skills/retroscena, and from there into
 *      ~/.claude/skills and ~/.codex/skills when those directories exist
 *   4. print what only the owner can do: the machine's Access service token.
 *
 * Flags: --home <dir> (default $HOME).
 */
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? null);
};
const HOME = flag('--home') ?? homedir();
const DIR = path.join(HOME, '.retroscena');
const BIN = path.join(DIR, 'bin');
const BUNDLE = path.join(BIN, 'retroscena.mjs');

const ENV_TEMPLATE = `# Retroscena agent client (ADR-0005, ADR-0011). Never commit this file.
# Where the site lives; point it at http://127.0.0.1:5173 for a local Worker.
RETROSCENA_URL=https://retroscena.effectivecode.co.uk
# Cloudflare Access service token for this machine — see docs/DEPLOYMENT.md.
CF_ACCESS_CLIENT_ID=
CF_ACCESS_CLIENT_SECRET=
`;

function step(msg) {
  console.log(`• ${msg}`);
}

function bundle() {
  execFileSync('npm', ['run', '--silent', 'build:agent'], { cwd: ROOT, stdio: 'inherit' });
  mkdirSync(BIN, { recursive: true });
  copyFileSync(path.join(ROOT, 'dist', 'agent', 'retroscena.mjs'), BUNDLE);
  const shim = path.join(BIN, 'retroscena');
  writeFileSync(shim, `#!/bin/sh\nexec node "$(dirname "$0")/retroscena.mjs" "$@"\n`);
  chmodSync(shim, 0o755);
  step(`client bundled to ${BUNDLE} (shim: ${shim})`);
}

function envFile() {
  const file = path.join(DIR, 'env');
  if (existsSync(file)) {
    step(`kept existing ${file}`);
    return;
  }
  writeFileSync(file, ENV_TEMPLATE);
  chmodSync(file, 0o600);
  step(`wrote ${file} — fill in the service token`);
}

function isSymlink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function link(target, linkPath) {
  const parent = path.dirname(linkPath);
  if (!existsSync(parent)) return false;
  if (existsSync(linkPath) || isSymlink(linkPath)) {
    if (isSymlink(linkPath) && readlinkSync(linkPath) === target) return true;
    if (isSymlink(linkPath)) unlinkSync(linkPath);
    else {
      step(`skipped ${linkPath}: something that is not a symlink is already there`);
      return false;
    }
  }
  symlinkSync(target, linkPath);
  return true;
}

function skill() {
  const source = path.join(ROOT, 'skills', 'retroscena');
  const shared = path.join(HOME, '.agents', 'skills', 'retroscena');
  mkdirSync(path.dirname(shared), { recursive: true });
  if (link(source, shared)) step(`skill linked at ${shared}`);
  for (const harness of ['.claude', '.codex']) {
    const linkPath = path.join(HOME, harness, 'skills', 'retroscena');
    if (link(path.join('..', '..', '.agents', 'skills', 'retroscena'), linkPath)) {
      step(`skill linked at ${linkPath}`);
    }
  }
}

bundle();
envFile();
skill();
console.log(`
Done. What only you can do:

1. Put the machine's Access service token in ${path.join(DIR, 'env')}
   (CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET — see docs/DEPLOYMENT.md), then check:
     ${path.join(BIN, 'retroscena')} ping
   It should say you are seen as "agent".

2. Tell your agents the skill exists: a line in ~/.claude/CLAUDE.md or ~/.codex/AGENTS.md
   such as "Talk material lives on Retroscena; use the retroscena skill to read and update it."`);
