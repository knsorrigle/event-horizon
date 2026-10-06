// Schwarzschild black hole, raymarched per pixel.
//
// Units: Schwarzschild radius Rs = 1 (so M = 0.5, photon sphere r = 1.5,
// ISCO r = 3). Rays are traced backwards from the camera.
//
// Null geodesics use the standard "Newtonian photon" trick: a particle under
// the central acceleration a = -1.5 h² x / r⁵ (h = |x × v|, conserved) traces
// exactly the Schwarzschild photon orbit shape u'' + u = 1.5 u² (in Rs units).
// Integrated with kick-drift-kick leapfrog and a step size proportional to r.

precision highp float;
precision highp int;

#include common/noise.glsl

in vec2 vUv;
layout(location = 0) out vec4 fragColor;

uniform vec2 uResolution;
uniform vec3 uCamPos;
uniform mat3 uCamBasis;        // columns: right, up, forward
uniform float uTanHalfFov;     // tan(vertical fov / 2)
uniform vec2 uLensShift;       // frame offset in NDC (moves the hole on screen)
uniform vec3 uCursor;          // xy: cursor on the view plane, z: lens mass

uniform int uMaxSteps;
uniform float uStepScale;
uniform float uLensing;        // multiplier on the GR term (1 = physical)

uniform float uDiskTime;
uniform float uDiskBrightness;
uniform float uDiskOpacity;
uniform float uBeaming;        // exponent on the redshift factor g (4 = bolometric)
uniform float uTurbulence;

uniform float uStarDensity;
uniform float uSkyBrightness;
uniform float uHaze;

#define MAX_STEPS_CAP 512
#define DISK_IN 3.0
#define DISK_OUT 12.0
#define TAU 6.28318530718
#define TIME_SCALE 4.0

// ---------------------------------------------------------------- disk ----

// Turbulent density in the co-rotating frame. Keplerian shear would wind any
// pattern up forever, so two copies of the pattern run on offset clocks with a
// fixed period and are cross-faded (the flow-map trick). Each copy only ever
// shears by Ω·P.
float diskDensity(float r, float phi, float omega) {
  const float PERIOD = 6.0;
  const float ANG_CELLS = 22.0;
  float f = fract(uDiskTime / PERIOD);
  float wA = 1.0 - abs(2.0 * f - 1.0);
  float lr = log(r) * 9.0;

  float dens = 0.0;
  for (int k = 0; k < 2; k++) {
    float phase = k == 0 ? f : fract(f + 0.5);
    // Disk material moves toward -φ (velocity ∝ ŷ × x), so the co-rotating
    // angle is φ + Ωt. TIME_SCALE makes the ISCO orbit take ~12 s.
    float a = phi + omega * phase * PERIOD * TIME_SCALE;
    vec2 q = vec2(a / TAU * ANG_CELLS, lr) + float(k) * vec2(0.0, 31.7);
    vec2 w = vec2(fbmP(q, ANG_CELLS, 2), fbmP(q + vec2(0.0, 5.2), ANG_CELLS, 2));
    float d = fbmP(q + uTurbulence * 2.2 * (w - 0.5), ANG_CELLS, 4);
    dens += (k == 0 ? wA : 1.0 - wA) * d;
  }
  return smoothstep(0.22, 0.78, dens);
}

// Returns (luminance, alpha) for a ray crossing the equatorial plane at `hit`.
vec2 shadeDisk(vec3 hit, float r, float lambda) {
  // Novikov–Thorne-like flux: F ∝ (1 - sqrt(r_in / r)) / r³, normalised so the
  // peak (r ≈ 4.08) is ~1.
  float flux = (1.0 - sqrt(DISK_IN / r)) / (r * r * r) * 470.0;

  // Keplerian angular velocity in Rs units: Ω = sqrt(M / r³) with M = 1/2.
  float omega = inversesqrt(2.0 * r * r * r);

  // Exact redshift factor for an emitter on a circular orbit, seen at infinity:
  //   g = sqrt(1 - 3M/r) / (1 - Ω λ),   λ = L_z / E of the photon.
  // The numerator is gravitational redshift + transverse time dilation (dims
  // the inner edge); the denominator is Doppler (approaching side brightens).
  float g = sqrt(max(1.0 - 1.5 / r, 1e-4)) / max(1.0 - omega * lambda, 0.05);
  float beamed = pow(g, uBeaming);

  float phi = atan(hit.z, hit.x);
  float dens = diskDensity(r, phi, omega);

  float edge = smoothstep(DISK_IN * 0.98, DISK_IN * 1.25, r)
             * (1.0 - smoothstep(DISK_OUT * 0.55, DISK_OUT, r));

  float lum = flux * beamed * (0.25 + 1.35 * dens * dens) * edge * uDiskBrightness;
  float alpha = clamp(uDiskOpacity * (0.35 + 0.65 * dens) * edge, 0.0, 1.0);
  return vec2(lum, alpha);
}

// ----------------------------------------------------------------- sky ----

