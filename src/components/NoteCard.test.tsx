// @vitest-environment jsdom
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { addNote } from '../../shared/bench';
import { newBench } from '../../shared/template';
import type { Bench } from '../../shared/types';
import { NoteCard } from './NoteCard';

function fixture() {
  return addNote(newBench(25), { zone: 'pool', act: 0 }, 'note');
}

it('edits every note field immutably and exposes move and drag controls', () => {
  const original = fixture();
  const change = vi.fn();
  const action = vi.fn();
  const onMove = vi.fn();
  function Editor() {
    const [bench, setBench] = useState(original);
    return (
      <NoteCard
        bench={bench}
        note={bench.notes[0]}
        appearance="bench"
        showDetails={false}
        onChange={(next) => {
          change(next);
          setBench(next);
        }}
        onAction={(next, message) => {
          action(next, message);
          setBench(next);
        }}
        onMove={onMove}
      />
    );
  }
  const { container } = render(<Editor />);
  fireEvent.change(screen.getByLabelText('Note text'), { target: { value: 'Opening beat' } });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'evidence' } });
  expect(container.querySelector('.mini')).toHaveAttribute('data-swatch', 'blue');
  expect(screen.queryByRole('button', { name: 'STAR moment' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Repeated line' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retired' }));
  expect(screen.getByRole('button', { name: 'Retired' })).toHaveAttribute('aria-pressed', 'true');
  expect(action).toHaveBeenLastCalledWith(expect.any(Object), 'Note retired');
  expect(container.querySelector('.mini')).toHaveClass('retired');
  fireEvent.click(screen.getByRole('button', { name: 'Retired' }));
  expect(action).toHaveBeenLastCalledWith(expect.any(Object), 'Note restored');
  expect(container.querySelector('.mini')).not.toHaveClass('retired');
  fireEvent.change(screen.getByLabelText('Move note'), { target: { value: 'run:1' } });
  expect(onMove).toHaveBeenCalledWith('run:1');
  const dataTransfer = { setData: vi.fn(), effectAllowed: '' };
  fireEvent.dragStart(container.querySelector('.drag-handle')!, { dataTransfer });
  expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-retroscena-note', 'note');
  expect(dataTransfer.effectAllowed).toBe('move');
  expect(container.querySelector('.mini')).toHaveClass('dragging');
  fireEvent.dragEnd(container.querySelector('.drag-handle')!);
  expect(container.querySelector('.mini')).not.toHaveClass('dragging');
  expect(original.notes[0].text).toBe('');
  expect((action.mock.lastCall![0] as Bench).notes[0]).toMatchObject({
    text: 'Opening beat',
    type: 'evidence',
    star: false,
    x3: false,
    retired: false,
  });
});

it('unfolds, edits and safely previews detail, with a board-wide detail toggle', () => {
  const bench = fixture();
  const onChange = vi.fn();
  const props = {
    bench,
    note: bench.notes[0],
    appearance: 'run' as const,
    onChange,
    onAction: vi.fn(),
    onMove: vi.fn(),
    showDetails: false,
  };
  const { rerender } = render(<NoteCard {...props} />);
  expect(document.querySelector('.mini')).toHaveClass('run-card');
  expect(screen.queryByText('Edit detail')).toBeNull();
  fireEvent.click(screen.getByText('Details'));
  expect(screen.getByText('Details')).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByText('Edit detail'));
  fireEvent.change(screen.getByLabelText('Note detail'), {
    target: { value: 'Full detail\n\n- Source' },
  });
  const next = onChange.mock.lastCall![0] as Bench;
  expect(next.notes[0].more).toBe('Full detail\n\n- Source');
  rerender(<NoteCard {...props} bench={next} note={next.notes[0]} />);
  fireEvent.click(screen.getByText('Preview detail'));
  expect(screen.getByText('Full detail')).toBeInTheDocument();
  expect(screen.getByRole('listitem')).toHaveTextContent('Source');
  expect(screen.getByText('Details')).toHaveClass('has');
  fireEvent.click(screen.getByText('Details'));
  expect(screen.queryByText('Full detail')).toBeNull();
  rerender(<NoteCard {...props} bench={next} note={next.notes[0]} showDetails />);
  expect(screen.getByText('Full detail')).toBeInTheDocument();
});
