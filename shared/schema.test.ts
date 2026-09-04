import { describe, expect, it } from 'vitest';
import { act, bench, note, room } from './fixtures.test';
import {
  TARGET_MAX,
  TARGET_MIN,
  isDocKind,
  parseBench,
  parseCreate,
  parseDoc,
  parseRoom,
  parseUpdate,
} from './schema';

const rejects = (value: unknown, fragment: string) => {
  const r = parseBench(value);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toContain(fragment);
};

describe('parseBench', () => {
  it('accepts a valid bench and hands back its data', () => {
    const b = bench();
    const r = parseBench(b);
    expect(r).toEqual({ ok: true, value: b });
  });

  it('reports the first issue with its path', () => {
    const r = parseBench(bench({ target: 0 }));
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toMatch(/^target: /);
    const root = parseBench(bench({ notes: [...bench().notes, note('n1')] }));
    if (!root.ok) expect(root.error).toMatch(/^duplicate note id/);
  });

  it('bounds the target, the act minutes and the milestone minute', () => {
    expect(parseBench(bench({ target: TARGET_MIN })).ok).toBe(true);
    expect(parseBench(bench({ target: TARGET_MAX })).ok).toBe(true);
    rejects(bench({ target: TARGET_MIN - 1 }), 'target');
    rejects(bench({ target: TARGET_MAX + 1 }), 'target');
    const withMinutes = (m: number) =>
      bench({ acts: [act('a1', m, { run: ['n1', 'n2', 'n3', 'n4', 'n5'] })], backstage: [] });
    expect(parseBench(withMinutes(0)).ok).toBe(true);
    expect(parseBench(withMinutes(600)).ok).toBe(true);
    rejects(withMinutes(-1), 'minutes');
    rejects(withMinutes(601), 'minutes');
    expect(parseBench(bench({ milestones: [{ id: 'n1', label: 'm', by: 0 }] })).ok).toBe(true);
    rejects(bench({ milestones: [{ id: 'n1', label: 'm', by: -1 }] }), 'by');
  });

  it('enforces the enums and the shape', () => {
    const b = bench();
    rejects({ ...b, hook: { ...b.hook, selected: 'nope' } }, 'selected');
    rejects({ ...b, hook: { selected: 'quote', texts: { anecdote: '' } } }, 'texts');
    rejects({ ...b, categories: [{ id: 'story', label: 'S', swatch: 'mauve' }] }, 'swatch');
    rejects({ ...b, categories: [] }, 'categories');
    rejects({ ...b, notes: [{ ...b.notes[0], id: '' }, ...b.notes.slice(1)] }, 'id');
    rejects({ ...b, notes: [{ ...b.notes[0], star: 'yes' }, ...b.notes.slice(1)] }, 'star');
    rejects({ ...b, who: { room: 'x' } }, 'who');
    rejects(null, '');
    rejects('bench', '');
  });

  it('rejects duplicate note, act and category ids', () => {
    const b = bench();
    rejects({ ...b, notes: [...b.notes, note('n1')] }, 'duplicate note id "n1"');
    rejects(
      {
        ...b,
        acts: [act('a1', 4, { pool: ['n1'], run: ['n2', 'n3'] }), act('a1', 6, { run: ['n4'] })],
      },
      'duplicate act id "a1"',
    );
    rejects(
      { ...b, categories: [...b.categories, { id: 'story', label: 'Again', swatch: 'teal' }] },
      'duplicate category id "story"',
    );
  });

  it('rejects a note whose category the bench does not have', () => {
    const b = bench();
    rejects(
      { ...b, notes: [note('n1', { type: 'machine' }), ...b.notes.slice(1)] },
      'note "n1" has unknown category "machine"',
    );
  });

  it('rejects placements that do not add up', () => {
    const b = bench();
    rejects({ ...b, backstage: ['n5', 'ghost'] }, 'placed id "ghost" is not a note');
    rejects({ ...b, backstage: ['n5', 'n1'] }, 'note "n1" is placed twice');
    rejects({ ...b, backstage: [] }, 'note "n5" is not placed anywhere');
    rejects(
      {
        ...b,
        acts: [
          act('a1', 4, { pool: ['n1', 'n1'], run: ['n2', 'n3'] }),
          act('a2', 6, { run: ['n4'] }),
        ],
      },
      'note "n1" is placed twice',
    );
    rejects(
      {
        ...b,
        acts: [
          act('a1', 4, { pool: ['n1'], run: ['n2', 'n3', 'n4'] }),
          act('a2', 6, { run: ['n4'] }),
        ],
      },
      'note "n4" is placed twice',
    );
  });

  it('rejects a milestone on a note that does not exist', () => {
    rejects(
      bench({ milestones: [{ id: 'ghost', label: 'STAR', by: 5 }] }),
      'milestone "STAR" points at unknown note "ghost"',
    );
    expect(parseBench(bench({ milestones: [{ id: 'n5', label: 'STAR', by: 5 }] })).ok).toBe(true);
  });
});

