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
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { BloomEffect, EffectComposer, EffectPass } from 'postprocessing';
import { BlackHolePass } from './BlackHolePass';
import { StippleEffect } from './StippleEffect';
import { orbitPosition, solveBasis } from './camera';
import { params } from './params';
import { rig } from '../scroll/rig';
import { bodies, parkPosition, updateBodies } from './bodies';
import { activeBody, hoveredBody, isInteractive, isLocked, setHovered } from './interaction';
import { projectNdc, solveImage, type View } from './lensing';
import { projects } from '../content/projects';

// Device pixel ratios above this don't buy the raymarch anything visible.
const MAX_DPR = 2;
const PICK_INTERVAL_MS = 60;
/** Apparent shadow radius scale: b_crit = (3√3 / 2) Rs. */
const B_CRIT = (3 * Math.sqrt(3)) / 2;

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

/** Screen-space anchors for the SVG annotation layer, in CSS pixels. */
export interface Anchors {
  hole: { x: number; y: number; shadowPx: number; visible: boolean };
  body: { id: number; x: number; y: number; radiusPx: number; visible: boolean };
  /** 0..1, how present the bodies (and their annotations) are right now. */
  bodiesVis: number;
}

export class Engine {
  readonly stats: EngineStats = { fps: 0, frameMs: 0, benchMs: null, marchWidth: 0, marchHeight: 0, maxSteps: 0 };
  /** Live camera radius in Rs and elevation above the disk plane; the HUD reads these. */
  cameraRadius: number = params.camera.distance;
  cameraElevationDeg: number = params.camera.elevationDeg;
  readonly anchors: Anchors = {
    hole: { x: 0, y: 0, shadowPx: 0, visible: false },
    body: { id: 0, x: 0, y: 0, radiusPx: 0, visible: false },
    bodiesVis: 0,
  };

  private readonly renderer: WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly hole: BlackHolePass;
  private readonly bloom: BloomEffect;
  private readonly stipple: StippleEffect;
  private readonly reducedMotion: boolean;
  private readonly view: View;

  private diskTime = 0;
  /** Eases toward a slower clock while a body is active: easier to hit, and a nod to time dilation. */
  private timeScale = 1;
  private shimmerClock = 0;
  private dpr = 1;
  private viewW = 1;
  private viewH = 1;
  private lastPick = 0;

  // Pointer, in NDC. `target*` is raw input; the others are smoothed.
  private pointerActive = false;
  private targetX = 0;
  private targetY = 0;
  private camX = 0;
  private camY = 0;
  private lensX = 0;
  private lensY = 0;
  private lensMass = 0;

  // Annotation solve state: the last image position, reused as the next seed.
  private solvedId = 0;
  private readonly solved = new Vector2();

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

    const u = this.hole.uniforms;
    this.view = { pos: u.uCamPos.value, basis: u.uCamBasis.value, tanHalf: 0.3, aspect: 1, shift: u.uLensShift.value };

    // Bodies' static look and the radial band the shader tests them in.
    let rMin = Infinity;
    let rMax = 0;
    bodies.forEach((b, i) => {
      u.uBodyLook.value[i]!.set(b.surface, b.brightness, 0, 0);
      const a = projects[i]!.body.orbitRadius;
      rMin = Math.min(rMin, a - b.radius);
      rMax = Math.max(rMax, a + b.radius);
    });
    u.uBodyShell.value.set(rMin - 0.05, rMax + 0.05);

    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', this.onPointerLeave);
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
    this.updatePicking();
    this.updateAnchors();
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

  /** Live camera position (world, Rs). */
  get cameraPosition(): Vector3 {
    return this.view.pos;
  }

  /** Current disk clock (bodies orbit on it too). */
  get time(): number {
    return this.diskTime;
  }