float starLayer(vec3 d, float scale, float probability, float gain, float pixelAngle) {
  vec3 p = d * scale;
  vec3 id = floor(p);
  vec3 h = hash33(id);
  if (h.x > probability * uStarDensity) return 0.0;
  vec3 star = normalize(id + 0.5 + (h - 0.5) * 0.6);
  // Perpendicular angular distance from the ray to the star, in pixels.
  float dist = length(cross(d, star)) / pixelAngle;
  float b = gain * (0.25 + 3.0 * pow(h.y, 8.0));
  return b * exp(-dist * dist * 0.9);
}

float sky(vec3 d, float pixelAngle) {
  // Sparse on purpose: the sky should read as black space with a few points.
  float s = starLayer(d, 60.0, 0.035, 1.8, pixelAngle);
  s += starLayer(d, 170.0, 0.02, 0.6, pixelAngle);

  // A faint dust band: gives the lensing something continuous to distort,
  // which is what makes the Einstein ring readable.
  // A faint filamentary cloud sitting almost exactly behind the hole (as seen
  // from the hero camera). A source on the line of sight is what produces an
  // Einstein ring, so the lensing shows up without lighting the rest of the sky.
  const vec3 CLOUD_DIR = vec3(0.306, -0.139, -0.942);
  float ang = acos(clamp(dot(d, CLOUD_DIR), -1.0, 1.0));
  float cloud = exp(-pow(ang / 0.028, 2.0));
  float neb = vnoise3(d * 9.0) * 0.55 + vnoise3(d * 23.0) * 0.3 + vnoise3(d * 51.0) * 0.15;
  s += uHaze * cloud * smoothstep(0.35, 0.8, neb) * 0.5;

  return s * uSkyBrightness;
}

// ---------------------------------------------------------------- main ----

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 ndc = vUv * 2.0 - 1.0;
  vec2 p = vec2((ndc.x - uLensShift.x) * aspect, ndc.y - uLensShift.y) * uTanHalfFov;
  float pixelAngle = 2.0 * uTanHalfFov / uResolution.y;

  // Cursor: a small point-mass thin lens in the view plane. Maps image-plane
  // position θ to source position β = θ - m (θ - c) / (|θ - c|² + ε²).
  vec2 dc = p - uCursor.xy;
  p -= uCursor.z * dc / (dot(dc, dc) + uCursor.z * 0.6 + 1e-6);

  vec3 dir = normalize(uCamBasis * vec3(p, 1.0));

  // The camera is a static observer at radius r0, and `dir` is a direction in
  // its local orthonormal frame. Converting to the coordinate direction the
  // integrator needs squashes the radial component by the lapse sqrt(1 - 1/r0):
  // that makes the initial du/dφ match the exact geodesic, so lensing stays
  // correct as the camera falls in (it is not "at infinity" any more).
  vec3 pos = uCamPos;
  float r0 = length(pos);
  vec3 radial = pos / r0;
  float lapse = sqrt(max(1.0 - 1.0 / r0, 1e-4));
  vec3 vel = dir + (lapse - 1.0) * dot(dir, radial) * radial;
  vec3 hvec = cross(pos, vel);
  float k = 1.5 * dot(hvec, hvec) * uLensing;

  // Photon L_z / E about the disk's spin axis (+y). It travels along -dir;
  // the impact parameter seen by a static observer is r sinψ / lapse.
  float lambda = dot(cross(pos, -dir), vec3(0.0, 1.0, 0.0)) / lapse;

  // Static observers deep in the well see all incoming light blueshifted by
  // 1 / lapse, which brightens disk and sky alike as the camera falls.
  float observerBoost = pow(1.0 / lapse, uBeaming);

  // Far enough out that the remaining bending is negligible.
  float escapeR = max(r0 * 1.02 + 1.0, 25.0);
  float escapeR2 = escapeR * escapeR;

  float lum = 0.0;
  float trans = 1.0;
  bool captured = false;
  bool escaped = false;

  float r2 = dot(pos, pos);
  vec3 acc = -k * pos / (r2 * r2 * sqrt(r2));

  for (int i = 0; i < MAX_STEPS_CAP; i++) {
    if (i >= uMaxSteps) break;

    float r = sqrt(r2);
    // Adaptive step: long strides far away, short ones near the photon sphere.
    float dt = uStepScale * r * clamp(r - 1.0, 0.45, 1.0);

    vec3 prev = pos;
    vel += 0.5 * dt * acc;
    pos += dt * vel;
    r2 = dot(pos, pos);
    acc = -k * pos / (r2 * r2 * sqrt(r2));
    vel += 0.5 * dt * acc;

    // Thin disk: the ray crossed the equatorial plane during this step.
    if (prev.y * pos.y < 0.0) {
      vec3 hit = mix(prev, pos, prev.y / (prev.y - pos.y));
      float rh = length(hit.xz);
      if (rh > DISK_IN && rh < DISK_OUT) {
        vec2 d = shadeDisk(hit, rh, lambda);
        lum += trans * d.x;
        trans *= 1.0 - d.y;
        if (trans < 0.01) break;
      }
    }

    if (r2 < 1.0) { captured = true; break; }
    if (r2 > escapeR2 && dot(pos, vel) > 0.0) { escaped = true; break; }
  }

  // Rays that ran out of steps are skimming the photon sphere: treat as captured.
  if (escaped && !captured) {
    lum += trans * sky(normalize(vel), pixelAngle);
  }

  fragColor = vec4(vec3(lum * observerBoost), 1.0);
}