describe('parseRoom', () => {
  const roomRejects = (value: unknown, fragment: string) => {
    const r = parseRoom(value);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(fragment);
  };

  it('accepts a valid room, with null urls and dates', () => {
    const r = room();
    expect(parseRoom(r)).toEqual({ ok: true, value: r });
  });

  it('rejects a broken shape', () => {
    const r = room();
    roomRejects({ ...r, articles: [{ ...r.articles[0], words: -1 }] }, 'words');
    roomRejects({ ...r, articles: [{ ...r.articles[0], url: 5 }] }, 'url');
    roomRejects({ ...r, articles: [{ ...r.articles[0], notes: [{ t: 'x' }] }] }, 'notes');
    roomRejects({ groups: [] }, 'articles');
    roomRejects([], '');
  });

  it('rejects duplicate group and article ids, and an article in an unknown group', () => {
    const r = room();
    roomRejects(
      { ...r, groups: [...r.groups, { id: 'g1', title: 'x', sub: '' }] },
      'duplicate group id "g1"',
    );
    roomRejects({ ...r, articles: [...r.articles, r.articles[0]] }, 'duplicate article id "a1"');
    roomRejects(
      { ...r, articles: [{ ...r.articles[0], group: 'g9' }, ...r.articles.slice(1)] },
      'article "a1" is in unknown group "g9"',
    );
  });
});

describe('parseDoc and isDocKind', () => {
  it('dispatches on the kind', () => {
    expect(parseDoc('bench', bench()).ok).toBe(true);
    expect(parseDoc('bench', room()).ok).toBe(false);
    expect(parseDoc('room', room()).ok).toBe(true);
    expect(parseDoc('room', bench()).ok).toBe(false);
    expect(isDocKind('bench')).toBe(true);
    expect(isDocKind('room')).toBe(true);
    expect(isDocKind('deck')).toBe(false);
    expect(isDocKind('')).toBe(false);
  });
});

describe('parseCreate', () => {
  const ok = { title: 'The Talk', event: 'Conf', date: '2026-09-15', target: 25 };

  it('accepts the four fields, trimming the words, with an optional slug', () => {
    expect(parseCreate(ok)).toEqual({ ok: true, value: ok });
    expect(parseCreate({ ...ok, title: '  The Talk ', event: ' Conf ' })).toEqual({
      ok: true,
      value: ok,
    });
    expect(parseCreate({ ...ok, date: null, event: '' })).toEqual({
      ok: true,
      value: { ...ok, date: null, event: '' },
    });
    expect(parseCreate({ ...ok, slug: 'junior-crisis' })).toMatchObject({
      ok: true,
      value: { slug: 'junior-crisis' },
    });
    expect(parseCreate({ ...ok, slug: 'a' })).toMatchObject({ ok: true });
    expect(parseCreate({ ...ok, slug: 'a1-b2-c3' })).toMatchObject({ ok: true });
  });

  it('rejects an empty title, a bad date, a bad slug, a bad target', () => {
    const bad = (value: unknown, fragment: string) => {
      const r = parseCreate(value);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain(fragment);
    };
    bad({ ...ok, title: '   ' }, 'title');
    bad({ ...ok, date: '15 Sep 2026' }, 'date');
    bad({ ...ok, date: '2026-9-15' }, 'date');
    bad({ ...ok, date: 'x2026-09-15' }, 'date');
    bad({ ...ok, date: '2026-09-15x' }, 'date');
    bad({ ...ok, date: undefined }, 'date');
    for (const slug of ['', 'Junior', 'a--b', '-a', 'a-', 'a_b', 'a b', 'a.b'])
      bad({ ...ok, slug }, 'slug');
    bad({ ...ok, target: 0 }, 'target');
    bad({ ...ok, target: '25' }, 'target');
    bad({}, '');
    bad(null, '');
  });
});

describe('parseUpdate', () => {
  it('accepts any non-empty subset', () => {
    expect(parseUpdate({ archived: true })).toEqual({ ok: true, value: { archived: true } });
    expect(parseUpdate({ date: null })).toEqual({ ok: true, value: { date: null } });
    expect(parseUpdate({ title: ' New ', event: ' E ', target: 30, date: '2026-10-01' })).toEqual({
      ok: true,
      value: { title: 'New', event: 'E', target: 30, date: '2026-10-01' },
    });
  });

  it('rejects an empty update or a bad field', () => {
    const bad = (value: unknown, fragment: string) => {
      const r = parseUpdate(value);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain(fragment);
    };
    bad({}, 'nothing to update');
    bad({ title: ' ' }, 'title');
    bad({ date: '1 Oct' }, 'date');
    bad({ target: TARGET_MAX + 1 }, 'target');
    bad({ archived: 'yes' }, 'archived');
    bad('x', '');
  });
});
