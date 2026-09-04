/** A Worker on a fake D1 and a settable clock, for route tests. */
import type { Hono } from 'hono';
import type { CreateReq } from '../../shared/types';
import { createApp } from '../app';
import type { AppContext, Env } from '../app';
import { createFakeD1 } from './fake-d1';
import type { FakeD1Handle } from './fake-d1';

export interface TestApp {
  app: Hono<AppContext>;
  env: Env;
  raw: FakeD1Handle['raw'];
  clock: { now: number };
  /** While true, every INSERT INTO documents fails, as a lost race would. */
  failInserts: boolean;
  call(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<Response>;
}

function failing(): D1PreparedStatement {
  const stmt = {
    bind: () => stmt,
    run: () => Promise.reject(new Error('UNIQUE constraint failed')),
  };
  return stmt as unknown as D1PreparedStatement;
}

export function createTestApp(startAt = 1_700_000_000_000): TestApp {
  const { db, raw } = createFakeD1();
  const clock = { now: startAt };
  const t: Partial<TestApp> = { raw, clock, failInserts: false };
  const gated = new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === 'prepare') {
        return (sql: string) =>
          t.failInserts && sql.startsWith('INSERT INTO documents')
            ? failing()
            : target.prepare(sql);
      }
      return Reflect.get(target, prop, receiver) as unknown;
    },
  });
  const env: Env = { DB: gated, ACCESS_TEAM_DOMAIN: '', ACCESS_AUD: '' };
  const app = createApp(() => clock.now);
  const call: TestApp['call'] = async (method, path, body, headers = {}) =>
    app.request(
      path,
      {
        method,
        headers: { 'content-type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      env,
    );
  return Object.assign(t, { app, env, call }) as TestApp;
}

export const createReq = (over: Partial<CreateReq> = {}): CreateReq => ({
  title: 'The Confidence Gap',
  event: 'LDX3 New York',
  date: '2026-09-15',
  target: 25,
  ...over,
});

/** POST a presentation and return its slug. */
export async function seed(t: TestApp, over: Partial<CreateReq> = {}): Promise<string> {
  const res = await t.call('POST', '/api/presentations', createReq(over));
  const body = await res.json<{ presentation: { slug: string } }>();
  return body.presentation.slug;
}
