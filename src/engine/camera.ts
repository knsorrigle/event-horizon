// Deep imports keep three's renderer out of the entry chunk (see bodies.ts).
import { Matrix3 } from 'three/src/math/Matrix3.js';
import { Vector3 } from 'three/src/math/Vector3.js';

const DEG = Math.PI / 180;
const WORLD_UP = new Vector3(0, 1, 0);

export interface OrbitPose {
  distance: number;
  azimuthDeg: number;
  elevationDeg: number;
}

/** Position on a sphere around the hole. az = atan2(x, z), el above the disk plane. */
export function orbitPosition(pose: OrbitPose, out: Vector3): Vector3 {
  const az = pose.azimuthDeg * DEG;
  const el = pose.elevationDeg * DEG;
  return out.set(
    pose.distance * Math.cos(el) * Math.sin(az),
    pose.distance * Math.sin(el),
    pose.distance * Math.cos(el) * Math.cos(az),
  );
}

export function azimuthOf(p: Vector3): number {
  return Math.atan2(p.x, p.z) / DEG;
}

export function elevationOf(p: Vector3): number {
  return Math.asin(p.y / p.length()) / DEG;
}

/** (right, up, forward) basis for a camera looking along `forward`, rolled about it. */
export function solveBasis(forward: Vector3, rollDeg: number, outBasis: Matrix3): void {
  const f = _f.copy(forward).normalize();
  const right = _r.crossVectors(f, WORLD_UP).normalize();
  const up = _u.crossVectors(right, f);

  const roll = rollDeg * DEG;
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  _tmp.copy(right).multiplyScalar(c).addScaledVector(up, s);
  up.multiplyScalar(c).addScaledVector(right, -s);
  right.copy(_tmp);

  // Matrix3.set is row-major: this places right/up/forward in the columns.
  outBasis.set(right.x, up.x, f.x, right.y, up.y, f.y, right.z, up.z, f.z);
}

const _f = new Vector3();
const _r = new Vector3();
const _u = new Vector3();
const _tmp = new Vector3();
