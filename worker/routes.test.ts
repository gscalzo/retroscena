import { describe, expect, it, vi } from 'vitest';
import type { Bench, DocEnvelope, ListRes, PresentationRes, Room } from '../shared/types';
import { createReq, createTestApp, seed } from './test/harness';

const json = async <T>(res: Response) => (await res.json()) as T;

describe('presentations', () => {
  it('starts empty and lists what was created, dated first, undated last', async () => {
    const t = createTestApp();
    expect(await json(await t.call('GET', '/api/presentations'))).toEqual({ presentations: [] });
    await seed(t, { title: 'Later', date: '2026-12-01' });
    await seed(t, { title: 'Undated B', date: null });
    await seed(t, { title: 'Sooner', date: '2026-10-01' });
    await seed(t, { title: 'Undated A', date: null });
    const list = await json<ListRes>(await t.call('GET', '/api/presentations'));
    expect(list.presentations.map((p) => p.slug)).toEqual([
      'sooner',
      'later',
      'undated-a',
      'undated-b',
    ]);
  });

  it('creates with a derived slug, seeded documents and a summary', async () => {
    const t = createTestApp(1_700_000_000_000);
    const res = await t.call('POST', '/api/presentations', createReq());
    expect(res.status).toBe(201);
    const { presentation } = await json<PresentationRes>(res);
    expect(presentation).toEqual({
      slug: 'the-confidence-gap',
      title: 'The Confidence Gap',
      event: 'LDX3 New York',
      date: '2026-09-15',
      target: 25,
      createdAt: 1_700_000_000_000,
      archivedAt: null,
      bench: { rev: 1, author: 'local', at: 1_700_000_000_000, minutes: 25, beats: 0 },
      room: { rev: 1, author: 'local', at: 1_700_000_000_000, read: 0, total: 0 },
    });
    const bench = await json<DocEnvelope<Bench>>(
      await t.call('GET', '/api/presentations/the-confidence-gap/bench'),
    );
    expect(bench.rev).toBe(1);
    expect(bench.doc.acts).toHaveLength(3);
    expect(bench.doc.target).toBe(25);
    const room = await json<DocEnvelope<Room>>(
      await t.call('GET', '/api/presentations/the-confidence-gap/room'),
    );
    expect(room.doc.articles).toEqual([]);
  });

  it('accepts an explicit slug and refuses a taken or empty one', async () => {
    const t = createTestApp();
    const explicit = await t.call('POST', '/api/presentations', createReq({ slug: 'jc' }));
    expect((await json<PresentationRes>(explicit)).presentation.slug).toBe('jc');
    const taken = await t.call('POST', '/api/presentations', createReq({ slug: 'jc' }));
    expect(taken.status).toBe(409);
    expect(await json(taken)).toEqual({ error: 'slug "jc" is taken' });
    const empty = await t.call('POST', '/api/presentations', createReq({ title: '???' }));
    expect(empty.status).toBe(400);
    expect(await json(empty)).toEqual({ error: 'the title yields no slug; pass one' });
  });

  it('rejects an invalid body with the reason', async () => {
    const t = createTestApp();
    const res = await t.call('POST', '/api/presentations', createReq({ target: 0 }));
    expect(res.status).toBe(400);
    expect(await json(res)).toEqual({ error: 'target: Too small: expected number to be >=1' });
    expect((await t.call('POST', '/api/presentations', 'nope')).status).toBe(400);
  });

  it('shows one presentation and 404s an unknown slug', async () => {
    const t = createTestApp();
    const slug = await seed(t);
    const res = await t.call('GET', `/api/presentations/${slug}`);
    expect((await json<PresentationRes>(res)).presentation.slug).toBe(slug);
    const missing = await t.call('GET', '/api/presentations/nope');
    expect(missing.status).toBe(404);
    expect(await json(missing)).toEqual({ error: 'presentation not found' });
  });

  it('updates metadata and archives, and refuses an empty or unknown update', async () => {
    const t = createTestApp(1_700_000_000_000);
    const slug = await seed(t);
    t.clock.now = 1_700_000_005_000;
    const res = await t.call('PATCH', `/api/presentations/${slug}`, {
      title: 'Renamed',
      event: 'Elsewhere',
      date: null,
      target: 30,
      archived: true,
    });
    expect(res.status).toBe(200);
    expect((await json<PresentationRes>(res)).presentation).toMatchObject({
      title: 'Renamed',
      event: 'Elsewhere',
      date: null,
      target: 30,
      archivedAt: 1_700_000_005_000,
    });
    const back = await t.call('PATCH', `/api/presentations/${slug}`, { archived: false });
    expect((await json<PresentationRes>(back)).presentation.archivedAt).toBeNull();
    const nothing = await t.call('PATCH', `/api/presentations/${slug}`, {});
    expect(nothing.status).toBe(400);
    expect(await json(nothing)).toEqual({ error: 'nothing to update' });
    const unknown = await t.call('PATCH', '/api/presentations/nope', { title: 'x' });
    expect(unknown.status).toBe(404);
    expect(await json(unknown)).toEqual({ error: 'presentation not found' });
  });

  it('leaves the columns a partial update does not mention alone', async () => {
    const t = createTestApp(1_700_000_000_000);
    const slug = await seed(t);
    await t.call('PATCH', `/api/presentations/${slug}`, { archived: true });
    const res = await t.call('PATCH', `/api/presentations/${slug}`, { title: 'Only the title' });
    expect((await json<PresentationRes>(res)).presentation).toMatchObject({
      title: 'Only the title',
      event: 'LDX3 New York',
      date: '2026-09-15',
      target: 25,
      archivedAt: 1_700_000_000_000,
    });
  });
});

