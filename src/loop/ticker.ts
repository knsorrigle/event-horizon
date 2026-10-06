// One RAF loop for the whole site: GSAP's ticker drives Lenis, ScrollTrigger
// and the WebGL engine. Nothing else may call requestAnimationFrame.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Reduced motion keeps native scrolling: no inertia, no smoothing.
export const lenis: Lenis | null = prefersReducedMotion ? null : new Lenis({ autoRaf: false, lerp: 0.09 });

if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
}
// Never let GSAP "catch up" after a hitch; the camera should not jump.
gsap.ticker.lagSmoothing(0);

export type TickFn = (time: number, deltaMs: number) => void;

export function onTick(fn: TickFn): () => void {
  gsap.ticker.add(fn);
  return () => gsap.ticker.remove(fn);
}
