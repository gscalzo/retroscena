import { describe, expect, it } from 'vitest';
import { docRef, parseArgs, revOption, USAGE, usage } from './args';
import { fakeIo } from './test/fake-io';

describe('parseArgs', () => {
  it('defaults to help', () => {
    expect(parseArgs([])).toEqual({ command: 'help', rest: [], values: {}, flags: new Set() });
  });

  it('separates the command, positionals, valued options and flags', () => {
    expect(
      parseArgs([
        'create',
        '--title',
        'A talk',
        '--json',
        'extra',
        '-o',
        'out.json',
        '--minutes',
        '25',
        '--weird',
      ]),
    ).toEqual({
      command: 'create',
      rest: ['extra'],
      values: { '--title': 'A talk', '-o': 'out.json', '--minutes': '25' },
      flags: new Set(['json', 'weird']),
    });
  });

  it('takes the next word as the value even when it looks like an option', () => {
    expect(parseArgs(['get', 'x', '--rev', '--json']).values).toEqual({ '--rev': '--json' });
  });

  it('ignores a valued option with nothing after it', () => {
    expect(parseArgs(['get', 'x', 'bench', '--rev'])).toEqual({
      command: 'get',
      rest: ['x', 'bench'],
      values: {},
      flags: new Set(),
    });
  });
});

describe('usage', () => {
  it('prints the problem and the usage, and is exit code 2', () => {
    const fake = fakeIo();
    expect(usage(fake.io, 'boom')).toBe(2);
    expect(fake.err).toEqual(['retroscena: boom\n\n', USAGE]);
    expect(fake.out).toEqual([]);
  });

  it('prints only the usage without a problem', () => {
    const fake = fakeIo();
    usage(fake.io);
    expect(fake.err).toEqual([USAGE]);
  });
});

describe('docRef', () => {
  it('needs a slug and a kind', () => {
    for (const argv of [['get'], ['get', 'talk']]) {
      const fake = fakeIo();
      expect(docRef(fake.io, parseArgs(argv))).toBeNull();
      expect(fake.err[0]).toContain('get needs a slug and a kind');
    }
  });

  it('refuses an unknown kind', () => {
    const fake = fakeIo();
    expect(docRef(fake.io, parseArgs(['put', 'talk', 'deck']))).toBeNull();
    expect(fake.err[0]).toContain('"deck" is not a kind');
  });

  it('returns the pair', () => {
    const fake = fakeIo();
    expect(docRef(fake.io, parseArgs(['get', 'talk', 'room', 'more']))).toEqual({
      slug: 'talk',
      kind: 'room',
    });
    expect(fake.err).toEqual([]);
  });
});

describe('revOption', () => {
  it('is null when absent, the integer when positive, NaN otherwise', () => {
    expect(revOption(parseArgs(['get']))).toBeNull();
    expect(revOption(parseArgs(['get', '--rev', '1']))).toBe(1);
    expect(revOption(parseArgs(['get', '--rev', '12']))).toBe(12);
    for (const bad of ['0', '-3', '1.5', 'x', '']) {
      expect(revOption(parseArgs(['get', '--rev', bad]))).toBeNaN();
    }
  });
});
