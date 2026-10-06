import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { projects } from '../content/projects';
import { getEngine } from '../engine/engineStore';
import { useActiveBody } from '../engine/interaction';
import { onTick, prefersReducedMotion } from '../loop/ticker';

// Rough advance per character of the 8px expanded uppercase ring label.
const RING_CHAR_PX = 6.6;
const HOLE_LABEL = 'Photon sphere · r = 1.5 Rs  ·  Shadow · b = 2.598 Rs  ·  ';

function circlePath(r: number): string {
  return `M ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0`;
}

/** Orbital speed of a circular orbit, as measured by a local static observer. */
function orbitalSpeed(a: number): number {
  return 1 / Math.sqrt(2 * (a - 1));
}

/**
 * The instrument overlay: hairline rings around the hole, and for the active
 * project body, rings at its *lensed* screen position with its poetic labels
 * riding them, tethered to an info card. Decorative duplicate of DOM content,
 * so hidden from assistive tech; the real list lives in the Disk chapter.
 */
export function Annotations() {
  const active = useActiveBody();
  const project = active > 0 ? projects[active - 1] : undefined;

  const rootRef = useRef<HTMLDivElement>(null);
  const holeRef = useRef<SVGGElement>(null);
  const holeRing1 = useRef<SVGCircleElement>(null);
  const holeRing2 = useRef<SVGCircleElement>(null);
  const holeRing3 = useRef<SVGCircleElement>(null);
  const holeSpin = useRef<SVGGElement>(null);
  const holeText = useRef<SVGPathElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const bodyRing1 = useRef<SVGCircleElement>(null);
  const bodyRing2 = useRef<SVGCircleElement>(null);
  const bodySpin = useRef<SVGGElement>(null);
  const bodyText = useRef<SVGPathElement>(null);
  const leaderRef = useRef<SVGLineElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  const ringLabel = project ? `${project.orbitLabels.join('  ·  ')}  ·  ` : '';

  useEffect(() => {
    let spin = 0;
    let lastShadow = -1;
    let lastBodyR = -1;
    return onTick((_t, dms) => {
      const engine = getEngine();
      const root = rootRef.current;
      if (!engine || !root) return;
      const { hole, body, bodiesVis } = engine.anchors;
      root.style.opacity = String(bodiesVis);
      if (bodiesVis < 0.01) return;
      if (!prefersReducedMotion) spin += dms * 0.004;

      const h = holeRef.current;
      if (h) {
        h.style.display = hole.visible ? '' : 'none';
        h.setAttribute('transform', `translate(${hole.x.toFixed(1)} ${hole.y.toFixed(1)})`);
        const s = hole.shadowPx;
        if (Math.abs(s - lastShadow) > 0.5) {
          lastShadow = s;
          holeRing1.current?.setAttribute('r', (s * 1.9).toFixed(1));
          holeRing2.current?.setAttribute('r', (s * 3.1).toFixed(1));
          holeRing3.current?.setAttribute('r', (s * 4.7).toFixed(1));
          holeRing3.current?.setAttribute('cx', (s * 0.7).toFixed(1));
          holeRing3.current?.setAttribute('cy', (-s * 0.35).toFixed(1));
          holeText.current?.setAttribute('d', circlePath(s * 1.9 + 6));
        }
        holeSpin.current?.setAttribute('transform', `rotate(${(spin * 0.6).toFixed(2)})`);
      }

      const b = bodyRef.current;
      if (b) {
        b.style.display = body.visible ? '' : 'none';
        if (!body.visible) return;
        b.setAttribute('transform', `translate(${body.x.toFixed(1)} ${body.y.toFixed(1)})`);
        const rp = Math.max(body.radiusPx, 7);
        const r1 = rp * 1.45 + 6;
        const r2 = r1 * 1.45;
        const r3 = Math.max(r1 * 1.95, (ringLabel.length * RING_CHAR_PX) / (2 * Math.PI));
        if (Math.abs(r1 - lastBodyR) > 0.4) {
          lastBodyR = r1;
          bodyRing1.current?.setAttribute('r', r1.toFixed(1));
          bodyRing2.current?.setAttribute('r', r2.toFixed(1));
          bodyText.current?.setAttribute('d', circlePath(r3));
        }
        bodySpin.current?.setAttribute('transform', `rotate(${(-spin).toFixed(2)})`);

        // Leader from the label ring to the info card. Try the four diagonals,
        // preferring the one pointing away from the hole, and take the first
        // where the card fits on screen without covering the shadow.
        const info = infoRef.current;
        const w = info?.offsetWidth ?? 280;
        const hgt = info?.offsetHeight ?? 160;
        const away = Math.atan2(body.y - hole.y, body.x - hole.x);
        const candidates = [-35, -145, 35, 145]
          .map((deg) => (deg * Math.PI) / 180)
          .sort((p, q) => Math.cos(q - away) - Math.cos(p - away));
        type Placement = { x1: number; y1: number; x2: number; y2: number; left: number; top: number };
        let placed: Placement | null = null;
        let firstFit: Placement | null = null;
        let firstOption: Placement | null = null;
        for (const ang of candidates) {
          const right = Math.cos(ang) > 0;
          const down = Math.sin(ang) > 0;
          const x1 = Math.cos(ang) * (r3 + 6);
          const y1 = Math.sin(ang) * (r3 + 6);
          const x2 = x1 + (right ? 56 : -56);
          const y2 = y1 + (down ? 28 : -28);
          const left = body.x + x2 + (right ? 10 : -w - 10);
          const top = body.y + y2 + (down ? 0 : -hgt);
          const option: Placement = { x1, y1, x2, y2, left, top };
          firstOption ??= option;
          const fits = left > 16 && top > 16 && left + w < window.innerWidth - 16 && top + hgt < window.innerHeight - 16;
          if (!fits) continue;
          firstFit ??= option;
          // Nearest point of the card to the hole centre must clear the shadow.
          const cx = Math.max(left, Math.min(hole.x, left + w));
          const cy = Math.max(top, Math.min(hole.y, top + hgt));
          if (Math.hypot(cx - hole.x, cy - hole.y) > hole.shadowPx * 1.9) {
            placed = option;
            break;
          }
        }
        placed ??= firstFit ?? firstOption!;
        const l = leaderRef.current;
        if (l) {
          l.setAttribute('x1', placed.x1.toFixed(1));
          l.setAttribute('y1', placed.y1.toFixed(1));
          l.setAttribute('x2', placed.x2.toFixed(1));
          l.setAttribute('y2', placed.y2.toFixed(1));
        }
        if (info) info.style.transform = `translate(${placed.left.toFixed(1)}px, ${placed.top.toFixed(1)}px)`;
      }
    });
  }, [ringLabel]);

  // Draw-on when the active body changes.
  useLayoutEffect(() => {
    if (!project) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('[data-draw]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out', stagger: 0.06 });
      gsap.fromTo('[data-info] > *', { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.04, ease: 'power2.out' });
    }, rootRef);
    return () => ctx.revert();
  }, [project]);

  const a = project?.body.orbitRadius ?? 0;

  return (
    <div ref={rootRef} aria-hidden="true" className="annotations pointer-events-none fixed inset-0 z-[5]" style={{ opacity: 0 }}>
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <g ref={holeRef} className="text-ink-3">
          <circle ref={holeRing1} r="0" className="ring" />
          <g ref={holeSpin}>
            <circle ref={holeRing2} r="0" className="ring ring--dashed" />
          </g>
          <circle ref={holeRing3} r="0" className="ring ring--sparse" />
          <path ref={holeText} id="hole-label-path" d="" fill="none" />
          <text className="ring-text">
            <textPath href="#hole-label-path">{HOLE_LABEL.repeat(2)}</textPath>
          </text>
        </g>

        {project && (
          <g ref={bodyRef} className="text-ink-2">
            <circle ref={bodyRing1} r="0" className="ring" pathLength={1} strokeDasharray="1" data-draw />
            <g ref={bodySpin}>
              <circle ref={bodyRing2} r="0" className="ring ring--dashed" />
              <path ref={bodyText} id="body-label-path" d="" fill="none" />
              <text className="ring-text ring-text--body">
                <textPath href="#body-label-path">{ringLabel}</textPath>
              </text>
            </g>
            <line ref={leaderRef} className="ring" pathLength={1} strokeDasharray="1" data-draw />
          </g>
        )}
      </svg>

      {project && (
        <div ref={infoRef} data-info className="scrim absolute top-0 left-0 w-[min(32ch,78vw)]">
          <p className="font-mono text-[10px] text-ink-3">
            {String(active).padStart(2, '0')} / {String(projects.length).padStart(2, '0')} · a = {a.toFixed(1)} R
            <sub>s</sub> · v = {orbitalSpeed(a).toFixed(2)} c
          </p>
          <p className="mt-2 font-display text-[clamp(1.8rem,2.6vw,2.5rem)] leading-none text-ink-1">{project.name}</p>
          <p className="mt-2 font-display text-[1rem] leading-snug font-light text-ink-2">{project.oneLiner}</p>
          <p className="label mt-3 text-[9px] text-ink-3">{project.stack.join(' · ')}</p>
          <p className="mt-1 font-mono text-[10px] text-ink-3">{project.year ?? '—'}</p>
          <p className="label mt-4 text-ink-2">Slingshot →</p>
        </div>
      )}
    </div>
  );
}
