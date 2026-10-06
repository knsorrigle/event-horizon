// The sound layer's Web Audio graph. Lazily loaded only after the visitor opts
// into sound (see ./index.ts). Every continuous parameter moves through
// setTargetAtTime, so nothing ever steps (no clicks).
//
//   score: drone · pads · hiss · radio · time-dilation pulse · body hum
//        → duck → depth lowpass → reading level ─┬─ dry ──────────┐
//                                                └─ send → reverb ─┤
//   sfx:   scroll rush · gravitational rumble ────────────────────┤→ world gate → master → limiter → out
//   ui:    pings · whoosh · white hole ──── (dry + reverb send) ─────────────────→ master
//   ticks, toggle tone, singularity tone ─────────────────────────────────────→ master
import { audioParams as P } from './params';
import {
  BODY_NOTES,
  PAD_CHORDS,
  brownNoise,
  hz,
  impulseResponse,
  pinkNoise,
  renderWhoosh,
  reversed,
  saturationCurve,
} from './voices';

/** One frame of simulation state, fed from the app's single RAF loop. */
export interface AudioFrame {
  /** Camera radius in Rs. */
  r: number;
  /** Absolute scroll velocity in px/frame. */
  velocity: number;
  /** 0 → 1 as the screen fades to black at the horizon. */
  fade: number;
  /** White-hole flare, 0..1. */
  flare: number;
  /** Case-study reading mode (defocus), 0..1. */
  reading: number;
  /** Progress through the singularity section after the black beat, 0..1. */
  singularity: number;
  /** Per body: radial velocity toward(-)/away(+) from the camera (Rs/s), distance, pan, visibility. */
  bodies: readonly { radialVelocity: number; distance: number; pan: number; visible: number }[];
}

