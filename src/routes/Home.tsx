import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { chapters, site, type ChapterId } from '../content/site';
import { Frame } from '../components/Frame';
import { HeroSection } from '../components/HeroSection';
import { Verse } from '../components/Verse';
import { buildFall } from '../scroll/fall';
import { animateChapter, animateSingularity } from '../scroll/chapters';
import { setupWhiteHole } from '../scroll/whitehole';
import { Singularity } from '../components/Singularity';
import { getEngine } from '../engine/engineStore';
import { lenis, onTick, prefersReducedMotion } from '../loop/ticker';
import { resetRig, rig } from '../scroll/rig';
import { Annotations } from '../components/Annotations';
import { ProjectIndex, ProjectList } from '../components/ProjectList';
import { useRenderMode } from '../engine/engineStore';
import { projects } from '../content/projects';
import { hoveredBody, setHovered, setInteractive, setLocked } from '../engine/interaction';
import { setDeparture, slingshot } from '../scroll/slingshot';
import { navigate } from '../app/router';
import { useDocumentMeta } from '../app/meta';

// Section heights (vh) set each chapter's share of the scroll, and therefore
// its share of the camera timeline: I ≈ 0–15%, II ≈ 15–57%, III ≈ 57–78%,
// IV ≈ 78–100%, then the singularity screen.
const sectionClass = 'relative';
const stickyClass = 'sticky top-0 h-svh overflow-hidden';

let launching = false;

/** Slingshot to a project body, then route to its case study. */
function launch(index: number): void {
  const project = projects[index];
  if (!project || launching) return;
  launching = true;
  // Remember the exact orbit we leave from, for the return trip.
  setDeparture({ rig: { ...rig }, scrollY: lenis ? lenis.scroll : window.scrollY });
  setLocked(index + 1);
  lenis?.stop();
  slingshot(index, {
    reducedMotion: prefersReducedMotion,
    onComplete: () => {
      launching = false;
      lenis?.start();
      navigate(`/work/${project.slug}`, { fromOrbit: true });
    },
  });
}

export function Home() {
  const mainRef = useRef<HTMLElement>(null);
  const chapterRef = useRef<HTMLSpanElement>(null);
  const toastRef = useRef<HTMLSpanElement>(null);
  useDocumentMeta(`${site.name} · Event Horizon`, `${site.name} (${site.handle}): portfolio. ${site.tagline}`);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    resetRig();
    setInteractive(true);
    const get = (id: ChapterId) => main.querySelector<HTMLElement>(`#${id}`)!;

    const ctx = gsap.context(() => {
      if (!prefersReducedMotion) {
        buildFall(main, { approach: get('approach'), disk: get('disk'), accretion: get('accretion'), fall: get('fall'), singularity: get('singularity') });
      }
      (Object.keys(chapters) as ChapterId[]).forEach((id) => {
        const section = get(id);
        if (id === 'singularity') animateSingularity(section, { reducedMotion: prefersReducedMotion });
        else animateChapter(section, { enter: id !== 'approach', reducedMotion: prefersReducedMotion });
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

    // Bodies are picked in the shader; a click on canvas space over one
    // launches the slingshot. Links and buttons keep their own behaviour.
    const onClick = (e: MouseEvent) => {
      if (lastPointer === 'touch') return; // taps are handled below
      const id = hoveredBody();
      if (id === 0 || (e.target instanceof Element && e.target.closest('a, button'))) return;
      launch(id - 1);
    };
    window.addEventListener('click', onClick);

    // Touch: no hover, so tap once to select a body (shows its annotation),
    // tap it again to slingshot; tap empty space to clear. Scroll gestures
    // (movement or long presses) are ignored.
    let lastPointer = 'mouse';
    let down: { x: number; y: number; t: number } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      lastPointer = e.pointerType;
      down = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const held = performance.now() - down.t;
      down = null;
      if (moved > 10 || held > 450) return;
      if (e.target instanceof Element && e.target.closest('a, button')) return;
      const engine = getEngine();
      if (!engine) return;
      void engine.pickAt(e.clientX, e.clientY).then((id) => {
        if (id !== 0 && id === hoveredBody()) launch(id - 1);
        else setHovered(id);
      });
    };
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });

    // Overscroll past the singularity → white hole → back at the hero.
    const stopWhiteHole = setupWhiteHole({
      main,
      onEject: () => {
        const toast = toastRef.current;
        if (toast) gsap.timeline().fromTo(toast, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }).to(toast, { autoAlpha: 0, duration: 0.8 }, '+=3');
      },
    });
    let lastCursor = 0;
    const stopCursor = onTick(() => {
      const id = hoveredBody();
      if (id !== lastCursor) {
        root.style.cursor = id ? 'pointer' : '';
        lastCursor = id;
      }
    });

    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      stopWhiteHole();
      stopCursor();
      root.style.cursor = '';
      stopTidal();
      root.style.removeProperty('--tidal');
      ctx.revert();
      setInteractive(false);
      resetRig();
    };
  }, []);

  const { disk, accretion, fall } = chapters;
  // No live bodies in the static fallback: show the projects as a visible index.
  const fallback = useRenderMode() === 'fallback';

  return (
    <>
      <Frame chapterRef={chapterRef} toastRef={toastRef} />
      <Annotations />
      <main id="main" ref={mainRef}>
        {/* I · Approach: the hero (also prerendered into the HTML at build) */}
        <HeroSection />

        {/* II · The Disk: the projects orbit here as lensed bodies */}
        <section id="disk" aria-labelledby="disk-title" className={`${sectionClass} h-[460vh]`}>
          <ProjectList onLaunch={launch} />
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
              <div className="flex flex-col items-end gap-10">
                {fallback && <ProjectIndex onLaunch={launch} />}
                <Verse lines={disk.verse} index="II.a" className="md:mr-[6vw]" />
              </div>
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

        {/* V · Singularity: a beat of black, then contact. Overscroll for the white hole. */}
        <Singularity />
      </main>
    </>
  );
}
