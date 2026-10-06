import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { chooseSilence, enableSound, useSoundPref } from '../audio';
import { heroShadow } from './IntroRing';
import { onTick, prefersReducedMotion } from '../loop/ticker';

/**
 * Two quiet choices under the intro ring, shown until the visitor picks one.
 * Either click is the user gesture that unlocks the AudioContext; nothing ever
 * plays without it. Fades away while scrolled down the page.
 */
export function SoundGate() {
  const pref = useSoundPref();
  const ref = useRef<HTMLDivElement>(null);
  // Under the intro ring, but never over the name: measured after mount (the
  // hero has to be in the DOM), clamped above the name block.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const s = heroShadow(window.innerWidth, window.innerHeight);
    const nameTop = document.getElementById('hero-name')?.getBoundingClientRect().top ?? window.innerHeight;
    setPos({
      x: Math.min(Math.max(s.x, 190), window.innerWidth - 190),
      y: Math.min(s.y + s.radius * 1.9 + 46, nameTop - 56),
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: prefersReducedMotion ? 0 : 1.2, delay: 0.6 });
    let shown = true;
    return onTick(() => {
      const show = window.scrollY < window.innerHeight * 0.35;
      if (show === shown) return;
      shown = show;
      gsap.to(el, { autoAlpha: show ? 1 : 0, duration: 0.4 });
    });
  }, []);

  if (pref !== null) return null;

  const choose = (sound: boolean) => () => {
    const el = ref.current;
    if (sound) enableSound();
    else chooseSilence();
    if (el) gsap.to(el, { autoAlpha: 0, duration: 0.5 });
    // The gate unmounts; hand focus to the toggle that now reflects the choice.
    document.querySelector<HTMLButtonElement>('.sound-toggle')?.focus({ preventScroll: true });
  };

  return (
    <div
      ref={ref}
      data-sound-control
      role="group"
      aria-label="Sound"
      className="sound-gate fixed z-20 flex -translate-x-1/2 gap-4 whitespace-nowrap md:gap-6"
      style={{ left: pos?.x ?? '50%', top: pos?.y ?? '60%', opacity: 0 }}
    >
      <button type="button" className="label cursor-pointer text-ink-1" onClick={choose(true)}>
        Enter with sound
      </button>
      <span className="label text-ink-3" aria-hidden="true">
        /
      </span>
      <button type="button" className="label cursor-pointer text-ink-2" onClick={choose(false)}>
        Enter in silence
      </button>
    </div>
  );
}
