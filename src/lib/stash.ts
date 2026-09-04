import { benchSchema, roomSchema } from '../../shared/schema';
import { z } from 'zod';
import type { Bench, Room, DocKind } from '../../shared/types';

type Rebased = (key: string, baseRev: number, rev: number) => void;
const observers = new Set<Rebased>();

export function onStashRebased(observer: Rebased): () => void {
  observers.add(observer);
  return () => {
    observers.delete(observer);
  };
}

export function readStash<T extends Bench | Room>(
  key: string,
  kind: DocKind,
): { baseRev: number; doc: T } | null {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    const schema = z.object({
      baseRev: z.number(),
      doc: kind === 'bench' ? benchSchema : roomSchema,
    });
    const parsed = schema.parse(raw);
    return { baseRev: parsed.baseRev, doc: parsed.doc as T };
  } catch {
    return null;
  }
}

export function writeStash(key: string, value: unknown): boolean {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** A completed save must advance the recovery copy even after its page unmounts. */
export function rebaseStash<T extends Bench | Room>(
  key: string,
  kind: DocKind,
  saved: { baseRev: number; doc: T },
  rev: number,
): void {
  const draft = readStash<T>(key, kind);
  if (draft?.baseRev !== saved.baseRev) return;
  const unchanged = JSON.stringify(draft.doc) === JSON.stringify(saved.doc);
  writeStash(key, unchanged ? null : { ...draft, baseRev: rev });
  observers.forEach((observer) => observer(key, saved.baseRev, rev));
}
