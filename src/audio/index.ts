// The sound layer's facade: the only audio module the app imports. Holds the
// visitor's choice, unlocks the AudioContext inside their gesture, lazy-loads
// the engine (which never ships until they opt in), and feeds it from the
// single RAF loop. Every call is a no-op while sound is off.
import { useSyncExternalStore } from 'react';
import type { AudioEngine, AudioFrame } from './soundEngine';
import { lenis, onTick, prefersReducedMotion } from '../loop/ticker';
import { getEngine } from '../engine/engineStore';
import { rig } from '../scroll/rig';
import { bodies } from '../engine/bodies';
import { activeBody } from '../engine/interaction';

export type SoundPref = 'on' | 'off' | null;

const KEY = 'eh.sound';

function readPref(): SoundPref {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'on' || v === 'off' ? v : null;
  } catch {
    return null; // private mode / blocked storage
  }
}

function writePref(p: 'on' | 'off'): void {
  try {
    window.localStorage.setItem(KEY, p);
  } catch {
    // the choice just won't persist
  }
}

let pref: SoundPref = readPref();
let audible = false;
/** Chose sound on an earlier visit; waiting for this visit's first gesture. */
let armed = false;
let ctx: AudioContext | null = null;
let engine: AudioEngine | null = null;
let loading: Promise<void> | null = null;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The stored choice: null until the visitor picks at the gate or the toggle. */
export function useSoundPref(): SoundPref {
  return useSyncExternalStore(subscribe, () => pref);
}

/**
 * What the toggle shows: 'on' (audible), 'armed' (chose sound on an earlier
 * visit; starts on this visit's first gesture), or 'off'.
 */
export type SoundState = 'on' | 'armed' | 'off';
const soundState = (): SoundState => (audible ? 'on' : armed ? 'armed' : 'off');
export function useSoundState(): SoundState {
  return useSyncExternalStore(subscribe, soundState);
}

/**
 * Turn sound on. MUST run synchronously inside a user gesture: iOS Safari only
 * unlocks an AudioContext created/resumed in the gesture's own call stack, so
 * the context is made here, before the engine chunk is even fetched.
 */
export function enableSound(): void {
  pref = 'on';
  writePref('on');
  audible = true;
  armed = false;
  emit();
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    // A one-sample silent buffer completes the unlock on older iOS.
    const silent = ctx.createBufferSource();
    silent.buffer = ctx.createBuffer(1, 1, 22050);
    silent.connect(ctx.destination);
    silent.start();
  }
  void ctx.resume();
  if (engine) {
    engine.fadeIn(0.8);
    engine.toggleTone(true);
    return;
  }
  const c = ctx;
  loading ??= import('./soundEngine').then(async ({ AudioEngine }) => {
    engine = await AudioEngine.create(c, { reducedMotion: prefersReducedMotion });
    startFeed();
    if (audible) {
      engine.fadeIn();
      engine.toggleTone(true);
    }
  });
}

/** Turn sound off (fades out, then suspends the context). */
export function disableSound(): void {
  pref = 'off';
  writePref('off');
  audible = false;
  armed = false;
  emit();
  if (!engine || !ctx) return;
  const c = ctx;
  engine.toggleTone(false);
  void engine.fadeOut(0.5).then(() => {
    if (!audible) void c.suspend();
  });
}

/** "Enter in silence": remember the choice, load nothing. */
export function chooseSilence(): void {
  pref = 'off';
  writePref('off');
  armed = false;
  emit();
}

/** Toggle: audible → off; off or armed → on (the click is the unlocking gesture). */
export function toggleSound(): void {
  if (audible) disableSound();
  else enableSound();
}

// A returning visitor who chose sound: never autoplay. Sound starts on their
// first real gesture of the visit (the click/keypress unlocks the context).
if (pref === 'on') {
  armed = true;
  const arm = (e: Event) => {
    if (!armed) return;
    // The toggle and gate buttons handle themselves.
    if (e.target instanceof Element && e.target.closest('[data-sound-control]')) return;
    window.removeEventListener('pointerdown', arm, true);
    window.removeEventListener('keydown', arm, true);
    enableSound();
  };
  window.addEventListener('pointerdown', arm, true);
  window.addEventListener('keydown', arm, true);
}

