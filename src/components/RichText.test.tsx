// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderDetail } from '../../shared/detail';
import { RichText, safeUrl } from './RichText';

describe('safe presentation markup', () => {
  it('preserves readable structure and links while discarding active content and attributes', () => {
    const html = `Text<!-- comment --><h3 onclick="alert(1)">Heading</h3><p style="display:none">Body <strong>bold</strong><br>next</p><hr><ul><li>List</li></ul><blockquote>Quote</blockquote><table><tbody><tr><td>Cell</td></tr></tbody></table><a href="https://example.org/path?q=1" onclick="alert(2)">Source</a><div class="hostile">Unwrapped</div><img src="x" onerror="alert(3)"><script>alert(4)</script><style>body{display:none}</style><iframe srcdoc="bad"></iframe><svg><a>SVG</a></svg>`;
    const { container } = render(<RichText html={html} />);
    expect(screen.getByRole('heading', { name: 'Heading' })).not.toHaveAttribute('onclick');
    expect(screen.getByRole('link', { name: 'Source' })).toHaveAttribute(
      'href',
      'https://example.org/path?q=1',
    );
    expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Unwrapped').tagName).toBe('SPAN');
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelector('br')).toBeInTheDocument();
    expect(container.querySelector('hr')).toBeInTheDocument();
    expect(container.querySelector('td')).toHaveTextContent('Cell');
    expect(
      container.querySelectorAll('script,style,iframe,svg,img,[onclick],[onerror],[style]'),
    ).toHaveLength(0);
    expect(container).not.toHaveTextContent('alert(4)');
  });
  it('does not turn dangerous, relative or missing URLs into navigable links', () => {
    const { container } = render(
      <RichText html='<a href="javascript:alert(1)">Bad</a><a href="/private">Relative</a><a>Missing</a>' />,
    );
    expect(container.querySelectorAll('a')).toHaveLength(3);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(safeUrl('invalid')).toBeUndefined();
    expect(safeUrl(null)).toBeUndefined();
    expect(safeUrl('data:text/html,bad')).toBeUndefined();
    expect(safeUrl('http://example.org')).toBe('http://example.org/');
  });
  it('safely presents the shared detail renderer even with quote injection in URLs', () => {
    const { container, rerender } = render(
      <RichText
        html={renderDetail(
          'A <script>bad</script>\n\n- First\n- [Source](https://example.org/"onclick="bad)',
        )}
      />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Source' })).toHaveAttribute(
      'href',
      'https://example.org/',
    );
    rerender(<RichText html="" />);
    expect(container.querySelector('.more-body')).toBeEmptyDOMElement();
  });
});
