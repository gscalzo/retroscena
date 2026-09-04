import { useState } from 'react';
import type { DragEvent } from 'react';
import {
  addNote,
  crowded,
  moveToBackstage,
  moveToPool,
  moveToRun,
  noteById,
  noteMatches,
  setActMinutes,
  setActTitle,
  setTarget,
  totalMinutes,
} from '../../shared/bench';
import type { Filters, Where } from '../../shared/bench';
import type { Bench } from '../../shared/types';
import { fmtMin } from '../../shared/format';
import { droppedNote } from '../lib/dnd';
import { NoteCard } from '../components/NoteCard';
import { BenchTiming } from './BenchTiming';

interface BoardProps {
  bench: Bench;
  update: (bench: Bench) => void;
}
interface ZoneProps extends BoardProps {
  where: Where;
  ids: string[];
  filters: Filters;
  showDetails: boolean;
}

function move(bench: Bench, id: string, destination: string): Bench {
  if (destination === 'backstage') return moveToBackstage(bench, id);
  const [zone, act] = destination.split(':');
  return zone === 'pool'
    ? moveToPool(bench, id, Number(act))
    : moveToRun(bench, id, Number(act), null);
}

function Zone({ bench, update, where, ids, filters, showDetails }: ZoneProps) {
  const [over, setOver] = useState(false);
  function drop(event: DragEvent, index: number | null) {
    event.preventDefault();
    event.stopPropagation();
    setOver(false);
    const id = droppedNote(event);
    if (id === null || noteById(bench, id) === null) return;
    if (where.zone === 'backstage') update(moveToBackstage(bench, id));
    else if (where.zone === 'pool') update(moveToPool(bench, id, where.act));
    else update(moveToRun(bench, id, where.act, index));
  }
  const className = where.zone === 'backstage' ? 'backstage-grid' : `act-${where.zone}`;
  return (
    <div
      className={`${className} ${over ? 'dragover' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => drop(e, null)}
    >
      <ol className={where.zone === 'run' ? 'runlist' : 'pool-list'}>
        {ids.map((id, index) => {
          const note = noteById(bench, id)!;
          return (
            <li
              key={id}
              className={noteMatches(note, filters) ? '' : 'dim'}
              onDrop={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                drop(e, index + (e.clientY > rect.top + rect.height / 2 ? 1 : 0));
              }}
            >
              <NoteCard
                bench={bench}
                note={note}
                onChange={update}
                showDetails={showDetails}
                onMove={(destination) => update(move(bench, id, destination))}
              />
              {where.zone === 'run' && (
                <div className="run-order">
                  <button
                    className="btn sm"
                    disabled={index === 0}
                    onClick={() => update(moveToRun(bench, id, where.act, index - 1))}
                    aria-label="Move beat up"
                  >
                    ↑
                  </button>
                  <button
                    className="btn sm"
                    disabled={index === ids.length - 1}
                    onClick={() => update(moveToRun(bench, id, where.act, index + 2))}
                    aria-label="Move beat down"
                  >
                    ↓
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {ids.length === 0 && (
        <p className="pool-empty">
          {where.zone === 'run'
            ? 'Drag beats here, in the order they happen on stage.'
            : 'Drop material here, or add a note.'}
        </p>
      )}
      <button
        className="btn sm add-note"
        onClick={() => update(addNote(bench, where, crypto.randomUUID()))}
      >
        + Add a note
      </button>
    </div>
  );
}

function Acts({
  bench,
  update,
  filters,
  showDetails,
}: BoardProps & { filters: Filters; showDetails: boolean }) {
  return (
    <div className="actgrid">
      {bench.acts.map((act, index) => (
        <article className="act" key={act.id}>
          <div className="act-head">
            <span className="act-tag">ACT {index + 1}</span>
            <label>
              Slides{' '}
              <input
                className="slides-input"
                aria-label={`Act ${index + 1} slides`}
                value={act.slides}
                onChange={(e) =>
                  update({
                    ...bench,
                    acts: bench.acts.map((a, i) =>
                      i === index ? { ...a, slides: e.target.value } : a,
                    ),
                  })
                }
              />
            </label>
            <div className="tstep">
              <button
                aria-label={`Shorten act ${index + 1}`}
                onClick={() => update(setActMinutes(bench, index, act.minutes - 0.5))}
              >
                −
              </button>
              <span className="act-time">{fmtMin(act.minutes)}</span>
              <button
                aria-label={`Lengthen act ${index + 1}`}
                onClick={() => update(setActMinutes(bench, index, act.minutes + 0.5))}
              >
                +
              </button>
            </div>
          </div>
          <input
            className="act-title"
            aria-label={`Act ${index + 1} title`}
            placeholder="Name this act"
            value={act.title}
            onChange={(e) => update(setActTitle(bench, index, e.target.value))}
          />
          <div className="zone-label">
            The pool <span>{act.pool.length} notes</span>
          </div>
          <Zone
            bench={bench}
            update={update}
            where={{ zone: 'pool', act: index }}
            ids={act.pool}
            filters={filters}
            showDetails={showDetails}
          />
          <div className="zone-label">
            The run{' '}
            <span className={`act-count ${crowded(act) ? 'crowded' : ''}`}>
              {act.run.length} beats{crowded(act) ? ' · crowded' : ''}
            </span>
          </div>
          <Zone
            bench={bench}
            update={update}
            where={{ zone: 'run', act: index }}
            ids={act.run}
            filters={filters}
            showDetails={showDetails}
          />
        </article>
      ))}
    </div>
  );
}

export function BenchBoard({ bench, update }: BoardProps) {
  const [filters, setFilters] = useState<Filters>({ types: [], q: '' });
  const [showDetails, setShowDetails] = useState(false);
  function toggleType(id: string) {
    setFilters({
      ...filters,
      types: filters.types.includes(id)
        ? filters.types.filter((t) => t !== id)
        : [...filters.types, id],
    });
  }
  return (
    <section className="step wide" id="step-acts">
      <div className="step-head">
        <span className="step-tag">WHAT · the map</span>
        <h2>{bench.acts.length} acts, one run</h2>
        <p className="step-note">
          Each act holds its pool: material that could serve this part of the talk. The run is what
          happens on stage, in order. Drag notes between pools, runs and backstage. ★ marks the STAR
          moment; ×3 marks a repeated line.
        </p>
      </div>
      <div className="acts-toolbar">
        <div className="chips">
          {bench.categories.map((c) => (
            <button
              key={c.id}
              className={`fchip ${filters.types.includes(c.id) ? 'on' : ''}`}
              aria-pressed={filters.types.includes(c.id)}
              onClick={() => toggleType(c.id)}
              data-swatch={c.swatch}
            >
              <span className="dot" />
              {c.label}
            </button>
          ))}
        </div>
        <input
          className="board-search"
          type="search"
          aria-label="Search notes"
          placeholder="Search notes"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value.toLowerCase() })}
        />
        <div className="ctl">
          <span>Slot target</span>
          <div className="stepper">
            <button
              aria-label="One minute less"
              onClick={() => update(setTarget(bench, bench.target - 1))}
            >
              −
            </button>
            <span className="mono">{fmtMin(bench.target)}</span>
            <button
              aria-label="One minute more"
              onClick={() => update(setTarget(bench, bench.target + 1))}
            >
              +
            </button>
          </div>
        </div>
        <span className={`chip ${totalMinutes(bench) > bench.target ? 'over' : ''}`}>
          {fmtMin(totalMinutes(bench))} content
        </span>
        <button
          className="btn sm"
          aria-pressed={showDetails}
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
      </div>
      <BenchTiming bench={bench} update={update} />
      <Acts bench={bench} update={update} filters={filters} showDetails={showDetails} />
      <div className="backstage">
        <div className="backstage-head">
          <h3>Backstage</h3>
          <p>Q&amp;A armor, guardrails and speaker notes. Kept close, off the run.</p>
        </div>
        <Zone
          bench={bench}
          update={update}
          where={{ zone: 'backstage' }}
          ids={bench.backstage}
          filters={filters}
          showDetails={showDetails}
        />
      </div>
    </section>
  );
}
