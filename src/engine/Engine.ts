import {
  DataTexture,
  HalfFloatType,
  LinearSRGBColorSpace,
  NearestFilter,
  NoToneMapping,
  OrthographicCamera,
  RedFormat,
  RepeatWrapping,
  UnsignedByteType,
  WebGLRenderer,
} from 'three';
import { BloomEffect, EffectComposer, EffectPass } from 'postprocessing';
import { BlackHolePass } from './BlackHolePass';
import { StippleEffect } from './StippleEffect';
import { solveCamera } from './camera';
import { params } from './params';
import { rig } from '../scroll/rig';

// Device pixel ratios above this don't buy the raymarch anything visible.
const MAX_DPR = 2;

export interface EngineStats {
  fps: number;
  frameMs: number;
  /** Last synchronous GPU benchmark (ms per frame), or null if not run. */
  benchMs: number | null;
  marchWidth: number;
  marchHeight: number;
  maxSteps: number;
}

export interface EngineOptions {
  reducedMotion: boolean;
}

export class Engine {
  readonly stats: EngineStats = { fps: 0, frameMs: 0, benchMs: null, marchWidth: 0, marchHeight: 0, maxSteps: 0 };
  /** Live camera radius in Rs and elevation above the disk plane; the HUD reads these. */
  cameraRadius: number = params.camera.distance;
  cameraElevationDeg: number = params.camera.elevationDeg;

  private readonly renderer: WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly hole: BlackHolePass;
  private readonly bloom: BloomEffect;
  private readonly stipple: StippleEffect;
  private readonly reducedMotion: boolean;

  private diskTime = 0;
  private shimmerClock = 0;
  private dpr = 1;
  private viewW = 1;
  private viewH = 1;

  // Pointer, in NDC. `target*` is raw input; the others are smoothed.
  private pointerActive = false;
  private targetX = 0;
  private targetY = 0;
  private camX = 0;
  private camY = 0;
  private lensX = 0;
  private lensY = 0;
  private lensMass = 0;

  private constructor(canvas: HTMLCanvasElement, blueNoise: DataTexture, opts: EngineOptions) {
    this.reducedMotion = opts.reducedMotion;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    // The stipple pass writes final display values; no conversion or tone mapping.
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;

    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.hole = new BlackHolePass();
    this.bloom = new BloomEffect({ mipmapBlur: true });
    this.stipple = new StippleEffect(blueNoise);
    this.composer.addPass(this.hole);
    this.composer.addPass(new EffectPass(new OrthographicCamera(), this.bloom, this.stipple));

    this.resize();
    window.addEventListener('resize', this.resize);
    if (!this.reducedMotion) {
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', this.onPointerLeave);
    }
  }

  static async create(canvas: HTMLCanvasElement, opts: EngineOptions): Promise<Engine> {
    const blueNoise = await loadBlueNoise();
    return new Engine(canvas, blueNoise, opts);
  }

  /** Advance and render one frame. Driven by the shared GSAP ticker. */
  frame = (_time: number, deltaMs: number): void => {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.updateStats(deltaMs);
    this.applyParams(dt);

    this.composer.render(dt);
  };

