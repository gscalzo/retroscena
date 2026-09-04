import { describe, expect, it } from 'vitest';
import { newBench, newRoom } from '../shared/template';
import { ApiError } from './api';
import { parseArgs } from './args';
import { getDoc, history, migrate, putDoc } from './documents';
import { fakeIo, json } from './test/fake-io';
import type { FakeOptions } from './test/fake-io';

const env = { RETROSCENA_URL: 'https://rs.test' };
const meta = { rev: 4, author: 'agent:mac', at: 1_700_000_000_000 };
const bench = newBench(30);
const envelope = { ...meta, doc: bench };
const pretty = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
const make = (opts: FakeOptions = {}) => fakeIo({ env, ...opts });

describe('get', () => {
  it('needs a slug and a kind, and a sane --rev', async () => {
    const fake = make();
    expect(await getDoc(fake.io, parseArgs(['get', 'talk']))).toBe(2);
    expect(await getDoc(fake.io, parseArgs(['get', 'talk', 'bench', '--rev', '0']))).toBe(2);
    expect(fake.err[2]).toContain('--rev must be a positive integer');
    expect(fake.requests).toEqual([]);
  });

  it('prints the current envelope, pretty', async () => {
    const fake = make({ responses: [json(200, envelope)] });
    expect(await getDoc(fake.io, parseArgs(['get', 'talk', 'bench']))).toBe(0);
    expect(fake.requests[0]).toMatchObject({
      url: 'https://rs.test/api/presentations/talk/bench',
      init: { method: 'GET' },
    });
    expect(fake.out).toEqual([pretty(envelope)]);
  });

  it('fetches an older revision from the history', async () => {
    const fake = make({ responses: [json(200, envelope)] });
    expect(await getDoc(fake.io, parseArgs(['get', 'talk', 'room', '--rev', '2']))).toBe(0);
    expect(fake.requests[0].url).toBe('https://rs.test/api/presentations/talk/room/history/2');
  });

  it('writes to -o or --out and says so', async () => {
    const fake = make({ responses: [json(200, envelope), json(200, envelope)] });
    expect(await getDoc(fake.io, parseArgs(['get', 'talk', 'bench', '-o', '/tmp/b.json']))).toBe(0);
    expect(await getDoc(fake.io, parseArgs(['get', 'talk', 'bench', '--out', '/tmp/c.json']))).toBe(
      0,
    );
    expect(fake.files.get('/tmp/b.json')).toBe(pretty(envelope));
    expect(fake.files.get('/tmp/c.json')).toBe(pretty(envelope));
    expect(fake.out).toEqual([
      'wrote /tmp/b.json (bench of talk, rev 4)\n',
      'wrote /tmp/c.json (bench of talk, rev 4)\n',
    ]);
  });
});

