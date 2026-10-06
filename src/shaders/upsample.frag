// Upsample the half-res raymarch into the full-res composer buffer. A non-zero
// LOD samples the target's mip chain instead: a near-free defocus for the
// case-study pages (the stipple pass still adds crisp grain on top).
precision highp float;

in vec2 vUv;
layout(location = 0) out vec4 fragColor;

uniform sampler2D tMarch;
uniform float uLod;

void main() {
  fragColor = textureLod(tMarch, vUv, uLod);
}
