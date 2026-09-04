/**
 * The verbs about one document — get, put, history — and migrate, which
 * turns a saved claude.ai artifact into a document to put (ADR-0010).
 */
import { convertArtifact } from '../shared/legacy';
import { parseDoc } from '../shared/schema';
import type {
  Bench,
  ConflictRes,
  DocEnvelope,
  DocMeta,
  HistoryRes,
  PutRes,
  Room,
} from '../shared/types';
import { ApiError, call, get, docPath } from './api';
import { docRef, revOption, usage } from './args';
import type { DocRef, ParsedArgs } from './args';
import { loadConfig } from './config';
import type { Config } from './config';
import type { Io } from './io';
import { fmtTime, table } from './render';

const PUT_TIMEOUT_MS = 30_000;

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function getDoc(io: Io, args: ParsedArgs): Promise<number> {
  const ref = docRef(io, args);
  if (!ref) return 2;
  const rev = revOption(args);
  if (Number.isNaN(rev)) return usage(io, '--rev must be a positive integer');
  const base = docPath(ref.slug, ref.kind);
  const envelope = await get<DocEnvelope<unknown>>(
    io,
    loadConfig(io),
    rev === null ? base : `${base}/history/${rev}`,
  );
  const out = args.values['-o'] ?? args.values['--out'];
  if (out === undefined) {
    io.stdout(pretty(envelope));
  } else {
    io.writeFile(out, pretty(envelope));
    io.stdout(`wrote ${out} (${ref.kind} of ${ref.slug}, rev ${envelope.rev})\n`);
  }
  return 0;
}

interface Loaded {
  doc: unknown;
  /** The rev of the envelope the file held, or null for a bare document. */
  rev: number | null;
}

/** `{rev, doc}` as `get` writes it, or the bare document. */
function unwrap(value: unknown): Loaded {
  if (typeof value === 'object' && value !== null && 'doc' in value) {
    const { rev, doc } = value as { rev?: unknown; doc: unknown };
    if (typeof rev === 'number') return { doc, rev };
  }
  return { doc: value, rev: null };
}

function loadFile(io: Io, file: string): Loaded | { problem: string } {
  const text = io.readFile(file);
  if (text === null) return { problem: `cannot read ${file}` };
  try {
    return unwrap(JSON.parse(text));
  } catch {
    return { problem: `${file} is not JSON` };
  }
}

async function resolveBaseRev(
  io: Io,
  config: Config,
  ref: DocRef,
  args: ParsedArgs,
  fileRev: number | null,
): Promise<number | null> {
  if (args.flags.has('force')) {
    const meta = await get<DocMeta>(io, config, `${docPath(ref.slug, ref.kind)}/meta`);
    return meta.rev;
  }
  return revOption(args) ?? fileRev;
}

/** The current revision a conflict reports, when the body carries one. */
function conflictMeta(body: unknown): DocMeta | null {
  const current = (body as Partial<ConflictRes> | null)?.current;
  return current !== undefined && typeof current.rev === 'number' ? current : null;
}

function reportConflict(io: Io, ref: DocRef, base: number, err: ApiError): 1 {
  const current = conflictMeta(err.body);
  const where =
    current === null
      ? err.message
      : `${ref.kind} of ${ref.slug} is at rev ${current.rev} (${current.author}, ${fmtTime(current.at)}); you started from rev ${base}`;
  io.stderr(`retroscena: conflict — ${where}. Get it again, re-apply your change, put again.\n`);
  return 1;
}

export async function putDoc(io: Io, args: ParsedArgs): Promise<number> {
  const ref = docRef(io, args);
  if (!ref) return 2;
  const file: string | undefined = args.rest[2];
  if (file === undefined) return usage(io, 'put needs a file');
  if (Number.isNaN(revOption(args))) return usage(io, '--rev must be a positive integer');
  const loaded = loadFile(io, file);
  if ('problem' in loaded) return usage(io, loaded.problem);
  const parsed = parseDoc(ref.kind, loaded.doc);
  if (!parsed.ok) return usage(io, `invalid ${ref.kind}: ${parsed.error}`);
  const config = loadConfig(io);
  const base = await resolveBaseRev(io, config, ref, args, loaded.rev);
  if (base === null) {
    return usage(io, 'no base rev: the file is not an envelope, pass --rev N or --force');
  }
  try {
    const res = await call<PutRes>(io, config, {
      method: 'PUT',
      path: docPath(ref.slug, ref.kind),
      body: { baseRev: base, doc: parsed.value },
      timeoutMs: PUT_TIMEOUT_MS,
    });
    io.stdout(`saved ${ref.kind} of ${ref.slug} as rev ${res.rev}\n`);
    return 0;
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) return reportConflict(io, ref, base, err);
    throw err;
  }
}

export async function history(io: Io, args: ParsedArgs): Promise<number> {
  const ref = docRef(io, args);
  if (!ref) return 2;
  const res = await get<HistoryRes>(io, loadConfig(io), `${docPath(ref.slug, ref.kind)}/history`);
  if (args.flags.has('json')) {
    io.stdout(`${JSON.stringify(res)}\n`);
    return 0;
  }
  const rows = res.history.map((h) => [
    `r${h.rev}`,
    h.author,
    fmtTime(h.at),
    `${h.bytes.toLocaleString('en-GB')} bytes`,
  ]);
  io.stdout(table([['REV', 'AUTHOR', 'WHEN', 'SIZE'], ...rows]));
  return 0;
}

function summary(kind: 'bench' | 'room', doc: Bench | Room): string {
  if (kind === 'bench') {
    const b = doc as Bench;
    return `${b.notes.length} notes, ${b.acts.length} acts, ${b.backstage.length} backstage`;
  }
  const r = doc as Room;
  return `${r.articles.length} articles in ${r.groups.length} groups`;
}

export function migrate(io: Io, args: ParsedArgs): number {
  const file = args.rest[0];
  const out = args.values['-o'] ?? args.values['--out'];
  if (file === undefined || out === undefined) {
    return usage(io, 'migrate needs an artifact file and -o <doc.json>');
  }
  const html = io.readFile(file);
  if (html === null) return usage(io, `cannot read ${file}`);
  const converted = convertArtifact(html);
  if (converted === null) return usage(io, `${file} is not a saved workbench or reading room`);
  const parsed = parseDoc(converted.kind, converted.doc);
  if (!parsed.ok) return usage(io, `the converted ${converted.kind} is invalid: ${parsed.error}`);
  io.writeFile(out, pretty(parsed.value));
  io.stdout(`wrote ${out}: ${converted.kind}, ${summary(converted.kind, parsed.value)}\n`);
  return 0;
}