describe('put', () => {
  const file = '/tmp/bench.json';
  const argv = (...extra: string[]) => parseArgs(['put', 'talk', 'bench', file, ...extra]);

  it('needs a reference, a file, and a sane --rev', async () => {
    const fake = make({ files: { [file]: JSON.stringify(envelope) } });
    expect(await putDoc(fake.io, parseArgs(['put', 'talk']))).toBe(2);
    expect(fake.err).toHaveLength(2);
    expect(fake.err[0]).toContain('put needs a slug and a kind');
    expect(await putDoc(fake.io, parseArgs(['put', 'talk', 'bench']))).toBe(2);
    expect(fake.err[2]).toContain('put needs a file');
    expect(await putDoc(fake.io, argv('--rev', 'x'))).toBe(2);
    expect(fake.err[4]).toContain('--rev must be a positive integer');
    expect(fake.requests).toEqual([]);
  });

  it('refuses a missing file, a non-JSON file and an invalid document', async () => {
    const fake = make({
      files: {
        '/tmp/bad.json': '{not json',
        '/tmp/empty.json': '{}',
        '/tmp/null.json': 'null',
        '/tmp/str.json': '"just a string"',
      },
    });
    expect(await putDoc(fake.io, argv())).toBe(2);
    expect(fake.err[0]).toContain('cannot read /tmp/bench.json');
    expect(await putDoc(fake.io, parseArgs(['put', 'talk', 'bench', '/tmp/bad.json']))).toBe(2);
    expect(fake.err[2]).toContain('/tmp/bad.json is not JSON');
    expect(await putDoc(fake.io, parseArgs(['put', 'talk', 'bench', '/tmp/empty.json']))).toBe(2);
    expect(fake.err[4]).toContain('invalid bench:');
    expect(await putDoc(fake.io, parseArgs(['put', 'talk', 'room', '/tmp/null.json']))).toBe(2);
    expect(fake.err[6]).toContain('invalid room:');
    expect(await putDoc(fake.io, parseArgs(['put', 'talk', 'bench', '/tmp/str.json']))).toBe(2);
    expect(fake.err[8]).toContain('invalid bench:');
    expect(fake.requests).toEqual([]);
  });

  it('takes the base rev from the envelope and reports the new rev', async () => {
    const fake = make({
      files: { [file]: JSON.stringify(envelope) },
      responses: [json(200, { rev: 5, at: 1 })],
    });
    expect(await putDoc(fake.io, argv())).toBe(0);
    expect(fake.requests[0]).toMatchObject({
      url: 'https://rs.test/api/presentations/talk/bench',
      init: { method: 'PUT', body: JSON.stringify({ baseRev: 4, doc: bench }), timeoutMs: 30_000 },
    });
    expect(fake.out).toEqual(['saved bench of talk as rev 5\n']);
  });

  it('lets --rev override the envelope and cover a bare document', async () => {
    const fake = make({
      files: { [file]: JSON.stringify(envelope), '/tmp/bare.json': JSON.stringify(bench) },
      responses: [json(200, { rev: 8, at: 1 }), json(200, { rev: 3, at: 1 })],
    });
    expect(await putDoc(fake.io, argv('--rev', '7'))).toBe(0);
    expect(
      await putDoc(fake.io, parseArgs(['put', 'talk', 'bench', '/tmp/bare.json', '--rev', '2'])),
    ).toBe(0);
    expect(
      fake.requests.map((r) => (JSON.parse(r.init.body ?? '') as { baseRev: number }).baseRev),
    ).toEqual([7, 2]);
  });

  it('treats an envelope with a non-numeric rev as a bare document', async () => {
    const fake = make({ files: { [file]: JSON.stringify({ rev: '4', doc: bench }) } });
    expect(await putDoc(fake.io, argv())).toBe(2);
    expect(fake.err[0]).toContain('invalid bench');
  });

  it('refuses a bare document without --rev or --force', async () => {
    const fake = make({ files: { [file]: JSON.stringify(bench) } });
    expect(await putDoc(fake.io, argv())).toBe(2);
    expect(fake.err[0]).toContain('no base rev');
    expect(fake.requests).toEqual([]);
  });

  it('fetches the current rev with --force', async () => {
    const room = newRoom();
    const fake = make({
      files: { '/tmp/room.json': JSON.stringify(room) },
      responses: [json(200, { rev: 9, author: 'owner', at: 1 }), json(200, { rev: 10, at: 2 })],
    });
    const args = parseArgs(['put', 'talk', 'room', '/tmp/room.json', '--force', '--rev', '1']);
    expect(await putDoc(fake.io, args)).toBe(0);
    expect(fake.requests.map((r) => [r.url, r.init.method])).toEqual([
      ['https://rs.test/api/presentations/talk/room/meta', 'GET'],
      ['https://rs.test/api/presentations/talk/room', 'PUT'],
    ]);
    expect(JSON.parse(fake.requests[1].init.body ?? '')).toEqual({ baseRev: 9, doc: room });
    expect(fake.out).toEqual(['saved room of talk as rev 10\n']);
  });

  it('explains a conflict with the current revision and exits 1', async () => {
    const fake = make({
      files: { [file]: JSON.stringify(envelope) },
      responses: [
        json(409, { error: 'stale', current: { rev: 6, author: 'owner', at: 1_700_000_000_000 } }),
      ],
    });
    expect(await putDoc(fake.io, argv())).toBe(1);
    expect(fake.err).toEqual([
      'retroscena: conflict — bench of talk is at rev 6 (owner, 2023-11-14 22:13:20); you started from rev 4. Get it again, re-apply your change, put again.\n',
    ]);
  });

  it('falls back to the server reason when the conflict carries no revision', async () => {
    const fake = make({
      files: { [file]: JSON.stringify(envelope) },
      responses: [
        json(409, { error: 'stale' }),
        { status: 409, body: 'nope' },
        json(409, { current: {} }),
      ],
    });
    expect(await putDoc(fake.io, argv())).toBe(1);
    expect(await putDoc(fake.io, argv())).toBe(1);
    expect(await putDoc(fake.io, argv())).toBe(1);
    expect(fake.err).toEqual([
      'retroscena: conflict — stale. Get it again, re-apply your change, put again.\n',
      'retroscena: conflict — HTTP 409. Get it again, re-apply your change, put again.\n',
      'retroscena: conflict — HTTP 409. Get it again, re-apply your change, put again.\n',
    ]);
  });

  it('lets any other failure through', async () => {
    const fake = make({
      files: { [file]: JSON.stringify(envelope) },
      responses: [json(500, { error: 'down' }), new Error('fetch failed')],
    });
    const first = await putDoc(fake.io, argv()).catch((e: unknown) => e);
    expect(first).toBeInstanceOf(ApiError);
    expect(first).toMatchObject({ status: 500 });
    await expect(putDoc(fake.io, argv())).rejects.toThrow('fetch failed');
  });
});

