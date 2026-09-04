import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AccessClaims } from './access';
import {
  authorOf,
  base64UrlDecode,
  checkClaims,
  decodeJwt,
  identityFromClaims,
  issuerFor,
  resetCertsCache,
  verifyJwtWithKeys,
} from './access';
import { createTestApp } from './test/harness';
import { claimsFor, encodePart, generateKey, signJwt } from './test/jwt';
import type { TestKey } from './test/jwt';

const TEAM = 'team-x';
const AUD = 'aud-x';
const ISS = issuerFor(TEAM);
const expected = { aud: AUD, iss: ISS };
const nowMs = 1_700_000_000_000;
const nowS = nowMs / 1000;

let key: TestKey;
beforeAll(async () => {
  key = await generateKey('kid-1');
});

describe('base64UrlDecode', () => {
  it('decodes url-safe base64 without padding', () => {
    expect(new TextDecoder().decode(base64UrlDecode('aGk')!)).toBe('hi');
    expect(new TextDecoder().decode(base64UrlDecode('Pz8_')!)).toBe('???');
  });
  it('returns null for input atob rejects', () => {
    expect(base64UrlDecode('%%%')).toBeNull();
  });
});

describe('decodeJwt', () => {
  it('rejects the wrong number of parts and undecodable parts', () => {
    expect(decodeJwt('a.b')).toBeNull();
    expect(decodeJwt('%%%.b.c')).toBeNull();
    expect(decodeJwt('a.%%%.c')).toBeNull();
    expect(decodeJwt('a.b.%%%')).toBeNull();
  });
  it('rejects parts that are not JSON objects', () => {
    expect(decodeJwt(`${encodePart(1)}.${encodePart({})}.AQ`)).toBeNull();
    expect(decodeJwt(`${encodePart({})}.${encodePart('x')}.AQ`)).toBeNull();
    expect(decodeJwt(`${encodePart({})}.${encodePart(null)}.AQ`)).toBeNull();
    expect(decodeJwt(`bm90anNvbg.${encodePart({})}.AQ`)).toBeNull();
    expect(decodeJwt(`${encodePart({})}.${encodePart({})}.%%%`)).toBeNull();
    expect(decodeJwt(`${encodePart({})}.${encodePart({})}.AQ.extra`)).toBeNull();
  });
  it('decodes header, payload and the signed bytes', () => {
    const token = `${encodePart({ alg: 'RS256', kid: 'k' })}.${encodePart({ aud: 'a' })}.AQ`;
    const decoded = decodeJwt(token)!;
    expect(decoded.header).toEqual({ alg: 'RS256', kid: 'k' });
    expect(decoded.payload).toEqual({ aud: 'a' });
    expect(new TextDecoder().decode(decoded.signedData)).toBe(token.slice(0, -3));
    expect(decoded.signature).toEqual(new Uint8Array([1]));
  });
});

describe('checkClaims', () => {
  it('accepts a matching audience as string or array', () => {
    expect(checkClaims({ aud: AUD, iss: ISS, exp: nowS + 1 }, expected, nowS)).toBeNull();
    expect(
      checkClaims({ aud: ['other', AUD], iss: ISS, exp: nowS + 1 }, expected, nowS),
    ).toBeNull();
  });
  it('names the failing claim', () => {
    expect(checkClaims({ aud: 'nope', iss: ISS, exp: nowS + 1 }, expected, nowS)).toBe(
      'audience mismatch',
    );
    expect(checkClaims({ aud: ['nope'], iss: ISS, exp: nowS + 1 }, expected, nowS)).toBe(
      'audience mismatch',
    );
    expect(checkClaims({ aud: AUD, iss: 'https://evil', exp: nowS + 1 }, expected, nowS)).toBe(
      'issuer mismatch',
    );
    expect(checkClaims({ aud: AUD, iss: ISS }, expected, nowS)).toBe('token expired');
    expect(checkClaims({ aud: AUD, iss: ISS, exp: nowS - 61 }, expected, nowS)).toBe(
      'token expired',
    );
    expect(checkClaims({ aud: AUD, iss: ISS, exp: nowS - 60 }, expected, nowS)).toBeNull();
    expect(checkClaims({ aud: AUD, iss: ISS, exp: nowS + 1, nbf: nowS + 61 }, expected, nowS)).toBe(
      'token not yet valid',
    );
    expect(
      checkClaims({ aud: AUD, iss: ISS, exp: nowS + 1, nbf: nowS + 60 }, expected, nowS),
    ).toBeNull();
  });
});

