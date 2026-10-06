import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { chapters, site, type ChapterId } from '../content/site';
import { Frame } from '../components/Frame';
import { Verse } from '../components/Verse';
import { buildFall } from '../scroll/fall';
import { animateChapter } from '../scroll/chapters';
import { getEngine } from '../engine/engineStore';
import { onTick, prefersReducedMotion } from '../loop/ticker';
import { resetRig } from '../scroll/rig';

// Section heights (vh) set each chapter's share of the scroll, and therefore
// its share of the camera timeline: I ≈ 0–15%, II ≈ 15–57%, III ≈ 57–78%,
// IV ≈ 78–100%, then the singularity screen.
const sectionClass = 'relative';
const stickyClass = 'sticky top-0 h-svh overflow-hidden';

export function Home() {
  const mainRef = useRef<HTMLElement>(null);
  const chapterRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const get = (id: ChapterId) => main.querySelector<HTMLElement>(`#${id}`)!;

    const ctx = gsap.context(() => {
      if (!prefersReducedMotion) {
        buildFall(main, { approach: get('approach'), disk: get('disk'), accretion: get('accretion'), fall: get('fall') });
      }
      (Object.keys(chapters) as ChapterId[]).forEach((id) => {
        const section = get(id);
        if (id !== 'singularity') animateChapter(section, { enter: id !== 'approach', reducedMotion: prefersReducedMotion });
        ScrollTrigger.create({
          trigger: section,
          start: 'top center',
          end: 'bottom center',
          onToggle: (self) => {
            if (self.isActive && chapterRef.current) {
              chapterRef.current.textContent = `${chapters[id].numeral} · ${chapters[id].name}`;
            }
          },
        });
      });
    }, main);

    // Layout settles once the display face arrives; re-measure triggers then.
    void document.fonts.ready.then(() => ScrollTrigger.refresh());

    // Spaghettification: text stretches as the camera nears the horizon.
    const root = document.documentElement;
    let last = -1;
    const stopTidal = onTick(() => {
      const r = getEngine()?.cameraRadius ?? 40;
      const t = gsap.utils.clamp(0, 1, (8 - r) / (8 - 1.3));
      const v = Math.round(t * t * 1000) / 1000;
      if (v !== last) {
        root.style.setProperty('--tidal', String(v));
        last = v;
      }
    });

    return () => {
      stopTidal();
      root.style.removeProperty('--tidal');
      ctx.revert();
      resetRig();
    };
  }, []);

  const { disk, accretion, fall } = chapters;

  return (
    <>
      <Frame chapterRef={chapterRef} />
      <main id="main" ref={mainRef}>
        {/* I · Approach: the hero */}
        <section id="approach" aria-labelledby="hero-name" className={`${sectionClass} h-[160vh]`}>
          <div className={stickyClass}>
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

        {/* II · The Disk: projects orbit here (bodies arrive in phase 3) */}
        <section id="disk" aria-labelledby="disk-title" className={`${sectionClass} h-[460vh]`}>
          <div className={stickyClass}>
            <div data-chapter-content className="grid h-full grid-rows-[1fr_auto] px-5 pt-36 pb-6 md:px-10 md:pt-44 md:pb-9">
              <div className="tidal self-start">
                <p data-line className="label mb-4 text-ink-3">
                  {disk.numeral} · {disk.caption}
                </p>
                <h2 id="disk-title" className="chapter-title" data-split>
                  {disk.title}
                </h2>
              </div>
              <Verse lines={disk.verse} index="II.a" className="justify-self-end md:mr-[6vw]" />
            </div>
          </div>
        </section>

        {/* III · Accretion: about */}
        <section id="accretion" aria-labelledby="accretion-title" className={`${sectionClass} h-[220vh]`}>
          <div className={stickyClass}>
            <div data-chapter-content className="grid h-full grid-rows-[auto_1fr_auto] px-5 pt-36 pb-6 md:px-10 md:pt-44 md:pb-9">
              <Verse lines={accretion.verse} index="III.a" className="scrim justify-self-start" />
              <div />
              <div className="tidal grid items-end gap-8 md:grid-cols-[1fr_auto]">
                <p data-line className="scrim max-w-[38ch] font-display text-[clamp(1.2rem,1.9vw,1.7rem)] leading-[1.3] font-light text-ink-1">
                  {accretion.bio}
                </p>
                <div className="scrim md:text-right">
                  <p data-line className="label mb-4 text-ink-3">
                    {accretion.numeral} · {accretion.caption}
                  </p>
                  <h2 id="accretion-title" className="chapter-title" data-split>
                    {accretion.title}
                  </h2>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* IV · The Fall */}
        <section id="fall" aria-labelledby="fall-title" className={`${sectionClass} h-[240vh]`}>
          <div className={stickyClass}>
            <div data-chapter-content className="flex h-full flex-col justify-center px-5 md:px-10">
              <div className="md:ml-[8vw]">
                <div className="tidal scrim mb-10">
                  <p data-line className="label mb-4 text-ink-3">
                    {fall.numeral}
                  </p>
                  <h2 id="fall-title" className="chapter-title" data-split>
                    {fall.title}
                  </h2>
                </div>
                <Verse lines={fall.verse} index="IV.a" className="scrim" />
              </div>
            </div>
          </div>
        </section>

        {/* V · Singularity: contact arrives in phase 5 */}
        <section id="singularity" aria-label="Singularity" className="flex h-svh items-center justify-center">
          <p className="label text-ink-4">{chapters.singularity.numeral} · Singularity</p>
        </section>
      </main>
    </>
  );
}
