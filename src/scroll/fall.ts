// The scroll → camera mapping for the fall. One scrubbed GSAP timeline over
// the whole home page tweens the camera rig; each chapter's share of the
// timeline equals its share of the scroll height, so camera beats line up
// with the DOM sections exactly.
import gsap from 'gsap';
import { heroRig, rig, type Rig } from './rig';

type Key = Partial<Omit<Rig, 'logR'>> & { r?: number };

// Camera beats (r in Rs). ISCO = 3, photon sphere = 1.5, horizon = 1.
const KEYS = {
  // I · Approach ends: a slow drift in, still well outside the disk.
  approach: { r: 33, azimuthDeg: -4, elevationDeg: 9, rollDeg: -5, fovDeg: 30, shiftX: 0.15, shiftY: 0.05, exposure: 0.95 },
  // II · The Disk: spiral inward 33 → 15 while orbiting ~150° around the hole.
  disk: { r: 15, azimuthDeg: 146, elevationDeg: 14, rollDeg: 0, fovDeg: 34, shiftX: 0.12, shiftY: 0, exposure: 0.8 },
  // III · Accretion: 15 → 6, tilting down to nearly edge-on; the disk dominates.
  // Bodies fade out on the way down: the camera passes inside their orbits.
  accretion: { r: 6, azimuthDeg: 200, elevationDeg: 1.8, rollDeg: 2, fovDeg: 50, shiftX: 0, shiftY: 0, exposure: 0.48, bodies: 0 },
  // IV · The Fall, in three beats: plunge until the photon ring frames the
  // view, slip past the photon sphere (the shadow swallows the sky), then
  // cross the horizon in the dark while the readouts diverge to ∞.
  ringFill: { r: 2.15, azimuthDeg: 220, elevationDeg: 2.4, rollDeg: 9, fovDeg: 112, exposure: 0.55 },
  photonSphere: { r: 1.25, azimuthDeg: 228, elevationDeg: 2.6, rollDeg: 14, fovDeg: 116 },
  horizon: { r: 1, azimuthDeg: 232, elevationDeg: 2.6, rollDeg: 16, fovDeg: 116 },
} satisfies Record<string, Key>;

function vars(key: Key): gsap.TweenVars {
  const { r, ...rest } = key;
  return r === undefined ? { ...rest } : { ...rest, logR: Math.log(r) };
}

export interface FallSections {
  approach: HTMLElement;
  disk: HTMLElement;
  accretion: HTMLElement;
  fall: HTMLElement;
  singularity: HTMLElement;
}

/** Must be called inside a gsap.context so it is reverted on unmount. */
export function buildFall(main: HTMLElement, s: FallSections): void {
  const h = (el: HTMLElement) => el.offsetHeight;
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: main,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      // No invalidateOnRefresh: it would re-read start values from wherever the
      // camera is at refresh time (e.g. mid-fall when fonts load). Section
      // heights are in vh, so the timeline's proportions never change anyway.
    },
  });

  // Pin the start explicitly so every later tween chains from the hero pose.
  // (flare is left alone: the white hole animates it while scrolling home.)
  const { flare: _flare, ...start } = heroRig();
  tl.set(rig, start, 0);

  tl.to(rig, { ...vars(KEYS.approach), duration: h(s.approach) });
  tl.to(rig, { ...vars(KEYS.disk), duration: h(s.disk) });
  tl.to(rig, { ...vars(KEYS.accretion), duration: h(s.accretion) });

  const f = h(s.fall);
  // Free fall accelerates: ease the plunge in.
  tl.to(rig, { ...vars(KEYS.ringFill), duration: f * 0.6, ease: 'power2.in' });
  tl.to(rig, { ...vars(KEYS.photonSphere), duration: f * 0.3, ease: 'sine.inOut' });
  // expo.in: r creeps, then drops onto r = 1, so 1/sqrt(1 - 1/r) visibly diverges.
  tl.to(rig, { ...vars(KEYS.horizon), duration: f * 0.1, ease: 'expo.in' });
  // Fade to black over the last stretch, under the diverging readouts.
  tl.to(rig, { fade: 1, duration: f * 0.16, ease: 'power1.in' }, `>-${f * 0.16}`);

  // V · Singularity: hold at the horizon, in the dark, for the rest of the
  // page. Its share is its height minus the one viewport it ends on, which
  // keeps every earlier beat aligned with its section.
  tl.to(rig, { fade: 1, duration: Math.max(1, h(s.singularity) - window.innerHeight) });
}
