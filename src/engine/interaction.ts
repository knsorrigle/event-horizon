import { useSyncExternalStore } from 'react';

// Which project body is "active": keyboard focus wins over pointer hover.
// IDs are 1-based body IDs (0 = none), matching the shader's pick buffer.
let hovered = 0;
let focused = 0;
// Body picking runs only while a route that shows the orbiting bodies says so.
let interactive = false;
// During a slingshot the chosen body stays active and picking pauses.
let locked = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setHovered(id: number): void {
  if (id === hovered) return;
  hovered = id;
  emit();
}

export function setFocused(id: number): void {
  if (id === focused) return;
  focused = id;
  emit();
}

export function activeBody(): number {
  return locked || focused || hovered;
}

export function setLocked(id: number): void {
  if (id === locked) return;
  locked = id;
  emit();
}

export function isLocked(): boolean {
  return locked !== 0;
}

export function hoveredBody(): number {
  return hovered;
}

export function useActiveBody(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    activeBody,
  );
}

export function setInteractive(on: boolean): void {
  interactive = on;
  if (!on) {
    setHovered(0);
    setFocused(0);
    setLocked(0);
  }
}

export function isInteractive(): boolean {
  return interactive;
}
