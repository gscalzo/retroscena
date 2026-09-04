-- Retroscena initial schema (ADR-0003, ADR-0004, ADR-0006).
-- Single-owner site behind Cloudflare Access: deliberately no users table.
-- A presentation owns two documents, a bench and a reading room, each kept
-- whole as JSON; every save is a new revision and nothing is ever deleted.

CREATE TABLE presentations (
  slug         TEXT PRIMARY KEY,       -- derived from the title at creation, the URL segment
  title        TEXT NOT NULL,
  event        TEXT NOT NULL,          -- conference, meetup, room; may be empty
  date         TEXT,                   -- ISO yyyy-mm-dd of the talk, or NULL when unknown
  target       INTEGER NOT NULL,       -- slot length in minutes
  created_at   INTEGER NOT NULL,       -- epoch ms
  archived_at  INTEGER                 -- epoch ms; NULL while the presentation is live
);

CREATE TABLE documents (
  presentation  TEXT NOT NULL REFERENCES presentations(slug),
  kind          TEXT NOT NULL,         -- 'bench' | 'room'
  rev           INTEGER NOT NULL,      -- 1, 2, 3 … per (presentation, kind)
  author        TEXT NOT NULL,         -- 'owner' | 'agent:<token name>' | 'local'
  at            INTEGER NOT NULL,      -- epoch ms
  body          TEXT NOT NULL,         -- the JSON document, whole
  PRIMARY KEY (presentation, kind, rev)
);
