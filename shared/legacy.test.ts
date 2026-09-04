import { describe, expect, it } from 'vitest';
import {
  convertArtifact,
  extractJson,
  extractMilestones,
  fromReadingRoom,
  fromWorkbenchV1,
  fromWorkbenchV2,
} from './legacy';
import { parseBench, parseRoom } from './schema';

const block = (id: string, json: string) =>
  `<script type="application/json" id="${id}">${json}</script>`;
const page = (...blocks: string[]) =>
  `<!doctype html><html><body>${blocks.join('\n')}<script id="app-js">var x=1;</script></body></html>`;

const head = {
  who: { room: 'Leaders', know: 'The crisis', expect: 'A Monday' },
  why: {
    speakerGoal: 'Own it',
    promise: 'Four exercises',
    throughline: 'Rebuild both',
    tfd: {
      think: { now: 'T1', after: 'T2' },
      feel: { now: 'F1', after: 'F2' },
      do: { now: 'D1', after: 'D2' },
    },
  },
  hook: {
    selected: 'statement',
    texts: { anecdote: 'A', statement: 'S', metaphor: 'M', quote: 'Q', question: '?' },
  },
};

describe('extractJson', () => {
  it('parses the block with that id and nothing else', () => {
    const html = page(block('content-json', '{"a":1}'), block('state-json', '{"b":[2]}'));
    expect(extractJson(html, 'state-json')).toEqual({ b: [2] });
    expect(extractJson(html, 'content-json')).toEqual({ a: 1 });
    expect(extractJson(html, 'other')).toBeNull();
    expect(extractJson(page(block('state-json', '{oops')), 'state-json')).toBeNull();
    expect(extractJson('<script id="state-json">{"a":1}</script>', 'state-json')).toBeNull();
  });
});

describe('extractMilestones', () => {
  it('reads the hardcoded MILESTONES array, decimals included', () => {
    const html = page(
      "<script id=\"app-js\">var MILESTONES=[\n  {id:'s4a',label:'fix one',by:12},\n  {id:'s5a',label:'STAR',by:17.5},{id:'s6a',label:'census',by:12.25}\n];var y=2;</script>",
    );
    expect(extractMilestones(html)).toEqual([
      { id: 's4a', label: 'fix one', by: 12 },
      { id: 's5a', label: 'STAR', by: 17.5 },
      { id: 's6a', label: 'census', by: 12.25 },
    ]);
    expect(extractMilestones(page())).toEqual([]);
    expect(extractMilestones("var MILESTONES=[{id:'a',label:'b'}];")).toEqual([]);
    expect(extractMilestones("var MILESTONES=[{id:'a',label:'b',by:x}];")).toEqual([]);
  });
});

