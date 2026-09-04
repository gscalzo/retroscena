import { describe, expect, it } from 'vitest';
import { escHtml, linkify, renderDetail } from './detail';

const a = (url: string, label = url) =>
  `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;

describe('escHtml', () => {
  it('escapes the three characters that open markup', () => {
    expect(escHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
    expect(escHtml('&&')).toBe('&amp;&amp;');
  });
});

describe('linkify', () => {
  it('turns [label](url) into an anchor', () => {
    expect(linkify('see [the paper](https://x.test/p) now')).toBe(
      `see ${a('https://x.test/p', 'the paper')} now`,
    );
    expect(linkify('[a](http://x)[b](https://y)')).toBe(
      `${a('http://x', 'a')}${a('https://y', 'b')}`,
    );
  });

  it('leaves malformed markdown links alone', () => {
    expect(linkify('[a](ftp://x)')).toBe('[a](ftp://x)');
    expect(linkify('[](https://x)')).toBe(`[](${a('https://x')})`);
    expect(linkify('[a](https://x y)')).toBe(`[a](${a('https://x')} y)`);
  });

  it('links a bare url at the start, after a space or after a paren', () => {
    expect(linkify('https://a.test/b')).toBe(a('https://a.test/b'));
    expect(linkify('see https://a.test/b next')).toBe(`see ${a('https://a.test/b')} next`);
    expect(linkify('(https://a.test/b)')).toBe(`(${a('https://a.test/b')})`);
    expect(linkify('line\nhttps://a.test')).toBe(`line\n${a('https://a.test')}`);
    expect(linkify('http://a.test')).toBe(a('http://a.test'));
  });

  it('does not link a url glued to a word, nor an http-less one', () => {
    expect(linkify('xhttps://a.test')).toBe('xhttps://a.test');
    expect(linkify('a.test/b')).toBe('a.test/b');
    expect(linkify('httpz://a.test')).toBe('httpz://a.test');
  });

  it('keeps trailing punctuation outside the anchor', () => {
    expect(linkify('at https://a.test/b.')).toBe(`at ${a('https://a.test/b')}.`);
    expect(linkify('at https://a.test/b:;, ok')).toBe(`at ${a('https://a.test/b')}:;, ok`);
    expect(linkify('at https://a.test/b&lt;x')).toBe(`at ${a('https://a.test/b&lt;x')}`);
  });
});

describe('renderDetail', () => {
  it('is empty for nothing', () => {
    expect(renderDetail('')).toBe('');
    expect(renderDetail('  \n\n ')).toBe('');
  });

  it('makes a paragraph per blank line and a <br> per single newline', () => {
    expect(renderDetail('a\nb')).toBe('<p>a<br>b</p>');
    expect(renderDetail('a\n\nb')).toBe('<p>a</p><p>b</p>');
    expect(renderDetail('a\n\n\n\nb')).toBe('<p>a</p><p>b</p>');
    expect(renderDetail('a\n \t \nb')).toBe('<p>a</p><p>b</p>');
    expect(renderDetail('a\r\n\r\nb\r\nc')).toBe('<p>a</p><p>b<br>c</p>');
    expect(renderDetail('\n\na\n\n')).toBe('<p>a</p>');
  });

  it('makes a list of a block whose every line starts with "- "', () => {
    expect(renderDetail('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>');
    expect(renderDetail('  -  spaced')).toBe('<ul><li>spaced</li></ul>');
    expect(renderDetail('- one\nnot a bullet')).toBe('<p>- one<br>not a bullet</p>');
    expect(renderDetail('-nospace')).toBe('<p>-nospace</p>');
    expect(renderDetail('a - b')).toBe('<p>a - b</p>');
    expect(renderDetail('abc- x')).toBe('<p>abc- x</p>');
    expect(renderDetail('- a\n\np')).toBe('<ul><li>a</li></ul><p>p</p>');
  });

  it('escapes first and links after, in paragraphs and bullets alike', () => {
    expect(renderDetail('a < b https://x.test/y.')).toBe(
      `<p>a &lt; b ${a('https://x.test/y')}.</p>`,
    );
    expect(renderDetail('- [p](https://x) & q')).toBe(
      `<ul><li>${a('https://x', 'p')} &amp; q</li></ul>`,
    );
  });
});
