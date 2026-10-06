import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { onTick, prefersReducedMotion } from '../loop/ticker';
import { setEngine, setRenderMode, useRenderMode } from '../engine/engineStore';
import { captureMode, fallbackReason } from '../engine/capability';
import { useRoute } from '../app/router';
import { IntroRing } from './IntroRing';

/**
 * The fullscreen scene behind the DOM. Mounted once, outlives route changes.
 * Live WebGL when the device can carry it; otherwise (or if adaptive quality
 * gives up) a pre-rendered still of the same view, under the same DOM.
 */
export function Stage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mode = useRenderMode();
  const route = useRoute();
  // The intro ring only ever plays on a first load of the home page.
  const [intro, setIntro] = useState(() => route.name === 'home' && !captureMode);
  const endIntro = useCallback(() => setIntro(false), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = () => {};

    const reason = fallbackReason();
    if (reason) {
      setRenderMode('fallback');
      if (import.meta.env.DEV) console.info(`[event-horizon] static fallback: ${reason}`);
      return;
    }

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
        // The device couldn't hold even the lowest quality: hand over to the still.
        engine.onFallback = () => {
          cleanup();
          cleanup = () => {};
          setRenderMode('fallback');
        };
        setRenderMode('webgl');
        gsap.to(canvas, { opacity: 1, duration: prefersReducedMotion || captureMode ? 0 : 1.4, ease: 'power2.out' });
        if (captureMode) document.documentElement.dataset.capture = captureMode;

        // Dev tooling is behind a static env check, so production builds drop
        // the import (and Tweakpane) entirely.
        if (import.meta.env.DEV) {
          const { mountDevTools } = await import('../dev/devtools');
          if (disposed) return;
          disposeDev = mountDevTools(engine);
        }
      })
      .catch((err: unknown) => {
        // Context loss, shader failure, missing extension: the still takes over.
        console.error('[event-horizon] renderer failed to start', err);
        setRenderMode('fallback');
      });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  const reading = route.name !== 'home';

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 -z-10 block h-full w-full opacity-0 [image-rendering:pixelated]"
        style={mode === 'fallback' ? { display: 'none' } : undefined}
      />
      {mode === 'fallback' && (
        <picture aria-hidden="true" className={`fallback-still ${reading ? 'fallback-still--reading' : ''}`}>
          <source media="(max-aspect-ratio: 3/4)" srcSet="/fallback/hole-portrait.jpg" />
          <img src="/fallback/hole.jpg" alt="" decoding="async" fetchPriority="low" />
        </picture>
      )}
      {intro && <IntroRing onDone={endIntro} />}
    </>
  );
}
