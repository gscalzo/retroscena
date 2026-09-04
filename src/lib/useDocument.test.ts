// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api, ConflictError } from './api';
import { useDocument } from './useDocument';
import { newBench } from '../../shared/template';
import type { Bench, DocEnvelope, DocMeta, PutRes } from '../../shared/types';

const meta = { rev: 1, author: 'local', at: 100 };
const doc = newBench(25);
const changed = { ...doc, target: 30 };
const newer = { rev: 2, author: 'agent:macbook', at: 200 };
const key = 'retroscena:talk:bench';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(api, 'document').mockResolvedValue({ ...meta, doc });
  vi.spyOn(api, 'meta').mockResolvedValue(meta);
  vi.spyOn(api, 'put').mockResolvedValue({ rev: 2, at: 200 });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function loaded() {
  const hook = renderHook(() => useDocument<Bench>('talk', 'bench'));
  await waitFor(() => expect(hook.result.current.doc).not.toBeNull());
  return hook;
}

async function settle(action: () => void) {
  await act(async () => {
    action();
    await Promise.resolve();
  });
}

async function poll() {
  await settle(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

it('loads clean, stashes edits, and saves against the loaded revision', async () => {
  const { result } = await loaded();
  expect(result.current).toMatchObject({
    doc,
    baseRev: 1,
    dirty: false,
    saving: false,
    error: null,
    notice: null,
    conflict: null,
  });
  expect(api.document).toHaveBeenCalledWith('talk', 'bench');
  expect(api.meta).toHaveBeenCalledWith('talk', 'bench');
  await act(() => result.current.save());
  expect(api.put).not.toHaveBeenCalled();
  act(() => result.current.update(changed));
  expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual({ baseRev: 1, doc: changed });
  expect(result.current.dirty).toBe(true);
  expect(result.current.notice).toBeNull();
  await act(() => result.current.save());
  expect(api.put).toHaveBeenCalledWith('talk', 'bench', 1, changed);
  expect(result.current).toMatchObject({ baseRev: 2, dirty: false, saving: false });
  expect(sessionStorage.getItem(key)).toBeNull();
});

it('ignores save before load and rejects overlapping saves without losing later edits', async () => {
  const loading = deferred<DocEnvelope<Bench>>();
  vi.mocked(api.document).mockReturnValueOnce(loading.promise);
  const { result } = renderHook(() => useDocument<Bench>('talk', 'bench'));
  await act(() => result.current.save());
  expect(api.put).not.toHaveBeenCalled();
  await settle(() => loading.resolve({ ...meta, doc }));
  const saving = deferred<PutRes>();
  vi.mocked(api.put).mockReturnValueOnce(saving.promise);
  act(() => result.current.update(changed));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.save();
  });
  expect(result.current.saving).toBe(true);
  await act(() => result.current.save());
  expect(api.put).toHaveBeenCalledTimes(1);
  const later = { ...changed, target: 45 };
  act(() => result.current.update(later));
  await act(async () => {
    saving.resolve({ rev: 2, at: 200 });
    await pending;
  });
  expect(result.current).toMatchObject({ doc: later, dirty: true, baseRev: 2, saving: false });
  expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual({ baseRev: 2, doc: later });
});

it('restores matching stashes and discards stashes from older revisions with a notice', async () => {
  sessionStorage.setItem(key, JSON.stringify({ baseRev: 1, doc: changed }));
  const first = await loaded();
  expect(first.result.current).toMatchObject({ doc: changed, dirty: true, notice: null });
  first.unmount();
  vi.mocked(api.document).mockResolvedValue({ ...newer, doc });
  const second = await loaded();
  expect(second.result.current).toMatchObject({ doc, dirty: false, baseRev: 2 });
  expect(second.result.current.notice).toContain('discarded');
  expect(sessionStorage.getItem(key)).toBeNull();
});

it('warns if a tab cannot stash edits', async () => {
  const { result } = await loaded();
  vi.stubGlobal('sessionStorage', {
    setItem: () => {
      throw Error('quota');
    },
  });
  act(() => result.current.update(changed));
  expect(result.current.notice).toContain('backup');
  expect(result.current.doc).toEqual(changed);
});