describe('identityFromClaims', () => {
  it('reads the owner from the email and an agent from the service token name', () => {
    expect(identityFromClaims({ email: 'me@example.com' })).toEqual({
      kind: 'owner',
      email: 'me@example.com',
    });
    expect(identityFromClaims({ common_name: 'tok.access' })).toEqual({
      kind: 'agent',
      name: 'tok.access',
    });
    expect(identityFromClaims({ email: 'me@example.com', common_name: 'tok' })).toEqual({
      kind: 'owner',
      email: 'me@example.com',
    });
  });
  it('is nobody without either', () => {
    expect(identityFromClaims({})).toBeNull();
    expect(identityFromClaims({ email: '', common_name: '' })).toBeNull();
    expect(identityFromClaims({ email: 3, common_name: 4 } as unknown as AccessClaims)).toBeNull();
  });
});

describe('issuerFor', () => {
  it('is the team on cloudflareaccess.com', () => {
    expect(issuerFor('plain')).toBe('https://plain.cloudflareaccess.com');
  });
});

describe('verifyJwtWithKeys', () => {
  it('rejects malformed tokens, other algorithms, unknown or unusable keys', async () => {
    expect(await verifyJwtWithKeys('nope', [key.jwk], expected, nowMs)).toEqual({
      failure: 'malformed token',
    });
    const hs = await signJwt(key, claimsFor(AUD, ISS, nowS), { alg: 'HS256', kid: 'kid-1' });
    expect(await verifyJwtWithKeys(hs, [key.jwk], expected, nowMs)).toEqual({
      failure: 'unsupported algorithm',
    });
    const token = await signJwt(key, claimsFor(AUD, ISS, nowS));
    expect(await verifyJwtWithKeys(token, [], expected, nowMs)).toEqual({
      failure: 'no matching signing key',
    });
    expect(await verifyJwtWithKeys(token, [{ ...key.jwk, kty: 'EC' }], expected, nowMs)).toEqual({
      failure: 'no matching signing key',
    });
    expect(await verifyJwtWithKeys(token, [{ kty: 'RSA', kid: 'kid-1' }], expected, nowMs)).toEqual(
      { failure: 'unusable signing key' },
    );
  });
  it('rejects a bad signature and bad claims', async () => {
    const token = await signJwt(key, claimsFor(AUD, ISS, nowS));
    const [h, , s] = token.split('.');
    const tampered = `${h}.${encodePart(claimsFor(AUD, ISS, nowS, { email: 'x' }))}.${s}`;
    expect(await verifyJwtWithKeys(tampered, [key.jwk], expected, nowMs)).toEqual({
      failure: 'bad signature',
    });
    const other = await signJwt(key, claimsFor('other-aud', ISS, nowS));
    expect(await verifyJwtWithKeys(other, [key.jwk], expected, nowMs)).toEqual({
      failure: 'audience mismatch',
    });
  });
  it('returns the claims of a valid token', async () => {
    const claims = claimsFor(AUD, ISS, nowS, { email: 'me@example.com' });
    const token = await signJwt(key, claimsFor(AUD, ISS, nowS, { email: 'me@example.com' }));
    expect(await verifyJwtWithKeys(token, [key.jwk], expected, nowMs)).toEqual({ claims });
  });
});

