import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { isoDate } from '../../shared/format';
import { outlineMarkdown } from '../../shared/outline';
import type { Bench, Presentation } from '../../shared/types';
import { OutlineDialog } from '../components/OutlineDialog';
import { BenchFoundation } from './BenchFoundation';
import { BenchBoard } from './BenchBoard';
import { DocumentScreen } from './DocumentScreen';

function BenchEditor({
  bench,
  update,
  presentation,
}: {
  bench: Bench;
  update: (bench: Bench) => void;
  presentation: Presentation;
}) {
  const [outline, setOutline] = useState<string | null>(null);
  return (
    <main>
      <div className="export-row">
        <button
          className="btn"
          onClick={() => setOutline(outlineMarkdown(presentation, bench, isoDate(Date.now())))}
        >
          Export outline
        </button>
      </div>
      <BenchFoundation bench={bench} update={update} />
      <BenchBoard bench={bench} update={update} />
      {outline !== null && <OutlineDialog markdown={outline} onClose={() => setOutline(null)} />}
    </main>
  );
}

export function BenchScreen() {
  const { slug = '' } = useParams();
  return (
    <DocumentScreen<Bench> key={slug} slug={slug} kind="bench">
      {(bench, update, presentation) => (
        <BenchEditor bench={bench} update={update} presentation={presentation} />
      )}
    </DocumentScreen>
  );
}
