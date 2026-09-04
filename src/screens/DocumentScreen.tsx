import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import type { Bench, DocKind, Presentation, Room } from '../../shared/types';
import { fmtMin } from '../../shared/format';
import { api } from '../lib/api';
import { useDocument } from '../lib/useDocument';
import { SaveBar } from '../components/SaveBar';

export function DocumentScreen<T extends Bench | Room>({
  slug,
  kind,
  children,
}: {
  slug: string;
  kind: DocKind;
  children: (doc: T, update: (doc: T) => void, presentation: Presentation) => ReactNode;
}) {
  const state = useDocument<T>(slug, kind);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void api
      .presentation(slug)
      .then((res) => {
        if (active) setPresentation(res.presentation);
      })
      .catch((reason: unknown) => {
        if (active) setError(String(reason));
      });
    return () => {
      active = false;
    };
  }, [slug]);
  return (
    <div className="shell" data-surface={kind}>
      <header className="topbar">
        <div className="brand">
          <Link to="/" className="brand-mark" aria-label="All presentations">
            {kind === 'bench' ? '🧰' : '📚'}
          </Link>
          <div>
            <h1>{presentation?.title ?? 'Retroscena'}</h1>
            <p className="brand-sub">
              {presentation === null
                ? 'Loading presentation…'
                : `${presentation.event} · ${presentation.date ?? 'Date to be set'} · ${fmtMin(presentation.target)}`}
            </p>
          </div>
        </div>
        <nav className="surfacenav" aria-label="Presentation">
          <NavLink to={`/${slug}/bench`}>Bench</NavLink>
          <NavLink to={`/${slug}/room`}>Reading room</NavLink>
        </nav>
        <SaveBar state={state} />
      </header>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {state.doc !== null && presentation !== null ? (
        children(state.doc, state.update, presentation)
      ) : (
        <div className="empty">
          {[state.error, error].some(Boolean) ? (
            <button className="btn" onClick={() => window.location.reload()}>
              Retry loading presentation
            </button>
          ) : (
            <p role="status">Loading {kind}…</p>
          )}
        </div>
      )}
    </div>
  );
}
