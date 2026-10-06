import { useSyncExternalStore } from 'react';
import type { Engine } from './Engine';

// The running engine (for DOM code that reads live simulation values) and the
// current render mode: 'loading' until shaders compile, then 'webgl', or
// 'fallback' when the device gets the static image instead.
export type RenderMode = 'loading' | 'webgl' | 'fallback';

let current: Engine | null = null;
let mode: RenderMode = 'loading';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function setEngine(engine: Engine | null): void {
  current = engine;
  emit();
}

export function getEngine(): Engine | null {
  return current;
}

export function useEngine(): Engine | null {
  return useSyncExternalStore(subscribe, () => current);
}

export function setRenderMode(next: RenderMode): void {
  if (next === mode) return;
  mode = next;
  document.documentElement.dataset.render = next;
  emit();
}

export function getRenderMode(): RenderMode {
  return mode;
}

export function useRenderMode(): RenderMode {
  return useSyncExternalStore(subscribe, () => mode);
}
