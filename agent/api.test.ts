import { describe, expect, it } from 'vitest';
import { ApiError, call, docPath, presentationPath } from './api';
import type { Config } from './config';
import { fakeIo, json } from './test/fake-io';

const config: Config = { url: 'https://rs.test', clientId: 'id', clientSecret: 'secret' };
const anonymous: Config = { url: 'https://rs.test', clientId: 'id', clientSecret: null };

describe('paths', () => {
  it('encodes the slug', () => {
    expect(presentationPath('a b/c')).toBe('/api/presentations/a%20b%2Fc');
    expect(docPath('talk', 'room')).toBe('/api/presentations/talk/room');
  });
});

describe('call', () => {
  it('sends the token headers, the JSON body and the timeout', async () => {
    const fake = fakeIo({ responses: [json(201, { ok: 1 })] });
    const res = await call(fake.io, config, {
      method: 'POST',
      path: '/api/x',
      body: { a: 1 },
      timeoutMs: 1234,
    });
    expect(res).toEqual({ ok: 1 });
    expect(fake.requests).toEqual([
      {
        url: 'https://rs.test/api/x',
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'CF-Access-Client-Id': 'id',
            'CF-Access-Client-Secret': 'secret',
          },
          body: '{"a":1}',
          timeoutMs: 1234,
        },
      },
    ]);
  });

  it('sends no token headers and no body when there are none', async () => {
    const fake = fakeIo({ responses: [json(200, [])] });
    await call(fake.io, anonymous, { method: 'GET', path: '/api/ping', timeoutMs: 1 });
    expect(fake.requests[0].init).toEqual({
      method: 'GET',
      headers: { 'content-type': 'application/json' },
      body: undefined,
      timeoutMs: 1,
    });
  });

  it('accepts every 2xx and refuses everything else', async () => {
    const fake = fakeIo({
      responses: [json(200, 1), json(299, 2), json(300, 3), json(199, 4)],
    });
    const req = { method: 'GET' as const, path: '/', timeoutMs: 1 };
    expect(await call(fake.io, config, req)).toBe(1);
    expect(await call(fake.io, config, req)).toBe(2);
    await expect(call(fake.io, config, req)).rejects.toMatchObject({ status: 300 });
    await expect(call(fake.io, config, req)).rejects.toMatchObject({ status: 199 });
  });

  it('carries the server reason and body, or the status line', async () => {
    const fake = fakeIo({
      responses: [
        json(409, { error: 'stale', current: { rev: 2 } }),
        { status: 502, body: 'bad gateway' },
        json(500, { error: 5 }),
      ],
    });
    const req = { method: 'PUT' as const, path: '/', timeoutMs: 1 };
    const conflict = await call(fake.io, config, req).catch((e: unknown) => e);
    expect(conflict).toBeInstanceOf(ApiError);
    expect(conflict).toMatchObject({
      status: 409,
      message: 'stale',
      body: { error: 'stale', current: { rev: 2 } },
    });
    await expect(call(fake.io, config, req)).rejects.toMatchObject({
      status: 502,
      message: 'HTTP 502',
      body: null,
    });
    await expect(call(fake.io, config, req)).rejects.toMatchObject({
      status: 500,
      message: 'HTTP 500',
      body: { error: 5 },
    });
  });

  it('refuses a page in place of JSON, even with leading whitespace', async () => {
    const fake = fakeIo({
      responses: [
        { status: 200, body: '\n  <!doctype html>' },
        { status: 200, body: '<html>' },
      ],
    });
    const req = { method: 'GET' as const, path: '/', timeoutMs: 1 };
    await expect(call(fake.io, config, req)).rejects.toMatchObject({
      status: 200,
      message: expect.stringContaining('Access token') as string,
      body: null,
    });
    await expect(call(fake.io, config, req)).rejects.toBeInstanceOf(ApiError);
  });
});
