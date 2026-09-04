import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { nodeIo } from './io';

const dir = mkdtempSync(path.join(tmpdir(), 'retroscena-io-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
afterEach(() => vi.restoreAllMocks());

describe('nodeIo: the process', () => {
  it('exposes the environment, the home directory and the clock', () => {
    expect(nodeIo.env).toBe(process.env);
    expect(nodeIo.homedir()).toBe(homedir());
    expect(Math.abs(nodeIo.now() - Date.now())).toBeLessThan(5000);
  });

  it('writes to stdout and stderr', () => {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    nodeIo.stdout('o');
    nodeIo.stderr('e');
    expect(out).toHaveBeenCalledWith('o');
    expect(err).toHaveBeenCalledWith('e');
  });
});

describe('nodeIo: files', () => {
  it('reads a file or null, and writes through missing directories', () => {
    expect(nodeIo.readFile(path.join(dir, 'missing'))).toBeNull();
    const nested = path.join(dir, 'a', 'b', 'c.txt');
    expect(existsSync(path.dirname(nested))).toBe(false);
    nodeIo.writeFile(nested, 'hello');
    expect(readFileSync(nested, 'utf8')).toBe('hello');
    expect(nodeIo.readFile(nested)).toBe('hello');
  });
});

describe('nodeIo: fetch', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/slow') {
        setTimeout(() => res.end('late'), 500);
        return;
      }
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        res.statusCode = 202;
        res.end(JSON.stringify({ method: req.method, body, header: req.headers['x-test'] }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    base = typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : '';
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('sends the method, headers and body and returns the status and text', async () => {
    const res = await nodeIo.fetch(`${base}/echo`, {
      method: 'PUT',
      headers: { 'x-test': 'yes', 'content-type': 'application/json' },
      body: '{"a":1}',
      timeoutMs: 5000,
    });
    expect(res).toEqual({
      status: 202,
      body: JSON.stringify({ method: 'PUT', body: '{"a":1}', header: 'yes' }),
    });
  });

  it('gives up after the timeout', async () => {
    await expect(
      nodeIo.fetch(`${base}/slow`, { method: 'GET', headers: {}, timeoutMs: 40 }),
    ).rejects.toThrow();
  });
});
