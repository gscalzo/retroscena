// @vitest-environment jsdom
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { bench as fixture } from '../../shared/fixtures.test';
import type { Bench } from '../../shared/types';
import { BenchBoard } from './BenchBoard';

function Board({ onChange }: { onChange?: (bench: Bench) => void }) {
  const [bench, setBench] = useState(fixture());
  return (
    <BenchBoard
      bench={bench}
      update={(next) => {
        onChange?.(next);
        setBench(next);
      }}
    />
  );
}

afterEach(() => vi.useRealTimers());

it('puts restrained run cards first and collapses every act bench on request', () => {
  const { container } = render(<Board />);
  const firstAct = container.querySelector('.act')!;
  const run = firstAct.querySelector('.act-run')!;
  const pool = firstAct.querySelector('.act-pool')!;
  expect(run.compareDocumentPosition(pool) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(run.querySelector('.run-card')).toHaveAttribute('data-swatch', 'blue');
  expect(pool.querySelector('.bench-card')).toHaveAttribute('data-swatch', 'yellow');
  expect(screen.queryByRole('button', { name: 'STAR moment' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Repeated line' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Hide benches' }));
  expect(container.querySelector('.act-pool')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Show benches' }));
  expect(container.querySelector('.act-pool')).not.toBeNull();
});

it('shows an undo toast for five seconds and restores a moved note', () => {
  vi.useFakeTimers();
  const { container } = render(<Board />);
  expect(container.querySelectorAll('.run-card')).toHaveLength(3);
  const move = container.querySelector<HTMLSelectElement>(
    '.bench-card select[aria-label="Move note"]',
  )!;
  fireEvent.change(move, { target: { value: 'run:1' } });
  expect(container.querySelectorAll('.run-card')).toHaveLength(4);
  expect(screen.getByRole('status')).toHaveTextContent('Moved to Act 2 run');

  act(() => {
    vi.advanceTimersByTime(4_999);
  });
  expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(container.querySelectorAll('.run-card')).toHaveLength(3);
  expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();

  fireEvent.click(container.querySelector<HTMLButtonElement>('.act-run .add-note')!);
  expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  act(() => {
    vi.advanceTimersByTime(5_000);
  });
  expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
});

it('marks the live insertion edge while a note is dragged', () => {
  const { container } = render(<Board />);
  const source = container.querySelector<HTMLElement>('.bench-card .drag-handle')!;
  const target = container.querySelector<HTMLElement>('.runlist li')!;
  const data = new Map<string, string>();
  const dataTransfer = {
    effectAllowed: 'none',
    dropEffect: 'none',
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? '',
  };
  fireEvent.dragStart(source, { dataTransfer });
  fireEvent.dragOver(target, { clientY: 1, dataTransfer });
  expect(target).toHaveClass('insert-before');
  expect(dataTransfer.dropEffect).toBe('move');
  fireEvent.drop(target, { clientY: 1, dataTransfer });
  expect(target).not.toHaveClass('insert-before');
  expect(screen.getByRole('status')).toHaveTextContent('Moved to Act 1 run');
});