// Hidden tab: fade out and suspend; back again: resume and fade in.
document.addEventListener('visibilitychange', () => {
  if (!engine || !ctx || !audible) return;
  const c = ctx;
  if (document.hidden) {
    void engine.fadeOut(0.08).then(() => {
      if (document.hidden) void c.suspend();
    });
  } else {
    void c.resume().then(() => engine?.fadeIn(0.4));
  }
});

// ------------------------------------------------------------------ events

export const audio = {
  slingshot(bodyId: number): void {
    if (audible) engine?.slingshot(bodyId);
  },
  returnToOrbit(bodyId: number): void {
    if (audible) engine?.returnToOrbit(bodyId);
  },
  whiteHole(): void {
    if (audible) engine?.whiteHole();
  },
};

// ------------------------------------------------------------------ the feed

let lastScroll = 0;
let lastActive = 0;
const prevDistance: number[] = [];

function singularityProgress(): number {
  const el = document.getElementById('singularity');
  if (!el) return 0;
  const rect = el.getBoundingClientRect();
  const span = rect.height - window.innerHeight;
  return span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
}

function startFeed(): void {
  // Link/button hover: a tiny dry tick (delegated, throttled in the engine).
  document.addEventListener('pointerover', (e) => {
    if (!audible || !engine || !(e.target instanceof Element)) return;
    const el = e.target.closest('a, button');
    if (!el || (e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) return;
    engine.uiTick();
  });

  onTick((_t, dms) => {
    if (!engine) return;
    const dt = Math.min(dms / 1000, 0.1);
    const view = getEngine();
    const r = view?.cameraRadius ?? 40;

    const scrollY = window.scrollY;
    const velocity = lenis ? lenis.velocity : scrollY - lastScroll;
    lastScroll = scrollY;

    // Bodies: distance, radial velocity (for Doppler) and a pan from the
    // camera's right vector (the camera always looks roughly at the hole).
    const cam = view?.cameraPosition;
    const bodyFrames: AudioFrame['bodies'] = bodies.map((b, i) => {
      if (!cam) return { radialVelocity: 0, distance: 99, pan: 0, visible: 0 };
      const dx = b.center.x - cam.x;
      const dy = b.center.y - cam.y;
      const dz = b.center.z - cam.z;
      const distance = Math.hypot(dx, dy, dz);
      const radialVelocity = prevDistance[i] === undefined || dt === 0 ? 0 : (distance - prevDistance[i]!) / dt;
      prevDistance[i] = distance;
      // right = normalize(cross(forward, up)) with forward ≈ -cam.
      const rx = cam.z;
      const rz = -cam.x;
      const rl = Math.hypot(rx, rz) || 1;
      const pan = ((dx * rx + dz * rz) / rl / (distance || 1)) * 1.6;
      return { radialVelocity, distance, pan, visible: rig.bodies * (1 - 0.7 * rig.blur) };
    });

    engine.setFrame({
      r,
      velocity,
      fade: rig.fade,
      flare: rig.flare,
      reading: rig.blur,
      singularity: singularityProgress(),
      bodies: bodyFrames,
    });
    engine.update(dt);

    // Hover/focus a body → its note, panned by where its image is on screen.
    const active = activeBody();
    if (active !== lastActive) {
      lastActive = active;
      if (active && audible) {
        const a = view?.anchors.body;
        const pan = a && a.id === active && a.visible ? (a.x / window.innerWidth) * 2 - 1 : 0;
        engine.hoverBody(active, pan);
      }
    }
  });
}

// ------------------------------------------------------------------ dev hooks

/** Dev/test access (Tweakpane buttons, meters). */
export const audioDev = {
  engine: () => engine,
  context: () => ctx,
};