it('reloads a clean document when the server advances, but leaves unchanged revisions alone', async () => {
  const { result } = await loaded();
  await poll();
  expect(api.document).toHaveBeenCalledTimes(1);
  vi.mocked(api.meta).mockResolvedValue(newer);
  vi.mocked(api.document).mockResolvedValue({ ...newer, doc: changed });
  await poll();
  expect(result.current).toMatchObject({ doc: changed, baseRev: 2, dirty: false });
  expect(api.document).toHaveBeenCalledTimes(2);
});

it('shows remote author and revision when dirty, permits keep editing and reload, and restores conflict on save', async () => {
  const { result } = await loaded();
  act(() => result.current.update(changed));
  vi.mocked(api.meta).mockResolvedValue(newer);
  await poll();
  expect(result.current.conflict).toEqual(newer);
  expect(api.document).toHaveBeenCalledTimes(1);
  act(() => result.current.keepEditing());
  expect(result.current.conflict).toBeNull();
  vi.mocked(api.put).mockRejectedValue(new ConflictError(newer));
  await act(() => result.current.save());
  expect(result.current).toMatchObject({ conflict: newer, dirty: true, saving: false });
  expect(result.current.error).toContain('revision');
  vi.mocked(api.document).mockResolvedValue({ ...newer, doc });
  await act(() => result.current.reload());
  expect(result.current).toMatchObject({
    doc,
    baseRev: 2,
    dirty: false,
    conflict: null,
    error: null,
  });
  expect(sessionStorage.getItem(key)).toBeNull();
});

it('does not reload during a pending save', async () => {
  const { result } = await loaded();
  act(() => result.current.update(changed));
  const saving = deferred<PutRes>();
  vi.mocked(api.put).mockReturnValueOnce(saving.promise);
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.save();
  });
  vi.mocked(api.meta).mockResolvedValue(newer);
  await poll();
  expect(result.current.conflict).toBeNull();
  expect(api.document).toHaveBeenCalledTimes(1);
  await act(async () => {
    saving.resolve({ rev: 2, at: 200 });
    await pending;
  });
});

it('reports network failures without losing edits and allows retry', async () => {
  vi.mocked(api.document).mockRejectedValueOnce('offline');
  const { result } = renderHook(() => useDocument<Bench>('talk', 'bench'));
  await waitFor(() => expect(result.current.error).toBe('offline'));
  await act(() => result.current.reload());
  act(() => result.current.update(changed));
  vi.mocked(api.put).mockRejectedValueOnce(Error('save offline'));
  await act(() => result.current.save());
  expect(result.current).toMatchObject({
    error: 'save offline',
    conflict: null,
    doc: changed,
    dirty: true,
    saving: false,
  });
  await act(() => result.current.save());
  expect(result.current.error).toBeNull();
  vi.mocked(api.meta).mockRejectedValueOnce(Error('poll offline'));
  await poll();
  expect(result.current.error).toBe('poll offline');
});

it('uses Cmd/Ctrl+S and warns before unloading only with unsaved changes', async () => {
  const { result, unmount } = await loaded();
  const clean = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(clean);
  expect(clean.defaultPrevented).toBe(false);
  act(() => result.current.update(changed));
  const dirty = new Event('beforeunload', { cancelable: true });
  const prevent = vi.spyOn(dirty, 'preventDefault');
  window.dispatchEvent(dirty);
  expect(prevent).toHaveBeenCalledOnce();
  expect(dirty.defaultPrevented).toBe(true);
  for (const init of [{ key: 's' }, { key: 'x', metaKey: true }]) {
    window.dispatchEvent(new KeyboardEvent('keydown', init));
  }
  expect(api.put).not.toHaveBeenCalled();
  for (const modifier of ['metaKey', 'ctrlKey']) {
    act(() => result.current.update(changed));
    const event = new KeyboardEvent('keydown', { key: 'S', [modifier]: true, cancelable: true });
    await settle(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
  }
  expect(api.put).toHaveBeenCalledTimes(2);
  unmount();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true }));
  expect(api.put).toHaveBeenCalledTimes(2);
});

it('polls every five seconds', async () => {
  vi.useFakeTimers();
  renderHook(() => useDocument<Bench>('talk', 'bench'));
  await act(async () => {
    await Promise.resolve();
  });
  expect(api.meta).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(4999));
  expect(api.meta).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(api.meta).toHaveBeenCalledTimes(2);
});

