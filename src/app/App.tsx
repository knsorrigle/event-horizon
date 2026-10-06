import { Stage } from '../components/Stage';
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
      {route.name === 'work' && <Work slug={route.slug} />}
      {route.name === 'notFound' && <NotFound />}
    </>
  );
}
