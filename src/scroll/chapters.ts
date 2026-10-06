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
