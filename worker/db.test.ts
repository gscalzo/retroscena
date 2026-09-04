import { describe, expect, it } from 'vitest';
import { insertDocument, updatePresentation } from './db';
import { createTestApp, seed } from './test/harness';

describe('db', () => {
  it('refuses a second revision with the same number', async () => {
    const t = createTestApp();
    const slug = await seed(t);
    const row = {
      presentation: slug,
      kind: 'bench' as const,
      rev: 2,
      author: 'local',
      at: 1,
      body: '{}',
    };
    expect(await insertDocument(t.env.DB, row)).toBe(true);
    expect(await insertDocument(t.env.DB, row)).toBe(false);
  });

  it('updates only the columns in the patch', async () => {
    const t = createTestApp();
    const slug = await seed(t, { date: '2026-09-15' });
    expect(await updatePresentation(t.env.DB, slug, { event: 'Moved' })).toBe(true);
    const row = t.raw.prepare('SELECT event, date FROM presentations WHERE slug = ?').get(slug);
    expect(row).toEqual({ event: 'Moved', date: '2026-09-15' });
    expect(await updatePresentation(t.env.DB, 'nope', { event: 'x' })).toBe(false);
  });
});
