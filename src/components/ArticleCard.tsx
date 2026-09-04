import { useState } from 'react';
import { addMarginNote, deleteMarginNote, toggleRead, updateMarginNote } from '../../shared/room';
import { isoDate } from '../../shared/format';
import type { Article, Room } from '../../shared/types';
import { RichText, safeUrl } from './RichText';

function draftMarginNote(room: Room, article: Article, index: number, text: string): Room {
  const notes = article.notes.map((note, i) => (i === index ? { ...note, t: text } : note));
  return {
    ...room,
    articles: room.articles.map((item) => (item.id === article.id ? { ...article, notes } : item)),
  };
}

export function ArticleCard({
  article,
  room,
  onChange,
}: {
  article: Article;
  room: Room;
  onChange: (room: Room) => void;
}) {
  const [draft, setDraft] = useState('');
  const url = safeUrl(article.url);
  function add() {
    onChange(addMarginNote(room, article.id, draft, isoDate(Date.now())));
    setDraft('');
  }
  return (
    <article className={`card ${article.read ? 'isread' : ''}`}>
      <button
        className="readbtn"
        title={article.read ? 'Mark as unread' : 'Mark as read'}
        aria-label={`Read status: ${article.title}`}
        aria-pressed={article.read}
        onClick={() => onChange(toggleRead(room, article.id, isoDate(Date.now())))}
      >
        ✓
      </button>
      <div className="card-main">
        <h3 className="card-title">
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer">
              {article.title}
            </a>
          ) : (
            article.title
          )}
        </h3>
        <div className="card-meta">
          <span>{article.author}</span>
          <span>{article.src}</span>
          <span>{article.date}</span>
          {article.words > 0 && (
            <span className="mono">{article.words.toLocaleString()} words</span>
          )}
          <span className="captag">{article.cap}</span>
          {article.readDate !== null && <span className="readdate">Read {article.readDate}</span>}
        </div>
        <p className="blurb">{article.blurb}</p>
        {url && (
          <div className="card-actions">
            <a className="linkout" href={url} target="_blank" rel="noopener noreferrer">
              Open the original ↗
            </a>
          </div>
        )}
        {article.body !== '' && (
          <details className="capture">
            <summary>
              {article.cap.startsWith('writeout') ? 'Read the writeout' : 'Read the capture'}
            </summary>
            <div className="capture-body">
              <RichText html={article.body} />
            </div>
          </details>
        )}
        <div className="notes">
          {article.notes.map((note, i) => (
            <div className="note" key={`${article.id}:${i}`}>
              <textarea
                className="note-text"
                aria-label={`Margin note ${i + 1}`}
                value={note.t}
                onChange={(e) => onChange(draftMarginNote(room, article, i, e.target.value))}
                onBlur={(e) => onChange(updateMarginNote(room, article.id, i, e.target.value))}
              />
              <span className="note-side">
                <span className="note-date">{note.d}</span>
                <button
                  className="note-del"
                  aria-label={`Delete margin note ${i + 1}`}
                  onClick={() => onChange(deleteMarginNote(room, article.id, i))}
                >
                  ×
                </button>
              </span>
            </div>
          ))}
          <form
            className="note-add"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input
              className="note-input"
              aria-label="New margin note"
              placeholder="Add a note on this article…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button className="note-addbtn" disabled={draft.trim() === ''}>
              Add
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
