// Build-time entry (vite build --ssr): renders the hero to static HTML so the
// LCP element is in the document before any JS runs. The client then renders
// the identical markup over it (createRoot), so nothing shifts.
import { renderToString } from 'react-dom/server';
import { HeroSection } from './components/HeroSection';

export function renderHero(): string {
  return renderToString(
    <main id="main">
      <HeroSection />
    </main>,
  );
}
