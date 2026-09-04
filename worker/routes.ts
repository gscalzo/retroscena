/**
 * The API (ADR-0003): presentations and their two documents. Every write
 * carries the revision it started from and is refused when that revision
 * is no longer the current one; every accepted write is a new revision.
 */
import type { Context, Hono } from 'hono';
import { slugify } from '../shared/format';
import { isDocKind, parseCreate, parseDoc, parseUpdate } from '../shared/schema';
import { newBench, newRoom } from '../shared/template';
import type { DocKind, PresentationSummary, UpdateReq } from '../shared/types';
import { authorOf } from './access';
import type { AppContext, Clock } from './app';
import { readBody } from './body';
import type { PresentationPatch, PresentationRow } from './db';
import {
  getDocument,
  getPresentation,
  insertDocument,
  insertPresentation,
  latestDocument,
  latestMeta,
  listHistory,
  listPresentations,
  updatePresentation,
} from './db';
import { envelopeView, historyView, metaView, summaryView } from './views';

type Ctx = Context<AppContext>;
type SlugCtx = Context<AppContext, '/presentations/:slug'>;
type DocCtx = Context<AppContext, '/presentations/:slug/:kind'>;

const HISTORY_LIMIT = 100;

async function summarise(db: D1Database, row: PresentationRow): Promise<PresentationSummary> {
  const [bench, room] = await Promise.all([
    latestDocument(db, row.slug, 'bench'),
    latestDocument(db, row.slug, 'room'),
  ]);
  // Both are written with the presentation in one transaction (insertPresentation).
  return summaryView(row, bench!, room!);
}

async function list(c: Ctx) {
  const rows = await listPresentations(c.env.DB);
  const presentations = await Promise.all(rows.map((row) => summarise(c.env.DB, row)));
  return c.json({ presentations });
}

async function create(c: Ctx, now: Clock) {
  const parsed = parseCreate(await readBody(c));
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const req = parsed.value;
  const slug = req.slug ?? slugify(req.title);
  if (slug === '') return c.json({ error: 'the title yields no slug; pass one' }, 400);
  const db = c.env.DB;
  if (await getPresentation(db, slug)) return c.json({ error: `slug "${slug}" is taken` }, 409);
  const at = now();
  const row: PresentationRow = {
    slug,
    title: req.title,
    event: req.event,
    date: req.date,
    target: req.target,
    created_at: at,
    archived_at: null,
  };
  const author = authorOf(c.get('identity'));
  await insertPresentation(db, row, [
    { kind: 'bench', author, body: JSON.stringify(newBench(req.target)) },
    { kind: 'room', author, body: JSON.stringify(newRoom()) },
  ]);
  return c.json({ presentation: await summarise(db, row) }, 201);
}

async function show(c: SlugCtx) {
  const row = await getPresentation(c.env.DB, c.req.param('slug'));
  if (!row) return c.json({ error: 'presentation not found' }, 404);
  return c.json({ presentation: await summarise(c.env.DB, row) });
}

function toPatch(req: UpdateReq, now: number): PresentationPatch {
  const patch: PresentationPatch = {};
  if (req.title !== undefined) patch.title = req.title;
  if (req.event !== undefined) patch.event = req.event;
  if (req.date !== undefined) patch.date = req.date;
  if (req.target !== undefined) patch.target = req.target;
  if (req.archived !== undefined) patch.archived_at = req.archived ? now : null;
  return patch;
}

async function update(c: SlugCtx, now: Clock) {
  const parsed = parseUpdate(await readBody(c));
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const slug = c.req.param('slug');
  const db = c.env.DB;
  const changed = await updatePresentation(db, slug, toPatch(parsed.value, now()));
  if (!changed) return c.json({ error: 'presentation not found' }, 404);
  const row = await getPresentation(db, slug);
  return c.json({ presentation: await summarise(db, row!) });
}

/** The slug and kind of a document route, or the 404 to answer with. */
function docParams(c: DocCtx): { slug: string; kind: DocKind } | null {
  const kind = c.req.param('kind');
  return isDocKind(kind) ? { slug: c.req.param('slug'), kind } : null;
}

const notFound = (c: Ctx) => c.json({ error: 'document not found' }, 404);

async function current(c: DocCtx) {
  const p = docParams(c);
  const row = p && (await latestDocument(c.env.DB, p.slug, p.kind));
  return row ? c.json(envelopeView(row)) : notFound(c);
}

async function meta(c: DocCtx) {
  const p = docParams(c);
  const row = p && (await latestMeta(c.env.DB, p.slug, p.kind));
  return row ? c.json(metaView(row)) : notFound(c);
}

async function history(c: DocCtx) {
  const p = docParams(c);
  if (!p || !(await latestMeta(c.env.DB, p.slug, p.kind))) return notFound(c);
  const rows = await listHistory(c.env.DB, p.slug, p.kind, HISTORY_LIMIT);
  return c.json({ history: rows.map(historyView) });
}

async function revision(c: Context<AppContext, '/presentations/:slug/:kind/history/:rev'>) {
  const p = docParams(c);
  const rev = Number(c.req.param('rev'));
  const row = p && Number.isInteger(rev) && (await getDocument(c.env.DB, p.slug, p.kind, rev));
  return row ? c.json(envelopeView(row)) : notFound(c);
}

async function put(c: DocCtx, now: Clock) {
  const p = docParams(c);
  if (!p) return notFound(c);
  const body = await readBody(c);
  if (!body || !Number.isInteger(body.baseRev)) {
    return c.json({ error: 'baseRev must be an integer' }, 400);
  }
  const baseRev = body.baseRev;
  const parsed = parseDoc(p.kind, body.doc);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const db = c.env.DB;
  const head = await latestMeta(db, p.slug, p.kind);
  if (!head) return notFound(c);
  const conflict = (row: typeof head) =>
    c.json({ error: `revision ${row.rev} is current`, current: metaView(row) }, 409);
  if (head.rev !== baseRev) return conflict(head);
  const row = {
    presentation: p.slug,
    kind: p.kind,
    rev: head.rev + 1,
    author: authorOf(c.get('identity')),
    at: now(),
    body: JSON.stringify(parsed.value),
  };
  if (!(await insertDocument(db, row))) {
    const fresh = await latestMeta(db, p.slug, p.kind);
    return conflict(fresh!);
  }
  return c.json({ rev: row.rev, at: row.at });
}

export function registerRoutes(app: Hono<AppContext>, now: Clock): void {
  app.get('/presentations', (c) => list(c));
  app.post('/presentations', (c) => create(c, now));
  app.get('/presentations/:slug', (c) => show(c));
  app.patch('/presentations/:slug', (c) => update(c, now));
  app.get('/presentations/:slug/:kind', (c) => current(c));
  app.get('/presentations/:slug/:kind/meta', (c) => meta(c));
  app.put('/presentations/:slug/:kind', (c) => put(c, now));
  app.get('/presentations/:slug/:kind/history', (c) => history(c));
  app.get('/presentations/:slug/:kind/history/:rev', (c) => revision(c));
}
