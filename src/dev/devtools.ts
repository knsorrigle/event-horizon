// Dev-only: Tweakpane bound to every shader uniform, plus an fps / GPU readout.
// Imported behind `import.meta.env.DEV`, so none of this ships to production.
import { Pane } from 'tweakpane';
import gsap from 'gsap';
import type { Engine } from '../engine/Engine';
import { params } from '../engine/params';
import { lenis, onTick } from '../loop/ticker';
import { audioParams } from '../audio/params';
import { audioDev } from '../audio';

export function mountDevTools(engine: Engine): () => void {
  // Console handle for profiling: __eh.params.raymarch.maxSteps = 96, etc.
  Object.assign(window, { __eh: { params, engine, lenis, gsap, audio: audioDev, audioParams } });

  const pane = new Pane({ title: 'event horizon · tuning', expanded: false });
  pane.element.parentElement?.style.setProperty('z-index', '100');

  const perf = pane.addFolder({ title: 'perf' });
  perf.addBinding(engine.stats, 'fps', { readonly: true, view: 'graph', min: 0, max: 130 });
  perf.addBinding(engine.stats, 'fps', { readonly: true, format: (v: number) => v.toFixed(1) });
  perf.addBinding(engine.stats, 'marchWidth', { readonly: true, label: 'march w', format: (v: number) => v.toFixed(0) });
  perf.addBinding(engine.stats, 'marchHeight', { readonly: true, label: 'march h', format: (v: number) => v.toFixed(0) });

  perf.addButton({ title: 'benchmark gpu (60 frames)' }).on('click', () => engine.benchmark(60));
  // One measurement shortly after load so the corner readout is never empty.
  const benchTimer = window.setTimeout(() => engine.benchmark(60), 2500);

  const rm = pane.addFolder({ title: 'raymarch' });
  rm.addBinding(params.raymarch, 'renderScale', { min: 0.25, max: 1, step: 0.05, label: 'render scale' });
  rm.addBinding(params.raymarch, 'maxSteps', { min: 32, max: 512, step: 1, label: 'max steps' });
  rm.addBinding(params.raymarch, 'stepScale', { min: 0.02, max: 0.3, step: 0.005, label: 'step scale' });
  rm.addBinding(params.raymarch, 'lensing', { min: 0, max: 2, step: 0.01, label: 'lensing' });

  const disk = pane.addFolder({ title: 'disk' });
  disk.addBinding(params.disk, 'brightness', { min: 0, max: 4, step: 0.01 });
  disk.addBinding(params.disk, 'opacity', { min: 0, max: 1, step: 0.01 });
  disk.addBinding(params.disk, 'beaming', { min: 0, max: 6, step: 0.1, label: 'beaming g^n' });
  disk.addBinding(params.disk, 'turbulence', { min: 0, max: 3, step: 0.01 });
  disk.addBinding(params.disk, 'speed', { min: 0, max: 5, step: 0.01 });

  const sky = pane.addFolder({ title: 'sky', expanded: false });
  sky.addBinding(params.sky, 'starDensity', { min: 0, max: 4, step: 0.01, label: 'stars' });
  sky.addBinding(params.sky, 'brightness', { min: 0, max: 4, step: 0.01 });
  sky.addBinding(params.sky, 'haze', { min: 0, max: 4, step: 0.01 });

  const cam = pane.addFolder({ title: 'camera', expanded: false });
  cam.addBinding(params.camera, 'distance', { min: 1.6, max: 80, step: 0.1 });
  cam.addBinding(params.camera, 'elevationDeg', { min: -89, max: 89, step: 0.1, label: 'elevation°' });
  cam.addBinding(params.camera, 'azimuthDeg', { min: -180, max: 180, step: 0.1, label: 'azimuth°' });
  cam.addBinding(params.camera, 'rollDeg', { min: -45, max: 45, step: 0.1, label: 'roll°' });
  cam.addBinding(params.camera, 'fovDeg', { min: 10, max: 100, step: 0.1, label: 'fov°' });
  cam.addBinding(params.camera, 'lensShiftX', { min: -1, max: 1, step: 0.01, label: 'shift x' });
  cam.addBinding(params.camera, 'lensShiftY', { min: -1, max: 1, step: 0.01, label: 'shift y' });
  cam.addBinding(params.pointer, 'parallaxDeg', { min: 0, max: 15, step: 0.1, label: 'parallax°' });
  cam.addBinding(params.pointer, 'mass', { min: 0, max: 0.01, step: 0.0001, label: 'cursor mass' });

  const post = pane.addFolder({ title: 'bloom', expanded: false });
  post.addBinding(params.bloom, 'intensity', { min: 0, max: 4, step: 0.01 });
  post.addBinding(params.bloom, 'threshold', { min: 0, max: 2, step: 0.01 });
  post.addBinding(params.bloom, 'smoothing', { min: 0, max: 1, step: 0.01 });
  post.addBinding(params.bloom, 'radius', { min: 0, max: 1, step: 0.01 });

  const grain = pane.addFolder({ title: 'grain' });
  grain.addBinding(params.grain, 'exposure', { min: 0, max: 4, step: 0.01 });
  grain.addBinding(params.grain, 'blackPoint', { min: 0, max: 0.2, step: 0.001, label: 'black point' });
  grain.addBinding(params.grain, 'gamma', { min: 0.3, max: 2, step: 0.01 });
  grain.addBinding(params.grain, 'levels', { min: 1, max: 12, step: 1, label: 'levels (density)' });
  grain.addBinding(params.grain, 'sizeCssPx', { min: 0.5, max: 4, step: 0.5, label: 'grain px' });
  grain.addBinding(params.grain, 'coarse', { min: 1, max: 4, step: 1, label: 'shadow coarse' });
  grain.addBinding(params.grain, 'coreSoftness', { min: 0, max: 1, step: 0.01, label: 'core soft' });
  grain.addBinding(params.grain, 'shimmerHz', { min: 0, max: 60, step: 1, label: 'shimmer hz' });

  // Audio: every level, filter range and depth mapping, tunable by ear.
  const meter = { peak: 0, rms: 0, rmsDb: -100 };
  const au = pane.addFolder({ title: 'audio', expanded: false });
  au.addBinding(audioParams, 'master', { min: 0, max: 1, step: 0.01 });
  au.addBinding(meter, 'peak', { readonly: true, label: 'peak', format: (v: number) => v.toFixed(3) });
  au.addBinding(meter, 'rmsDb', { readonly: true, label: 'rms dBFS', format: (v: number) => v.toFixed(1) });
  au.addBinding(meter, 'rmsDb', { readonly: true, label: 'rms', view: 'graph', min: -70, max: 0 });
  const lv = au.addFolder({ title: 'levels' });
  for (const key of Object.keys(audioParams.levels) as (keyof typeof audioParams.levels)[]) {
    lv.addBinding(audioParams.levels, key, { min: 0, max: 2, step: 0.005 });
  }
  const dp = au.addFolder({ title: 'depth mapping' });
  dp.addBinding(audioParams.depth, 'curve', { min: 0.3, max: 3, step: 0.05 });
  dp.addBinding(audioParams.depth, 'cutoffHero', { min: 500, max: 16000, step: 50, label: 'cutoff @40Rs' });
  dp.addBinding(audioParams.depth, 'cutoffHorizon', { min: 80, max: 2000, step: 10, label: 'cutoff @horizon' });
  dp.addBinding(audioParams.depth, 'wetHero', { min: 0, max: 1, step: 0.01, label: 'reverb @40Rs' });
  dp.addBinding(audioParams.depth, 'wetHorizon', { min: 0, max: 1.5, step: 0.01, label: 'reverb @horizon' });
  dp.addBinding(audioParams.depth, 'redshift', { min: 0, max: 1, step: 0.01, label: 'redshift amt' });
  dp.addBinding(audioParams.depth, 'pulseSeconds', { min: 1, max: 12, step: 0.1, label: 'pulse base s' });
  const sc = au.addFolder({ title: 'scroll rush', expanded: false });
  sc.addBinding(audioParams.scroll, 'fullVelocity', { min: 5, max: 200, step: 1, label: 'full velocity' });
  sc.addBinding(audioParams.scroll, 'attack', { min: 0.01, max: 1, step: 0.01 });
  sc.addBinding(audioParams.scroll, 'release', { min: 0.05, max: 3, step: 0.01 });
  sc.addBinding(audioParams.scroll, 'freqMin', { min: 60, max: 2000, step: 10, label: 'freq min' });
  sc.addBinding(audioParams.scroll, 'freqMax', { min: 500, max: 10000, step: 50, label: 'freq max' });
  const rd = au.addFolder({ title: 'reading (case pages)', expanded: false });
  rd.addBinding(audioParams.reading, 'cutoff', { min: 0.02, max: 1, step: 0.01, label: 'cutoff factor' });
  rd.addBinding(audioParams.reading, 'gain', { min: 0, max: 1, step: 0.01 });
  const tests = au.addFolder({ title: 'test sounds', expanded: false });
  for (let id = 1; id <= 6; id++) tests.addButton({ title: `ping body ${id}` }).on('click', () => audioDev.engine()?.hoverBody(id, 0));
  tests.addButton({ title: 'slingshot' }).on('click', () => audioDev.engine()?.slingshot(3));
  tests.addButton({ title: 'back to orbit' }).on('click', () => audioDev.engine()?.returnToOrbit(3));
  tests.addButton({ title: 'white hole' }).on('click', () => audioDev.engine()?.whiteHole());
  tests.addButton({ title: 'link tick' }).on('click', () => audioDev.engine()?.uiTick());

  pane.addButton({ title: 'copy params as JSON' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify({ visual: params, audio: audioParams }, null, 2));
  });

  // Tiny always-visible fps readout in the corner.
  const fps = document.createElement('div');
  fps.setAttribute('aria-hidden', 'true');
  fps.style.cssText =
    'position:fixed;right:12px;bottom:10px;text-align:right;z-index:100;font:500 10px/1.4 "IBM Plex Mono",monospace;color:#8b979b;pointer-events:none;white-space:pre';
  document.body.appendChild(fps);

  let acc = 0;
  const stopTick = onTick((_t, dms) => {
    acc += dms;
    if (acc < 250) return;
    acc = 0;
    const m = audioDev.engine()?.meter();
    if (m) {
      meter.peak = m.peak;
      meter.rms = m.rms;
      meter.rmsDb = m.rms > 0 ? 20 * Math.log10(m.rms) : -100;
    }
    pane.refresh();
    const s = engine.stats;
    const gpu = s.benchMs === null ? '—' : `${s.benchMs.toFixed(2)}ms`;
    fps.textContent = `${s.fps.toFixed(0).padStart(3)} fps  ${s.frameMs.toFixed(1)}ms  gpu(bench) ${gpu}\nmarch ${s.marchWidth}×${s.marchHeight}  steps ${s.maxSteps}`;
  });

  return () => {
    window.clearTimeout(benchTimer);
    stopTick();
    fps.remove();
    pane.dispose();
  };
}
