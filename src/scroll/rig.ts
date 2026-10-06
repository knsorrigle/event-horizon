import { params } from '../engine/params';

/**
 * The camera state the narrative animates. GSAP tweens these fields; the
 * engine turns them into uniforms every frame. Distance is tweened in log
 * space so the fall reads evenly from 40 Rs down to the horizon.
 */
export interface Rig {
  logR: number;
  azimuthDeg: number;
  elevationDeg: number;
  rollDeg: number;
  fovDeg: number;
  shiftX: number;
  shiftY: number;
  /** Instrument auto-exposure: steps down as the disk fills the frame. */
  exposure: number;
  /** 0 = normal exposure, 1 = black. */
  fade: number;
  /** Project bodies' visibility, 0..1. */
  bodies: number;
  /** Index of the body the camera may look at / park beside (-1 = none). */
  targetBody: number;
  /** 0 = look at the hole, 1 = look at the target body. */
  focus: number;
  /** 0 = orbit pose above, 1 = parked beside the target body (co-orbiting). */
  park: number;
}

export function heroRig(): Rig {
  const c = params.camera;
  return {
    logR: Math.log(c.distance),
    azimuthDeg: c.azimuthDeg,
    elevationDeg: c.elevationDeg,
    rollDeg: c.rollDeg,
    fovDeg: c.fovDeg,
    shiftX: c.lensShiftX,
    shiftY: c.lensShiftY,
    exposure: 1,
    fade: 0,
    bodies: 1,
    targetBody: -1,
    focus: 0,
    park: 0,
  };
}

/** Framing used when the camera is parked beside a body (case-study pages). */
export const PARKED = { fovDeg: 34, rollDeg: 0, shiftX: 0, shiftY: 0, exposure: 0.85, fade: 0, bodies: 1 };

export const rig: Rig = heroRig();

export function resetRig(): void {
  Object.assign(rig, heroRig());
}

export function parkRig(bodyIndex: number): void {
  Object.assign(rig, PARKED, { targetBody: bodyIndex, focus: 1, park: 1 });
}
