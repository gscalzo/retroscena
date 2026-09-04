// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OutlineDialog } from './OutlineDialog';

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => vi.restoreAllMocks());

it('opens modally, exports exact Markdown, copies, closes and restores focus', async () => {
  const show = vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(() => {});
  const close = vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(() => {});
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const focus = vi.spyOn(document.body, 'focus');
  const onClose = vi.fn();
  const { unmount, container } = render(
    <OutlineDialog markdown={'# Outline\n\nA beat'} onClose={onClose} />,
  );
  expect(show).toHaveBeenCalledOnce();
  const text = screen.getByLabelText<HTMLTextAreaElement>('Markdown outline');
  expect(text).toHaveValue('# Outline\n\nA beat');
  fireEvent.focus(text);
  expect(text.selectionEnd).toBe(text.value.length);
  expect(screen.getByRole('link', { hidden: true })).toHaveAttribute('download', 'outline.md');
  expect(screen.getByRole('link', { hidden: true })).toHaveAttribute(
    'href',
    'data:text/markdown;charset=utf-8,%23%20Outline%0A%0AA%20beat',
  );
  fireEvent.click(screen.getByText('Copy'));
  await waitFor(() => expect(screen.getByText('Copied outline.')).toBeInTheDocument());
  expect(writeText).toHaveBeenCalledWith('# Outline\n\nA beat');
  fireEvent.click(screen.getByText('Close'));
  fireEvent(container.querySelector('dialog')!, new Event('cancel', { bubbles: true }));
  expect(onClose).toHaveBeenCalledTimes(2);
  unmount();
  expect(close).toHaveBeenCalledOnce();
  expect(focus).toHaveBeenCalledOnce();
});

it('keeps manual copy available when clipboard permission is unavailable', async () => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(() => {});
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(() => {});
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
  });
  render(<OutlineDialog markdown="Text" onClose={vi.fn()} />);
  fireEvent.click(screen.getByText('Copy'));
  await waitFor(() => expect(screen.getByText(/Copy unavailable/)).toBeInTheDocument());
  expect(screen.getByLabelText('Markdown outline')).toHaveValue('Text');
});
