// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from './api';
import { rebaseStash, writeStash } from './stash';
import { useDocument } from './useDocument';
import { newBench } from '../../shared/template';
import type { Bench } from '../../shared/types';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

it('follows the selected presentation and ignores recovery events from older revisions', async () => {
  const doc = newBench(25);
  const meta = { rev: 3, author: 'local', at: 100 };
  vi.spyOn(api, 'document').mockResolvedValue({ ...meta, doc });
  vi.spyOn(api, 'meta').mockResolvedValue(meta);
  const hook = renderHook(({ slug }) => useDocument<Bench>(slug, 'bench'), {
    initialProps: { slug: 'first' },
  });
  await waitFor(() => expect(hook.result.current.baseRev).toBe(3));
  hook.rerender({ slug: 'second' });
  await waitFor(() => expect(hook.result.current.doc).toEqual(doc));
  const key = 'retroscena:second:bench';
  const saved = { baseRev: 1, doc };
  writeStash(key, saved);
  act(() => rebaseStash(key, 'bench', saved, 2));
  expect(hook.result.current.baseRev).toBe(3);
  const current = { baseRev: 3, doc };
  writeStash(key, current);
  act(() => rebaseStash(key, 'bench', current, 4));
  expect(hook.result.current.baseRev).toBe(4);
});
