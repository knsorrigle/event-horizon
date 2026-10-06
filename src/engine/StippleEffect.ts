import { Color, Uniform, Vector2, type DataTexture } from 'three';
import { BlendFunction, Effect } from 'postprocessing';
import fragmentShader from '../shaders/stipple.frag';

// The only colours on the canvas: a cold, desaturated grey ramp. rampLow must
// match the page background (--color-void) so the canvas edge is invisible.
const RAMP_LOW = '#050607';
const RAMP_MID = '#6e7a7e';
const RAMP_HIGH = '#e2ecee';

function makeUniforms(blueNoise: DataTexture) {
  return {
    blueNoise: new Uniform(blueNoise),
    noiseOffset: new Uniform(new Vector2()),
    exposure: new Uniform(1),
    blackPoint: new Uniform(0.03),
    gamma: new Uniform(0.9),
    ceiling: new Uniform(1),
    levels: new Uniform(3),
    grainPx: new Uniform(2),
    coarse: new Uniform(2),
    coreSoftness: new Uniform(0.75),
    // Raw sRGB display triplets: the renderer outputs without colour conversion.
    rampLow: new Uniform(displayColor(RAMP_LOW)),
    rampMid: new Uniform(displayColor(RAMP_MID)),
    rampHigh: new Uniform(displayColor(RAMP_HIGH)),
  };
}

export class StippleEffect extends Effect {
  readonly u: ReturnType<typeof makeUniforms>;

  constructor(blueNoise: DataTexture) {
    const u = makeUniforms(blueNoise);
    super('StippleEffect', fragmentShader, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>(Object.entries(u)),
    });
    this.u = u;
  }
}

// new Color(hex) converts to linear working space; undo that to keep the hex as-is.
function displayColor(hex: string): Color {
  return new Color(hex).convertLinearToSRGB();
}
