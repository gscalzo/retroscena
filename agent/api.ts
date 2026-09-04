/** One typed call to the Worker, with the Access service-token headers, and the API's paths. */
import type { DocKind } from '../shared/types';
import type { Config } from './config';
import type { Io, Method } from './io';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The server's JSON body when it sent one (a conflict carries the current rev), else null. */
    readonly body: unknown,
  ) {
    super(message);
  }
}

export interface Call {
  method: Method;
  path: string;
  body?: unknown;
  timeoutMs: number;
}

export function presentationPath(slug: string): string {
  return `/api/presentations/${encodeURIComponent(slug)}`;
}

export function docPath(slug: string, kind: DocKind): string {
  return `${presentationPath(slug)}/${kind}`;
}

function headers(config: Config): Record<string, string> {
  const base: Record<string, string> = { 'content-type': 'application/json' };
  if (config.clientId && config.clientSecret) {
    base['CF-Access-Client-Id'] = config.clientId;
    base['CF-Access-Client-Secret'] = config.clientSecret;
  }
  return base;
}

/** The body as JSON, or null when it is not JSON. */
function parseBody(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** The server's `error` string when it sent one, else the status line. */
function errorMessage(body: unknown, status: number): string {
  const error = (body as { error?: unknown } | null)?.error;
  return typeof error === 'string' ? error : `HTTP ${status}`;
}

export async function call<T>(io: Io, config: Config, req: Call): Promise<T> {
  const res = await io.fetch(`${config.url}${req.path}`, {
    method: req.method,
    headers: headers(config),
    // JSON.stringify(undefined) is undefined: no body on a bodiless call.
    body: JSON.stringify(req.body),
    timeoutMs: req.timeoutMs,
  });
  if (res.status < 200 || res.status >= 300) {
    const body = parseBody(res.body);
    throw new ApiError(res.status, errorMessage(body, res.status), body);
  }
  if (res.body.trimStart().startsWith('<')) {
    throw new ApiError(
      res.status,
      'the server answered with a page, not JSON — is the Access token set?',
      null,
    );
  }
  return JSON.parse(res.body) as T;
}

/** Read calls share the same network timeout across all CLI verbs. */
export function get<T>(io: Io, config: Config, path: string): Promise<T> {
  return call<T>(io, config, { method: 'GET', path, timeoutMs: 15_000 });
}
