import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { Link, cameFromOrbit, navigate } from '../app/router';
import { useDocumentMeta } from '../app/meta';
import { projects, visibleStack, type Project } from '../content/projects';
import { READING, heroRig, parkRig, rig } from '../scroll/rig';
import { getDeparture, returnToOrbit } from '../scroll/slingshot';
import { keplerOmega } from '../engine/bodies';
import { lenis, prefersReducedMotion } from '../loop/ticker';
import { Readouts } from '../components/Readouts';
import { Panel, Pending, Plate, SpecList } from '../components/Panel';

gsap.registerPlugin(SplitText);

const SURFACE_LABEL: Record<Project['body']['surface'], string> = {
  banded: 'banded',
  cellular: 'cellular',
  filament: 'filament',
  vortex: 'vortex',
  crescent: 'crescent',
  waves: 'standing waves',
};

const CHAPTERS = [
  { key: 'problem', numeral: 'i', title: 'The problem', todo: 'the problem, in a few sentences' },
  { key: 'hardPart', numeral: 'ii', title: 'The hard part', todo: 'the hard part you solved' },
  { key: 'result', numeral: 'iii', title: 'Result', todo: 'what came of it (real outcomes only)' },
] as const;

let leaving = false;

export function Work({ slug }: { slug: string }) {
  const index = projects.findIndex((p) => p.slug === slug);
  const project = projects[index];
  const mainRef = useRef<HTMLElement>(null);
  useDocumentMeta(project ? `${project.name} · Rohith A` : 'Not found · Rohith A', project?.oneLiner ?? 'Nothing escapes here.');

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (index < 0 || !main) return;
    leaving = false;
    parkRig(index);

    const ctx = gsap.context(() => {
      // The scene behind settles into reading mode: dimmed and defocused.
      if (prefersReducedMotion) Object.assign(rig, READING);
      else gsap.to(rig, { ...READING, duration: 1.1, delay: 0.15, ease: 'power2.inOut' });

      if (prefersReducedMotion) return;
      const title = main.querySelector<HTMLElement>('[data-title]');
      if (title) {
        // words,chars: hyphenated names stay one unbreakable word.
        const split = SplitText.create(title, { type: 'words,chars', aria: 'auto', mask: 'chars' });
        gsap.from(split.chars, { yPercent: 105, duration: 0.9, stagger: 0.025, ease: 'power3.out', delay: 0.1 });
      }
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.from(el, {
          autoAlpha: 0,
          y: 18,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      });
    }, main);
    return () => ctx.revert();
  }, [index]);

  if (!project) return <NotFound />;

  const backToOrbit = () => {
    if (leaving) return;
    leaving = true;
    const departure = getDeparture();
    lenis?.stop();
    // Clear the page so the flight back is visible, then reverse the slingshot.
    if (mainRef.current) gsap.to(mainRef.current, { autoAlpha: 0, duration: prefersReducedMotion ? 0 : 0.35, ease: 'power1.in' });
    returnToOrbit(departure?.rig ?? heroRig(), {
      reducedMotion: prefersReducedMotion,
      onComplete: () => {
        lenis?.start();
        if (cameFromOrbit()) history.back();
        else navigate('/', { scrollY: departure?.scrollY ?? 0 });
      },
    });
  };

  const cs = project.caseStudy;
  const a = project.body.orbitRadius;
  const period = (2 * Math.PI) / keplerOmega(a);
  const next = projects[(index + 1) % projects.length]!;
  const num = (i: number) => String(i).padStart(2, '0');

  return (
    <>
      {/* Fixed bar with a fade-to-void backdrop so content scrolls under it cleanly. */}
      <div className="case-bar pointer-events-none fixed inset-x-0 top-0 z-10 flex items-start justify-between px-5 pt-5 pb-14 md:px-10 md:pt-8">
        <button type="button" onClick={backToOrbit} className="label pointer-events-auto cursor-pointer text-ink-2 transition-colors hover:text-ink-1">
          ← Back to orbit
        </button>
        <p className="label text-ink-2">
          Case study · {num(index + 1)} / {num(projects.length)}
        </p>
      </div>

      <main id="main" ref={mainRef} className="px-5 md:px-10">
        <section className="relative grid min-h-svh grid-rows-[1fr_auto] gap-10 pt-40 pb-12 md:grid-cols-[1fr_minmax(20rem,26rem)] md:items-end md:gap-16">
          <Readouts className="scrim absolute top-24 right-0 hidden md:grid md:top-28" />
          <div className="scrim w-full self-end [container-type:inline-size]">
            <p className="label mb-5 text-ink-3">
              Body {num(index + 1)} · a = {a.toFixed(1)} R<sub>s</sub>
            </p>
            <h1 data-title className="case-title" style={{ '--chars': project.name.length } as CSSProperties}>
              {project.name}
            </h1>
            <p className="mt-6 max-w-[36ch] font-display text-[clamp(1.25rem,2vw,1.7rem)] leading-snug font-light text-ink-1">{project.oneLiner}</p>
          </div>

          <Panel code={`OBS-${num(index + 1)}`} title="Spec" aside="Live" className="self-end">
            <SpecList
              rows={[
                { k: 'Role', v: cs.role ?? <Pending what="your role" /> },
                { k: 'Stack', v: visibleStack(project).join(' · ') },
                { k: 'Year', v: project.year ?? <Pending what="year" /> },
                { k: 'Surface', v: SURFACE_LABEL[project.body.surface] },
                {
                  k: 'Orbit',
                  v: (
                    <>
                      a {a.toFixed(1)} R<sub>s</sub> · v {(1 / Math.sqrt(2 * (a - 1))).toFixed(2)} c · T {period.toFixed(0)} R<sub>s</sub>/c
                    </>
                  ),
                },
                {
                  k: 'Links',
                  v: cs.links.length ? (
                    <span className="flex flex-wrap gap-x-3">
                      {cs.links.map((l) => (
                        <a key={l.href} href={l.href} className="underline decoration-ink-4 underline-offset-4 hover:text-ink-1" rel="noreferrer" target="_blank">
                          {l.label} ↗
                        </a>
                      ))}
                    </span>
                  ) : (
                    <Pending what="links" />
                  ),
                },
              ]}
            />
          </Panel>
        </section>

        {CHAPTERS.map((c) => {
          const text = cs[c.key];
          if (!text && !import.meta.env.DEV) return null;
          return (
            <section key={c.key} className="case-chapter" data-reveal aria-labelledby={`ch-${c.key}`}>
              <p className="label text-ink-3">
                <span className="font-mono normal-case">{c.numeral}.</span>{' '}
                <span id={`ch-${c.key}`}>{c.title}</span>
              </p>
              <p className="scrim max-w-[34ch] font-display text-[clamp(1.4rem,2.4vw,2.1rem)] leading-[1.25] font-light text-ink-1">
                {text ?? <Pending what={c.todo} />}
              </p>
            </section>
          );
        })}

        {(cs.media.length > 0 || import.meta.env.DEV) && (
          <section aria-label="Plates" className="py-24">
            <p className="label mb-8 text-ink-3" data-reveal>
              Plates · {cs.media.length || 'no signal'}
            </p>
            <div className="grid gap-10 md:grid-cols-2">
              {(cs.media.length ? cs.media : [undefined, undefined]).map((item, i) => (
                <Plate key={item?.src ?? i} index={i + 1} item={item} />
              ))}
            </div>
          </section>
        )}

        <footer className="flex flex-col gap-10 border-t border-ink-4 py-16 md:flex-row md:items-end md:justify-between" data-reveal>
          <button type="button" onClick={backToOrbit} className="label cursor-pointer self-start text-ink-2 hover:text-ink-1">
            ← Back to orbit
          </button>
          <Link href={`/work/${next.slug}`} className="group md:text-right">
            <span className="label text-ink-3">Next body · {num(projects.indexOf(next) + 1)}</span>
            <span className="mt-2 block font-display text-[clamp(2.2rem,5vw,4.5rem)] leading-none text-ink-2 transition-colors group-hover:text-ink-1">
              {next.name} →
            </span>
          </Link>
        </footer>
      </main>
    </>
  );
}

export function NotFound() {
  return (
    <main id="main" className="flex min-h-svh flex-col justify-between px-5 py-6 md:px-10 md:py-9">
      <Link href="/" className="label text-ink-2 hover:text-ink-1">
        ← Back to orbit
      </Link>
      <h1 className="font-display text-[clamp(3rem,10vw,9rem)] leading-[0.85] font-light text-ink-1">Nothing escapes here.</h1>
    </main>
  );
}
