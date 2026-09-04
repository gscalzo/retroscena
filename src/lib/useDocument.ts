import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bench, Room, DocKind, DocMeta } from '../../shared/types';
import { api, ConflictError } from './api';
import { onStashRebased, readStash, rebaseStash, writeStash } from './stash';
import { usePoll } from './usePoll';

interface State<T> {
  doc: T | null;
  baseRev: number;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  notice: string | null;
  conflict: DocMeta | null;
  dismissedRev: number;
}

const empty = <T>(): State<T> => ({
  doc: null,
  baseRev: 0,
  dirty: false,
  saving: false,
  error: null,
  notice: null,
  conflict: null,
  dismissedRev: 0,
});
const staleNotice = (stashed: boolean, matches: boolean) =>
  stashed && !matches ? 'Unsaved edits from an older revision were discarded.' : null;
const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function useDocument<T extends Bench | Room>(slug: string, kind: DocKind) {
  const key = `retroscena:${slug}:${kind}`;
  const [state, render] = useState<State<T>>(empty);
  const current = useRef(state);
  const generation = useRef(0);
  const cancel = useRef(() => {
    generation.current++;
  }).current;
  const set = useRef((patch: Partial<State<T>>) => {
    current.current = { ...current.current, ...patch };
    render(current.current);
  }).current;

  const load = useCallback(
    async (restore: boolean) => {
      const epoch = ++generation.current;
      const before = current.current.doc;
      try {
        const envelope = await api.document<T>(slug, kind);
        if (epoch !== generation.current || before !== current.current.doc) return;
        const stash = restore ? readStash<T>(key, kind) : null;
        const matches = stash?.baseRev === envelope.rev;
        const doc = matches ? stash.doc : envelope.doc;
        set({
          ...empty<T>(),
          doc,
          baseRev: envelope.rev,
          dirty: matches,
          notice: staleNotice(stash !== null, matches),
        });
        if (!matches) writeStash(key, null);
      } catch (error) {
        if (epoch === generation.current) set({ error: reason(error) });
      }
    },
    [slug, kind, key, set],
  );

  useEffect(() => {
    set(empty<T>());
    void load(true);
    return cancel;
  }, [load, set, cancel]);

  useEffect(
    () =>
      onStashRebased((savedKey, baseRev, rev) => {
        if (savedKey === key && current.current.baseRev === baseRev) set({ baseRev: rev });
      }),
    [key, set],
  );

  const update = useCallback(
    (doc: T) => {
      set({ doc, dirty: true });
      const stored = writeStash(key, { baseRev: current.current.baseRev, doc });
      if (!stored)
        set({ notice: 'This tab cannot keep a backup. Save your changes before leaving.' });
    },
    [key, set],
  );

  const save = useCallback(async () => {
    const snapshot = current.current;
    if (!snapshot.doc || !snapshot.dirty || snapshot.saving) return;
    const epoch = generation.current;
    set({ saving: true, error: null });
    try {
      const saved = await api.put(slug, kind, snapshot.baseRev, snapshot.doc);
      rebaseStash(key, kind, { baseRev: snapshot.baseRev, doc: snapshot.doc }, saved.rev);
      if (epoch !== generation.current) return;
      const dirty = current.current.doc !== snapshot.doc;
      set({ baseRev: saved.rev, dirty, saving: false, conflict: null });
      writeStash(key, dirty ? { baseRev: saved.rev, doc: current.current.doc } : null);
    } catch (error) {
      if (epoch !== generation.current) return;
      set({ saving: false, error: reason(error) });
      if (error instanceof ConflictError) set({ conflict: error.current });
    }
  }, [slug, kind, key, set]);

  const poll = usePoll(
    async () => {
      const epoch = generation.current;
      const meta = await api.meta(slug, kind);
      if (epoch !== generation.current) return meta;
      const snapshot = current.current;
      if (snapshot.baseRev > 0 && meta.rev > snapshot.baseRev && !snapshot.saving) {
        if (snapshot.dirty) {
          if (meta.rev !== snapshot.dismissedRev) set({ conflict: meta });
        } else await load(false);
      }
      return meta;
    },
    5000,
    key,
  );

  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (current.current.dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('keydown', shortcut);
    return () => {
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener('keydown', shortcut);
    };
  }, [save]);

  return {
    ...state,
    error: state.error ?? poll.error,
    update,
    save,
    reload: () => load(false),
    keepEditing: () => set({ dismissedRev: current.current.conflict?.rev ?? 0, conflict: null }),
  };
}
