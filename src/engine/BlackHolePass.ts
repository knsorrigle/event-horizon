import {
  GLSL3,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix3,
  NearestFilter,
  RawShaderMaterial,
  Uniform,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { Pass } from 'postprocessing';
import vertexShader from '../shaders/fullscreen.vert';
import fragmentShader from '../shaders/blackhole.frag';
import upsampleShader from '../shaders/upsample.frag';
import { MAX_BODIES } from '../content/projects';

/**
 * Traces the geodesics into a reduced-resolution HDR target, then upsamples
 * (bilinear) into the composer's full-resolution buffer for bloom + stipple.
 */
export class BlackHolePass extends Pass {
  readonly uniforms = {
    uResolution: new Uniform(new Vector2(1, 1)),
    uCamPos: new Uniform(new Vector3(0, 0, 40)),
    uCamBasis: new Uniform(new Matrix3()),
    uTanHalfFov: new Uniform(0.3),
    uLensShift: new Uniform(new Vector2()),
    uCursor: new Uniform(new Vector3()),
    uMaxSteps: new Uniform(180),
    uStepScale: new Uniform(0.075),
    uLensing: new Uniform(1),
    uDiskTime: new Uniform(0),
    uDiskBrightness: new Uniform(1),
    uDiskOpacity: new Uniform(0.9),
    uBeaming: new Uniform(4),
    uTurbulence: new Uniform(1),
    uStarDensity: new Uniform(1),
    uSkyBrightness: new Uniform(1),
    uHaze: new Uniform(1),
    uBodies: new Uniform(Array.from({ length: MAX_BODIES }, () => new Vector4())),
    uBodyLook: new Uniform(Array.from({ length: MAX_BODIES }, () => new Vector4())),
    uBodyVis: new Uniform(1),
    uHoverId: new Uniform(0),
    uBodyShell: new Uniform(new Vector2(0, 0)),
  };

  /** Fraction of the composer's (device-pixel) size the raymarch renders at. */
  renderScale = 0.5;

  private readonly marchMaterial: RawShaderMaterial;
  private readonly upsampleMaterial: RawShaderMaterial;
  /** Defocus as a mip level of the raymarch target (0 = sharp). */
  readonly blurLod = new Uniform(0);
  private readonly target: WebGLRenderTarget;
  private readonly fullSize = new Vector2(1, 1);
  private readonly pickBuffer = new Uint8Array(4);
  private pickInFlight = false;

  constructor() {
    super('BlackHolePass');
    this.marchMaterial = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
    });
    // Two attachments: [0] HDR luminance, [1] body ID for picking (RGBA8 so
    // it can be read back as UNSIGNED_BYTE everywhere).
    this.target = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      count: 2,
    });
    const ids = this.target.textures[1]!;
    ids.type = UnsignedByteType;
    ids.minFilter = ids.magFilter = NearestFilter;
    ids.generateMipmaps = false;
    // The colour attachment keeps a mip chain (regenerated after each render;
    // cheap at this size) so the upsample can defocus by sampling a coarser level.
    const color = this.target.textures[0]!;
    color.minFilter = LinearMipmapLinearFilter;
    color.generateMipmaps = true;

    this.upsampleMaterial = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader,
      fragmentShader: upsampleShader,
      uniforms: { tMarch: new Uniform(color), uLod: this.blurLod },
      depthTest: false,
      depthWrite: false,
    });
    this.fullscreenMaterial = this.marchMaterial;
    this.needsSwap = true;
  }

  get marchSize(): Vector2 {
    return this.uniforms.uResolution.value;
  }

  override render(renderer: WebGLRenderer, _input: WebGLRenderTarget | null, output: WebGLRenderTarget | null): void {
    this.fullscreenMaterial = this.marchMaterial;
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);

    this.fullscreenMaterial = this.upsampleMaterial;
    renderer.setRenderTarget(this.renderToScreen ? null : output);
    renderer.render(this.scene, this.camera);
  }

  override setSize(width: number, height: number): void {
    this.fullSize.set(width, height);
    const w = Math.max(1, Math.round(width * this.renderScale));
    const h = Math.max(1, Math.round(height * this.renderScale));
    if (w === this.target.width && h === this.target.height) return;
    this.target.setSize(w, h);
    this.uniforms.uResolution.value.set(w, h);
  }

  /**
   * Body ID under an NDC position, read back asynchronously (PBO + fence, no
   * pipeline stall). Resolves null if a read is already in flight; callers
   * throttle by simply asking again later.
   */
  async pick(renderer: WebGLRenderer, ndcX: number, ndcY: number): Promise<number | null> {
    if (this.pickInFlight) return null;
    const { width, height } = this.target;
    const x = Math.min(width - 1, Math.max(0, Math.floor((ndcX * 0.5 + 0.5) * width)));
    const y = Math.min(height - 1, Math.max(0, Math.floor((ndcY * 0.5 + 0.5) * height)));
    this.pickInFlight = true;
    try {
      await renderer.readRenderTargetPixelsAsync(this.target, x, y, 1, 1, this.pickBuffer, undefined, 1);
      return this.pickBuffer[0] ?? 0;
    } finally {
      this.pickInFlight = false;
    }
  }

  setRenderScale(scale: number): void {
    if (scale === this.renderScale) return;
    this.renderScale = scale;
    this.setSize(this.fullSize.x, this.fullSize.y);
  }

  override dispose(): void {
    this.target.dispose();
    this.marchMaterial.dispose();
    this.upsampleMaterial.dispose();
    super.dispose();
  }
}
