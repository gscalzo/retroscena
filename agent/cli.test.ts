import { describe, expect, it } from 'vitest';
import { USAGE } from './args';
import { run } from './cli';
import { fakeIo, json } from './test/fake-io';

const env = { RETROSCENA_URL: 'https://rs.test' };

describe('run', () => {
  it('prints the usage for help and for an unknown command', async () => {
    const fake = fakeIo({ env });
    expect(await run([], fake.io)).toBe(2);
    expect(await run(['help'], fake.io)).toBe(2);
    expect(await run(['dance'], fake.io)).toBe(2);
    expect(fake.err).toEqual([USAGE, USAGE, 'retroscena: unknown command "dance"\n\n', USAGE]);
  });

  it('dispatches to every verb', async () => {
    const fake = fakeIo({
      env,
      responses: [
        json(200, { ok: true, caller: 'local' }),
        json(200, { presentations: [] }),
        json(200, { history: [] }),
      ],
    });
    expect(await run(['ping'], fake.io)).toBe(0);
    expect(await run(['list'], fake.io)).toBe(0);
    expect(await run(['history', 't', 'bench'], fake.io)).toBe(0);
    expect(await run(['whoami'], fake.io)).toBe(0);
    const usages: [string, string][] = [
      ['create', 'create needs --title'],
      ['get', 'get needs a slug and a kind'],
      ['put', 'put needs a slug and a kind'],
      ['outline', 'outline needs a slug'],
      ['archive', 'archive needs a slug'],
      ['unarchive', 'unarchive needs a slug'],
      ['migrate', 'migrate needs an artifact file'],
    ];
    for (const [verb, problem] of usages) {
      fake.err.length = 0;
      expect(await run([verb], fake.io)).toBe(2);
      expect(fake.err[0]).toContain(problem);
    }
    expect(fake.requests.map((r) => r.url)).toEqual([
      'https://rs.test/api/ping',
      'https://rs.test/api/presentations',
      'https://rs.test/api/presentations/t/bench/history',
    ]);
  });

  it('turns a refusal into exit 1 with the status and reason', async () => {
    const fake = fakeIo({ env, responses: [json(401, { error: 'missing header' })] });
    expect(await run(['ping'], fake.io)).toBe(1);
    expect(fake.err).toEqual(['retroscena: 401: missing header\n']);
  });

  it('turns any other failure into exit 1 with its text', async () => {
    const fake = fakeIo({ env });
    expect(await run(['list'], fake.io)).toBe(1);
    expect(fake.err).toEqual(['retroscena: Error: fetch failed\n']);
  });
});
