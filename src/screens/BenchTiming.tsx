import { useState } from 'react';
import { actStart, milestoneStatus, totalMinutes } from '../../shared/bench';
import { fmtMin } from '../../shared/format';
import type { Bench } from '../../shared/types';

function MilestoneEditor({ bench, update }: { bench: Bench; update: (bench: Bench) => void }) {
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [by, setBy] = useState(5);
  return (
    <details className="milestone-editor">
      <summary>Edit milestones</summary>
      {bench.milestones.map((m, index) => (
        <div className="milestone-row" key={`${m.id}:${index}`}>
          <label>
            Milestone
            <input
              value={m.label}
              onChange={(e) =>
                update({
                  ...bench,
                  milestones: bench.milestones.map((item, i) =>
                    i === index ? { ...item, label: e.target.value } : item,
                  ),
                })
              }
            />
          </label>
          <label>
            By minute
            <input
              type="number"
              min="0"
              step="0.5"
              value={m.by}
              onChange={(e) => {
                if (e.target.value !== '')
                  update({
                    ...bench,
                    milestones: bench.milestones.map((item, i) =>
                      i === index ? { ...item, by: Math.max(0, e.target.valueAsNumber) } : item,
                    ),
                  });
              }}
            />
          </label>
          <button
            className="btn sm"
            onClick={() =>
              update({ ...bench, milestones: bench.milestones.filter((_, i) => i !== index) })
            }
          >
            Remove milestone
          </button>
        </div>
      ))}
      <form
        className="milestone-row"
        onSubmit={(e) => {
          e.preventDefault();
          update({ ...bench, milestones: [...bench.milestones, { id, label, by }] });
          setLabel('');
        }}
      >
        <label>
          Beat
          <select required value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Choose a note</option>
            {bench.notes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.text || '(Untitled note)'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Label
          <input required value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label>
          By minute
          <input
            required
            type="number"
            min="0"
            step="0.5"
            value={by}
            onChange={(e) => setBy(e.target.valueAsNumber)}
          />
        </label>
        <button className="btn sm">Add milestone</button>
      </form>
    </details>
  );
}

export function BenchTiming({ bench, update }: { bench: Bench; update: (bench: Bench) => void }) {
  const total = totalMinutes(bench);
  const scale = Math.max(total, bench.target);
  const spare = bench.target - total;
  const milestones = milestoneStatus(bench);
  return (
    <>
      <div className="milestones">
        {milestones.map((m, i) => (
          <span key={i} className={`ms ${m.late ? 'late' : 'ok'}`}>
            {m.label}: {m.at === null ? 'off the run' : `≈${fmtMin(m.at)}`} · by {fmtMin(m.by)}
          </span>
        ))}
      </div>
      <p className="slot-note">
        {spare >= 0
          ? `${fmtMin(spare)} left for pauses and transitions.`
          : `${fmtMin(-spare)} over the slot. Trim or retime the acts.`}
      </p>
      <div className="tlwrap">
        <div className="timeline" aria-label="Talk timeline">
          {bench.acts.map((act, index) => (
            <div
              key={act.id}
              className="tl-seg"
              data-tone={index === 0 ? 'first' : 'odd'}
              style={{ flex: act.minutes }}
              title={`${act.title}: ${fmtMin(actStart(bench, index))}–${fmtMin(actStart(bench, index) + act.minutes)}`}
            >
              {index + 1} · {fmtMin(act.minutes)}
            </div>
          ))}
          {spare > 0 && (
            <div className="tl-seg tl-spare" style={{ flex: spare }}>
              {fmtMin(spare)} spare
            </div>
          )}
        </div>
        {milestones
          .filter((m) => m.at !== null)
          .map((m, i) => (
            <div
              key={i}
              className={`tl-flag ${m.late ? 'late' : ''}`}
              style={{ left: `${(100 * m.at!) / scale}%` }}
            >
              <span>{m.label}</span>
            </div>
          ))}
      </div>
      <MilestoneEditor bench={bench} update={update} />
    </>
  );
}
