/** The command line: what `retroscena <verb> …` parses to, and how it complains. */
import { isDocKind } from '../shared/schema';
import type { DocKind } from '../shared/types';
import type { Io } from './io';

export const USAGE = `retroscena — the backstage of every talk, from the terminal

  retroscena list [--json]                              every presentation, with its revisions
  retroscena create --title "…" [--event "…"] [--date yyyy-mm-dd] [--minutes N] [--slug s] [--json]
                                                        a new presentation with an empty bench and room
  retroscena get <slug> bench|room [--rev N] [-o file]  the document as {rev, author, at, doc}
  retroscena put <slug> bench|room <file> [--rev N] [--force]
                                                        save a document; the base rev comes from the file's
                                                        envelope, from --rev, or is the current one with --force
  retroscena history <slug> bench|room [--json]         every revision, newest first
  retroscena outline <slug>                             the bench as Markdown
  retroscena archive <slug> | unarchive <slug>          fold a presentation away, or bring it back
  retroscena migrate <artifact.html> -o <doc.json>      a saved claude.ai artifact as a document
  retroscena ping                                       check the connection and the credentials
  retroscena whoami                                     the URL and token this command would use
`;

export interface ParsedArgs {
  command: string;
  /** Positional words after the command. */
  rest: string[];
  /** `--option value` pairs. */
  values: Record<string, string>;
  /** Bare `--flag` switches, without the dashes. */
  flags: Set<string>;
}

const VALUED = new Set([
  '--title',
  '--event',
  '--date',
  '--minutes',
  '--slug',
  '--rev',
  '-o',
  '--out',
]);

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const rest: string[] = [];
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  let pending: string | null = null;
  for (const arg of argv) {
    if (pending !== null) {
      values[pending] = arg;
      pending = null;
    } else if (VALUED.has(arg)) pending = arg;
    else if (arg.startsWith('--')) flags.add(arg.slice(2));
    else rest.push(arg);
  }
  const [command = 'help', ...words] = rest;
  return { command, rest: words, values, flags };
}

export function usage(io: Io, problem?: string): 2 {
  if (problem) io.stderr(`retroscena: ${problem}\n\n`);
  io.stderr(USAGE);
  return 2;
}

export interface DocRef {
  slug: string;
  kind: DocKind;
}

/** `<slug> bench|room`, or null after the usage message. */
export function docRef(io: Io, args: ParsedArgs): DocRef | null {
  const [slug, kind] = args.rest;
  if (args.rest.length < 2) {
    usage(io, `${args.command} needs a slug and a kind (bench or room)`);
    return null;
  }
  if (!isDocKind(kind)) {
    usage(io, `"${kind}" is not a kind: bench or room`);
    return null;
  }
  return { slug, kind };
}

/** `--rev N` as a positive integer; null when absent; NaN when it is neither. */
export function revOption(args: ParsedArgs): number | null {
  const raw = args.values['--rev'];
  if (raw === undefined) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : Number.NaN;
}