  /**
   * Dev: render `frames` frames back to back and force a GPU sync. Timer-query
   * extensions are unreliable on some drivers (ANGLE/Metal reports idle time),
   * so this is the number to trust when checking the budget.
   */
  benchmark(frames = 60): number {
    const gl = this.renderer.getContext();
    const px = new Uint8Array(4);
    const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    this.applyParams(1 / 60);
    for (let i = 0; i < 5; i++) this.composer.render(1 / 60);
    sync();
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) this.composer.render(1 / 60);
    sync();
    const ms = (performance.now() - t0) / frames;
    this.stats.benchMs = ms;
    return ms;
  }

  private applyParams(dt: number): void {
    const { raymarch, disk, sky, pointer, bloom, grain } = params;
    const u = this.hole.uniforms;

    // Pointer smoothing: slow for the camera drift, quicker for the lens.
    const kCam = 1 - Math.exp(-pointer.smoothing * dt);
    const kLens = 1 - Math.exp(-pointer.smoothing * 3 * dt);
    this.camX += (this.targetX - this.camX) * kCam;
    this.camY += (this.targetY - this.camY) * kCam;
    this.lensX += (this.targetX - this.lensX) * kLens;
    this.lensY += (this.targetY - this.lensY) * kLens;
    const massTarget = this.pointerActive ? pointer.mass : 0;
    this.lensMass += (massTarget - this.lensMass) * kCam;

    // The scroll narrative drives `rig`; the pointer adds a small parallax orbit.
    const elevationDeg = rig.elevationDeg + this.camY * pointer.parallaxDeg * 0.6;
    solveCamera(
      {
        distance: Math.exp(rig.logR),
        azimuthDeg: rig.azimuthDeg + this.camX * pointer.parallaxDeg,
        elevationDeg,
        rollDeg: rig.rollDeg,
      },
      u.uCamPos.value,
      u.uCamBasis.value,
    );
    this.cameraRadius = u.uCamPos.value.length();
    this.cameraElevationDeg = elevationDeg;

    const tanHalf = Math.tan((rig.fovDeg * Math.PI) / 360);
    const aspect = this.viewW / this.viewH;
    u.uTanHalfFov.value = tanHalf;
    u.uLensShift.value.set(rig.shiftX, rig.shiftY);
    // Cursor in the same view-plane units the shader builds rays in.
    u.uCursor.value.set(
      (this.lensX - rig.shiftX) * aspect * tanHalf,
      (this.lensY - rig.shiftY) * tanHalf,
      this.lensMass,
    );

    // renderScale is relative to device pixels; the composer runs at CSS pixels.
    this.hole.setRenderScale(Math.min(1, raymarch.renderScale * this.dpr));
    u.uMaxSteps.value = raymarch.maxSteps;
    u.uStepScale.value = raymarch.stepScale;
    u.uLensing.value = raymarch.lensing;

    this.diskTime += dt * disk.speed * (this.reducedMotion ? 0.2 : 1);
    u.uDiskTime.value = this.diskTime;
    u.uDiskBrightness.value = disk.brightness;
    u.uDiskOpacity.value = disk.opacity;
    u.uBeaming.value = disk.beaming;
    u.uTurbulence.value = disk.turbulence;
    u.uStarDensity.value = sky.starDensity;
    u.uSkyBrightness.value = sky.brightness;
    u.uHaze.value = sky.haze;

    this.bloom.intensity = bloom.intensity;
    this.bloom.luminanceMaterial.threshold = bloom.threshold;
    this.bloom.luminanceMaterial.smoothing = bloom.smoothing;
    this.bloom.mipmapBlurPass.radius = bloom.radius;

    const s = this.stipple.u;
    s.exposure.value = grain.exposure * rig.exposure * (1 - rig.fade);
    s.blackPoint.value = grain.blackPoint;
    s.gamma.value = grain.gamma;
    s.levels.value = grain.levels;
    s.grainPx.value = Math.max(1, Math.round(grain.sizeCssPx));
    s.coarse.value = grain.coarse;
    s.coreSoftness.value = grain.coreSoftness;
    // Re-roll the blue-noise offset a few times a second: the grain shimmers
    // without boiling at the full frame rate.
    if (!this.reducedMotion && grain.shimmerHz > 0) {
      this.shimmerClock += dt;
      if (this.shimmerClock >= 1 / grain.shimmerHz) {
        this.shimmerClock = 0;
        s.noiseOffset.value.set(Math.floor(Math.random() * 128), Math.floor(Math.random() * 128));
      }
    }

    this.stats.marchWidth = this.hole.marchSize.x;
    this.stats.marchHeight = this.hole.marchSize.y;
    this.stats.maxSteps = raymarch.maxSteps;
  }

  private updateStats(deltaMs: number): void {
    // Exponential moving average (~0.5 s window at 60 fps).
    const a = 0.06;
    this.stats.frameMs = this.stats.frameMs === 0 ? deltaMs : this.stats.frameMs + (deltaMs - this.stats.frameMs) * a;
    this.stats.fps = this.stats.frameMs > 0 ? 1000 / this.stats.frameMs : 0;
  }

  // The canvas backing store is at CSS resolution and is upscaled with
  // `image-rendering: pixelated`. The grain is quantised to CSS-pixel cells
  // anyway, so rendering bloom + stipple at device resolution would cost up to
  // 4× for no visible difference.
  private resize = (): void => {
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.renderer.setPixelRatio(1);
    this.composer.setSize(this.viewW, this.viewH);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    this.pointerActive = true;
    this.targetX = (e.clientX / this.viewW) * 2 - 1;
    this.targetY = 1 - (e.clientY / this.viewH) * 2;
  };

  private onPointerLeave = (): void => {
    this.pointerActive = false;
  };

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onPointerMove);
    document.documentElement.removeEventListener('pointerleave', this.onPointerLeave);
    this.composer.dispose();
    this.renderer.dispose();
  }
}

async function loadBlueNoise(): Promise<DataTexture> {
  const res = await fetch('/noise/bluenoise128.bin');
  if (!res.ok) throw new Error(`blue noise: ${res.status}`);
  const data = new Uint8Array(await res.arrayBuffer());
  const tex = new DataTexture(data, 128, 128, RedFormat, UnsignedByteType);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.minFilter = tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