it('ignores stale loads, saves and polling after changing presentation', async () => {
  const old = deferred<DocEnvelope<Bench>>();
  vi.mocked(api.document).mockReturnValueOnce(old.promise);
  const { result, rerender } = renderHook(({ slug }) => useDocument<Bench>(slug, 'bench'), {
    initialProps: { slug: 'old' },
  });
  rerender({ slug: 'talk' });
  await waitFor(() => expect(result.current.doc).toEqual(doc));
  await settle(() => old.resolve({ ...newer, doc: changed }));
  expect(result.current.doc).toEqual(doc);
  const oldPoll = deferred<DocMeta>();
  vi.mocked(api.meta).mockReturnValueOnce(oldPoll.promise);
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const oldSave = deferred<PutRes>();
  vi.mocked(api.put).mockReturnValueOnce(oldSave.promise);
  act(() => {
    result.current.update(changed);
    void result.current.save();
  });
  rerender({ slug: 'next' });
  await waitFor(() => expect(result.current.dirty).toBe(false));
  await settle(() => {
    oldSave.resolve({ rev: 20, at: 20 });
    oldPoll.resolve({ ...newer, rev: 30 });
  });
  expect(result.current).toMatchObject({ doc, baseRev: 1, conflict: null });
});

it('ignores stale rejections and preserves edits made during a reload', async () => {
  const { result, unmount } = await loaded();
  const loading = deferred<DocEnvelope<Bench>>();
  vi.mocked(api.document).mockReturnValueOnce(loading.promise);
  act(() => {
    void result.current.reload();
    result.current.update(changed);
  });
  await settle(() => loading.resolve({ ...newer, doc }));
  expect(result.current.doc).toEqual(changed);
  const oldSave = deferred<PutRes>();
  const oldLoad = deferred<DocEnvelope<Bench>>();
  vi.mocked(api.put).mockReturnValueOnce(oldSave.promise);
  vi.mocked(api.document).mockReturnValueOnce(oldLoad.promise);
  act(() => {
    void result.current.save();
    void result.current.reload();
  });
  unmount();
  await settle(() => {
    oldSave.reject(Error('stale save'));
    oldLoad.reject(Error('stale load'));
  });
});

it('resets loading state and uses the new slug for stash, save and shortcut after navigation', async () => {
  const { result, rerender } = renderHook(({ slug }) => useDocument<Bench>(slug, 'bench'), {
    initialProps: { slug: 'old' },
  });
  await waitFor(() => expect(result.current.doc).toEqual(doc));
  act(() => result.current.update(changed));
  const loading = deferred<DocEnvelope<Bench>>();
  vi.mocked(api.document).mockReturnValueOnce(loading.promise);
  rerender({ slug: 'talk' });
  expect(result.current).toMatchObject({ doc: null, dirty: false, baseRev: 0 });
  await settle(() => loading.resolve({ ...meta, doc }));
  act(() => result.current.update(changed));
  expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual({ baseRev: 1, doc: changed });
  await settle(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
  });
  expect(api.put).toHaveBeenCalledWith('talk', 'bench', 1, changed);
  expect(sessionStorage.getItem(key)).toBeNull();
});

it('ignores old errors and remote revision responses after navigation', async () => {
  const { result, rerender } = renderHook(({ slug }) => useDocument<Bench>(slug, 'bench'), {
    initialProps: { slug: 'old' },
  });
  await waitFor(() => expect(result.current.doc).toEqual(doc));
  const loading = deferred<DocEnvelope<Bench>>();
  const saving = deferred<PutRes>();
  const metadata = deferred<DocMeta>();
  vi.mocked(api.put).mockReturnValueOnce(saving.promise);
  vi.mocked(api.document).mockReturnValueOnce(loading.promise);
  vi.mocked(api.meta).mockReturnValueOnce(metadata.promise);
  act(() => {
    result.current.update(changed);
    void result.current.save();
    void result.current.reload();
    document.dispatchEvent(new Event('visibilitychange'));
  });
  rerender({ slug: 'talk' });
  await waitFor(() => expect(result.current.doc).toEqual(doc));
  await settle(() => {
    saving.reject(Error('stale save'));
    loading.reject(Error('stale load'));
  });
  expect(result.current.error).toBeNull();
  const calls = vi.mocked(api.document).mock.calls.length;
  await settle(() => metadata.resolve(newer));
  expect(api.document).toHaveBeenCalledTimes(calls);
  expect(result.current.error).toBeNull();
});

