import { useEffect, useState } from 'react';
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
type Action = (next: Bench, message: string) => void;
interface ZoneProps extends BoardProps {
  action: Action;
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

function whereName(where: Where): string {
  if (where.zone === 'backstage') return 'backstage';
  return `Act ${where.act + 1} ${where.zone === 'pool' ? 'bench' : 'run'}`;
}

function destinationName(destination: string): string {
  if (destination === 'backstage') return 'backstage';
  const [zone, act] = destination.split(':');
  return whereName({ zone: zone === 'pool' ? 'pool' : 'run', act: Number(act) });
}

function Zone({ bench, update, action, where, ids, filters, showDetails }: ZoneProps) {
  const [over, setOver] = useState(false);
  const [insert, setInsert] = useState<{ id: string; after: boolean } | null>(null);
  const clearDrag = () => {
    setOver(false);
    setInsert(null);
  };
  function drop(event: DragEvent, index: number | null) {
    event.preventDefault();
    event.stopPropagation();
    clearDrag();
    const id = droppedNote(event);
    if (id === null || noteById(bench, id) === null) return;
    const next =
      where.zone === 'backstage'
        ? moveToBackstage(bench, id)
        : where.zone === 'pool'
          ? moveToPool(bench, id, where.act)
          : moveToRun(bench, id, where.act, index);
    action(next, `Moved to ${whereName(where)}`);
  }
  const className = where.zone === 'backstage' ? 'backstage-grid' : `act-${where.zone}`;
  return (
    <div
      className={`${className} ${over ? 'dragover' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
        setInsert(null);
      }}
      onDragLeave={(e) => {
        if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
        clearDrag();
      }}
      onDrop={(e) => drop(e, null)}
    >
      <ol className={where.zone === 'run' ? 'runlist' : 'pool-list'}>
        {ids.map((id, index) => {
          const note = noteById(bench, id)!;
          return (
            <li
              key={id}
              className={`${noteMatches(note, filters) ? '' : 'dim'} ${insert?.id === id ? `insert-${insert.after ? 'after' : 'before'}` : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                const rect = e.currentTarget.getBoundingClientRect();
                setOver(true);
                setInsert({ id, after: e.clientY > rect.top + rect.height / 2 });
              }}
              onDrop={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                drop(e, index + (e.clientY > rect.top + rect.height / 2 ? 1 : 0));
              }}
            >
              <NoteCard
                bench={bench}
                note={note}
                appearance={where.zone === 'run' ? 'run' : 'bench'}
                onChange={update}
                onAction={action}
                showDetails={showDetails}
                onMove={(destination) =>
                  action(move(bench, id, destination), `Moved to ${destinationName(destination)}`)
                }
              />
              {where.zone === 'run' && (
                <div className="run-order">
                  <button
                    className="btn sm"
                    disabled={index === 0}
                    onClick={() =>
                      action(moveToRun(bench, id, where.act, index - 1), 'Beat moved up')
                    }
                    aria-label="Move beat up"
                  >
                    ↑
                  </button>
                  <button
                    className="btn sm"
                    disabled={index === ids.length - 1}
                    onClick={() =>
                      action(moveToRun(bench, id, where.act, index + 2), 'Beat moved down')
                    }
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
        onClick={() =>
          action(addNote(bench, where, crypto.randomUUID()), `Note added to ${whereName(where)}`)
        }
      >
        + Add a note
      </button>
    </div>
  );
}

function Acts({
  bench,
  update,
  action,
  filters,
  showDetails,
  showBenches,
}: BoardProps & { action: Action; filters: Filters; showDetails: boolean; showBenches: boolean }) {
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
                onClick={() =>
                  action(
                    setActMinutes(bench, index, act.minutes - 0.5),
                    `Act ${index + 1} shortened`,
                  )
                }
              >
                −
              </button>
              <span className="act-time">{fmtMin(act.minutes)}</span>
              <button
                aria-label={`Lengthen act ${index + 1}`}
                onClick={() =>
                  action(
                    setActMinutes(bench, index, act.minutes + 0.5),
                    `Act ${index + 1} lengthened`,
                  )
                }
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
          <div className="zone-label run-label">
            The run{' '}
            <span className={`act-count ${crowded(act) ? 'crowded' : ''}`}>
              {act.run.length} beats{crowded(act) ? ' · crowded' : ''}
            </span>
          </div>
          <Zone
            bench={bench}
            update={update}
            action={action}
            where={{ zone: 'run', act: index }}
            ids={act.run}
            filters={filters}
            showDetails={showDetails}
          />
          {showBenches && (
            <>
              <div className="zone-label bench-label">
                The bench <span>{act.pool.length} notes</span>
              </div>
              <Zone
                bench={bench}
                update={update}
                action={action}
                where={{ zone: 'pool', act: index }}
                ids={act.pool}
                filters={filters}
                showDetails={showDetails}
              />
            </>
          )}
        </article>
      ))}
    </div>
  );
}

export function BenchBoard({ bench, update }: BoardProps) {
  const [filters, setFilters] = useState<Filters>({ types: [], q: '' });
  const [showDetails, setShowDetails] = useState(false);
  const [showBenches, setShowBenches] = useState(true);
  const [undo, setUndo] = useState<{
    before: Bench;
    after: Bench;
    message: string;
  } | null>(null);
  useEffect(() => {
    if (undo === null) return;
    if (bench !== undo.after) {
      setUndo(null);
      return;
    }
    const timeout = window.setTimeout(() => setUndo(null), 5_000);
    return () => window.clearTimeout(timeout);
  }, [bench, undo]);
  const action: Action = (next, message) => {
    if (next === bench) return;
    setUndo({ before: bench, after: next, message });
    update(next);
  };
  const undoAction = () => {
    if (undo === null || bench !== undo.after) return;
    update(undo.before);
    setUndo(null);
  };
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
          Each act has a bench for material that may make the talk, and a run for what happens on
          stage. Drag cards by their handle; hide the benches for a clean read-through.
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
              onClick={() => action(setTarget(bench, bench.target - 1), 'Slot target shortened')}
            >
              −
            </button>
            <span className="mono">{fmtMin(bench.target)}</span>
            <button
              aria-label="One minute more"
              onClick={() => action(setTarget(bench, bench.target + 1), 'Slot target lengthened')}
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
        <button
          className="btn sm"
          aria-expanded={showBenches}
          onClick={() => setShowBenches(!showBenches)}
        >
          {showBenches ? 'Hide benches' : 'Show benches'}
        </button>
      </div>
      <BenchTiming bench={bench} update={update} />
      <Acts
        bench={bench}
        update={update}
        action={action}
        filters={filters}
        showDetails={showDetails}
        showBenches={showBenches}
      />
      <div className="backstage">
        <div className="backstage-head">
          <h3>Backstage</h3>
          <p>Q&amp;A armor, guardrails and speaker notes. Kept close, off the run.</p>
        </div>
        <Zone
          bench={bench}
          update={update}
          action={action}
          where={{ zone: 'backstage' }}
          ids={bench.backstage}
          filters={filters}
          showDetails={showDetails}
        />
      </div>
      {undo !== null && (
        <div className="toast undo-toast show">
          <span role="status">{undo.message}</span>
          <button onClick={undoAction}>Undo</button>
        </div>
      )}
    </section>
  );
}
