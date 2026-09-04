#!/usr/bin/env node
/**
 * End-to-end smoke test of the agent door (ADR-0008): the bundled client
 * drives a local Worker with a local D1 through the whole loop — create,
 * get, edit, put, history, a stale put that must conflict, outline, list.
 *
 * Runs `vite dev` on a spare port for the duration; needs nothing else.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.SMOKE_PORT ?? 8791);
const URL_BASE = `http://127.0.0.1:${PORT}`;
const BUNDLE = path.join(ROOT, 'dist', 'agent', 'retroscena.mjs');
const HOME = mkdtempSync(path.join(tmpdir(), 'retroscena-smoke-'));
const SLUG = `smoke-${Date.now().toString(36)}`;
const BENCH_FILE = path.join(HOME, 'bench.json');

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], ...opts });

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exitCode = 1;
}

/** The bundled client against the local server; returns { status, stdout, stderr }. */
function cli(args) {
  return spawnSync('node', [BUNDLE, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, RETROSCENA_HOME: HOME, RETROSCENA_URL: URL_BASE },
  });
}

/** A call that must succeed; its stdout. */
function ok(args) {
  const res = cli(args);
  if (res.status !== 0) fail(`retroscena ${args.join(' ')} exited ${res.status}: ${res.stderr}`);
  return res.stdout;
}

async function waitForServer(deadlineMs) {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(`${URL_BASE}/api/ping`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no server on ${URL_BASE} after ${deadlineMs} ms`);
}

// Without .dev.vars the Access vars from wrangler.jsonc apply and every call is
// a 401 (CI has no .dev.vars; it is git-ignored). Blank them for the run.
const DEV_VARS = path.join(ROOT, '.dev.vars');
const ownsDevVars = !existsSync(DEV_VARS);
if (ownsDevVars) copyFileSync(path.join(ROOT, '.dev.vars.example'), DEV_VARS);

console.log('• bundling the client');
run('npm', ['run', '--silent', 'build:agent']);
console.log('• applying migrations to the local D1');
run('npx', ['wrangler', 'd1', 'migrations', 'apply', 'retroscena', '--local'], { stdio: 'ignore' });
console.log(`• starting vite dev on ${PORT}`);
const server = spawn(
  'npx',
  ['vite', 'dev', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
  { cwd: ROOT, stdio: 'ignore', detached: true },
);

try {
  await waitForServer(60_000);

  const pong = ok(['ping']);
  if (!pong.includes('seen as "local"')) fail(`unexpected ping output: ${pong}`);

  const created = ok([
    'create',
    '--title',
    'Smoke Talk',
    '--event',
    'Smoke Con',
    '--date',
    '2026-12-01',
    '--minutes',
    '20',
    '--slug',
    SLUG,
  ]);
  if (!created.includes(`created ${SLUG}`)) fail(`unexpected create output: ${created}`);

  ok(['get', SLUG, 'bench', '-o', BENCH_FILE]);
  const envelope = JSON.parse(readFileSync(BENCH_FILE, 'utf8'));
  if (envelope.rev !== 1) fail(`fresh bench is rev ${envelope.rev}, expected 1`);
  if (envelope.doc?.target !== 20) fail(`fresh bench target is ${envelope.doc?.target}`);

  const id = `c${Date.now()}`;
  envelope.doc.notes.push({
    id,
    type: 'story',
    text: 'A note the smoke test added',
    more: '',
    star: false,
    x3: false,
    retired: false,
  });
  envelope.doc.backstage.push(id);
  writeFileSync(BENCH_FILE, JSON.stringify(envelope));

  const saved = ok(['put', SLUG, 'bench', BENCH_FILE]);
  if (!saved.includes('as rev 2')) fail(`unexpected put output: ${saved}`);

  const history = JSON.parse(ok(['history', SLUG, 'bench', '--json']));
  if (history.history?.length !== 2) fail(`expected 2 revisions, found ${history.history?.length}`);
  if (history.history?.[0]?.rev !== 2) fail('history is not newest first');

  const stale = cli(['put', SLUG, 'bench', BENCH_FILE]);
  if (stale.status !== 1) fail(`a stale put exited ${stale.status}, expected 1`);
  if (!stale.stderr.includes('is at rev 2'))
    fail(`stale put did not explain the conflict: ${stale.stderr}`);

  const forced = ok(['put', SLUG, 'bench', BENCH_FILE, '--force']);
  if (!forced.includes('as rev 3')) fail(`unexpected forced put output: ${forced}`);

  const current = JSON.parse(ok(['get', SLUG, 'bench']));
  if (!current.doc?.notes?.some((n) => n.id === id)) fail('the added note did not come back');

  const outline = ok(['outline', SLUG]);
  if (!outline.includes('# Smoke Talk')) fail(`outline lacks the title: ${outline.slice(0, 80)}`);
  if (!outline.includes('A note the smoke test added')) fail('outline lacks the added note');

  const list = JSON.parse(ok(['list', '--json']));
  const mine = list.presentations?.find((p) => p.slug === SLUG);
  if (!mine) fail('list --json does not carry the presentation');
  else if (mine.bench?.rev !== 3) fail(`list shows bench rev ${mine.bench?.rev}, expected 3`);

  ok(['archive', SLUG]);
  const archived = JSON.parse(ok(['list', '--json'])).presentations?.find((p) => p.slug === SLUG);
  if (!archived?.archivedAt) fail('archive did not stick');
} catch (err) {
  fail(String(err));
} finally {
  process.kill(-server.pid, 'SIGTERM');
  rmSync(HOME, { recursive: true, force: true });
  if (ownsDevVars) rmSync(DEV_VARS, { force: true });
}

console.log(process.exitCode ? 'smoke: FAILED' : '✓ smoke: the agent door works end to end');
