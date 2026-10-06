// Every level, filter range and mapping in the sound layer. The engine reads
// this object every frame; the dev-only Tweakpane "audio" folder binds to it,
// so the mix can be tuned by ear live.
export const audioParams = {
  master: 0.12, // ≈ −25 dBFS RMS: well below typical music (≈ −14); a limiter sits after it
  levels: {
    drone: 0.5,
    pads: 1.0,
    hiss: 0.05,
    radio: 0.04,
    pulse: 0.45,
    bodies: 0.05, // per-body Doppler hum: felt more than heard
    rush: 0.4,
    rumble: 0.35,
    ui: 0.5,
    singularity: 0.16,
  },
  depth: {
    /** Exponent on the 0..1 depth curve (log-radius from 40 Rs to the horizon). */
    curve: 1.2,
    cutoffHero: 7500, // Hz, score lowpass at 40 Rs
    cutoffHorizon: 320, // Hz, at the horizon
    wetHero: 0.22, // reverb send at 40 Rs
    wetHorizon: 0.75,
    /** Fraction of the true static-observer redshift applied to the bed's pitch. */
    redshift: 0.35,
    /** Base interval (s) of the time-dilation pulse, multiplied by 1/sqrt(1 - 1/r). */
    pulseSeconds: 4.5,
  },
  scroll: {
    /** Lenis velocity (px/frame) that counts as a "full" rush. */
    fullVelocity: 55,
    attack: 0.08, // s, smoothing time constants
    release: 0.6,
    freqMin: 260, // Hz, rush bandpass at rest
    freqMax: 2600, // Hz, at full speed
  },
  reading: {
    /** Case-study pages: how far the bed recedes (lowpass factor and gain). */
    cutoff: 0.14,
    gain: 0.6,
  },
  /** Optional recorded bed mixed under the generative score (CC0 / free-licensed only; see CREDITS.md). */
  ambientTrack: { url: null as string | null, gain: 0.15 },
};

export type AudioParams = typeof audioParams;