describe('fromWorkbenchV2', () => {
  const state = {
    rev: 9,
    schema: 2,
    ...head,
    target: 25,
    acts: [
      {
        id: 'a1',
        title: 'The Quiet',
        slides: '1-5',
        minutes: 5,
        pool: ['p1'],
        run: ['r1', 'r2', 'ghost'],
      },
      { title: 'No id', pool: ['p1', 'dup', 'dup'], run: [] },
    ],
    backstage: ['b1', 'r1'],
    notes: [
      { id: 'p1', type: 'evidence', text: 'pooled', more: 'long', star: true, x3: false },
      { id: 'r1', type: 'story', text: 'first beat', x3: true },
      { id: 'r2', type: 'machine', text: 'odd type', star: 'yes' },
      { id: 'dup', type: 'humor', text: 'twice', more: 7 },
      { id: 'b1', type: 'practice', text: 'backstage' },
      { id: 'u1', type: 'story', text: 'unplaced' },
      { type: 'story', text: 'no id' },
    ],
  };

  it('keeps every note, its flags and its long form, and adds the retired flag', () => {
    const bench = fromWorkbenchV2(state, []);
    expect(parseBench(bench)).toMatchObject({ ok: true });
    expect(bench.notes).toEqual([
      {
        id: 'p1',
        type: 'evidence',
        text: 'pooled',
        more: 'long',
        star: true,
        x3: false,
        retired: false,
      },
      {
        id: 'r1',
        type: 'story',
        text: 'first beat',
        more: '',
        star: false,
        x3: true,
        retired: false,
      },
      {
        id: 'r2',
        type: 'story',
        text: 'odd type',
        more: '',
        star: false,
        x3: false,
        retired: false,
      },
      { id: 'dup', type: 'humor', text: 'twice', more: '', star: false, x3: false, retired: false },
      {
        id: 'b1',
        type: 'practice',
        text: 'backstage',
        more: '',
        star: false,
        x3: false,
        retired: false,
      },
      {
        id: 'u1',
        type: 'story',
        text: 'unplaced',
        more: '',
        star: false,
        x3: false,
        retired: false,
      },
    ]);
    expect(bench.categories.map((c) => [c.id, c.label, c.swatch])).toEqual([
      ['story', 'Story', 'yellow'],
      ['evidence', 'Evidence', 'blue'],
      ['practice', 'Practice', 'green'],
      ['humor', 'Humor', 'violet'],
    ]);
  });

  it('keeps the acts, dropping ghosts and repeats, and sends the unplaced backstage', () => {
    const bench = fromWorkbenchV2(state, []);
    expect(bench.acts).toEqual([
      { id: 'a1', title: 'The Quiet', slides: '1-5', minutes: 5, pool: ['p1'], run: ['r1', 'r2'] },
      { id: 'a2', title: 'No id', slides: '', minutes: 4, pool: ['dup'], run: [] },
    ]);
    expect(bench.backstage).toEqual(['b1', 'u1']);
    expect(bench.target).toBe(25);
    expect(bench.who).toEqual(head.who);
    expect(bench.why).toEqual(head.why);
    expect(bench.hook).toEqual(head.hook);
  });

  it('keeps only the milestones that point at a note', () => {
    const bench = fromWorkbenchV2(state, [
      { id: 'r2', label: 'turn', by: 3 },
      { id: 'nope', label: 'lost', by: 4 },
    ]);
    expect(bench.milestones).toEqual([{ id: 'r2', label: 'turn', by: 3 }]);
  });

  it('defaults everything that is missing or malformed', () => {
    const bench = fromWorkbenchV2(
      { hook: { selected: 'shout' }, why: { tfd: null }, notes: 'x', acts: 'y' },
      [],
    );
    expect(parseBench(bench)).toMatchObject({ ok: true });
    expect(bench.target).toBe(25);
    expect(bench.acts).toEqual([]);
    expect(bench.notes).toEqual([]);
    expect(bench.backstage).toEqual([]);
    expect(bench.hook).toEqual({
      selected: 'anecdote',
      texts: { anecdote: '', statement: '', metaphor: '', quote: '', question: '' },
    });
    expect(bench.who).toEqual({ room: '', know: '', expect: '' });
    expect(bench.why.tfd).toEqual({
      think: { now: '', after: '' },
      feel: { now: '', after: '' },
      do: { now: '', after: '' },
    });
    expect(fromWorkbenchV2(null, []).acts).toEqual([]);
    expect(fromWorkbenchV2({ ...head, hook: { selected: 'quote' } }, []).hook.selected).toBe(
      'quote',
    );
  });
});

