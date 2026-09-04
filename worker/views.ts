/** Rows to the shapes the site and the CLI read. */
import { totalMinutes } from '../shared/bench';
import { roomCounts } from '../shared/room';
import type {
  Bench,
  BenchSummary,
  DocEnvelope,
  DocMeta,
  HistoryEntry,
  Presentation,
  PresentationSummary,
  Room,
  RoomSummary,
} from '../shared/types';
import type { DocumentMetaRow, DocumentRow, HistoryRow, PresentationRow } from './db';

function presentationView(row: PresentationRow): Presentation {
  return {
    slug: row.slug,
    title: row.title,
    event: row.event,
    date: row.date,
    target: row.target,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

export function metaView(row: DocumentMetaRow): DocMeta {
  return { rev: row.rev, author: row.author, at: row.at };
}

export function historyView(row: HistoryRow): HistoryEntry {
  return { ...metaView(row), bytes: row.bytes };
}

export function envelopeView<T>(row: DocumentRow): DocEnvelope<T> {
  return { ...metaView(row), doc: JSON.parse(row.body) as T };
}

function benchSummary(row: DocumentRow): BenchSummary {
  const bench = JSON.parse(row.body) as Bench;
  return {
    ...metaView(row),
    minutes: totalMinutes(bench),
    beats: bench.acts.reduce((sum, a) => sum + a.run.length, 0),
  };
}

function roomSummary(row: DocumentRow): RoomSummary {
  return { ...metaView(row), ...roomCounts(JSON.parse(row.body) as Room) };
}

export function summaryView(
  row: PresentationRow,
  bench: DocumentRow,
  room: DocumentRow,
): PresentationSummary {
  return { ...presentationView(row), bench: benchSummary(bench), room: roomSummary(room) };
}
