/** What a new presentation starts from (ADR-0002). */
import type { Bench, Category, Room } from './types';

export const DEFAULT_CATEGORIES: readonly Category[] = [
  { id: 'story', label: 'Story', swatch: 'yellow' },
  { id: 'evidence', label: 'Evidence', swatch: 'blue' },
  { id: 'practice', label: 'Practice', swatch: 'green' },
  { id: 'humor', label: 'Humor', swatch: 'violet' },
];

const DEFAULT_ACTS = 3;

/** Split the slot evenly over the acts, to the half minute, the remainder on the last. */
export function splitMinutes(target: number, acts: number): number[] {
  const each = Math.max(0.5, Math.floor((target / acts) * 2) / 2);
  const out = Array.from({ length: acts }, () => each);
  out[acts - 1] = Math.max(0.5, target - each * (acts - 1));
  return out;
}

export function newBench(target: number): Bench {
  const minutes = splitMinutes(target, DEFAULT_ACTS);
  return {
    who: { room: '', know: '', expect: '' },
    why: {
      speakerGoal: '',
      promise: '',
      throughline: '',
      tfd: {
        think: { now: '', after: '' },
        feel: { now: '', after: '' },
        do: { now: '', after: '' },
      },
    },
    hook: {
      selected: 'anecdote',
      texts: { anecdote: '', statement: '', metaphor: '', quote: '', question: '' },
    },
    target,
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    milestones: [],
    acts: minutes.map((m, i) => ({
      id: `a${i + 1}`,
      title: '',
      slides: '',
      minutes: m,
      pool: [],
      run: [],
    })),
    backstage: [],
    notes: [],
  };
}

export function newRoom(): Room {
  return {
    groups: [{ id: 'sources', title: 'Sources', sub: 'What the talk stands on.' }],
    articles: [],
  };
}
