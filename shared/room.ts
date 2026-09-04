/** The pure rules of a reading room (ADR-0002): read marks, margin notes, counts. */
import type { Article, Room } from './types';

export interface Counts {
  read: number;
  total: number;
}

function countOf(articles: readonly Article[]): Counts {
  return { read: articles.filter((a) => a.read).length, total: articles.length };
}

export function roomCounts(room: Room): Counts {
  return countOf(room.articles);
}

export function articlesIn(room: Room, groupId: string): Article[] {
  return room.articles.filter((a) => a.group === groupId);
}

export function groupCounts(room: Room, groupId: string): Counts {
  return countOf(articlesIn(room, groupId));
}

function withArticle(room: Room, id: string, update: (a: Article) => Article): Room {
  return { ...room, articles: room.articles.map((a) => (a.id === id ? update(a) : a)) };
}

/** Tick or untick; ticking stamps today's date, unticking clears it. */
export function toggleRead(room: Room, id: string, today: string): Room {
  return withArticle(room, id, (a) =>
    a.read ? { ...a, read: false, readDate: null } : { ...a, read: true, readDate: today },
  );
}

export function addMarginNote(room: Room, id: string, text: string, today: string): Room {
  const t = text.trim();
  if (t === '') return room;
  return withArticle(room, id, (a) => ({ ...a, notes: [...a.notes, { t, d: today }] }));
}

/** An emptied note is deleted, as on paper. */
export function updateMarginNote(room: Room, id: string, index: number, text: string): Room {
  const t = text.trim();
  if (t === '') return deleteMarginNote(room, id, index);
  return withArticle(room, id, (a) => ({
    ...a,
    notes: a.notes.map((n, i) => (i === index ? { ...n, t } : n)),
  }));
}

export function deleteMarginNote(room: Room, id: string, index: number): Room {
  return withArticle(room, id, (a) => ({ ...a, notes: a.notes.filter((_, i) => i !== index) }));
}

export type ReadFilter = 'all' | 'unread' | 'read';
export const READ_FILTERS: readonly ReadFilter[] = ['all', 'unread', 'read'];

export function articleVisible(article: Article, filter: ReadFilter): boolean {
  return filter === 'all' || (filter === 'read') === article.read;
}
