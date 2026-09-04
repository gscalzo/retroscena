/**
 * Runtime validation of what the API accepts (ADR-0003). A document is
 * stored whole, so the Worker checks its shape and its internal references
 * before every write; the CLI runs the same check before a put.
 */
import { z } from 'zod';
import { DOC_KINDS, HOOK_KEYS, SWATCHES } from './types';
import type { Bench, CreateReq, DocKind, Room, UpdateReq } from './types';

const text = z.string();
const id = z.string().min(1);
const pair = z.object({ now: text, after: text });

export const TARGET_MIN = 1;
export const TARGET_MAX = 300;
const target = z.number().min(TARGET_MIN).max(TARGET_MAX);

const noteSchema = z.object({
  id,
  type: id,
  text,
  more: text,
  star: z.boolean(),
  x3: z.boolean(),
  retired: z.boolean(),
});

const actSchema = z.object({
  id,
  title: text,
  slides: text,
  minutes: z.number().min(0).max(600),
  pool: z.array(id),
  run: z.array(id),
});

/** Every id placed on the bench, in order; duplicates included so they can be reported. */
function placements(bench: Bench): string[] {
  return [...bench.acts.flatMap((a) => [...a.pool, ...a.run]), ...bench.backstage];
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const value of ids) {
    if (seen.has(value)) out.add(value);
    seen.add(value);
  }
  return [...out];
}

type Issue = (message: string) => void;

function checkIds(bench: Bench, issue: Issue): void {
  for (const d of duplicates(bench.notes.map((n) => n.id))) issue(`duplicate note id "${d}"`);
  for (const d of duplicates(bench.acts.map((a) => a.id))) issue(`duplicate act id "${d}"`);
  for (const d of duplicates(bench.categories.map((c) => c.id))) {
    issue(`duplicate category id "${d}"`);
  }
}

function checkCategories(bench: Bench, issue: Issue): void {
  const categories = new Set(bench.categories.map((c) => c.id));
  for (const n of bench.notes) {
    if (!categories.has(n.type)) issue(`note "${n.id}" has unknown category "${n.type}"`);
  }
}

function checkPlacements(bench: Bench, issue: Issue): void {
  const notes = new Set(bench.notes.map((n) => n.id));
  const placed = placements(bench);
  for (const p of placed) if (!notes.has(p)) issue(`placed id "${p}" is not a note`);
  for (const d of duplicates(placed)) issue(`note "${d}" is placed twice`);
  const placedSet = new Set(placed);
  for (const n of notes) if (!placedSet.has(n)) issue(`note "${n}" is not placed anywhere`);
}

function checkMilestones(bench: Bench, issue: Issue): void {
  const notes = new Set(bench.notes.map((n) => n.id));
  for (const m of bench.milestones) {
    if (!notes.has(m.id)) issue(`milestone "${m.label}" points at unknown note "${m.id}"`);
  }
}

function checkBench(bench: Bench, ctx: z.RefinementCtx): void {
  const issue: Issue = (message) => ctx.addIssue({ code: 'custom', message });
  checkIds(bench, issue);
  checkCategories(bench, issue);
  checkPlacements(bench, issue);
  checkMilestones(bench, issue);
}

export const benchSchema = z
  .object({
    who: z.object({ room: text, know: text, expect: text }),
    why: z.object({
      speakerGoal: text,
      promise: text,
      throughline: text,
      tfd: z.object({ think: pair, feel: pair, do: pair }),
    }),
    hook: z.object({
      selected: z.enum(HOOK_KEYS),
      texts: z.object({
        anecdote: text,
        statement: text,
        metaphor: text,
        quote: text,
        question: text,
      }),
    }),
    target,
    categories: z.array(z.object({ id, label: text, swatch: z.enum(SWATCHES) })).min(1),
    milestones: z.array(z.object({ id, label: text, by: z.number().min(0) })),
    acts: z.array(actSchema),
    backstage: z.array(id),
    notes: z.array(noteSchema),
  })
  .superRefine((value, ctx) => checkBench(value, ctx));

const marginNote = z.object({ t: text, d: text });

const articleSchema = z.object({
  id,
  group: id,
  title: text,
  author: text,
  src: text,
  date: text,
  url: text.nullable(),
  cap: text,
  blurb: text,
  body: text,
  words: z.number().min(0),
  read: z.boolean(),
  readDate: text.nullable(),
  notes: z.array(marginNote),
});

function checkRoom(room: Room, ctx: z.RefinementCtx): void {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const groups = room.groups.map((g) => g.id);
  for (const d of duplicates(groups)) issue(`duplicate group id "${d}"`);
  for (const d of duplicates(room.articles.map((a) => a.id))) issue(`duplicate article id "${d}"`);
  const known = new Set(groups);
  for (const a of room.articles) {
    if (!known.has(a.group)) issue(`article "${a.id}" is in unknown group "${a.group}"`);
  }
}

export const roomSchema = z
  .object({
    groups: z.array(z.object({ id, title: text, sub: text })),
    articles: z.array(articleSchema),
  })
  .superRefine((value, ctx) => checkRoom(value, ctx));

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'a date is yyyy-mm-dd');
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'a slug is lowercase words joined by -');

const createSchema = z.object({
  title: z.string().trim().min(1),
  event: z.string().trim(),
  date: isoDay.nullable(),
  target,
  slug: slug.optional(),
});

const updateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    event: z.string().trim().optional(),
    date: isoDay.nullable().optional(),
    target: target.optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue.path.map(String).join('.');
  return path === '' ? issue.message : `${path}: ${issue.message}`;
}

function parseWith<T>(schema: z.ZodType<T>, value: unknown): Parsed<T> {
  const result = schema.safeParse(value);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: firstIssue(result.error) };
}

export function parseBench(value: unknown): Parsed<Bench> {
  return parseWith(benchSchema as unknown as z.ZodType<Bench>, value);
}

export function parseRoom(value: unknown): Parsed<Room> {
  return parseWith(roomSchema as unknown as z.ZodType<Room>, value);
}

export function parseDoc(kind: DocKind, value: unknown): Parsed<Bench | Room> {
  return kind === 'bench' ? parseBench(value) : parseRoom(value);
}

export function parseCreate(value: unknown): Parsed<CreateReq> {
  return parseWith(createSchema as unknown as z.ZodType<CreateReq>, value);
}

export function parseUpdate(value: unknown): Parsed<UpdateReq> {
  return parseWith(updateSchema as unknown as z.ZodType<UpdateReq>, value);
}

export function isDocKind(value: string): value is DocKind {
  return (DOC_KINDS as readonly string[]).includes(value);
}
