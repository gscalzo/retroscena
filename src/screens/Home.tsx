import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fmtDate, fmtMin, slugify } from '../../shared/format';
import type { PresentationSummary } from '../../shared/types';
import { api } from '../lib/api';

function CreateForm({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [event, setEvent] = useState('');
  const [date, setDate] = useState('');
  const [target, setTarget] = useState(25);
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError('');
    try {
      const result = await api.create({
        title,
        event,
        date: date || null,
        target,
        slug: slug || slugify(title),
      });
      await navigate(`/${result.presentation.slug}/bench`);
    } catch (reason) {
      setError(String(reason));
      setBusy(false);
    }
  }
  return (
    <form
      className="newform"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h3>New presentation</h3>
      <div className="fields cols2">
        <label className="field">
          Title
          <input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          Event
          <input value={event} onChange={(e) => setEvent(e.target.value)} />
        </label>
        <label className="field">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          Slot in minutes
          <input
            type="number"
            required
            min="1"
            max="300"
            value={target}
            onChange={(e) => setTarget(e.target.valueAsNumber)}
          />
        </label>
        <label className="field">
          Address
          <input
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={60}
            placeholder={slugify(title)}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>
      </div>
      <div className="newform-foot">
        <span className="slug">/{slug || slugify(title)}/bench</span>
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create presentation'}
        </button>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function PresentationCard({
  item,
  onArchive,
}: {
  item: PresentationSummary;
  onArchive: (item: PresentationSummary) => void;
}) {
  return (
    <article className={`pcard ${item.archivedAt !== null ? 'archived' : ''}`}>
      <p className="pcard-when">
        <b>{item.date === null ? 'Date to be set' : fmtDate(item.date)}</b>
        <span>{fmtMin(item.target)} slot</span>
      </p>
      <h3>
        <Link to={`/${item.slug}/bench`}>{item.title}</Link>
      </h3>
      <p className="pcard-event">{item.event}</p>
      <div className="pcard-rows">
        <Link className="pcard-row" to={`/${item.slug}/bench`}>
          <b>Workbench</b>
          <span>
            {item.bench.beats} beats · {fmtMin(item.bench.minutes)} on the run
          </span>
        </Link>
        <Link className="pcard-row" to={`/${item.slug}/room`}>
          <b>Reading room</b>
          <span>
            {item.room.read} / {item.room.total} read
          </span>
        </Link>
      </div>
      <div className="pcard-foot">
        <button className="btn sm" onClick={() => onArchive(item)}>
          {item.archivedAt === null ? 'Archive' : 'Unarchive'}
        </button>
      </div>
    </article>
  );
}

export function Home() {
  const [items, setItems] = useState<PresentationSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void api
      .list()
      .then((res) => {
        if (active) setItems(res.presentations);
      })
      .catch((reason: unknown) => {
        if (active) setError(String(reason));
      });
    return () => {
      active = false;
    };
  }, []);
  async function archive(item: PresentationSummary) {
    try {
      const { presentation } = await api.update(item.slug, { archived: item.archivedAt === null });
      setItems((current) => current!.map((p) => (p.slug === item.slug ? presentation : p)));
    } catch (reason) {
      setError(String(reason));
    }
  }
  const cards = (archived: boolean) =>
    items
      ?.filter((p) => (p.archivedAt !== null) === archived)
      .map((item) => (
        <PresentationCard
          key={item.slug}
          item={item}
          onArchive={(p) => {
            void archive(p);
          }}
        />
      ));
  return (
    <div className="shell" data-surface="home">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            🧰
          </span>
          <div>
            <h1>Retroscena</h1>
            <p className="brand-sub">The backstage of every talk</p>
          </div>
        </div>
      </header>
      <main className="home">
        <div className="home-head">
          <div>
            <h2>Your next turn on stage.</h2>
            <p>A workbench for the talk. A reading room for what it stands on.</p>
          </div>
          <button className="btn primary" onClick={() => setCreating(true)}>
            New presentation
          </button>
        </div>
        {creating && <CreateForm onCancel={() => setCreating(false)} />}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {items === null ? (
          <div className="empty">
            {error ? (
              <button className="btn" onClick={() => window.location.reload()}>
                Retry loading presentations
              </button>
            ) : (
              <p role="status">Loading presentations…</p>
            )}
          </div>
        ) : (
          <>
            <div className="pgrid">{cards(false)}</div>
            {items.every((p) => p.archivedAt !== null) && (
              <div className="empty">
                <b>No active presentations.</b>Create a presentation to start shaping the talk.
              </div>
            )}
            <details className="archived-fold">
              <summary>
                Archived presentations ({items.filter((p) => p.archivedAt !== null).length})
              </summary>
              <div className="pgrid">{cards(true)}</div>
            </details>
          </>
        )}
      </main>
    </div>
  );
}
