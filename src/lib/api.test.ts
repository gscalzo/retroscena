import { afterEach, expect, it, vi } from 'vitest';
import { api, ApiError, ConflictError } from './api';
import { newBench } from '../../shared/template';

afterEach(() => vi.unstubAllGlobals());

it('uses encoded API routes and sends JSON writes with their revision', async () => {
  const response = { value: 'returned' };
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json(response)));
  vi.stubGlobal('fetch', fetcher);
  const creation = { title: 'Talk', event: 'Conf', date: null, target: 25 };
  const doc = newBench(25);
  const operations = [
    () => api.list(),
    () => api.create(creation),
    () => api.presentation('a/b'),
    () => api.update('a/b', { archived: true }),
    () => api.document('a/b', 'bench'),
    () => api.meta('a/b', 'room'),
    () => api.put('a/b', 'bench', 7, doc),
  ];
  for (const operation of operations) expect(await operation()).toEqual(response);
  expect(fetcher.mock.calls).toEqual([
    [
      '/api/presentations',
      { method: 'GET', headers: { 'Content-Type': 'application/json' }, body: undefined },
    ],
    [
      '/api/presentations',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creation),
      },
    ],
    [
      '/api/presentations/a%2Fb',
      { method: 'GET', headers: { 'Content-Type': 'application/json' }, body: undefined },
    ],
    [
      '/api/presentations/a%2Fb',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{"archived":true}',
      },
    ],
    [
      '/api/presentations/a%2Fb/bench',
      { method: 'GET', headers: { 'Content-Type': 'application/json' }, body: undefined },
    ],
    [
      '/api/presentations/a%2Fb/room/meta',
      { method: 'GET', headers: { 'Content-Type': 'application/json' }, body: undefined },
    ],
    [
      '/api/presentations/a%2Fb/bench',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseRev: 7, doc }),
      },
    ],
  ]);
});

it('distinguishes revision conflicts, duplicate slugs, and other HTTP failures', async () => {
  const current = { rev: 9, at: 123, author: 'agent:macbook' };
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ current }, { status: 409 }))
      .mockResolvedValueOnce(Response.json({}, { status: 409 }))
      .mockResolvedValueOnce(new Response('login required', { status: 401 })),
  );
  await expect(api.list()).rejects.toEqual(new ConflictError(current));
  await expect(api.list()).rejects.toEqual(new ApiError(409, 'This presentation already exists.'));
  await expect(api.list()).rejects.toMatchObject({ status: 401 });
});