describe('fromWorkbenchV1', () => {
  const state = {
    rev: 0,
    ...head,
    notes: [
      { id: 'n1', cat: 'story', status: 'pile', text: 'cold open' },
      { id: 'n2', cat: 'machine', status: 'kept', text: 'hook one' },
      { id: 'n3', cat: 'evidence', status: 'cut', text: 'dropped' },
      { id: 'n4', cat: 'weird', status: 'kept', text: 'odd' },
      { id: 'n5', cat: 'star', status: 'pile', text: 'carry line' },
      { id: '', cat: 'story', status: 'pile', text: 'no id' },
    ],
    structure: {
      target: 45,
      hook: { title: 'Cold open', minutes: 1, items: ['n1'] },
      intro: { title: 'Who I am', items: ['n2', 'n2', 'ghost'] },
      body: [
        { title: 'The pull', minutes: 7, items: [] },
        { title: 'The machine', items: ['n4'] },
      ],
      outro: { title: 'The ask', minutes: 3 },
    },
  };

  it('turns the sections into acts and places the kept notes on their runs', () => {
    const bench = fromWorkbenchV1(state);
    expect(parseBench(bench)).toMatchObject({ ok: true });
    expect(bench.acts).toEqual([
      { id: 'hook', title: 'Cold open', slides: '', minutes: 1, pool: [], run: ['n1'] },
      { id: 'intro', title: 'Who I am', slides: '', minutes: 2, pool: [], run: ['n2'] },
      { id: 'b1', title: 'The pull', slides: '', minutes: 7, pool: [], run: [] },
      { id: 'b2', title: 'The machine', slides: '', minutes: 5, pool: [], run: ['n4'] },
      { id: 'outro', title: 'The ask', slides: '', minutes: 3, pool: [], run: [] },
    ]);
    expect(bench.backstage).toEqual(['n3', 'n5']);
    expect(bench.target).toBe(45);
    expect(bench.milestones).toEqual([]);
    expect(bench.hook).toEqual(head.hook);
  });

  it('keeps the seven categories, retires the cut notes and falls back to story', () => {
    const bench = fromWorkbenchV1(state);
    expect(bench.categories.map((c) => [c.id, c.label, c.swatch])).toEqual([
      ['story', 'Story', 'yellow'],
      ['machine', 'Machine', 'orange'],
      ['evidence', 'Evidence', 'blue'],
      ['person', 'Person', 'pink'],
      ['practice', 'Practice', 'green'],
      ['humor', 'Humor', 'violet'],
      ['star', 'STAR', 'teal'],
    ]);
    expect(bench.notes.map((n) => [n.id, n.type, n.retired])).toEqual([
      ['n1', 'story', false],
      ['n2', 'machine', false],
      ['n3', 'evidence', true],
      ['n4', 'story', false],
      ['n5', 'star', false],
    ]);
    expect(bench.notes[0]).toMatchObject({ text: 'cold open', more: '', star: false, x3: false });
  });

  it('defaults an empty structure to the four fixed sections and a 45 minute target', () => {
    const bench = fromWorkbenchV1({ notes: [{ id: 'n1', text: 'x' }] });
    expect(parseBench(bench)).toMatchObject({ ok: true });
    expect(bench.acts.map((a) => [a.id, a.minutes, a.title])).toEqual([
      ['hook', 1, ''],
      ['intro', 2, ''],
      ['outro', 3, ''],
    ]);
    expect(bench.target).toBe(45);
    expect(bench.backstage).toEqual(['n1']);
    expect(bench.notes[0].type).toBe('story');
  });
});

describe('fromReadingRoom', () => {
  const content = {
    groups: [
      { id: 'wave', title: 'The wave', sub: 'Essays' },
      { id: 'papers', title: 'Papers', sub: 'Evidence' },
    ],
    articles: [
      {
        id: 'a1',
        group: 'wave',
        title: 'One',
        author: 'A',
        src: 'S',
        date: 'Jul 2026',
        url: 'https://x.test/1',
        cap: 'full capture',
        blurb: 'b1',
        body: '<p>one</p>',
        words: 1400,
      },
      {
        id: 'a2',
        group: 'wave',
        title: 'Two',
        author: 'B',
        src: 'S',
        date: 'Aug 2026',
        url: null,
        cap: 'writeout',
        blurb: 'b2',
        body: '<p>two</p>',
        words: 200,
      },
      {
        id: 'a3',
        group: 'papers',
        title: 'Three',
        author: 'C',
        src: 'arXiv',
        date: '2025',
        url: '',
        cap: 'notes',
        blurb: 'b3',
      },
      { id: 'a4', group: 'papers', title: 'Four' },
    ],
  };
  const state = {
    rev: 5,
    items: {
      a1: {
        read: true,
        readDate: '2026-08-20',
        notes: [{ t: 'good one', d: '2026-08-20' }, { t: 'second' }],
      },
      a2: { read: false, readDate: '2026-08-21', notes: [] },
      a3: { read: true, readDate: null, notes: [] },
      a4: { read: true, readDate: 20260820, notes: [] },
    },
  };

  it('merges the read state into each article and keeps the bodies whole', () => {
    const room = fromReadingRoom(content, state);
    expect(parseRoom(room)).toMatchObject({ ok: true });
    expect(room.groups).toEqual(content.groups);
    expect(room.articles).toEqual([
      {
        id: 'a1',
        group: 'wave',
        title: 'One',
        author: 'A',
        src: 'S',
        date: 'Jul 2026',
        url: 'https://x.test/1',
        cap: 'full capture',
        blurb: 'b1',
        body: '<p>one</p>',
        words: 1400,
        read: true,
        readDate: '2026-08-20',
        notes: [
          { t: 'good one', d: '2026-08-20' },
          { t: 'second', d: '' },
        ],
      },
      {
        id: 'a2',
        group: 'wave',
        title: 'Two',
        author: 'B',
        src: 'S',
        date: 'Aug 2026',
        url: null,
        cap: 'writeout',
        blurb: 'b2',
        body: '<p>two</p>',
        words: 200,
        read: false,
        readDate: null,
        notes: [],
      },
      {
        id: 'a3',
        group: 'papers',
        title: 'Three',
        author: 'C',
        src: 'arXiv',
        date: '2025',
        url: null,
        cap: 'notes',
        blurb: 'b3',
        body: '',
        words: 0,
        read: true,
        readDate: null,
        notes: [],
      },
      {
        id: 'a4',
        group: 'papers',
        title: 'Four',
        author: '',
        src: '',
        date: '',
        url: null,
        cap: '',
        blurb: '',
        body: '',
        words: 0,
        read: true,
        readDate: null,
        notes: [],
      },
    ]);
  });

  it('copes with no state and no content', () => {
    expect(
      fromReadingRoom(content, null).articles.every((a) => !a.read && a.notes.length === 0),
    ).toBe(true);
    expect(fromReadingRoom(null, null)).toEqual({ groups: [], articles: [] });
    expect(() => fromReadingRoom(null, state)).toThrow('no matching article');
    expect(fromReadingRoom({ groups: [{}] }, {}).groups).toEqual([{ id: '', title: '', sub: '' }]);
  });
});

