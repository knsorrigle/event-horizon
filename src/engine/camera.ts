import { Matrix3, Vector3 } from 'three';

const DEG = Math.PI / 180;
const WORLD_UP = new Vector3(0, 1, 0);

export interface CameraPose {
  distance: number;
  azimuthDeg: number;
  elevationDeg: number;
  rollDeg: number;
}

/** Orbit camera looking at the hole. Writes position and a (right, up, forward) basis. */
export function solveCamera(pose: CameraPose, outPos: Vector3, outBasis: Matrix3): void {
  const az = pose.azimuthDeg * DEG;
  const el = pose.elevationDeg * DEG;
  outPos.set(
    pose.distance * Math.cos(el) * Math.sin(az),
    pose.distance * Math.sin(el),
    pose.distance * Math.cos(el) * Math.cos(az),
  );

  const forward = _f.copy(outPos).negate().normalize();
  const right = _r.crossVectors(forward, WORLD_UP).normalize();
  const up = _u.crossVectors(right, forward);

  const roll = pose.rollDeg * DEG;
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  _tmp.copy(right).multiplyScalar(c).addScaledVector(up, s);
  up.multiplyScalar(c).addScaledVector(right, -s);
  right.copy(_tmp);

  // Matrix3.set is row-major: this places right/up/forward in the columns.
  outBasis.set(right.x, up.x, forward.x, right.y, up.y, forward.y, right.z, up.z, forward.z);
}

const _f = new Vector3();
const _r = new Vector3();
const _u = new Vector3();
const _tmp = new Vector3();
