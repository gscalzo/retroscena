import { useState } from 'react';
import { categoryOf, updateNote } from '../../shared/bench';
import { renderDetail } from '../../shared/detail';
import type { Bench, Note } from '../../shared/types';
import { beginDrag } from '../lib/dnd';
import { RichText } from './RichText';

interface Props {
  bench: Bench;
  note: Note;
  appearance: 'bench' | 'run';
  showDetails: boolean;
  onChange: (bench: Bench) => void;
  onAction: (bench: Bench, message: string) => void;
  onMove: (destination: string) => void;
}

export function NoteCard({
  bench,
  note,
  appearance,
  showDetails,
  onChange,
  onAction,
  onMove,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const category = categoryOf(bench, note);
  const open = expanded || showDetails;
  const patch = (value: Partial<Note>) => onChange(updateNote(bench, note.id, value));
  const retire = () => {
    const retired = !note.retired;
    onAction(updateNote(bench, note.id, { retired }), retired ? 'Note retired' : 'Note restored');
  };
  return (
    <div
      className={`mini ${appearance}-card ${note.retired ? 'retired' : ''} ${dragging ? 'dragging' : ''}`}
      data-swatch={category.swatch}
    >
      <span
        className="drag-handle"
        draggable
        aria-hidden="true"
        title="Drag to move"
        onDragStart={(event) => {
          setDragging(true);
          beginDrag(event, note.id);
        }}
        onDragEnd={() => setDragging(false)}
      >
        ⠿ Drag
      </span>
      <textarea
        className="mini-edit"
        aria-label="Note text"
        value={note.text}
        placeholder="A beat, an idea, a source…"
        onChange={(e) => patch({ text: e.target.value })}
      />
      <div className="mini-foot">
        <select
          className="mini-type"
          aria-label="Category"
          value={note.type}
          onChange={(e) => patch({ type: e.target.value })}
        >
          {bench.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <div className="rbtns">
          <button
            className={`rbtn ${note.retired ? 'on' : ''}`}
            aria-label="Retired"
            aria-pressed={note.retired}
            onClick={retire}
          >
            Retire
          </button>
        </div>
      </div>
      <div className="note-placement">
        <select aria-label="Move note" value="" onChange={(e) => onMove(e.target.value)}>
          <option value="" disabled>
            Move to…
          </option>
          <option value="backstage">Backstage</option>
          {bench.acts.map((a, i) => (
            <optgroup key={a.id} label={`Act ${i + 1}: ${a.title}`}>
              <option value={`pool:${i}`}>Act {i + 1} pool</option>
              <option value={`run:${i}`}>Act {i + 1} run</option>
            </optgroup>
          ))}
        </select>
        <button
          className={`morebtn ${note.more.trim() ? 'has' : ''}`}
          aria-expanded={open}
          onClick={() => setExpanded(!expanded)}
        >
          Details
        </button>
      </div>
      {open && (
        <div className="mini-more">
          {editing ? (
            <textarea
              className="more-input"
              aria-label="Note detail"
              value={note.more}
              onChange={(e) => patch({ more: e.target.value })}
            />
          ) : (
            <RichText html={renderDetail(note.more)} />
          )}
          <button className="more-editbtn" onClick={() => setEditing(!editing)}>
            {editing ? 'Preview detail' : 'Edit detail'}
          </button>
          <p className="more-hint">
            Blank lines separate paragraphs. Use - for bullets and [label](https://…) for links.
          </p>
        </div>
      )}
    </div>
  );
}
