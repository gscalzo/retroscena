// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SaveBar } from './SaveBar';

it('shows clean, dirty and saving states, errors, notices and conflict choices', () => {
  const state = {
    baseRev: 3,
    dirty: false,
    saving: false,
    error: null,
    notice: null,
    conflict: null,
    save: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
    keepEditing: vi.fn(),
  };
  const { rerender } = render(<SaveBar state={state} />);
  expect(screen.getByRole('status')).toHaveTextContent('Saved · revision 3');
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  rerender(<SaveBar state={{ ...state, dirty: true }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(state.save).toHaveBeenCalledOnce();
  rerender(<SaveBar state={{ ...state, dirty: true, saving: true }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Saving…');
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  rerender(
    <SaveBar
      state={{
        ...state,
        error: 'Offline',
        notice: 'Draft restored',
        conflict: { rev: 4, author: 'agent:test', at: 1 },
      }}
    />,
  );
  expect(screen.getByText('Offline')).toHaveAttribute('role', 'alert');
  expect(screen.getByText('Draft restored')).toHaveAttribute('role', 'status');
  expect(screen.getByText(/agent:test saved revision 4/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(state.reload).toHaveBeenCalledOnce();
  expect(state.keepEditing).toHaveBeenCalledOnce();
});
