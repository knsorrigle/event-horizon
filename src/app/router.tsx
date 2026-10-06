// A two-route History API router with View Transitions. Small enough that a
// routing dependency isn't worth it.
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { lenis, prefersReducedMotion } from '../loop/ticker';

export type Route = { name: 'home' } | { name: 'work'; slug: string } | { name: 'notFound' };

export function parseRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { name: 'home' };
  const work = /^\/work\/([a-z0-9-]+)\/?$/.exec(pathname);
  if (work?.[1]) return { name: 'work', slug: work[1] };
  return { name: 'notFound' };
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getPath = () => window.location.pathname;

function withTransition(update: () => void) {
  if (!document.startViewTransition || prefersReducedMotion) {
    update();
    return;
  }
  document.startViewTransition(() => flushSync(update));
}

window.addEventListener('popstate', () => withTransition(emit));

export function navigate(to: string): void {
  if (to === getPath()) return;
  withTransition(() => {
    window.history.pushState(null, '', to);
    // Reset through Lenis when it's driving the scroll, or its state desyncs.
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo(0, 0);
    emit();
  });
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
