import { describe, expect, it } from 'vitest';
import { article, room } from './fixtures.test';
import {
  READ_FILTERS,
  addMarginNote,
  articleVisible,
  articlesIn,
  deleteMarginNote,
  groupCounts,
  roomCounts,
  toggleRead,
  updateMarginNote,
} from './room';

const TODAY = '2026-09-04';

describe('counts', () => {
  it('counts read articles over the room and per group', () => {
    expect(roomCounts(room())).toEqual({ read: 1, total: 3 });
    expect(groupCounts(room(), 'g1')).toEqual({ read: 1, total: 2 });
    expect(groupCounts(room(), 'g2')).toEqual({ read: 0, total: 1 });
    expect(groupCounts(room(), 'nope')).toEqual({ read: 0, total: 0 });
  });

  it('lists the articles of a group in order', () => {
    expect(articlesIn(room(), 'g1').map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(articlesIn(room(), 'g2').map((a) => a.id)).toEqual(['a3']);
  });
});

describe('toggleRead', () => {
  it('ticks with today, unticks and clears the date, touching only that article', () => {
    const before = room();
    const ticked = toggleRead(before, 'a1', TODAY);
    expect(ticked.articles[0]).toMatchObject({ read: true, readDate: TODAY });
    expect(ticked.articles[1]).toBe(before.articles[1]);
    expect(ticked.articles[2]).toBe(before.articles[2]);
    expect(before.articles[0].read).toBe(false);
    const unticked = toggleRead(ticked, 'a1', TODAY);
    expect(unticked.articles[0]).toMatchObject({ read: false, readDate: null });
    expect(toggleRead(before, 'a2', TODAY).articles[1]).toMatchObject({
      read: false,
      readDate: null,
    });
  });
});

describe('margin notes', () => {
  it('adds a trimmed note dated today, and ignores an empty one', () => {
    const added = addMarginNote(room(), 'a1', '  worth a beat  ', TODAY);
    expect(added.articles[0].notes).toEqual([{ t: 'worth a beat', d: TODAY }]);
    expect(added.articles[1].notes).toHaveLength(1);
    const same = room();
    expect(addMarginNote(same, 'a1', '   ', TODAY)).toBe(same);
    const second = addMarginNote(added, 'a1', 'again', TODAY);
    expect(second.articles[0].notes.map((n) => n.t)).toEqual(['worth a beat', 'again']);
  });

  it('edits one note by index, keeping its date, and deletes it when emptied', () => {
    const two = room({
      articles: [
        article('a1', {
          notes: [
            { t: 'one', d: '2026-08-01' },
            { t: 'two', d: '2026-08-02' },
          ],
        }),
      ],
    });
    const edited = updateMarginNote(two, 'a1', 1, '  two, revised ');
    expect(edited.articles[0].notes).toEqual([
      { t: 'one', d: '2026-08-01' },
      { t: 'two, revised', d: '2026-08-02' },
    ]);
    const emptied = updateMarginNote(two, 'a1', 0, ' ');
    expect(emptied.articles[0].notes).toEqual([{ t: 'two', d: '2026-08-02' }]);
  });

  it('deletes by index only', () => {
    const two = room({
      articles: [
        article('a1', {
          notes: [
            { t: 'one', d: 'd1' },
            { t: 'two', d: 'd2' },
          ],
        }),
        article('a2'),
      ],
    });
    const gone = deleteMarginNote(two, 'a1', 0);
    expect(gone.articles[0].notes).toEqual([{ t: 'two', d: 'd2' }]);
    expect(gone.articles[1]).toBe(two.articles[1]);
    expect(deleteMarginNote(two, 'a1', 5).articles[0].notes).toHaveLength(2);
  });
});

describe('articleVisible', () => {
  it('filters by read state', () => {
    const unread = article('u');
    const read = article('r', { read: true });
    expect(READ_FILTERS).toEqual(['all', 'unread', 'read']);
    expect(articleVisible(unread, 'all')).toBe(true);
    expect(articleVisible(read, 'all')).toBe(true);
    expect(articleVisible(unread, 'unread')).toBe(true);
    expect(articleVisible(read, 'unread')).toBe(false);
    expect(articleVisible(unread, 'read')).toBe(false);
    expect(articleVisible(read, 'read')).toBe(true);
  });
});
