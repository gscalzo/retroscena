import type { DocMeta } from '../../shared/types';

interface SaveState {
  baseRev: number;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  notice: string | null;
  conflict: DocMeta | null;
  save: () => Promise<void>;
  reload: () => Promise<void>;
  keepEditing: () => void;
}

function saveLabel(state: SaveState): string {
  if (state.saving) return 'Saving…';
  return state.dirty ? 'Unsaved changes' : `Saved · revision ${state.baseRev}`;
}

export function SaveBar({ state }: { state: SaveState }) {
  return (
    <div className="document-status">
      <div className="top-actions">
        <span className={`save-status ${state.dirty ? 'dirty' : ''}`} role="status">
          {saveLabel(state)}
        </span>
        <button
          className="btn primary"
          disabled={!state.dirty || state.saving}
          onClick={() => {
            void state.save();
          }}
        >
          Save
        </button>
      </div>
      {state.error !== null && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      {state.notice !== null && (
        <p className="notice" role="status">
          {state.notice}
        </p>
      )}
      {state.conflict !== null && (
        <div className="banner conflict" role="alert">
          <p>
            <b>A newer revision is available.</b> {state.conflict.author} saved revision{' '}
            {state.conflict.rev}. Reload to use it, or keep editing your local draft. Saving against
            the older revision will be refused.
          </p>
          <button
            className="btn"
            onClick={() => {
              void state.reload();
            }}
          >
            Reload
          </button>
          <button className="btn" onClick={state.keepEditing}>
            Keep editing
          </button>
        </div>
      )}
    </div>
  );
}
