// Synthesised sources for the sound layer. Nothing here is a recording, so the
// whole layer is copyright-free by construction.

/** MIDI note → Hz. */
export const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// D Aeolian. Every pitched sound on the site comes from this scale.
export const SCALE = { D: 62, E: 64, F: 65, G: 67, A: 69, Bb: 70, C: 72 } as const;

/** The six bodies' notes: together a Dm11 chord (D F A C E G). */
export const BODY_NOTES = [74, 77, 81, 84, 88, 91] as const;

/** Slow pad progression (5 voices each): i(add9) – VI – iv9 – ♭VII. */
export const PAD_CHORDS: readonly (readonly number[])[] = [
  [50, 57, 60, 64, 65], // Dm(add9): D3 A3 C4 E4 F4
  [46, 53, 57, 62, 64], // B♭maj7(9): B♭2 F3 A3 D4 E4
  [43, 50, 57, 58, 65], // Gm9: G2 D3 A3 B♭3 F4
  [48, 55, 57, 62, 64], // Cadd9/A: C3 G3 A3 D4 E4
];

/** Pink noise (Paul Kellet's refined filter), looped. */
export function pinkNoise(ctx: BaseAudioContext, seconds = 4, channels = 2): AudioBuffer {
  const buf = ctx.createBuffer(channels, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let c = 0; c < channels; c++) {
    const d = buf.getChannelData(c);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    smoothLoop(d);
  }
  return buf;
}

/** Brown (red) noise: integrated white noise, for the low rumble. */
export function brownNoise(ctx: BaseAudioContext, seconds = 4, channels = 2): AudioBuffer {
  const buf = ctx.createBuffer(channels, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let c = 0; c < channels; c++) {
    const d = buf.getChannelData(c);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.2;
    }
    smoothLoop(d);
  }
  return buf;
}

/** Crossfade the buffer's ends so it loops without a click. */
function smoothLoop(d: Float32Array): void {
  const n = Math.min(2048, Math.floor(d.length / 8));
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const head = d[i]!;
    const tail = d[d.length - n + i]!;
    d[d.length - n + i] = tail * (1 - t) + head * t;
  }
}

/** Stereo reverb impulse: exponentially decaying, slightly darkening noise. */
export function impulseResponse(ctx: BaseAudioContext, seconds = 5.5, decay = 2.6): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // One-pole lowpass that closes over the tail: long reverbs get darker.
      const k = 0.65 - 0.5 * t;
      lp = lp + k * (Math.random() * 2 - 1 - lp);
      d[i] = lp * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

/** Soft symmetric saturation: adds the harmonics that let a sub read on laptop speakers. */
export function saturationCurve(drive = 2.2): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}

/** Seconds into the slingshot whoosh where the gravity-assist apex lands. */
export const WHOOSH_APEX = 0.56;
/** Seconds into the whoosh where the low landing impact hits. */
export const WHOOSH_LAND = 1.25;

/**
 * Render the slingshot whoosh once, offline: a band-passed noise sweep and a
 * pitch glide that both peak at the gravity-assist apex, panned across the
 * stereo field, then a low soft impact as the case study opens. Rendering it to
 * a buffer means "back to orbit" can play the exact same sound reversed.
 */
export async function renderWhoosh(sampleRate: number): Promise<AudioBuffer> {
  const dur = 2.1;
  const off = new OfflineAudioContext(2, Math.ceil(sampleRate * dur), sampleRate);
  const t0 = 0.02;

  const noise = off.createBufferSource();
  noise.buffer = pinkNoise(off, dur, 1);
  const bp = off.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(220, t0);
  bp.frequency.exponentialRampToValueAtTime(3400, t0 + WHOOSH_APEX);
  bp.frequency.exponentialRampToValueAtTime(380, t0 + WHOOSH_LAND - 0.05);
  const ng = off.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.75, t0 + WHOOSH_APEX);
  ng.gain.exponentialRampToValueAtTime(0.06, t0 + WHOOSH_LAND - 0.05);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + WHOOSH_LAND + 0.1);
  const pan = off.createStereoPanner();
  pan.pan.setValueAtTime(-0.75, t0);
  pan.pan.linearRampToValueAtTime(0.75, t0 + WHOOSH_LAND);
  noise.connect(bp).connect(ng).connect(pan).connect(off.destination);
  noise.start(t0);

  // Pitch glide: rises to the apex, bends back down as you climb out.
  const osc = off.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(hz(45), t0);
  osc.frequency.exponentialRampToValueAtTime(hz(69), t0 + WHOOSH_APEX);
  osc.frequency.exponentialRampToValueAtTime(hz(50), t0 + WHOOSH_LAND);
  const og = off.createGain();
  og.gain.setValueAtTime(0.0001, t0);
  og.gain.exponentialRampToValueAtTime(0.09, t0 + WHOOSH_APEX);
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + WHOOSH_LAND);
  osc.connect(og).connect(pan);
  osc.start(t0);
  osc.stop(t0 + WHOOSH_LAND + 0.05);

  // Landing: a low, soft impact (sine thump + a breath of low noise).
  const land = t0 + WHOOSH_LAND;
  const kick = off.createOscillator();
  kick.frequency.setValueAtTime(74, land);
  kick.frequency.exponentialRampToValueAtTime(38, land + 0.45);
  const kg = off.createGain();
  kg.gain.setValueAtTime(0.0001, land);
  kg.gain.exponentialRampToValueAtTime(0.55, land + 0.012);
  kg.gain.exponentialRampToValueAtTime(0.0001, land + 0.8);
  kick.connect(kg).connect(off.destination);
  kick.start(land);
  kick.stop(land + 0.85);

  const thump = off.createBufferSource();
  thump.buffer = brownNoise(off, 0.4, 1);
  const tl = off.createBiquadFilter();
  tl.type = 'lowpass';
  tl.frequency.value = 220;
  const tg = off.createGain();
  tg.gain.setValueAtTime(0.0001, land);
  tg.gain.exponentialRampToValueAtTime(0.35, land + 0.01);
  tg.gain.exponentialRampToValueAtTime(0.0001, land + 0.3);
  thump.connect(tl).connect(tg).connect(off.destination);
  thump.start(land);

  return off.startRendering();
}

/** A copy of the buffer played backwards. */
export function reversed(ctx: BaseAudioContext, buf: AudioBuffer): AudioBuffer {
  const out = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0; i < src.length; i++) dst[i] = src[src.length - 1 - i]!;
  }
  return out;
}
