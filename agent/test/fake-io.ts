/** An in-memory Io for the client tests: files, env, fetch, output. */
import type { FetchInit, FetchResult, Io } from '../io';

export interface FakeIo {
  io: Io;
  files: Map<string, string>;
  requests: { url: string; init: FetchInit }[];
  out: string[];
  err: string[];
}

export interface FakeOptions {
  env?: Record<string, string | undefined>;
  files?: Record<string, string>;
  /** Queued answers; when exhausted, fetch rejects with `fetch failed`. */
  responses?: (FetchResult | Error)[];
  now?: number;
}

export function fakeIo(opts: FakeOptions = {}): FakeIo {
  const files = new Map(Object.entries(opts.files ?? {}));
  const responses = [...(opts.responses ?? [])];
  const fake: FakeIo = { files, requests: [], out: [], err: [], io: undefined as unknown as Io };
  fake.io = {
    env: opts.env ?? {},
    homedir: () => '/home/gio',
    now: () => opts.now ?? 1_700_000_000_000,
    readFile: (path) => files.get(path) ?? null,
    writeFile: (path, content) => void files.set(path, content),
    fetch: (url, init) => {
      fake.requests.push({ url, init });
      const next = responses.shift() ?? new Error('fetch failed');
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
    stdout: (text) => void fake.out.push(text),
    stderr: (text) => void fake.err.push(text),
  };
  return fake;
}

export const json = (status: number, body: unknown): FetchResult => ({
  status,
  body: JSON.stringify(body),
});
