import { describe, expect, it } from 'vitest';
import { newBench } from '../shared/template';
import type { PresentationSummary } from '../shared/types';
import { parseArgs } from './args';
import { archive, create, list, outline, ping, unarchive, whoami } from './presentations';
import { fakeIo, json } from './test/fake-io';

const env = {
  RETROSCENA_URL: 'https://rs.test',
  CF_ACCESS_CLIENT_ID: 'i',
  CF_ACCESS_CLIENT_SECRET: 's',
};

const meta = { rev: 1, author: 'owner', at: 1_700_000_000_000 };
const summary = (over: Partial<PresentationSummary> = {}): PresentationSummary => ({
  slug: 'talk',
  title: 'The Talk',
  event: 'DevCon',
  date: '2026-10-01',
  target: 25,
  createdAt: 0,
  archivedAt: null,
  bench: { ...meta, rev: 3, minutes: 24, beats: 10 },
  room: { ...meta, read: 2, total: 5 },
  ...over,
});

describe('list', () => {
  it('prints a table with every presentation', async () => {
    const fake = fakeIo({
      env,
      responses: [
        json(200, {
          presentations: [
            summary(),
            summary({ slug: 'old', date: null, archivedAt: 5, event: '' }),
          ],
        }),
      ],
    });
    expect(await list(fake.io, parseArgs(['list']))).toBe(0);
    expect(fake.requests[0]).toMatchObject({
      url: 'https://rs.test/api/presentations',
      init: { method: 'GET' },
    });
    expect(fake.out.join('')).toBe(
      [
        'SLUG  TITLE     EVENT   DATE        MIN  BENCH  ROOM',
        'talk  The Talk  DevCon  2026-10-01  25   r3     r1',
        'old   The Talk                      25   r3     r1    archived',
        '',
      ].join('\n'),
    );
  });

  it('prints the JSON with --json and a note when there is nothing', async () => {
    const fake = fakeIo({
      env,
      responses: [json(200, { presentations: [] }), json(200, { presentations: [] })],
    });
    expect(await list(fake.io, parseArgs(['list', '--json']))).toBe(0);
    expect(await list(fake.io, parseArgs(['list']))).toBe(0);
    expect(fake.out).toEqual(['{"presentations":[]}\n', 'no presentations yet\n']);
  });
});

describe('create', () => {
  it('needs a title and a numeric --minutes', async () => {
    const fake = fakeIo({ env });
    expect(await create(fake.io, parseArgs(['create']))).toBe(2);
    expect(await create(fake.io, parseArgs(['create', '--title', 'T', '--minutes', 'x']))).toBe(2);
    expect(fake.err[0]).toContain('needs --title');
    expect(fake.err[2]).toContain('--minutes must be a number');
    expect(fake.requests).toEqual([]);
  });

  it('refuses what the schema refuses, before calling', async () => {
    const fake = fakeIo({ env });
    expect(await create(fake.io, parseArgs(['create', '--title', 'T', '--date', 'soon']))).toBe(2);
    expect(fake.err[0]).toContain('date');
    expect(fake.requests).toEqual([]);
  });

  it('posts the defaults and prints the slug and both URLs', async () => {
    const fake = fakeIo({
      env,
      responses: [json(201, { presentation: summary({ slug: 'the-t' }) })],
    });
    expect(await create(fake.io, parseArgs(['create', '--title', 'The T']))).toBe(0);
    expect(fake.requests[0]).toMatchObject({
      url: 'https://rs.test/api/presentations',
      init: {
        method: 'POST',
        body: JSON.stringify({ title: 'The T', event: '', date: null, target: 30 }),
      },
    });
    expect(fake.out).toEqual([
      'created the-t\n  bench  https://rs.test/the-t/bench\n  room   https://rs.test/the-t/room\n',
    ]);
  });

  it('posts every option and prints JSON when asked', async () => {
    const res = { presentation: summary() };
    const fake = fakeIo({ env, responses: [json(201, res)] });
    const argv = [
      'create',
      '--title',
      ' T ',
      '--event',
      'E',
      '--date',
      '2026-10-01',
      '--minutes',
      '25',
      '--slug',
      'talk',
      '--json',
    ];
    expect(await create(fake.io, parseArgs(argv))).toBe(0);
    expect(JSON.parse(fake.requests[0].init.body ?? '')).toEqual({
      title: 'T',
      event: 'E',
      date: '2026-10-01',
      target: 25,
      slug: 'talk',
    });
    expect(fake.out).toEqual([`${JSON.stringify(res)}\n`]);
  });
});

