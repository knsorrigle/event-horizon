import { useSyncExternalStore } from 'react';
import type { Engine } from './Engine';

// The running engine, for DOM code that reads live simulation values.
let current: Engine | null = null;
const listeners = new Set<() => void>();

export function setEngine(engine: Engine | null): void {
  current = engine;
  listeners.forEach((l) => l());
}

export function getEngine(): Engine | null {
  return current;
}

export function useEngine(): Engine | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