describe('documents', () => {
  const getBench = async (t: ReturnType<typeof createTestApp>, slug: string) =>
    json<DocEnvelope<Bench>>(await t.call('GET', `/api/presentations/${slug}/bench`));

  it('404s an unknown kind, slug or revision', async () => {
    const t = createTestApp();
    const slug = await seed(t);
    for (const path of [
      `/api/presentations/${slug}/deck`,
      `/api/presentations/${slug}/deck/meta`,
      `/api/presentations/${slug}/deck/history`,
      `/api/presentations/${slug}/deck/history/1`,
      '/api/presentations/nope/bench',
      '/api/presentations/nope/bench/meta',
      '/api/presentations/nope/bench/history',
      `/api/presentations/${slug}/bench/history/2`,
      `/api/presentations/${slug}/bench/history/x`,
    ]) {
      const res = await t.call('GET', path);
      expect(res.status, path).toBe(404);
      expect(await json(res)).toEqual({ error: 'document not found' });
    }
    expect((await t.call('PUT', `/api/presentations/${slug}/deck`, {})).status).toBe(404);
    const bench = await getBench(t, slug);
    const gone = await t.call('PUT', '/api/presentations/nope/bench', {
      baseRev: 1,
      doc: bench.doc,
    });
    expect(gone.status).toBe(404);
  });

  it('writes a new revision from the current one and serves meta, history and old revisions', async () => {
    const t = createTestApp(1_700_000_000_000);
    const slug = await seed(t);
    const bench = await getBench(t, slug);
    t.clock.now = 1_700_000_001_000;
    const put = await t.call('PUT', `/api/presentations/${slug}/bench`, {
      baseRev: 1,
      doc: { ...bench.doc, target: 30 },
    });
    expect(put.status).toBe(200);
    expect(await json(put)).toEqual({ rev: 2, at: 1_700_000_001_000 });
    expect(await json(await t.call('GET', `/api/presentations/${slug}/bench/meta`))).toEqual({
      rev: 2,
      author: 'local',
      at: 1_700_000_001_000,
    });
    expect((await getBench(t, slug)).doc.target).toBe(30);
    const history = await json<{ history: { rev: number; bytes: number }[] }>(
      await t.call('GET', `/api/presentations/${slug}/bench/history`),
    );
    expect(history.history.map((h) => h.rev)).toEqual([2, 1]);
    expect(history.history[0].bytes).toBe(JSON.stringify({ ...bench.doc, target: 30 }).length);
    const old = await json<DocEnvelope<Bench>>(
      await t.call('GET', `/api/presentations/${slug}/bench/history/1`),
    );
    expect(old.rev).toBe(1);
    expect(old.doc.target).toBe(25);
    const list = await json<ListRes>(await t.call('GET', '/api/presentations'));
    expect(list.presentations[0].bench).toMatchObject({ rev: 2, minutes: 25, beats: 0 });
  });

  it('refuses a stale base revision with the current one', async () => {
    const t = createTestApp();
    const slug = await seed(t);
    const bench = await getBench(t, slug);
    await t.call('PUT', `/api/presentations/${slug}/bench`, { baseRev: 1, doc: bench.doc });
    const stale = await t.call('PUT', `/api/presentations/${slug}/bench`, {
      baseRev: 1,
      doc: bench.doc,
    });
    expect(stale.status).toBe(409);
    expect(await json(stale)).toEqual({
      error: 'revision 2 is current',
      current: { rev: 2, author: 'local', at: 1_700_000_000_000 },
    });
    const ahead = await t.call('PUT', `/api/presentations/${slug}/bench`, {
      baseRev: 3,
      doc: bench.doc,
    });
    expect(ahead.status).toBe(409);
  });

  it('answers a lost insert race with the revision that won', async () => {
    const t = createTestApp();
    const slug = await seed(t);
    const bench = await getBench(t, slug);
    t.failInserts = true;
    const res = await t.call('PUT', `/api/presentations/${slug}/bench`, {
      baseRev: 1,
      doc: bench.doc,
    });
    expect(res.status).toBe(409);
    expect(await json(res)).toMatchObject({ current: { rev: 1 } });
  });

  it('rejects a missing base revision and an invalid document', async () => {
    const t = createTestApp();
    const slug = await seed(t);
    const bench = await getBench(t, slug);
    const noBase = await t.call('PUT', `/api/presentations/${slug}/bench`, { doc: bench.doc });
    expect(noBase.status).toBe(400);
    expect(await json(noBase)).toEqual({ error: 'baseRev must be an integer' });
    expect((await t.call('PUT', `/api/presentations/${slug}/bench`, 'x')).status).toBe(400);
    const bad = await t.call('PUT', `/api/presentations/${slug}/bench`, {
      baseRev: 1,
      doc: { ...bench.doc, backstage: ['ghost'] },
    });
    expect(bad.status).toBe(400);
    expect(await json(bad)).toEqual({ error: 'placed id "ghost" is not a note' });
    const wrongKind = await t.call('PUT', `/api/presentations/${slug}/room`, {
      baseRev: 1,
      doc: bench.doc,
    });
    expect(wrongKind.status).toBe(400);
  });

  it('counts beats and read articles in the summaries', async () => {
    const t = createTestApp();
    const slug = await seed(t);
    const bench = await getBench(t, slug);
    const note = {
      id: 'n1',
      type: 'story',
      text: 'x',
      more: '',
      star: false,
      x3: false,
      retired: false,
    };
    const acts = bench.doc.acts.map((a, i) => (i === 0 ? { ...a, run: ['n1'] } : a));
    await t.call('PUT', `/api/presentations/${slug}/bench`, {
      baseRev: 1,
      doc: { ...bench.doc, notes: [note], acts },
    });
    const room = await json<DocEnvelope<Room>>(
      await t.call('GET', `/api/presentations/${slug}/room`),
    );
    const article = {
      id: 'a1',
      group: 'sources',
      title: 'T',
      author: 'A',
      src: 'S',
      date: '2026',
      url: null,
      cap: 'full capture',
      blurb: '',
      body: '',
      words: 0,
      read: true,
      readDate: '2026-09-01',
      notes: [],
    };
    await t.call('PUT', `/api/presentations/${slug}/room`, {
      baseRev: 1,
      doc: { ...room.doc, articles: [article, { ...article, id: 'a2', read: false }] },
    });
    const shown = await json<PresentationRes>(await t.call('GET', `/api/presentations/${slug}`));
    expect(shown.presentation.bench.beats).toBe(1);
    expect(shown.presentation.room).toMatchObject({ read: 1, total: 2 });
  });

  it('answers 404 for anything else and 500 on an unexpected failure', async () => {
    const t = createTestApp();
    const res = await t.call('GET', '/api/nothing');
    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ error: 'not found' });
    t.env.DB = null as unknown as D1Database;
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = await t.call('GET', '/api/presentations');
    expect(broken.status).toBe(500);
    expect(await json(broken)).toEqual({ error: 'internal error' });
    expect(logged).toHaveBeenCalledTimes(1);
    logged.mockRestore();
  });
});
