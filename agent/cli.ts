/**
 * `retroscena <verb>` — the skill's verbs (ADR-0011). Exit codes: 0 ok,
 * 1 the server said no, 2 usage.
 */
import { ApiError } from './api';
import { parseArgs, usage } from './args';
import type { ParsedArgs } from './args';
import { getDoc, history, migrate, putDoc } from './documents';
import type { Io } from './io';
import { archive, create, list, outline, ping, unarchive, whoami } from './presentations';

type Verb = (io: Io, args: ParsedArgs) => number | Promise<number>;

const VERBS = new Map<string, Verb>([
  ['list', list],
  ['create', create],
  ['get', getDoc],
  ['put', putDoc],
  ['history', history],
  ['outline', outline],
  ['archive', archive],
  ['unarchive', unarchive],
  ['migrate', migrate],
  ['ping', ping],
  ['whoami', whoami],
  ['help', (io) => usage(io)],
]);

export async function run(argv: readonly string[], io: Io): Promise<number> {
  const args = parseArgs(argv);
  const verb = VERBS.get(args.command);
  if (!verb) return usage(io, `unknown command "${args.command}"`);
  try {
    return await verb(io, args);
  } catch (err) {
    const reason = err instanceof ApiError ? `${err.status}: ${err.message}` : String(err);
    io.stderr(`retroscena: ${reason}\n`);
    return 1;
  }
}
