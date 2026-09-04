import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  articleVisible,
  articlesIn,
  groupCounts,
  READ_FILTERS,
  roomCounts,
} from '../../shared/room';
import type { ReadFilter } from '../../shared/room';
import type { Room } from '../../shared/types';
import { ArticleCard } from '../components/ArticleCard';
import { DocumentScreen } from './DocumentScreen';

function RoomEditor({ room, update }: { room: Room; update: (room: Room) => void }) {
  const [filter, setFilter] = useState<ReadFilter>('all');
  const counts = roomCounts(room);
  return (
    <main className="room-main">
      <div className="roombar">
        <div className="progress">
          <progress
            aria-label="Reading progress"
            max={Math.max(1, counts.total)}
            value={counts.read}
          />
          <span className="pcount">
            {counts.read} / {counts.total} read
          </span>
        </div>
        <div className="chips">
          {READ_FILTERS.map((value) => (
            <button
              className={`fchip ${value === filter ? 'on' : ''}`}
              aria-pressed={value === filter}
              key={value}
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="intro">
        <p>
          Sources in reading order. Tick an article when you have read it, and leave margin notes.
          Save to keep your changes.
        </p>
      </div>
      {room.articles.length === 0 && (
        <div className="empty">
          <b>Your reading room is ready.</b>Sources and captures added to this presentation will
          appear here.
        </div>
      )}
      {room.groups.map((group) => {
        const c = groupCounts(room, group.id);
        const articles = articlesIn(room, group.id).filter((article) =>
          articleVisible(article, filter),
        );
        return (
          <section className="group" key={group.id}>
            <div className="group-head">
              <h2>{group.title}</h2>
              <span className="gcount">
                {c.read}/{c.total} read
              </span>
            </div>
            <p className="group-sub">{group.sub}</p>
            <div className="cards">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} room={room} onChange={update} />
              ))}
            </div>
            {articles.length === 0 && c.total > 0 && (
              <p className="step-note">No articles match this filter.</p>
            )}
          </section>
        );
      })}
    </main>
  );
}

export function RoomScreen() {
  const { slug = '' } = useParams();
  return (
    <DocumentScreen<Room> key={slug} slug={slug} kind="room">
      {(room, update) => <RoomEditor room={room} update={update} />}
    </DocumentScreen>
  );
}
