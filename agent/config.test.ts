import { describe, expect, it } from 'vitest';
import { DEFAULT_URL, loadConfig, parseEnvFile, retroscenaDir } from './config';
import { fakeIo } from './test/fake-io';

describe('parseEnvFile', () => {
  it('reads KEY=VALUE lines, skipping comments, blanks and lines without a key', () => {
    const text = [
      '# a comment',
      '  # indented=comment',
      '',
      '  RETROSCENA_URL = https://x.test  ',
      '=nokey',
      'JUSTAWORD',
      'WITH_EQ=a=b',
    ].join('\n');
    expect(parseEnvFile(text)).toEqual({ RETROSCENA_URL: 'https://x.test', WITH_EQ: 'a=b' });
  });

  it('strips matching quotes and keeps everything else', () => {
    expect(parseEnvFile(`A='one'\nB="two"\nC='mixed"\nD=''\nE='\nF=x'`)).toEqual({
      A: 'one',
      B: 'two',
      C: `'mixed"`,
      D: '',
      E: `'`,
      F: `x'`,
    });
  });
});

describe('retroscenaDir', () => {
  it('is RETROSCENA_HOME when set, else ~/.retroscena', () => {
    expect(retroscenaDir(fakeIo({ env: { RETROSCENA_HOME: '/tmp/rs' } }).io)).toBe('/tmp/rs');
    expect(retroscenaDir(fakeIo().io)).toBe('/home/gio/.retroscena');
  });
});

describe('loadConfig', () => {
  const file = {
    '/home/gio/.retroscena/env':
      'RETROSCENA_URL=https://file.test/\nCF_ACCESS_CLIENT_ID=fid\nCF_ACCESS_CLIENT_SECRET=fsecret\n',
  };

  it('defaults to the production URL and no token without a file', () => {
    expect(loadConfig(fakeIo().io)).toEqual({
      url: DEFAULT_URL,
      clientId: null,
      clientSecret: null,
    });
  });

  it('reads the file and strips trailing slashes from the URL', () => {
    expect(loadConfig(fakeIo({ files: file }).io)).toEqual({
      url: 'https://file.test',
      clientId: 'fid',
      clientSecret: 'fsecret',
    });
  });

  it('lets a process variable win over the file, and an empty one means unset', () => {
    const env = { RETROSCENA_URL: 'http://127.0.0.1:8791//', CF_ACCESS_CLIENT_ID: '' };
    expect(loadConfig(fakeIo({ env, files: file }).io)).toEqual({
      url: 'http://127.0.0.1:8791',
      clientId: null,
      clientSecret: 'fsecret',
    });
  });

  it('reads the file from RETROSCENA_HOME', () => {
    const io = fakeIo({
      env: { RETROSCENA_HOME: '/elsewhere' },
      files: { '/elsewhere/env': 'RETROSCENA_URL="https://home.test"' },
    }).io;
    expect(loadConfig(io).url).toBe('https://home.test');
  });
});
