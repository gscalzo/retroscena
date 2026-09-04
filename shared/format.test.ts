import { describe, expect, it } from 'vitest';
import { daysUntil, fmtDate, fmtMin, isoDate, slugify, wordCount } from './format';

describe('slugify', () => {
  it('lower-cases, strips accents and joins words with dashes', () => {
    expect(slugify('The Confidence Gap!')).toBe('the-confidence-gap');
    expect(slugify('Città è bella')).toBe('citta-e-bella');
    expect(slugify('  --Junior   Crisis-- ')).toBe('junior-crisis');
    expect(slugify('one_more/prompt')).toBe('one-more-prompt');
  });

  it('is empty when nothing survives', () => {
    expect(slugify('')).toBe('');
    expect(slugify('!!!')).toBe('');
  });

  it('caps the length at 60 and never ends on a dash', () => {
    const sixty = 'a'.repeat(60);
    expect(slugify(`${sixty}bbbb`)).toBe(sixty);
    const fiftyNine = 'a'.repeat(59);
    expect(slugify(`${fiftyNine} b`)).toBe(fiftyNine);
    expect(slugify(`${'a'.repeat(58)} bcd`)).toBe(`${'a'.repeat(58)}-b`);
  });
});

describe('fmtMin', () => {
  it('renders minutes and seconds, padded', () => {
    expect(fmtMin(0)).toBe('0:00');
    expect(fmtMin(7.5)).toBe('7:30');
    expect(fmtMin(4.1)).toBe('4:06');
    expect(fmtMin(1.05)).toBe('1:03');
    expect(fmtMin(12)).toBe('12:00');
    expect(fmtMin(2 + 10 / 60)).toBe('2:10');
    expect(fmtMin(2 + 9 / 60)).toBe('2:09');
  });

  it('carries a rounded-up minute', () => {
    expect(fmtMin(2.999)).toBe('3:00');
    expect(fmtMin(0.9999)).toBe('1:00');
  });
});

describe('wordCount', () => {
  it('counts whitespace-separated words', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('   ')).toBe(0);
    expect(wordCount(' one ')).toBe(1);
    expect(wordCount('a b\tc\n d')).toBe(4);
  });
});

describe('isoDate', () => {
  it('is the UTC day of an epoch', () => {
    expect(isoDate(1_700_000_000_000)).toBe('2023-11-14');
    expect(isoDate(Date.parse('2026-09-04T23:59:59Z'))).toBe('2026-09-04');
  });
});

describe('daysUntil', () => {
  const now = Date.parse('2026-09-04T15:30:00Z');

  it('counts whole days to a date, regardless of the time of day', () => {
    expect(daysUntil('2026-09-15', now)).toBe(11);
    expect(daysUntil('2026-09-05', now)).toBe(1);
    expect(daysUntil('2026-09-05', Date.parse('2026-09-04T00:00:00Z'))).toBe(1);
  });

  it('is zero today and negative once the date has passed', () => {
    expect(daysUntil('2026-09-04', now)).toBe(0);
    expect(daysUntil('2026-09-01', now)).toBe(-3);
  });
});

describe('fmtDate', () => {
  it('renders an ISO day as day, month name and year', () => {
    expect(fmtDate('2026-09-15')).toBe('15 Sep 2026');
    expect(fmtDate('2026-01-05')).toBe('5 Jan 2026');
    expect(fmtDate('2026-12-25')).toBe('25 Dec 2026');
  });

  it('hands back anything it cannot parse', () => {
    expect(fmtDate('2026-13-01')).toBe('2026-13-01');
    expect(fmtDate('2026-00-01')).toBe('2026-00-01');
    expect(fmtDate('15 Sep 2026')).toBe('15 Sep 2026');
    expect(fmtDate('2026-9-15')).toBe('2026-9-15');
    expect(fmtDate('x2026-09-15')).toBe('x2026-09-15');
    expect(fmtDate('2026-09-15x')).toBe('2026-09-15x');
    expect(fmtDate('')).toBe('');
  });
});
