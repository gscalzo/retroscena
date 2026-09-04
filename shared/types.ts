/**
 * The contracts: what a presentation, a bench and a reading room are, and
 * the request/response shapes the Worker, the site and the CLI agree on.
 * Pure types; the runtime validation of a document is shared/schema.ts.
 */

export type DocKind = 'bench' | 'room';
export const DOC_KINDS: readonly DocKind[] = ['bench', 'room'];

export type HookKey = 'anecdote' | 'statement' | 'metaphor' | 'quote' | 'question';
export const HOOK_KEYS: readonly HookKey[] = [
  'anecdote',
  'statement',
  'metaphor',
  'quote',
  'question',
];

/** The fixed palette of sticky-note colours (ADR-0007); a category picks one. */
export type Swatch = 'yellow' | 'blue' | 'green' | 'violet' | 'orange' | 'pink' | 'teal';
export const SWATCHES: readonly Swatch[] = [
  'yellow',
  'blue',
  'green',
  'violet',
  'orange',
  'pink',
  'teal',
];

export interface Category {
  id: string;
  label: string;
  swatch: Swatch;
}

export interface Note {
  id: string;
  /** A category id of the bench. */
  type: string;
  text: string;
  /** The long form: source, numbers, caveats, the full version (shared/detail.ts markup). */
  more: string;
  /** The STAR moment. */
  star: boolean;
  /** A planted, repeated line. */
  x3: boolean;
  /** Out of the talk, kept for the record. */
  retired: boolean;
}

export interface Act {
  id: string;
  title: string;
  slides: string;
  minutes: number;
  /** Material that could serve this act, by note id. */
  pool: string[];
  /** What happens on stage, in order, by note id. */
  run: string[];
}

/** A beat that must have happened by a given minute of the run. */
export interface Milestone {
  /** The note id of the beat. */
  id: string;
  label: string;
  by: number;
}

interface Pair {
  now: string;
  after: string;
}

export interface Bench {
  who: { room: string; know: string; expect: string };
  why: {
    speakerGoal: string;
    promise: string;
    throughline: string;
    tfd: { think: Pair; feel: Pair; do: Pair };
  };
  hook: { selected: HookKey; texts: Record<HookKey, string> };
  target: number;
  categories: Category[];
  milestones: Milestone[];
  acts: Act[];
  backstage: string[];
  notes: Note[];
}

interface MarginNote {
  t: string;
  /** ISO date the note was written. */
  d: string;
}

interface Group {
  id: string;
  title: string;
  sub: string;
}

export interface Article {
  id: string;
  group: string;
  title: string;
  author: string;
  src: string;
  date: string;
  url: string | null;
  /** What was captured: "full capture", "abstract + restatement", … */
  cap: string;
  blurb: string;
  /** The capture itself, as HTML; empty when only the original is worth reading. */
  body: string;
  words: number;
  read: boolean;
  readDate: string | null;
  notes: MarginNote[];
}

export interface Room {
  groups: Group[];
  articles: Article[];
}

export interface Presentation {
  slug: string;
  title: string;
  event: string;
  /** ISO yyyy-mm-dd of the talk, or null. */
  date: string | null;
  /** The slot, in minutes. */
  target: number;
  createdAt: number;
  archivedAt: number | null;
}

export interface DocMeta {
  rev: number;
  /** 'owner' | 'agent:<token name>' | 'local' */
  author: string;
  at: number;
}

export interface DocEnvelope<T> extends DocMeta {
  doc: T;
}

export interface BenchSummary extends DocMeta {
  minutes: number;
  beats: number;
}

export interface RoomSummary extends DocMeta {
  read: number;
  total: number;
}

export interface PresentationSummary extends Presentation {
  bench: BenchSummary;
  room: RoomSummary;
}

export interface ListRes {
  presentations: PresentationSummary[];
}

export interface CreateReq {
  title: string;
  event: string;
  date: string | null;
  target: number;
  /** Optional; derived from the title when absent. */
  slug?: string;
}

export interface UpdateReq {
  title?: string;
  event?: string;
  date?: string | null;
  target?: number;
  archived?: boolean;
}

export interface PresentationRes {
  presentation: PresentationSummary;
}

export interface PutReq<T> {
  baseRev: number;
  doc: T;
}

export interface PutRes {
  rev: number;
  at: number;
}

export interface ConflictRes {
  error: string;
  current: DocMeta;
}

export interface HistoryEntry extends DocMeta {
  bytes: number;
}

export interface HistoryRes {
  history: HistoryEntry[];
}

export interface PingRes {
  ok: true;
  caller: 'local' | 'owner' | 'agent';
}
