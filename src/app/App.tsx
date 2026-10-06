import { Stage } from '../components/Stage';
import { DebugPanel, debugEnabled } from '../components/DebugPanel';
import { Home } from '../routes/Home';
import { NotFound, Work } from '../routes/Work';
import { useRoute } from './router';

export function App() {
  const route = useRoute();
  return (
    <>
      <a href="#main" className="label sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:outline focus:outline-1 focus:outline-ink-1 focus:p-2">
        Skip to content
      </a>
      <Stage />
      {route.name === 'home' && <Home />}
      {/* Keyed: each case study mounts fresh (SplitText rewrites its heading's DOM). */}
      {route.name === 'work' && <Work key={route.slug} slug={route.slug} />}
      {route.name === 'notFound' && <NotFound />}
      {debugEnabled && <DebugPanel />}
    </>
  );
}
