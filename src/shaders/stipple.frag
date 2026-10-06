// Stipple: luminance-driven blue-noise ordered dither onto a cold grey ramp.
//
// The whole pipeline is monochrome HDR luminance (R = G = B). Here it is
// tone-mapped, then quantised to a few levels with a blue-noise threshold, so
// falloffs and halos break into grain the way a stippled print does:
//   - shadows sample the noise on a coarser cell grid → heavy, clumped grain
//   - highlights use the fine grid and blend back toward the continuous tone
//     → finer grain and soft, glowing cores.

uniform sampler2D blueNoise;   // 128×128 R8 threshold map
uniform vec2 noiseOffset;      // re-rolled a few times per second → shimmer
uniform float exposure;
uniform float blackPoint;     // HDR luminance below this is pure black
uniform float gamma;
uniform float levels;          // quantisation levels (fewer = grainier)
uniform float grainPx;         // device pixels per grain cell
uniform float coarse;          // shadow cells are this many grain cells wide
uniform float coreSoftness;
uniform vec3 rampLow;
uniform vec3 rampMid;
uniform vec3 rampHigh;

float threshold(vec2 cell, vec2 salt) {
  ivec2 c = ivec2(mod(cell + noiseOffset + salt, 128.0));
  // Centre the 256 ranks inside (0, 1): a threshold of exactly 1.0 would light
  // pure-black pixels one time in 256.
  return (texelFetch(blueNoise, c, 0).r * 255.0 + 0.5) / 256.0;
}

vec3 ramp(float t) {
  vec3 c = mix(rampLow, rampMid, smoothstep(0.0, 0.6, t));
  return mix(c, rampHigh, smoothstep(0.4, 1.0, t));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // The black point trims bloom's faint far tail so empty sky stays black;
  // halos near the disk are far above it and keep their grain.
  float lum = max(inputColor.r * exposure - blackPoint, 0.0);
  float t = pow(1.0 - exp(-lum), gamma);

  vec2 cell = floor(gl_FragCoord.xy / grainPx);
  float nFine = threshold(cell, vec2(0.0));
  float nCoarse = threshold(floor(cell / coarse), vec2(61.0, 23.0));
  float n = mix(nCoarse, nFine, smoothstep(0.06, 0.45, t));

  float q = floor(t * levels + n) / levels;
  float v = mix(q, t, smoothstep(0.5, 1.0, t) * coreSoftness);

  outputColor = vec4(ramp(clamp(v, 0.0, 1.0)), 1.0);
}
