// Click a body → the camera whips around the hole on a gravity-assist arc and
// ends parked beside the body, filling the frame. All of it is uniform
// animation on the rig; the engine blends into the live (co-orbiting) parked
// pose over the last stretch, so the arc lands exactly wherever the body is.
import gsap from 'gsap';
import { Vector3 } from 'three/src/math/Vector3.js';
import { bodies, bodyPosition, parkPosition } from '../engine/bodies';
import { azimuthOf, elevationOf } from '../engine/camera';
import { getEngine } from '../engine/engineStore';
import { params } from '../engine/params';
import { PARKED, parkRig, rig, type Rig } from './rig';

export const SLINGSHOT_S = 1.25;

const _pred = new Vector3();
const _park = new Vector3();

/** Shortest signed angle difference in degrees, in (-180, 180]. */
function wrap(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

export function slingshot(index: number, opts: { reducedMotion: boolean; onComplete: () => void }): void {
  const body = bodies[index];
  const engine = getEngine();
  if (!body || !engine || opts.reducedMotion) {
    // Reduced motion (or no renderer): no arc; park directly and let the
    // route change crossfade.
    parkRig(index);
    opts.onComplete();
    return;
  }

  // Where the body (and so the parked camera) will be when the arc lands.
  // (Approximate: the engine's clock may be easing between speeds; the live
  // park blend at the end absorbs any difference.)
  bodyPosition(index, engine.time + SLINGSHOT_S * params.disk.speed, _pred);
  parkPosition(_pred, body.radius, _park);
  const rEnd = _park.length();
  const azEnd = azimuthOf(_park);
  const elEnd = elevationOf(_park);

  // Take the long way round: a gravity assist swings around the hole, not
  // straight across to the target.
  const d = wrap(azEnd - rig.azimuthDeg);
  const sweep = d - Math.sign(d || 1) * 360;
  const rStart = Math.exp(rig.logR);
  const rPeri = Math.max(3.6, Math.min(rStart, rEnd) * 0.5);
  const bank = Math.sign(sweep) * -12;

  gsap.killTweensOf(rig);
  rig.targetBody = index;
  rig.focus = 0;
  rig.park = 0;

  const tl = gsap.timeline({ onComplete: opts.onComplete });
  tl.to(rig, { azimuthDeg: rig.azimuthDeg + sweep, duration: SLINGSHOT_S, ease: 'power1.inOut' }, 0);
  // Fall in toward periapsis, then climb out to the body: the speed-up and
  // slow-down of a real flyby.
  tl.to(rig, { logR: Math.log(rPeri), elevationDeg: 4.5, duration: SLINGSHOT_S * 0.45, ease: 'power2.in' }, 0);
  tl.to(rig, { logR: Math.log(rEnd), elevationDeg: elEnd, duration: SLINGSHOT_S * 0.55, ease: 'power2.out' }, SLINGSHOT_S * 0.45);
  // Bank and widen through periapsis, settle at the end.
  tl.to(rig, { rollDeg: bank, fovDeg: 52, duration: SLINGSHOT_S * 0.45, ease: 'sine.inOut' }, 0);
  tl.to(rig, { rollDeg: PARKED.rollDeg, fovDeg: PARKED.fovDeg, duration: SLINGSHOT_S * 0.55, ease: 'sine.inOut' }, SLINGSHOT_S * 0.45);
  tl.to(rig, { shiftX: 0, shiftY: 0, exposure: PARKED.exposure, fade: 0, bodies: 1, duration: SLINGSHOT_S * 0.6, ease: 'power2.inOut' }, 0);
  // Turn from the hole to the body, then hand over to the live parked pose.
  tl.to(rig, { focus: 1, duration: SLINGSHOT_S * 0.5, ease: 'power2.inOut' }, SLINGSHOT_S * 0.42);
  tl.to(rig, { park: 1, duration: SLINGSHOT_S * 0.38, ease: 'power2.inOut' }, SLINGSHOT_S * 0.62);
}

// ---------------------------------------------------------------- return ----

/** The orbit you launched from: camera pose and the home page's scroll. */
export interface Departure {
  rig: Rig;
  scrollY: number;
}

let departure: Departure | null = null;

export function setDeparture(d: Departure): void {
  departure = d;
}

export function getDeparture(): Departure | null {
  return departure;
}

/**
 * "Back to orbit": the slingshot in reverse. The parked camera is re-expressed
 * as an orbit pose (same position, so releasing the park doesn't move it),
 * then it swings back round the hole to `target`, the exact pose it launched
 * from, so restoring the home page's scroll lands seamlessly.
 */
export function returnToOrbit(target: Rig, opts: { reducedMotion: boolean; onComplete: () => void }): void {
  const engine = getEngine();
  if (!engine || opts.reducedMotion) {
    opts.onComplete();
    return;
  }

  const pos = engine.cameraPosition;
  gsap.killTweensOf(rig);
  rig.logR = Math.log(pos.length());
  rig.azimuthDeg = azimuthOf(pos);
  rig.elevationDeg = elevationOf(pos);
  rig.park = 0;

  const d = wrap(target.azimuthDeg - rig.azimuthDeg);
  const sweep = d - Math.sign(d || 1) * 360;
  const rPeri = Math.max(3.6, Math.min(pos.length(), Math.exp(target.logR)) * 0.5);
  const bank = Math.sign(sweep) * -12;
  const T = SLINGSHOT_S;

  const tl = gsap.timeline({
    onComplete: () => {
      rig.targetBody = -1;
      opts.onComplete();
    },
  });
  tl.to(rig, { blur: 0, exposure: target.exposure, duration: T * 0.4, ease: 'power2.out' }, 0);
  tl.to(rig, { focus: 0, duration: T * 0.5, ease: 'power2.inOut' }, T * 0.1);
  tl.to(rig, { azimuthDeg: rig.azimuthDeg + sweep, duration: T, ease: 'power1.inOut' }, 0);
  tl.to(rig, { logR: Math.log(rPeri), elevationDeg: 4.5, duration: T * 0.45, ease: 'power2.in' }, 0);
  tl.to(rig, { logR: target.logR, elevationDeg: target.elevationDeg, duration: T * 0.55, ease: 'power2.out' }, T * 0.45);
  tl.to(rig, { rollDeg: bank, fovDeg: 52, duration: T * 0.45, ease: 'sine.inOut' }, 0);
  tl.to(rig, { rollDeg: target.rollDeg, fovDeg: target.fovDeg, duration: T * 0.55, ease: 'sine.inOut' }, T * 0.45);
  tl.to(rig, { shiftX: target.shiftX, shiftY: target.shiftY, bodies: target.bodies, fade: target.fade, duration: T * 0.6, ease: 'power2.inOut' }, T * 0.4);
}