describe('history', () => {
  const entries = [
    { rev: 2, author: 'agent:mac', at: 1_700_000_000_000, bytes: 12345 },
    { rev: 1, author: 'owner', at: 1_699_999_000_000, bytes: 900 },
  ];

  it('needs a reference', async () => {
    const fake = make();
    expect(await history(fake.io, parseArgs(['history', 'talk', 'x']))).toBe(2);
  });

  it('prints one revision per line, newest first, or the JSON', async () => {
    const fake = make({
      responses: [json(200, { history: entries }), json(200, { history: entries })],
    });
    expect(await history(fake.io, parseArgs(['history', 'talk', 'bench']))).toBe(0);
    expect(fake.requests[0].url).toBe('https://rs.test/api/presentations/talk/bench/history');
    expect(fake.out[0]).toBe(
      [
        'REV  AUTHOR     WHEN                 SIZE',
        'r2   agent:mac  2023-11-14 22:13:20  12,345 bytes',
        'r1   owner      2023-11-14 21:56:40  900 bytes',
        '',
      ].join('\n'),
    );
    expect(await history(fake.io, parseArgs(['history', 'talk', 'bench', '--json']))).toBe(0);
    expect(fake.out[1]).toBe(`${JSON.stringify({ history: entries })}\n`);
  });
});

