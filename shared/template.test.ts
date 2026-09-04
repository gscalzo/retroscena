import { describe, expect, it } from 'vitest';
import { parseBench, parseRoom } from './schema';
import { DEFAULT_CATEGORIES, newBench, newRoom, splitMinutes } from './template';

describe('splitMinutes', () => {
  it('splits to the half minute and puts the remainder on the last act', () => {
    expect(splitMinutes(25, 3)).toEqual([8, 8, 9]);
    expect(splitMinutes(10, 4)).toEqual([2.5, 2.5, 2.5, 2.5]);
    expect(splitMinutes(7, 2)).toEqual([3.5, 3.5]);
    expect(splitMinutes(45, 1)).toEqual([45]);
  });

  it('never goes under half a minute', () => {
    expect(splitMinutes(1, 3)).toEqual([0.5, 0.5, 0.5]);
    expect(splitMinutes(1.2, 2)).toEqual([0.5, 0.7]);
  });
});

describe('newBench', () => {
  it('is a valid, empty bench with three timed acts and the default categories', () => {
    const bench = newBench(25);
    expect(parseBench(bench)).toMatchObject({ ok: true });
    expect(bench.target).toBe(25);
    expect(bench.acts.map((a) => [a.id, a.minutes, a.title, a.slides])).toEqual([
      ['a1', 8, '', ''],
      ['a2', 8, '', ''],
      ['a3', 9, '', ''],
    ]);
    expect(bench.acts.every((a) => a.pool.length === 0 && a.run.length === 0)).toBe(true);
    expect(bench.categories).toEqual(DEFAULT_CATEGORIES);
    expect(bench.categories[0]).not.toBe(DEFAULT_CATEGORIES[0]);
    expect(bench.milestones).toEqual([]);
    expect(bench.backstage).toEqual([]);
    expect(bench.notes).toEqual([]);
    expect(bench.hook).toEqual({
      selected: 'anecdote',
      texts: { anecdote: '', statement: '', metaphor: '', quote: '', question: '' },
    });
    expect(bench.who).toEqual({ room: '', know: '', expect: '' });
    expect(bench.why).toEqual({
      speakerGoal: '',
      promise: '',
      throughline: '',
      tfd: {
        think: { now: '', after: '' },
        feel: { now: '', after: '' },
        do: { now: '', after: '' },
      },
    });
  });
});

describe('newRoom', () => {
  it('is a valid room with one group and no articles', () => {
    const room = newRoom();
    expect(parseRoom(room)).toMatchObject({ ok: true });
    expect(room.groups).toHaveLength(1);
    expect(room.groups[0].id).toBe('sources');
    expect(room.articles).toEqual([]);
  });
});
