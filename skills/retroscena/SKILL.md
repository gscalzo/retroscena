---
name: retroscena
description: Read and update the owner's talks on Retroscena — each presentation has a bench (who, why, hook, acts with a pool and a run, backstage, sticky notes) and a reading room (sources with read marks and margin notes). Use when asked to work on a talk's material, its sources, or to migrate a saved workbench or reading room artifact.
---

# Retroscena

Retroscena (retroscena.effectivecode.co.uk) is the backstage of every talk the
owner prepares. Each presentation owns two documents kept whole as JSON: the
**bench** and the **reading room**. This skill is how you read one, change it
and put it back, with the owner's own edits kept safe by revision numbers.

## Commands

All go through `~/.retroscena/bin/retroscena` (a shell shim; `node ~/.retroscena/bin/retroscena.mjs` works too):

```
retroscena list [--json]                              every presentation, with its revisions
retroscena create --title "…" [--event "…"] [--date yyyy-mm-dd] [--minutes N] [--slug s]
retroscena get <slug> bench|room [--rev N] [-o file]  the document as {rev, author, at, doc}
retroscena put <slug> bench|room <file> [--rev N] [--force]
retroscena history <slug> bench|room [--json]         every revision, newest first
retroscena outline <slug>                             the bench as Markdown, to read or to paste
retroscena archive <slug> | unarchive <slug>
retroscena migrate <artifact.html> -o <doc.json>      a saved claude.ai workbench or reading room, as a document
retroscena ping                                       is the site reachable with this machine's token?
```

Exit codes: 0 ok, 1 the server said no (the reason is on stderr), 2 usage.

## The loop

1. `retroscena get <slug> bench -o bench.json` — the file is an envelope
   `{ "rev": N, "author": …, "at": …, "doc": { … } }`.
2. Edit `doc` in place, with `jq`, a script, or by hand. Leave `rev` as it is.
3. `retroscena put <slug> bench bench.json` — the base rev is read from the
   envelope; the server refuses the save when someone (the owner, another
   agent) saved in between.
4. On a conflict (exit 1, "is at rev …"): `get` again, re-apply your change on
   the fresh document, `put` again. Never `--force` over a conflict you have
   not looked at; `--force` is for a document you built from scratch, such
   as the output of `migrate`.

`retroscena outline <slug>` is the fastest way to read a whole bench.

## The shapes

**bench**

```
who        { room, know, expect }                       who is in the room, what they know, what they expect
why        { speakerGoal, promise, throughline,
             tfd: { think|feel|do: { now, after } } }   goals and the Think / Feel / Do map
hook       { selected, texts: { anecdote, statement, metaphor, quote, question } }
target     minutes of the slot
categories [ { id, label, swatch } ]                    the note types; swatch ∈ yellow blue green violet orange pink teal
milestones [ { id: <note id>, label, by: <minute> } ]   beats that must have happened by a minute
acts       [ { id, title, slides, minutes, pool: [note ids], run: [note ids] } ]
backstage  [ note ids ]                                 Q&A armour, guardrails, checks: never on a slide
notes      [ { id, type: <category id>, text, more, star, x3, retired } ]
```

A note's `text` is the sticky note; `more` is the long form (blank line =
paragraph, lines starting with `- ` = bullets, `[label](https://…)` = link).
`star` marks the STAR moment, `x3` a planted, repeated line, `retired` a note
taken out of the talk but kept for the record.

**room**

```
groups    [ { id, title, sub } ]
articles  [ { id, group, title, author, src, date, url|null, cap, blurb, body (HTML), words,
              read, readDate|null, notes: [ { t, d } ] } ]
```

`cap` says what was captured ("full capture", "abstract + restatement", …);
`body` holds the capture as HTML; `notes` are the owner's margin notes with
their ISO date.

## Rules

- **Every note id is placed exactly once**: in one act's `pool`, one act's
  `run`, or in `backstage`. The server refuses a bench where a note is
  missing from all three or appears twice. Moving a note means removing it
  from where it was.
- **New ids are unique**: notes `c<epoch ms>`, acts `a<n>`; never reuse one.
- **Never delete the owner's notes**: set `retired: true` and move the note
  backstage. Deleting is the owner's call, in the site.
- **Keep the owner's words**: when you rewrite a `text` or `more`, keep the
  meaning; put your own additions in new notes or in `more` under a line of
  your own. Keep the `more` markup.
- **A note's `type` is one of the bench's `categories`**; add a category
  before using a new type.
- **Read marks and margin notes are the owner's**: an agent may add sources
  and captures to a room and may add margin notes with today's date; it does
  not tick articles as read.
- Only the main agent calls this; never from a subagent.
- If Retroscena is unreachable or a command fails, say so once and carry on;
  do not retry in a loop.
