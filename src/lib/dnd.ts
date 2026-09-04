import type { DragEvent } from 'react';

const NOTE_TYPE = 'application/x-retroscena-note';

export function beginDrag(event: DragEvent, id: string): void {
  event.dataTransfer.setData(NOTE_TYPE, id);
  event.dataTransfer.effectAllowed = 'move';
}

export function droppedNote(event: DragEvent): string | null {
  event.preventDefault();
  return event.dataTransfer.getData(NOTE_TYPE) || null;
}
