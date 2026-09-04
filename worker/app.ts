/**
 * Retroscena API — single Hono Worker (also serves the built site via the
 * assets config in wrangler.jsonc; only /api/* reaches this code thanks to
 * run_worker_first).
 *
 * Auth: Cloudflare Access sits in front of everything (ADR-0005).
 * accessVerification verifies the Cf-Access-Jwt-Assertion and tells the
 * owner (email) from an agent (service token); both may read and write
 * everything, and each revision records which of them wrote it. There is
 * deliberately no application-level auth beyond that — no users table.
 */
import { Hono } from 'hono';
import { accessVerification } from './access';
import type { Identity } from './access';
import { registerRoutes } from './routes';

export interface Env {
  DB: D1Database;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
}

export type AppContext = { Bindings: Env; Variables: { identity: Identity } };

export type Clock = () => number;

export function createApp(now: Clock): Hono<AppContext> {
  const app = new Hono<AppContext>().basePath('/api');

  app.use('*', accessVerification(now));
  app.get('/ping', (c) => c.json({ ok: true, caller: c.get('identity').kind }));
  registerRoutes(app, now);

  app.notFound((c) => c.json({ error: 'not found' }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'internal error' }, 500);
  });

  return app;
}
