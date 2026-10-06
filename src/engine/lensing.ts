// CPU twin of the shader's geodesic integrator, used to place DOM/SVG
// annotations on where a body's *lensed* image actually appears. Near the hole
// that differs from a straight-line projection by 100+ px.
import { Matrix3, Vector2, Vector3 } from 'three';

/** The pinhole camera the shader renders with (same conventions as blackhole.frag). */
export interface View {
  pos: Vector3;
  basis: Matrix3; // columns: right, up, forward
  tanHalf: number;
  aspect: number;
  shift: Vector2; // NDC frame offset
}

const _local = new Vector3();
const _rel = new Vector3();

/** Local (observer-frame) ray direction through an NDC point. */
export function dirFromNdc(view: View, ndcX: number, ndcY: number, out: Vector3): Vector3 {
  _local.set((ndcX - view.shift.x) * view.aspect * view.tanHalf, (ndcY - view.shift.y) * view.tanHalf, 1);
  return out.copy(_local).applyMatrix3(view.basis).normalize();
}

/** Straight-line projection of a world point to NDC. Returns false if behind the camera. */
export function projectNdc(view: View, p: Vector3, out: Vector2): boolean {
  const e = view.basis.elements; // column-major
  _rel.copy(p).sub(view.pos);
  const x = _rel.x * e[0]! + _rel.y * e[1]! + _rel.z * e[2]!;
  const y = _rel.x * e[3]! + _rel.y * e[4]! + _rel.z * e[5]!;
  const z = _rel.x * e[6]! + _rel.y * e[7]! + _rel.z * e[8]!;
  if (z <= 1e-4) return false;
  out.set(x / z / (view.aspect * view.tanHalf) + view.shift.x, y / z / view.tanHalf + view.shift.y);
  return true;
}

const _pos = new Vector3();
const _vel = new Vector3();
const _acc = new Vector3();
const _prev = new Vector3();
const _seg = new Vector3();
const _toC = new Vector3();
const _radial = new Vector3();

/**
 * Trace a ray backwards from the camera and return the point on the path that
 * passes closest to `target`. Same initial conditions, step rule and leapfrog
 * scheme as the shader. Returns the distance, or Infinity if captured first.
 */
export function traceClosest(view: View, dir: Vector3, target: Vector3, outPoint: Vector3, stepScale: number, maxSteps = 220): number {
  _pos.copy(view.pos);
  const r0 = _pos.length();
  _radial.copy(_pos).divideScalar(r0);
  const lapse = Math.sqrt(Math.max(1 - 1 / r0, 1e-4));
  _vel.copy(dir).addScaledVector(_radial, (lapse - 1) * dir.dot(_radial));
  const hx = _pos.y * _vel.z - _pos.z * _vel.y;
  const hy = _pos.z * _vel.x - _pos.x * _vel.z;
  const hz = _pos.x * _vel.y - _pos.y * _vel.x;
  const k = 1.5 * (hx * hx + hy * hy + hz * hz);
  const escape = Math.max(r0 * 1.02 + 1, 25);

  let r2 = _pos.lengthSq();
  _acc.copy(_pos).multiplyScalar(-k / (r2 * r2 * Math.sqrt(r2)));
  let best = Infinity;

  for (let i = 0; i < maxSteps; i++) {
    const r = Math.sqrt(r2);
    const dt = stepScale * r * Math.min(1, Math.max(0.45, r - 1));
    _prev.copy(_pos);
    _vel.addScaledVector(_acc, 0.5 * dt);
    _pos.addScaledVector(_vel, dt);
    r2 = _pos.lengthSq();
    _acc.copy(_pos).multiplyScalar(-k / (r2 * r2 * Math.sqrt(r2)));
    _vel.addScaledVector(_acc, 0.5 * dt);

    // Closest point to the target on this chord.
    _seg.subVectors(_pos, _prev);
    const len2 = _seg.lengthSq();
    const t = len2 > 0 ? Math.min(1, Math.max(0, _toC.subVectors(target, _prev).dot(_seg) / len2)) : 0;
    _toC.copy(_prev).addScaledVector(_seg, t);
    const d = _toC.distanceTo(target);
    if (d < best) {
      best = d;
      outPoint.copy(_toC);
    }

    if (r2 < 1) return best < 0.05 ? best : Infinity;
    if (r2 > escape * escape && _pos.dot(_vel) > 0) break;
  }
  return best;
}

const _dir = new Vector3();
const _q = new Vector3();
const _pc = new Vector2();
const _pq = new Vector2();

/**
 * Find the screen position (NDC) of the lensed image of `target` nearest to
 * `seed`, by fixed-point iteration: trace, measure the miss, nudge the screen
 * point by the miss as it would appear unlensed. Converges in a few steps for
 * every image the bodies produce in practice. Returns the final miss in Rs.
 */
export function solveImage(view: View, target: Vector3, seed: Vector2, out: Vector2, stepScale: number): number {
  out.copy(seed);
  let miss = Infinity;
  for (let it = 0; it < 7; it++) {
    dirFromNdc(view, out.x, out.y, _dir);
    miss = traceClosest(view, _dir, target, _q, stepScale);
    if (!Number.isFinite(miss) || miss < 0.01) break;
    if (!projectNdc(view, target, _pc) || !projectNdc(view, _q, _pq)) break;
    out.x += (_pc.x - _pq.x) * 0.85;
    out.y += (_pc.y - _pq.y) * 0.85;
  }
  return miss;
}
