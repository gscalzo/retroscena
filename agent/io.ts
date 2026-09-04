/**
 * Everything the client does to the outside world, behind one interface so
 * the logic is testable with a fake. `nodeIo` is the real one.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname } from 'node:path';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH';

export interface FetchInit {
  method: Method;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

export interface FetchResult {
  status: number;
  body: string;
}

export interface Io {
  env: Record<string, string | undefined>;
  homedir(): string;
  now(): number;
  /** null when the file does not exist. */
  readFile(path: string): string | null;
  /** Creates the parent directories. */
  writeFile(path: string, content: string): void;
  fetch(url: string, init: FetchInit): Promise<FetchResult>;
  stdout(text: string): void;
  stderr(text: string): void;
}

function readOrNull(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, init: FetchInit): Promise<FetchResult> {
  const res = await fetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
    signal: AbortSignal.timeout(init.timeoutMs),
  });
  return { status: res.status, body: await res.text() };
}

export const nodeIo: Io = {
  env: process.env,
  homedir,
  now: () => Date.now(),
  readFile: readOrNull,
  writeFile: (path, content) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf8');
  },
  fetch: fetchWithTimeout,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};
