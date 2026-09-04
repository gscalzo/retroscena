/**
 * The three claude.ai artifacts Retroscena replaces (ADR-0010), read from
 * their saved HTML: the state lives in <script type="application/json">
 * blocks. Two workbench generations existed; both become a bench. The
 * reading room's content and its read state become one room document.
 */
import type { Act, Article, Bench, Category, Milestone, Note, Room, Swatch } from './types';

/** The JSON block with that id, parsed, or null when absent or broken. */
export function extractJson(html: string, id: string): unknown {
  const re = new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`);
  const m = re.exec(html);
  return m === null ? null : parseJson(m[1]);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** The workbench hardcoded its milestones in the script: `{id:'s4a',label:'fix one',by:12}`. */
export function extractMilestones(html: string): Milestone[] {
  const block = /var MILESTONES=\[([\s\S]*?)\];/.exec(html);
  if (!block) return [];
  const out: Milestone[] = [];
  const entry = /\{id:'([^']+)',label:'([^']+)',by:(\d+(?:\.\d+)?)\}/g;
  for (let m = entry.exec(block[1]); m !== null; m = entry.exec(block[1])) {
    out.push({ id: m[1], label: m[2], by: Number(m[3]) });
  }
  return out;
}

const V2_SWATCHES: Record<string, Swatch> = {
  story: 'yellow',
  evidence: 'blue',
  practice: 'green',
  humor: 'violet',
};

const V1_SWATCHES: Record<string, Swatch> = {
  story: 'yellow',
  machine: 'orange',
  evidence: 'blue',
  person: 'pink',
  practice: 'green',
  humor: 'violet',
  star: 'teal',
};

function label(id: string): string {
  return id === 'star' ? 'STAR' : id.charAt(0).toUpperCase() + id.slice(1);
}

function categories(swatches: Record<string, Swatch>): Category[] {
  return Object.entries(swatches).map(([id, swatch]) => ({ id, label: label(id), swatch }));
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown, fallback: number): number => (typeof v === 'number' ? v : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};

function pair(v: unknown) {
  const o = obj(v);
  return { now: str(o.now), after: str(o.after) };
}

/** The who / why / hook block both workbench generations share. */
function head(state: Record<string, unknown>): Pick<Bench, 'who' | 'why' | 'hook'> {
  const who = obj(state.who);
  const why = obj(state.why);
  const tfd = obj(why.tfd);
  const hook = obj(state.hook);
  const texts = obj(hook.texts);
  const selected = str(hook.selected);
  return {
    who: { room: str(who.room), know: str(who.know), expect: str(who.expect) },
    why: {
      speakerGoal: str(why.speakerGoal),
      promise: str(why.promise),
      throughline: str(why.throughline),
      tfd: { think: pair(tfd.think), feel: pair(tfd.feel), do: pair(tfd.do) },
    },
    hook: {
      selected: isHookKey(selected) ? selected : 'anecdote',
      texts: {
        anecdote: str(texts.anecdote),
        statement: str(texts.statement),
        metaphor: str(texts.metaphor),
        quote: str(texts.quote),
        question: str(texts.question),
      },
    },
  };
}

function isHookKey(v: string): v is Bench['hook']['selected'] {
  return ['anecdote', 'statement', 'metaphor', 'quote', 'question'].includes(v);
}

function ids(v: unknown, known: Set<string>, seen: Set<string>): string[] {
  const out: string[] = [];
  for (const raw of arr(v)) {
    const id = str(raw);
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Whatever is placed nowhere goes backstage, as the workbench itself did. */
function complete(bench: Bench, seen: Set<string>): Bench {
  const missing = bench.notes.filter((n) => !seen.has(n.id)).map((n) => n.id);
  return { ...bench, backstage: [...bench.backstage, ...missing] };
}

function noteFrom(raw: unknown, type: string, retired: boolean): Note {
  const o = obj(raw);
  return {
    id: str(o.id),
    type,
    text: str(o.text),
    more: str(o.more),
    star: o.star === true,
    x3: o.x3 === true,
    retired,
  };
}

/** Schema 2: acts with a pool and a run, a backstage, notes with star / x3 / more. */
export function fromWorkbenchV2(state: unknown, milestones: Milestone[]): Bench {
  const s = obj(state);
  const cats = categories(V2_SWATCHES);
  const notes = arr(s.notes)
    .map((raw) =>
      noteFrom(
        raw,
        cats.some((c) => c.id === str(obj(raw).type)) ? str(obj(raw).type) : 'story',
        false,
      ),
    )
    .filter((n) => n.id !== '');
  const known = new Set(notes.map((n) => n.id));
  const seen = new Set<string>();
  const acts: Act[] = arr(s.acts).map((raw, i) => {
    const a = obj(raw);
    return {
      id: str(a.id) || `a${i + 1}`,
      title: str(a.title),
      slides: str(a.slides),
      minutes: num(a.minutes, 4),
      pool: ids(a.pool, known, seen),
      run: ids(a.run, known, seen),
    };
  });
  const bench: Bench = {
    ...head(s),
    target: num(s.target, 25),
    categories: cats,
    milestones: milestones.filter((m) => known.has(m.id)),
    acts,
    backstage: ids(s.backstage, known, seen),
    notes,
  };
  return complete(bench, seen);
}

interface V1Section {
  id: string;
  title: string;
  minutes: number;
  items: unknown;
}

function v1Sections(structure: Record<string, unknown>): V1Section[] {
  const section = (id: string, raw: unknown, fallbackMinutes: number): V1Section => {
    const o = obj(raw);
    return { id, title: str(o.title), minutes: num(o.minutes, fallbackMinutes), items: o.items };
  };
  const body = arr(structure.body).map((raw, i) => section(`b${i + 1}`, raw, 5));
  return [
    section('hook', structure.hook, 1),
    section('intro', structure.intro, 2),
    ...body,
    section('outro', structure.outro, 3),
  ];
}

/**
 * The first workbench: a board of notes with a pile / kept / cut status and
 * a hook / intro / body / outro structure. Sections become acts; a placed
 * note joins its section's run; everything else goes backstage, a cut note
 * as retired.
 */
export function fromWorkbenchV1(state: unknown): Bench {
  const s = obj(state);
  const structure = obj(s.structure);
  const cats = categories(V1_SWATCHES);
  const notes = arr(s.notes)
    .map((raw) => {
      const o = obj(raw);
      const cat = str(o.cat);
      return noteFrom(raw, cat in V1_SWATCHES ? cat : 'story', o.status === 'cut');
    })
    .filter((n) => n.id !== '');
  const known = new Set(notes.map((n) => n.id));
  const seen = new Set<string>();
  const acts: Act[] = v1Sections(structure).map((sec) => ({
    id: sec.id,
    title: sec.title,
    slides: '',
    minutes: sec.minutes,
    pool: [],
    run: ids(sec.items, known, seen),
  }));
  const bench: Bench = {
    ...head(s),
    target: num(structure.target, 45),
    categories: cats,
    milestones: [],
    acts,
    backstage: [],
    notes,
  };
  return complete(bench, seen);
}

/** The reading room's content block plus its state block, merged per article. */
export function fromReadingRoom(content: unknown, state: unknown): Room {
  const c = obj(content);
  const items = obj(obj(state).items);
  const groups = arr(c.groups).map((raw) => {
    const g = obj(raw);
    return { id: str(g.id), title: str(g.title), sub: str(g.sub) };
  });
  const articles: Article[] = arr(c.articles).map((raw) => {
    const a = obj(raw);
    const id = str(a.id);
    const it = obj(items[id]);
    const url = str(a.url);
    return {
      id,
      group: str(a.group),
      title: str(a.title),
      author: str(a.author),
      src: str(a.src),
      date: str(a.date),
      url: url === '' ? null : url,
      cap: str(a.cap),
      blurb: str(a.blurb),
      body: str(a.body),
      words: num(a.words, 0),
      read: it.read === true,
      readDate: it.read === true && typeof it.readDate === 'string' ? it.readDate : null,
      notes: arr(it.notes).map((n) => ({ t: str(obj(n).t), d: str(obj(n).d) })),
    };
  });
  const known = new Set(articles.map((article) => article.id));
  const unmatched = Object.keys(items).filter((id) => !known.has(id));
  if (unmatched.length > 0) {
    throw new Error(
      `Reading-room state has no matching article: ${unmatched.join(', ')}. Restore the missing content before migrating.`,
    );
  }
  return { groups, articles };
}

export type Converted = { kind: 'bench'; doc: Bench } | { kind: 'room'; doc: Room };

/** Tell the three artifact shapes apart and convert; null when it is none of them. */
export function convertArtifact(html: string): Converted | null {
  const state = extractJson(html, 'state-json');
  if (state === null) return null;
  const content = extractJson(html, 'content-json');
  if (content !== null) return { kind: 'room', doc: fromReadingRoom(content, state) };
  const s = obj(state);
  if (Array.isArray(s.acts))
    return { kind: 'bench', doc: fromWorkbenchV2(state, extractMilestones(html)) };
  if (typeof s.structure === 'object' && s.structure !== null) {
    return { kind: 'bench', doc: fromWorkbenchV1(state) };
  }
  return null;
}
