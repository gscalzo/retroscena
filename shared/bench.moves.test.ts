import { describe, expect, it } from 'vitest';
import {
  addNote,
  cycleType,
  deleteNote,
  homeOf,
  moveToBackstage,
  moveToPool,
  moveToRun,
  newNoteId,
  removeEverywhere,
  updateNote,
} from './bench';
import { act, bench, note } from './fixtures.test';
import { parseBench } from './schema';
import type { Bench } from './types';

const runOf = (b: Bench, i: number) => b.acts[i].run;
const poolOf = (b: Bench, i: number) => b.acts[i].pool;

describe('homeOf', () => {
  it('finds a note on a pool, a run, backstage, or nowhere', () => {
    const b = bench();
    expect(homeOf(b, 'n1')).toEqual({ zone: 'pool', act: 0 });
    expect(homeOf(b, 'n3')).toEqual({ zone: 'run', act: 0 });
    expect(homeOf(b, 'n4')).toEqual({ zone: 'run', act: 1 });
    expect(homeOf(b, 'n5')).toEqual({ zone: 'backstage' });
    expect(homeOf(b, 'ghost')).toBeNull();
  });
});

describe('removeEverywhere', () => {
  it('lifts a note out of every zone and leaves the input alone', () => {
    const before = bench();
    const after = removeEverywhere(before, 'n2');
    expect(runOf(after, 0)).toEqual(['n3']);
    expect(poolOf(after, 0)).toEqual(['n1']);
    expect(runOf(before, 0)).toEqual(['n2', 'n3']);
    expect(removeEverywhere(before, 'n5').backstage).toEqual([]);
    expect(removeEverywhere(before, 'n1').acts[0].pool).toEqual([]);
    expect(after.notes).toHaveLength(5);
  });
});

describe('moveToPool and moveToBackstage', () => {
  it('appends to the target and clears the old home', () => {
    const b = bench();
    const pooled = moveToPool(b, 'n4', 0);
    expect(poolOf(pooled, 0)).toEqual(['n1', 'n4']);
    expect(runOf(pooled, 1)).toEqual([]);
    const backstaged = moveToBackstage(pooled, 'n1');
    expect(backstaged.backstage).toEqual(['n5', 'n1']);
    expect(poolOf(backstaged, 0)).toEqual(['n4']);
    expect(moveToPool(b, 'n1', 0).acts[0].pool).toEqual(['n1']);
  });
});

describe('moveToRun', () => {
  it('appends when the index is null, negative or past the end', () => {
    const b = bench();
    expect(runOf(moveToRun(b, 'n5', 0, null), 0)).toEqual(['n2', 'n3', 'n5']);
    expect(runOf(moveToRun(b, 'n5', 0, -1), 0)).toEqual(['n2', 'n3', 'n5']);
    expect(runOf(moveToRun(b, 'n5', 0, 2), 0)).toEqual(['n2', 'n3', 'n5']);
    expect(runOf(moveToRun(b, 'n5', 0, 99), 0)).toEqual(['n2', 'n3', 'n5']);
    expect(moveToRun(b, 'n5', 0, null).backstage).toEqual([]);
  });

  it('inserts at the index when the note comes from elsewhere', () => {
    const b = bench();
    expect(runOf(moveToRun(b, 'n5', 0, 0), 0)).toEqual(['n5', 'n2', 'n3']);
    expect(runOf(moveToRun(b, 'n5', 0, 1), 0)).toEqual(['n2', 'n5', 'n3']);
    const across = moveToRun(b, 'n4', 0, 1);
    expect(runOf(across, 0)).toEqual(['n2', 'n4', 'n3']);
    expect(runOf(across, 1)).toEqual([]);
    expect(runOf(moveToRun(b, 'n1', 1, 0), 1)).toEqual(['n1', 'n4']);
  });

  it('reorders within its own run, counting the slot it vacates', () => {
    const b = bench({
      acts: [act('a1', 4, { run: ['x', 'y', 'z'] })],
      backstage: [],
      notes: [note('x'), note('y'), note('z')],
    });
    expect(runOf(moveToRun(b, 'x', 0, 2), 0)).toEqual(['y', 'x', 'z']);
    expect(runOf(moveToRun(b, 'x', 0, 3), 0)).toEqual(['y', 'z', 'x']);
    expect(runOf(moveToRun(b, 'z', 0, 0), 0)).toEqual(['z', 'x', 'y']);
    expect(runOf(moveToRun(b, 'z', 0, 1), 0)).toEqual(['x', 'z', 'y']);
    expect(runOf(moveToRun(b, 'y', 0, 1), 0)).toEqual(['x', 'y', 'z']);
    expect(runOf(moveToRun(b, 'y', 0, 2), 0)).toEqual(['x', 'y', 'z']);
    expect(runOf(moveToRun(b, 'x', 0, 0), 0)).toEqual(['x', 'y', 'z']);
    expect(runOf(moveToRun(b, 'x', 0, 1), 0)).toEqual(['x', 'y', 'z']);
  });
});

