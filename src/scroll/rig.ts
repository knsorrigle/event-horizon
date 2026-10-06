import { params } from '../engine/params';

/**
 * The camera state the scroll narrative animates. GSAP tweens these fields;
 * the engine turns them into uniforms every frame. Distance is tweened in
 * log space so the fall reads evenly from 40 Rs down to the horizon.
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
  };
}

export const rig: Rig = heroRig();

export function resetRig(): void {
  Object.assign(rig, heroRig());
}
