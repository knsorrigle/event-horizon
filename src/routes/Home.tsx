import { site } from '../content/site';
import { Readouts } from '../components/Readouts';

export function Home() {
  return (
    <main id="main">
      <section aria-labelledby="hero-name" className="relative grid h-svh grid-rows-[auto_1fr_auto] px-5 pt-5 pb-6 md:px-10 md:pt-8 md:pb-9">
        <header className="flex items-start justify-between">
          <p className="label leading-[1.9] text-ink-2">
            Event Horizon
            <br />
            <span className="text-ink-3">Obs. 01 · Schwarzschild, a = 0</span>
          </p>
          <p className="label text-ink-2">@{site.handle}</p>
        </header>

        <Readouts className="mt-10 self-start justify-self-end md:mt-14" />

        <div className="flex items-end justify-between gap-8">
          <div>
            <h1 id="hero-name" className="hero-name">
              {site.name}
            </h1>
            <p className="mt-5 max-w-[34ch] font-display text-[clamp(1.05rem,1.5vw,1.35rem)] leading-snug font-light text-ink-2 md:ml-[0.6vw]">
              {site.tagline}
            </p>
          </div>
          <p className="label hidden pb-1 text-ink-3 md:block" aria-hidden="true">
            Descend ↓
          </p>
        </div>
      </section>
    </main>
  );
}
