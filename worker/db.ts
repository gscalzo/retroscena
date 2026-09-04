/**
 * Every SQL statement the Worker runs, typed at the edges. Routes never
 * touch D1 directly, so the schema (migrations/) has exactly one client.
 */
import type { DocKind } from '../shared/types';

export interface PresentationRow {
  slug: string;
  title: string;
  event: string;
  date: string | null;
  target: number;
  created_at: number;
  archived_at: number | null;
}

export interface DocumentRow {
  presentation: string;
  kind: DocKind;
  rev: number;
  author: string;
  at: number;
  body: string;
}

export type DocumentMetaRow = Pick<DocumentRow, 'rev' | 'author' | 'at'>;

export interface HistoryRow extends DocumentMetaRow {
  bytes: number;
}

export interface PresentationPatch {
  title?: string;
  event?: string;
  date?: string | null;
  target?: number;
  archived_at?: number | null;
}

const PRESENTATION_COLUMNS = 'slug, title, event, date, target, created_at, archived_at';

export async function getPresentation(
  db: D1Database,
  slug: string,
): Promise<PresentationRow | null> {
  return db
    .prepare(`SELECT ${PRESENTATION_COLUMNS} FROM presentations WHERE slug = ?`)
    .bind(slug)
    .first<PresentationRow>();
}

/** Talk date ascending, undated last, then by title. */
export async function listPresentations(db: D1Database): Promise<PresentationRow[]> {
  const res = await db
    .prepare(
      `SELECT ${PRESENTATION_COLUMNS} FROM presentations
       ORDER BY date IS NULL, date, title`,
    )
    .all<PresentationRow>();
  return res.results;
}

/** The presentation and its two first revisions, in one transaction. */
export async function insertPresentation(
  db: D1Database,
  row: PresentationRow,
  docs: { kind: DocKind; author: string; body: string }[],
): Promise<void> {
  const presentation = db
    .prepare(`INSERT INTO presentations (${PRESENTATION_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(row.slug, row.title, row.event, row.date, row.target, row.created_at, row.archived_at);
  const documents = docs.map((d) =>
    db
      .prepare(
        'INSERT INTO documents (presentation, kind, rev, author, at, body) VALUES (?, ?, 1, ?, ?, ?)',
      )
      .bind(row.slug, d.kind, d.author, row.created_at, d.body),
  );
  await db.batch([presentation, ...documents]);
}

const PATCH_COLUMNS: (keyof PresentationPatch)[] = [
  'title',
  'event',
  'date',
  'target',
  'archived_at',
];

/** True when a row was updated; false for an unknown slug. */
export async function updatePresentation(
  db: D1Database,
  slug: string,
  patch: PresentationPatch,
): Promise<boolean> {
  const columns = PATCH_COLUMNS.filter((c) => c in patch);
  const sets = columns.map((c) => `${c} = ?`).join(', ');
  const values = columns.map((c) => patch[c] ?? null);
  const res = await db
    .prepare(`UPDATE presentations SET ${sets} WHERE slug = ?`)
    .bind(...values, slug)
    .run();
  return res.meta.changes > 0;
}

const DOCUMENT_COLUMNS = 'presentation, kind, rev, author, at, body';

export async function latestDocument(
  db: D1Database,
  slug: string,
  kind: DocKind,
): Promise<DocumentRow | null> {
  return db
    .prepare(
      `SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE presentation = ? AND kind = ?
       ORDER BY rev DESC LIMIT 1`,
    )
    .bind(slug, kind)
    .first<DocumentRow>();
}

export async function latestMeta(
  db: D1Database,
  slug: string,
  kind: DocKind,
): Promise<DocumentMetaRow | null> {
  return db
    .prepare(
      `SELECT rev, author, at FROM documents WHERE presentation = ? AND kind = ?
       ORDER BY rev DESC LIMIT 1`,
    )
    .bind(slug, kind)
    .first<DocumentMetaRow>();
}

export async function getDocument(
  db: D1Database,
  slug: string,
  kind: DocKind,
  rev: number,
): Promise<DocumentRow | null> {
  return db
    .prepare(
      `SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE presentation = ? AND kind = ? AND rev = ?`,
    )
    .bind(slug, kind, rev)
    .first<DocumentRow>();
}

/**
 * Append a revision. The primary key (presentation, kind, rev) is the lock:
 * when two writers race from the same base, the second insert fails and
 * the caller answers with a conflict.
 */
export async function insertDocument(db: D1Database, row: DocumentRow): Promise<boolean> {
  try {
    await db
      .prepare(`INSERT INTO documents (${DOCUMENT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(row.presentation, row.kind, row.rev, row.author, row.at, row.body)
      .run();
    return true;
  } catch {
    return false;
  }
}

export async function listHistory(
  db: D1Database,
  slug: string,
  kind: DocKind,
  limit: number,
): Promise<HistoryRow[]> {
  const res = await db
    .prepare(
      `SELECT rev, author, at, length(body) AS bytes FROM documents
       WHERE presentation = ? AND kind = ? ORDER BY rev DESC LIMIT ?`,
    )
    .bind(slug, kind, limit)
    .all<HistoryRow>();
  return res.results;
}
