/**
 * The long form of a note, as it was in the workbench: a blank line is a
 * paragraph, lines starting with "- " are bullets, [label](url) or a bare
 * URL is a link. Rendered to HTML with the text escaped first.
 */

export function escHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const anchor = (url: string, label: string) =>
  `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;

/** Escaped text in, HTML with anchors out. */
export function linkify(escaped: string): string {
  const withMarkdown = escaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, label: string, url: string) => anchor(url, label),
  );
  return withMarkdown.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_m, pre: string, url: string) => {
    const core = url.replace(/[.,;:]+$/, '');
    return `${pre}${anchor(core, core)}${url.slice(core.length)}`;
  });
}

const BULLET = /^\s*-\s+/;

function paragraph(block: string): string {
  const lines = block.split('\n');
  if (lines.every((l) => BULLET.test(l))) {
    const items = lines.map((l) => `<li>${linkify(escHtml(l.replace(BULLET, '')))}</li>`);
    return `<ul>${items.join('')}</ul>`;
  }
  return `<p>${linkify(escHtml(block)).replace(/\n/g, '<br>')}</p>`;
}

export function renderDetail(source: string): string {
  const trimmed = source.replace(/\r/g, '').trim();
  if (trimmed === '') return '';
  return trimmed
    .split(/\n[ \t]*\n+/)
    .map(paragraph)
    .join('');
}