describe('migrate', () => {
  const state = (json: string) =>
    `<script type="application/json" id="state-json">${json}</script>`;
  const head = {
    who: { room: 'r', know: 'k', expect: 'e' },
    why: {
      speakerGoal: 'g',
      promise: 'p',
      throughline: 't',
      tfd: {
        think: { now: '1', after: '2' },
        feel: { now: '3', after: '4' },
        do: { now: '5', after: '6' },
      },
    },
    hook: {
      selected: 'quote',
      texts: { anecdote: 'a', statement: 's', metaphor: 'm', quote: 'q', question: '?' },
    },
  };
  const v2 = `<html><script id="app-js">var MILESTONES=[{id:'n1',label:'open',by:2}];</script>${state(
    JSON.stringify({
      ...head,
      rev: 9,
      schema: 2,
      target: 20,
      acts: [{ id: 'a1', title: 'One', slides: '1-3', minutes: 10, pool: ['n2'], run: ['n1'] }],
      backstage: [],
      notes: [
        { id: 'n1', type: 'story', star: true, x3: false, text: 't1', more: 'm' },
        { id: 'n2', type: 'evidence', text: 't2' },
        { id: 'n3', type: 'humor', text: 'unplaced' },
      ],
    }),
  )}</html>`;
  const v1 = `<html>${state(
    JSON.stringify({
      ...head,
      rev: 0,
      notes: [
        { id: 'n1', cat: 'machine', status: 'kept', text: 'k' },
        { id: 'n2', cat: 'story', status: 'cut', text: 'c' },
        { id: 'n3', cat: 'star', status: 'pile', text: 'p' },
      ],
      structure: {
        target: 45,
        hook: { title: 'Cold open', minutes: 1, items: ['n1'] },
        intro: { title: 'Intro', minutes: 2, items: [] },
        body: [{ title: 'Body', minutes: 7, items: [] }],
        outro: { title: 'Outro', minutes: 3, items: [] },
      },
    }),
  )}</html>`;
  const room = `<html><script type="application/json" id="content-json">${JSON.stringify({
    groups: [{ id: 'g', title: 'G', sub: 's' }],
    articles: [
      {
        id: 'x',
        group: 'g',
        title: 'X',
        author: 'A',
        src: 'S',
        date: 'D',
        url: 'https://x.test',
        cap: 'full',
        blurb: 'b',
        body: '<p>hi</p>',
        words: 2,
      },
      {
        id: 'y',
        group: 'g',
        title: 'Y',
        author: 'A',
        src: 'S',
        date: 'D',
        url: null,
        cap: 'writeout',
        blurb: 'b',
        body: '',
        words: 0,
      },
    ],
  })}</script>${state(
    JSON.stringify({
      rev: 5,
      items: { x: { read: true, readDate: '2026-08-20', notes: [{ t: 'n', d: '2026-08-20' }] } },
    }),
  )}</html>`;
  const files = {
    '/a/v2.html': v2,
    '/a/v1.html': v1,
    '/a/room.html': room,
    '/a/none.html': '<html>no state</html>',
    '/a/odd.html': `<html>${state('{"rev":1}')}</html>`,
    '/a/zero.html': `<html>${state(JSON.stringify({ ...head, target: 0, acts: [], notes: [] }))}</html>`,
  };

  it('needs a file and -o', () => {
    const fake = make({ files });
    expect(migrate(fake.io, parseArgs(['migrate']))).toBe(2);
    expect(migrate(fake.io, parseArgs(['migrate', '/a/v2.html']))).toBe(2);
    expect(migrate(fake.io, parseArgs(['migrate', '-o', '/o.json']))).toBe(2);
    expect(fake.err[0]).toContain('migrate needs an artifact file and -o');
    expect(fake.err[2]).toContain('migrate needs an artifact file and -o');
    expect(fake.err[4]).toContain('migrate needs an artifact file and -o');
    expect(fake.files.size).toBe(Object.keys(files).length);
  });

  it('refuses a missing file, an unknown page and a conversion the schema rejects', () => {
    const fake = make({ files });
    expect(migrate(fake.io, parseArgs(['migrate', '/a/gone.html', '-o', '/o.json']))).toBe(2);
    expect(fake.err[0]).toContain('cannot read /a/gone.html');
    expect(migrate(fake.io, parseArgs(['migrate', '/a/none.html', '-o', '/o.json']))).toBe(2);
    expect(fake.err[2]).toContain('/a/none.html is not a saved workbench or reading room');
    expect(migrate(fake.io, parseArgs(['migrate', '/a/odd.html', '-o', '/o.json']))).toBe(2);
    expect(fake.err[4]).toContain('/a/odd.html is not a saved workbench or reading room');
    expect(migrate(fake.io, parseArgs(['migrate', '/a/zero.html', '-o', '/o.json']))).toBe(2);
    expect(fake.err[6]).toContain('the converted bench is invalid: target');
    expect(fake.files.has('/o.json')).toBe(false);
  });

  it('writes a schema-2 workbench as a bench, milestones included', () => {
    const fake = make({ files });
    expect(migrate(fake.io, parseArgs(['migrate', '/a/v2.html', '-o', '/o.json']))).toBe(0);
    expect(fake.out).toEqual(['wrote /o.json: bench, 3 notes, 1 acts, 1 backstage\n']);
    const doc = JSON.parse(fake.files.get('/o.json') ?? '') as ReturnType<typeof newBench>;
    expect(doc.target).toBe(20);
    expect(doc.milestones).toEqual([{ id: 'n1', label: 'open', by: 2 }]);
    expect(doc.acts[0]).toMatchObject({ id: 'a1', pool: ['n2'], run: ['n1'], slides: '1-3' });
    expect(doc.backstage).toEqual(['n3']);
    expect(doc.notes[0]).toEqual({
      id: 'n1',
      type: 'story',
      text: 't1',
      more: 'm',
      star: true,
      x3: false,
      retired: false,
    });
    expect(doc.hook.selected).toBe('quote');
  });

  it('writes a first-generation workbench as a bench with the sections as acts', () => {
    const fake = make({ files });
    expect(migrate(fake.io, parseArgs(['migrate', '/a/v1.html', '--out', '/o.json']))).toBe(0);
    expect(fake.out).toEqual(['wrote /o.json: bench, 3 notes, 4 acts, 2 backstage\n']);
    const doc = JSON.parse(fake.files.get('/o.json') ?? '') as ReturnType<typeof newBench>;
    expect(doc.acts.map((a) => [a.id, a.minutes, a.run])).toEqual([
      ['hook', 1, ['n1']],
      ['intro', 2, []],
      ['b1', 7, []],
      ['outro', 3, []],
    ]);
    expect(doc.backstage).toEqual(['n2', 'n3']);
    expect(doc.notes.map((n) => [n.type, n.retired])).toEqual([
      ['machine', false],
      ['story', true],
      ['star', false],
    ]);
    expect(doc.categories.map((c) => c.id)).toContain('machine');
  });

  it('writes a reading room as a room with the read state merged in', () => {
    const fake = make({ files });
    expect(migrate(fake.io, parseArgs(['migrate', '/a/room.html', '-o', '/r.json']))).toBe(0);
    expect(fake.out).toEqual(['wrote /r.json: room, 2 articles in 1 groups\n']);
    const doc = JSON.parse(fake.files.get('/r.json') ?? '') as ReturnType<typeof newRoom>;
    expect(doc.articles[0]).toMatchObject({
      id: 'x',
      read: true,
      readDate: '2026-08-20',
      notes: [{ t: 'n', d: '2026-08-20' }],
      body: '<p>hi</p>',
    });
    expect(doc.articles[1]).toMatchObject({
      id: 'y',
      url: null,
      read: false,
      readDate: null,
      notes: [],
    });
  });
});
