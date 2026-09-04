/**
 * The verbs about a presentation as a whole — list, create, archive,
 * outline — plus the two diagnostics, ping and whoami.
 */
import { isoDate } from '../shared/format';
import { outlineMarkdown } from '../shared/outline';
import { parseCreate } from '../shared/schema';
import type {
  Bench,
  DocEnvelope,
  ListRes,
  PingRes,
  PresentationRes,
  PresentationSummary,
} from '../shared/types';
import { call, get, docPath, presentationPath } from './api';
import { usage } from './args';
import type { ParsedArgs } from './args';
import { loadConfig } from './config';
import type { Config } from './config';
import type { Io } from './io';
import { table } from './render';

const WRITE_TIMEOUT_MS = 15_000;
const DEFAULT_MINUTES = 30;

const HEADER = ['SLUG', 'TITLE', 'EVENT', 'DATE', 'MIN', 'BENCH', 'ROOM', ''];

function row(p: PresentationSummary): string[] {
  return [
    p.slug,
    p.title,
    p.event,
    p.date ?? '',
    String(p.target),
    `r${p.bench.rev}`,
    `r${p.room.rev}`,
    p.archivedAt === null ? '' : 'archived',
  ];
}

export async function list(io: Io, args: ParsedArgs): Promise<number> {
  const res = await get<ListRes>(io, loadConfig(io), '/api/presentations');
  if (args.flags.has('json')) io.stdout(`${JSON.stringify(res)}\n`);
  else if (res.presentations.length === 0) io.stdout('no presentations yet\n');
  else io.stdout(table([HEADER, ...res.presentations.map(row)]));
  return 0;
}

function created(config: Config, slug: string): string {
  return `created ${slug}\n  bench  ${config.url}/${slug}/bench\n  room   ${config.url}/${slug}/room\n`;
}

export async function create(io: Io, args: ParsedArgs): Promise<number> {
  const { values } = args;
  const title = values['--title'];
  if (title === undefined) return usage(io, 'create needs --title');
  const minutes = values['--minutes'] === undefined ? DEFAULT_MINUTES : Number(values['--minutes']);
  if (!Number.isFinite(minutes)) return usage(io, '--minutes must be a number');
  const parsed = parseCreate({
    title,
    event: values['--event'] ?? '',
    date: values['--date'] ?? null,
    target: minutes,
    slug: values['--slug'],
  });
  if (!parsed.ok) return usage(io, parsed.error);
  const config = loadConfig(io);
  const res = await call<PresentationRes>(io, config, {
    method: 'POST',
    path: '/api/presentations',
    body: parsed.value,
    timeoutMs: WRITE_TIMEOUT_MS,
  });
  if (args.flags.has('json')) io.stdout(`${JSON.stringify(res)}\n`);
  else io.stdout(created(config, res.presentation.slug));
  return 0;
}

async function setArchived(io: Io, args: ParsedArgs, archived: boolean): Promise<number> {
  const slug = args.rest[0];
  if (slug === undefined) return usage(io, `${args.command} needs a slug`);
  await call<PresentationRes>(io, loadConfig(io), {
    method: 'PATCH',
    path: presentationPath(slug),
    body: { archived },
    timeoutMs: WRITE_TIMEOUT_MS,
  });
  io.stdout(`${archived ? 'archived' : 'restored'} ${slug}\n`);
  return 0;
}

export const archive = (io: Io, args: ParsedArgs): Promise<number> => setArchived(io, args, true);

export const unarchive = (io: Io, args: ParsedArgs): Promise<number> =>
  setArchived(io, args, false);

export async function outline(io: Io, args: ParsedArgs): Promise<number> {
  const slug = args.rest[0];
  if (slug === undefined) return usage(io, 'outline needs a slug');
  const config = loadConfig(io);
  const [pres, bench] = await Promise.all([
    get<PresentationRes>(io, config, presentationPath(slug)),
    get<DocEnvelope<Bench>>(io, config, docPath(slug, 'bench')),
  ]);
  io.stdout(`${outlineMarkdown(pres.presentation, bench.doc, isoDate(io.now()))}\n`);
  return 0;
}

export async function ping(io: Io): Promise<number> {
  const config = loadConfig(io);
  const res = await get<PingRes>(io, config, '/api/ping');
  io.stdout(`retroscena: ${config.url} answers; you are seen as "${res.caller}"\n`);
  return 0;
}

export function whoami(io: Io): number {
  const config = loadConfig(io);
  const token =
    config.clientId && config.clientSecret ? 'configured' : 'not configured (local only)';
  io.stdout(`url ${config.url}\ntoken ${token}\n`);
  return 0;
}
