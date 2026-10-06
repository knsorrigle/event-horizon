// Adaptive quality. rAF deltas are vsync-locked, so they reveal overload but
// never spare headroom: the controller starts high, steps down when the
// rolling frame time exceeds budget, and only probes upward after a long calm
// stretch, remembering any level that failed so it doesn't oscillate. If even
// the floor can't hold ~30 fps, it asks for the static fallback.

export interface QualityLevel {
  /** Raymarch resolution as a fraction of device pixels. */
  renderScale: number;
  maxSteps: number;
}

// Ladder from best to cheapest. Index 0 is the brief's baseline (0.5× DPR).
const LADDER: readonly QualityLevel[] = [
  { renderScale: 0.5, maxSteps: 180 },
  { renderScale: 0.42, maxSteps: 160 },
  { renderScale: 0.36, maxSteps: 140 },
  { renderScale: 0.3, maxSteps: 120 },
  { renderScale: 0.25, maxSteps: 100 },
];

const WINDOW = 45; // frames in the rolling window (~0.75 s at 60 fps)
const OVER_BUDGET_MS = 18.5; // sustained slower than ~54 fps → step down
const COOLDOWN_MS = 1200; // let a change settle before judging again
const PROBE_AFTER_MS = 9000; // calm this long → try one level up
const HOPELESS_MS = 34; // at the floor and still this slow...
const HOPELESS_FOR_MS = 4000; // ...for this long → fallback

export class QualityController {
  level: number;
  /** Rolling mean frame time (ms). */
  frameMs = 16.7;
  /** Set once the floor can't keep up; the stage swaps in the static fallback. */
  wantsFallback = false;

  private readonly samples: number[] = [];
  private readonly failedAt = new Set<number>();
  private lastChange = 0;
  private calmSince = 0;
  private hopelessSince = 0;
  private warmup = 0;

  constructor(startLevel: number) {
    this.level = Math.min(LADDER.length - 1, Math.max(0, startLevel));
  }

  get current(): QualityLevel {
    return LADDER[this.level]!;
  }

  get levels(): number {
    return LADDER.length;
  }

  /** Ignore the next few frames (shader compile, tab resume, route swaps). */
  settle(frames = 20): void {
    this.warmup = frames;
    this.samples.length = 0;
  }

  update(deltaMs: number, now: number): void {
    if (this.warmup > 0) {
      this.warmup--;
      return;
    }
    // A hitch over 250 ms is a stall (GC, tab switch), not steady-state cost.
    if (deltaMs > 250) return;
    this.samples.push(deltaMs);
    if (this.samples.length > WINDOW) this.samples.shift();
    if (this.samples.length < WINDOW) return;

    this.frameMs = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    if (now - this.lastChange < COOLDOWN_MS) return;

    if (this.frameMs > OVER_BUDGET_MS) {
      this.calmSince = 0;
      if (this.level < LADDER.length - 1) {
        this.failedAt.add(this.level);
        this.change(this.level + 1, now);
      } else if (this.frameMs > HOPELESS_MS) {
        this.hopelessSince ||= now;
        if (now - this.hopelessSince > HOPELESS_FOR_MS) this.wantsFallback = true;
      }
      return;
    }

    this.hopelessSince = 0;
    this.calmSince ||= now;
    const up = this.level - 1;
    if (up >= 0 && !this.failedAt.has(up) && now - this.calmSince > PROBE_AFTER_MS) this.change(up, now);
  }

  private change(level: number, now: number): void {
    this.level = level;
    this.lastChange = now;
    this.calmSince = 0;
    this.samples.length = 0;
  }
}

/** Where to start: phones and low-core machines begin a few rungs down. */
export function initialLevel(): number {
  if (new URLSearchParams(window.location.search).has('capture')) return 0;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  if (coarse) return 2;
  if (cores <= 4) return 1;
  return 0;
}
