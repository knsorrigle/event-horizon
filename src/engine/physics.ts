// Closed-form Schwarzschild quantities for the HUD. Radii are in Rs.

export const PHOTON_SPHERE = 1.5;
export const ISCO = 3;

/** dt_static / dt_infinity for a static observer at radius r: 1 / sqrt(1 - Rs/r). */
export function timeDilation(r: number): number {
  return 1 / Math.sqrt(Math.max(1 - 1 / r, 1e-9));
}

/** Gravitational redshift z of light from a static emitter at r, seen at infinity. */
export function staticRedshift(r: number): number {
  return timeDilation(r) - 1;
}
