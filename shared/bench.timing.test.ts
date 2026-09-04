import { describe, expect, it } from 'vitest';
import {
  ACT_MAX_MINUTES,
  ACT_MIN_MINUTES,
  ACT_STEP_MINUTES,
  actStart,
  categoryOf,
  crowded,
  detailIds,
  estTime,
  milestoneStatus,
  noteById,
  noteMatches,
  setActMinutes,
  setActTitle,
  setTarget,
  totalMinutes,
} from './bench';
import { act, bench, note } from './fixtures.test';
import { TARGET_MAX, TARGET_MIN } from './schema';

describe('noteById and categoryOf', () => {
  it('looks a note up, and a category with the first as fallback', () => {
    const b = bench();
    expect(noteById(b, 'n2')?.type).toBe('evidence');
    expect(noteById(b, 'ghost')).toBeNull();
    expect(categoryOf(b, b.notes[1])).toEqual({
      id: 'evidence',
      label: 'Evidence',
      swatch: 'blue',
    });
    expect(categoryOf(b, note('x', { type: 'gone' }))).toEqual(b.categories[0]);
  });
});

describe('timing', () => {
  it('sums the acts and knows where each starts', () => {
    const b = bench();
    expect(totalMinutes(b)).toBe(10);
    expect(actStart(b, 0)).toBe(0);
    expect(actStart(b, 1)).toBe(4);
    expect(actStart(b, 2)).toBe(10);
    expect(totalMinutes(bench({ acts: [] }))).toBe(0);
  });

  it('estimates a beat by its share of the act, after the acts before it', () => {
    const b = bench({
      acts: [act('a1', 4, { run: ['n2', 'n3'] }), act('a2', 6, { run: ['n4', 'n5'] })],
      backstage: ['n1'],
    });
    expect(estTime(b, 'n2')).toBe(0);
    expect(estTime(b, 'n3')).toBe(2);
    expect(estTime(b, 'n4')).toBe(4);
    expect(estTime(b, 'n5')).toBe(7);
    expect(estTime(b, 'n1')).toBeNull();
    expect(estTime(b, 'ghost')).toBeNull();
  });

  it('flags a run with more than two beats a minute', () => {
    expect(crowded(act('a', 1.5, { run: ['a', 'b', 'c'] }))).toBe(false);
    expect(crowded(act('a', 1.5, { run: ['a', 'b', 'c', 'd'] }))).toBe(true);
    expect(crowded(act('a', 1, { run: ['a', 'b'] }))).toBe(false);
    expect(crowded(act('a', 1, { run: ['a', 'b', 'c'] }))).toBe(true);
    expect(crowded(act('a', 0.5, { run: [] }))).toBe(false);
  });
});

describe('milestoneStatus', () => {
  it('reports on time, late and off the run', () => {
    const b = bench({
      acts: [act('a1', 4, { run: ['n2', 'n3'] }), act('a2', 6, { run: ['n4', 'n5'] })],
      backstage: ['n1'],
      milestones: [
        { id: 'n3', label: 'early', by: 3 },
        { id: 'n4', label: 'exact', by: 4 },
        { id: 'n5', label: 'late', by: 6 },
        { id: 'n1', label: 'off', by: 1 },
      ],
    });
    expect(milestoneStatus(b)).toEqual([
      { label: 'early', by: 3, at: 2, late: false },
      { label: 'exact', by: 4, at: 4, late: false },
      { label: 'late', by: 6, at: 7, late: true },
      { label: 'off', by: 1, at: null, late: true },
    ]);
    expect(milestoneStatus(bench())).toEqual([]);
  });
});

describe('setters', () => {
  it('clamps the target to the schema bounds', () => {
    const b = bench();
    expect(setTarget(b, 30).target).toBe(30);
    expect(setTarget(b, TARGET_MIN).target).toBe(TARGET_MIN);
    expect(setTarget(b, TARGET_MIN - 1).target).toBe(TARGET_MIN);
    expect(setTarget(b, TARGET_MAX).target).toBe(TARGET_MAX);
    expect(setTarget(b, TARGET_MAX + 1).target).toBe(TARGET_MAX);
    expect(b.target).toBe(10);
  });

  it('clamps an act between half a minute and an hour, touching only that act', () => {
    const b = bench();
    expect(ACT_STEP_MINUTES).toBe(0.5);
    expect(setActMinutes(b, 1, 7.5).acts[1].minutes).toBe(7.5);
    expect(setActMinutes(b, 1, 7.5).acts[0]).toBe(b.acts[0]);
    expect(setActMinutes(b, 0, 0).acts[0].minutes).toBe(ACT_MIN_MINUTES);
    expect(setActMinutes(b, 0, ACT_MIN_MINUTES).acts[0].minutes).toBe(ACT_MIN_MINUTES);
    expect(setActMinutes(b, 0, ACT_MAX_MINUTES).acts[0].minutes).toBe(ACT_MAX_MINUTES);
    expect(setActMinutes(b, 0, ACT_MAX_MINUTES + 1).acts[0].minutes).toBe(ACT_MAX_MINUTES);
    expect(b.acts[0].minutes).toBe(4);
  });

  it('retitles one act', () => {
    const b = bench();
    const after = setActTitle(b, 1, 'The turn');
    expect(after.acts[1].title).toBe('The turn');
    expect(after.acts[1].run).toEqual(['n4']);
    expect(after.acts[0]).toBe(b.acts[0]);
  });
});

describe('filters', () => {
  it('matches on category and on a lower-cased search', () => {
    const n = note('n', { type: 'evidence', text: 'The Anthropic RCT' });
    expect(noteMatches(n, { types: [], q: '' })).toBe(true);
    expect(noteMatches(n, { types: ['evidence', 'story'], q: '' })).toBe(true);
    expect(noteMatches(n, { types: ['story'], q: '' })).toBe(false);
    expect(noteMatches(n, { types: [], q: 'anthropic' })).toBe(true);
    expect(noteMatches(n, { types: [], q: 'casner' })).toBe(false);
    expect(noteMatches(n, { types: ['evidence'], q: 'rct' })).toBe(true);
    expect(noteMatches(n, { types: ['evidence'], q: 'nope' })).toBe(false);
    expect(noteMatches(n, { types: ['story'], q: 'rct' })).toBe(false);
  });

  it('lists the notes that carry a long form', () => {
    const b = bench({
      notes: [
        note('n1', { more: 'x' }),
        note('n2', { more: '  ' }),
        note('n3'),
        note('n4', { more: '\ny\n' }),
        note('n5'),
      ],
    });
    expect(detailIds(b)).toEqual(['n1', 'n4']);
    expect(detailIds(bench())).toEqual([]);
  });
});
