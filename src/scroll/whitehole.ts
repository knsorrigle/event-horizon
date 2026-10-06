// The easter egg: keep scrolling past the singularity and you're spat back
// out. A white hole is a black hole run backwards in time, so that's what this
// does: the screen erupts in light, then the page scrolls back to the top and
// the scrubbed camera timeline replays the whole fall in reverse (readouts
// counting down from ∞) until you land at the hero.
import gsap from 'gsap';
import { lenis, onTick, prefersReducedMotion } from '../loop/ticker';
import { rig } from './rig';
import { audio } from '../audio';

/** Overscroll needed to erupt, in "pressure" units. */
const THRESHOLD = 1;
/** Pressure bleeds off over time, so it takes deliberate, sustained overscroll. */
const DECAY_PER_S = 0.5;
/** Ignore input until you've rested at the bottom this long (trackpad momentum). */
const ARM_MS = 450;
const EJECT_S = 2.6;

export function setupWhiteHole(opts: { main: HTMLElement; onEject: () => void }): () => void {
  let pressure = 0;
  let erupting = false;
  let bottomSince = 0;
  let touchY: number | null = null;

  const atBottom = () =>
    lenis
      ? lenis.scroll >= lenis.limit - 2
      : window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;

  const push = (amount: number) => {
    if (erupting || !bottomSince || performance.now() - bottomSince < ARM_MS) return;
    pressure = Math.min(THRESHOLD, pressure + amount);
    if (pressure >= THRESHOLD) erupt();
  };

  const onWheel = (e: WheelEvent) => {
    if (e.deltaY > 0) push(Math.min(e.deltaY, 120) / 900);
  };
  const onTouchStart = (e: TouchEvent) => {
    touchY = e.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (e: TouchEvent) => {
    const y = e.touches[0]?.clientY;
    if (y === undefined || touchY === null) return;
    if (touchY - y > 0) push((touchY - y) / 600);
    touchY = y;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'End' || e.key === ' ') push(0.22);
  };

  const root = document.documentElement;
  let flaring = false;
  const stopTick = onTick((_t, dms) => {
    // While the light is up, the HUD inverts against it (see .is-flaring).
    const nowFlaring = rig.flare > 0.25;
    if (nowFlaring !== flaring) {
      flaring = nowFlaring;
      root.classList.toggle('is-flaring', flaring);
    }
    if (erupting) return;
    if (atBottom()) bottomSince ||= performance.now();
    else bottomSince = 0;
    pressure = Math.max(0, pressure - (dms / 1000) * DECAY_PER_S);
    // Feedback: the black starts to glow, grain by grain, as pressure builds.
    rig.flare = prefersReducedMotion ? 0 : pressure * pressure * 0.18;
  });

  function land() {
    gsap.to(opts.main, { autoAlpha: 1, duration: 0.6, ease: 'power1.out' });
    erupting = false;
    bottomSince = 0;
    opts.onEject();
  }

  function erupt() {
    erupting = true;
    pressure = 0;
    audio.whiteHole();

    if (prefersReducedMotion || !lenis) {
      // No eruption, no flight: a brief crossfade and you're back at the top.
      gsap.to(opts.main, {
        autoAlpha: 0,
        duration: 0.25,
        onComplete: () => {
          rig.flare = 0;
          if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
          else window.scrollTo(0, 0);
          land();
        },
      });
      return;
    }

    const l = lenis;
    gsap.to(opts.main, { autoAlpha: 0, duration: 0.25, ease: 'power1.in' });
    gsap
      .timeline()
      .to(rig, { flare: 1, duration: 0.4, ease: 'power3.in' })
      .add(() => {
        // Scroll home; the scrubbed fall timeline plays backwards with it.
        l.scrollTo(0, {
          duration: EJECT_S,
          easing: (t) => 1 - Math.pow(1 - t, 4),
          lock: true,
          force: true,
          onComplete: land,
        });
      })
      // The light thins back into grain as you're flung outward.
      .to(rig, { flare: 0, duration: EJECT_S * 0.85, ease: 'power2.out' });
  }

  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('keydown', onKey);

  return () => {
    stopTick();
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('keydown', onKey);
    root.classList.remove('is-flaring');
    rig.flare = 0;
  };
}
