// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { readStash, rebaseStash, writeStash } from './stash';
import { newBench, newRoom } from '../../shared/template';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

it('stores, validates, restores and clears either document kind', () => {
  expect(readStash('missing', 'bench')).toBeNull();
  for (const kind of ['bench', 'room'] as const) {
    const saved = { baseRev: 3, doc: kind === 'bench' ? newBench(25) : newRoom() };
    expect(writeStash(kind, saved)).toBe(true);
    expect(JSON.parse(sessionStorage.getItem(kind)!)).toEqual(saved);
    expect(readStash(kind, kind)).toEqual(saved);
    expect(writeStash(kind, null)).toBe(true);
    expect(sessionStorage.getItem(kind)).toBeNull();
  }
});

it.each([
  'null',
  'false',
  '17',
  '{}',
  '{"baseRev":1}',
  '{"doc":{}}',
  '{"baseRev":"1","doc":{}}',
  '{"baseRev":1,"doc":{}}',
  'broken',
])('ignores unusable stored data %s', (raw) => {
  sessionStorage.setItem('key', raw);
  expect(readStash('key', 'bench')).toBeNull();
});

it('survives denied storage and quota errors', () => {
  const fail = () => {
    throw Error('denied');
  };
  vi.stubGlobal('sessionStorage', { getItem: fail, setItem: fail, removeItem: fail });
  expect(readStash('key', 'room')).toBeNull();
  expect(writeStash('key', {})).toBe(false);
  expect(writeStash('key', null)).toBe(false);
});

it('rebases only a matching recovery draft and clears a draft already saved', () => {
  const doc = newBench(25);
  const saved = { baseRev: 1, doc };
  rebaseStash('key', 'bench', saved, 2);
  expect(sessionStorage.getItem('key')).toBeNull();
  writeStash('key', { baseRev: 3, doc });
  rebaseStash('key', 'bench', saved, 2);
  expect(readStash('key', 'bench')?.baseRev).toBe(3);
  writeStash('key', saved);
  rebaseStash('key', 'bench', saved, 2);
  expect(sessionStorage.getItem('key')).toBeNull();
  const newer = { ...doc, target: 45 };
  writeStash('key', { baseRev: 1, doc: newer });
  rebaseStash('key', 'bench', saved, 2);
  expect(readStash('key', 'bench')).toEqual({ baseRev: 2, doc: newer });
});
