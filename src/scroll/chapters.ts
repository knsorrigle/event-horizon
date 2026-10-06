// Chapter text enters and exits with the scroll. Each chapter's content is
// sticky for its section's span; this scrubs it in over the first part of that
// span and out over the last, so text is never seen sliding while the sticky
// block is released.
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

interface ChapterOptions {
  /** Hero starts visible: no entrance, only an exit. */
  enter?: boolean;
  reducedMotion: boolean;
}

/** Must be called inside a gsap.context so splits and triggers revert on unmount. */
export function animateChapter(section: HTMLElement, opts: ChapterOptions): void {
  const content = section.querySelector<HTMLElement>('[data-chapter-content]');
  if (!content) return;
  const enter = opts.enter ?? true;

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: true },
  });

  const titles = content.querySelectorAll<HTMLElement>('[data-split]');
  const lines = content.querySelectorAll<HTMLElement>('[data-line]');

  if (opts.reducedMotion) {
    // Opacity only: no movement, no letter animation.
    if (enter) tl.fromTo(content, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18 }, 0);
    tl.to(content, { autoAlpha: 0, duration: 0.18 }, 0.82);
    return;
  }

  const chars = Array.from(titles).flatMap(
    (el) => SplitText.create(el, { type: 'chars', aria: 'auto', mask: 'chars' }).chars,
  );

  if (enter) {
    tl.fromTo(content, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.06 }, 0);
    tl.from(chars, { yPercent: 105, duration: 0.16, stagger: 0.01, ease: 'power2.out' }, 0);
    tl.from(lines, { autoAlpha: 0, y: 14, duration: 0.12, stagger: 0.025, ease: 'power1.out' }, 0.06);
  }
  // Hold, then exit: letters lift away first, the rest dissolves after.
  tl.to(chars, { yPercent: -105, duration: 0.16, stagger: 0.008, ease: 'power2.in' }, 0.8);
  tl.to(lines, { autoAlpha: 0, y: -10, duration: 0.1, stagger: 0.015, ease: 'power1.in' }, 0.8);
  tl.to(content, { autoAlpha: 0, duration: 0.06 }, 0.94);
}

/**
 * V · Singularity: a quiet beat of black first, then the contact block
 * emerges and stays (it's the end of the page; there's no exit).
 */
export function animateSingularity(section: HTMLElement, opts: { reducedMotion: boolean }): void {
  const content = section.querySelector<HTMLElement>('[data-chapter-content]');
  if (!content) return;
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: true },
  });
  // Nothing for the first ~40%: the beat. Opacity, not autoAlpha: the contact
  // links must stay focusable (and reachable by Tab) while invisible.
  tl.fromTo(content, { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.38);
  if (opts.reducedMotion) {
    tl.to({}, { duration: 0.54 });
    return;
  }
  const chars = Array.from(content.querySelectorAll<HTMLElement>('[data-split]')).flatMap(
    (el) => SplitText.create(el, { type: 'words,chars', aria: 'auto', mask: 'chars' }).chars,
  );
  tl.from(chars, { yPercent: 105, duration: 0.2, stagger: 0.012, ease: 'power2.out' }, 0.4);
  tl.from(content.querySelectorAll('[data-line]'), { opacity: 0, y: 12, duration: 0.14, stagger: 0.03, ease: 'power1.out' }, 0.5);
  tl.to({}, { duration: 0.2 });
}
