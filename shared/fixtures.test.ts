/**
 * Builders the shared tests share. A test file so that it is neither
 * measured nor mutated; its one test keeps the fixture honest.
 */
import { describe, expect, it } from 'vitest';
import { parseBench, parseRoom } from './schema';
import { newBench } from './template';
import type { Act, Article, Bench, Note, Presentation, Room } from './types';

export function note(id: string, patch: Partial<Note> = {}): Note {
  return {
    id,
    type: 'story',
    text: `text ${id}`,
    more: '',
    star: false,
    x3: false,
    retired: false,
    ...patch,
  };
}

export function act(id: string, minutes: number, patch: Partial<Act> = {}): Act {
  return { id, title: `Act ${id}`, slides: '', minutes, pool: [], run: [], ...patch };
}

/**
 * Two acts (4 and 6 minutes), five notes: n1 on act 0's pool, n2 and n3 on
 * its run, n4 on act 1's run, n5 backstage.
 */
export function bench(patch: Partial<Bench> = {}): Bench {
  return {
    ...newBench(10),
    acts: [act('a1', 4, { pool: ['n1'], run: ['n2', 'n3'] }), act('a2', 6, { run: ['n4'] })],
    backstage: ['n5'],
    notes: [note('n1'), note('n2', { type: 'evidence' }), note('n3'), note('n4'), note('n5')],
    ...patch,
  };
}

export function article(id: string, patch: Partial<Article> = {}): Article {
  return {
    id,
    group: 'g1',
    title: `Title ${id}`,
    author: 'Someone',
    src: 'Somewhere',
    date: 'Aug 2026',
    url: `https://example.test/${id}`,
    cap: 'full capture',
    blurb: 'blurb',
    body: '<p>body</p>',
    words: 100,
    read: false,
    readDate: null,
    notes: [],
    ...patch,
  };
}

/** Two groups; a1 and a2 in g1 (a2 read), a3 in g2. */
export function room(patch: Partial<Room> = {}): Room {
  return {
    groups: [
      { id: 'g1', title: 'Group one', sub: 'first' },
      { id: 'g2', title: 'Group two', sub: 'second' },
    ],
    articles: [
      article('a1'),
      article('a2', {
        read: true,
        readDate: '2026-08-20',
        notes: [{ t: 'a note', d: '2026-08-20' }],
      }),
      article('a3', { group: 'g2', url: null, body: '' }),
    ],
    ...patch,
  };
}

export function presentation(patch: Partial<Presentation> = {}): Presentation {
  return {
    slug: 'the-talk',
    title: 'The Talk',
    event: 'Some Conf',
    date: '2026-09-15',
    target: 10,
    createdAt: 1_700_000_000_000,
    archivedAt: null,
    ...patch,
  };
}

describe('fixtures', () => {
  it('are valid documents', () => {
    expect(parseBench(bench())).toMatchObject({ ok: true });
    expect(parseRoom(room())).toMatchObject({ ok: true });
  });
});
