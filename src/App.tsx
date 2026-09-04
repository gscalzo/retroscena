import { Link, Route, Routes } from 'react-router-dom';
import { Home } from './screens/Home';
import { BenchScreen } from './screens/BenchScreen';
import { RoomScreen } from './screens/RoomScreen';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/:slug/bench" element={<BenchScreen />} />
      <Route path="/:slug/room" element={<RoomScreen />} />
      <Route
        path="*"
        element={
          <main className="empty">
            <h1>Presentation not found</h1>
            <Link to="/">All presentations</Link>
          </main>
        }
      />
    </Routes>
  );
}