describe('addNote', () => {
  it('creates an empty note of the first category and places it', () => {
    const b = bench();
    const inPool = addNote(b, { zone: 'pool', act: 1 }, 'c1');
    expect(inPool.notes.at(-1)).toEqual({
      id: 'c1',
      type: 'story',
      text: '',
      more: '',
      star: false,
      x3: false,
      retired: false,
    });
    expect(poolOf(inPool, 1)).toEqual(['c1']);
    expect(parseBench(inPool)).toMatchObject({ ok: true });
    const onRun = addNote(b, { zone: 'run', act: 0 }, 'c2', 'humor');
    expect(runOf(onRun, 0)).toEqual(['n2', 'n3', 'c2']);
    expect(onRun.notes.at(-1)).toMatchObject({ id: 'c2', type: 'humor' });
    const backstage = addNote(b, { zone: 'backstage' }, 'c3');
    expect(backstage.backstage).toEqual(['n5', 'c3']);
    expect(b.notes).toHaveLength(5);
  });

  it('names a new note after the clock', () => {
    expect(newNoteId(1_700_000_000_123)).toBe('c1700000000123');
  });
});

describe('deleteNote', () => {
  it('removes the note, its placement and any milestone on it', () => {
    const b = bench({
      milestones: [
        { id: 'n3', label: 'turn', by: 2 },
        { id: 'n4', label: 'close', by: 8 },
      ],
    });
    const after = deleteNote(b, 'n3');
    expect(after.notes.map((n) => n.id)).toEqual(['n1', 'n2', 'n4', 'n5']);
    expect(runOf(after, 0)).toEqual(['n2']);
    expect(after.milestones).toEqual([{ id: 'n4', label: 'close', by: 8 }]);
    expect(parseBench(after)).toMatchObject({ ok: true });
    expect(deleteNote(b, 'n5').backstage).toEqual([]);
  });
});

describe('updateNote', () => {
  it('patches one note and leaves the others as they were', () => {
    const b = bench();
    const after = updateNote(b, 'n2', { text: 'new', star: true, retired: true });
    expect(after.notes[1]).toEqual({ ...b.notes[1], text: 'new', star: true, retired: true });
    expect(after.notes[0]).toBe(b.notes[0]);
    expect(after.notes[2]).toBe(b.notes[2]);
    expect(b.notes[1].text).toBe('text n2');
  });
});

describe('cycleType', () => {
  it('walks the categories in order and wraps around', () => {
    let b = bench();
    const types = () => b.notes[0].type;
    expect(types()).toBe('story');
    b = cycleType(b, 'n1');
    expect(types()).toBe('evidence');
    b = cycleType(b, 'n1');
    expect(types()).toBe('practice');
    b = cycleType(b, 'n1');
    expect(types()).toBe('humor');
    b = cycleType(b, 'n1');
    expect(types()).toBe('story');
    expect(b.notes[1].type).toBe('evidence');
  });

  it('starts from the first category for a stale type and does nothing for a stale id', () => {
    const b = bench({
      notes: [note('n1', { type: 'gone' }), note('n2'), note('n3'), note('n4'), note('n5')],
    });
    expect(cycleType(b, 'n1').notes[0].type).toBe('story');
    expect(cycleType(b, 'ghost')).toBe(b);
  });
});