describe('accessVerification middleware', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const certs = (keys: unknown, ok = true) =>
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ keys }), { status: ok ? 200 : 500 }),
    );
  const gated = () => {
    const t = createTestApp(nowMs);
    t.env.ACCESS_TEAM_DOMAIN = TEAM;
    t.env.ACCESS_AUD = AUD;
    return t;
  };
  const ownerToken = () => signJwt(key, claimsFor(AUD, ISS, nowS, { email: 'me@example.com' }));
  const agentToken = () => signJwt(key, claimsFor(AUD, ISS, nowS, { common_name: 'tok.access' }));
  const auth = (token: string) => ({ 'Cf-Access-Jwt-Assertion': token });

  beforeAll(() => {
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    resetCertsCache();
  });

  it('is local when the vars are blank', async () => {
    const t = createTestApp();
    const res = await t.call('GET', '/api/ping');
    expect(await res.json()).toEqual({ ok: true, caller: 'local' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('demands the header', async () => {
    const res = await gated().call('GET', '/api/ping');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'missing Cf-Access-Jwt-Assertion header' });
  });

  it('fails when the certs cannot be loaded', async () => {
    const t = gated();
    certs([], false);
    expect((await t.call('GET', '/api/ping', undefined, auth(await ownerToken()))).status).toBe(
      401,
    );
    fetchMock.mockResolvedValueOnce(new Response('not json'));
    expect((await t.call('GET', '/api/ping', undefined, auth(await ownerToken()))).status).toBe(
      401,
    );
    certs('not-a-list');
    const res = await t.call('GET', '/api/ping', undefined, auth(await ownerToken()));
    expect(await res.json()).toEqual({ error: 'could not load Access signing keys' });
  });

  it('fetches the certs from the team domain and caches them for an hour', async () => {
    const t = gated();
    certs([key.jwk]);
    const first = await t.call('GET', '/api/ping', undefined, auth(await ownerToken()));
    expect(await first.json()).toEqual({ ok: true, caller: 'owner' });
    expect(fetchMock).toHaveBeenCalledWith(`${ISS}/cdn-cgi/access/certs`);
    const second = await t.call('GET', '/api/ping', undefined, auth(await agentToken()));
    expect(await second.json()).toEqual({ ok: true, caller: 'agent' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    t.clock.now += 60 * 60 * 1000 - 1;
    const fresh = await signJwt(key, claimsFor(AUD, ISS, t.clock.now / 1000, { email: 'me@x' }));
    expect((await t.call('GET', '/api/ping', undefined, auth(fresh))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    t.clock.now += 1;
    certs([key.jwk]);
    expect((await t.call('GET', '/api/ping', undefined, auth(fresh))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    t.env.ACCESS_TEAM_DOMAIN = 'team-y';
    certs([key.jwk]);
    await t.call('GET', '/api/ping', undefined, auth(fresh));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://team-y.cloudflareaccess.com/cdn-cgi/access/certs',
    );
  });

  it.each(['ACCESS_AUD', 'ACCESS_TEAM_DOMAIN'] as const)(
    'rejects incomplete Access configuration when %s is blank',
    async (setting) => {
      const t = gated();
      t.env[setting] = '';
      const response = await t.call('GET', '/api/ping');
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'incomplete Access configuration' });
    },
  );

  it('does not refetch for a token without a kid, nor when the kid is among several keys', async () => {
    const t = gated();
    const other = await generateKey('kid-9');
    certs([other.jwk, key.jwk]);
    const anonymous = await signJwt(key, claimsFor(AUD, ISS, nowS, { email: 'me@x' }), {
      alg: 'RS256',
    });
    expect(await (await t.call('GET', '/api/ping', undefined, auth(anonymous))).json()).toEqual({
      error: 'no matching signing key',
    });
    expect((await t.call('GET', '/api/ping', undefined, auth(await ownerToken()))).status).toBe(
      200,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const malformed = await t.call('GET', '/api/ping', undefined, auth('nope'));
    expect(await malformed.json()).toEqual({ error: 'malformed token' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches once for an unknown kid, then rejects an unknown signer', async () => {
    const t = gated();
    const rotated = await generateKey('kid-2');
    certs([key.jwk]);
    certs([rotated.jwk]);
    const res = await t.call(
      'GET',
      '/api/ping',
      undefined,
      auth(await signJwt(rotated, claimsFor(AUD, ISS, nowS, { email: 'me@example.com' }))),
    );
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    certs([key.jwk]);
    const stranger = await generateKey('kid-3');
    const denied = await t.call(
      'GET',
      '/api/ping',
      undefined,
      auth(await signJwt(stranger, claimsFor(AUD, ISS, nowS, { email: 'me@example.com' }))),
    );
    expect(await denied.json()).toEqual({ error: 'no matching signing key' });
  });

  it('rejects bad tokens with the reason, and tokens carrying nobody', async () => {
    const t = gated();
    certs([key.jwk]);
    const expired = await signJwt(key, { ...claimsFor(AUD, ISS, nowS), exp: nowS - 1000 });
    expect(await (await t.call('GET', '/api/ping', undefined, auth(expired))).json()).toEqual({
      error: 'token expired',
    });
    const nobody = await signJwt(key, claimsFor(AUD, ISS, nowS));
    const res = await t.call('GET', '/api/ping', undefined, auth(nobody));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'token carries no usable identity' });
  });

  it('records who wrote each revision: the owner, an agent by its token name, or local', async () => {
    const t = gated();
    certs([key.jwk]);
    const slug = 'the-confidence-gap';
    const created = await t.call(
      'POST',
      '/api/presentations',
      { title: 'The Confidence Gap', event: '', date: null, target: 25 },
      auth(await ownerToken()),
    );
    expect(created.status).toBe(201);
    const asOwner = auth(await ownerToken());
    const metaPath = `/api/presentations/${slug}/room/meta`;
    const first = await (await t.call('GET', metaPath, undefined, asOwner)).json();
    expect(first).toMatchObject({ rev: 1, author: 'owner' });
    const room = await (
      await t.call('GET', `/api/presentations/${slug}/room`, undefined, asOwner)
    ).json<{ doc: unknown }>();
    const put = await t.call(
      'PUT',
      `/api/presentations/${slug}/room`,
      { baseRev: 1, doc: room.doc },
      auth(await agentToken()),
    );
    expect(put.status).toBe(200);
    const second = await (await t.call('GET', metaPath, undefined, asOwner)).json();
    expect(second).toMatchObject({ rev: 2, author: 'agent:tok.access' });
  });
});

describe('authorOf', () => {
  it('names the owner, the agent by its token, and local', () => {
    expect(authorOf({ kind: 'owner', email: 'me@x' })).toBe('owner');
    expect(authorOf({ kind: 'agent', name: 'retroscena-macbook' })).toBe(
      'agent:retroscena-macbook',
    );
    expect(authorOf({ kind: 'local' })).toBe('local');
  });
});
