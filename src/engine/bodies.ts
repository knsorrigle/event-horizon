// Deep import: this module ships in the entry chunk, and importing from 'three'
// would drag the renderer in with it. The renderer stays in the lazy Engine chunk.
import { Vector3 } from 'three/src/math/Vector3.js';
import { projects, type BodySurface } from '../content/projects';

// Must match TIME_SCALE in blackhole.frag so bodies and disk turn together.
export const TIME_SCALE = 4;
const DEG = Math.PI / 180;

const SURFACE_ID: Record<BodySurface, number> = {
  banded: 0,
  cellular: 1,
  filament: 2,
  vortex: 3,
  crescent: 4,
  waves: 5,
};

export interface BodyState {
  /** 1-based pick ID (0 = nothing). */
  id: number;
  slug: string;
  center: Vector3;
  radius: number;
  surface: number;
  brightness: number;
  /** Self-rotation phase, radians. */
  spin: number;
}

export const bodies: BodyState[] = projects.map((p, i) => ({
  id: i + 1,
  slug: p.slug,
  center: new Vector3(),
  radius: p.body.radius,
  surface: SURFACE_ID[p.body.surface],
  brightness: p.body.brightness,
  spin: 0,
}));

/** Keplerian angular velocity in Rs units (M = 1/2): Ω = sqrt(M / a³). */
export function keplerOmega(a: number): number {
  return Math.sqrt(0.5 / (a * a * a));
}

/**
 * Body position at disk time t (same clock as the disk shader). Orbits are
 * circular, inclined, and run in the disk's sense of rotation (velocity ∝ ŷ × x,
 * i.e. toward decreasing atan2(z, x)).
 */
export function bodyPosition(index: number, t: number, out: Vector3): Vector3 {
  const b = projects[index]!.body;
  const theta = b.phaseDeg * DEG - keplerOmega(b.orbitRadius) * TIME_SCALE * t;
  // In-plane circle, then tilt about x by the inclination, then rotate the
  // line of nodes about y.
  const x = b.orbitRadius * Math.cos(theta);
  const z0 = b.orbitRadius * Math.sin(theta);
  const inc = b.inclinationDeg * DEG;
  const y = -z0 * Math.sin(inc);
  const z = z0 * Math.cos(inc);
  const node = b.nodeDeg * DEG;
  return out.set(x * Math.cos(node) + z * Math.sin(node), y, -x * Math.sin(node) + z * Math.cos(node));
}

export function updateBodies(t: number): void {
  bodies.forEach((body, i) => {
    bodyPosition(i, t, body.center);
    body.spin = t * 0.35 * (1 + i * 0.17);
  });
}

/** Parked camera distance from a body's centre, in body radii. */
const PARK_STANDOFF = 4.6;
const _out = new Vector3();
const _tan = new Vector3();
const _dir = new Vector3();
const _up = new Vector3(0, 1, 0);

/**
 * Where the camera parks beside a body: just outside its orbit, a little
 * ahead and above, looking back in, so the hole's lensed light sits behind the
 * body like a halo.
 */
export function parkPosition(center: Vector3, radius: number, out: Vector3): Vector3 {
  const outward = _out.copy(center).normalize();
  const tangent = _tan.set(0, 1, 0).cross(outward).normalize();
  const dir = _dir.copy(outward).addScaledVector(tangent, 0.38).addScaledVector(_up, 0.3).normalize();
  return out.copy(center).addScaledVector(dir, radius * PARK_STANDOFF);
}
