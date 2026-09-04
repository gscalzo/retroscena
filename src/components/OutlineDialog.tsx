import { useEffect, useRef, useState } from 'react';

export function OutlineDialog({ markdown, onClose }: { markdown: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState('');
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement;
    element.showModal();
    return () => {
      element.close();
      previous.focus();
    };
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setStatus('Copied outline.');
    } catch {
      setStatus('Copy unavailable. Select the outline and copy it manually.');
    }
  }
  return (
    <dialog
      ref={dialog}
      className="outline-dialog"
      aria-labelledby="outline-title"
      onCancel={onClose}
    >
      <div className="modal-box">
        <h3 id="outline-title">Outline as Markdown</h3>
        <textarea
          aria-label="Markdown outline"
          readOnly
          value={markdown}
          onFocus={(e) => e.target.select()}
        />
        <p role="status">{status}</p>
        <div className="modal-actions">
          <button
            className="btn"
            onClick={() => {
              void copy();
            }}
          >
            Copy
          </button>
          <a
            className="btn"
            href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`}
            download="outline.md"
          >
            Download Markdown
          </a>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
