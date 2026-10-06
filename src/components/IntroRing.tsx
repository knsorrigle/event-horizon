import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { params } from '../engine/params';
import { framing } from '../engine/camera';
import { prefersReducedMotion } from '../loop/ticker';
import { useRenderMode } from '../engine/engineStore';

const B_CRIT = (3 * Math.sqrt(3)) / 2;

/** Where the hero's shadow will appear, and how big, from the hero camera. */
export function heroShadow(w: number, h: number) {
  const c = params.camera;
  const r = c.distance;
  const sinA = (B_CRIT * Math.sqrt(1 - 1 / r)) / r;
  const tanA = sinA / Math.sqrt(1 - sinA * sinA);
  const f = framing(c.fovDeg, c.lensShiftX, c.lensShiftY, w / h);
  return {
    x: (f.shiftX * 0.5 + 0.5) * w,
    y: (0.5 - f.shiftY * 0.5) * h,
    radius: (tanA / f.tanHalf) * (h / 2),
  };
}

/**
 * The loader is the intro: while the geodesic shader compiles, a hairline ring
 * draws itself exactly where the photon ring is about to appear. It never
 * covers the hero text (the LCP), and it hands over as the canvas fades in.
 */
export function IntroRing({ onDone }: { onDone: () => void }) {
  const rootRef = useRef<SVGSVGElement>(null);
  const mode = useRenderMode();
  const [{ w, h }] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const s = heroShadow(w, h);

  useLayoutEffect(() => {
    if (prefersReducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('[data-ring]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', stagger: 0.25 });
      gsap.fromTo('[data-ring-label]', { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.5 });
      gsap.to('[data-ring-spin]', { rotation: 360, svgOrigin: '0 0', duration: 6, ease: 'none', repeat: -1 });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // Hand over: fade out as the canvas (or the still) fades in, then unmount.
  useEffect(() => {
    if (mode === 'loading' || !rootRef.current) return;
    const tween = gsap.to(rootRef.current, { opacity: 0, duration: prefersReducedMotion ? 0 : 1.2, ease: 'power1.out', onComplete: onDone });
    return () => {
      tween.kill();
    };
  }, [mode, onDone]);

  return (
    <svg ref={rootRef} aria-hidden="true" className="intro-ring pointer-events-none fixed inset-0 -z-[5] h-full w-full" viewBox={`0 0 ${w} ${h}`}>
      <g transform={`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})`}>
        <circle r={s.radius} pathLength={1} strokeDasharray="1" data-ring />
        <g data-ring-spin>
          <circle r={s.radius * 1.9} pathLength={1} strokeDasharray="0.004 0.012" data-ring className="intro-ring__dash" />
        </g>
        <text y={s.radius * 1.9 + 22} textAnchor="middle" data-ring-label className="intro-ring__label">
          acquiring · r = {params.camera.distance.toFixed(2)} Rs
        </text>
      </g>
    </svg>
  );
}