describe('archive and unarchive', () => {
  it('need a slug', async () => {
    const fake = fakeIo({ env });
    expect(await archive(fake.io, parseArgs(['archive']))).toBe(2);
    expect(await unarchive(fake.io, parseArgs(['unarchive']))).toBe(2);
    expect(fake.err[0]).toContain('archive needs a slug');
    expect(fake.err[2]).toContain('unarchive needs a slug');
  });

  it('patch the flag', async () => {
    const res = json(200, { presentation: summary() });
    const fake = fakeIo({ env, responses: [res, res] });
    expect(await archive(fake.io, parseArgs(['archive', 'talk']))).toBe(0);
    expect(await unarchive(fake.io, parseArgs(['unarchive', 'talk']))).toBe(0);
    expect(fake.requests.map((r) => [r.url, r.init.method, r.init.body])).toEqual([
      ['https://rs.test/api/presentations/talk', 'PATCH', '{"archived":true}'],
      ['https://rs.test/api/presentations/talk', 'PATCH', '{"archived":false}'],
    ]);
    expect(fake.out).toEqual(['archived talk\n', 'restored talk\n']);
  });
});

describe('outline', () => {
  it('needs a slug', async () => {
    const fake = fakeIo({ env });
    expect(await outline(fake.io, parseArgs(['outline']))).toBe(2);
    expect(fake.err[0]).toContain('outline needs a slug');
  });

  it('prints the bench as Markdown, dated today', async () => {
    const bench = newBench(25);
    bench.why.throughline = 'One idea';
    const fake = fakeIo({
      env,
      now: Date.parse('2026-09-04T10:00:00Z'),
      responses: [json(200, { presentation: summary() }), json(200, { ...meta, doc: bench })],
    });
    expect(await outline(fake.io, parseArgs(['outline', 'talk']))).toBe(0);
    expect(fake.requests.map((r) => r.url)).toEqual([
      'https://rs.test/api/presentations/talk',
      'https://rs.test/api/presentations/talk/bench',
    ]);
    const md = fake.out.join('');
    expect(md).toContain('# The Talk: outline draft');
    expect(md).toContain('Exported 2026-09-04.');
    expect(md).toContain('DevCon, 2026-10-01');
    expect(md).toContain('One idea');
    expect(md.endsWith('\n')).toBe(true);
  });
});

describe('ping and whoami', () => {
  it('ping reports the URL and how the server sees the caller', async () => {
    const fake = fakeIo({ env, responses: [json(200, { ok: true, caller: 'agent' })] });
    expect(await ping(fake.io)).toBe(0);
    expect(fake.requests[0].url).toBe('https://rs.test/api/ping');
    expect(fake.out).toEqual(['retroscena: https://rs.test answers; you are seen as "agent"\n']);
  });

  it('whoami tells whether a whole token is configured', () => {
    const configured = fakeIo({ env });
    expect(whoami(configured.io)).toBe(0);
    expect(configured.out).toEqual(['url https://rs.test\ntoken configured\n']);
    const half = fakeIo({ env: { CF_ACCESS_CLIENT_ID: 'i' } });
    whoami(half.io);
    expect(half.out).toEqual([
      'url https://retroscena.effectivecode.co.uk\ntoken not configured (local only)\n',
    ]);
    const secretOnly = fakeIo({ env: { CF_ACCESS_CLIENT_SECRET: 's' } });
    whoami(secretOnly.io);
    expect(secretOnly.out[0]).toContain('not configured');
  });
});