it('accepts only the latest of overlapping reloads', async () => {
  const { result } = await loaded();
  const first = deferred<DocEnvelope<Bench>>();
  const second = deferred<DocEnvelope<Bench>>();
  vi.mocked(api.document).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  act(() => {
    void result.current.reload();
    void result.current.reload();
  });
  await settle(() => first.resolve({ ...newer, doc: changed }));
  expect(result.current).toMatchObject({ doc, baseRev: 1 });
  await settle(() => second.resolve({ ...newer, rev: 3, doc }));
  expect(result.current.baseRev).toBe(3);
});

it('explicit and polled reloads do not restore recovery copies', async () => {
  const { result } = await loaded();
  act(() => result.current.update(changed));
  await act(() => result.current.reload());
  expect(result.current).toMatchObject({ doc, dirty: false });
  sessionStorage.setItem(key, JSON.stringify({ baseRev: 2, doc: changed }));
  vi.mocked(api.meta).mockResolvedValue(newer);
  vi.mocked(api.document).mockResolvedValue({ ...newer, doc });
  await poll();
  expect(result.current).toMatchObject({ doc, dirty: false, baseRev: 2 });
});

it('cancels loads at unmount without modifying the recovery copy', async () => {
  const loading = deferred<DocEnvelope<Bench>>();
  vi.mocked(api.document).mockReturnValueOnce(loading.promise);
  const hook = renderHook(() => useDocument<Bench>('talk', 'bench'));
  expect(hook.result.current.dirty).toBe(false);
  hook.unmount();
  sessionStorage.setItem(key, 'keep this');
  await settle(() => loading.resolve({ ...meta, doc }));
  expect(sessionStorage.getItem(key)).toBe('keep this');
});

it('preserves edits made during a save after navigating away and back', async () => {
  const first = await loaded();
  const saving = deferred<PutRes>();
  vi.mocked(api.put).mockReturnValueOnce(saving.promise);
  act(() => {
    first.result.current.update(changed);
    void first.result.current.save();
  });
  const later = { ...doc, target: 45 };
  act(() => first.result.current.update(later));
  first.unmount();
  await settle(() => saving.resolve({ rev: 2, at: 200 }));
  expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual({ baseRev: 2, doc: later });
  vi.mocked(api.document).mockResolvedValue({ ...newer, doc: changed });
  const second = await loaded();
  expect(second.result.current).toMatchObject({
    doc: later,
    baseRev: 2,
    dirty: true,
    notice: null,
  });
});

it('keeps a dismissed conflict hidden until a newer remote save or a save conflict', async () => {
  const { result } = await loaded();
  act(() => result.current.keepEditing());
  act(() => result.current.update(changed));
  vi.mocked(api.meta).mockResolvedValue(newer);
  await poll();
  act(() => result.current.keepEditing());
  await poll();
  expect(result.current.conflict).toBeNull();
  vi.mocked(api.put).mockRejectedValueOnce(new ConflictError(newer));
  await act(() => result.current.save());
  expect(result.current.conflict).toEqual(newer);
  act(() => result.current.keepEditing());
  vi.mocked(api.meta).mockResolvedValue({ ...newer, rev: 3 });
  await poll();
  expect(result.current.conflict?.rev).toBe(3);
});

it('rebases an already reopened draft when its earlier save completes', async () => {
  const first = await loaded();
  const saving = deferred<PutRes>();
  vi.mocked(api.put).mockReturnValueOnce(saving.promise);
  act(() => {
    first.result.current.update(changed);
    void first.result.current.save();
  });
  const later = { ...doc, target: 45 };
  act(() => first.result.current.update(later));
  first.unmount();
  const second = await loaded();
  expect(second.result.current).toMatchObject({ doc: later, baseRev: 1, dirty: true });
  await settle(() => saving.resolve({ rev: 2, at: 200 }));
  expect(second.result.current).toMatchObject({ doc: later, baseRev: 2, dirty: true });
  const latest = { ...later, target: 50 };
  act(() => second.result.current.update(latest));
  expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual({ baseRev: 2, doc: latest });
  await act(() => second.result.current.save());
  expect(api.put).toHaveBeenLastCalledWith('talk', 'bench', 2, latest);
});