describe('convertArtifact', () => {
  it('tells a reading room, a schema-2 workbench and a first workbench apart', () => {
    const roomHtml = page(
      block(
        'content-json',
        JSON.stringify({ groups: [{ id: 'g' }], articles: [{ id: 'a', group: 'g' }] }),
      ),
      block('state-json', JSON.stringify({ items: { a: { read: true, readDate: '2026-01-02' } } })),
    );
    const room = convertArtifact(roomHtml);
    expect(room?.kind).toBe('room');
    if (room?.kind === 'room')
      expect(room.doc.articles[0]).toMatchObject({ id: 'a', read: true, readDate: '2026-01-02' });

    const v2Html = page(
      block(
        'state-json',
        JSON.stringify({
          ...head,
          target: 20,
          acts: [{ id: 'a1', run: ['n1'] }],
          backstage: [],
          notes: [{ id: 'n1', type: 'story', text: 't' }],
        }),
      ),
      "<script id=\"app-js\">var MILESTONES=[{id:'n1',label:'open',by:1}];</script>",
    );
    const v2 = convertArtifact(v2Html);
    expect(v2?.kind).toBe('bench');
    if (v2?.kind === 'bench') {
      expect(v2.doc.milestones).toEqual([{ id: 'n1', label: 'open', by: 1 }]);
      expect(v2.doc.acts[0].run).toEqual(['n1']);
      expect(v2.doc.target).toBe(20);
    }

    const v1Html = page(
      block(
        'state-json',
        JSON.stringify({
          ...head,
          notes: [{ id: 'n1', cat: 'person', status: 'cut', text: 't' }],
          structure: { target: 40, body: [] },
        }),
      ),
    );
    const v1 = convertArtifact(v1Html);
    expect(v1?.kind).toBe('bench');
    if (v1?.kind === 'bench') {
      expect(v1.doc.acts.map((a) => a.id)).toEqual(['hook', 'intro', 'outro']);
      expect(v1.doc.notes[0]).toMatchObject({ type: 'person', retired: true });
      expect(v1.doc.target).toBe(40);
    }
  });

  it('refuses anything else', () => {
    expect(convertArtifact(page())).toBeNull();
    expect(convertArtifact(page(block('state-json', '{"rev":1}')))).toBeNull();
    expect(convertArtifact(page(block('state-json', '{"structure":null}')))).toBeNull();
    expect(convertArtifact(page(block('state-json', '{"structure":"x"}')))).toBeNull();
    expect(convertArtifact(page(block('state-json', '{"acts":{}}')))).toBeNull();
    expect(convertArtifact(page(block('state-json', 'nope')))).toBeNull();
    expect(convertArtifact(page(block('state-json', '[]')))).toBeNull();
    expect(convertArtifact(page(block('content-json', '{"groups":[],"articles":[]}')))).toBeNull();
  });
});

it('refuses unmatched reading-room state rather than silently discarding notes', () => {
  const content = { groups: [], articles: [] };
  const state = {
    items: { missing: { read: true, notes: [{ t: 'Keep this', d: '2026-09-04' }] }, another: {} },
  };
  expect(() => fromReadingRoom(content, state)).toThrow('missing, another');
});
