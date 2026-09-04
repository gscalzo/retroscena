/** Entry point of the bundled client (`~/.retroscena/bin/retroscena.mjs`). */
import { run } from './cli';
import { nodeIo } from './io';

void run(process.argv.slice(2), nodeIo).then((code) => {
  process.exitCode = code;
});