const TC = 0.06; // default smoothing time constant (s)
const RETURN_OFFSET = 0.55; // s into the reversed whoosh where "back to orbit" starts

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Exponential ramps can't target 0: envelope peaks get a tiny positive floor. */
const audibleLevel = (v: number) => Math.max(v, 1e-4);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export class AudioEngine {
  private readonly master: GainNode;
  private readonly analyser: AnalyserNode;
  private readonly worldGate: GainNode;
  private readonly duck: GainNode;
  private readonly depthLP: BiquadFilterNode;
  private readonly readingGain: GainNode;
  private readonly dry: GainNode;
  private readonly send: GainNode;
  private readonly wet: GainNode;
  private readonly convolver: ConvolverNode;
  private readonly scoreIn: GainNode;
  private readonly uiBus: GainNode;
  private readonly tickBus: GainNode;

  // Score voices
  private readonly droneGain: GainNode;
  private readonly droneOscs: OscillatorNode[] = [];
  private readonly padGain: GainNode;
  private readonly padOscs: OscillatorNode[][] = [];
  private readonly padVoiceGains: GainNode[] = [];
  private readonly hissGain: GainNode;
  private readonly radioGain: GainNode;
  private readonly radioAM: GainNode;
  private readonly pulseGain: GainNode;
  private readonly bodyOscs: OscillatorNode[] = [];
  private readonly bodyGains: GainNode[] = [];
  private readonly bodyPans: StereoPannerNode[] = [];
  private readonly bodiesGain: GainNode;
  private readonly singGain: GainNode;
  private readonly singOscs: OscillatorNode[] = [];

  // Scroll layers
  private readonly rushGain: GainNode;
  private readonly rushBP: BiquadFilterNode;
  private readonly rumbleGain: GainNode;

  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly tickNoise: AudioBuffer;
  private whoosh: AudioBuffer | null = null;
  private whooshRev: AudioBuffer | null = null;

  private frame: AudioFrame = { r: 40, velocity: 0, fade: 0, flare: 0, reading: 0, singularity: 0, bodies: [] };
  private enabled = false;
  private vel = 0;
  private redshiftCents = 0;
  private nextPulse = 0;
  private chord = 0;
  private nextChord = 0;
  private nextRadio = 0;
  private beyond = false;
  private lastPing = 0;
  private readonly lastBodyPing = new Map<number, number>();
  private lastTick = 0;

  private constructor(
    readonly ctx: AudioContext,
    private readonly reducedMotion: boolean,
  ) {
    const c = ctx;
    const gain = (v = 1) => {
      const g = c.createGain();
      g.gain.value = v;
      return g;
    };

    // Master: quiet by default, hard limiter, metered.
    this.master = gain(0);
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    this.analyser = c.createAnalyser();
    this.analyser.fftSize = 2048;
    this.master.connect(limiter).connect(this.analyser).connect(c.destination);

    // World (everything that goes silent at the horizon).
    this.worldGate = gain(1);
    this.worldGate.connect(this.master);

    this.convolver = c.createConvolver();
    this.convolver.buffer = impulseResponse(c);
    this.wet = gain(0.8);
    this.convolver.connect(this.wet).connect(this.worldGate);

    this.scoreIn = gain(1);
    this.duck = gain(1);
    this.depthLP = c.createBiquadFilter();
    this.depthLP.type = 'lowpass';
    this.depthLP.Q.value = 0.5;
    this.depthLP.frequency.value = P.depth.cutoffHero;
    this.readingGain = gain(1);
    this.dry = gain(1);
    this.send = gain(P.depth.wetHero);
    this.scoreIn.connect(this.duck).connect(this.depthLP).connect(this.readingGain);
    this.readingGain.connect(this.dry).connect(this.worldGate);
    this.readingGain.connect(this.send).connect(this.convolver);

    // UI: dry + a little reverb; not depth-filtered so it stays crisp.
    this.uiBus = gain(1);
    this.uiBus.connect(this.master);
    const uiSend = gain(0.35);
    this.uiBus.connect(uiSend).connect(this.convolver);
    this.tickBus = gain(1);
    this.tickBus.connect(this.master);

    // ---- Drone: sub + octave + fifth, saturated so the bass reads on small speakers.
    this.droneGain = gain(0);
    // Gentle drive: enough saturation to add harmonics for small speakers,
    // not so much that the sub dominates the mix.
    const droneMix = gain(0.3);
    const shaper = c.createWaveShaper();
    shaper.curve = saturationCurve(2.4);
    shaper.oversample = '2x';
    const droneLP = c.createBiquadFilter();
    droneLP.type = 'lowpass';
    droneLP.frequency.value = 1100;
    droneMix.connect(shaper).connect(droneLP).connect(this.droneGain).connect(this.scoreIn);
    for (const [midi, type, level] of [
      [26, 'sine', 0.55], // D1
      [38, 'sine', 0.32], // D2
      [45, 'triangle', 0.1], // A2
    ] as const) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = hz(midi);
      const g = gain(level);
      o.connect(g).connect(droneMix);
      this.droneOscs.push(o);
      this.start(o);
    }

    // Harmonic layer for small speakers: a band-limited saw on D1 keeps only its
    // upper harmonics (~150–700 Hz). Laptop drivers can't play 37 Hz, but the
    // ear infers the missing fundamental from these, so the sub still "reads".
    const harm = c.createOscillator();
    harm.type = 'sawtooth';
    harm.frequency.value = hz(26);
    const harmHP = c.createBiquadFilter();
    harmHP.type = 'highpass';
    harmHP.frequency.value = 140;
    const harmLP = c.createBiquadFilter();
    harmLP.type = 'lowpass';
    harmLP.frequency.value = 700;
    const harmGain = gain(0.3);
    harm.connect(harmHP).connect(harmLP).connect(harmGain).connect(this.droneGain);
    this.droneOscs.push(harm);
    this.start(harm);

    // ---- Pads: five detuned saw pairs, softly lowpassed, gliding between chords.
    this.padGain = gain(0);
    const padLP = c.createBiquadFilter();
    padLP.type = 'lowpass';
    padLP.frequency.value = 1500;
    padLP.Q.value = 0.3;
    padLP.connect(this.padGain).connect(this.scoreIn);
    PAD_CHORDS[0]!.forEach((midi) => {
      const vg = gain(0.12);
      const pair: OscillatorNode[] = [];
      for (const cents of [-7, 7]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(midi);
        o.detune.value = cents;
        o.connect(vg);
        pair.push(o);
        this.start(o);
      }
      vg.connect(padLP);
      this.padOscs.push(pair);
      this.padVoiceGains.push(vg);
    });

    // ---- Tape hiss and a distant, wandering radio band.
    const pink = pinkNoise(c, 6);
    this.hissGain = gain(0);
    const hissHP = c.createBiquadFilter();
    hissHP.type = 'highpass';
    hissHP.frequency.value = 3500;
    this.loop(pink).connect(hissHP).connect(this.hissGain).connect(this.scoreIn);

    this.radioGain = gain(0);
    this.radioAM = gain(0);
    const radioBP = c.createBiquadFilter();
    radioBP.type = 'bandpass';
    radioBP.frequency.value = 1150;
    radioBP.Q.value = 7;
    this.loop(pink, 2.3).connect(radioBP).connect(this.radioAM).connect(this.radioGain).connect(this.scoreIn);

    // ---- Time-dilation pulse (scheduled bells).
    this.pulseGain = gain(0);
    this.pulseGain.connect(this.scoreIn);

    // ---- Per-body hum, two octaves under each body's ping note.
    this.bodiesGain = gain(0);
    this.bodiesGain.connect(this.scoreIn);
    BODY_NOTES.forEach((midi) => {
      const o = c.createOscillator();
      o.frequency.value = hz(midi - 24);
      const g = gain(0);
      const p = c.createStereoPanner();
      o.connect(g).connect(p).connect(this.bodiesGain);
      this.bodyOscs.push(o);
      this.bodyGains.push(g);
      this.bodyPans.push(p);
      this.start(o);
    });

    // ---- Singularity: one soft sustained tone (two near-unison sines beating slowly).
    this.singGain = gain(0);
    this.singGain.connect(this.master);
    for (const detune of [0, 3.5]) {
      const o = c.createOscillator();
      o.frequency.value = hz(62); // D4
      o.detune.value = detune;
      o.connect(this.singGain);
      this.singOscs.push(o);
      this.start(o);
    }

    // ---- Scroll rush (band-passed pink) and depth rumble (saturated brown).
    this.rushGain = gain(0);
    this.rushBP = c.createBiquadFilter();
    this.rushBP.type = 'bandpass';
    this.rushBP.Q.value = 0.8;
    this.rushBP.frequency.value = P.scroll.freqMin;
    this.loop(pinkNoise(c, 5)).connect(this.rushBP).connect(this.rushGain).connect(this.worldGate);

    this.rumbleGain = gain(0);
    const rumbleLP = c.createBiquadFilter();
    rumbleLP.type = 'lowpass';
    rumbleLP.frequency.value = 120;
    const rumbleShaper = c.createWaveShaper();
    rumbleShaper.curve = saturationCurve(3);
    this.loop(brownNoise(c, 5)).connect(rumbleLP).connect(rumbleShaper).connect(this.rumbleGain).connect(this.worldGate);

    // A few ms of white noise for the link tick.
    this.tickNoise = c.createBuffer(1, Math.floor(c.sampleRate * 0.012), c.sampleRate);
    const td = this.tickNoise.getChannelData(0);
    for (let i = 0; i < td.length; i++) td[i] = (Math.random() * 2 - 1) * (1 - i / td.length);

    const now = c.currentTime;
    this.nextPulse = now + 1.5;
    this.nextChord = now + 18;
    this.nextRadio = now;
  }

  static async create(ctx: AudioContext, opts: { reducedMotion: boolean }): Promise<AudioEngine> {
    const engine = new AudioEngine(ctx, opts.reducedMotion);
    engine.whoosh = await renderWhoosh(ctx.sampleRate);
    engine.whooshRev = reversed(ctx, engine.whoosh);
    void engine.loadAmbientTrack();
    return engine;
  }

  // ------------------------------------------------------------ lifecycle

  /** Ramp the master up (from silence) over `seconds`. */
  fadeIn(seconds = 1.8): void {
    this.enabled = true;
    this.ramp(this.master.gain, P.master, seconds / 4);
  }

  /** Ramp to silence; resolves once it's inaudible (safe to suspend). */
  fadeOut(seconds = 0.4): Promise<void> {
    this.enabled = false;
    this.ramp(this.master.gain, 0, seconds / 5);
    return new Promise((res) => setTimeout(res, seconds * 1000 + 30));
  }

  dispose(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // already stopped
      }
    }
    this.master.disconnect();
  }

  // ------------------------------------------------------------ continuous input (the API)

  setDepth(r: number): void {
    this.frame.r = r;
  }
  setScrollVelocity(v: number): void {
    this.frame.velocity = Math.abs(v);
  }
  setFrame(frame: AudioFrame): void {
    this.frame = frame;
  }

  /** Advance smoothing and scheduling; called once per frame from the RAF loop. */
  update(dt: number): void {
    const f = this.frame;
    const now = this.ctx.currentTime;
    const L = P.levels;

    // Depth: 0 at the hero (40 Rs) → 1 at the horizon, log-radius, shaped.
    const r = Math.max(f.r, 1.0001);
    const u = Math.pow(clamp(Math.log(40 / r) / Math.log(40), 0, 1), P.depth.curve);

    // Gravitational redshift of the bed: a fraction of the static observer's
    // frequency ratio sqrt(1 - 1/r), in cents.
    this.redshiftCents = clamp(1200 * Math.log2(Math.sqrt(1 - 1 / r)) * P.depth.redshift, -700, 0);
    for (const o of this.droneOscs) this.ramp(o.detune, this.redshiftCents, 0.15);
    this.padOscs.forEach((pair) => pair.forEach((o, i) => this.ramp(o.detune, (i ? 7 : -7) + this.redshiftCents, 0.15)));

    // Darker and bigger as you fall; distant behind case studies.
    const cutoff = P.depth.cutoffHero * Math.pow(P.depth.cutoffHorizon / P.depth.cutoffHero, u);
    const reading = clamp(f.reading, 0, 1);
    this.ramp(this.depthLP.frequency, cutoff * (1 - reading * (1 - P.reading.cutoff)), 0.12);
    this.ramp(this.send.gain, P.depth.wetHero + (P.depth.wetHorizon - P.depth.wetHero) * u + 0.2 * reading, 0.2);
    this.ramp(this.dry.gain, 1 - 0.45 * u, 0.2);
    this.ramp(this.readingGain.gain, 1 - reading * (1 - P.reading.gain), 0.3);

    // Levels (so Tweakpane changes land live).
    this.ramp(this.droneGain.gain, L.drone, 0.3);
    this.ramp(this.padGain.gain, L.pads, 0.3);
    this.ramp(this.hissGain.gain, L.hiss, 0.3);
    this.ramp(this.radioGain.gain, L.radio, 0.3);
    this.ramp(this.pulseGain.gain, L.pulse, 0.3);
    this.ramp(this.bodiesGain.gain, L.bodies, 0.3);
    if (this.enabled) this.ramp(this.master.gain, P.master, 0.2);

    // Scroll rush: follows Lenis velocity, quick to swell, slow to settle.
    const target = clamp(f.velocity / P.scroll.fullVelocity, 0, 1);
    const tc = target > this.vel ? P.scroll.attack : P.scroll.release;
    this.vel += (target - this.vel) * (1 - Math.exp(-dt / tc));
    const motion = this.reducedMotion ? 0 : 1;
    this.ramp(this.rushGain.gain, L.rush * Math.pow(this.vel, 1.3) * motion, TC);
    this.ramp(this.rushBP.frequency, P.scroll.freqMin * Math.pow(P.scroll.freqMax / P.scroll.freqMin, this.vel), TC);
    // Gravitational rumble: only as depth increases, stirred a little by speed.
    this.ramp(this.rumbleGain.gain, L.rumble * Math.pow(u, 1.5) * (0.6 + 0.4 * this.vel) * motion, 0.2);

    // Bodies: a faint hum per body, Doppler-shifted by radial velocity.
    f.bodies.forEach((b, i) => {
      const o = this.bodyOscs[i];
      if (!o) return;
      const doppler = clamp(-b.radialVelocity * 40, -60, 60); // cents: approaching → higher
      this.ramp(o.detune, this.redshiftCents + doppler, 0.1);
      this.ramp(this.bodyGains[i]!.gain, b.visible * clamp(4 / Math.max(b.distance, 0.5), 0, 1), 0.2);
      this.ramp(this.bodyPans[i]!.pan, clamp(b.pan, -1, 1), 0.2);
    });

    // The horizon: everything cuts to silence. The singularity tone then
    // fades in after the black beat; scrolling back up brings the world back.
    const beyond = f.fade > 0.97 && f.flare < 0.05;
    if (beyond !== this.beyond) {
      this.beyond = beyond;
      if (beyond) this.cross();
      else this.ramp(this.worldGate.gain, 1, 0.5);
    }
    this.ramp(this.singGain.gain, beyond ? L.singularity * smoothstep(0.38, 0.62, f.singularity) : 0, beyond ? 0.6 : 0.15);

    this.schedulePulses(now, r);
    this.advancePads(now);
    this.wanderRadio(now);
  }

  // ------------------------------------------------------------ events (the API)

  /** Crossing the horizon: a hard (but click-free) cut to total silence. */
  cross(): void {
    this.ramp(this.worldGate.gain, 0, 0.015);
  }

  /** Soft glassy ping on its own note; the six bodies form a Dm11 chord. */
  hoverBody(id: number, pan: number): void {
    const now = this.ctx.currentTime;
    const last = this.lastBodyPing.get(id) ?? 0;
    if (now - this.lastPing < 0.11 || now - last < 0.4) return; // no machine-gunning
    this.lastPing = now;
    this.lastBodyPing.set(id, now);
    const midi = BODY_NOTES[(id - 1) % BODY_NOTES.length]!;
    this.ping(hz(midi), pan, P.levels.ui * 0.5);
    this.duckScore(0.78, 0.5);
  }

  /** The gravity-assist whoosh, apex aligned with the camera's periapsis, then the landing. */
  slingshot(id: number): void {
    if (this.reducedMotion || !this.whoosh) return;
    this.play(this.whoosh, 1 + (id - 3.5) * 0.015, 0, P.levels.ui * 0.9);
    this.duckScore(0.55, 1.4);
  }

  /** Back to orbit: the same sound, reversed. */
  returnToOrbit(id: number): void {
    if (this.reducedMotion || !this.whooshRev) return;
    this.play(this.whooshRev, 1 + (id - 3.5) * 0.015, RETURN_OFFSET, P.levels.ui * 0.9);
    this.duckScore(0.55, 1.4);
  }

  /** The white hole: a bright eruption, then the world returns as you're flung out. */
  whiteHole(): void {
    if (this.reducedMotion || !this.whooshRev) return;
    const c = this.ctx;
    const now = c.currentTime;
    this.play(this.whooshRev, 1.45, 0.2, P.levels.ui * 0.8);
    const src = c.createBufferSource();
    src.buffer = pinkNoise(c, 3, 2);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(600, now);
    hp.frequency.exponentialRampToValueAtTime(5000, now + 0.45);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(audibleLevel(0.35 * P.levels.ui), now + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
    src.connect(hp).connect(g).connect(this.uiBus);
    src.start(now);
    src.stop(now + 3);
    for (const midi of [86, 93]) this.ping(hz(midi), 0, P.levels.ui * 0.25, 2.6);
  }

  /** A tiny dry tick for link/button hover. Almost subliminal. */
  uiTick(): void {
    if (this.reducedMotion) return;
    const c = this.ctx;
    const now = c.currentTime;
    if (now - this.lastTick < 0.05) return;
    this.lastTick = now;
    const src = c.createBufferSource();
    src.buffer = this.tickNoise;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2800;
    const g = c.createGain();
    g.gain.value = 0.06 * P.levels.ui;
    src.connect(hp).connect(g).connect(this.tickBus);
    src.start(now);
  }

  /** Sound toggle feedback: a short tone that fades in (on) or out (off). */
  toggleTone(on: boolean): void {
    const c = this.ctx;
    const now = c.currentTime;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(hz(69), now); // A4
    if (!on) o.frequency.exponentialRampToValueAtTime(hz(62), now + 0.35);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(audibleLevel(0.12 * P.levels.ui), now + (on ? 0.22 : 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, now + (on ? 0.9 : 0.4));
    o.connect(g).connect(this.tickBus);
    o.start(now);
    o.stop(now + 1);
  }

  /** Master level for metering/tests: RMS and peak of the post-limiter signal. */
  meter(): { rms: number; peak: number } {
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    let peak = 0;
    for (const x of buf) {
      sum += x * x;
      peak = Math.max(peak, Math.abs(x));
    }
    return { rms: Math.sqrt(sum / buf.length), peak };
  }

  // ------------------------------------------------------------ internals

  private ramp(param: AudioParam, value: number, tc: number): void {
    // Skip negligible moves so the automation timeline doesn't fill up.
    if (Math.abs(param.value - value) < 1e-4 * Math.max(1, Math.abs(value))) return;
    param.setTargetAtTime(value, this.ctx.currentTime, tc);
  }

  private start(src: AudioScheduledSourceNode): void {
    src.start();
    this.sources.push(src);
  }

  private loop(buffer: AudioBuffer, offset = 0): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.start(this.ctx.currentTime, offset % buffer.duration);
    this.sources.push(s);
    return s;
  }

  private play(buffer: AudioBuffer, rate: number, offset: number, level: number): void {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = buffer;
    s.playbackRate.value = rate;
    // A 12 ms fade-in: playback can start mid-waveform (the reversed whoosh is
    // entered partway through), and an instant start there would click.
    const now = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(audibleLevel(level), now + 0.012);
    s.connect(g).connect(this.uiBus);
    s.start(now, offset);
  }

  private ping(freq: number, pan: number, level: number, decay = 1.4): void {
    const c = this.ctx;
    const now = c.currentTime;
    const p = c.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(audibleLevel(level), now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    env.connect(p).connect(this.uiBus);
    // A glassy partial stack (near-harmonic, slightly stretched).
    for (const [ratio, amp] of [
      [1, 1],
      [2.002, 0.35],
      [3.01, 0.12],
    ] as const) {
      const o = c.createOscillator();
      o.frequency.value = freq * ratio;
      o.detune.value = this.redshiftCents;
      const g = c.createGain();
      g.gain.value = amp * 0.4;
      o.connect(g).connect(env);
      o.start(now);
      o.stop(now + decay + 0.05);
    }
  }

  private duckScore(depth: number, hold: number): void {
    const now = this.ctx.currentTime;
    this.duck.gain.setTargetAtTime(depth, now, 0.03);
    this.duck.gain.setTargetAtTime(1, now + hold * 0.4, hold * 0.4);
  }

  /** The time-dilation pulse: interval stretches by 1/sqrt(1 - 1/r), the HUD's t_dilation. */
  private schedulePulses(now: number, r: number): void {
    const gamma = 1 / Math.sqrt(Math.max(1 - 1 / r, 1e-6));
    const interval = P.depth.pulseSeconds * gamma;
    // If time sped up again (scrolling back out), don't wait out a stale long gap.
    if (this.nextPulse - now > interval) this.nextPulse = now + interval;
    if (this.beyond || gamma > 40) return;
    while (this.nextPulse < now + 0.12) {
      this.bell(Math.max(this.nextPulse, now + 0.01));
      this.nextPulse += interval;
    }
  }

  private bell(t: number): void {
    const c = this.ctx;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.5, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    env.connect(this.pulseGain);
    for (const [ratio, amp] of [
      [1, 1],
      [2.76, 0.32],
      [5.4, 0.12],
    ] as const) {
      const o = c.createOscillator();
      o.frequency.value = hz(50) * ratio; // D3
      o.detune.value = this.redshiftCents;
      const g = c.createGain();
      g.gain.value = amp;
      o.connect(g).connect(env);
      o.start(t);
      o.stop(t + 3.3);
    }
  }

  private advancePads(now: number): void {
    if (now < this.nextChord) return;
    this.nextChord = now + 18;
    this.chord = (this.chord + 1) % PAD_CHORDS.length;
    const chord = PAD_CHORDS[this.chord]!;
    this.padOscs.forEach((pair, i) => {
      const f = hz(chord[i]!);
      for (const o of pair) o.frequency.setTargetAtTime(f, now, 1.8);
      // Each voice breathes at its own slow rate.
      this.padVoiceGains[i]!.gain.setTargetAtTime(0.08 + Math.random() * 0.08, now, 3);
    });
  }

  private wanderRadio(now: number): void {
    if (now < this.nextRadio) return;
    this.nextRadio = now + 0.4 + Math.random() * 0.8;
    this.radioAM.gain.setTargetAtTime(Math.random() < 0.35 ? Math.random() : 0, now, 0.25);
  }

  /** Optional recorded bed under the generative score (only if one is configured). */
  private async loadAmbientTrack(): Promise<void> {
    const url = P.ambientTrack.url;
    if (!url) return;
    try {
      const data = await (await fetch(url)).arrayBuffer();
      const buf = await this.ctx.decodeAudioData(data);
      const g = this.ctx.createGain();
      g.gain.value = P.ambientTrack.gain;
      this.loop(buf).connect(g).connect(this.scoreIn);
    } catch {
      // The generative bed stands on its own.
    }
  }
}
