import { describe, expect, it } from 'vitest';
import { act, bench, note, presentation } from './fixtures.test';
import { outlineMarkdown } from './outline';

const TODAY = '2026-09-04';

describe('outlineMarkdown', () => {
  it('renders the whole bench, in order, as Markdown', () => {
    const b = bench({
      who: { room: 'Leaders', know: 'The crisis', expect: 'A Monday' },
      why: {
        speakerGoal: 'Own the frame',
        promise: 'Four exercises',
        throughline: 'Rebuild both the ladder and the door',
        tfd: {
          think: { now: 'T1', after: 'T2' },
          feel: { now: 'F1', after: 'F2' },
          do: { now: 'D1', after: 'D2' },
        },
      },
      hook: {
        ...bench().hook,
        selected: 'statement',
        texts: { ...bench().hook.texts, statement: '84% worry' },
      },
      acts: [
        act('a1', 4, { title: 'The Quiet', slides: '1-5', pool: ['n1'], run: ['n2', 'n3'] }),
        act('a2', 6, { title: 'The Door', run: ['n4'] }),
      ],
      milestones: [
        { id: 'n3', label: 'turn', by: 3 },
        { id: 'n5', label: 'close', by: 9 },
      ],
      notes: [
        note('n1', { more: 'Long form\nsecond line' }),
        note('n2', { type: 'evidence', star: true }),
        note('n3', { x3: true, retired: true, more: '  quoted  ' }),
        note('n4', { type: 'gone' }),
        note('n5', { text: 'Armor' }),
      ],
    });
    expect(outlineMarkdown(presentation(), b, TODAY)).toBe(
      [
        '# The Talk: outline draft (bench export)',
        '',
        'Exported 2026-09-04. Slot: 10:00, content timed to 10:00. Some Conf, 2026-09-15.',
        '',
        '## WHO: target audience',
        '- In the room: Leaders',
        '- They already know: The crisis',
        '- They expect: A Monday',
        '',
        '## WHY: goals and outcomes',
        '- Speaker goal: Own the frame',
        '- Promise to the room: Four exercises',
        '- Throughline (7 words): Rebuild both the ladder and the door',
        '',
        '### Think, feel, do',
        '- Think, walking in: T1',
        '- Think, walking out: T2',
        '- Feel, walking in: F1',
        '- Feel, walking out: F2',
        '- Do, walking in: D1',
        '- Do, walking out: D2',
        '',
        '## The hook (statement)',
        '> 84% worry',
        '',
        '## The run: 10:00 of content in 2 acts, against a 10:00 slot',
        '',
        'Milestones: turn ≈2:00 (by 3:00) · close OFF THE RUN',
        '',
        '### Act 1 · The Quiet (4:00, slides 1-5)',
        '1. [Evidence] text n2 [STAR]',
        '2. [Story] text n3 [x3] [retired]',
        '   > quoted',
        '',
        'On the bench for this act:',
        '- [Story] text n1',
        '  > Long form',
        '  > second line',
        '',
        '### Act 2 · The Door (6:00)',
        '1. [gone] text n4',
        '',
        '## Backstage',
        '- [Story] Armor',
        '',
      ].join('\n'),
    );
  });

  it('marks an empty run, skips missing blocks and stale ids', () => {
    const b = bench({
      acts: [act('a1', 3, { title: 'Only', run: ['n1', 'ghost'] })],
      backstage: [],
      notes: [note('n1')],
      milestones: [],
      target: 3,
    });
    const md = outlineMarkdown(presentation({ date: null, title: 'T', event: 'E' }), b, TODAY);
    expect(md).toContain('Exported 2026-09-04. Slot: 3:00, content timed to 3:00. E.\n');
    expect(md).toContain('## The hook (anecdote)\n> \n');
    expect(
      md.endsWith(
        '## The run: 3:00 of content in 1 acts, against a 3:00 slot\n\n### Act 1 · Only (3:00)\n1. [Story] text n1\n',
      ),
    ).toBe(true);
    expect(md).not.toContain('Milestones:');
    expect(md).not.toContain('On the bench');
    expect(md).not.toContain('## Backstage');
    expect(md).not.toContain('ghost');
    const empty = outlineMarkdown(
      presentation(),
      bench({ acts: [act('a1', 1)], backstage: ['n1', 'n2', 'n3', 'n4', 'n5'] }),
      TODAY,
    );
    expect(empty).toContain(
      '### Act 1 · Act a1 (1:00)\n- (nothing scheduled)\n\n## Backstage\n- [Story] text n1\n',
    );
  });
});
