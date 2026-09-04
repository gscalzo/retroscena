// @vitest-environment jsdom
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { Article, Room } from '../../shared/types';
import { ArticleCard } from './ArticleCard';

function article(): Article {
  return {
    id: 'source',
    group: 'sources',
    title: 'A source',
    author: 'Writer',
    src: 'Journal',
    date: '2026',
    url: 'https://example.org',
    cap: 'full capture',
    blurb: 'Why it matters',
    body: '<p>Captured body</p><script>bad()</script>',
    words: 1200,
    read: false,
    readDate: null,
    notes: [{ t: 'A margin note', d: '2026-01-01' }],
  };
}

it('shows the capture and metadata, toggles read status, and adds, edits and removes margin notes', () => {
  const initial: Room = { groups: [], articles: [article(), { ...article(), id: 'other' }] };
  const change = vi.fn();
  function Editor() {
    const [room, setRoom] = useState(initial);
    return (
      <ArticleCard
        room={room}
        article={room.articles[0]}
        onChange={(next) => {
          change(next);
          setRoom(next);
        }}
      />
    );
  }
  const { container } = render(<Editor />);
  expect(screen.getByRole('link', { name: 'A source' })).toHaveAttribute(
    'href',
    'https://example.org/',
  );
  expect(screen.getByText('1,200 words')).toBeInTheDocument();
  expect(screen.getByText('Read the capture')).toBeInTheDocument();
  expect(container.querySelector('script')).toBeNull();
  fireEvent.click(screen.getByText('Read the capture'));
  expect(screen.getByText('Captured body')).toBeInTheDocument();
  const read = screen.getByRole('button', { name: 'Read status: A source' });
  expect(read).toHaveAttribute('title', 'Mark as read');
  fireEvent.click(read);
  expect(read).toHaveAttribute('aria-pressed', 'true');
  expect(read).toHaveAttribute('title', 'Mark as unread');
  expect(container.querySelector('.readdate')).toHaveTextContent('Read');
  expect(container.querySelector('.card')).toHaveClass('isread');
  fireEvent.click(read);
  expect(read).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('New margin note'), {
    target: { value: ' A new thought ' },
  });
  fireEvent.submit(screen.getByRole('button', { name: 'Add' }).closest('form')!);
  expect(screen.getByLabelText('New margin note')).toHaveValue('');
  expect(screen.getByLabelText('Margin note 2')).toHaveValue('A new thought');
  fireEvent.change(screen.getByLabelText('Margin note 1'), {
    target: { value: 'Revised thought ' },
  });
  expect((change.mock.lastCall![0] as Room).articles[0].notes[0].t).toBe('Revised thought ');
  expect((change.mock.lastCall![0] as Room).articles[1]).toEqual(initial.articles[1]);
  fireEvent.blur(screen.getByLabelText('Margin note 1'));
  expect(screen.getByLabelText('Margin note 1')).toHaveValue('Revised thought');
  fireEvent.click(screen.getByRole('button', { name: 'Delete margin note 2' }));
  expect(screen.queryByLabelText('Margin note 2')).toBeNull();
  fireEvent.blur(screen.getByLabelText('Margin note 1'), { target: { value: ' ' } });
  expect(screen.queryByLabelText('Margin note 1')).toBeNull();
  expect((change.mock.lastCall![0] as Room).articles[0].notes).toEqual([]);
  expect(initial.articles[0].notes).toHaveLength(1);
});

it('handles captures without a URL, word count or body, and labels writeouts', () => {
  const source = { ...article(), url: null, words: 0, body: '', notes: [] };
  const room = { groups: [], articles: [source] };
  const { rerender } = render(<ArticleCard room={room} article={source} onChange={vi.fn()} />);
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.queryByText(/words/)).toBeNull();
  expect(screen.queryByText('Read the capture')).toBeNull();
  expect(screen.getByRole('heading')).toHaveTextContent('A source');
  rerender(
    <ArticleCard
      room={room}
      article={{ ...source, cap: 'writeout notes', body: '<p>Writeout</p>' }}
      onChange={vi.fn()}
    />,
  );
  expect(screen.getByText('Read the writeout')).toBeInTheDocument();
});
