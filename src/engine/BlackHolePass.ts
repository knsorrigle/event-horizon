import {
  GLSL3,
  HalfFloatType,
  LinearFilter,
  Matrix3,
  RawShaderMaterial,
  Uniform,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { CopyMaterial, Pass } from 'postprocessing';
import vertexShader from '../shaders/fullscreen.vert';
import fragmentShader from '../shaders/blackhole.frag';

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
  };

  /** Fraction of the composer's (device-pixel) size the raymarch renders at. */
  renderScale = 0.5;

  private readonly marchMaterial: RawShaderMaterial;
  private readonly copyMaterial = new CopyMaterial();
  private readonly target: WebGLRenderTarget;
  private readonly fullSize = new Vector2(1, 1);

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
    this.target = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
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

    this.copyMaterial.inputBuffer = this.target.texture;
    this.fullscreenMaterial = this.copyMaterial;
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

  setRenderScale(scale: number): void {
    if (scale === this.renderScale) return;
    this.renderScale = scale;
    this.setSize(this.fullSize.x, this.fullSize.y);
  }

  override dispose(): void {
    this.target.dispose();
    this.marchMaterial.dispose();
    this.copyMaterial.dispose();
    super.dispose();
  }
}
