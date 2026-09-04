import { describe, expect, it } from 'vitest';
import { fmtTime, table } from './render';

describe('table', () => {
  it('pads every column to its widest cell and trims the row ends', () => {
    expect(
      table([
        ['A', 'BB', ''],
        ['longer', 'x', 'end'],
        ['', 'yy', ''],
      ]),
    ).toBe('A       BB\nlonger  x   end\n        yy\n');
  });

  it('renders a single row', () => {
    expect(table([['one', 'two']])).toBe('one  two\n');
  });
});

describe('fmtTime', () => {
  it('is the UTC date and time to the second', () => {
    expect(fmtTime(1_700_000_000_000)).toBe('2023-11-14 22:13:20');
  });
});
