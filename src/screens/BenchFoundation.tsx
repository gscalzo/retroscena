import { Fragment } from 'react';
import { HOOK_KEYS } from '../../shared/types';
import type { Bench } from '../../shared/types';
import { wordCount } from '../../shared/format';
import { AutoTextarea } from '../components/AutoTextarea';
import { Field } from '../components/Field';

export function BenchFoundation({
  bench,
  update,
}: {
  bench: Bench;
  update: (bench: Bench) => void;
}) {
  const whoFields = [
    ['room', 'Who exactly is sitting there?'],
    ['know', 'What do they already know or believe?'],
    ['expect', 'What do they expect, and what would put them off?'],
  ] as const;
  const whyFields = [
    ['speakerGoal', 'What do YOU want out of it?'],
    ['promise', 'The promise to the room'],
  ] as const;
  return (
    <>
      <nav className="stepnav" aria-label="Steps">
        <a href="#step-who">1 · Who</a>
        <a href="#step-why">2 · Why</a>
        <a href="#step-hook">3 · Hook</a>
        <a href="#step-acts">4 · Acts</a>
      </nav>
      <section className="step" id="step-who">
        <div className="step-head">
          <span className="step-tag">WHO · target audience</span>
          <h2>Who is in the room</h2>
          <p className="step-note">
            Everything downstream, the beats you keep and the acts you retime, gets filtered against
            these three answers.
          </p>
        </div>
        <div className="fields cols3">
          {whoFields.map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={bench.who[key]}
              onChange={(value) => update({ ...bench, who: { ...bench.who, [key]: value } })}
            />
          ))}
        </div>
      </section>
      <section className="step" id="step-why">
        <div className="step-head">
          <span className="step-tag">WHY · goals and outcomes</span>
          <h2>Why this talk exists</h2>
          <p className="step-note">
            Two goals, then the Think, Feel, Do map: what the room walks in with, against what it
            should walk out with.
          </p>
        </div>
        <div className="fields cols2">
          {whyFields.map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={bench.why[key]}
              onChange={(value) => update({ ...bench, why: { ...bench.why, [key]: value } })}
            />
          ))}
        </div>
        <div className="throughline">
          <Field
            label="Throughline, testable in 15 words or fewer"
            value={bench.why.throughline}
            onChange={(value) => update({ ...bench, why: { ...bench.why, throughline: value } })}
          />
          <span className={`wordcount ${wordCount(bench.why.throughline) > 15 ? 'over' : ''}`}>
            {wordCount(bench.why.throughline)} / 15 words
          </span>
        </div>
        <div className="tfd">
          <div />
          <div className="tfd-colh">Walking in (what is)</div>
          <div className="tfd-colh">Walking out (what could be)</div>
          {(['think', 'feel', 'do'] as const).map((key) => (
            <Fragment key={key}>
              <div className="tfd-rowh">{key}</div>
              {(['now', 'after'] as const).map((side) => (
                <AutoTextarea
                  key={side}
                  className="input"
                  aria-label={`${key}, ${side}`}
                  value={bench.why.tfd[key][side]}
                  onChange={(e) =>
                    update({
                      ...bench,
                      why: {
                        ...bench.why,
                        tfd: {
                          ...bench.why.tfd,
                          [key]: { ...bench.why.tfd[key], [side]: e.target.value },
                        },
                      },
                    })
                  }
                />
              ))}
            </Fragment>
          ))}
        </div>
      </section>
      <section className="step" id="step-hook">
        <div className="step-head">
          <span className="step-tag">WHAT · the opening</span>
          <h2>The 30 second hook</h2>
          <p className="step-note">
            Five ways in. Choose the opening that serves the throughline. Its timing rides with the
            first act.
          </p>
        </div>
        <div className="hooks">
          {HOOK_KEYS.map((key) => (
            <div className={`hook ${bench.hook.selected === key ? 'sel' : ''}`} key={key}>
              <label className="hook-type">
                <input
                  type="radio"
                  name="hook"
                  checked={bench.hook.selected === key}
                  onChange={() => update({ ...bench, hook: { ...bench.hook, selected: key } })}
                />{' '}
                {key}
              </label>
              <AutoTextarea
                className="hook-text"
                aria-label={`${key} hook`}
                value={bench.hook.texts[key]}
                onChange={(e) =>
                  update({
                    ...bench,
                    hook: { ...bench.hook, texts: { ...bench.hook.texts, [key]: e.target.value } },
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
