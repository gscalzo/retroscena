import { expect, it, vi } from 'vitest';
import type { DragEvent } from 'react';
import { beginDrag, droppedNote } from './dnd';

it('moves only notes carrying the private note MIME type', () => {
  const data = new Map<string, string>();
  const preventDefault = vi.fn();
  const event = {
    preventDefault,
    dataTransfer: {
      effectAllowed: 'none',
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? '',
    },
  } as unknown as DragEvent;
  expect(droppedNote(event)).toBeNull();
  data.set('text/plain', 'external');
  expect(droppedNote(event)).toBeNull();
  beginDrag(event, 'n17');
  expect(event.dataTransfer.effectAllowed).toBe('move');
  expect(data.get('application/x-retroscena-note')).toBe('n17');
  expect(droppedNote(event)).toBe('n17');
  expect(preventDefault).toHaveBeenCalledTimes(3);
});
