/**
 * The pure rules of a bench (ADR-0002): timing, placement and the moves the
 * site and the CLI make. Every operation returns a new bench and leaves its
 * input untouched, so the UI can diff and history can hold whole revisions.
 */
import { TARGET_MAX, TARGET_MIN } from './schema';
import type { Act, Bench, Category, Note } from './types';

export const ACT_MIN_MINUTES = 0.5;
export const ACT_MAX_MINUTES = 60;
export const ACT_STEP_MINUTES = 0.5;

export function noteById(bench: Bench, id: string): Note | null {
  return bench.notes.find((n) => n.id === id) ?? null;
}

/** The category a note is in, or the bench's first one when the id is stale. */
export function categoryOf(bench: Bench, note: Note): Category {
  return bench.categories.find((c) => c.id === note.type) ?? bench.categories[0];
}

export function totalMinutes(bench: Bench): number {
  return bench.acts.reduce((sum, a) => sum + a.minutes, 0);
}

/** Minutes into the talk at which act `index` begins. */
export function actStart(bench: Bench, index: number): number {
  return bench.acts.slice(0, index).reduce((sum, a) => sum + a.minutes, 0);
}

/** Where in the run a beat lands, in minutes, or null when it is not on the run. */
export function estTime(bench: Bench, id: string): number | null {
  for (const [i, act] of bench.acts.entries()) {
    const ix = act.run.indexOf(id);
    if (ix > -1) return actStart(bench, i) + (ix / act.run.length) * act.minutes;
  }
  return null;
}

export type Home = { zone: 'pool' | 'run'; act: number } | { zone: 'backstage' } | null;

export function homeOf(bench: Bench, id: string): Home {
  for (const [i, act] of bench.acts.entries()) {
    if (act.pool.includes(id)) return { zone: 'pool', act: i };
    if (act.run.includes(id)) return { zone: 'run', act: i };
  }
  return bench.backstage.includes(id) ? { zone: 'backstage' } : null;
}

function without(ids: string[], id: string): string[] {
  return ids.filter((x) => x !== id);
}

export function removeEverywhere(bench: Bench, id: string): Bench {
  return {
    ...bench,
    acts: bench.acts.map((a) => ({ ...a, pool: without(a.pool, id), run: without(a.run, id) })),
    backstage: without(bench.backstage, id),
  };
}

function withAct(bench: Bench, index: number, update: (act: Act) => Act): Bench {
  return { ...bench, acts: bench.acts.map((a, i) => (i === index ? update(a) : a)) };
}

export function moveToPool(bench: Bench, id: string, act: number): Bench {
  return withAct(removeEverywhere(bench, id), act, (a) => ({ ...a, pool: [...a.pool, id] }));
}

export function moveToBackstage(bench: Bench, id: string): Bench {
  const cleared = removeEverywhere(bench, id);
  return { ...cleared, backstage: [...cleared.backstage, id] };
}

/**
 * Put a note on an act's run at `index` (end when null or out of range).
 * Moving a beat down its own run counts the slot it vacates.
 */
export function moveToRun(bench: Bench, id: string, act: number, index: number | null): Bench {
  const old = bench.acts[act].run.indexOf(id);
  const cleared = removeEverywhere(bench, id);
  return withAct(cleared, act, (a) => {
    const run = [...a.run];
    if (index === null || index < 0) return { ...a, run: [...run, id] };
    const at = old > -1 && old < index ? index - 1 : index;
    run.splice(Math.min(at, run.length), 0, id);
    return { ...a, run };
  });
}

export type Where = { zone: 'pool' | 'run'; act: number } | { zone: 'backstage' };

export function newNoteId(nowMs: number): string {
  return `c${nowMs}`;
}

export function addNote(bench: Bench, where: Where, id: string, type?: string): Bench {
  const note: Note = {
    id,
    type: type ?? bench.categories[0].id,
    text: '',
    more: '',
    star: false,
    x3: false,
    retired: false,
  };
  const withNote = { ...bench, notes: [...bench.notes, note] };
  if (where.zone === 'backstage') return moveToBackstage(withNote, id);
  return where.zone === 'pool'
    ? moveToPool(withNote, id, where.act)
    : moveToRun(withNote, id, where.act, null);
}

export function deleteNote(bench: Bench, id: string): Bench {
  const cleared = removeEverywhere(bench, id);
  return {
    ...cleared,
    notes: cleared.notes.filter((n) => n.id !== id),
    milestones: cleared.milestones.filter((m) => m.id !== id),
  };
}

export function updateNote(bench: Bench, id: string, patch: Partial<Omit<Note, 'id'>>): Bench {
  return { ...bench, notes: bench.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) };
}

/** The next category in the bench's order, wrapping around. */
export function cycleType(bench: Bench, id: string): Bench {
  const note = noteById(bench, id);
  if (!note) return bench;
  const ids = bench.categories.map((c) => c.id);
  const next = ids[(ids.indexOf(note.type) + 1) % ids.length];
  return updateNote(bench, id, { type: next });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function setTarget(bench: Bench, target: number): Bench {
  return { ...bench, target: clamp(target, TARGET_MIN, TARGET_MAX) };
}

export function setActMinutes(bench: Bench, act: number, minutes: number): Bench {
  const clamped = clamp(minutes, ACT_MIN_MINUTES, ACT_MAX_MINUTES);
  return withAct(bench, act, (a) => ({ ...a, minutes: clamped }));
}

export function setActTitle(bench: Bench, act: number, title: string): Bench {
  return withAct(bench, act, (a) => ({ ...a, title }));
}

/** More than two beats a minute is crowded. */
export function crowded(act: Act): boolean {
  return act.run.length > Math.ceil(act.minutes * 2);
}

export interface MilestoneStatus {
  label: string;
  by: number;
  /** Estimated minute of the beat, or null when it is off the run. */
  at: number | null;
  late: boolean;
}

export function milestoneStatus(bench: Bench): MilestoneStatus[] {
  return bench.milestones.map((m) => {
    const at = estTime(bench, m.id);
    return { label: m.label, by: m.by, at, late: at === null || at > m.by };
  });
}

export interface Filters {
  /** Category ids; empty means every category. */
  types: readonly string[];
  /** Lower-cased search, matched against the text. */
  q: string;
}

export function noteMatches(note: Note, filters: Filters): boolean {
  if (filters.types.length > 0 && !filters.types.includes(note.type)) return false;
  return note.text.toLowerCase().includes(filters.q);
}

/** Notes that carry a long form. */
export function detailIds(bench: Bench): string[] {
  return bench.notes.filter((n) => n.more.trim() !== '').map((n) => n.id);
}
