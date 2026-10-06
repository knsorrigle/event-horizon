// Every tunable in the render pipeline. The engine reads this object each
// frame; the dev-only Tweakpane panel binds directly to it.
export const params = {
  raymarch: {
    renderScale: 0.5, // fraction of device pixels the geodesic pass renders at
    maxSteps: 180,
    stepScale: 0.075, // dt = stepScale · r · clamp(r - 1, 0.45, 1)
    lensing: 1, // 1 = Schwarzschild; for exaggeration only
  },
  disk: {
    brightness: 1.25,
    opacity: 0.88,
    // Exponent on the redshift factor g. 3 = specific intensity for a flat
    // spectrum (I_ν/ν³ invariant); 4 = bolometric. Both are physical.
    beaming: 3,
    turbulence: 1,
    speed: 1,
  },
  sky: {
    starDensity: 1,
    brightness: 1,
    haze: 0.5,
  },
  camera: {
    distance: 40, // Rs
    elevationDeg: 8,
    azimuthDeg: -18,
    rollDeg: -7,
    fovDeg: 28,
    lensShiftX: 0.2, // NDC; pushes the hole right of centre for the hero type
    lensShiftY: 0.06,
  },
  pointer: {
    parallaxDeg: 3.5,
    smoothing: 3.2, // 1/s, exponential approach
    mass: 0.0016, // cursor lens mass (view-plane units²)
  },
  bloom: {
    intensity: 1.15,
    threshold: 0.55,
    smoothing: 0.35,
    radius: 0.72,
  },
  grain: {
    exposure: 1.1,
    blackPoint: 0.03,
    gamma: 0.75,
    levels: 3,
    sizeCssPx: 1,
    coarse: 2,
    coreSoftness: 0.75,
    shimmerHz: 12,
  },
};

export type Params = typeof params;
