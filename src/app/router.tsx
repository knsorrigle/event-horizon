// A two-route History API router with View Transitions. Small enough that a
// routing dependency isn't worth it.
//
// Scroll is restored manually: the home page is a 1000vh scroll-driven camera
// path, so coming back must land on the exact scroll (and camera) you left.
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { lenis, prefersReducedMotion } from '../loop/ticker';

export type Route = { name: 'home' } | { name: 'work'; slug: string } | { name: 'notFound' };

interface HistoryState {
  scrollY?: number;
  /** Set on entries reached by launching from the home page's orbit. */
  fromOrbit?: boolean;
}

export function parseRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { name: 'home' };
  const work = /^\/work\/([a-z0-9-]+)\/?$/.exec(pathname);
  if (work?.[1]) return { name: 'work', slug: work[1] };
  return { name: 'notFound' };
}

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getPath = () => window.location.pathname;

function currentScroll(): number {
  return lenis ? lenis.scroll : window.scrollY;
}

function scrollToY(y: number): void {
  if (lenis) {
    // The document just changed height; let Lenis re-measure before it clamps.
    lenis.resize();
    lenis.scrollTo(y, { immediate: true, force: true });
  } else {
    window.scrollTo(0, y);
  }
}

/** Swap routes (inside a view transition when allowed), then set the scroll. */
function transition(change: () => void, scrollY: number): void {
  const run = () => {
    flushSync(change);
    scrollToY(scrollY);
  };
  if (!document.startViewTransition || prefersReducedMotion) run();
  else document.startViewTransition(run);
}

window.addEventListener('popstate', (e) => {
  const state = (e.state ?? {}) as HistoryState;
  transition(emit, state.scrollY ?? 0);
});

export function navigate(to: string, opts: { scrollY?: number; fromOrbit?: boolean } = {}): void {
  if (to === getPath()) return;
  // Remember where we were on the entry we're leaving.
  const here = (history.state ?? {}) as HistoryState;
  history.replaceState({ ...here, scrollY: currentScroll() } satisfies HistoryState, '');
  transition(() => {
    history.pushState({ fromOrbit: opts.fromOrbit ?? false } satisfies HistoryState, '', to);
    emit();
  }, opts.scrollY ?? 0);
}

/** True when the previous history entry is the orbit this page was launched from. */
export function cameFromOrbit(): boolean {
  return ((history.state ?? {}) as HistoryState).fromOrbit === true;
}

export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, getPath);
  return parseRoute(path);
}

export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handle} {...rest} />;
}