  private applyParams(dt: number): void {
    const { raymarch, disk, sky, pointer, bloom, grain } = params;
    const u = this.hole.uniforms;
    const motion = this.reducedMotion ? 0 : 1;

    // Pointer smoothing: slow for the camera drift, quicker for the lens.
    const kCam = 1 - Math.exp(-pointer.smoothing * dt);
    const kLens = 1 - Math.exp(-pointer.smoothing * 3 * dt);
    this.camX += (this.targetX - this.camX) * kCam;
    this.camY += (this.targetY - this.camY) * kCam;
    this.lensX += (this.targetX - this.lensX) * kLens;
    this.lensY += (this.targetY - this.lensY) * kLens;
    const massTarget = this.pointerActive ? pointer.mass * motion : 0;
    this.lensMass += (massTarget - this.lensMass) * kCam;

    const slowTarget = activeBody() && rig.park === 0 ? 0.2 : 1;
    this.timeScale += (slowTarget - this.timeScale) * (1 - Math.exp(-4 * dt));
    this.diskTime += dt * disk.speed * this.timeScale * (this.reducedMotion ? 0.2 : 1);
    updateBodies(this.diskTime);

    // Camera: an orbit pose driven by the narrative (+ pointer parallax),
    // optionally blended toward a parked pose beside a body and turned to it.
    const parallax = pointer.parallaxDeg * motion * (1 - rig.park);
    const elevationDeg = rig.elevationDeg + this.camY * parallax * 0.6;
    const pos = u.uCamPos.value;
    orbitPosition(
      { distance: Math.exp(rig.logR), azimuthDeg: rig.azimuthDeg + this.camX * parallax, elevationDeg },
      pos,
    );
    const forward = _forward.copy(pos).negate().normalize();
    const target = rig.targetBody >= 0 ? bodies[rig.targetBody] : undefined;
    if (target) {
      if (rig.park > 0) parkPosition(target.center, target.radius, _park);
      if (rig.park > 0) pos.lerp(_park, rig.park);
      const toBody = _toBody.subVectors(target.center, pos).normalize();
      forward.copy(pos).negate().normalize().lerp(toBody, rig.focus).normalize();
    }
    solveBasis(forward, rig.rollDeg, u.uCamBasis.value);
    this.cameraRadius = pos.length();
    this.cameraElevationDeg = (Math.asin(pos.y / this.cameraRadius) * 180) / Math.PI;

    const tanHalf = Math.tan((rig.fovDeg * Math.PI) / 360);
    const aspect = this.viewW / this.viewH;
    u.uTanHalfFov.value = tanHalf;
    u.uLensShift.value.set(rig.shiftX, rig.shiftY);
    this.view.tanHalf = tanHalf;
    this.view.aspect = aspect;
    // Cursor in the same view-plane units the shader builds rays in.
    u.uCursor.value.set(
      (this.lensX - rig.shiftX) * aspect * tanHalf,
      (this.lensY - rig.shiftY) * tanHalf,
      this.lensMass,
    );

    bodies.forEach((b, i) => {
      u.uBodies.value[i]!.set(b.center.x, b.center.y, b.center.z, b.radius);
      u.uBodyLook.value[i]!.z = b.spin;
    });
    u.uBodyVis.value = rig.bodies;
    // Defocus by sampling the raymarch's mip chain (level 3.2 ≈ 1/9 resolution).
    this.hole.blurLod.value = rig.blur * 3.2;
    u.uHoverId.value = activeBody();

    // renderScale is relative to device pixels; the composer runs at CSS pixels.
    this.hole.setRenderScale(Math.min(1, raymarch.renderScale * this.dpr));
    u.uMaxSteps.value = raymarch.maxSteps;
    u.uStepScale.value = raymarch.stepScale;
    u.uLensing.value = raymarch.lensing;

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
    // Reading mode also caps the tone, so even saturated disk light sits under text.
    s.ceiling.value = 1 - rig.blur * 0.5;
    s.flare.value = rig.flare;
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

  /** Throttled async read of the body ID under the pointer. Never stalls. */
  private updatePicking(): void {
    const canPick = isInteractive() && !isLocked() && this.pointerActive && rig.bodies > 0.5 && rig.park === 0;
    if (!canPick) {
      if (hoveredBody() !== 0) setHovered(0);
      return;
    }
    const now = performance.now();
    if (now - this.lastPick < PICK_INTERVAL_MS) return;
    this.lastPick = now;
    void this.hole.pick(this.renderer, this.targetX, this.targetY).then((id) => {
      if (id !== null && isInteractive()) setHovered(id);
    });
  }

  /** Project the hole and solve the active body's lensed image position. */
  private updateAnchors(): void {
    const a = this.anchors;
    a.bodiesVis = rig.bodies * (1 - rig.park);

    const holeOk = projectNdc(this.view, _origin, _ndc);
    const r = this.cameraRadius;
    // Apparent shadow radius for a static observer: sin α = b_c sqrt(1 - 1/r) / r.
    const sinA = Math.min(1, (B_CRIT * Math.sqrt(Math.max(0, 1 - 1 / r))) / r);
    const tanA = sinA / Math.sqrt(Math.max(1e-6, 1 - sinA * sinA));
    a.hole.visible = holeOk && r > 1.6;
    a.hole.x = (_ndc.x * 0.5 + 0.5) * this.viewW;
    a.hole.y = (0.5 - _ndc.y * 0.5) * this.viewH;
    a.hole.shadowPx = (tanA / this.view.tanHalf) * (this.viewH / 2);

    const id = activeBody();
    const body = id > 0 ? bodies[id - 1] : undefined;
    if (!body || a.bodiesVis < 0.05) {
      a.body.visible = false;
      a.body.id = 0;
      this.solvedId = 0;
      return;
    }
    // Seed: the pointer when it picked this body (so a secondary image under
    // the cursor is honoured), else the straight-line projection; afterwards
    // the previous solution, for temporal coherence.
    if (this.solvedId !== id) {
      if (hoveredBody() === id) this.solved.set(this.targetX, this.targetY);
      else if (!projectNdc(this.view, body.center, this.solved)) this.solved.set(0, 0);
      this.solvedId = id;
    }
    const miss = solveImage(this.view, body.center, this.solved, this.solved, params.raymarch.stepScale);
    const dist = body.center.distanceTo(this.view.pos);
    a.body.id = id;
    a.body.visible = Number.isFinite(miss) && miss < body.radius * 1.5;
    a.body.x = (this.solved.x * 0.5 + 0.5) * this.viewW;
    a.body.y = (0.5 - this.solved.y * 0.5) * this.viewH;
    a.body.radiusPx = (body.radius / dist / this.view.tanHalf) * (this.viewH / 2);
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

const _forward = new Vector3();
const _toBody = new Vector3();
const _park = new Vector3();
const _origin = new Vector3();
const _ndc = new Vector2();

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
