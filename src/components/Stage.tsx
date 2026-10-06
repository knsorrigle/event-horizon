import { useEffect, useRef } from 'react';
import { onTick, prefersReducedMotion } from '../loop/ticker';
import { setEngine } from '../engine/engineStore';

/** The fullscreen canvas behind the DOM. Mounted once, outlives route changes. */
export function Stage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = () => {};

    // three + postprocessing live in their own chunk: the hero text (the LCP)
    // never waits on the renderer.
    import('../engine/Engine')
      .then(({ Engine }) => Engine.create(canvas, { reducedMotion: prefersReducedMotion }))
      .then(async (engine) => {
        if (disposed) {
          engine.dispose();
          return;
        }
        const stopTick = onTick(engine.frame);
        setEngine(engine);
        let disposeDev = () => {};
        cleanup = () => {
          stopTick();
          disposeDev();
          setEngine(null);
          engine.dispose();
        };
        // Dev tooling is behind a static env check, so production builds drop
        // the import (and Tweakpane) entirely.
        if (import.meta.env.DEV) {
          const { mountDevTools } = await import('../dev/devtools');
          if (disposed) return;
          disposeDev = mountDevTools(engine);
        }
      })
      .catch((err: unknown) => {
        // WebGL unavailable: the DOM layer still carries all the content.
        console.error('[event-horizon] renderer failed to start', err);
      });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="fixed inset-0 -z-10 block h-full w-full [image-rendering:pixelated]" />;
}
