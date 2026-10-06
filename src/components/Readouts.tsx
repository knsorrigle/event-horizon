import { useEffect, useRef } from 'react';
import { getEngine } from '../engine/engineStore';
import { params } from '../engine/params';
import { staticRedshift, timeDilation } from '../engine/physics';
import { onTick } from '../loop/ticker';

/** Above this the numbers are meaningless for a static observer: show ∞. */
const HORIZON_EPS = 1.0005;

function fmt(v: number, digits: number): string {
  return Number.isFinite(v) && v < 1e4 ? v.toFixed(digits) : '∞';
}

/**
 * Instrument readouts computed from the live camera radius. Written straight
 * into text nodes ~12×/s; React never re-renders for them.
 */
export function Readouts({ className = '' }: { className?: string }) {
  const rRef = useRef<HTMLSpanElement>(null);
  const tRef = useRef<HTMLSpanElement>(null);
  const zRef = useRef<HTMLSpanElement>(null);
  const iRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let acc = Infinity;
    return onTick((_t, dms) => {
      acc += dms;
      if (acc < 80) return;
      acc = 0;
      const engine = getEngine();
      const r = engine?.cameraRadius ?? params.camera.distance;
      const elev = engine?.cameraElevationDeg ?? params.camera.elevationDeg;
      const atHorizon = r <= HORIZON_EPS;
      if (rRef.current) rRef.current.textContent = r.toFixed(r < 2 ? 3 : 2);
      if (tRef.current) tRef.current.textContent = atHorizon ? '∞' : fmt(timeDilation(r), 4);
      if (zRef.current) zRef.current.textContent = atHorizon ? '∞' : fmt(staticRedshift(r), 4);
      if (iRef.current) iRef.current.textContent = (90 - elev).toFixed(1);
    });
  }, []);

  return (
    <dl className={`readouts ${className}`}>
      <div>
        <dt>r</dt>
        <dd>
          <span ref={rRef}>40.00</span> R<sub>s</sub>
        </dd>
      </div>
      <div>
        <dt>t_dilation</dt>
        <dd ref={tRef}>1.0127</dd>
      </div>
      <div>
        <dt>z</dt>
        <dd ref={zRef}>0.0127</dd>
      </div>
      <div>
        <dt>i</dt>
        <dd>
          <span ref={iRef}>82.0</span>°
        </dd>
      </div>
    </dl>
  );
}
