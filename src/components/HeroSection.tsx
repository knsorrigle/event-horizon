import { site } from '../content/site';

/**
 * I · Approach: the hero. Deliberately pure (content in, markup out, no
 * browser APIs), because it's also rendered to static HTML at build time
 * (src/prerender.tsx): the name, which is the LCP element, paints straight
 * from the HTML instead of waiting for the JS bundle.
 */
export function HeroSection() {
  return (
    <section id="approach" aria-labelledby="hero-name" className="relative h-[160vh]">
      <div className="sticky top-0 h-svh overflow-hidden">
        <div data-chapter-content className="flex h-full flex-col justify-end px-5 pb-6 md:px-10 md:pb-9">
          <div className="flex items-end justify-between gap-8">
            <div className="tidal">
              <h1 id="hero-name" className="hero-name" data-split>
                {site.name}
              </h1>
              <p data-line className="mt-5 max-w-[34ch] font-display text-[clamp(1.05rem,1.5vw,1.35rem)] leading-snug font-light text-ink-2 md:ml-[0.6vw]">
                {site.tagline}
              </p>
            </div>
            <p data-line className="label hidden pb-1 text-ink-3 md:block" aria-hidden="true">
              Descend ↓
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
