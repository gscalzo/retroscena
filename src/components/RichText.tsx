import { createElement, useMemo } from 'react';
import type { ReactNode } from 'react';

const ALLOWED = new Set([
  'P',
  'BR',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'STRONG',
  'B',
  'EM',
  'I',
  'CODE',
  'PRE',
  'HR',
  'A',
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'TH',
  'TD',
  'SUP',
  'SUB',
  'S',
  'DEL',
]);
const OMIT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE']);

export function safeUrl(value: string | null): string | undefined {
  if (value === null) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function renderNode(node: Node, index: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (!(node instanceof Element) || OMIT.has(node.tagName)) return null;
  const children = Array.from(node.childNodes).map(renderNode);
  if (!ALLOWED.has(node.tagName)) return createElement('span', { key: index }, children);
  const tag = node.tagName.toLowerCase();
  if (tag === 'a')
    return createElement(
      'a',
      {
        key: index,
        href: safeUrl(node.getAttribute('href')),
        target: '_blank',
        rel: 'noopener noreferrer',
      },
      children,
    );
  if (tag === 'br' || tag === 'hr') return createElement(tag, { key: index });
  return createElement(tag, { key: index }, children);
}

/** Rebuild only inert presentation elements; source markup never enters the live DOM. */
export function RichText({ html }: { html: string }) {
  const children = useMemo(
    () =>
      Array.from(new DOMParser().parseFromString(html, 'text/html').body.childNodes).map(
        renderNode,
      ),
    [html],
  );
  return <div className="more-body">{children}</div>;
}
